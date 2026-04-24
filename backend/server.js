import express from "express";
import cors from "cors";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./db.js";
import {
  generateTerrain,
  seedPositionFor,
  jitterPosition,
  rollEvents,
  computeSeverity,
  severityMultiplier,
  computeConsequences,
  computeResourceBalance,
  generateFallbackDecision,
  deriveShelterSites,
  rescueStrandedNpcs,
} from "./engine.js";
import {
  ABILITIES,
  REGEN_BASE,
  REGEN_WITH_TEMPLE,
  ENERGY_CAP,
  abilityUnlocked,
  onCooldown,
  validateAbility,
  computeBreakthroughs,
  resourceAmpMultipliers,
  protectionAt,
  overuseDetection,
  flavorSummary,
  monumentKind,
  monumentPosition,
  applyCast,
  shouldAutoCastResourceAmp,
} from "./magic.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "512kb" }));

// In-memory auto-cycle ticker. Single-replica service, so a Map suffices.
// Survives a browser close; dies with the process (fine — restart reattaches
// nothing, caller just hits /start again).
const autoCycle = { timer: null, interval_sec: null, started_at: null };

app.get("/health", (_req, res) => res.json({ ok: true }));

// === READ ===

app.get("/api/world", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM world ORDER BY id DESC LIMIT 1",
    );
    res.json(rows[0] || null);
  } catch (e) {
    next(e);
  }
});

app.get("/api/npcs", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM npcs ORDER BY lane, cycle_created, id",
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.get("/api/logs", async (req, res, next) => {
  try {
    const cycle = req.query.cycle;
    const { rows } = cycle
      ? await pool.query(
          "SELECT * FROM logs WHERE cycle = $1 ORDER BY created_at ASC",
          [Number(cycle)],
        )
      : await pool.query("SELECT * FROM logs ORDER BY created_at ASC");
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.get("/api/events", async (req, res, next) => {
  try {
    const since = req.query.since;
    const { rows } = since
      ? await pool.query(
          "SELECT * FROM events WHERE created_at > $1 ORDER BY created_at ASC",
          [since],
        )
      : await pool.query(
          "SELECT * FROM events ORDER BY created_at DESC LIMIT 50",
        );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// === WRITE ===

// POST /api/decisions
// body: { leader, cycle, action, reasoning, npc_changes[], resource_delta, infra_delta }
app.post("/api/decisions", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      leader,
      cycle,
      action,
      reasoning = null,
      npc_changes = [],
      resource_delta = {},
      infra_delta = {},
    } = req.body || {};

    if (!leader || !cycle || !action) {
      return res.status(400).json({ error: "leader, cycle, action required" });
    }
    if (!["sr", "jr"].includes(leader)) {
      return res.status(400).json({ error: "leader must be 'sr' or 'jr'" });
    }

    await client.query("BEGIN");

    const logInsert = await client.query(
      "INSERT INTO logs (cycle, leader, action, reasoning) VALUES ($1,$2,$3,$4) RETURNING *",
      [cycle, leader, action, reasoning],
    );

    let npcs_added = 0;
    let npcs_updated = 0;
    const npc_errors = [];

    for (const change of npc_changes) {
      const name = change?.name;
      if (!name) {
        npc_errors.push({ change, error: "missing name" });
        continue;
      }

      const explicitOp = change.op;
      const hasCreateFields = Boolean(change.role && change.lane);
      const isAdd = explicitOp === "add" || (!explicitOp && hasCreateFields);
      const isUpdate =
        explicitOp === "update" || (!explicitOp && !hasCreateFields);

      if (isAdd) {
        const {
          role,
          skill = 3,
          morale = "med",
          status = "",
          lane,
          alive = true,
          cycle_created = cycle,
        } = change;
        if (!role || !lane) {
          npc_errors.push({ name, error: "add requires role + lane" });
          continue;
        }
        const r = await client.query(
          `INSERT INTO npcs (name, role, skill, morale, status, lane, alive, cycle_created)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (name) DO NOTHING
           RETURNING id`,
          [name, role, skill, morale, status, lane, alive, cycle_created],
        );
        if (r.rowCount > 0) npcs_added++;
        else npc_errors.push({ name, error: "name already exists (no-op)" });
      } else if (isUpdate) {
        const { status, morale, skill, alive, role, lane } = change;
        const r = await client.query(
          `UPDATE npcs SET
             status = COALESCE($2, status),
             morale = COALESCE($3, morale),
             skill  = COALESCE($4, skill),
             alive  = COALESCE($5, alive),
             role   = COALESCE($6, role),
             lane   = COALESCE($7, lane)
           WHERE name = $1
           RETURNING id`,
          [
            name,
            status ?? null,
            morale ?? null,
            skill ?? null,
            alive ?? null,
            role ?? null,
            lane ?? null,
          ],
        );
        if (r.rowCount > 0) npcs_updated++;
        else
          npc_errors.push({ name, error: "no NPC with that name to update" });
      } else {
        npc_errors.push({ name, error: "ambiguous op" });
      }
    }

    // Merge resource/infra deltas onto the current world row (shallow JSONB merge).
    if (Object.keys(resource_delta).length || Object.keys(infra_delta).length) {
      await client.query(
        `UPDATE world SET
           resources      = resources      || $1::jsonb,
           infrastructure = infrastructure || $2::jsonb,
           updated_at     = now()
         WHERE id = (SELECT id FROM world ORDER BY id DESC LIMIT 1)`,
        [JSON.stringify(resource_delta), JSON.stringify(infra_delta)],
      );
    }

    const evt = await client.query(
      "INSERT INTO events (cycle, kind, payload) VALUES ($1, 'decision', $2) RETURNING *",
      [cycle, { leader, action, reasoning }],
    );

    await client.query("COMMIT");
    res.json({
      log: logInsert.rows[0],
      event: evt.rows[0],
      npcs_added,
      npcs_updated,
      npc_errors,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// Core cycle advancement. Single transaction that:
// 1. Jitters NPC positions
// 2. Rolls events with severity tagging (escalation + streak-boost)
// 3. Applies consequences with per-cycle caps (1 death / 3 injuries / 1 structure)
// 4. Computes food/water balance, rolls deficit effects
// 5. Inserts consequence logs linked back to their cause events
// 6. Falls back to an 'auto' maintenance log if no leader posted this cycle
const CAPS = { deaths: 1, injuries: 3, structure_damage: 1 };

async function runCycleAdvance() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM world ORDER BY id DESC LIMIT 1",
    );
    const current = rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      throw new Error("no world seeded");
    }

    const prevCycle = current.cycle;
    const nextCycle = prevCycle + 1;

    // Alive = alive flag AND condition != dead. Incapacitated still alive but
    // doesn't produce / consume beyond base consumption.
    const { rows: aliveNpcs } = await client.query(
      "SELECT * FROM npcs WHERE alive = true AND condition != 'dead'",
    );

    // ---- MAGIC: expire terrain_shape abilities (revert tiles), load active ----
    let terrainWorking = current.terrain || [];
    const { rows: expiringTerrainShapes } = await client.query(
      `SELECT * FROM abilities
        WHERE ability_name = 'terrain_shape'
          AND expires_cycle IS NOT NULL
          AND expires_cycle = $1`,
      [nextCycle],
    );
    let terrainChangedThisAdvance = false;
    for (const a of expiringTerrainShapes) {
      const td = a.target_data || {};
      const orig = td.original_tile;
      if (!Array.isArray(td.tile) || !orig) continue;
      const [tx, ty] = td.tile;
      terrainWorking = terrainWorking.map((t) =>
        t.x === tx && t.y === ty
          ? { ...t, type: orig.type, height: orig.height }
          : t,
      );
      terrainChangedThisAdvance = true;
    }
    if (terrainChangedThisAdvance) {
      await client.query("UPDATE world SET terrain = $1::jsonb WHERE id = $2", [
        JSON.stringify(terrainWorking),
        current.id,
      ]);
    }

    const { rows: activeAbilities } = await client.query(
      `SELECT * FROM abilities
        WHERE expires_cycle IS NULL OR expires_cycle > $1`,
      [nextCycle],
    );

    // ---- Position jitter ----
    const terrainForJitter = terrainWorking;
    const position_deltas = [];
    for (const n of aliveNpcs) {
      if (n.condition === "incapacitated") continue; // injured-heavy stay put
      const from = { x: n.x, y: n.y };
      const to = jitterPosition(n, terrainForJitter);
      if (to.x !== from.x || to.y !== from.y) {
        await client.query("UPDATE npcs SET x = $1, y = $2 WHERE id = $3", [
          to.x,
          to.y,
          n.id,
        ]);
        position_deltas.push({ id: n.id, name: n.name, from, to });
      }
    }

    // ---- Severity escalation: count recent same-kind events (last 5 cycles)
    const { rows: recent } = await client.query(
      `SELECT kind, cycle FROM events
        WHERE cycle >= $1 AND cycle <= $2
          AND kind IN ('storm','discovery','threat_sighted')`,
      [Math.max(0, prevCycle - 4), prevCycle],
    );
    const countByKind = (kind) => recent.filter((e) => e.kind === kind).length;

    // ---- Dry-streak boost (existing) ----
    const streakRow = await client.query(
      `SELECT COALESCE(MAX(cycle), 0) AS last_evt_cycle
         FROM events
        WHERE kind IN ('storm','discovery','threat_sighted')`,
    );
    const lastEventCycle = Number(streakRow.rows[0].last_evt_cycle) || 0;
    const dry_streak = Math.max(0, prevCycle - lastEventCycle);

    // ---- Roll events; tag severity; scale radius ----
    const terrain = terrainWorking;
    const rolled = rollEvents({
      cycle: nextCycle,
      npcs: aliveNpcs,
      terrain,
      dry_streak,
    });
    const rolledKept = [];
    for (const evt of rolled) {
      const sameKindCount = countByKind(evt.kind);
      const severity = computeSeverity(evt.kind, sameKindCount);
      evt.payload.severity = severity;
      if (typeof evt.payload.radius === "number") {
        evt.payload.radius = Math.round(
          evt.payload.radius * severityMultiplier(severity),
        );
      }

      // Magic protection: events whose tile/center is inside an active
      // protection aura either cancel or downgrade severity.
      const centerTile = Array.isArray(evt.payload.center)
        ? evt.payload.center
        : Array.isArray(evt.payload.tile)
          ? evt.payload.tile
          : null;
      if (centerTile) {
        const prot = protectionAt(
          activeAbilities,
          centerTile[0],
          centerTile[1],
        );
        if (prot.protected) {
          if (evt.kind === "storm" && prot.mode === "storm_shield") {
            evt.payload.protected_by = "storm_shield";
            evt.payload.severity = "minor"; // downgraded
          } else if (
            evt.kind === "threat_sighted" &&
            prot.mode === "threat_deterrent"
          ) {
            evt.payload.protected_by = "threat_deterrent";
            evt.payload.severity = "minor";
          }
        }
      }
      rolledKept.push(evt);
    }
    rolled.length = 0;
    rolled.push(...rolledKept);

    // ---- Compute consequences (pre-apply) ----
    const shelterSites = deriveShelterSites(current.infrastructure);
    let deathsUsed = 0;
    let injuriesUsed = 0;
    let structureDamageUsed = 0;
    const allConsequences = [];

    for (const evt of rolled) {
      const raw = computeConsequences({
        event: evt,
        alive: aliveNpcs,
        shelterSites,
        infrastructure: current.infrastructure,
      });
      const applied = [];
      for (const c of raw) {
        if (c.type === "injury" && injuriesUsed < CAPS.injuries) {
          const target = aliveNpcs.find((n) => n.id === c.npc_id);
          if (!target || target.condition === "dead") continue;
          const nextCondition =
            target.condition === "healthy"
              ? "injured"
              : target.condition === "injured"
                ? "incapacitated"
                : "incapacitated";
          await client.query(
            `UPDATE npcs SET condition = $1, injury_cycle = $2,
                             last_condition_change = $2
               WHERE id = $3`,
            [nextCondition, nextCycle, target.id],
          );
          target.condition = nextCondition; // mutate local so later rolls see it
          applied.push({ ...c, result: nextCondition });
          injuriesUsed++;
        } else if (
          c.type === "structure_damage" &&
          structureDamageUsed < CAPS.structure_damage
        ) {
          applied.push(c);
          structureDamageUsed++;
        }
      }
      evt.payload.consequences = applied;
      allConsequences.push(...applied);
    }

    // ---- Resource balance (based on current alive roster AFTER injuries) ----
    const aliveForBalance = aliveNpcs.filter(
      (n) => n.condition !== "dead" && n.condition !== "incapacitated",
    );
    const prevBalance = {
      food_deficit_days: Number(current.resources?.food_deficit_days || 0),
      water_deficit_days: Number(current.resources?.water_deficit_days || 0),
    };
    const balance = computeResourceBalance({
      alive: aliveForBalance,
      infrastructure: current.infrastructure,
      prevBalance,
    });

    // Magic resource_amp: multiply production if an active resource_amp of
    // matching kind is running. Multiplier is max over all active stacks.
    const ampMults = resourceAmpMultipliers(activeAbilities);
    if (ampMults.food !== 1.0) {
      balance.food_production = Number(
        (balance.food_production * ampMults.food).toFixed(2),
      );
      balance.food_balance = Number(
        (balance.food_production - balance.food_consumption).toFixed(2),
      );
      balance.food_deficit_days =
        balance.food_balance < 0
          ? Math.min(10, (prevBalance.food_deficit_days || 0) + 1)
          : 0;
      balance.food_amp_active = ampMults.food;
    }
    if (ampMults.water !== 1.0) {
      balance.water_production = Number(
        (balance.water_production * ampMults.water).toFixed(2),
      );
      balance.water_balance = Number(
        (balance.water_production - balance.water_consumption).toFixed(2),
      );
      balance.water_deficit_days =
        balance.water_balance < 0
          ? Math.min(10, (prevBalance.water_deficit_days || 0) + 1)
          : 0;
      balance.water_amp_active = ampMults.water;
    }

    // ---- Deficit effects ----
    if (balance.food_deficit_days > 3) {
      // Drop morale for up to 2 non-low NPCs.
      const victims = aliveNpcs
        .filter((n) => n.condition !== "dead" && n.morale !== "low")
        .slice(0, 2);
      for (const v of victims) {
        const newMorale = v.morale === "high" ? "med" : "low";
        await client.query("UPDATE npcs SET morale = $1 WHERE id = $2", [
          newMorale,
          v.id,
        ]);
        allConsequences.push({
          type: "morale_drop",
          npc_id: v.id,
          npc_name: v.name,
          cause: `food deficit ${balance.food_deficit_days}d`,
          from: v.morale,
          to: newMorale,
        });
      }
    }
    if (balance.water_deficit_days > 2 && injuriesUsed < CAPS.injuries) {
      // Drop condition for 1 healthy NPC.
      const victim = aliveNpcs.find(
        (n) => n.condition === "healthy" && n.alive,
      );
      if (victim) {
        await client.query(
          `UPDATE npcs SET condition = 'injured', injury_cycle = $1,
                           last_condition_change = $1 WHERE id = $2`,
          [nextCycle, victim.id],
        );
        victim.condition = "injured";
        allConsequences.push({
          type: "injury",
          npc_id: victim.id,
          npc_name: victim.name,
          cause: `water deficit ${balance.water_deficit_days}d`,
          result: "injured",
        });
        injuriesUsed++;
      }
    }

    // ---- Recovery: when the civ has food + water surplus AND medical
    // infrastructure, incapacitated → injured → healthy over cycles. Without
    // this, injuries accumulate forever and any crisis becomes unrecoverable.
    const recoveries = [];
    if (balance.food_balance >= 0 && balance.water_balance >= 0) {
      const infraTokens = JSON.stringify(current.infrastructure || {});
      const medicalCount = (
        infraTokens.match(/medical|med[_-]?tent|healer|infirmary/gi) || []
      ).length;
      const healerAlive = aliveNpcs.some(
        (n) => n.condition !== "dead" && /healer|medic|infirmary/i.test(n.role),
      );
      // Famine-resistance trait earned from the C59→C588 crisis: the civ
      // learned preservation habits. Cistern + granary tokens contribute
      // +0.5 heal/cycle each, capped at +2.
      const cisternCount = (infraTokens.match(/cistern/gi) || []).length;
      const granaryCount = (infraTokens.match(/granary/gi) || []).length;
      const famineResistance = Math.min(2, (cisternCount + granaryCount) * 0.5);
      const baseHeals =
        medicalCount > 0 ? (healerAlive ? 3 : 2) : healerAlive ? 1 : 0;
      const healsThisCycle = Math.round(baseHeals + famineResistance);

      const incap = aliveNpcs
        .filter((n) => n.condition === "incapacitated")
        .sort(
          (a, b) =>
            (a.last_condition_change || 0) - (b.last_condition_change || 0),
        );
      const injured = aliveNpcs
        .filter((n) => n.condition === "injured")
        .sort((a, b) => (a.injury_cycle || 0) - (b.injury_cycle || 0));

      let remaining = healsThisCycle;
      for (const n of incap) {
        if (remaining <= 0) break;
        await client.query(
          `UPDATE npcs SET condition = 'injured', last_condition_change = $1 WHERE id = $2`,
          [nextCycle, n.id],
        );
        n.condition = "injured";
        recoveries.push({
          id: n.id,
          name: n.name,
          from: "incapacitated",
          to: "injured",
        });
        remaining--;
      }
      for (const n of injured) {
        if (remaining <= 0) break;
        await client.query(
          `UPDATE npcs SET condition = 'healthy', injury_cycle = NULL,
                           last_condition_change = $1 WHERE id = $2`,
          [nextCycle, n.id],
        );
        n.condition = "healthy";
        recoveries.push({
          id: n.id,
          name: n.name,
          from: "injured",
          to: "healthy",
        });
        remaining--;
      }

      // Morale slow-recovery: when surplus has held 3+ cycles, random low→med.
      if (
        (balance.food_deficit_days || 0) === 0 &&
        (balance.water_deficit_days || 0) === 0
      ) {
        const lowMorale = aliveNpcs
          .filter((n) => n.morale === "low" && n.condition !== "dead")
          .slice(0, 2);
        for (const n of lowMorale) {
          await client.query("UPDATE npcs SET morale = 'med' WHERE id = $1", [
            n.id,
          ]);
          recoveries.push({
            id: n.id,
            name: n.name,
            morale_from: "low",
            morale_to: "med",
          });
        }
      }
    }

    // ---- Update world + count alive ----
    const { rows: aliveRecount } = await client.query(
      "SELECT COUNT(*)::int AS n FROM npcs WHERE alive = true AND condition != 'dead'",
    );
    const pop = aliveRecount[0].n;
    const newResources = {
      ...(current.resources || {}),
      food_production: balance.food_production,
      food_consumption: balance.food_consumption,
      food_balance: balance.food_balance,
      food_deficit_days: balance.food_deficit_days,
      water_production: balance.water_production,
      water_consumption: balance.water_consumption,
      water_balance: balance.water_balance,
      water_deficit_days: balance.water_deficit_days,
    };
    if (balance.food_amp_active)
      newResources.food_amp_active = balance.food_amp_active;
    if (balance.water_amp_active)
      newResources.water_amp_active = balance.water_amp_active;

    // ---- MAGIC: energy regen + breakthroughs + overuse ----
    const infraTokensStr = JSON.stringify(current.infrastructure || {});
    const templeActive = /temple/i.test(infraTokensStr);
    const regen = templeActive ? REGEN_WITH_TEMPLE : REGEN_BASE;
    let srEnergyNext = Math.min(
      ENERGY_CAP,
      Number(current.sr_energy || 0) + regen,
    );
    let jrEnergyNext = Math.min(
      ENERGY_CAP,
      Number(current.jr_energy || 0) + regen,
    );

    // Breakthroughs: any unlocked ability for either leader not previously
    // in world.breakthroughs fires a breakthrough event on this advance.
    const eventsSurvivedRow = await client.query(
      "SELECT COUNT(*)::int AS n FROM events WHERE kind IN ('storm','discovery','threat_sighted')",
    );
    const stateForUnlocks = {
      population: pop,
      zones_claimed: Array.isArray(current.infrastructure?.claims)
        ? current.infrastructure.claims.length
        : 0,
      events_survived: eventsSurvivedRow.rows[0].n,
      cycle: nextCycle,
    };
    const newBreakthroughs = computeBreakthroughs(
      stateForUnlocks,
      current.breakthroughs || [],
    );
    const allBreakthroughs = [
      ...(current.breakthroughs || []),
      ...newBreakthroughs,
    ];

    // Overuse: if either leader used the same ability ≥6 times in the last 10
    // cycles, drift ruler_trust slightly down for a random subset of NPCs.
    const overuseConsequences = [];
    const { rows: overuseRecent } = await client.query(
      "SELECT leader, ability_name, cycle_used FROM abilities WHERE cycle_used >= $1",
      [Math.max(0, nextCycle - 10)],
    );
    for (const leader of ["sr", "jr"]) {
      const o = overuseDetection(overuseRecent, leader, nextCycle, 10);
      if (!o.overuse) continue;
      const { rows: trustVictims } = await client.query(
        `SELECT id, name FROM npcs WHERE alive = true AND condition != 'dead'
         ORDER BY random() LIMIT 3`,
      );
      for (const v of trustVictims) {
        await client.query(
          "UPDATE npcs SET ruler_trust = GREATEST(0, ruler_trust + $1) WHERE id = $2",
          [o.trust_drift, v.id],
        );
      }
      overuseConsequences.push({
        type: "overuse_distrust",
        leader,
        count: o.count,
        trust_drift_applied: o.trust_drift,
        victim_count: trustVictims.length,
      });
    }

    // ---- MAGIC: auto-cast — fills the void when rulers are idle during a
    // resource crisis. Decision logic lives in magic.js (pure, unit-tested);
    // this block owns persistence only. Max 1 per advance, food > water.
    const autoCasts = [];
    {
      const lastJrCastCycle = overuseRecent
        .filter((a) => a.leader === "jr")
        .reduce((max, a) => Math.max(max, Number(a.cycle_used)), -1);
      const ctx = {
        balance,
        jrEnergy: jrEnergyNext,
        activeAbilities,
        lastJrCastCycle,
        nextCycle,
      };
      const decision =
        shouldAutoCastResourceAmp({ ...ctx, kind: "food" }) ||
        shouldAutoCastResourceAmp({ ...ctx, kind: "water" });

      if (decision) {
        const target_data = {
          kind: decision.kind,
          multiplier: decision.multiplier,
          duration_cycles: decision.duration_cycles,
          auto: true,
        };
        const effectSummary = flavorSummary("resource_amp", target_data);
        const expires = nextCycle + decision.duration_cycles;
        await client.query(
          `INSERT INTO abilities (leader, ability_name, target_data, energy_cost, cycle_used, expires_cycle, effect_summary)
           VALUES ('jr', 'resource_amp', $1::jsonb, $2, $3, $4, $5)`,
          [target_data, decision.cost, nextCycle, expires, effectSummary],
        );
        await client.query(
          `INSERT INTO events (cycle, kind, payload) VALUES ($1, 'ability', $2)`,
          [
            nextCycle,
            {
              leader: "jr",
              ability_name: "resource_amp",
              target_data,
              expires_cycle: expires,
              effect_summary: effectSummary,
              auto: true,
            },
          ],
        );
        await client.query(
          `INSERT INTO logs (cycle, leader, action, reasoning)
           VALUES ($1, 'jr', $2, $3)`,
          [
            nextCycle,
            `[auto] amplified ${decision.kind} production x${decision.multiplier} for ${decision.duration_cycles} cycles`,
            `engine response: ${decision.kind} deficit ${decision.deficit_days}d, Jr idle ${decision.idle_cycles ?? "infinite"} cycles`,
          ],
        );
        jrEnergyNext = Math.max(0, jrEnergyNext - decision.cost);
        autoCasts.push({
          leader: "jr",
          ability_name: "resource_amp",
          kind: decision.kind,
          multiplier: decision.multiplier,
          cost: decision.cost,
          expires_cycle: expires,
          reason: `${decision.kind}_deficit_${decision.deficit_days}d`,
        });
      }
    }

    const updated = await client.query(
      `UPDATE world SET cycle = $1, population = $2, resources = $3::jsonb,
                        sr_energy = $4, jr_energy = $5,
                        breakthroughs = $6::jsonb,
                        updated_at = now()
         WHERE id = $7 RETURNING *`,
      [
        nextCycle,
        pop,
        newResources,
        srEnergyNext,
        jrEnergyNext,
        JSON.stringify(allBreakthroughs),
        current.id,
      ],
    );

    // Emit a breakthrough event per newly-unlocked ability.
    for (const b of newBreakthroughs) {
      await client.query(
        `INSERT INTO events (cycle, kind, payload) VALUES ($1, 'breakthrough', $2)`,
        [
          nextCycle,
          {
            leader: b.leader,
            unlocks: b.unlocks,
            description: `${b.leader.toUpperCase()} awakens - ${b.unlocks} unlocked`,
            threshold: {
              pop: stateForUnlocks.population,
              zones_claimed: stateForUnlocks.zones_claimed,
              events_survived: stateForUnlocks.events_survived,
            },
          },
        ],
      );
    }

    await client.query(
      `INSERT INTO cycles (n) VALUES ($1) ON CONFLICT (n) DO NOTHING`,
      [nextCycle],
    );

    // ---- Persist advance + rolled events ----
    const advanceEvent = await client.query(
      "INSERT INTO events (cycle, kind, payload) VALUES ($1, 'cycle_advance', $2) RETURNING *",
      [
        nextCycle,
        {
          from: prevCycle,
          to: nextCycle,
          population: pop,
          position_deltas: position_deltas.slice(0, 50),
          balance: {
            food: balance.food_balance,
            water: balance.water_balance,
          },
          caps_used: {
            deaths: deathsUsed,
            injuries: injuriesUsed,
            structure_damage: structureDamageUsed,
          },
          auto_casts: autoCasts,
        },
      ],
    );
    const persistedRolled = [];
    for (const evt of rolled) {
      const r = await client.query(
        "INSERT INTO events (cycle, kind, payload) VALUES ($1, $2, $3) RETURNING *",
        [evt.cycle, evt.kind, evt.payload],
      );
      persistedRolled.push(r.rows[0]);
    }

    // ---- Consequence logs linked back to their cause events ----
    for (let i = 0; i < persistedRolled.length; i++) {
      const saved = persistedRolled[i];
      const consequences = rolled[i].payload?.consequences || [];
      for (const c of consequences) {
        const action =
          c.type === "injury"
            ? `${c.npc_name} injured (${c.result || "injured"}) — ${c.cause}`
            : c.type === "structure_damage"
              ? `structure damaged: ${c.structure} — ${c.cause}`
              : `${c.type}: ${c.cause}`;
        await client.query(
          `INSERT INTO logs (cycle, leader, action, reasoning, cause_event_id)
           VALUES ($1, 'auto', $2, $3, $4)`,
          [
            nextCycle,
            action,
            `severity: ${c.severity || "moderate"}`,
            saved.id,
          ],
        );
      }
    }

    // Also log deficit-driven consequences (not tied to a specific event).
    for (const c of allConsequences) {
      if (c.type === "morale_drop") {
        await client.query(
          `INSERT INTO logs (cycle, leader, action, reasoning)
           VALUES ($1, 'auto', $2, $3)`,
          [
            nextCycle,
            `${c.npc_name} morale ${c.from} → ${c.to}`,
            `caused by ${c.cause}`,
          ],
        );
      }
    }

    // ---- Fallback decision: no leader posted this cycle? Engine fills. ----
    const { rows: leaderCount } = await client.query(
      "SELECT COUNT(*)::int AS n FROM logs WHERE cycle = $1 AND leader IN ('sr','jr')",
      [nextCycle],
    );
    if (leaderCount[0].n === 0) {
      const fb = generateFallbackDecision(nextCycle);
      await client.query(
        `INSERT INTO logs (cycle, leader, action, reasoning)
         VALUES ($1, $2, $3, $4)`,
        [nextCycle, fb.leader, fb.action, fb.reasoning],
      );
    }

    await client.query("COMMIT");
    return {
      world: updated.rows[0],
      delta: {
        cycle: { from: prevCycle, to: nextCycle },
        population: { reconciled: pop, previous: current.population },
        position_deltas,
        consequences: allConsequences,
        balance,
        breakthroughs_unlocked: newBreakthroughs,
        overuse: overuseConsequences,
        active_abilities: activeAbilities.length,
        terrain_reverts: expiringTerrainShapes.length,
        auto_casts: autoCasts,
      },
      events: [advanceEvent.rows[0], ...persistedRolled],
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

app.post("/api/cycle/advance", async (_req, res, next) => {
  try {
    const result = await runCycleAdvance();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Server-side auto-cycle ticker. Interval is clamped to [1s, 600s].
// Restart overrides any existing timer with the new interval.
app.post("/api/auto-cycle/start", (req, res) => {
  const raw = Number(req.body?.interval_sec);
  const interval_sec = Math.min(
    600,
    Math.max(1, Number.isFinite(raw) ? raw : 10),
  );
  if (autoCycle.timer) clearInterval(autoCycle.timer);
  autoCycle.timer = setInterval(async () => {
    try {
      await runCycleAdvance();
    } catch (err) {
      console.error("auto-cycle tick failed", err);
    }
  }, interval_sec * 1000);
  autoCycle.interval_sec = interval_sec;
  autoCycle.started_at = new Date().toISOString();
  res.json({
    running: true,
    interval_sec,
    started_at: autoCycle.started_at,
  });
});

app.post("/api/auto-cycle/stop", (_req, res) => {
  if (autoCycle.timer) {
    clearInterval(autoCycle.timer);
    autoCycle.timer = null;
  }
  const stopped = {
    running: false,
    interval_sec: autoCycle.interval_sec,
    started_at: autoCycle.started_at,
  };
  autoCycle.interval_sec = null;
  autoCycle.started_at = null;
  res.json(stopped);
});

app.get("/api/auto-cycle/status", (_req, res) => {
  res.json({
    running: Boolean(autoCycle.timer),
    interval_sec: autoCycle.interval_sec,
    started_at: autoCycle.started_at,
  });
});

// === MAGIC / ABILITIES ===

// GET /api/abilities?leader=sr|jr&since=cycle
app.get("/api/abilities", async (req, res, next) => {
  try {
    const leader = req.query.leader;
    const since = Number(req.query.since);
    const clauses = [];
    const params = [];
    if (leader === "sr" || leader === "jr") {
      params.push(leader);
      clauses.push(`leader = $${params.length}`);
    }
    if (Number.isFinite(since)) {
      params.push(since);
      clauses.push(`cycle_used >= $${params.length}`);
    }
    const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
    const { rows } = await pool.query(
      `SELECT * FROM abilities ${where} ORDER BY cycle_used DESC, id DESC LIMIT 200`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// POST /api/abilities
// body: { leader: 'sr'|'jr', ability_name, target_data, duration_cycles? }
app.post("/api/abilities", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      leader,
      ability_name,
      target_data = {},
      duration_cycles,
    } = req.body || {};

    await client.query("BEGIN");

    const { rows: worldRows } = await client.query(
      "SELECT * FROM world ORDER BY id DESC LIMIT 1",
    );
    const world = worldRows[0];
    if (!world) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "no world seeded" });
    }

    const claims = Array.isArray(world.infrastructure?.claims)
      ? world.infrastructure.claims.length
      : 0;
    const { rows: evCount } = await client.query(
      "SELECT COUNT(*)::int AS n FROM events WHERE kind IN ('storm','discovery','threat_sighted')",
    );
    const events_survived = evCount[0].n;

    const state = {
      population: world.population,
      zones_claimed: claims,
      events_survived,
      cycle: world.cycle,
    };

    const energyAvailable = Number(
      leader === "sr" ? world.sr_energy : world.jr_energy,
    );
    const { rows: recentAbilities } = await client.query(
      "SELECT leader, ability_name, cycle_used FROM abilities WHERE cycle_used >= $1",
      [world.cycle - 12],
    );

    const onCd = onCooldown(recentAbilities, leader, ability_name, world.cycle);
    const unlocked = ABILITIES[ability_name]
      ? abilityUnlocked(ability_name, state)
      : false;

    const validation = validateAbility({
      leader,
      ability_name,
      target_data,
      energyAvailable,
      onCd,
      unlocked,
    });
    if (!validation.ok) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        applied: false,
        error: validation.error,
        reason: validation.error,
      });
    }

    const spec = ABILITIES[ability_name];
    const duration = Math.max(
      1,
      Math.min(40, Number(duration_cycles) || spec.default_duration),
    );
    const expires_cycle = world.cycle + duration;

    // Final target_data with enriched fields (duration + original snapshots for
    // terrain_shape reversion).
    let finalTarget = { ...target_data, duration_cycles: duration };

    if (ability_name === "terrain_shape") {
      const [tx, ty] = target_data.tile;
      const terrain = world.terrain || [];
      const original = terrain.find((t) => t.x === tx && t.y === ty) || null;
      finalTarget.original_tile = original
        ? { type: original.type, height: original.height }
        : null;

      // Apply immediately: mutate tile in-place, persist.
      const newTerrain = terrain.map((t) =>
        t.x === tx && t.y === ty
          ? {
              ...t,
              type: target_data.new_type,
              height: Number(target_data.new_height.toFixed(3)),
            }
          : t,
      );
      await client.query("UPDATE world SET terrain = $1::jsonb WHERE id = $2", [
        JSON.stringify(newTerrain),
        world.id,
      ]);
    }

    if (ability_name === "npc_influence") {
      // Instant morale + trust nudges on affected NPCs.
      const ids = target_data.affected_npc_ids || [];
      const moraleShift = Number(target_data.morale_shift || 0);
      const trustShift = Number(target_data.trust_shift || 0);
      for (const id of ids) {
        const { rows: nrow } = await client.query(
          "SELECT morale, ruler_trust FROM npcs WHERE id = $1",
          [id],
        );
        if (!nrow[0]) continue;
        let m = nrow[0].morale;
        if (moraleShift > 0)
          m = m === "low" ? "med" : m === "med" ? "high" : "high";
        else if (moraleShift < 0)
          m = m === "high" ? "med" : m === "med" ? "low" : "low";
        const newTrust = Math.max(
          0,
          Math.min(1, Number(nrow[0].ruler_trust) + trustShift),
        );
        await client.query(
          "UPDATE npcs SET morale = $1, ruler_trust = $2 WHERE id = $3",
          [m, newTrust, id],
        );
      }
    }

    const effectSummary = flavorSummary(ability_name, finalTarget);
    const energyAfter = Math.max(0, energyAvailable - spec.energy_cost);

    const { rows: abRows } = await client.query(
      `INSERT INTO abilities (leader, ability_name, target_data, energy_cost, cycle_used, expires_cycle, effect_summary)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7) RETURNING *`,
      [
        leader,
        ability_name,
        finalTarget,
        spec.energy_cost,
        world.cycle,
        expires_cycle,
        effectSummary,
      ],
    );

    // Drain energy on the right leader column.
    const energyCol = leader === "sr" ? "sr_energy" : "jr_energy";
    await client.query(
      `UPDATE world SET ${energyCol} = $1, updated_at = now() WHERE id = $2`,
      [energyAfter, world.id],
    );

    // Emit an 'ability' event so the frontend event stream picks it up for VFX.
    const { rows: evtRows } = await client.query(
      `INSERT INTO events (cycle, kind, payload) VALUES ($1, 'ability', $2) RETURNING *`,
      [
        world.cycle,
        {
          leader,
          ability_name,
          target_data: finalTarget,
          expires_cycle,
          effect_summary: effectSummary,
        },
      ],
    );

    // Persist a cumulative monument trace for spatial abilities. Survives
    // event pruning + lets the frontend cold-read traces from world.magic_monuments
    // instead of replaying /api/events history.
    const mKind = monumentKind(ability_name);
    const mPos = monumentPosition(ability_name, finalTarget);
    if (mKind && mPos) {
      const nextMonuments = applyCast(world.magic_monuments, {
        x: mPos[0],
        y: mPos[1],
        kind: mKind,
        leader,
        cycle: world.cycle,
      });
      await client.query(
        "UPDATE world SET magic_monuments = $1::jsonb WHERE id = $2",
        [JSON.stringify(nextMonuments), world.id],
      );
    }

    await client.query("COMMIT");
    res.json({
      applied: true,
      ability: abRows[0],
      energy_remaining: energyAfter,
      event: evtRows[0],
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("api error", err);
  res.status(500).json({ error: String(err.message || err) });
});

// One-shot boot work: ensure terrain is generated + persist, and seed x/y for
// any NPC missing coordinates. Idempotent — safe to run on every start.
async function bootHydrate() {
  try {
    const { rows } = await pool.query(
      "SELECT id, civ_name, terrain FROM world ORDER BY id DESC LIMIT 1",
    );
    const world = rows[0];
    if (!world) {
      console.log("boot: no world row yet, skipping terrain seed");
      return;
    }
    if (
      !world.terrain ||
      (Array.isArray(world.terrain) && world.terrain.length === 0)
    ) {
      const terrain = generateTerrain(world.civ_name);
      await pool.query(
        "UPDATE world SET terrain = $1::jsonb, updated_at = now() WHERE id = $2",
        [JSON.stringify(terrain), world.id],
      );
      console.log(
        `boot: terrain generated (${terrain.length} tiles) for "${world.civ_name}"`,
      );
    }

    const { rows: missing } = await pool.query(
      "SELECT id, name, role FROM npcs WHERE (x IS NULL OR y IS NULL) AND alive = true",
    );
    if (missing.length > 0) {
      for (const n of missing) {
        const { x, y } = seedPositionFor(n);
        await pool.query("UPDATE npcs SET x = $1, y = $2 WHERE id = $3", [
          x,
          y,
          n.id,
        ]);
      }
      console.log(`boot: seeded x/y for ${missing.length} NPCs`);
    }

    // Rescue any NPCs stranded on water tiles (pre-terrain-check jitter drift).
    const { rows: positioned } = await pool.query(
      "SELECT id, name, x, y FROM npcs WHERE alive = true AND condition != 'dead' AND x IS NOT NULL AND y IS NOT NULL",
    );
    const { rows: terrainRow } = await pool.query(
      "SELECT terrain FROM world ORDER BY id DESC LIMIT 1",
    );
    const terrain = terrainRow[0]?.terrain || [];
    const rescues = rescueStrandedNpcs({ npcs: positioned, terrain });
    for (const r of rescues) {
      await pool.query("UPDATE npcs SET x = $1, y = $2 WHERE id = $3", [
        r.to.x,
        r.to.y,
        r.id,
      ]);
    }
    if (rescues.length > 0) {
      console.log(
        `boot: rescued ${rescues.length} NPCs from water tiles (${rescues
          .slice(0, 3)
          .map((r) => r.name)
          .join(", ")}${rescues.length > 3 ? "…" : ""})`,
      );
    }
  } catch (err) {
    console.error("boot hydrate failed (non-fatal)", err);
  }
}

async function runMigrations() {
  const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "migrations",
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await pool.query(sql);
    console.log(`migrated ${file}`);
  }
}

const port = Number(process.env.PORT) || 3000;
(async () => {
  try {
    await runMigrations();
  } catch (err) {
    console.error("migrations failed, aborting boot", err);
    process.exit(1);
  }
  app.listen(port, "0.0.0.0", async () => {
    console.log(`Lendstead API on :${port}`);
    await bootHydrate();
  });
})();
