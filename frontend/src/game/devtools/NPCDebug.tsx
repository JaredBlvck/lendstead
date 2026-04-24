// Dev panel: inspect NPC runtime states.

import { useState } from 'react';
import type { NpcRegistry } from '../npcs/npcRegistry';
import type { NpcRuntimeState, MovementMode, DialogueState } from '../npcs/npcTypes';
import { setFlag } from '../npcs/npcMemory';
import { devStyles } from './devPanelStyles';

interface Props {
  registry: NpcRegistry;
  runtime: NpcRuntimeState[];
  onChange: (next: NpcRuntimeState[]) => void;
}

const MODES: MovementMode[] = [
  'idle', 'wander', 'patrol', 'travel_to_job', 'travel_home', 'quest_target', 'flee', 'follow_player', 'blocked',
];

const DIALOGUE_STATES: DialogueState[] = [
  'first_meeting', 'neutral', 'friendly', 'hostile',
  'quest_available', 'quest_active', 'quest_completed',
  'after_world_event', 'secret_revealed', 'faction_respected', 'faction_hated',
];

export function NPCDebug({ registry, runtime, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string>(runtime[0]?.npc_id ?? '');

  const selected = runtime.find((r) => r.npc_id === selectedId);
  const selectedDef = selected ? registry.get(selected.npc_id) : undefined;

  const patch = (next: Partial<NpcRuntimeState>) => {
    if (!selected) return;
    onChange(runtime.map((r) => (r.npc_id === selected.npc_id ? { ...r, ...next } : r)));
  };

  return (
    <div>
      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>NPCs ({runtime.length})</div>
        <select
          style={devStyles.input}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {runtime.map((r) => (
            <option key={r.npc_id} value={r.npc_id}>
              {r.npc_id} ({r.movement_mode})
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          <div style={devStyles.section}>
            <div style={devStyles.sectionTitle}>{selectedDef?.name ?? selected.npc_id}</div>
            <div style={devStyles.row}>
              <span>alive</span>
              <span style={selected.alive ? devStyles.good : devStyles.warn}>{String(selected.alive)}</span>
            </div>
            <div style={devStyles.row}>
              <span>location</span>
              <span>
                {selected.current_location
                  ? `(${selected.current_location.x}, ${selected.current_location.y})`
                  : '(unset)'}
              </span>
            </div>
            <div style={devStyles.row}>
              <span>region</span><span>{selected.current_region_id ?? '(unknown)'}</span>
            </div>
            <div style={devStyles.row}>
              <span>path length</span><span>{selected.path.length}</span>
            </div>
            <div style={devStyles.row}>
              <span>player rel.</span><span>{selected.relationship_with_player.toFixed(2)}</span>
            </div>
          </div>

          <div style={devStyles.section}>
            <div style={devStyles.sectionTitle}>Movement mode</div>
            {MODES.map((mode) => (
              <button
                key={mode}
                style={{
                  ...devStyles.button,
                  ...(selected.movement_mode === mode ? { background: '#3d6ba0' } : {}),
                }}
                onClick={() => patch({ movement_mode: mode })}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={devStyles.section}>
            <div style={devStyles.sectionTitle}>Dialogue state</div>
            {DIALOGUE_STATES.map((ds) => (
              <button
                key={ds}
                style={{
                  ...devStyles.button,
                  ...(selected.dialogue_state === ds ? { background: '#3d6ba0' } : {}),
                }}
                onClick={() => patch({ dialogue_state: ds })}
              >
                {ds}
              </button>
            ))}
          </div>

          <div style={devStyles.section}>
            <div style={devStyles.sectionTitle}>Memory flags ({selected.memory_flags.length})</div>
            {selected.memory_flags.map((f) => (
              <div key={f} style={devStyles.row}>
                <span>{f}</span>
                <button
                  style={devStyles.button}
                  onClick={() => patch({ memory_flags: selected.memory_flags.filter((x) => x !== f) })}
                >
                  clear
                </button>
              </div>
            ))}
            <button
              style={devStyles.button}
              onClick={() => patch(setFlag(selected, `debug_flag_${Date.now()}`))}
            >
              add debug flag
            </button>
          </div>
        </>
      )}
    </div>
  );
}
