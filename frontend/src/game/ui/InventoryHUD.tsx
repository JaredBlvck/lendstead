// Inventory HUD. 28-slot bag panel. Click a stack to open item actions
// (equip/use/drop/split). Minimal dependencies on engine mutators.

import { useState, type CSSProperties } from 'react';
import { useEngine } from '../engine/EngineContext';
import { destroyStack, removeItem } from '../items/inventory';
import { equipFromInventory, unequip } from '../items/equipment';
import type { EquipSlot, Item, InventoryStack } from '../items/itemTypes';

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    width: 280,
    background: 'rgba(10, 14, 20, 0.92)',
    color: '#e6edf7',
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    fontSize: 11,
    borderRadius: 8,
    border: '1px solid #2c3442',
    zIndex: 900,
    padding: 10,
  },
  title: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.7,
    marginBottom: 6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 3,
  },
  slot: {
    aspectRatio: '1',
    background: '#0c1118',
    border: '1px solid #2c3442',
    borderRadius: 3,
    position: 'relative',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 2,
    fontSize: 9,
    color: '#bac6d9',
  },
  slotSelected: {
    background: '#1c2a3b',
    borderColor: '#3d6ba0',
  },
  actionBar: {
    marginTop: 8,
    padding: 6,
    background: '#141a25',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  actionRow: { display: 'flex', justifyContent: 'space-between', gap: 4 },
  button: {
    background: '#2a4a6b',
    border: '1px solid #3d6ba0',
    color: '#fff',
    borderRadius: 3,
    padding: '3px 8px',
    fontSize: 10,
    cursor: 'pointer',
    flex: 1,
  },
  equipRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    padding: '2px 0',
  },
};

export function InventoryHUD() {
  const engine = useEngine();
  const { inventory, equipment } = engine.state;
  const lookup = engine.bundle.items.lookup;
  const [selected, setSelected] = useState<number | null>(null);

  const selectedStack: InventoryStack | null = selected != null ? inventory.stacks[selected] ?? null : null;
  const selectedItem = selectedStack ? lookup(selectedStack.item_id) : null;

  const slots: Array<{ stack?: InventoryStack; idx: number }> = [];
  for (let i = 0; i < inventory.capacity; i++) {
    slots.push({ stack: inventory.stacks[i], idx: i });
  }

  const handleEquip = () => {
    if (selected == null || !selectedItem?.equip_slot) return;
    try {
      const { inventory: inv, equipment: eq } = equipFromInventory(inventory, equipment, selected, lookup);
      engine.setInventory(inv);
      engine.setEquipment(eq);
      setSelected(null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('equip failed', e);
    }
  };

  const handleDrop = () => {
    if (selected == null) return;
    engine.setInventory(destroyStack(inventory, selected));
    setSelected(null);
  };

  // Items with hp_restore or energy_restore stat_effects are consumables.
  // "Use" consumes one + applies the effect to the player's combat block.
  const consumableEffects = (item: Item): { hp: number; energy: number } => {
    let hp = 0;
    let energy = 0;
    for (const eff of item.stat_effects) {
      if (eff.stat === 'hp_restore') hp += eff.delta;
      if (eff.stat === 'energy_restore') energy += eff.delta;
    }
    return { hp, energy };
  };

  const handleUse = () => {
    if (selected == null || !selectedStack || !selectedItem) return;
    const effect = consumableEffects(selectedItem);
    if (effect.hp <= 0 && effect.energy <= 0) return;
    const combat = engine.state.player.combat;
    if (!combat) return;

    // Remove 1 of the selected item
    const rem = removeItem(inventory, selectedStack.item_id, 1);
    engine.setInventory(rem.inventory);

    // Apply effects, clamped to max
    const newHp = Math.min(combat.max_hp, combat.hp + effect.hp);
    const maxEnergy = combat.max_energy ?? 20;
    const curEnergy = combat.energy ?? maxEnergy;
    const newEnergy = Math.min(maxEnergy, curEnergy + effect.energy);
    engine.setPlayer({
      ...engine.state.player,
      combat: {
        ...combat,
        hp: newHp,
        energy: newEnergy,
      },
    });
    setSelected(null);
  };

  const equippedEntries = Object.entries(equipment.slots) as Array<[EquipSlot, InventoryStack | undefined]>;

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>Bag ({inventory.stacks.length}/{inventory.capacity})</div>
      <div style={styles.grid}>
        {slots.map(({ stack, idx }) => (
          <div
            key={idx}
            style={{ ...styles.slot, ...(selected === idx ? styles.slotSelected : {}) }}
            onClick={() => stack && setSelected(idx === selected ? null : idx)}
            title={stack ? lookup(stack.item_id)?.name ?? stack.item_id : 'empty'}
          >
            {stack && (
              <>
                <div style={{
                  position: 'absolute',
                  top: 2,
                  left: 3,
                  fontSize: 8,
                  opacity: 0.85,
                  lineHeight: 1,
                }}>
                  {stack.item_id.replace(/^item_/, '').slice(0, 4)}
                </div>
                {stack.qty > 1 && <span style={{ lineHeight: 1 }}>{stack.qty}</span>}
              </>
            )}
          </div>
        ))}
      </div>

      {selectedStack && selectedItem && (
        <div style={styles.actionBar}>
          <div style={{ fontSize: 11, fontWeight: 600 }}>{selectedItem.name}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>
            {selectedItem.rarity} {selectedItem.category}
          </div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>{selectedItem.description}</div>
          <div style={styles.actionRow}>
            {selectedItem.equip_slot && (
              <button style={styles.button} onClick={handleEquip}>equip ({selectedItem.equip_slot})</button>
            )}
            {(() => {
              const eff = consumableEffects(selectedItem);
              if (eff.hp <= 0 && eff.energy <= 0) return null;
              const label = [
                eff.hp > 0 ? `+${eff.hp} hp` : null,
                eff.energy > 0 ? `+${eff.energy} energy` : null,
              ].filter(Boolean).join(' / ');
              return (
                <button style={styles.button} onClick={handleUse}>
                  use ({label})
                </button>
              );
            })()}
            <button style={styles.button} onClick={handleDrop}>drop</button>
          </div>
        </div>
      )}

      {equippedEntries.filter(([, v]) => v != null).length > 0 && (
        <>
          <div style={{ ...styles.title, marginTop: 10 }}>Equipped</div>
          {equippedEntries.map(([slot, stack]) => {
            if (!stack) return null;
            const item = lookup(stack.item_id);
            return (
              <div key={slot} style={styles.equipRow}>
                <span>{slot}: {item?.name ?? stack.item_id}</span>
                <button
                  style={{ ...styles.button, flex: 'none', padding: '1px 6px' }}
                  onClick={() => {
                    const r = unequip(inventory, equipment, slot, lookup);
                    if (r) {
                      engine.setInventory(r.inventory);
                      engine.setEquipment(r.equipment);
                    }
                  }}
                >
                  unequip
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
