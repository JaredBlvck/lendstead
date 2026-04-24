// NPC-to-NPC interactions. Pure decision logic — server.js owns persistence.
// Runs each cycle advance against alive+positioned NPCs. Healer-on-injured
// treatments materially upgrade condition; conversations nudge morale; trade
// flavors the narrative between role-compatible pairs. Silent on non-matches
// to keep the event stream meaningful.

export const ADJACENCY_DISTANCE = 1; // Chebyshev, includes diagonals
export const MAX_INTERACTIONS_PER_CYCLE = 8;
export const SKILL_CAP = 10;
export const QUEST_GIVER_SKILL_THRESHOLD = 5;

// Affinity: per-pair relationship score built from interaction history.
// Heavier investments (life-saving, knowledge transfer) move the needle more
// than light ones (small talk). Thresholds trigger one-shot narrative events.
export const AFFINITY_DELTA = {
  treat: 0.15,
  teach: 0.1,
  trade: 0.05,
  report: 0.03,
  conversation: 0.02,
};

export const AFFINITY_MILESTONES = [
  { key: "acquainted", threshold: 0.2 },
  { key: "friendly", threshold: 0.5 },
  { key: "close", threshold: 1.0 },
  { key: "bonded", threshold: 2.0 },
];

// Compute the symmetric pair-key (smaller id first) so affinity is direction-
// agnostic. Pure.
export function affinityPairKey(aId, bId) {
  const x = Number(aId);
  const y = Number(bId);
  return x < y ? [x, y] : [y, x];
}

// Score delta for an interaction. Returns a number (possibly negative for
// future conflict types). Pure.
export function affinityDelta(interaction) {
  if (!interaction) return 0;
  return AFFINITY_DELTA[interaction.type] ?? 0;
}

// Given previous-reached milestones + new score, return newly-crossed milestone
// keys (in ascending threshold order). Pure.
export function newAffinityMilestones(priorReached, newScore) {
  const reached = new Set(priorReached || []);
  const fresh = [];
  for (const m of AFFINITY_MILESTONES) {
    if (reached.has(m.key)) continue;
    if (Number(newScore) >= m.threshold) fresh.push(m.key);
  }
  return fresh;
}

// Probability tables. Rolls are independent per candidate pair; the first
// matching rule wins for a given pair (priority order below).
const PROB = {
  treat: 0.65,
  trade: 0.3,
  teach: 0.25,
  report: 0.2,
  conversation: 0.15,
};

// Role families — maps specific NPC roles (scout-in-training, scout-archaeology,
// inland-scout, carpenter, potter, fisher, hauler, ...) into broad categories
// the interaction engine cares about. Substring + exact hybrid: new role
// variants get grouped by semantic lineage rather than requiring an exact
// whitelist entry.
function roleFamily(role) {
  const r = (role || "").toLowerCase();
  if (!r) return "other";
  if (r === "healer") return "healer";
  if (r === "scholar" || r.includes("planner") || r.includes("marker"))
    return "scholar";
  if (r === "organizer") return "organizer";
  if (r.includes("scout") || r === "ranger" || r === "watcher") return "scout";
  if (r === "runner" || r === "hauler") return "runner";
  if (
    r.includes("forager") ||
    r === "gatherer" ||
    r === "fisher" ||
    r === "trader"
  )
    return "forager";
  if (r === "prospector" || r === "miner") return "prospector";
  if (
    r === "crafter" ||
    r === "smith" ||
    r === "carpenter" ||
    r === "toolmaker" ||
    r === "potter"
  )
    return "crafter";
  return "other";
}
const HEALER_FAMILIES = new Set(["healer"]);
const TRADE_SELLERS = new Set(["prospector", "crafter"]);
const TRADE_BUYERS = new Set(["forager", "runner"]);
const SCOUT_FAMILIES = new Set(["scout", "runner"]);
const TEACHER_FAMILIES = new Set(["scholar", "organizer", "healer"]);
const LEARNER_FAMILIES = new Set([
  "crafter",
  "prospector",
  "forager",
  "runner",
  "scout",
]);

function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function hasRole(npc, familySet) {
  return familySet.has(roleFamily(npc.role));
}

function isWounded(npc) {
  return npc.condition === "injured" || npc.condition === "incapacitated";
}

// Core decision — given two adjacent NPCs, return an interaction object or null.
// Priority: treat (life-saving) > trade > teach > report > conversation.
function classifyPair(a, b, rand) {
  // Treat: a healer adjacent to someone wounded.
  const healer = hasRole(a, HEALER_FAMILIES)
    ? a
    : hasRole(b, HEALER_FAMILIES)
      ? b
      : null;
  const patient = healer
    ? healer === a
      ? isWounded(b)
        ? b
        : null
      : isWounded(a)
        ? a
        : null
    : null;
  if (healer && patient) {
    if (rand() < PROB.treat) {
      const from = patient.condition;
      const to = from === "incapacitated" ? "injured" : "healthy";
      return {
        type: "treat",
        participants: pairOf(healer, patient),
        outcome: {
          patient_id: patient.id,
          patient_name: patient.name,
          condition_from: from,
          condition_to: to,
          healer_id: healer.id,
          healer_name: healer.name,
        },
      };
    }
  }

  // Trade: seller-role adjacent to buyer-role.
  const seller = hasRole(a, TRADE_SELLERS)
    ? a
    : hasRole(b, TRADE_SELLERS)
      ? b
      : null;
  const buyer = seller
    ? seller === a
      ? hasRole(b, TRADE_BUYERS)
        ? b
        : null
      : hasRole(a, TRADE_BUYERS)
        ? a
        : null
    : null;
  if (seller && buyer) {
    if (rand() < PROB.trade) {
      return {
        type: "trade",
        participants: pairOf(seller, buyer),
        outcome: {
          seller_role: seller.role,
          buyer_role: buyer.role,
          morale_boost: true, // both parties get a morale nudge up if possible
        },
      };
    }
  }

  // Teach: scholar/organizer/healer (teacher) adjacent to a same-lane
  // apprentice role. Knowledge transfer moment — teacher's expertise lifts the
  // learner. Same lane constraint keeps it within-clan; cross-lane teaching
  // would step on the narrative identity split.
  const teacher = hasRole(a, TEACHER_FAMILIES)
    ? a
    : hasRole(b, TEACHER_FAMILIES)
      ? b
      : null;
  const learner = teacher
    ? teacher === a
      ? hasRole(b, LEARNER_FAMILIES)
        ? b
        : null
      : hasRole(a, LEARNER_FAMILIES)
        ? a
        : null
    : null;
  if (teacher && learner && teacher.lane === learner.lane) {
    if (rand() < PROB.teach) {
      const priorSkill = Number(learner.skill || 0);
      const teacherSkill = Number(teacher.skill || 0);
      // Skill grows when the teacher's skill exceeds the learner's (can't teach
      // what you don't know) and the learner isn't already capped.
      const willLift = teacherSkill > priorSkill && priorSkill < SKILL_CAP;
      return {
        type: "teach",
        participants: pairOf(teacher, learner),
        outcome: {
          teacher_id: teacher.id,
          teacher_name: teacher.name,
          teacher_role: teacher.role,
          teacher_skill: teacherSkill,
          learner_id: learner.id,
          learner_name: learner.name,
          learner_role: learner.role,
          skill_from: priorSkill,
          skill_to: willLift ? priorSkill + 1 : priorSkill,
          skill_lifted: willLift,
          morale_boost: true,
        },
      };
    }
  }

  // Report: scout-role adjacent to anyone on the opposite lane.
  const scout = hasRole(a, SCOUT_FAMILIES)
    ? a
    : hasRole(b, SCOUT_FAMILIES)
      ? b
      : null;
  const reportee = scout ? (scout === a ? b : a) : null;
  if (scout && reportee && scout.lane !== reportee.lane) {
    if (rand() < PROB.report) {
      return {
        type: "report",
        participants: pairOf(scout, reportee),
        outcome: { cross_lane: true },
      };
    }
  }

  // Conversation: default fallback — any two adjacent NPCs not already paired
  // through a specialized interaction. Morale nudge up for both (capped).
  if (rand() < PROB.conversation) {
    return {
      type: "conversation",
      participants: pairOf(a, b),
      outcome: { morale_boost: true },
    };
  }

  return null;
}

function pairOf(a, b) {
  return [
    { id: a.id, name: a.name, role: a.role, lane: a.lane },
    { id: b.id, name: b.name, role: b.role, lane: b.lane },
  ];
}

// Compute this cycle's interactions. Each NPC can appear in at most one
// interaction (first-match wins by adjacency-iteration order). Caps at
// MAX_INTERACTIONS_PER_CYCLE. Positionless NPCs are skipped.
export function computeInteractions({ npcs, rand = Math.random }) {
  const positioned = (npcs || []).filter(
    (n) =>
      Number.isFinite(n.x) &&
      Number.isFinite(n.y) &&
      n.alive !== false &&
      n.condition !== "dead",
  );
  const used = new Set();
  const out = [];
  for (let i = 0; i < positioned.length; i++) {
    const a = positioned[i];
    if (used.has(a.id)) continue;
    for (let j = i + 1; j < positioned.length; j++) {
      const b = positioned[j];
      if (used.has(b.id)) continue;
      if (chebyshev(a, b) > ADJACENCY_DISTANCE) continue;
      const interaction = classifyPair(a, b, rand);
      if (!interaction) continue;
      out.push(interaction);
      used.add(a.id);
      used.add(b.id);
      if (out.length >= MAX_INTERACTIONS_PER_CYCLE) return out;
      break; // a is paired; move to next a
    }
  }
  return out;
}

// Translate outcomes into NPC field updates. Returns a map
// { [npc_id]: { morale?, condition?, last_condition_change?, skill? } }. Pure —
// caller owns UPDATE statements. Respects morale ladder (low→med→high, capped)
// and skill cap (SKILL_CAP).
export function applyInteractionEffects(interactions, nextCycle) {
  const moraleUp = (m) => (m === "low" ? "med" : m === "med" ? "high" : "high");
  const updates = {};
  for (const it of interactions) {
    if (it.type === "treat") {
      const pid = it.outcome.patient_id;
      updates[pid] = {
        ...(updates[pid] || {}),
        condition: it.outcome.condition_to,
        last_condition_change: nextCycle,
      };
    }
    if (it.type === "teach" && it.outcome?.skill_lifted) {
      const lid = it.outcome.learner_id;
      updates[lid] = {
        ...(updates[lid] || {}),
        skill: Math.min(SKILL_CAP, it.outcome.skill_to),
      };
    }
    if (it.outcome?.morale_boost) {
      for (const p of it.participants) {
        const cur = updates[p.id]?.morale_seed || p.morale || "med";
        updates[p.id] = {
          ...(updates[p.id] || {}),
          morale: moraleUp(cur),
          morale_seed: cur, // transient, for chained boost calc; stripped pre-write
        };
      }
    }
  }
  // Strip transient morale_seed before returning so callers write only real cols.
  for (const id of Object.keys(updates)) {
    delete updates[id].morale_seed;
  }
  return updates;
}

// Detect skill-threshold crossings — when a learner's skill lifts across a
// narrative boundary (e.g., the quest-giver threshold). Returns events to
// emit, one per crossing. Pure.
export function detectSkillCrossings(interactions) {
  const out = [];
  for (const it of interactions) {
    if (it.type !== "teach" || !it.outcome?.skill_lifted) continue;
    const { skill_from, skill_to, learner_id, learner_name, learner_role } =
      it.outcome;
    if (
      skill_from < QUEST_GIVER_SKILL_THRESHOLD &&
      skill_to >= QUEST_GIVER_SKILL_THRESHOLD
    ) {
      out.push({
        kind: "skill_threshold_crossed",
        threshold: "quest_giver",
        npc_id: learner_id,
        npc_name: learner_name,
        npc_role: learner_role,
        skill_from,
        skill_to,
      });
    }
  }
  return out;
}
