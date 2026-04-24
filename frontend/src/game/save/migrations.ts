// Save migration registry. Each entry upgrades a save from version N to N+1.
// When we bump SAVE_SCHEMA_VERSION, we push a new entry here and existing
// saves replay through the chain to reach the current version.
//
// Keep migrations pure and idempotent. Never drop fields silently - if a
// field is retired, log its absence so debug can diagnose old saves.

export interface SaveMigration {
  from: number;
  to: number;
  migrate: (save: any) => any;
  notes?: string;
}

export const SAVE_MIGRATIONS: SaveMigration[] = [
  // Example placeholder migration - no-op until we bump the schema.
  // {
  //   from: 1,
  //   to: 2,
  //   migrate: (s) => ({ ...s, world: { ...s.world, new_field: defaultValue } }),
  //   notes: 'added world.new_field default=X for v2',
  // },
];

export function migrateSave(rawSave: any, targetVersion: number): any {
  let working = rawSave;
  let current = Number(working.schema_version ?? 1);
  while (current < targetVersion) {
    const step = SAVE_MIGRATIONS.find((m) => m.from === current);
    if (!step) {
      throw new Error(`No migration path from save schema v${current} to v${targetVersion}`);
    }
    working = step.migrate(working);
    working.schema_version = step.to;
    current = step.to;
  }
  return working;
}
