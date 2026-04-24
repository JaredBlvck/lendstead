// Per-kind objective progress handlers. An event comes in (player reached
// tile, collected item, talked to NPC); each active quest's matching
// objectives see the event and decide if it advances their counter.
// Pure functions - no state mutation outside the returned ObjectiveProgress.

import type { Quest, QuestObjective, QuestRuntimeState, ObjectiveProgress } from './questTypes';

// A typed event the engine emits to the quest system. Free-form payload
// because every objective kind uses it differently.
export interface GameEvent {
  kind:
    | 'reach_tile'
    | 'talk_to_npc'
    | 'gather_item'
    | 'deliver_item'
    | 'deliver_to_tile'
    | 'defeat_enemy'
    | 'survive_event'
    | 'ability_cast'
    | 'reach_skill'
    | 'faction_reputation'
    | 'infrastructure_built'
    | 'elapsed_cycles'
    | 'collect_carving';
  payload: Record<string, unknown>;
}

export function doesEventMatchObjective(
  obj: QuestObjective,
  event: GameEvent,
): boolean {
  if (obj.kind !== event.kind) return false;
  const target = obj.target as Record<string, unknown>;
  const p = event.payload;
  switch (obj.kind) {
    case 'reach_tile':
      return p.x === target.x && p.y === target.y;
    case 'talk_to_npc':
      return p.npc_id === target.npc_id;
    case 'gather_item':
    case 'deliver_item':
    case 'collect_carving':
      return p.item_id === target.item_id;
    case 'deliver_to_tile':
      return p.x === target.x && p.y === target.y && p.item_id === target.item_id;
    case 'defeat_enemy':
      return p.enemy_id === target.enemy_id;
    case 'survive_event':
      return p.event_kind === target.event_kind;
    case 'ability_cast':
      return p.ability_id === target.ability_id;
    case 'reach_skill':
      return p.skill === target.skill && Number(p.level ?? 0) >= Number(target.level ?? 0);
    case 'faction_reputation':
      return p.faction_id === target.faction_id && Number(p.score ?? 0) >= Number(target.score ?? 0);
    case 'infrastructure_built':
      return p.key === target.key;
    case 'elapsed_cycles':
      return true;
    default:
      return false;
  }
}

// Advance progress on the matching objectives in a runtime state.
export function applyEventToRuntime(
  quest: Quest,
  runtime: QuestRuntimeState,
  event: GameEvent,
): QuestRuntimeState {
  if (runtime.status !== 'accepted' && runtime.status !== 'active') return runtime;

  let changed = false;
  const nextObjectives: ObjectiveProgress[] = runtime.objectives.map((op) => {
    if (op.completed) return op;
    const obj = quest.objectives.find((o) => o.id === op.id);
    if (!obj) return op;
    if (!doesEventMatchObjective(obj, event)) return op;

    // Per-kind count semantics
    let inc = 1;
    if (event.kind === 'gather_item' || event.kind === 'deliver_item') {
      inc = Number(event.payload.qty ?? 1);
    }
    const current = Math.min(obj.count, op.current + inc);
    const completed = current >= obj.count;
    if (current !== op.current || completed !== op.completed) changed = true;
    return { ...op, current, completed };
  });

  if (!changed) return runtime;

  const allCompleted = quest.objectives
    .filter((o) => !o.hidden || nextObjectives.find((p) => p.id === o.id)?.current != null)
    .every((o) => nextObjectives.find((p) => p.id === o.id)?.completed);

  return {
    ...runtime,
    status: allCompleted ? 'completed' : 'active',
    objectives: nextObjectives,
  };
}
