import { describe, it, expect } from 'vitest';
import { craftItem, listCraftable } from '../items/crafting';
import { ItemRegistry } from '../items/itemRegistry';
import { emptyInventory, addItem, qtyOf } from '../items/inventory';
import { item_template_flint, item_template_knife } from '../../content/items/_template';
import type { Item } from '../items/itemTypes';

function makeRegistry() {
  const reg = new ItemRegistry();
  reg.registerMany([item_template_flint, item_template_knife]);
  return reg;
}

describe('crafting', () => {
  it('crafts an item when ingredients are present', () => {
    const reg = makeRegistry();
    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_flint', 2, reg.lookup).inventory;

    const recipe = item_template_knife.crafting_recipes[0];
    const result = craftItem(item_template_knife, recipe, {
      inventory: inv,
      itemLookup: reg.lookup,
      skills: { crafting: 5 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.produced_item_id).toBe('item_template_reedwake_knife');
      expect(result.produced_qty).toBe(1);
      expect(qtyOf(result.inventory, 'item_template_flint')).toBe(0);
      expect(qtyOf(result.inventory, 'item_template_reedwake_knife')).toBe(1);
    }
  });

  it('refuses when ingredients are missing', () => {
    const reg = makeRegistry();
    const inv = emptyInventory('p', 28);
    const recipe = item_template_knife.crafting_recipes[0];
    const result = craftItem(item_template_knife, recipe, {
      inventory: inv,
      itemLookup: reg.lookup,
      skills: { crafting: 5 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('missing');
  });

  it('refuses when skill is too low', () => {
    const reg = makeRegistry();
    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_flint', 2, reg.lookup).inventory;
    const recipe = item_template_knife.crafting_recipes[0];
    const result = craftItem(item_template_knife, recipe, {
      inventory: inv,
      itemLookup: reg.lookup,
      skills: { crafting: 1 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('crafting');
  });

  it('refuses when at the wrong station', () => {
    const reg = makeRegistry();
    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_flint', 2, reg.lookup).inventory;
    const recipe = item_template_knife.crafting_recipes[0];
    const result = craftItem(item_template_knife, recipe, {
      inventory: inv,
      itemLookup: reg.lookup,
      skills: { crafting: 5 },
      station: 'forge',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('wrong station');
  });

  it('listCraftable reports missing ingredients + skill gaps', () => {
    const reg = makeRegistry();
    const inv = emptyInventory('p', 28);   // empty inventory
    const list = listCraftable(reg.all(), { inventory: inv, itemLookup: reg.lookup, skills: { crafting: 1 } });
    expect(list.length).toBeGreaterThan(0);
    const knife = list.find((e) => e.item.id === 'item_template_reedwake_knife');
    expect(knife).toBeDefined();
    expect(knife?.missing.length).toBeGreaterThan(0);
    expect(knife?.skill_gap?.required).toBe(2);
  });

  it('listCraftable filters by station', () => {
    const reg = makeRegistry();
    const inv = emptyInventory('p', 28);
    const list = listCraftable(reg.all(), {
      inventory: inv,
      itemLookup: reg.lookup,
      station: 'forge',
    });
    expect(list).toEqual([]);
  });

  it('handles inventory full on produced item by flagging partial completion', () => {
    const reg = new ItemRegistry();
    const smallBagItem: Item = {
      ...item_template_knife,
      id: 'item_bigger_output',
      stackable: false,
      max_stack: 1,
      crafting_recipes: [
        {
          station: 'campfire',
          ingredients: [{ item_id: 'item_template_flint', qty: 1 }],
          produces_qty: 3,
        },
      ],
    };
    reg.registerMany([item_template_flint, smallBagItem]);

    let inv = emptyInventory('p', 2);     // only 2 slots total
    inv = addItem(inv, 'item_template_flint', 1, reg.lookup).inventory;  // uses slot 1

    const recipe = smallBagItem.crafting_recipes[0];
    const result = craftItem(smallBagItem, recipe, {
      inventory: inv,
      itemLookup: reg.lookup,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 3 produced but only 1 slot free after flint consumed; non-stackable so fits 1
      expect(result.produced_qty).toBeLessThan(3);
    }
  });
});
