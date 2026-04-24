-- Quest state: server-persisted accept/complete/decline for the v8.0 quest
-- system. Quest content stays frontend-derived (role+name library); backend
-- owns only the per-npc+quest-key status row + transition timestamps + which
-- leader drove the transition. Lets multiple browsers / sessions see the same
-- quest progress, and lets the engine (future) auto-complete on event triggers.

CREATE TABLE IF NOT EXISTS quest_state (
  id SERIAL PRIMARY KEY,
  npc_id INT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  quest_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted','completed','declined')),
  accepted_cycle INT,
  completed_cycle INT,
  declined_cycle INT,
  accepted_by TEXT CHECK (accepted_by IN ('sr','jr','both') OR accepted_by IS NULL),
  completed_by TEXT CHECK (completed_by IN ('sr','jr','both','auto') OR completed_by IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (npc_id, quest_key)
);

CREATE INDEX IF NOT EXISTS idx_quest_state_npc ON quest_state(npc_id);
CREATE INDEX IF NOT EXISTS idx_quest_state_status ON quest_state(status);
CREATE INDEX IF NOT EXISTS idx_quest_state_updated ON quest_state(updated_at DESC);
