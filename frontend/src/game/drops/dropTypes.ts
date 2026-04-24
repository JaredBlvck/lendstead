// Drop table schema. RuneScape-style: every source (creature, rock, tree,
// fishing spot, chest, boss) points at a drop_table_id. Rolling that table
// yields a list of {item_id, qty} pairs from:
//   - guaranteed_drops: always drop
//   - common_drops: weighted one-of pool, rolled each time
//   - uncommon_drops: weighted one-of pool, rolled only if common_chance misses
//   - rare_drops: weighted one-of pool, rolled only if uncommon_chance misses
//   - ultra_rare_drops: always checked independently with a tiny chance
// Modifiers from world state / player buffs shift rates up or down.

import { z } from 'zod';

export const DROP_SCHEMA_VERSION = 1;

export const DropSourceType = z.enum([
  'wildlife',
  'hostile_npc',
  'boss',
  'tree',
  'mining_rock',
  'fishing_spot',
  'ruin',
  'chest',
  'random_event',
  'quest_reward',
  'gather_node',
]);
export type DropSourceType = z.infer<typeof DropSourceType>;

// A single drop entry - specific item + qty range + weight
export const DropEntry = z.object({
  item_id: z.string().regex(/^item_/),
  min_qty: z.number().int().min(1).default(1),
  max_qty: z.number().int().min(1).default(1),
  weight: z.number().min(0).default(1),       // relative weight within its pool
});
export type DropEntry = z.infer<typeof DropEntry>;

// An independent-roll drop (for ultra_rare) with absolute probability
export const IndependentDrop = z.object({
  item_id: z.string().regex(/^item_/),
  min_qty: z.number().int().min(1).default(1),
  max_qty: z.number().int().min(1).default(1),
  chance: z.number().min(0).max(1),           // absolute per-roll probability
});
export type IndependentDrop = z.infer<typeof IndependentDrop>;

// A modifier that adjusts drop rates based on conditions in the world.
export const DropModifier = z.object({
  condition: z.string().min(1),               // free-form, interpreted by engine (e.g. 'quest_complete:quest_founder', 'biome:hollowmere')
  rare_chance_multiplier: z.number().min(0).default(1),
  ultra_rare_chance_multiplier: z.number().min(0).default(1),
  weight_boosts: z.record(z.string(), z.number()).default({}),   // item_id -> multiplier in its pool
});
export type DropModifier = z.infer<typeof DropModifier>;

export const DropTable = z.object({
  id: z.string().regex(/^drop_/, 'drop table id must start with drop_'),
  schema_version: z.literal(DROP_SCHEMA_VERSION),
  source_name: z.string().min(1),
  source_type: DropSourceType,
  region_id: z.string().regex(/^region_/).optional(),
  guaranteed_drops: z.array(DropEntry).default([]),
  common_drops: z.array(DropEntry).default([]),
  common_chance: z.number().min(0).max(1).default(0.75),   // probability the common pool rolls
  uncommon_drops: z.array(DropEntry).default([]),
  uncommon_chance: z.number().min(0).max(1).default(0.2),
  rare_drops: z.array(DropEntry).default([]),
  rare_chance: z.number().min(0).max(1).default(0.04),
  ultra_rare_drops: z.array(IndependentDrop).default([]),
  modifiers: z.array(DropModifier).default([]),
  notes: z.string().optional(),
});
export type DropTable = z.infer<typeof DropTable>;

// Runtime result of rolling a drop table - a flat list of granted items.
export interface RolledDrop {
  item_id: string;
  qty: number;
  pool: 'guaranteed' | 'common' | 'uncommon' | 'rare' | 'ultra_rare';
}
