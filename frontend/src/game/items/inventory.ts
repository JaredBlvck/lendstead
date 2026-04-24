// Inventory runtime. Pure functions over Inventory state - no mutation.
// Every mutator returns a new Inventory so React render + save diff work.
// Capacity is slot-based (RuneScape-style): each non-stackable item occupies
// one slot; stackable items occupy one slot up to max_stack.

import type { Inventory, InventoryStack, Item } from './itemTypes';

export interface ItemLookup {
  (itemId: string): Item | undefined;
}

export function emptyInventory(owner_id: string, capacity = 28): Inventory {
  return { owner_id, capacity, stacks: [] };
}

export function totalSlotsUsed(inv: Inventory): number {
  return inv.stacks.length;
}

export function qtyOf(inv: Inventory, itemId: string): number {
  return inv.stacks
    .filter((s) => s.item_id === itemId)
    .reduce((sum, s) => sum + s.qty, 0);
}

export function has(inv: Inventory, itemId: string, qty = 1): boolean {
  return qtyOf(inv, itemId) >= qty;
}

// Add item. Stackable: fills existing stacks up to max_stack, then opens new
// slots. Non-stackable: one slot per qty. Returns {inventory, leftover} where
// leftover > 0 means the add did not fit entirely within capacity.
export interface AddResult {
  inventory: Inventory;
  leftover: number;
}

export function addItem(
  inv: Inventory,
  itemId: string,
  qty: number,
  lookup: ItemLookup,
): AddResult {
  if (qty <= 0) return { inventory: inv, leftover: 0 };
  const item = lookup(itemId);
  if (!item) throw new Error(`addItem: unknown item ${itemId}`);

  const stacks: InventoryStack[] = inv.stacks.map((s) => ({ ...s }));
  let remaining = qty;

  if (item.stackable) {
    // Fill existing stacks of this item first
    for (const stack of stacks) {
      if (remaining <= 0) break;
      if (stack.item_id !== itemId) continue;
      const space = item.max_stack - stack.qty;
      if (space <= 0) continue;
      const take = Math.min(space, remaining);
      stack.qty += take;
      remaining -= take;
    }
    // Open new slots for overflow
    while (remaining > 0 && stacks.length < inv.capacity) {
      const take = Math.min(item.max_stack, remaining);
      stacks.push({ item_id: itemId, qty: take });
      remaining -= take;
    }
  } else {
    // One slot per unit
    while (remaining > 0 && stacks.length < inv.capacity) {
      stacks.push({ item_id: itemId, qty: 1 });
      remaining -= 1;
    }
  }

  return {
    inventory: { ...inv, stacks },
    leftover: remaining,
  };
}

// Remove qty of an item across stacks. Returns {inventory, removed} where
// removed is the actual qty removed (<= qty if inventory had less).
export interface RemoveResult {
  inventory: Inventory;
  removed: number;
}

export function removeItem(inv: Inventory, itemId: string, qty: number): RemoveResult {
  if (qty <= 0) return { inventory: inv, removed: 0 };

  const stacks: InventoryStack[] = inv.stacks.map((s) => ({ ...s }));
  let remaining = qty;
  for (const stack of stacks) {
    if (remaining <= 0) break;
    if (stack.item_id !== itemId) continue;
    const take = Math.min(stack.qty, remaining);
    stack.qty -= take;
    remaining -= take;
  }
  const filtered = stacks.filter((s) => s.qty > 0);
  return {
    inventory: { ...inv, stacks: filtered },
    removed: qty - remaining,
  };
}

// Split a stack at index `idx` into two stacks. `splitQty` moves to the new
// stack (appended at end). Requires: idx valid, stack stackable, splitQty < current qty, capacity room.
export function splitStack(
  inv: Inventory,
  idx: number,
  splitQty: number,
  lookup: ItemLookup,
): Inventory {
  if (idx < 0 || idx >= inv.stacks.length) throw new Error('splitStack: bad index');
  const src = inv.stacks[idx];
  const item = lookup(src.item_id);
  if (!item || !item.stackable) throw new Error(`splitStack: ${src.item_id} not stackable`);
  if (splitQty <= 0 || splitQty >= src.qty) throw new Error('splitStack: bad qty');
  if (inv.stacks.length >= inv.capacity) throw new Error('splitStack: capacity full');

  const stacks = inv.stacks.map((s, i) =>
    i === idx ? { ...s, qty: s.qty - splitQty } : { ...s },
  );
  stacks.push({ item_id: src.item_id, qty: splitQty });
  return { ...inv, stacks };
}

// Destroy entire stack at index.
export function destroyStack(inv: Inventory, idx: number): Inventory {
  if (idx < 0 || idx >= inv.stacks.length) throw new Error('destroyStack: bad index');
  return { ...inv, stacks: inv.stacks.filter((_, i) => i !== idx) };
}

// Move items from one inventory to another (trade / chest). Atomic: either
// the whole qty moves or nothing does.
export function transferItem(
  from: Inventory,
  to: Inventory,
  itemId: string,
  qty: number,
  lookup: ItemLookup,
): { from: Inventory; to: Inventory } | null {
  if (!has(from, itemId, qty)) return null;
  const addRes = addItem(to, itemId, qty, lookup);
  if (addRes.leftover > 0) return null;   // target can't fit - abort
  const removeRes = removeItem(from, itemId, qty);
  return { from: removeRes.inventory, to: addRes.inventory };
}
