// Quest engine. Orchestrates quest lifecycle: offer, accept, progress,
// complete, fail. Pure functions over QuestRegistry + state.

import type { Quest, QuestRuntimeState, QuestPrerequisite } from './questTypes';
import type { WorldState } from '../world/worldState';
import { markQuestCompleted, markQuestFailed, getFactionReputation } from '../world/worldState';
import type { Inventory } from '../items/itemTypes';
import type { ItemLookup } from '../items/inventory';
import { applyEventToRuntime, type GameEvent } from './questObjectives';
import { applyQuestRewards } from './questRewards';

export class QuestRegistry {
  private byId = new Map<string, Quest>();

  register(q: Quest): void {
    if (this.byId.has(q.id)) throw new Error(`QuestRegistry: duplicate quest id ${q.id}`);
    this.byId.set(q.id, q);
  }

  registerMany(qs: Quest[]): void {
    for (const q of qs) this.register(q);
  }

  get(id: string): Quest | undefined {
    return this.byId.get(id);
  }

  getOrThrow(id: string): Quest {
    const q = this.byId.get(id);
    if (!q) throw new Error(`QuestRegistry: unknown quest ${id}`);
    return q;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): Quest[] {
    return Array.from(this.byId.values());
  }

  size(): number {
    return this.byId.size;
  }
}

// Check whether a prerequisite is satisfied by the current world state.
export function isPrerequisiteMet(p: QuestPrerequisite, world: WorldState): boolean {
  const params = p.params;
  switch (p.kind) {
    case 'completed_quest':
      return world.completed_quest_ids.includes(String(params.quest_id ?? ''));
    case 'cycle_at_least':
      return world.cycle >= Number(params.cycle ?? 0);
    case 'region_unlocked':
      return world.unlocked_region_ids.includes(String(params.region_id ?? ''));
    case 'faction_reputation_at_least': {
      const rep = getFactionReputation(world, String(params.faction_id ?? ''));
      return (rep?.score ?? 0) >= Number(params.score ?? 0);
    }
    case 'infrastructure_exists':
      return world.infrastructure[String(params.key ?? '')] === true;
    case 'flag_set':
      return world.world_flags[String(params.key ?? '')] === Boolean(params.value ?? true);
    case 'npc_skill_at_least':
      // Skill levels live outside world state for now - default false until wired.
      return false;
    default:
      return false;
  }
}

export function allPrerequisitesMet(quest: Quest, world: WorldState): boolean {
  return quest.prerequisites.every((p) => isPrerequisiteMet(p, world));
}

// Return quests from the registry that are offerable right now (prereqs
// met, not already accepted/completed).
export function availableQuests(
  registry: QuestRegistry,
  world: WorldState,
  playerQuestStates: QuestRuntimeState[],
): Quest[] {
  const acceptedOrDone = new Set(playerQuestStates.map((s) => s.quest_id));
  return registry.all().filter(
    (q) => !acceptedOrDone.has(q.id) && !world.completed_quest_ids.includes(q.id) && allPrerequisitesMet(q, world),
  );
}

export function startQuest(
  quest: Quest,
  playerId: string,
  nowCycle: number,
): QuestRuntimeState {
  return {
    quest_id: quest.id,
    status: 'accepted',
    player_id: playerId,
    accepted_cycle: nowCycle,
    objectives: quest.objectives.map((o) => ({
      id: o.id,
      current: 0,
      completed: false,
    })),
    choices_taken: [],
  };
}

export function advanceOnEvent(
  quest: Quest,
  runtime: QuestRuntimeState,
  event: GameEvent,
): QuestRuntimeState {
  return applyEventToRuntime(quest, runtime, event);
}

export function failQuest(
  runtime: QuestRuntimeState,
  world: WorldState,
): { runtime: QuestRuntimeState; world: WorldState } {
  return {
    runtime: { ...runtime, status: 'failed' },
    world: markQuestFailed(world, runtime.quest_id),
  };
}

export interface CompletionCtx {
  world: WorldState;
  inventory: Inventory;
  itemLookup: ItemLookup;
}

export interface CompletionOutcome {
  runtime: QuestRuntimeState;
  world: WorldState;
  inventory: Inventory;
  notes: string[];
}

// Apply rewards + persist world state markers when a quest is flagged
// 'completed' by the objective tracker. Caller decides whether to call
// this immediately on status=completed or to wait for a hand-in.
export function completeQuest(
  quest: Quest,
  runtime: QuestRuntimeState,
  ctx: CompletionCtx,
  nowCycle: number,
): CompletionOutcome {
  // Pull in any extra_rewards from choices the player took.
  const extraRewards = runtime.choices_taken
    .flatMap((choiceId) =>
      quest.choices.flatMap((c) =>
        c.options
          .filter((o) => o.id === choiceId)
          .flatMap((o) => o.extra_rewards),
      ),
    );
  const rewardOutcome = applyQuestRewards(ctx, quest, extraRewards);
  const worldWithMarker = markQuestCompleted(rewardOutcome.world, quest.id);
  return {
    runtime: { ...runtime, status: 'completed', completed_cycle: nowCycle },
    world: worldWithMarker,
    inventory: rewardOutcome.inventory,
    notes: rewardOutcome.notes,
  };
}

// Player picks a choice option at a specific objective. Mutates runtime to
// mark the completes_objectives as complete and add the choice id.
export function applyChoice(
  quest: Quest,
  runtime: QuestRuntimeState,
  choiceOptionId: string,
): QuestRuntimeState {
  const option = quest.choices
    .flatMap((c) => c.options)
    .find((o) => o.id === choiceOptionId);
  if (!option) return runtime;

  const nextObjectives = runtime.objectives.map((op) =>
    option.completes_objectives.includes(op.id)
      ? { ...op, current: op.current || 1, completed: true }
      : op,
  );

  return {
    ...runtime,
    choices_taken: [...runtime.choices_taken, choiceOptionId],
    objectives: nextObjectives,
  };
}
