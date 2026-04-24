import { describe, it, expect } from 'vitest';
import { emptyInventory, addItem, qtyOf } from '../items/inventory';
import {
  emptyEquipment,
  equipFromInventory,
  unequip,
  totalEquippedStats,
} from '../items/equipment';
import { ItemRegistry } from '../items/itemRegistry';
import {
  item_template_flint,
  item_template_knife,
  item_template_silver_coin,
} from '../../content/items/_template';
import type { Item } from '../items/itemTypes';

function newRegistry(): ItemRegistry {
  const reg = new ItemRegistry();
  reg.registerMany([item_template_flint, item_template_knife, item_template_silver_coin]);
  return reg;
}

describe('equipment', () => {
  it('equips a knife from inventory into main_hand', () => {
    const reg = newRegistry();
    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_reedwake_knife', 1, reg.lookup).inventory;
    const eq = emptyEquipment('p');
    const r = equipFromInventory(inv, eq, 0, reg.lookup);
    expect(r.equipment.slots.main_hand?.item_id).toBe('item_template_reedwake_knife');
    expect(r.inventory.stacks).toHaveLength(0);
  });

  it('refuses to equip items with no equip_slot', () => {
    const reg = newRegistry();
    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_flint', 1, reg.lookup).inventory;
    const eq = emptyEquipment('p');
    expect(() => equipFromInventory(inv, eq, 0, reg.lookup)).toThrow();
  });

  it('swaps previously equipped item back into inventory', () => {
    // Build a second main_hand weapon so the swap is legal
    const item_wooden_club: Item = {
      ...item_template_knife,
      id: 'item_wooden_club',
      name: 'Wooden Club',
      stat_effects: [{ stat: 'attack', delta: 1 }],
    };
    const reg2 = new ItemRegistry();
    reg2.registerMany([item_template_flint, item_template_knife, item_wooden_club]);

    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_reedwake_knife', 1, reg2.lookup).inventory;
    inv = addItem(inv, 'item_wooden_club', 1, reg2.lookup).inventory;

    let eq = emptyEquipment('p');
    let r = equipFromInventory(inv, eq, 0, reg2.lookup);   // equip knife
    expect(r.equipment.slots.main_hand?.item_id).toBe('item_template_reedwake_knife');

    // Club is now at index 0 (knife consumed index 0, club moved up)
    r = equipFromInventory(r.inventory, r.equipment, 0, reg2.lookup);    // equip club, swap knife back
    expect(r.equipment.slots.main_hand?.item_id).toBe('item_wooden_club');
    expect(r.inventory.stacks.some((s) => s.item_id === 'item_template_reedwake_knife')).toBe(true);
  });

  it('unequip returns the item to inventory', () => {
    const reg = newRegistry();
    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_reedwake_knife', 1, reg.lookup).inventory;
    const eq = emptyEquipment('p');
    const r = equipFromInventory(inv, eq, 0, reg.lookup);
    const r2 = unequip(r.inventory, r.equipment, 'main_hand', reg.lookup);
    expect(r2).not.toBeNull();
    expect(r2!.equipment.slots.main_hand).toBeUndefined();
    expect(qtyOf(r2!.inventory, 'item_template_reedwake_knife')).toBe(1);
  });

  it('unequip returns null if inventory has no room', () => {
    const reg = newRegistry();
    let inv = emptyInventory('p', 1);
    inv = addItem(inv, 'item_template_reedwake_knife', 1, reg.lookup).inventory;
    const eq = emptyEquipment('p');
    const r = equipFromInventory(inv, eq, 0, reg.lookup);   // now inv empty, eq has knife
    // Fill inventory with flint so unequip has nowhere to go
    const full = addItem(r.inventory, 'item_template_flint', 1, reg.lookup).inventory;
    const r2 = unequip(full, r.equipment, 'main_hand', reg.lookup);
    expect(r2).toBeNull();
  });

  it('totalEquippedStats aggregates permanent-while-equipped effects', () => {
    const reg = newRegistry();
    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_reedwake_knife', 1, reg.lookup).inventory;
    const eq = emptyEquipment('p');
    const r = equipFromInventory(inv, eq, 0, reg.lookup);
    const stats = totalEquippedStats(r.equipment, reg.lookup);
    expect(stats.attack).toBe(3);
    expect(stats.skill_scout).toBe(1);
  });
});
