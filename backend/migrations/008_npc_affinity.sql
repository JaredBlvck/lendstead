-- NPC affinity: between-NPC relationship score built from recurring
-- interactions. Symmetric (npc_a, npc_b) with npc_a < npc_b to avoid
-- duplicate rows. Score accumulates from interaction types: teach and treat
-- weigh heaviest (skill + life investment), trade middle, conversation
-- light. Future conflict interactions subtract. Used for narrative
-- memory — which NPCs keep showing up together — and eventually to bias
-- adjacency pair selection toward established pairs.

CREATE TABLE IF NOT EXISTS npc_affinity (
  npc_a INT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  npc_b INT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  interactions INT NOT NULL DEFAULT 0,
  last_cycle INT NOT NULL,
  last_type TEXT,
  milestones_reached JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (npc_a, npc_b),
  CHECK (npc_a < npc_b)
);

CREATE INDEX IF NOT EXISTS idx_npc_affinity_score ON npc_affinity(score DESC);
CREATE INDEX IF NOT EXISTS idx_npc_affinity_last_cycle ON npc_affinity(last_cycle DESC);
CREATE INDEX IF NOT EXISTS idx_npc_affinity_a ON npc_affinity(npc_a);
CREATE INDEX IF NOT EXISTS idx_npc_affinity_b ON npc_affinity(npc_b);
