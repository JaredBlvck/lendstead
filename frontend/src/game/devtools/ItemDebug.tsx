// Dev panel: inspect inventory + equipment, spawn items.

import { useState } from 'react';
import type { Equipment, EquipSlot, Inventory } from '../items/itemTypes';
import { addItem, destroyStack, type ItemLookup } from '../items/inventory';
import { equipFromInventory, unequip, totalEquippedStats } from '../items/equipment';
import type { ItemRegistry } from '../items/itemRegistry';
import { devStyles } from './devPanelStyles';

interface Props {
  registry: ItemRegistry;
  inventory: Inventory;
  equipment: Equipment;
  onChange: (inv: Inventory, eq: Equipment) => void;
}

const SLOTS: EquipSlot[] = [
  'head', 'body', 'legs', 'feet', 'hands',
  'main_hand', 'off_hand', 'ring', 'amulet', 'tool', 'cosmetic',
];

export function ItemDebug({ registry, inventory, equipment, onChange }: Props) {
  const [spawnId, setSpawnId] = useState(registry.all()[0]?.id ?? '');
  const [spawnQty, setSpawnQty] = useState('1');

  const lookup: ItemLookup = registry.lookup;
  const stats = totalEquippedStats(equipment, lookup);

  return (
    <div>
      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Spawn Item</div>
        <select
          style={devStyles.input}
          value={spawnId}
          onChange={(e) => setSpawnId(e.target.value)}
        >
          {registry.all().map((i) => (
            <option key={i.id} value={i.id}>{i.id}</option>
          ))}
        </select>
        <input
          style={{ ...devStyles.input, marginTop: 4 }}
          value={spawnQty}
          onChange={(e) => setSpawnQty(e.target.value)}
        />
        <button
          style={devStyles.button}
          onClick={() => {
            const qty = parseInt(spawnQty, 10) || 1;
            const r = addItem(inventory, spawnId, qty, lookup);
            onChange(r.inventory, equipment);
          }}
        >
          add to inventory
        </button>
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>
          Inventory ({inventory.stacks.length}/{inventory.capacity})
        </div>
        {inventory.stacks.map((s, idx) => {
          const item = lookup(s.item_id);
          return (
            <div key={idx} style={devStyles.row}>
              <span>{s.item_id} x{s.qty}</span>
              <div>
                {item?.equip_slot && (
                  <button
                    style={devStyles.button}
                    onClick={() => {
                      try {
                        const { inventory: inv, equipment: eq } = equipFromInventory(inventory, equipment, idx, lookup);
                        onChange(inv, eq);
                      } catch (e) {
                        alert(String(e));
                      }
                    }}
                  >
                    equip
                  </button>
                )}
                <button
                  style={devStyles.button}
                  onClick={() => onChange(destroyStack(inventory, idx), equipment)}
                >
                  destroy
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Equipment</div>
        {SLOTS.map((slot) => {
          const s = equipment.slots[slot];
          return (
            <div key={slot} style={devStyles.row}>
              <span>{slot}</span>
              <div>
                {s ? (
                  <>
                    <span style={devStyles.muted}>{s.item_id}</span>
                    <button
                      style={devStyles.button}
                      onClick={() => {
                        const r = unequip(inventory, equipment, slot, lookup);
                        if (r) onChange(r.inventory, r.equipment);
                      }}
                    >
                      unequip
                    </button>
                  </>
                ) : (
                  <span style={devStyles.muted}>(empty)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Total Stats (equipped)</div>
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} style={devStyles.row}>
            <span>{k}</span>
            <span style={v > 0 ? devStyles.good : {}}>{v > 0 ? '+' : ''}{v}</span>
          </div>
        ))}
        {Object.keys(stats).length === 0 && <div style={devStyles.muted}>(no effects)</div>}
      </div>
    </div>
  );
}
