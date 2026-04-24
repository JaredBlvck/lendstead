// Dialogue modal - shows an NPC talking to the player, driven by
// resolveDialogue. Applies side-effect hints (set memory flag, change
// dialogue state, trigger quest) when the line is acknowledged.

import type { CSSProperties } from 'react';
import { useEngine } from '../engine/EngineContext';
import { resolveDialogue } from '../npcs/npcDialogue';
import { setFlag as setMemoryFlag } from '../npcs/npcMemory';
import type { NpcRuntimeState } from '../npcs/npcTypes';
import { startQuest } from '../quests/questEngine';
import { adjustFactionReputation } from '../world/worldState';

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1200,
  },
  panel: {
    width: 'min(720px, 94vw)',
    marginBottom: 24,
    background: 'rgba(10, 14, 20, 0.96)',
    color: '#e6edf7',
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    borderRadius: 10,
    border: '1px solid #2c3442',
    boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
    padding: 16,
  },
  speaker: { fontSize: 13, fontWeight: 700, letterSpacing: 0.4 },
  sub: { fontSize: 11, opacity: 0.6 },
  body: { fontSize: 14, lineHeight: 1.5, margin: '14px 0 10px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  btn: {
    background: '#2a4a6b',
    border: '1px solid #3d6ba0',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
  empty: { fontStyle: 'italic', opacity: 0.6 },
};

interface Props {
  npcId: string | null;
  onClose: () => void;
}

export function DialogueModal({ npcId, onClose }: Props) {
  const engine = useEngine();
  if (!npcId) return null;
  const npc = engine.bundle.npcs.get(npcId);
  if (!npc) return null;

  // Find or synthesize runtime state for this NPC
  let runtime = engine.state.npcRuntime.find((r) => r.npc_id === npcId);
  if (!runtime) {
    runtime = {
      npc_id: npc.id,
      movement_mode: npc.default_movement_mode,
      path: [],
      dialogue_state: npc.default_dialogue_state,
      memory_flags: [],
      relationship_with_player: 0,
      alive: true,
      schedule_phase: 0,
    };
  }

  // Resolve dialogue using current context
  const completedQuests = engine.state.world.completed_quest_ids;
  const activeQuests = engine.state.questRuntime
    .filter((r) => r.status === 'accepted' || r.status === 'active')
    .map((r) => r.quest_id);
  const factionRep = npc.faction_id
    ? engine.state.world.faction_reputation.find((f) => f.faction_id === npc.faction_id)?.score ?? 0
    : 0;

  const resolution = resolveDialogue(npc, runtime, {
    player_reputation: factionRep,
    completed_quests: completedQuests,
    active_quests: activeQuests,
  });

  const applyAndClose = () => {
    // Apply memory flag
    let nextRuntime: NpcRuntimeState = runtime!;
    if (resolution.nextMemoryFlag) {
      nextRuntime = setMemoryFlag(nextRuntime, resolution.nextMemoryFlag);
    }
    if (resolution.nextDialogueState) {
      nextRuntime = { ...nextRuntime, dialogue_state: resolution.nextDialogueState };
    }
    // Save NPC runtime
    const others = engine.state.npcRuntime.filter((r) => r.npc_id !== npcId);
    engine.setNpcRuntime([...others, nextRuntime]);

    // Trigger quest if the line said so
    if (resolution.triggersQuestId) {
      const quest = engine.bundle.quests.get(resolution.triggersQuestId);
      const already = engine.state.questRuntime.some((r) => r.quest_id === resolution.triggersQuestId);
      if (quest && !already) {
        engine.upsertQuestRuntime(startQuest(quest, engine.state.player.id, engine.state.world.cycle));
      }
    }

    // Bump faction reputation if this was a friendly/respected line
    if (npc.faction_id && (resolution.state === 'quest_completed' || resolution.state === 'friendly')) {
      engine.setWorld(adjustFactionReputation(engine.state.world, npc.faction_id, 0.02));
    }

    onClose();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.speaker}>{npc.name}</div>
        <div style={styles.sub}>{npc.role} - state: {resolution.state}</div>
        <div style={styles.body}>
          {resolution.line?.text ?? <span style={styles.empty}>{npc.name} says nothing.</span>}
        </div>
        <div style={styles.actions}>
          <button style={styles.btn} onClick={applyAndClose}>continue</button>
        </div>
      </div>
    </div>
  );
}
