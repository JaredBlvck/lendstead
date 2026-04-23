-- Consequence engine columns. Condition tracks life/injury state; cycle-int
-- timestamps are cheaper than timestamptz here because the engine clock IS
-- the cycle counter, not wall time.

ALTER TABLE npcs
  ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS injury_cycle INT,
  ADD COLUMN IF NOT EXISTS death_cycle INT,
  ADD COLUMN IF NOT EXISTS last_condition_change INT;

-- Valid condition values are enforced in app layer (rollback-safe in SQL).
-- Expected: 'healthy' | 'injured' | 'incapacitated' | 'dead'.

CREATE INDEX IF NOT EXISTS idx_npcs_condition ON npcs(condition);
CREATE INDEX IF NOT EXISTS idx_events_cycle_kind ON events(cycle, kind);
