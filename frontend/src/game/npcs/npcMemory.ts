// NPC memory system. Pure helpers over NpcRuntimeState.memory_flags.
// Memory flags are free-form strings ('saw_player_at_ruins', 'player_refused_help')
// that dialogue lines and behavior logic can gate on. Content authors pick
// the flag strings; engine doesn't interpret them beyond presence.

import type { NpcRuntimeState } from './npcTypes';

export function hasFlag(state: NpcRuntimeState, flag: string): boolean {
  return state.memory_flags.includes(flag);
}

export function setFlag(state: NpcRuntimeState, flag: string): NpcRuntimeState {
  if (state.memory_flags.includes(flag)) return state;
  return { ...state, memory_flags: [...state.memory_flags, flag] };
}

export function clearFlag(state: NpcRuntimeState, flag: string): NpcRuntimeState {
  if (!state.memory_flags.includes(flag)) return state;
  return { ...state, memory_flags: state.memory_flags.filter((f) => f !== flag) };
}

export function adjustRelationship(state: NpcRuntimeState, delta: number): NpcRuntimeState {
  const next = Math.max(-1, Math.min(1, state.relationship_with_player + delta));
  return { ...state, relationship_with_player: next };
}
