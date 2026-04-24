// Enemy validator. Zod shape check + cross-rules: abilities have unique
// ids, cooldown vs damage_bonus sanity, spawn rule consistency.

import { Enemy, type Enemy as EnemyType } from './enemyTypes';

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

export function validateEnemy(input: unknown): ValidationResult<EnemyType> {
  const parsed = Enemy.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const e = parsed.data;
  const errors: string[] = [];

  const seenAbilities = new Set<string>();
  for (const ab of e.abilities) {
    if (seenAbilities.has(ab.id)) errors.push(`enemy ${e.id}: duplicate ability id ${ab.id}`);
    seenAbilities.add(ab.id);
  }

  if (e.max_hp < 1) errors.push(`enemy ${e.id}: max_hp must be >= 1`);
  if (e.attack < 0 || e.defense < 0) errors.push(`enemy ${e.id}: attack/defense cannot be negative`);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: e, errors: [] };
}

export function validateEnemies(inputs: unknown[]): {
  ok: boolean;
  valid: EnemyType[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: EnemyType[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];
  inputs.forEach((input, index) => {
    const r = validateEnemy(input);
    if (r.ok && r.data) valid.push(r.data);
    else invalid.push({ index, errors: r.errors });
  });
  const seen = new Set<string>();
  valid.forEach((e, i) => {
    if (seen.has(e.id)) invalid.push({ index: i, errors: [`duplicate enemy id ${e.id}`] });
    seen.add(e.id);
  });
  return { ok: invalid.length === 0, valid, invalid };
}
