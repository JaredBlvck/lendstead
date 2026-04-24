// Discovery site validator. Shape + tile-range + condition sanity.

import { DiscoverySite, type DiscoverySite as Site } from './carvingTypes';
import { GRID_W, GRID_H } from '../../lib/terrain';

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

export function validateDiscoverySite(input: unknown): ValidationResult<Site> {
  const parsed = DiscoverySite.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const s = parsed.data;
  const errors: string[] = [];
  if (s.tile.x < 0 || s.tile.x >= GRID_W || s.tile.y < 0 || s.tile.y >= GRID_H) {
    errors.push(`site ${s.id}: tile out of grid bounds (${s.tile.x}, ${s.tile.y})`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: s, errors: [] };
}

export function validateDiscoverySites(inputs: unknown[]): {
  ok: boolean;
  valid: Site[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: Site[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];
  inputs.forEach((input, index) => {
    const r = validateDiscoverySite(input);
    if (r.ok && r.data) valid.push(r.data);
    else invalid.push({ index, errors: r.errors });
  });
  const seen = new Set<string>();
  valid.forEach((s, i) => {
    if (seen.has(s.id)) invalid.push({ index: i, errors: [`duplicate site id ${s.id}`] });
    seen.add(s.id);
  });
  return { ok: invalid.length === 0, valid, invalid };
}
