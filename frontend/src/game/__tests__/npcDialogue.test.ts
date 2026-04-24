import { describe, it, expect } from 'vitest';
import { pickDialogueState, resolveDialogue } from '../npcs/npcDialogue';
import { setFlag } from '../npcs/npcMemory';
import { npc_template_giver } from '../../content/npcs/_template';
import type { NpcRuntimeState } from '../npcs/npcTypes';

function baseState(): NpcRuntimeState {
  return {
    npc_id: 'npc_template_giver',
    movement_mode: 'idle',
    path: [],
    dialogue_state: 'neutral',
    memory_flags: [],
    relationship_with_player: 0,
    alive: true,
    schedule_phase: 0,
  };
}

describe('npcDialogue', () => {
  it('first_meeting wins when met_player flag absent', () => {
    const state = baseState();
    expect(pickDialogueState(npc_template_giver, state)).toBe('first_meeting');
  });

  it('quest_completed wins over everything else', () => {
    let state = setFlag(baseState(), 'met_player');
    state = { ...state, relationship_with_player: -0.9 };
    const picked = pickDialogueState(npc_template_giver, state, {
      completed_quests: ['quest_template_do_not_ship'],
    });
    expect(picked).toBe('quest_completed');
  });

  it('hostile fires when relationship drops to -0.5 with no active quest hooks', () => {
    let state = setFlag(baseState(), 'met_player');
    state = { ...state, relationship_with_player: -0.7 };
    const picked = pickDialogueState(npc_template_giver, state, {
      completed_quests: ['quest_template_do_not_ship'],
      active_quests: [],
    });
    // completed_quests wins per priority - make sure to test hostile with fresh quest_hook list
    expect(picked).toBe('quest_completed');

    // Test hostile path: no quest hooks in play
    const npcNoHooks = { ...npc_template_giver, quest_hooks: [] };
    const picked2 = pickDialogueState(npcNoHooks, state);
    expect(picked2).toBe('hostile');
  });

  it('friendly fires at relationship >= 0.5 with no quest hooks', () => {
    let state = setFlag(baseState(), 'met_player');
    state = { ...state, relationship_with_player: 0.7 };
    const npc = { ...npc_template_giver, quest_hooks: [] };
    expect(pickDialogueState(npc, state)).toBe('friendly');
  });

  it('quest_available fires when player has not accepted yet', () => {
    const state = setFlag(baseState(), 'met_player');
    expect(pickDialogueState(npc_template_giver, state)).toBe('quest_available');
  });

  it('resolveDialogue picks a line matching the state', () => {
    const state = baseState();
    const result = resolveDialogue(npc_template_giver, state);
    expect(result.state).toBe('first_meeting');
    expect(result.line?.id).toBe('line_first_hello');
    expect(result.nextMemoryFlag).toBe('met_player');
  });

  it('respects requires_reputation_at_least gating', () => {
    const state = setFlag(baseState(), 'met_player');
    // faction respected picks when rep>=0.6; but the line also requires rep>=0.6
    const result = resolveDialogue(npc_template_giver, state, { player_reputation: 0.7 });
    expect(result.state).toBe('faction_respected');
    expect(result.line?.id).toBe('line_faction_respected');
  });

  it('returns null line when no candidates match state+filters', () => {
    // State with no matching dialogue lines
    const state = setFlag(baseState(), 'met_player');
    const npcMinimal = {
      ...npc_template_giver,
      dialogue_lines: npc_template_giver.dialogue_lines.filter((l) => l.state === 'first_meeting'),
    };
    // 'met_player' set so first_meeting won't pick; state selected -> quest_available, no line -> null
    const result = resolveDialogue(npcMinimal, state);
    expect(result.line).toBeNull();
  });
});
