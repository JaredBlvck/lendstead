-- 40x24 tile grid + NPC positions. Terrain populated once by the engine on
-- first boot if null (deterministic from civ_name).

ALTER TABLE npcs ADD COLUMN IF NOT EXISTS x INT;
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS y INT;

ALTER TABLE world ADD COLUMN IF NOT EXISTS terrain JSONB;

CREATE INDEX IF NOT EXISTS idx_npcs_alive ON npcs(alive) WHERE alive = true;
