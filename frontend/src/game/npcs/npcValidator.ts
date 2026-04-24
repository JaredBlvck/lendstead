// NPC validator. Zod shape + cross-reference checks:
//   - dialogue lines reference only valid DialogueState values (zod handles)
//   - memory flag gates / quest hooks are syntactically right (engine can't
//     prove quests exist without registry coupling - Quad B handles global
//     cross-refs at bundle time)
//   - schedule phases don't duplicate
//   - shop inventory item ids well-formed

import { Npc, type Npc as NpcType } from './npcTypes';

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

export function validateNpc(input: unknown): ValidationResult<NpcType> {
  const parsed = Npc.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const n = parsed.data;
  const errors: string[] = [];

  // Dialogue line ids must be unique
  const seenLines = new Set<string>();
  for (const line of n.dialogue_lines) {
    if (seenLines.has(line.id)) errors.push(`duplicate dialogue line id: ${line.id}`);
    seenLines.add(line.id);
  }

  // Schedule entries - phase duplicates are allowed ONLY if distinct location/activity,
  // but we flag contradictory same-phase entries as suspicious.
  const byPhase = new Map<string, number>();
  for (const entry of n.schedule) {
    byPhase.set(entry.phase, (byPhase.get(entry.phase) ?? 0) + 1);
  }
  for (const [phase, count] of byPhase) {
    if (count > 1) errors.push(`npc ${n.id} has multiple schedule entries for phase ${phase}`);
  }

  // Secret ids unique
  const seenSecrets = new Set<string>();
  for (const sec of n.secrets) {
    if (seenSecrets.has(sec.id)) errors.push(`duplicate secret id: ${sec.id}`);
    seenSecrets.add(sec.id);
  }

  // Goal ids unique
  const seenGoals = new Set<string>();
  for (const g of n.personal_goals) {
    if (seenGoals.has(g.id)) errors.push(`duplicate goal id: ${g.id}`);
    seenGoals.add(g.id);
  }

  // Shop: if sell_price set, stock_qty must be >0; if buy_price set it's fine.
  for (const entry of n.shop_inventory) {
    if (entry.sell_price != null && entry.stock_qty <= 0) {
      errors.push(`shop entry ${entry.item_id} sells but stock_qty=0`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: n, errors: [] };
}

export function validateNpcs(inputs: unknown[]): {
  ok: boolean;
  valid: NpcType[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: NpcType[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];
  inputs.forEach((input, index) => {
    const r = validateNpc(input);
    if (r.ok && r.data) valid.push(r.data);
    else invalid.push({ index, errors: r.errors });
  });

  const seen = new Set<string>();
  valid.forEach((npc, i) => {
    if (seen.has(npc.id)) invalid.push({ index: i, errors: [`duplicate npc id: ${npc.id}`] });
    seen.add(npc.id);
  });
  return { ok: invalid.length === 0, valid, invalid };
}
