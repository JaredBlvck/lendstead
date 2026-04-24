// The central Lendstead world-state object. Every major system reads from
// and mutates this via typed helpers. Save/load serializes this verbatim.
// Pure functions only - React state layer owns the "current" instance.

import { z } from 'zod';

export const WORLD_SCHEMA_VERSION = 1;

// Settlement progression tiers (Jared's directive Phase 10).
export const SettlementLevel = z.enum([
  'stranded_camp',
  'working_camp',
  'first_village',
  'fortified_village',
  'trade_settlement',
  'island_holdfast',
  'lendstead_seat',
]);
export type SettlementLevel = z.infer<typeof SettlementLevel>;

export const FactionReputation = z.object({
  faction_id: z.string().regex(/^faction_/),
  score: z.number().min(-1).max(1).default(0),       // -1 hated, +1 respected
  tier: z.enum(['hated', 'hostile', 'wary', 'neutral', 'liked', 'trusted', 'revered']).default('neutral'),
});
export type FactionReputation = z.infer<typeof FactionReputation>;

// A resource node on the world (fishing spot, mining rock, forageable grove).
// State changes over time - depleted nodes regenerate.
export const ResourceNode = z.object({
  id: z.string(),
  region_id: z.string().regex(/^region_/),
  location: z.object({ x: z.number(), y: z.number() }),
  kind: z.enum(['tree', 'rock', 'fishing', 'forage', 'ruin_chest']),
  drop_table_id: z.string().regex(/^drop_/).optional(),
  depleted: z.boolean().default(false),
  respawn_at_cycle: z.number().int().optional(),
});
export type ResourceNode = z.infer<typeof ResourceNode>;

// A discrete world event - weather, incursion, breakthrough.
export const WorldEvent = z.object({
  id: z.string(),
  kind: z.string(),                                   // e.g. 'storm', 'black_tide_raid', 'boat_arrives'
  started_at_cycle: z.number().int(),
  ends_at_cycle: z.number().int().optional(),
  region_id: z.string().optional(),
  severity: z.enum(['minor', 'major', 'catastrophic']).default('minor'),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type WorldEvent = z.infer<typeof WorldEvent>;

export const WorldState = z.object({
  schema_version: z.literal(WORLD_SCHEMA_VERSION),
  cycle: z.number().int().min(0).default(0),
  phase: z.enum(['dawn', 'morning', 'midday', 'evening', 'night']).default('morning'),
  population: z.number().int().min(0).default(1),
  food: z.number().min(0).default(0),
  water: z.number().min(0).default(0),
  morale: z.number().min(0).max(1).default(0.5),
  settlement_level: SettlementLevel.default('stranded_camp'),
  discovered_region_ids: z.array(z.string()).default([]),
  unlocked_region_ids: z.array(z.string()).default([]),
  unlocked_technologies: z.array(z.string()).default([]),
  infrastructure: z.record(z.string(), z.boolean()).default({}),    // 'smokehouse_built': true
  completed_quest_ids: z.array(z.string()).default([]),
  failed_quest_ids: z.array(z.string()).default([]),
  faction_reputation: z.array(FactionReputation).default([]),
  resource_nodes: z.array(ResourceNode).default([]),
  active_world_events: z.array(WorldEvent).default([]),
  historical_world_events: z.array(WorldEvent).default([]),
  world_flags: z.record(z.string(), z.boolean()).default({}),       // arbitrary content-driven flags
  roads_built_between: z.array(z.tuple([z.string(), z.string()])).default([]),   // [region_a, region_b]
  npc_deaths: z.array(z.string()).default([]),                       // npc ids that have died
});
export type WorldState = z.infer<typeof WorldState>;

// ---------- pure mutators ----------

export function advanceCycle(w: WorldState): WorldState {
  const phases: WorldState['phase'][] = ['dawn', 'morning', 'midday', 'evening', 'night'];
  const nextPhaseIdx = (phases.indexOf(w.phase) + 1) % phases.length;
  const nextCycle = nextPhaseIdx === 0 ? w.cycle + 1 : w.cycle;
  return { ...w, phase: phases[nextPhaseIdx], cycle: nextCycle };
}

export function unlockRegion(w: WorldState, regionId: string): WorldState {
  if (w.unlocked_region_ids.includes(regionId)) return w;
  return { ...w, unlocked_region_ids: [...w.unlocked_region_ids, regionId] };
}

export function discoverRegion(w: WorldState, regionId: string): WorldState {
  if (w.discovered_region_ids.includes(regionId)) return w;
  return { ...w, discovered_region_ids: [...w.discovered_region_ids, regionId] };
}

export function markQuestCompleted(w: WorldState, questId: string): WorldState {
  if (w.completed_quest_ids.includes(questId)) return w;
  return { ...w, completed_quest_ids: [...w.completed_quest_ids, questId] };
}

export function markQuestFailed(w: WorldState, questId: string): WorldState {
  if (w.failed_quest_ids.includes(questId)) return w;
  return { ...w, failed_quest_ids: [...w.failed_quest_ids, questId] };
}

export function setFlag(w: WorldState, key: string, value = true): WorldState {
  return { ...w, world_flags: { ...w.world_flags, [key]: value } };
}

export function setInfrastructure(w: WorldState, key: string, exists = true): WorldState {
  return { ...w, infrastructure: { ...w.infrastructure, [key]: exists } };
}

function tierForScore(score: number): FactionReputation['tier'] {
  if (score <= -0.75) return 'hated';
  if (score <= -0.4) return 'hostile';
  if (score <= -0.1) return 'wary';
  if (score < 0.1) return 'neutral';
  if (score < 0.4) return 'liked';
  if (score < 0.75) return 'trusted';
  return 'revered';
}

export function adjustFactionReputation(w: WorldState, factionId: string, delta: number): WorldState {
  const existing = w.faction_reputation.find((f) => f.faction_id === factionId);
  const score = Math.max(-1, Math.min(1, (existing?.score ?? 0) + delta));
  const tier = tierForScore(score);
  const next = existing
    ? w.faction_reputation.map((f) => (f.faction_id === factionId ? { ...f, score, tier } : f))
    : [...w.faction_reputation, { faction_id: factionId, score, tier }];
  return { ...w, faction_reputation: next };
}

export function getFactionReputation(w: WorldState, factionId: string): FactionReputation | undefined {
  return w.faction_reputation.find((f) => f.faction_id === factionId);
}

export function recordWorldEvent(w: WorldState, event: WorldEvent): WorldState {
  return { ...w, active_world_events: [...w.active_world_events, event] };
}

export function endWorldEvent(w: WorldState, eventId: string): WorldState {
  const active = w.active_world_events.filter((e) => e.id !== eventId);
  const ended = w.active_world_events.find((e) => e.id === eventId);
  const history = ended ? [...w.historical_world_events, ended] : w.historical_world_events;
  return { ...w, active_world_events: active, historical_world_events: history };
}

export function upgradeSettlement(w: WorldState, level: SettlementLevel): WorldState {
  const order: SettlementLevel[] = [
    'stranded_camp',
    'working_camp',
    'first_village',
    'fortified_village',
    'trade_settlement',
    'island_holdfast',
    'lendstead_seat',
  ];
  const current = order.indexOf(w.settlement_level);
  const target = order.indexOf(level);
  if (target <= current) return w;           // no downgrade, no redundant
  return { ...w, settlement_level: level };
}

export function recordNpcDeath(w: WorldState, npcId: string): WorldState {
  if (w.npc_deaths.includes(npcId)) return w;
  return { ...w, npc_deaths: [...w.npc_deaths, npcId] };
}

// Bootstrap a fresh world-state for a new game.
export function newWorldState(): WorldState {
  return {
    schema_version: WORLD_SCHEMA_VERSION,
    cycle: 0,
    phase: 'morning',
    population: 1,
    food: 0,
    water: 0,
    morale: 0.5,
    settlement_level: 'stranded_camp',
    discovered_region_ids: ['region_founding_shore'],
    unlocked_region_ids: ['region_founding_shore'],
    unlocked_technologies: [],
    infrastructure: {},
    completed_quest_ids: [],
    failed_quest_ids: [],
    faction_reputation: [],
    resource_nodes: [],
    active_world_events: [],
    historical_world_events: [],
    world_flags: {},
    roads_built_between: [],
    npc_deaths: [],
  };
}
