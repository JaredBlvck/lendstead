import { describe, it, expect } from 'vitest';
import {
  emptyInventory,
  addItem,
  removeItem,
  has,
  qtyOf,
  splitStack,
  destroyStack,
  transferItem,
} from '../items/inventory';
import { ItemRegistry } from '../items/itemRegistry';
import {
  item_template_flint,
  item_template_knife,
  item_template_silver_coin,
} from '../../content/items/_template';

function newRegistry(): ItemRegistry {
  const reg = new ItemRegistry();
  reg.registerMany([item_template_flint, item_template_knife, item_template_silver_coin]);
  return reg;
}

describe('inventory', () => {
  it('adds stackable items into a single stack up to max_stack', () => {
    const reg = newRegistry();
    const inv = emptyInventory('player_1', 28);
    const r = addItem(inv, 'item_template_flint', 5, reg.lookup);
    expect(r.leftover).toBe(0);
    expect(r.inventory.stacks).toHaveLength(1);
    expect(r.inventory.stacks[0].qty).toBe(5);
    expect(qtyOf(r.inventory, 'item_template_flint')).toBe(5);
  });

  it('spills stackable items into a new slot when max_stack is reached', () => {
    const reg = newRegistry();
    let inv = emptyInventory('player_1', 28);
    // flint has max_stack 99 - use coins (max_stack 10000 too high), or drive flint past 99
    inv = addItem(inv, 'item_template_flint', 95, reg.lookup).inventory;
    const r = addItem(inv, 'item_template_flint', 10, reg.lookup);
    expect(r.leftover).toBe(0);
    expect(r.inventory.stacks).toHaveLength(2);
    expect(r.inventory.stacks[0].qty).toBe(99);
    expect(r.inventory.stacks[1].qty).toBe(6);
  });

  it('gives non-stackable items one slot per unit', () => {
    const reg = newRegistry();
    const inv = emptyInventory('player_1', 28);
    const r = addItem(inv, 'item_template_reedwake_knife', 3, reg.lookup);
    expect(r.inventory.stacks).toHaveLength(3);
    expect(r.inventory.stacks.every((s) => s.qty === 1)).toBe(true);
  });

  it('returns leftover when capacity is exceeded', () => {
    const reg = newRegistry();
    const inv = emptyInventory('player_1', 2);
    const r = addItem(inv, 'item_template_reedwake_knife', 5, reg.lookup);
    expect(r.inventory.stacks).toHaveLength(2);
    expect(r.leftover).toBe(3);
  });

  it('removes items across stacks and drops empty slots', () => {
    const reg = newRegistry();
    let inv = emptyInventory('player_1', 28);
    inv = addItem(inv, 'item_template_flint', 150, reg.lookup).inventory; // 99 + 51
    expect(inv.stacks).toHaveLength(2);
    const r = removeItem(inv, 'item_template_flint', 120);
    expect(r.removed).toBe(120);
    expect(qtyOf(r.inventory, 'item_template_flint')).toBe(30);
    expect(r.inventory.stacks).toHaveLength(1);
  });

  it('has() returns true when qty>=requested', () => {
    const reg = newRegistry();
    const inv = addItem(emptyInventory('p', 28), 'item_template_silver_coin', 42, reg.lookup).inventory;
    expect(has(inv, 'item_template_silver_coin', 40)).toBe(true);
    expect(has(inv, 'item_template_silver_coin', 43)).toBe(false);
  });

  it('splits a stackable stack in two', () => {
    const reg = newRegistry();
    const inv = addItem(emptyInventory('p', 28), 'item_template_flint', 20, reg.lookup).inventory;
    const after = splitStack(inv, 0, 7, reg.lookup);
    expect(after.stacks).toHaveLength(2);
    expect(after.stacks[0].qty).toBe(13);
    expect(after.stacks[1].qty).toBe(7);
  });

  it('splitStack rejects non-stackable items', () => {
    const reg = newRegistry();
    const inv = addItem(emptyInventory('p', 28), 'item_template_reedwake_knife', 1, reg.lookup).inventory;
    expect(() => splitStack(inv, 0, 1, reg.lookup)).toThrow();
  });

  it('destroyStack removes the whole slot', () => {
    const reg = newRegistry();
    const inv = addItem(emptyInventory('p', 28), 'item_template_flint', 10, reg.lookup).inventory;
    const after = destroyStack(inv, 0);
    expect(after.stacks).toHaveLength(0);
  });

  it('transferItem moves atomically between two inventories', () => {
    const reg = newRegistry();
    const a = addItem(emptyInventory('a', 28), 'item_template_flint', 20, reg.lookup).inventory;
    const b = emptyInventory('b', 28);
    const result = transferItem(a, b, 'item_template_flint', 15, reg.lookup);
    expect(result).not.toBeNull();
    expect(qtyOf(result!.from, 'item_template_flint')).toBe(5);
    expect(qtyOf(result!.to, 'item_template_flint')).toBe(15);
  });

  it('transferItem refuses when source lacks qty', () => {
    const reg = newRegistry();
    const a = addItem(emptyInventory('a', 28), 'item_template_flint', 3, reg.lookup).inventory;
    const b = emptyInventory('b', 28);
    const result = transferItem(a, b, 'item_template_flint', 5, reg.lookup);
    expect(result).toBeNull();
  });

  it('transferItem refuses when target is full', () => {
    const reg = newRegistry();
    const a = addItem(emptyInventory('a', 28), 'item_template_reedwake_knife', 1, reg.lookup).inventory;
    let b = emptyInventory('b', 1);
    b = addItem(b, 'item_template_reedwake_knife', 1, reg.lookup).inventory;
    const result = transferItem(a, b, 'item_template_reedwake_knife', 1, reg.lookup);
    expect(result).toBeNull();
  });
});
