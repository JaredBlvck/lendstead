// Shop / trade runtime. Pure functions over a shop's live stock + the
// player's inventory + a currency item id.
//
// Shop runtime state lives separately from the Npc definition so stock
// levels can change during play without mutating content. One ShopState
// per npc id. Persisted via save/load.
//
// Currency resolution: any item whose `uses` array contains 'currency'
// qualifies. The engine picks the first one it finds in the registry
// unless a caller passes an explicit currency_item_id.

import type { Npc, ShopEntry } from './npcTypes';
import type { Inventory, Item } from '../items/itemTypes';
import { addItem, qtyOf, removeItem, type ItemLookup } from '../items/inventory';

export interface ShopStockLine {
  item_id: string;
  current_stock: number;
  last_restocked_cycle: number;
}

export interface ShopState {
  npc_id: string;
  lines: ShopStockLine[];
}

// Boot a shop runtime state from an NPC definition at a given cycle.
// Uses each entry's stock_qty as the starting stock.
export function bootShopState(npc: Npc, nowCycle: number): ShopState {
  return {
    npc_id: npc.id,
    lines: npc.shop_inventory.map((entry) => ({
      item_id: entry.item_id,
      current_stock: entry.stock_qty,
      last_restocked_cycle: nowCycle,
    })),
  };
}

// Locate the entry for an item in a given NPC's shop definition.
function findEntry(npc: Npc, itemId: string): ShopEntry | undefined {
  return npc.shop_inventory.find((e) => e.item_id === itemId);
}

function findLine(state: ShopState, itemId: string): ShopStockLine | undefined {
  return state.lines.find((l) => l.item_id === itemId);
}

// Pick a currency item id from the registry. Callers that know their
// currency pass it directly. Otherwise: any item whose uses contains
// 'currency'. Returns undefined if none registered.
export function pickCurrencyItemId(allItems: Item[]): string | undefined {
  const match = allItems.find((i) => i.uses.includes('currency'));
  return match?.id;
}

// ---------- BUY ----------

export interface BuyPreview {
  ok: boolean;
  reason?: string;
  unit_price?: number;
  total_cost?: number;
  max_affordable?: number;
  max_in_stock?: number;
}

export function previewBuy(
  npc: Npc,
  shopState: ShopState,
  itemId: string,
  qty: number,
  playerInventory: Inventory,
  currencyItemId: string,
): BuyPreview {
  const entry = findEntry(npc, itemId);
  if (!entry) return { ok: false, reason: `${itemId} not sold here` };
  if (entry.sell_price == null) return { ok: false, reason: `${itemId} is buy-only (shop does not sell it)` };
  const line = findLine(shopState, itemId);
  const stock = line?.current_stock ?? entry.stock_qty;
  const coins = qtyOf(playerInventory, currencyItemId);
  const maxAffordable = Math.floor(coins / entry.sell_price);
  const maxInStock = stock;
  const requested = Math.max(0, qty);

  if (requested <= 0) return { ok: false, reason: 'quantity must be positive', unit_price: entry.sell_price, max_affordable: maxAffordable, max_in_stock: maxInStock };
  if (requested > maxInStock) return { ok: false, reason: `only ${maxInStock} in stock`, unit_price: entry.sell_price, max_affordable: maxAffordable, max_in_stock: maxInStock };
  if (requested > maxAffordable) return { ok: false, reason: `need ${requested * entry.sell_price} coins (have ${coins})`, unit_price: entry.sell_price, max_affordable: maxAffordable, max_in_stock: maxInStock };
  return { ok: true, unit_price: entry.sell_price, total_cost: entry.sell_price * requested, max_affordable: maxAffordable, max_in_stock: maxInStock };
}

export interface BuyResult {
  ok: boolean;
  reason?: string;
  inventory?: Inventory;
  shop_state?: ShopState;
  notes?: string[];
}

export function executeBuy(
  npc: Npc,
  shopState: ShopState,
  itemId: string,
  qty: number,
  playerInventory: Inventory,
  itemLookup: ItemLookup,
  currencyItemId: string,
): BuyResult {
  const preview = previewBuy(npc, shopState, itemId, qty, playerInventory, currencyItemId);
  if (!preview.ok) return { ok: false, reason: preview.reason };
  const notes: string[] = [];

  // Deduct coins
  const coinResult = removeItem(playerInventory, currencyItemId, preview.total_cost ?? 0);
  if (coinResult.removed < (preview.total_cost ?? 0)) {
    return { ok: false, reason: 'coin deduction failed mid-buy' };
  }

  // Add item to player inventory
  const addResult = addItem(coinResult.inventory, itemId, qty, itemLookup);
  if (addResult.leftover > 0) {
    // Roll back: give coins back, report failure
    const rollback = addItem(addResult.inventory, currencyItemId, preview.total_cost ?? 0, itemLookup);
    return {
      ok: false,
      reason: `inventory full for ${itemId}, rolled back`,
      inventory: rollback.inventory,
    };
  }

  // Decrement shop stock
  const nextLines = shopState.lines.map((l) =>
    l.item_id === itemId
      ? { ...l, current_stock: Math.max(0, l.current_stock - qty) }
      : l,
  );
  notes.push(`bought ${qty}x ${itemId} for ${preview.total_cost} ${currencyItemId}`);

  return {
    ok: true,
    inventory: addResult.inventory,
    shop_state: { ...shopState, lines: nextLines },
    notes,
  };
}

// ---------- SELL ----------

export interface SellPreview {
  ok: boolean;
  reason?: string;
  unit_price?: number;
  total_value?: number;
  max_sellable?: number;
}

export function previewSell(
  npc: Npc,
  itemId: string,
  qty: number,
  playerInventory: Inventory,
): SellPreview {
  const entry = findEntry(npc, itemId);
  if (!entry) return { ok: false, reason: `${itemId} not bought here` };
  if (entry.buy_price == null) return { ok: false, reason: `${itemId} is sell-only (shop does not buy it)` };
  const have = qtyOf(playerInventory, itemId);
  const requested = Math.max(0, qty);
  if (requested <= 0) return { ok: false, reason: 'quantity must be positive', max_sellable: have };
  if (requested > have) return { ok: false, reason: `you only have ${have}`, max_sellable: have };
  return { ok: true, unit_price: entry.buy_price, total_value: entry.buy_price * requested, max_sellable: have };
}

export interface SellResult {
  ok: boolean;
  reason?: string;
  inventory?: Inventory;
  shop_state?: ShopState;
  notes?: string[];
}

export function executeSell(
  npc: Npc,
  shopState: ShopState,
  itemId: string,
  qty: number,
  playerInventory: Inventory,
  itemLookup: ItemLookup,
  currencyItemId: string,
): SellResult {
  const preview = previewSell(npc, itemId, qty, playerInventory);
  if (!preview.ok) return { ok: false, reason: preview.reason };

  const entry = findEntry(npc, itemId)!;
  const notes: string[] = [];

  // Remove item from player inventory
  const remResult = removeItem(playerInventory, itemId, qty);
  if (remResult.removed < qty) {
    return { ok: false, reason: 'removal failed mid-sell' };
  }

  // Pay player in coins
  const addResult = addItem(remResult.inventory, currencyItemId, preview.total_value ?? 0, itemLookup);
  if (addResult.leftover > 0) {
    // Partial: player got some coins, the rest dropped (inventory full)
    notes.push(`inventory full, ${addResult.leftover} coins dropped`);
  }

  // Increment shop stock if the entry also sells this item (reselling)
  const shopResupply = entry.sell_price != null;
  const nextLines = shopResupply
    ? shopState.lines.map((l) =>
        l.item_id === itemId
          ? { ...l, current_stock: l.current_stock + qty }
          : l,
      )
    : shopState.lines;
  notes.push(`sold ${qty}x ${itemId} for ${preview.total_value} ${currencyItemId}`);

  return {
    ok: true,
    inventory: addResult.inventory,
    shop_state: { ...shopState, lines: nextLines },
    notes,
  };
}

// ---------- RESTOCK ----------

// Refill shop stock lines whose restock cadence has elapsed.
export function restockShop(
  npc: Npc,
  state: ShopState,
  nowCycle: number,
): ShopState {
  const nextLines = state.lines.map((line) => {
    const entry = findEntry(npc, line.item_id);
    if (!entry || !entry.restocks_every_cycles) return line;
    const elapsed = nowCycle - line.last_restocked_cycle;
    if (elapsed < entry.restocks_every_cycles) return line;
    // Reset to entry.stock_qty and update cycle
    return {
      ...line,
      current_stock: entry.stock_qty,
      last_restocked_cycle: nowCycle,
    };
  });
  return { ...state, lines: nextLines };
}
