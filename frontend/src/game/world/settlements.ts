// Settlement progression rules. A settlement advances when it satisfies
// the requirements of the next level. Pure predicates over WorldState.

import type { WorldState } from './worldState';
import type { SettlementLevel } from './worldState';

export interface SettlementRequirements {
  level: SettlementLevel;
  population_at_least?: number;
  food_at_least?: number;
  water_at_least?: number;
  morale_at_least?: number;
  required_infrastructure?: string[];
  required_world_flags?: string[];
  required_completed_quests?: string[];
  unlocks_infrastructure?: string[];
  unlocks_quest_ids?: string[];
}

// Default canonical progression requirements - Quad B can extend this
// through content additions before calling into these functions.
export const DEFAULT_SETTLEMENT_RULES: SettlementRequirements[] = [
  { level: 'stranded_camp' },
  {
    level: 'working_camp',
    population_at_least: 3,
    food_at_least: 20,
    required_infrastructure: ['campfire_built'],
  },
  {
    level: 'first_village',
    population_at_least: 8,
    food_at_least: 60,
    water_at_least: 40,
    required_infrastructure: ['shelter_cluster_built'],
  },
  {
    level: 'fortified_village',
    population_at_least: 15,
    morale_at_least: 0.6,
    required_infrastructure: ['palisade_built'],
  },
  {
    level: 'trade_settlement',
    population_at_least: 25,
    food_at_least: 200,
    required_infrastructure: ['market_built', 'dock_built'],
  },
  {
    level: 'island_holdfast',
    population_at_least: 50,
    required_infrastructure: ['keep_built'],
    required_world_flags: ['black_tide_defeated'],
  },
  {
    level: 'lendstead_seat',
    population_at_least: 120,
    morale_at_least: 0.75,
    required_infrastructure: ['council_hall_built'],
    required_world_flags: ['crownfall_sealed'],
  },
];

export function canAdvanceTo(
  w: WorldState,
  reqs: SettlementRequirements,
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (reqs.population_at_least != null && w.population < reqs.population_at_least) {
    missing.push(`population < ${reqs.population_at_least}`);
  }
  if (reqs.food_at_least != null && w.food < reqs.food_at_least) {
    missing.push(`food < ${reqs.food_at_least}`);
  }
  if (reqs.water_at_least != null && w.water < reqs.water_at_least) {
    missing.push(`water < ${reqs.water_at_least}`);
  }
  if (reqs.morale_at_least != null && w.morale < reqs.morale_at_least) {
    missing.push(`morale < ${reqs.morale_at_least}`);
  }
  for (const key of reqs.required_infrastructure ?? []) {
    if (!w.infrastructure[key]) missing.push(`infrastructure:${key}`);
  }
  for (const flag of reqs.required_world_flags ?? []) {
    if (!w.world_flags[flag]) missing.push(`flag:${flag}`);
  }
  for (const quest of reqs.required_completed_quests ?? []) {
    if (!w.completed_quest_ids.includes(quest)) missing.push(`quest:${quest}`);
  }
  return { ok: missing.length === 0, missing };
}

// Scan forward through the progression table and return the highest level
// the current world state could achieve right now.
export function maxAchievableSettlement(
  w: WorldState,
  rules: SettlementRequirements[] = DEFAULT_SETTLEMENT_RULES,
): SettlementLevel {
  let best: SettlementLevel = rules[0].level;
  for (const rule of rules) {
    const res = canAdvanceTo(w, rule);
    if (res.ok) best = rule.level;
    else break;
  }
  return best;
}
