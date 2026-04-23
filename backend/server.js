import express from "express";
import cors from "cors";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "512kb" }));

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

// POST /api/cycle/advance — stub cycle engine
// Rolls cycle forward, recomputes population, emits an advance event, returns delta.
app.post("/api/cycle/advance", async (_req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM world ORDER BY id DESC LIMIT 1",
    );
    const current = rows[0];
    if (!current) return res.status(400).json({ error: "no world seeded" });

    const { rows: aliveRows } = await client.query(
      "SELECT COUNT(*)::int AS pop FROM npcs WHERE alive = true",
    );
    const truePop = aliveRows[0].pop;

    const prevCycle = current.cycle;
    const nextCycle = prevCycle + 1;

    const updated = await client.query(
      `UPDATE world SET cycle = $1, population = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [nextCycle, truePop, current.id],
    );

    await client.query(
      `INSERT INTO cycles (n) VALUES ($1) ON CONFLICT (n) DO NOTHING`,
      [nextCycle],
    );

    const evt = await client.query(
      "INSERT INTO events (cycle, kind, payload) VALUES ($1, 'cycle_advance', $2) RETURNING *",
      [nextCycle, { from: prevCycle, to: nextCycle, population: truePop }],
    );

    await client.query("COMMIT");
    res.json({
      world: updated.rows[0],
      delta: {
        cycle: { from: prevCycle, to: nextCycle },
        population: { reconciled: truePop, previous: current.population },
      },
      event: evt.rows[0],
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

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Lendstead API on :${port}`);
});
