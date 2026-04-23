CREATE TABLE IF NOT EXISTS world (
  id SERIAL PRIMARY KEY,
  cycle INT NOT NULL,
  population INT NOT NULL DEFAULT 0,
  resources JSONB NOT NULL DEFAULT '{}'::jsonb,
  infrastructure JSONB NOT NULL DEFAULT '{}'::jsonb,
  civ_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS npcs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  skill INT NOT NULL,
  morale TEXT NOT NULL DEFAULT 'med',
  status TEXT NOT NULL DEFAULT '',
  lane TEXT NOT NULL CHECK (lane IN ('sr','jr')),
  alive BOOLEAN NOT NULL DEFAULT true,
  cycle_created INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cycles (
  id SERIAL PRIMARY KEY,
  n INT NOT NULL UNIQUE,
  sr_decision JSONB,
  jr_decision JSONB,
  outcome JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  cycle INT NOT NULL,
  leader TEXT NOT NULL,
  action TEXT NOT NULL,
  reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  cycle INT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_cycle ON logs(cycle);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_npcs_lane ON npcs(lane);
