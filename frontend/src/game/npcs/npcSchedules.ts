// NPC schedule runtime. Given the current world phase, decide what the NPC
// should be doing (location + activity) and drive the movement_mode
// accordingly.

import type { Npc, NpcRuntimeState, ScheduleEntry } from './npcTypes';

export type DayPhase = ScheduleEntry['phase'];

export function currentScheduleEntry(
  npc: Npc,
  phase: DayPhase,
): ScheduleEntry | null {
  if (npc.schedule.length === 0) return null;
  const direct = npc.schedule.find((e) => e.phase === phase);
  if (direct) return direct;
  // Fall back to the first entry if no exact match (e.g., one entry covers all day)
  return npc.schedule[0];
}

// Advance the runtime state based on current phase. Does not move the NPC
// this tick - that's the behavior layer's job. Just sets the intended
// target_location + picks a movement_mode.
export function applySchedule(
  npc: Npc,
  state: NpcRuntimeState,
  phase: DayPhase,
  locationLookup?: (locationId: string) => { x: number; y: number } | undefined,
): NpcRuntimeState {
  const entry = currentScheduleEntry(npc, phase);
  if (!entry) return state;

  const target = locationLookup?.(entry.location_id) ?? state.target_location;
  if (!target) return state;

  const atTarget = state.current_location
    && state.current_location.x === target.x
    && state.current_location.y === target.y;

  let movement_mode: NpcRuntimeState['movement_mode'];
  if (atTarget) {
    // At destination - activity drives idle vs wander
    movement_mode = entry.activity === 'sleep' || entry.activity === 'rest' ? 'idle' : 'wander';
  } else {
    // Need to travel there
    movement_mode = entry.activity === 'sleep' ? 'travel_home' : 'travel_to_job';
  }

  return {
    ...state,
    target_location: target,
    movement_mode,
  };
}
