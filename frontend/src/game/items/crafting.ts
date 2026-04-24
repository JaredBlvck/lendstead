// Crafting runtime. Pure function over inventory + recipe: verifies the
// player has ingredients, consumes them, produces the output. Returns a
// new Inventory + emit-ready event payload, or an error reason.
//
// Skill gating: recipes may require a minimum skill level. Caller passes
// in the skill -> level map (from the backend-owned skill system).

import type { CraftingRecipe, Item, Inventory } from './itemTypes';
import { addItem, has, qtyOf, removeItem, type ItemLookup } from './inventory';

export interface CraftContext {
  inventory: Inventory;
  itemLookup: ItemLookup;
  skills?: Record<string, number>;
  station?: string;
}

export interface CraftSuccess {
  ok: true;
  inventory: Inventory;
  produced_item_id: string;
  produced_qty: number;
  consumed: Array<{ item_id: string; qty: number }>;
}

export interface CraftFailure {
  ok: false;
  reason: string;
}

export type CraftResult = CraftSuccess | CraftFailure;

// Attempt to craft an item using the given recipe. Returns result and a
// new inventory (on success) or failure reason.
export function craftItem(
  item: Item,
  recipe: CraftingRecipe,
  ctx: CraftContext,
): CraftResult {
  // Station must match if context specified
  if (ctx.station && ctx.station !== recipe.station) {
    return { ok: false, reason: `wrong station: need ${recipe.station}, have ${ctx.station}` };
  }

  // Skill gate
  if (recipe.skill_requirement) {
    const level = ctx.skills?.[recipe.skill_requirement.skill] ?? 0;
    if (level < recipe.skill_requirement.level) {
      return {
        ok: false,
        reason: `${recipe.skill_requirement.skill} ${level} < required ${recipe.skill_requirement.level}`,
      };
    }
  }

  // Ingredient availability check
  for (const ing of recipe.ingredients) {
    if (!has(ctx.inventory, ing.item_id, ing.qty)) {
      return {
        ok: false,
        reason: `missing ${ing.qty}x ${ing.item_id} (have ${qtyOf(ctx.inventory, ing.item_id)})`,
      };
    }
  }

  // Consume ingredients
  let inventory = ctx.inventory;
  const consumed: Array<{ item_id: string; qty: number }> = [];
  for (const ing of recipe.ingredients) {
    const rem = removeItem(inventory, ing.item_id, ing.qty);
    if (rem.removed < ing.qty) {
      // Shouldn't happen given the availability check above, but be explicit.
      return { ok: false, reason: `removal of ${ing.item_id} failed mid-craft` };
    }
    inventory = rem.inventory;
    consumed.push({ item_id: ing.item_id, qty: rem.removed });
  }

  // Produce output
  const producedQty = recipe.produces_qty;
  const add = addItem(inventory, item.id, producedQty, ctx.itemLookup);
  if (add.leftover > 0) {
    // Player's bag is full. We still consumed ingredients (design choice),
    // so flag partial completion with leftover dropped.
    return {
      ok: true,
      inventory: add.inventory,
      produced_item_id: item.id,
      produced_qty: producedQty - add.leftover,
      consumed,
    };
  }

  return {
    ok: true,
    inventory: add.inventory,
    produced_item_id: item.id,
    produced_qty: producedQty,
    consumed,
  };
}

// List every recipe currently craftable given an inventory + skill set.
export interface CraftableEntry {
  item: Item;
  recipe: CraftingRecipe;
  missing: Array<{ item_id: string; qty_missing: number }>;
  skill_gap?: { skill: string; current: number; required: number };
  station: string;
}

export function listCraftable(
  allItems: Item[],
  ctx: CraftContext,
): CraftableEntry[] {
  const entries: CraftableEntry[] = [];
  for (const item of allItems) {
    for (const recipe of item.crafting_recipes) {
      if (ctx.station && recipe.station !== ctx.station) continue;
      const missing: Array<{ item_id: string; qty_missing: number }> = [];
      for (const ing of recipe.ingredients) {
        const have = qtyOf(ctx.inventory, ing.item_id);
        if (have < ing.qty) missing.push({ item_id: ing.item_id, qty_missing: ing.qty - have });
      }
      let skill_gap: CraftableEntry['skill_gap'];
      if (recipe.skill_requirement) {
        const current = ctx.skills?.[recipe.skill_requirement.skill] ?? 0;
        if (current < recipe.skill_requirement.level) {
          skill_gap = {
            skill: recipe.skill_requirement.skill,
            current,
            required: recipe.skill_requirement.level,
          };
        }
      }
      entries.push({ item, recipe, missing, skill_gap, station: recipe.station });
    }
  }
  return entries;
}
