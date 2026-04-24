-- Magic Monuments: persist cumulative ability traces on world row so frontend
-- doesn't replay /api/events history on every cold load. Backfills from the
-- historical ability event stream (kind='ability', ability_name in
-- terrain_shape|protection) on first apply. Idempotent: backfill only runs
-- when magic_monuments is empty/null on the latest world row.

ALTER TABLE world
  ADD COLUMN IF NOT EXISTS magic_monuments JSONB NOT NULL DEFAULT '[]'::jsonb;

WITH casts AS (
  SELECT
    (payload->'target_data'->'tile'->>0)::int AS x,
    (payload->'target_data'->'tile'->>1)::int AS y,
    CASE payload->>'ability_name'
      WHEN 'terrain_shape' THEN 'obelisk'
      WHEN 'protection'    THEN 'protection'
    END AS kind,
    payload->>'leader' AS leader,
    cycle
  FROM events
  WHERE kind = 'ability'
    AND payload->>'ability_name' IN ('terrain_shape','protection')
    AND jsonb_typeof(payload->'target_data'->'tile') = 'array'
),
monuments AS (
  SELECT jsonb_build_object(
    'x', x,
    'y', y,
    'kind', kind,
    'casts', COUNT(*),
    'dominant_leader',
      CASE
        WHEN COUNT(*) FILTER (WHERE leader='sr') >= COUNT(*) FILTER (WHERE leader='jr')
        THEN 'sr' ELSE 'jr'
      END,
    'origin_cycle', MIN(cycle),
    'last_cycle',   MAX(cycle),
    'leader_counts', jsonb_build_object(
      'sr', COUNT(*) FILTER (WHERE leader='sr'),
      'jr', COUNT(*) FILTER (WHERE leader='jr')
    )
  ) AS m
  FROM casts
  WHERE x IS NOT NULL AND y IS NOT NULL AND kind IS NOT NULL
  GROUP BY x, y, kind
)
UPDATE world w
SET magic_monuments = (SELECT COALESCE(jsonb_agg(m), '[]'::jsonb) FROM monuments)
WHERE w.id = (SELECT id FROM world ORDER BY id DESC LIMIT 1)
  AND (w.magic_monuments IS NULL OR w.magic_monuments = '[]'::jsonb);
