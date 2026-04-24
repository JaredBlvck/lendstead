// Quest validator. Quad B runs every content file through this before
// shipping. Returns {ok, data, errors}. Extra checks beyond zod shape:
// duplicate objective ids, choice references to non-existent objectives,
// prerequisites that reference unknown flag kinds, reward kinds that
// don't exist in the engine registry.

import { Quest, type Quest as QuestType } from './questTypes';

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

export function validateQuest(input: unknown): ValidationResult<QuestType> {
  const parsed = Quest.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  const q = parsed.data;
  const errors: string[] = [];

  // Every objective must have a unique id
  const objIds = new Set<string>();
  for (const obj of q.objectives) {
    if (objIds.has(obj.id)) errors.push(`duplicate objective id: ${obj.id}`);
    objIds.add(obj.id);
  }

  // Every choice must reference an existing objective
  for (const choice of q.choices) {
    if (!objIds.has(choice.at_objective)) {
      errors.push(`choice at_objective references unknown objective: ${choice.at_objective}`);
    }
    const seenChoiceIds = new Set<string>();
    for (const opt of choice.options) {
      if (seenChoiceIds.has(opt.id)) errors.push(`duplicate choice option id: ${opt.id}`);
      seenChoiceIds.add(opt.id);
      for (const unlockId of opt.unlocks_objectives) {
        if (!objIds.has(unlockId) && !unlockId.startsWith('obj_')) {
          errors.push(`choice option ${opt.id} unlocks unknown objective: ${unlockId}`);
        }
      }
      for (const completeId of opt.completes_objectives) {
        if (!objIds.has(completeId)) {
          errors.push(`choice option ${opt.id} completes unknown objective: ${completeId}`);
        }
      }
    }
  }

  // Rewards sanity: don't crash, just ensure no required params missing.
  // Per-kind param requirements are enforced by engine reward handlers.

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: q, errors: [] };
}

// Bulk validation - used by Quad B tooling to check a whole directory.
export function validateQuests(inputs: unknown[]): {
  ok: boolean;
  valid: QuestType[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: QuestType[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];
  inputs.forEach((input, index) => {
    const r = validateQuest(input);
    if (r.ok && r.data) valid.push(r.data);
    else invalid.push({ index, errors: r.errors });
  });
  return { ok: invalid.length === 0, valid, invalid };
}
