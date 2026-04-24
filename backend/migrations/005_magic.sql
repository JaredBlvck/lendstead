-- Magic Awakening: per-leader energy pools, abilities record, ruler trust,
-- breakthroughs. Sr and Jr each have independent source energy; abilities
-- drain it, cooldowns prevent spam, durations control active effects.

ALTER TABLE world
  ADD COLUMN IF NOT EXISTS sr_energy NUMERIC NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS jr_energy NUMERIC NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS breakthroughs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE npcs
  ADD COLUMN IF NOT EXISTS ruler_trust NUMERIC NOT NULL DEFAULT 0.5;

CREATE TABLE IF NOT EXISTS abilities (
  id SERIAL PRIMARY KEY,
  leader TEXT NOT NULL CHECK (leader IN ('sr','jr')),
  ability_name TEXT NOT NULL,
  target_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  energy_cost NUMERIC NOT NULL,
  cycle_used INT NOT NULL,
  expires_cycle INT,
  effect_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abilities_leader_cycle ON abilities(leader, cycle_used DESC);
CREATE INDEX IF NOT EXISTS idx_abilities_expires ON abilities(expires_cycle) WHERE expires_cycle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abilities_name ON abilities(ability_name);
