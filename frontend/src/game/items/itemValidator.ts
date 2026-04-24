// Item validator. Quad B runs every content file through this before
// shipping. Returns {ok, data, errors}. Extra checks beyond zod shape:
// crafting recipes reference valid item ids, equipment items have an
// equip_slot, stackable items have reasonable max_stack.

import { Item, type Item as ItemType } from './itemTypes';

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

export function validateItem(input: unknown): ValidationResult<ItemType> {
  const parsed = Item.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const it = parsed.data;
  const errors: string[] = [];

  // Stackable items must allow stacks of >=2; non-stackable must have max_stack=1
  if (it.stackable && it.max_stack < 2) {
    errors.push(`stackable item ${it.id} must have max_stack>=2 (got ${it.max_stack})`);
  }
  if (!it.stackable && it.max_stack !== 1) {
    errors.push(`non-stackable item ${it.id} must have max_stack=1 (got ${it.max_stack})`);
  }

  // Armor/clothing/weapon/tool in equip categories should have equip_slot
  const equipLikely: Array<ItemType['category']> = ['weapon', 'armor', 'clothing', 'tool'];
  if (equipLikely.includes(it.category) && !it.equip_slot) {
    errors.push(`${it.category} item ${it.id} is missing equip_slot`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: it, errors: [] };
}

// Bulk validation across a content directory. Also checks cross-file
// guarantees: unique ids, recipes point at known items.
export function validateItems(inputs: unknown[]): {
  ok: boolean;
  valid: ItemType[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: ItemType[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];

  inputs.forEach((input, index) => {
    const r = validateItem(input);
    if (r.ok && r.data) valid.push(r.data);
    else invalid.push({ index, errors: r.errors });
  });

  // Duplicate-id check across the valid set
  const seen = new Set<string>();
  valid.forEach((item, i) => {
    if (seen.has(item.id)) {
      invalid.push({ index: i, errors: [`duplicate item id: ${item.id}`] });
    }
    seen.add(item.id);
  });

  // Crafting recipe cross-reference
  const ids = new Set(valid.map((i) => i.id));
  valid.forEach((item, i) => {
    for (const recipe of item.crafting_recipes) {
      for (const ing of recipe.ingredients) {
        if (!ids.has(ing.item_id)) {
          invalid.push({
            index: i,
            errors: [`item ${item.id} recipe ingredient ${ing.item_id} not found in registry`],
          });
        }
      }
    }
  });

  return { ok: invalid.length === 0, valid, invalid };
}
