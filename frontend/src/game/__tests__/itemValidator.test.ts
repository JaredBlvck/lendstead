import { describe, it, expect } from 'vitest';
import { validateItem, validateItems } from '../items/itemValidator';
import {
  item_template_flint,
  item_template_knife,
  item_template_silver_coin,
} from '../../content/items/_template';

describe('itemValidator', () => {
  it('accepts all template items', () => {
    expect(validateItem(item_template_flint).ok).toBe(true);
    expect(validateItem(item_template_knife).ok).toBe(true);
    expect(validateItem(item_template_silver_coin).ok).toBe(true);
  });

  it('rejects id without item_ prefix', () => {
    const bad = { ...item_template_flint, id: 'flint_shard' };
    const r = validateItem(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('must start with item_');
  });

  it('rejects stackable item with max_stack=1', () => {
    const bad = { ...item_template_flint, stackable: true, max_stack: 1 };
    const r = validateItem(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('max_stack>=2');
  });

  it('rejects non-stackable item with max_stack>1', () => {
    const bad = { ...item_template_knife, stackable: false, max_stack: 5 };
    const r = validateItem(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('max_stack=1');
  });

  it('rejects weapon missing equip_slot', () => {
    const bad = { ...item_template_knife, equip_slot: undefined };
    const r = validateItem(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('equip_slot');
  });

  it('rejects invalid category', () => {
    const bad = { ...item_template_flint, category: 'cheese' };
    const r = validateItem(bad);
    expect(r.ok).toBe(false);
  });

  it('bulk validator catches duplicate ids', () => {
    const r = validateItems([
      item_template_flint,
      item_template_knife,
      item_template_flint,   // dupe
    ]);
    expect(r.ok).toBe(false);
    expect(r.invalid.some((e) => e.errors.join(' ').includes('duplicate item id'))).toBe(true);
  });

  it('bulk validator catches recipe ingredients pointing at nonexistent items', () => {
    const bad: unknown = {
      ...item_template_knife,
      id: 'item_bad_recipe',
      crafting_recipes: [
        { station: 'forge', ingredients: [{ item_id: 'item_nonexistent', qty: 1 }], produces_qty: 1 },
      ],
    };
    const r = validateItems([item_template_flint, bad]);
    expect(r.ok).toBe(false);
    expect(r.invalid.some((e) => e.errors.join(' ').includes('not found in registry'))).toBe(true);
  });
});
