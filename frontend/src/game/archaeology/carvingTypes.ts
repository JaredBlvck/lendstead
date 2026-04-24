// Discovery / carving schema. A DiscoverySite is a location the player
// can inspect to reveal hidden lore + a fragment item. Closes the
// collect_carving objective kind used by Quad B's third_carving
// v8.4 migration and future archaeology quests.
//
// Bible alignment: carvings exist at the Deepening + Ironback Ridge
// (Bible §7 regions). Reveal conditions can gate on world state /
// skill / faction rep so the same site yields different lore as the
// player grows.

import { z } from 'zod';

export const DISCOVERY_SCHEMA_VERSION = 1;

// Each discovery is a kind of thing the player can find
export const DiscoveryKind = z.enum([
  'carving',          // ancient stone inscriptions
  'relic',            // recovered object of Source significance
  'ruin_chest',       // physical cache
  'herb_cluster',     // botanical discovery
  'ore_seam',         // mineral discovery
]);
export type DiscoveryKind = z.infer<typeof DiscoveryKind>;

// Gating condition. Same shape as QuestPrerequisite but scoped to the
// handful of checks archaeology needs.
export const DiscoveryCondition = z.object({
  kind: z.enum([
    'always',
    'world_flag',               // a world_flags key must be true
    'faction_reputation_at_least',
    'settlement_level',
    'completed_quest',
  ]),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type DiscoveryCondition = z.infer<typeof DiscoveryCondition>;

export const DiscoverySite = z.object({
  id: z.string().regex(/^site_/, 'discovery site id must start with site_'),
  schema_version: z.literal(DISCOVERY_SCHEMA_VERSION),
  title: z.string().min(1),
  kind: DiscoveryKind,
  region_id: z.string().regex(/^region_/),
  tile: z.object({ x: z.number().int(), y: z.number().int() }),
  lore_text: z.string().min(1),
  reveals_item_id: z.string().regex(/^item_/).optional(),
  reveal_chance: z.number().min(0).max(1).default(1),
  // Once revealed, this condition must be true for the site to offer
  // its lore; otherwise inspect returns "you find nothing new".
  reveal_condition: DiscoveryCondition.default({ kind: 'always', params: {} }),
  // If true, the site can only be inspected once per player - later
  // inspections return cached lore without granting the fragment again.
  one_shot: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});
export type DiscoverySite = z.infer<typeof DiscoverySite>;

// Runtime state per player per site - did they already reveal it
export const DiscoveryState = z.object({
  site_id: z.string(),
  revealed: z.boolean().default(false),
  revealed_at_cycle: z.number().int().optional(),
  inspections: z.number().int().min(0).default(0),
});
export type DiscoveryState = z.infer<typeof DiscoveryState>;
