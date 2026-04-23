import express from "express";
import cors from "cors";
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
} from "./engine.js";

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

    // ---- Position jitter ----
    const position_deltas = [];
    for (const n of aliveNpcs) {
      if (n.condition === "incapacitated") continue; // injured-heavy stay put
      const from = { x: n.x, y: n.y };
      const to = jitterPosition(n);
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
    const terrain = current.terrain || [];
    const rolled = rollEvents({
      cycle: nextCycle,
      npcs: aliveNpcs,
      terrain,
      dry_streak,
    });
    for (const evt of rolled) {
      const sameKindCount = countByKind(evt.kind);
      const severity = computeSeverity(evt.kind, sameKindCount);
      evt.payload.severity = severity;
      if (typeof evt.payload.radius === "number") {
        evt.payload.radius = Math.round(
          evt.payload.radius * severityMultiplier(severity),
        );
      }
    }

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
      const healsThisCycle =
        medicalCount > 0 ? (healerAlive ? 3 : 2) : healerAlive ? 1 : 0;

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
    const updated = await client.query(
      `UPDATE world SET cycle = $1, population = $2, resources = $3::jsonb,
                        updated_at = now()
         WHERE id = $4 RETURNING *`,
      [nextCycle, pop, newResources, current.id],
    );

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
  } catch (err) {
    console.error("boot hydrate failed (non-fatal)", err);
  }
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", async () => {
  console.log(`Lendstead API on :${port}`);
  await bootHydrate();
});
