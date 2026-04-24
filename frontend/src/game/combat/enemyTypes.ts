// Enemy schema. Hostile entities the player engages in combat. Authored
// by Quad B in /src/content/enemies/ per Content Bible lore (predator
// packs at Ironback Ridge, sea-raiders in v2, Source-custodians as
// future lane). Engine-owned runtime here; content stays in content/.
//
// Backend already emits threat_sighted events (Content Bible v1 §7).
// The encounter host matches those events to enemies whose
// spawns_on_threat matches severity + region.

import { z } from 'zod';

export const ENEMY_SCHEMA_VERSION = 1;

// Combat archetype - loose tag, not a hard gameplay divider. Content
// authors use it to signal intent; UI can style accordingly.
export const EnemyArchetype = z.enum([
  'predator',      // wolves, bears, boars
  'raider',        // human / humanoid hostiles
  'scavenger',     // opportunists picking at the weak
  'construct',     // non-living: stone guardians, clockworks
  'spirit',        // magical / source-bound entities
  'swarm',         // rat-packs, bird flocks
]);
export type EnemyArchetype = z.infer<typeof EnemyArchetype>;

// A single ability an enemy can use in combat. Keep flat for now;
// richer ability trees can layer on later.
export const EnemyAbility = z.object({
  id: z.string().regex(/^ability_/),
  name: z.string().min(1),
  damage_bonus: z.number().default(0),
  cooldown_rounds: z.number().int().min(0).default(0),
  description: z.string().optional(),
});
export type EnemyAbility = z.infer<typeof EnemyAbility>;

// Spawn condition - when this enemy can appear. threat_sighted events
// carry severity + center coordinates; enemies list which severities
// they can spawn on and which regions they inhabit.
export const EnemySpawnRule = z.object({
  on_threat_severity: z.array(z.enum(['minor', 'major', 'catastrophic'])).default(['minor']),
  region_ids: z.array(z.string().regex(/^region_/)).default([]),
  min_settlement_level: z.enum([
    'stranded_camp',
    'working_camp',
    'first_village',
    'fortified_village',
    'trade_settlement',
    'island_holdfast',
    'lendstead_seat',
  ]).optional(),
});
export type EnemySpawnRule = z.infer<typeof EnemySpawnRule>;

export const Enemy = z.object({
  id: z.string().regex(/^enemy_/, 'enemy id must start with enemy_'),
  schema_version: z.literal(ENEMY_SCHEMA_VERSION),
  name: z.string().min(1),
  archetype: EnemyArchetype,
  description: z.string().min(1),

  // Core combat stats
  max_hp: z.number().int().min(1),
  attack: z.number().int().min(0),
  defense: z.number().int().min(0),
  crit_chance: z.number().min(0).max(1).default(0.1),
  dodge_chance: z.number().min(0).max(1).default(0.05),
  level: z.number().int().min(1).default(1),

  // Abilities - optional moves the enemy can use in addition to basic attack
  abilities: z.array(EnemyAbility).default([]),

  // Spawning
  spawn: EnemySpawnRule.default({ on_threat_severity: ['minor'], region_ids: [] }),

  // Loot
  drop_table_id: z.string().regex(/^drop_/).optional(),

  // Flavor
  fleeable: z.boolean().default(true),              // can the player flee this fight
  aggression: z.enum(['passive', 'reactive', 'aggressive']).default('reactive'),
  tags: z.array(z.string()).default([]),
});
export type Enemy = z.infer<typeof Enemy>;

// Runtime state of a live encounter. Not persisted across sessions -
// encounters resolve or flee within a single play session.
export interface EncounterState {
  enemy_id: string;
  enemy_hp: number;
  enemy_max_hp: number;
  player_hp: number;
  player_max_hp: number;
  round: number;
  log: string[];
  outcome: 'in_progress' | 'victory' | 'defeat' | 'fled';
  rewards?: Array<{ item_id: string; qty: number }>;
  // Cooldown tracker per enemy ability id. Absent or 0 = ready.
  enemy_ability_cooldowns?: Record<string, number>;
}
