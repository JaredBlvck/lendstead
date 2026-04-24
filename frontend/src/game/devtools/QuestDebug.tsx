// Dev panel: inspect + force-advance quests.

import { useState } from 'react';
import type { QuestRegistry } from '../quests/questEngine';
import { availableQuests, startQuest, failQuest, completeQuest } from '../quests/questEngine';
import type { PlayerQuestState } from '../quests/questState';
import type { Quest, QuestRuntimeState } from '../quests/questTypes';
import type { WorldState } from '../world/worldState';
import type { Inventory } from '../items/itemTypes';
import type { ItemLookup } from '../items/inventory';
import { devStyles } from './devPanelStyles';

interface Props {
  registry: QuestRegistry;
  playerQuests: PlayerQuestState;
  world: WorldState;
  inventory: Inventory;
  itemLookup: ItemLookup;
  nowCycle: number;
  onStart: (runtime: QuestRuntimeState) => void;
  onComplete: (runtime: QuestRuntimeState, world: WorldState, inventory: Inventory, notes: string[]) => void;
  onFail: (runtime: QuestRuntimeState, world: WorldState) => void;
}

export function QuestDebug(props: Props) {
  const {
    registry, playerQuests, world, inventory, itemLookup, nowCycle,
    onStart, onComplete, onFail,
  } = props;
  const [selected, setSelected] = useState<Quest | null>(null);

  const available = availableQuests(registry, world, playerQuests.all());
  const active = playerQuests.active();
  const completed = playerQuests.completed();

  return (
    <div>
      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Available ({available.length})</div>
        {available.map((q) => (
          <div key={q.id} style={devStyles.row}>
            <span style={{ cursor: 'pointer' }} onClick={() => setSelected(q)}>{q.id}</span>
            <button
              style={devStyles.button}
              onClick={() => onStart(startQuest(q, 'player', nowCycle))}
            >
              start
            </button>
          </div>
        ))}
        {available.length === 0 && <div style={devStyles.muted}>(none offerable)</div>}
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Active ({active.length})</div>
        {active.map((r) => {
          const q = registry.get(r.quest_id);
          if (!q) return null;
          return (
            <div key={r.quest_id} style={{ ...devStyles.section, padding: 4, background: '#141a25', borderRadius: 4 }}>
              <div style={devStyles.row}>
                <span>{q.id}</span>
                <span style={devStyles.muted}>{r.status}</span>
              </div>
              {q.objectives.map((o) => {
                const p = r.objectives.find((x) => x.id === o.id)!;
                return (
                  <div key={o.id} style={devStyles.row}>
                    <span style={p.completed ? devStyles.good : {}}>{o.id}</span>
                    <span>{p.current}/{o.count}</span>
                  </div>
                );
              })}
              <button
                style={devStyles.button}
                onClick={() => {
                  const result = completeQuest(q, r, { world, inventory, itemLookup }, nowCycle);
                  onComplete(result.runtime, result.world, result.inventory, result.notes);
                }}
              >
                force complete
              </button>
              <button
                style={devStyles.button}
                onClick={() => {
                  const result = failQuest(r, world);
                  onFail(result.runtime, result.world);
                }}
              >
                fail
              </button>
            </div>
          );
        })}
        {active.length === 0 && <div style={devStyles.muted}>(none active)</div>}
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Completed ({completed.length})</div>
        {completed.map((r) => (
          <div key={r.quest_id} style={{ ...devStyles.row, ...devStyles.good }}>
            <span>{r.quest_id}</span>
            <span>cycle {r.completed_cycle}</span>
          </div>
        ))}
      </div>

      {selected && (
        <div style={devStyles.section}>
          <div style={devStyles.sectionTitle}>Selected: {selected.id}</div>
          <pre style={devStyles.pre}>{JSON.stringify(selected, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
