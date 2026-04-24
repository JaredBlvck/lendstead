// EventBridge: exposes window.__lendsteadEmitEvent for components that
// live outside the React context tree (e.g. inside the Three.js canvas,
// where passing refs across the R3F boundary is awkward). The bridge
// routes incoming GameEvents to the quest engine, dispatches rewards,
// and updates inventory/world state.
//
// This is the ONLY window-side channel from the 3D world into engine
// state. Keep it narrow so we don't grow a parallel API surface.

import { useEffect } from 'react';
import { useEngine } from './EngineContext';
import { advanceOnEvent, completeQuest } from '../quests/questEngine';
import type { GameEvent } from '../quests/questObjectives';
import { addItem } from '../items/inventory';

declare global {
  interface Window {
    __lendsteadEmitEvent?: (event: GameEvent) => void;
    __lendsteadPickUp?: (itemId: string, qty?: number) => void;
  }
}

export function EventBridge() {
  const engine = useEngine();

  useEffect(() => {
    window.__lendsteadEmitEvent = (event: GameEvent) => {
      // Advance every active quest against the incoming event
      let updatedRuntime = engine.state.questRuntime;
      let world = engine.state.world;
      let inventory = engine.state.inventory;
      let autoCompleted = false;

      for (let i = 0; i < updatedRuntime.length; i++) {
        const row = updatedRuntime[i];
        if (row.status !== 'accepted' && row.status !== 'active') continue;
        const quest = engine.bundle.quests.get(row.quest_id);
        if (!quest) continue;
        const next = advanceOnEvent(quest, row, event);
        if (next === row) continue;
        updatedRuntime = [
          ...updatedRuntime.slice(0, i),
          next,
          ...updatedRuntime.slice(i + 1),
        ];

        // If the quest just flipped to completed, auto-apply rewards
        if (next.status === 'completed') {
          const result = completeQuest(quest, next, {
            world,
            inventory,
            itemLookup: engine.bundle.items.lookup,
          }, world.cycle);
          updatedRuntime = updatedRuntime.map((r) =>
            r.quest_id === next.quest_id ? result.runtime : r,
          );
          world = result.world;
          inventory = result.inventory;
          autoCompleted = true;
        }
      }

      if (updatedRuntime !== engine.state.questRuntime) {
        engine.setQuestRuntime(updatedRuntime);
      }
      if (autoCompleted) {
        engine.setWorld(world);
        engine.setInventory(inventory);
      }
    };

    window.__lendsteadPickUp = (itemId, qty = 1) => {
      // Tolerate unknown item ids: if the world tries to pick up a content
      // reference that is not (yet) registered, log and drop rather than
      // crashing the engine.
      if (!engine.bundle.items.has(itemId)) {
        // eslint-disable-next-line no-console
        console.warn(`__lendsteadPickUp: unknown item ${itemId}, skipped`);
        return;
      }
      const result = addItem(engine.state.inventory, itemId, qty, engine.bundle.items.lookup);
      engine.setInventory(result.inventory);
      // Emit a gather_item event so quests tracking this pickup advance
      window.__lendsteadEmitEvent?.({
        kind: 'gather_item',
        payload: { item_id: itemId, qty },
      });
    };

    return () => {
      delete window.__lendsteadEmitEvent;
      delete window.__lendsteadPickUp;
    };
  }, [engine]);

  return null;
}
