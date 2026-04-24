// NPC dialogue runtime. Given an NPC definition + runtime state + context
// (player reputation, triggered events), select an appropriate DialogueLine.
// Pure function - no side effects.

import type { DialogueLine, DialogueState, Npc, NpcRuntimeState } from './npcTypes';
import { hasFlag } from './npcMemory';

export interface DialogueContext {
  player_reputation?: number;                 // with this NPC's faction, -1..+1
  completed_quests?: string[];                // quest ids the player has finished
  active_quests?: string[];                   // quest ids the player has active
  world_event_flags?: string[];               // free-form global flags
  random?: () => number;                      // override RNG for tests
}

// Pick a state for the NPC given context. Order of precedence matters -
// higher-priority states (quest_completed, quest_active, quest_available)
// win over neutral/friendly state.
export function pickDialogueState(
  npc: Npc,
  state: NpcRuntimeState,
  ctx: DialogueContext = {},
): DialogueState {
  const completed = new Set(ctx.completed_quests ?? []);
  const active = new Set(ctx.active_quests ?? []);

  for (const questId of npc.quest_hooks) {
    if (completed.has(questId)) return 'quest_completed';
    if (active.has(questId)) return 'quest_active';
  }

  // First meeting takes priority once, flipped by setting 'met_player' memory
  if (!hasFlag(state, 'met_player')) return 'first_meeting';

  // Faction reputation flips at tier boundaries
  const rep = ctx.player_reputation ?? 0;
  if (rep <= -0.5) return 'faction_hated';
  if (rep >= 0.6) return 'faction_respected';

  // Personal reputation (per-NPC) flips friendly/hostile
  if (state.relationship_with_player <= -0.5) return 'hostile';
  if (state.relationship_with_player >= 0.5) return 'friendly';

  // Quest-available only if any quest_hook isn't in progress/done
  const hasOfferable = npc.quest_hooks.some((q) => !active.has(q) && !completed.has(q));
  if (hasOfferable) return 'quest_available';

  return state.dialogue_state ?? 'neutral';
}

// Filter candidate lines by selected state + memory/reputation gates,
// then weighted-random pick.
export function pickDialogueLine(
  npc: Npc,
  state: NpcRuntimeState,
  pickedState: DialogueState,
  ctx: DialogueContext = {},
): DialogueLine | null {
  const rng = ctx.random ?? Math.random;

  const candidates = npc.dialogue_lines.filter((line) => {
    if (line.state !== pickedState) return false;
    if (line.requires_memory_flag && !hasFlag(state, line.requires_memory_flag)) return false;
    if (line.requires_reputation_at_least != null) {
      const rep = ctx.player_reputation ?? 0;
      if (rep < line.requires_reputation_at_least) return false;
    }
    return true;
  });
  if (candidates.length === 0) return null;

  const total = candidates.reduce((s, l) => s + l.weight, 0);
  if (total <= 0) return candidates[0];
  let r = rng() * total;
  for (const line of candidates) {
    r -= line.weight;
    if (r <= 0) return line;
  }
  return candidates[candidates.length - 1];
}

// Convenience wrapper used by the engine: pick state, pick line, return
// both plus any side-effect hints the caller should apply.
export interface DialogueResolution {
  state: DialogueState;
  line: DialogueLine | null;
  nextMemoryFlag?: string;
  nextDialogueState?: DialogueState;
  triggersQuestId?: string;
}

export function resolveDialogue(
  npc: Npc,
  state: NpcRuntimeState,
  ctx: DialogueContext = {},
): DialogueResolution {
  const picked = pickDialogueState(npc, state, ctx);
  const line = pickDialogueLine(npc, state, picked, ctx);
  return {
    state: picked,
    line,
    nextMemoryFlag: line?.sets_memory_flag,
    nextDialogueState: line?.sets_dialogue_state,
    triggersQuestId: line?.triggers_quest_id,
  };
}
