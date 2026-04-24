// Magic Awakening — ability catalog, cooldowns, unlock tiers, effect math.
// Pure logic module; server.js owns DB persistence + routing.

export const ABILITIES = {
  resource_amp: {
    energy_cost: 25,
    cooldown: 3,
    default_duration: 5,
    description: "Amplify food or water production for N cycles.",
  },
  protection: {
    energy_cost: 30,
    cooldown: 4,
    default_duration: 6,
    description: "Shield a zone from storms / threats for N cycles.",
  },
  npc_influence: {
    energy_cost: 20,
    cooldown: 3,
    default_duration: 1, // instant-feel, morale/trust nudge
    description: "Motivate, calm, or direct a subset of NPCs.",
  },
  terrain_shape: {
    energy_cost: 50,
    cooldown: 8,
    default_duration: 20,
    description: "Reshape a tile — water↔land, raise/lower, retype.",
  },
};

export const REGEN_BASE = 10;
export const REGEN_WITH_TEMPLE = 15;
export const ENERGY_CAP = 100;

// Unlock thresholds. Retroactive: any leader past a threshold fires the
// corresponding breakthrough on the next advance.
export const UNLOCK_TIERS = {
  resource_amp: { always: true },
  protection: { pop: 20, or_zones: 2 },
  npc_influence: { events_survived: 10 },
  terrain_shape: { pop: 30, events_survived: 15, both: true },
};

export function abilityUnlocked(name, state) {
  const tier = UNLOCK_TIERS[name];
  if (!tier) return false;
  if (tier.always) return true;
  const checks = [];
  if (tier.pop != null) checks.push(state.population >= tier.pop);
  if (tier.or_zones != null && tier.pop == null) {
    checks.push(state.zones_claimed >= tier.or_zones);
  }
  if (tier.events_survived != null)
    checks.push(state.events_survived >= tier.events_survived);
  // For "either pop OR zones" semantics used by protection.
  if (tier.or_zones != null && tier.pop != null) {
    return state.population >= tier.pop || state.zones_claimed >= tier.or_zones;
  }
  if (tier.both) return checks.every(Boolean);
  return checks.some(Boolean);
}

// Count abilities the leader has used since `cycle - cooldown`. If >=1,
// cooldown active and the ability cannot be used.
export function onCooldown(recentAbilities, leader, name, currentCycle) {
  const cd = ABILITIES[name]?.cooldown ?? 0;
  if (cd <= 0) return false;
  return recentAbilities.some(
    (a) =>
      a.leader === leader &&
      a.ability_name === name &&
      currentCycle - a.cycle_used < cd,
  );
}

// Validate an incoming ability post. Returns { ok, error? }.
export function validateAbility({
  leader,
  ability_name,
  target_data,
  energyAvailable,
  onCd,
  unlocked,
}) {
  if (!leader || !["sr", "jr"].includes(leader))
    return { ok: false, error: "leader must be 'sr' or 'jr'" };
  if (!ABILITIES[ability_name])
    return { ok: false, error: `unknown ability '${ability_name}'` };
  if (!unlocked)
    return { ok: false, error: `${ability_name} not yet unlocked` };
  if (onCd) return { ok: false, error: `${ability_name} on cooldown` };

  const spec = ABILITIES[ability_name];
  if (energyAvailable < spec.energy_cost)
    return {
      ok: false,
      error: `insufficient energy (need ${spec.energy_cost}, have ${energyAvailable})`,
    };

  // Per-ability target_data shape checks.
  const td = target_data || {};
  switch (ability_name) {
    case "resource_amp":
      if (!["food", "water"].includes(td.kind))
        return {
          ok: false,
          error: "resource_amp requires kind: 'food' or 'water'",
        };
      if (!(td.multiplier >= 1.1 && td.multiplier <= 2.0))
        return { ok: false, error: "resource_amp multiplier must be 1.1-2.0" };
      break;
    case "protection":
      if (!Array.isArray(td.tile) || td.tile.length !== 2)
        return { ok: false, error: "protection requires tile: [x,y]" };
      if (!(td.radius >= 1 && td.radius <= 6))
        return { ok: false, error: "protection radius must be 1-6" };
      break;
    case "npc_influence":
      if (
        !Array.isArray(td.affected_npc_ids) ||
        td.affected_npc_ids.length === 0
      )
        return {
          ok: false,
          error: "npc_influence requires affected_npc_ids[]",
        };
      if (!["motivate", "calm", "direct"].includes(td.effect))
        return {
          ok: false,
          error: "npc_influence effect must be motivate/calm/direct",
        };
      break;
    case "terrain_shape":
      if (!Array.isArray(td.tile) || td.tile.length !== 2)
        return { ok: false, error: "terrain_shape requires tile: [x,y]" };
      if (
        !["water", "beach", "plains", "forest", "mountain"].includes(
          td.new_type,
        )
      )
        return { ok: false, error: "terrain_shape new_type invalid" };
      if (!(td.new_height >= 0 && td.new_height <= 1))
        return { ok: false, error: "terrain_shape new_height must be 0-1" };
      break;
  }

  return { ok: true };
}

export function computeBreakthroughs(state, prior = []) {
  const priorSet = new Set(
    (prior || []).map((b) => `${b.leader}:${b.unlocks}`),
  );
  const current = [];
  const kinds = [
    "resource_amp",
    "protection",
    "npc_influence",
    "terrain_shape",
  ];
  for (const leader of ["sr", "jr"]) {
    for (const k of kinds) {
      if (!abilityUnlocked(k, state)) continue;
      const key = `${leader}:${k}`;
      if (!priorSet.has(key))
        current.push({ leader, unlocks: k, at_cycle: state.cycle });
    }
  }
  return current;
}

// Per-cycle resource multiplier from active resource_amp abilities.
export function resourceAmpMultipliers(activeAbilities) {
  const out = { food: 1.0, water: 1.0 };
  for (const a of activeAbilities) {
    if (a.ability_name !== "resource_amp") continue;
    const td = a.target_data || {};
    const m = Number(td.multiplier || 1.0);
    if (td.kind === "food") out.food = Math.max(out.food, m);
    else if (td.kind === "water") out.water = Math.max(out.water, m);
  }
  return out;
}

// Is a tile under an active protection aura? Returns { protected, mode }.
export function protectionAt(activeAbilities, tx, ty) {
  for (const a of activeAbilities) {
    if (a.ability_name !== "protection") continue;
    const td = a.target_data || {};
    if (!Array.isArray(td.tile)) continue;
    const [px, py] = td.tile;
    const r = Number(td.radius || 1);
    if (Math.hypot(tx - px, ty - py) <= r)
      return { protected: true, mode: td.mode || "storm_shield" };
  }
  return { protected: false };
}

// Rulership overuse detection — too many casts of the same ability in a
// short window imply tyrannical rule, reduces NPC trust + may spawn unrest.
export function overuseDetection(
  recentAbilities,
  leader,
  currentCycle,
  window = 10,
) {
  const recent = recentAbilities.filter(
    (a) => a.leader === leader && currentCycle - a.cycle_used < window,
  );
  return {
    count: recent.length,
    overuse: recent.length >= 6,
    trust_drift: recent.length >= 6 ? -0.08 : 0,
  };
}

// Monument derivation — only spatial abilities persist a tile-indexed trace.
// resource_amp has no tile target; npc_influence mutates NPCs, not the map.
export function monumentKind(ability_name) {
  if (ability_name === "terrain_shape") return "obelisk";
  if (ability_name === "protection") return "protection";
  return null;
}

export function monumentPosition(ability_name, target_data) {
  const td = target_data || {};
  if (
    (ability_name === "terrain_shape" || ability_name === "protection") &&
    Array.isArray(td.tile) &&
    td.tile.length === 2
  ) {
    return [Number(td.tile[0]), Number(td.tile[1])];
  }
  return null;
}

// Upsert a cast into a monuments array. Matches on (x, y, kind); increments
// casts + leader_counts + last_cycle on match, otherwise appends. Pure —
// server.js owns persistence.
export function applyCast(monuments, { x, y, kind, leader, cycle }) {
  const arr = Array.isArray(monuments) ? [...monuments] : [];
  const idx = arr.findIndex((m) => m.x === x && m.y === y && m.kind === kind);
  if (idx === -1) {
    arr.push({
      x,
      y,
      kind,
      casts: 1,
      dominant_leader: leader,
      origin_cycle: cycle,
      last_cycle: cycle,
      leader_counts: {
        sr: leader === "sr" ? 1 : 0,
        jr: leader === "jr" ? 1 : 0,
      },
    });
    return arr;
  }
  const m = arr[idx];
  const counts = {
    sr: (m.leader_counts?.sr || 0) + (leader === "sr" ? 1 : 0),
    jr: (m.leader_counts?.jr || 0) + (leader === "jr" ? 1 : 0),
  };
  arr[idx] = {
    ...m,
    casts: (m.casts || 0) + 1,
    last_cycle: cycle,
    leader_counts: counts,
    dominant_leader: counts.sr >= counts.jr ? "sr" : "jr",
  };
  return arr;
}

// Auto-cast decision — pure. Returns a cast spec to execute, or null when
// the engine should stay silent. Jr-only in v1 (sustenance is Architect's
// lane). Deliberately conservative to avoid interfering with active rulers.
// Thresholds: 3+ deficit days, 10+ idle cycles, energy >= 25, no active amp
// of the same kind.
export const AUTO_CAST_IDLE_THRESHOLD = 10;
export const AUTO_CAST_DEFICIT_THRESHOLD = 3;
export const AUTO_CAST_RESOURCE_AMP_COST = 25;
export const AUTO_CAST_RESOURCE_AMP_MULTIPLIER = 1.5;
export const AUTO_CAST_RESOURCE_AMP_DURATION = 5;

export function shouldAutoCastResourceAmp({
  kind,
  balance,
  jrEnergy,
  activeAbilities,
  lastJrCastCycle,
  nextCycle,
}) {
  if (kind !== "food" && kind !== "water") return null;
  const deficitDays = Number(balance?.[`${kind}_deficit_days`] || 0);
  if (deficitDays < AUTO_CAST_DEFICIT_THRESHOLD) return null;
  const idleCycles =
    lastJrCastCycle == null || lastJrCastCycle < 0
      ? Infinity
      : nextCycle - lastJrCastCycle;
  if (idleCycles < AUTO_CAST_IDLE_THRESHOLD) return null;
  if (Number(jrEnergy || 0) < AUTO_CAST_RESOURCE_AMP_COST) return null;
  const hasActive = (activeAbilities || []).some(
    (a) =>
      a.ability_name === "resource_amp" &&
      (a.target_data || {}).kind === kind &&
      Number(a.expires_cycle || 0) > nextCycle,
  );
  if (hasActive) return null;
  return {
    leader: "jr",
    ability_name: "resource_amp",
    kind,
    multiplier: AUTO_CAST_RESOURCE_AMP_MULTIPLIER,
    duration_cycles: AUTO_CAST_RESOURCE_AMP_DURATION,
    cost: AUTO_CAST_RESOURCE_AMP_COST,
    idle_cycles: idleCycles === Infinity ? null : idleCycles,
    deficit_days: deficitDays,
  };
}

export function flavorSummary(ability_name, target_data) {
  const td = target_data || {};
  switch (ability_name) {
    case "resource_amp":
      return `${td.kind} production ×${td.multiplier} for ${td.duration_cycles}c`;
    case "protection":
      return `${td.mode || "shield"} at [${td.tile?.[0]},${td.tile?.[1]}] r=${td.radius} for ${td.duration_cycles}c`;
    case "npc_influence":
      return `${td.effect} ${td.affected_npc_ids?.length || 0} NPCs`;
    case "terrain_shape":
      return `[${td.tile?.[0]},${td.tile?.[1]}] → ${td.new_type} (h=${td.new_height}) for ${td.duration_cycles}c`;
    default:
      return ability_name;
  }
}
