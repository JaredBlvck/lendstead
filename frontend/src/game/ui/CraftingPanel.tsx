// Crafting panel. Lists every recipe the player could attempt (based on
// the ItemRegistry), shows ingredient availability, and invokes craftItem.

import { useState, type CSSProperties } from 'react';
import { useEngine } from '../engine/EngineContext';
import { craftItem, listCraftable, type CraftableEntry } from '../items/crafting';

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    width: 320,
    maxHeight: '70vh',
    overflowY: 'auto',
    background: 'rgba(10, 14, 20, 0.94)',
    color: '#e6edf7',
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    fontSize: 11,
    borderRadius: 8,
    border: '1px solid #2c3442',
    zIndex: 901,
    padding: 10,
  },
  title: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7, marginBottom: 6 },
  station: {
    display: 'flex',
    gap: 4,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  stationButton: {
    padding: '3px 8px',
    background: '#1b2230',
    border: '1px solid #2c3442',
    borderRadius: 4,
    color: '#bac6d9',
    cursor: 'pointer',
    fontSize: 10,
  },
  stationActive: {
    background: '#2a4a6b',
    borderColor: '#3d6ba0',
    color: '#fff',
  },
  recipe: {
    padding: 6,
    marginBottom: 6,
    background: '#141a25',
    borderRadius: 4,
  },
  ingredient: { display: 'flex', justifyContent: 'space-between', fontSize: 10 },
  bad: { color: '#f5a623' },
  good: { color: '#7bd88f' },
  button: {
    marginTop: 4,
    padding: '3px 10px',
    background: '#2a4a6b',
    border: '1px solid #3d6ba0',
    color: '#fff',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
  },
  disabled: {
    background: '#202731',
    borderColor: '#2c3442',
    color: '#8aa4c4',
    cursor: 'not-allowed',
  },
};

interface Props {
  onClose?: () => void;
}

export function CraftingPanel({ onClose }: Props) {
  const engine = useEngine();
  const [station, setStation] = useState<string>('campfire');
  const [note, setNote] = useState<string>('');

  const allItems = engine.bundle.items.all();
  const stations = Array.from(
    new Set(allItems.flatMap((i) => i.crafting_recipes.map((r) => r.station))),
  ).sort();

  const craftable = listCraftable(allItems, {
    inventory: engine.state.inventory,
    itemLookup: engine.bundle.items.lookup,
    station,
  });

  const attemptCraft = (entry: CraftableEntry) => {
    const result = craftItem(entry.item, entry.recipe, {
      inventory: engine.state.inventory,
      itemLookup: engine.bundle.items.lookup,
      station,
    });
    if (result.ok) {
      engine.setInventory(result.inventory);
      setNote(`crafted ${result.produced_qty}x ${entry.item.name}`);
      // Emit a gather_item event so quests tracking crafted output advance
      window.__lendsteadEmitEvent?.({
        kind: 'gather_item',
        payload: { item_id: entry.item.id, qty: result.produced_qty },
      });
    } else {
      setNote(result.reason);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={{ ...styles.title, display: 'flex', justifyContent: 'space-between' }}>
        <span>Crafting ({station})</span>
        {onClose && (
          <button style={{ ...styles.button, padding: '1px 6px' }} onClick={onClose}>
            close
          </button>
        )}
      </div>

      {stations.length > 1 && (
        <div style={styles.station}>
          {stations.map((s) => (
            <button
              key={s}
              style={{ ...styles.stationButton, ...(s === station ? styles.stationActive : {}) }}
              onClick={() => setStation(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {craftable.length === 0 && (
        <div style={{ opacity: 0.6 }}>
          No recipes at this station. Try a different one.
        </div>
      )}

      {craftable.map((entry) => {
        const canCraft = entry.missing.length === 0 && !entry.skill_gap;
        return (
          <div key={`${entry.item.id}_${entry.station}`} style={styles.recipe}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>
              {entry.item.name} x{entry.recipe.produces_qty}
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>
              {entry.item.rarity} {entry.item.category}
            </div>
            {entry.recipe.ingredients.map((ing) => {
              const have = engine.state.inventory.stacks
                .filter((s) => s.item_id === ing.item_id)
                .reduce((a, s) => a + s.qty, 0);
              const enough = have >= ing.qty;
              return (
                <div
                  key={ing.item_id}
                  style={{ ...styles.ingredient, ...(enough ? styles.good : styles.bad) }}
                >
                  <span>{ing.item_id}</span>
                  <span>{have}/{ing.qty}</span>
                </div>
              );
            })}
            {entry.skill_gap && (
              <div style={styles.bad}>
                requires {entry.skill_gap.skill} {entry.skill_gap.required} (you are {entry.skill_gap.current})
              </div>
            )}
            <button
              style={{ ...styles.button, ...(canCraft ? {} : styles.disabled) }}
              onClick={() => canCraft && attemptCraft(entry)}
              disabled={!canCraft}
            >
              craft
            </button>
          </div>
        );
      })}

      {note && (
        <div style={{ marginTop: 8, fontSize: 10, opacity: 0.8 }}>{note}</div>
      )}
    </div>
  );
}
