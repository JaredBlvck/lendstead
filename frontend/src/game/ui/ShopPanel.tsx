// ShopPanel. Opens for an NPC with a non-empty shop_inventory.
// Two tabs: "Buy" (what the shop sells you) and "Sell" (what the shop
// will buy from you). Both read current shop stock from engine state
// and update it atomically through executeBuy/executeSell.

import { useMemo, useState, type CSSProperties } from 'react';
import { useEngine } from '../engine/EngineContext';
import {
  bootShopState,
  executeBuy,
  executeSell,
  pickCurrencyItemId,
  previewBuy,
  previewSell,
  restockShop,
  type ShopState,
} from '../npcs/trade';
import { qtyOf } from '../items/inventory';

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  panel: {
    width: 'min(560px, 94vw)',
    maxHeight: '80vh',
    overflowY: 'auto',
    background: 'rgba(10, 14, 20, 0.96)',
    color: '#e6edf7',
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    fontSize: 12,
    borderRadius: 10,
    border: '1px solid #2c3442',
    padding: 16,
    boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 13, fontWeight: 700, letterSpacing: 0.4 },
  tabs: { display: 'flex', gap: 4, marginBottom: 10 },
  tab: {
    padding: '4px 10px',
    background: '#1b2230',
    border: '1px solid #2c3442',
    borderRadius: 4,
    color: '#bac6d9',
    cursor: 'pointer',
    fontSize: 11,
  },
  tabActive: { background: '#2a4a6b', borderColor: '#3d6ba0', color: '#fff' },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 60px 60px 80px 70px',
    gap: 6,
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid #1f2630',
  },
  small: { fontSize: 10, opacity: 0.7 },
  input: {
    background: '#0c1118',
    border: '1px solid #2c3442',
    color: '#e6edf7',
    borderRadius: 3,
    padding: '2px 4px',
    fontSize: 11,
    width: 44,
    fontFamily: 'inherit',
  },
  button: {
    padding: '3px 8px',
    background: '#2a4a6b',
    border: '1px solid #3d6ba0',
    color: '#fff',
    borderRadius: 3,
    fontSize: 10,
    cursor: 'pointer',
  },
  disabled: {
    background: '#202731',
    borderColor: '#2c3442',
    color: '#8aa4c4',
    cursor: 'not-allowed',
  },
  close: {
    background: 'transparent',
    border: '1px solid #3d6ba0',
    color: '#bac6d9',
    borderRadius: 3,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
  },
};

interface Props {
  npcId: string;
  onClose: () => void;
}

export function ShopPanel({ npcId, onClose }: Props) {
  const engine = useEngine();
  const npc = engine.bundle.npcs.get(npcId);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string>('');

  const currencyItemId = useMemo(
    () => pickCurrencyItemId(engine.bundle.items.all()),
    [engine.bundle.items],
  );

  if (!npc) {
    return (
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          unknown npc
        </div>
      </div>
    );
  }
  if (npc.shop_inventory.length === 0) {
    return (
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          {npc.name} is not trading today.
        </div>
      </div>
    );
  }
  if (!currencyItemId) {
    return (
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          No currency item registered. Register an item with uses=[currency] to trade.
        </div>
      </div>
    );
  }

  // Resolve current shop state (boot on first open, restock on each open)
  let shopState: ShopState = engine.state.shopStates.find((s) => s.npc_id === npcId)
    ?? bootShopState(npc, engine.state.world.cycle);
  shopState = restockShop(npc, shopState, engine.state.world.cycle);

  const playerCoins = qtyOf(engine.state.inventory, currencyItemId);

  const handleBuy = (itemId: string) => {
    const qty = parseInt(qtys[itemId] ?? '1', 10) || 1;
    const result = executeBuy(npc, shopState, itemId, qty, engine.state.inventory, engine.bundle.items.lookup, currencyItemId);
    if (!result.ok) {
      setNote(result.reason ?? 'buy failed');
      return;
    }
    if (result.inventory) engine.setInventory(result.inventory);
    if (result.shop_state) engine.upsertShopState(result.shop_state);
    setNote(result.notes?.join(' / ') ?? 'bought');
    // Emit a gather_item event so quests tracking pickups advance
    window.__lendsteadEmitEvent?.({
      kind: 'gather_item',
      payload: { item_id: itemId, qty },
    });
  };

  const handleSell = (itemId: string) => {
    const qty = parseInt(qtys[itemId] ?? '1', 10) || 1;
    const result = executeSell(npc, shopState, itemId, qty, engine.state.inventory, engine.bundle.items.lookup, currencyItemId);
    if (!result.ok) {
      setNote(result.reason ?? 'sell failed');
      return;
    }
    if (result.inventory) engine.setInventory(result.inventory);
    if (result.shop_state) engine.upsertShopState(result.shop_state);
    setNote(result.notes?.join(' / ') ?? 'sold');
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{npc.name}</div>
            <div style={styles.small}>
              {npc.role} - your coin: {playerCoins}
            </div>
          </div>
          <button style={styles.close} onClick={onClose}>close</button>
        </div>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === 'buy' ? styles.tabActive : {}) }}
            onClick={() => setTab('buy')}
          >
            buy
          </button>
          <button
            style={{ ...styles.tab, ...(tab === 'sell' ? styles.tabActive : {}) }}
            onClick={() => setTab('sell')}
          >
            sell
          </button>
        </div>

        {tab === 'buy' && npc.shop_inventory
          .filter((e) => e.sell_price != null)
          .map((entry) => {
            const item = engine.bundle.items.get(entry.item_id);
            const line = shopState.lines.find((l) => l.item_id === entry.item_id);
            const stock = line?.current_stock ?? entry.stock_qty;
            const qty = parseInt(qtys[entry.item_id] ?? '1', 10) || 1;
            const preview = previewBuy(npc, shopState, entry.item_id, qty, engine.state.inventory, currencyItemId);
            return (
              <div key={entry.item_id} style={styles.row}>
                <div>
                  <div>{item?.name ?? entry.item_id}</div>
                  <div style={styles.small}>stock {stock}</div>
                </div>
                <div>{entry.sell_price}c</div>
                <input
                  style={styles.input}
                  value={qtys[entry.item_id] ?? '1'}
                  onChange={(e) => setQtys({ ...qtys, [entry.item_id]: e.target.value })}
                />
                <div style={styles.small}>
                  = {preview.ok ? preview.total_cost : preview.unit_price ? '—' : '—'}c
                </div>
                <button
                  style={{ ...styles.button, ...(preview.ok ? {} : styles.disabled) }}
                  disabled={!preview.ok}
                  onClick={() => handleBuy(entry.item_id)}
                >
                  buy
                </button>
              </div>
            );
          })}

        {tab === 'sell' && npc.shop_inventory
          .filter((e) => e.buy_price != null)
          .map((entry) => {
            const item = engine.bundle.items.get(entry.item_id);
            const have = qtyOf(engine.state.inventory, entry.item_id);
            const qty = parseInt(qtys[entry.item_id] ?? '1', 10) || 1;
            const preview = previewSell(npc, entry.item_id, qty, engine.state.inventory);
            return (
              <div key={entry.item_id} style={styles.row}>
                <div>
                  <div>{item?.name ?? entry.item_id}</div>
                  <div style={styles.small}>you have {have}</div>
                </div>
                <div>{entry.buy_price}c</div>
                <input
                  style={styles.input}
                  value={qtys[entry.item_id] ?? '1'}
                  onChange={(e) => setQtys({ ...qtys, [entry.item_id]: e.target.value })}
                />
                <div style={styles.small}>
                  = {preview.ok ? preview.total_value : '—'}c
                </div>
                <button
                  style={{ ...styles.button, ...(preview.ok ? {} : styles.disabled) }}
                  disabled={!preview.ok}
                  onClick={() => handleSell(entry.item_id)}
                >
                  sell
                </button>
              </div>
            );
          })}

        {note && <div style={{ marginTop: 8, opacity: 0.85 }}>{note}</div>}
      </div>
    </div>
  );
}
