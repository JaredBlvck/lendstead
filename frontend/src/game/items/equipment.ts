// Equipment runtime. Slots mirror the EquipSlot enum - each slot holds at
// most one InventoryStack. Equipping pulls a stack out of the inventory and
// places it in the slot; unequipping does the reverse. Returns new Inventory
// and Equipment objects (pure).

import type { Equipment, EquipSlot, Inventory, InventoryStack } from './itemTypes';
import { addItem, type ItemLookup } from './inventory';

export function emptyEquipment(owner_id: string): Equipment {
  return { owner_id, slots: {} };
}

// Equip an item from inventory slot index `idx`. If `slot` is omitted, use
// the item's default equip_slot. If the target slot already has something,
// it gets swapped back into inventory.
export function equipFromInventory(
  inv: Inventory,
  eq: Equipment,
  idx: number,
  lookup: ItemLookup,
  slot?: EquipSlot,
): { inventory: Inventory; equipment: Equipment } {
  if (idx < 0 || idx >= inv.stacks.length) throw new Error('equip: bad index');
  const src = inv.stacks[idx];
  const item = lookup(src.item_id);
  if (!item) throw new Error(`equip: unknown item ${src.item_id}`);
  const targetSlot = slot ?? item.equip_slot;
  if (!targetSlot) throw new Error(`equip: item ${src.item_id} has no equip_slot`);

  // Remove one from the inventory stack
  const newStacks = inv.stacks
    .map((s, i) => (i === idx ? { ...s, qty: s.qty - 1 } : { ...s }))
    .filter((s) => s.qty > 0);

  const equippedStack: InventoryStack = {
    item_id: src.item_id,
    qty: 1,
    instance: src.instance,
  };

  // Swap: if slot occupied, put old stack back in inventory
  const previous = eq.slots[targetSlot];
  let inventory: Inventory = { ...inv, stacks: newStacks };
  if (previous) {
    const restore = addItem(inventory, previous.item_id, previous.qty, lookup);
    if (restore.leftover > 0) {
      // No room for the swap - abort whole op by throwing
      throw new Error(`equip: no inventory room to swap out ${previous.item_id}`);
    }
    inventory = restore.inventory;
  }

  const equipment: Equipment = {
    ...eq,
    slots: { ...eq.slots, [targetSlot]: equippedStack },
  };
  return { inventory, equipment };
}

// Remove item from equipment slot and return it to inventory. If no room,
// the unequip fails and returns null (caller can drop or abort).
export function unequip(
  inv: Inventory,
  eq: Equipment,
  slot: EquipSlot,
  lookup: ItemLookup,
): { inventory: Inventory; equipment: Equipment } | null {
  const stack = eq.slots[slot];
  if (!stack) return { inventory: inv, equipment: eq };   // already empty

  const addRes = addItem(inv, stack.item_id, stack.qty, lookup);
  if (addRes.leftover > 0) return null;

  const newSlots = { ...eq.slots };
  delete newSlots[slot];
  return {
    inventory: addRes.inventory,
    equipment: { ...eq, slots: newSlots },
  };
}

// Aggregate stat effects from all equipped items. Returns {statName: totalDelta}.
export function totalEquippedStats(eq: Equipment, lookup: ItemLookup): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const stack of Object.values(eq.slots)) {
    if (!stack) continue;
    const item = lookup(stack.item_id);
    if (!item) continue;
    for (const effect of item.stat_effects) {
      if (effect.duration_cycles && effect.duration_cycles > 0) continue;   // transient, not equipped-permanent
      totals[effect.stat] = (totals[effect.stat] ?? 0) + effect.delta;
    }
  }
  return totals;
}
