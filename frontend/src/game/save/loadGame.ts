// Load a Save, migrating from older schema versions if needed. Returns a
// parsed Save or throws a descriptive error. Zod validation runs after
// migrations to ensure the final shape is correct.

import { Save, SAVE_SCHEMA_VERSION, type Save as SaveType } from './saveTypes';
import { migrateSave } from './migrations';

export interface LoadResult {
  ok: boolean;
  save?: SaveType;
  errors: string[];
  migrated?: boolean;
}

export function loadSave(raw: unknown): LoadResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['save is not an object'] };
  }
  const incoming = raw as { schema_version?: number };
  const incomingVersion = Number(incoming.schema_version ?? 0);
  if (!Number.isFinite(incomingVersion) || incomingVersion < 1) {
    return { ok: false, errors: [`invalid schema_version: ${incoming.schema_version}`] };
  }

  let working: unknown = raw;
  let migrated = false;
  if (incomingVersion < SAVE_SCHEMA_VERSION) {
    try {
      working = migrateSave(raw, SAVE_SCHEMA_VERSION);
      migrated = true;
    } catch (e) {
      return { ok: false, errors: [(e as Error).message] };
    }
  } else if (incomingVersion > SAVE_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`save is from a newer version (v${incomingVersion}) than the engine supports (v${SAVE_SCHEMA_VERSION})`],
    };
  }

  const parsed = Save.safeParse(working);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  return { ok: true, save: parsed.data, errors: [], migrated };
}

export function deserializeSave(json: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['save file is not valid JSON'] };
  }
  return loadSave(raw);
}
