-- Player state snapshots. Sr's client engine owns the authoring of the
-- snapshot contents (quest runtime, inventory, equipment, world flags,
-- npc memory, shop stock). The backend stores it so multiple sessions
-- can resume from the same place and so Jr's backend sim can read it
-- for future cross-sim rules (e.g., "tenant factions react to the
-- player's inventory", "world state mirrors quest completions").
--
-- Not normalized on purpose: Sr's zod schema is the contract; backend
-- treats the snapshot as opaque JSONB. Any validation happens client-side
-- in loadSave() / Save.safeParse. This keeps the two sims decoupled on
-- shape while sharing persistence.

CREATE TABLE IF NOT EXISTS player_state (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL UNIQUE,
  snapshot JSONB NOT NULL,
  schema_version INT NOT NULL DEFAULT 1,
  client_saved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_state_player ON player_state(player_id);
CREATE INDEX IF NOT EXISTS idx_player_state_updated ON player_state(updated_at DESC);
