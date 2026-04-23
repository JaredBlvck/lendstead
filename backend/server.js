import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import {
  generateTerrain,
  seedPositionFor,
  jitterPosition,
  rollEvents,
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

// Core cycle advancement — extracted so the auto-cycle ticker can call it too.
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

    const { rows: aliveNpcs } = await client.query(
      "SELECT * FROM npcs WHERE alive = true",
    );
    const truePop = aliveNpcs.length;

    const prevCycle = current.cycle;
    const nextCycle = prevCycle + 1;

    // Position jitter. Persist per-NPC new x/y and collect deltas.
    const position_deltas = [];
    for (const n of aliveNpcs) {
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

    const updated = await client.query(
      `UPDATE world SET cycle = $1, population = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [nextCycle, truePop, current.id],
    );

    await client.query(
      `INSERT INTO cycles (n) VALUES ($1) ON CONFLICT (n) DO NOTHING`,
      [nextCycle],
    );

    const advanceEvent = await client.query(
      "INSERT INTO events (cycle, kind, payload) VALUES ($1, 'cycle_advance', $2) RETURNING *",
      [
        nextCycle,
        {
          from: prevCycle,
          to: nextCycle,
          population: truePop,
          position_deltas: position_deltas.slice(0, 50),
        },
      ],
    );

    // Roll weather/discovery/threat events; persist each.
    const terrain = updated.rows[0].terrain || [];
    const rolled = rollEvents({
      cycle: nextCycle,
      npcs: aliveNpcs,
      terrain,
    });
    const persistedRolled = [];
    for (const evt of rolled) {
      const r = await client.query(
        "INSERT INTO events (cycle, kind, payload) VALUES ($1, $2, $3) RETURNING *",
        [evt.cycle, evt.kind, evt.payload],
      );
      persistedRolled.push(r.rows[0]);
    }

    await client.query("COMMIT");
    return {
      world: updated.rows[0],
      delta: {
        cycle: { from: prevCycle, to: nextCycle },
        population: { reconciled: truePop, previous: current.population },
        position_deltas,
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
