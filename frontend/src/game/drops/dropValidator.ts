// Drop table validator. Zod shape check + cross-reference to an ItemRegistry
// so every referenced item_id actually exists. Also checks qty ranges, pool
// weights, and that ultra_rare chances are in (0, 1].

import { DropTable, type DropTable as DropTableType } from './dropTypes';
import type { ItemRegistry } from '../items/itemRegistry';

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

export function validateDropTable(input: unknown, registry?: ItemRegistry): ValidationResult<DropTableType> {
  const parsed = DropTable.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const t = parsed.data;
  const errors: string[] = [];

  // Qty ranges must be consistent
  const ranges = [
    ...t.guaranteed_drops,
    ...t.common_drops,
    ...t.uncommon_drops,
    ...t.rare_drops,
  ];
  for (const entry of ranges) {
    if (entry.max_qty < entry.min_qty) {
      errors.push(`entry ${entry.item_id}: max_qty < min_qty`);
    }
  }
  for (const entry of t.ultra_rare_drops) {
    if (entry.max_qty < entry.min_qty) {
      errors.push(`ultra_rare ${entry.item_id}: max_qty < min_qty`);
    }
    if (entry.chance <= 0 || entry.chance > 1) {
      errors.push(`ultra_rare ${entry.item_id}: chance must be in (0, 1]`);
    }
  }

  // Pool weights must include at least one positive weight when the pool is non-empty
  const pools: Array<[string, typeof t.common_drops]> = [
    ['common', t.common_drops],
    ['uncommon', t.uncommon_drops],
    ['rare', t.rare_drops],
  ];
  for (const [name, pool] of pools) {
    if (pool.length === 0) continue;
    const total = pool.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) errors.push(`${name}_drops has zero total weight`);
  }

  // Cross-reference items against registry if provided
  if (registry) {
    const refIds = new Set<string>([
      ...t.guaranteed_drops.map((e) => e.item_id),
      ...t.common_drops.map((e) => e.item_id),
      ...t.uncommon_drops.map((e) => e.item_id),
      ...t.rare_drops.map((e) => e.item_id),
      ...t.ultra_rare_drops.map((e) => e.item_id),
    ]);
    for (const id of refIds) {
      if (!registry.has(id)) errors.push(`drop table references unknown item ${id}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: t, errors: [] };
}

export function validateDropTables(inputs: unknown[], registry?: ItemRegistry): {
  ok: boolean;
  valid: DropTableType[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: DropTableType[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];
  inputs.forEach((input, index) => {
    const r = validateDropTable(input, registry);
    if (r.ok && r.data) valid.push(r.data);
    else invalid.push({ index, errors: r.errors });
  });

  // Duplicate-id check
  const seen = new Set<string>();
  valid.forEach((t, i) => {
    if (seen.has(t.id)) invalid.push({ index: i, errors: [`duplicate drop table id: ${t.id}`] });
    seen.add(t.id);
  });
  return { ok: invalid.length === 0, valid, invalid };
}
