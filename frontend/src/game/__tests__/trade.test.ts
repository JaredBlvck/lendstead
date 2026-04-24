import { describe, it, expect } from 'vitest';
import {
  bootShopState,
  executeBuy,
  executeSell,
  pickCurrencyItemId,
  previewBuy,
  previewSell,
  restockShop,
} from '../npcs/trade';
import { ItemRegistry } from '../items/itemRegistry';
import { emptyInventory, addItem, qtyOf } from '../items/inventory';
import {
  item_template_flint,
  item_template_knife,
  item_template_silver_coin,
} from '../../content/items/_template';
import type { Npc } from '../npcs/npcTypes';

function makeNpcWithShop(): Npc {
  return {
    id: 'npc_shop_test',
    schema_version: 1,
    name: 'Test Trader',
    role: 'trader',
    personality: 'brisk',
    dialogue_style: 'short',
    schedule: [],
    relationships: [],
    quest_hooks: [],
    dialogue_lines: [],
    shop_inventory: [
      {
        item_id: 'item_template_flint',
        stock_qty: 10,
        sell_price: 2,
        buy_price: 1,
        restocks_every_cycles: 5,
      },
      {
        item_id: 'item_template_reedwake_knife',
        stock_qty: 2,
        sell_price: 50,
        buy_price: 25,
      },
    ],
    secrets: [],
    personal_goals: [],
    default_movement_mode: 'idle',
    default_dialogue_state: 'neutral',
    tags: [],
  };
}

function registry() {
  const reg = new ItemRegistry();
  reg.registerMany([item_template_flint, item_template_knife, item_template_silver_coin]);
  return reg;
}

const CURRENCY = 'item_template_silver_coin';

describe('trade runtime', () => {
  it('picks up currency from any item with uses=[currency]', () => {
    const reg = registry();
    expect(pickCurrencyItemId(reg.all())).toBe(CURRENCY);
  });

  it('bootShopState seeds stock from npc definition', () => {
    const npc = makeNpcWithShop();
    const state = bootShopState(npc, 0);
    expect(state.lines).toHaveLength(2);
    expect(state.lines[0].current_stock).toBe(10);
    expect(state.lines[1].current_stock).toBe(2);
  });

  it('previewBuy succeeds when player has enough coin and shop has stock', () => {
    const npc = makeNpcWithShop();
    const reg = registry();
    let inv = addItem(emptyInventory('p', 28), CURRENCY, 100, reg.lookup).inventory;
    const state = bootShopState(npc, 0);
    const p = previewBuy(npc, state, 'item_template_flint', 3, inv, CURRENCY);
    expect(p.ok).toBe(true);
    expect(p.total_cost).toBe(6);
    expect(p.max_affordable).toBe(50);
  });

  it('previewBuy refuses when insufficient coin', () => {
    const npc = makeNpcWithShop();
    const reg = registry();
    let inv = addItem(emptyInventory('p', 28), CURRENCY, 5, reg.lookup).inventory;
    const state = bootShopState(npc, 0);
    const p = previewBuy(npc, state, 'item_template_reedwake_knife', 1, inv, CURRENCY);
    expect(p.ok).toBe(false);
    expect(p.reason).toContain('50');
  });

  it('previewBuy refuses when shop out of stock', () => {
    const npc = makeNpcWithShop();
    const reg = registry();
    let inv = addItem(emptyInventory('p', 28), CURRENCY, 1000, reg.lookup).inventory;
    const state = bootShopState(npc, 0);
    const p = previewBuy(npc, state, 'item_template_reedwake_knife', 5, inv, CURRENCY);
    expect(p.ok).toBe(false);
    expect(p.reason).toContain('only 2');
  });

  it('executeBuy decrements coins, adds item, decrements shop stock', () => {
    const npc = makeNpcWithShop();
    const reg = registry();
    let inv = addItem(emptyInventory('p', 28), CURRENCY, 100, reg.lookup).inventory;
    const state = bootShopState(npc, 0);
    const result = executeBuy(npc, state, 'item_template_flint', 4, inv, reg.lookup, CURRENCY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(qtyOf(result.inventory!, CURRENCY)).toBe(92);        // 100 - (4*2)
    expect(qtyOf(result.inventory!, 'item_template_flint')).toBe(4);
    const line = result.shop_state!.lines.find((l) => l.item_id === 'item_template_flint');
    expect(line?.current_stock).toBe(6);                         // 10 - 4
  });

  it('executeSell removes item, adds coins, increments shop stock when shop also sells it', () => {
    const npc = makeNpcWithShop();
    const reg = registry();
    let inv = emptyInventory('p', 28);
    inv = addItem(inv, 'item_template_flint', 7, reg.lookup).inventory;
    const state = bootShopState(npc, 0);
    const result = executeSell(npc, state, 'item_template_flint', 3, inv, reg.lookup, CURRENCY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(qtyOf(result.inventory!, CURRENCY)).toBe(3);         // 3*1
    expect(qtyOf(result.inventory!, 'item_template_flint')).toBe(4);
    const line = result.shop_state!.lines.find((l) => l.item_id === 'item_template_flint');
    expect(line?.current_stock).toBe(13);                        // 10 + 3
  });

  it('previewSell refuses when player does not have enough', () => {
    const npc = makeNpcWithShop();
    let inv = emptyInventory('p', 28);
    const p = previewSell(npc, 'item_template_flint', 3, inv);
    expect(p.ok).toBe(false);
    expect(p.reason).toContain('only have 0');
  });

  it('restockShop refills stock only when cadence elapsed', () => {
    const npc = makeNpcWithShop();
    let state = bootShopState(npc, 0);
    // Consume a few
    state = {
      ...state,
      lines: state.lines.map((l) =>
        l.item_id === 'item_template_flint' ? { ...l, current_stock: 3 } : l,
      ),
    };
    // Too early (restocks_every_cycles = 5; elapsed = 2)
    const early = restockShop(npc, state, 2);
    expect(early.lines.find((l) => l.item_id === 'item_template_flint')!.current_stock).toBe(3);

    // Enough time passed - restock
    const later = restockShop(npc, state, 10);
    expect(later.lines.find((l) => l.item_id === 'item_template_flint')!.current_stock).toBe(10);
    expect(later.lines.find((l) => l.item_id === 'item_template_flint')!.last_restocked_cycle).toBe(10);
  });

  it('executeBuy rolls back when inventory is too full to accept purchased item', () => {
    const npc = makeNpcWithShop();
    const reg = registry();
    let inv = emptyInventory('p', 2);
    inv = addItem(inv, CURRENCY, 200, reg.lookup).inventory;    // slot 1 (currency stack)
    inv = addItem(inv, 'item_template_reedwake_knife', 1, reg.lookup).inventory; // slot 2 (non-stackable)
    // Inventory now full; try to buy a non-stackable knife
    const state = bootShopState(npc, 0);
    const result = executeBuy(npc, state, 'item_template_reedwake_knife', 1, inv, reg.lookup, CURRENCY);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('inventory full');
    // Rollback preserved currency
    if (result.inventory) {
      expect(qtyOf(result.inventory, CURRENCY)).toBe(200);
    }
  });
});
