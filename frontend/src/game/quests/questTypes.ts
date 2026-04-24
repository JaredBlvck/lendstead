// Quest schema - the contract between Quad A (engine) and Quad B (content).
// Every quest file in /src/content/quests/ must validate against these
// zod schemas. Schema version is bumped when breaking changes land; the
// migrations module handles older saves.

import { z } from 'zod';

export const QUEST_SCHEMA_VERSION = 1;

export const QuestCategory = z.enum([
  'main_story',
  'npc_personal',
  'faction',
  'exploration',
  'gathering',
  'crafting',
  'combat',
  'mystery',
  'moral_choice',
  'civilization',
  'hidden',
  'chain',
]);
export type QuestCategory = z.infer<typeof QuestCategory>;

// Objective - what the player must do to progress the quest. Each objective
// has a kind and kind-specific params. Engine matches events against the
// registered handler for that kind.
export const ObjectiveKind = z.enum([
  'reach_tile',              // walk to a tile or region
  'talk_to_npc',             // open dialog with a specific NPC
  'gather_item',             // accumulate N of an item
  'deliver_item',            // hand N of an item to an NPC
  'deliver_to_tile',         // drop N of an item at a tile
  'defeat_enemy',            // combat kill
  'survive_event',           // witness a specific event kind (e.g. storm_survived)
  'ability_cast',            // observe a specific ability cast (by leader)
  'reach_skill',             // NPC crosses skill threshold
  'faction_reputation',      // reach reputation tier
  'infrastructure_built',    // world.infrastructure key materialized
  'elapsed_cycles',          // N cycles pass since accept
  'collect_carving',         // archaeology-style: find discovery event of a kind
]);
export type ObjectiveKind = z.infer<typeof ObjectiveKind>;

export const QuestObjective = z.object({
  id: z.string().regex(/^obj_/),              // stable id within quest
  kind: ObjectiveKind,
  target: z.record(z.string(), z.unknown()),  // kind-specific params (flexible for content authoring)
  count: z.number().int().min(1).default(1),  // how many times the objective must be satisfied
  hidden: z.boolean().default(false),         // hide from quest log until a prior objective completes
  description: z.string().optional(),         // free-text shown to player when this is active
});
export type QuestObjective = z.infer<typeof QuestObjective>;

// Reward - what the player gets on completion. Multiple rewards allowed.
export const RewardKind = z.enum([
  'item',                  // grants an item to the player's inventory
  'faction_reputation',    // adjusts reputation
  'skill_xp',              // grants XP to an NPC's skill
  'unlock_region',         // sets region unlock flag
  'world_state_set',       // applies a world state patch
  'flavor_only',           // pure narrative, no mechanical effect
]);
export type RewardKind = z.infer<typeof RewardKind>;

export const QuestReward = z.object({
  kind: RewardKind,
  params: z.record(z.string(), z.unknown()),
});
export type QuestReward = z.infer<typeof QuestReward>;

// Prerequisite - what must be true before the quest is OFFERED to the player.
export const PrerequisiteKind = z.enum([
  'completed_quest',
  'npc_skill_at_least',
  'faction_reputation_at_least',
  'infrastructure_exists',
  'cycle_at_least',
  'region_unlocked',
  'flag_set',              // arbitrary boolean flag in save state
]);
export type PrerequisiteKind = z.infer<typeof PrerequisiteKind>;

export const QuestPrerequisite = z.object({
  kind: PrerequisiteKind,
  params: z.record(z.string(), z.unknown()),
});
export type QuestPrerequisite = z.infer<typeof QuestPrerequisite>;

// A branching choice - presented at a specific objective id, each choice
// leads to a different downstream path (objectives) or reward set.
export const QuestChoice = z.object({
  at_objective: z.string(),                    // which obj_ id triggers this choice
  options: z.array(z.object({
    id: z.string().regex(/^choice_/),
    label: z.string().min(1),
    moral_weight: z.number().min(-1).max(1).default(0),   // -1 harsh, +1 kind
    unlocks_objectives: z.array(z.string()).default([]),  // obj_ ids to activate
    completes_objectives: z.array(z.string()).default([]),// obj_ ids to auto-complete
    extra_rewards: z.array(QuestReward).default([]),
  })).min(1),
});
export type QuestChoice = z.infer<typeof QuestChoice>;

// The main Quest shape.
export const Quest = z.object({
  id: z.string().regex(/^quest_/, 'quest id must start with quest_'),
  schema_version: z.literal(QUEST_SCHEMA_VERSION),
  category: QuestCategory,
  title: z.string().min(1),
  summary: z.string().min(1),
  giver_npc_id: z.string().regex(/^npc_/).optional(),    // content-owned npc id
  region_id: z.string().regex(/^region_/).optional(),
  faction_id: z.string().regex(/^faction_/).optional(),
  prerequisites: z.array(QuestPrerequisite).default([]),
  objectives: z.array(QuestObjective).min(1),
  rewards: z.array(QuestReward).default([]),
  choices: z.array(QuestChoice).default([]),
  repeatable: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});
export type Quest = z.infer<typeof Quest>;

// Runtime quest state - what's tracked per player per quest as they progress.
export const QuestStatus = z.enum(['offered', 'accepted', 'active', 'completed', 'declined', 'failed']);
export type QuestStatus = z.infer<typeof QuestStatus>;

export const ObjectiveProgress = z.object({
  id: z.string(),
  current: z.number().int().min(0).default(0),
  completed: z.boolean().default(false),
});
export type ObjectiveProgress = z.infer<typeof ObjectiveProgress>;

export const QuestRuntimeState = z.object({
  quest_id: z.string(),
  status: QuestStatus,
  player_id: z.string(),
  accepted_cycle: z.number().int().optional(),
  completed_cycle: z.number().int().optional(),
  objectives: z.array(ObjectiveProgress),
  choices_taken: z.array(z.string()).default([]),     // choice_ ids the player picked
});
export type QuestRuntimeState = z.infer<typeof QuestRuntimeState>;
