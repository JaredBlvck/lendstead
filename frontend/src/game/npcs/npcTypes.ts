// NPC schema. Quad B authors NPC records in /src/content/npcs/ and they
// must validate against these zod schemas. NPC runtime (schedule/dialogue/
// memory/behavior) lives in the other files in this directory.

import { z } from 'zod';

export const NPC_SCHEMA_VERSION = 1;

// Movement behavior modes - matches what Jared specified in the directive.
export const MovementMode = z.enum([
  'idle',
  'wander',
  'patrol',
  'travel_to_job',
  'travel_home',
  'quest_target',
  'flee',
  'follow_player',
  'blocked',
]);
export type MovementMode = z.infer<typeof MovementMode>;

// Dialogue state - what branch of the NPC's dialogue tree to use.
export const DialogueState = z.enum([
  'first_meeting',
  'neutral',
  'friendly',
  'hostile',
  'quest_available',
  'quest_active',
  'quest_completed',
  'after_world_event',
  'secret_revealed',
  'faction_respected',
  'faction_hated',
]);
export type DialogueState = z.infer<typeof DialogueState>;

// Schedule entry: what an NPC does at a given cycle-phase of the day.
// Cycles are the game's abstract time unit; "phase" is a fraction within
// a cycle (morning, midday, evening, night). Content authors name phases.
export const ScheduleEntry = z.object({
  phase: z.enum(['dawn', 'morning', 'midday', 'evening', 'night']),
  location_id: z.string().min(1),          // region_ / tile ref or POI id
  activity: z.string().min(1),             // free-form, engine interprets (e.g. 'forage', 'sleep', 'patrol_ridge')
  duration_phases: z.number().int().min(1).default(1),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntry>;

// Relationship with another NPC or faction.
export const Relationship = z.object({
  target_id: z.string().min(1),
  kind: z.enum(['family', 'friend', 'rival', 'enemy', 'mentor', 'student', 'lover', 'faction_ally', 'faction_enemy']),
  strength: z.number().min(-1).max(1),    // -1 bitter enemies, +1 devoted bond
});
export type Relationship = z.infer<typeof Relationship>;

// A single line of dialogue - text + optional effects when spoken.
export const DialogueLine = z.object({
  id: z.string().regex(/^line_/),
  state: DialogueState,
  text: z.string().min(1),
  sets_memory_flag: z.string().optional(),      // free-form flag id
  requires_memory_flag: z.string().optional(),
  requires_reputation_at_least: z.number().optional(),   // reputation with this NPC's faction
  sets_dialogue_state: DialogueState.optional(),
  triggers_quest_id: z.string().regex(/^quest_/).optional(),
  shop_trigger: z.boolean().optional(),
  weight: z.number().min(0).default(1),          // for random selection within the same state
});
export type DialogueLine = z.infer<typeof DialogueLine>;

// Shop inventory entry - what the NPC sells or buys.
export const ShopEntry = z.object({
  item_id: z.string().regex(/^item_/),
  stock_qty: z.number().int().min(0).default(1),   // -1 would be infinite; use 9999 instead if needed
  buy_price: z.number().int().min(0).optional(),
  sell_price: z.number().int().min(0).optional(),
  restocks_every_cycles: z.number().int().min(1).optional(),
});
export type ShopEntry = z.infer<typeof ShopEntry>;

// Secrets - flavor info the player can unearth via memory flags or reputation.
export const NpcSecret = z.object({
  id: z.string().regex(/^secret_/),
  text: z.string().min(1),
  unlock_condition: z.string().min(1),   // free-form, interpreted by engine
});
export type NpcSecret = z.infer<typeof NpcSecret>;

// Personal goals - drive behavior (e.g., "build a boat", "find my sister").
export const PersonalGoal = z.object({
  id: z.string().regex(/^goal_/),
  text: z.string().min(1),
  progress_flag: z.string().optional(),
});
export type PersonalGoal = z.infer<typeof PersonalGoal>;

export const Npc = z.object({
  id: z.string().regex(/^npc_/, 'npc id must start with npc_'),
  schema_version: z.literal(NPC_SCHEMA_VERSION),
  name: z.string().min(1),
  role: z.string().min(1),                       // e.g., 'forager', 'scout captain', 'fisher'
  faction_id: z.string().regex(/^faction_/).optional(),
  home_region_id: z.string().regex(/^region_/).optional(),
  home_location: z.object({ x: z.number(), y: z.number() }).optional(),
  personality: z.string().min(1),                // free-form short tag string
  dialogue_style: z.string().min(1),
  schedule: z.array(ScheduleEntry).default([]),
  relationships: z.array(Relationship).default([]),
  quest_hooks: z.array(z.string().regex(/^quest_/)).default([]),
  dialogue_lines: z.array(DialogueLine).default([]),
  shop_inventory: z.array(ShopEntry).default([]),
  secrets: z.array(NpcSecret).default([]),
  personal_goals: z.array(PersonalGoal).default([]),
  default_movement_mode: MovementMode.default('idle'),
  default_dialogue_state: DialogueState.default('neutral'),
  tags: z.array(z.string()).default([]),
});
export type Npc = z.infer<typeof Npc>;

// Runtime state for a single NPC - tracks what save/load must persist.
export const NpcRuntimeState = z.object({
  npc_id: z.string(),
  current_location: z.object({ x: z.number(), y: z.number() }).optional(),
  current_region_id: z.string().optional(),
  movement_mode: MovementMode,
  path: z.array(z.object({ x: z.number(), y: z.number() })).default([]),
  target_location: z.object({ x: z.number(), y: z.number() }).optional(),
  dialogue_state: DialogueState,
  memory_flags: z.array(z.string()).default([]),
  relationship_with_player: z.number().min(-1).max(1).default(0),
  last_seen_cycle: z.number().int().optional(),
  alive: z.boolean().default(true),
  schedule_phase: z.number().int().default(0),   // index into schedule[]
});
export type NpcRuntimeState = z.infer<typeof NpcRuntimeState>;
