// World event system. Content files declare event templates (kind, trigger
// conditions, payload). The runtime spawns active event instances and applies
// their effects.

import { z } from 'zod';
import type { WorldEvent, WorldState } from './worldState';
import { recordWorldEvent, endWorldEvent } from './worldState';

export const WORLD_EVENT_SCHEMA_VERSION = 1;

// A template that content files author. At runtime the engine can spawn
// instances of these matching triggers.
export const WorldEventTemplate = z.object({
  id: z.string(),
  schema_version: z.literal(WORLD_EVENT_SCHEMA_VERSION),
  kind: z.string().min(1),                             // e.g. 'storm', 'black_tide_raid'
  name: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['minor', 'major', 'catastrophic']).default('minor'),
  trigger: z.object({
    kind: z.enum(['cycle_interval', 'morale_below', 'settlement_level', 'world_flag', 'manual']),
    params: z.record(z.string(), z.unknown()).default({}),
  }),
  applies_to_region_id: z.string().optional(),
  effects: z.array(z.object({
    kind: z.enum([
      'food_delta',
      'water_delta',
      'morale_delta',
      'population_delta',
      'set_flag',
      'set_infrastructure',
      'unlock_region',
      'faction_reputation_delta',
    ]),
    params: z.record(z.string(), z.unknown()).default({}),
  })).default([]),
  duration_cycles: z.number().int().min(0).default(0),   // 0 = instant
  tags: z.array(z.string()).default([]),
});
export type WorldEventTemplate = z.infer<typeof WorldEventTemplate>;

// Apply a single event effect to world state (pure).
export function applyEventEffect(
  w: WorldState,
  effect: WorldEventTemplate['effects'][number],
): WorldState {
  const p = effect.params;
  switch (effect.kind) {
    case 'food_delta':
      return { ...w, food: Math.max(0, w.food + Number(p.delta ?? 0)) };
    case 'water_delta':
      return { ...w, water: Math.max(0, w.water + Number(p.delta ?? 0)) };
    case 'morale_delta':
      return { ...w, morale: Math.max(0, Math.min(1, w.morale + Number(p.delta ?? 0))) };
    case 'population_delta':
      return { ...w, population: Math.max(0, w.population + Number(p.delta ?? 0)) };
    case 'set_flag':
      return { ...w, world_flags: { ...w.world_flags, [String(p.key)]: Boolean(p.value ?? true) } };
    case 'set_infrastructure':
      return { ...w, infrastructure: { ...w.infrastructure, [String(p.key)]: Boolean(p.value ?? true) } };
    case 'unlock_region': {
      const regionId = String(p.region_id ?? '');
      if (!regionId || w.unlocked_region_ids.includes(regionId)) return w;
      return { ...w, unlocked_region_ids: [...w.unlocked_region_ids, regionId] };
    }
    case 'faction_reputation_delta': {
      const factionId = String(p.faction_id ?? '');
      const delta = Number(p.delta ?? 0);
      if (!factionId) return w;
      const existing = w.faction_reputation.find((f) => f.faction_id === factionId);
      const score = Math.max(-1, Math.min(1, (existing?.score ?? 0) + delta));
      const next = existing
        ? w.faction_reputation.map((f) => (f.faction_id === factionId ? { ...f, score } : f))
        : [...w.faction_reputation, { faction_id: factionId, score, tier: 'neutral' as const }];
      return { ...w, faction_reputation: next };
    }
    default:
      return w;
  }
}

// Spawn an active event instance (applies immediate effects if duration=0).
export function spawnWorldEvent(
  w: WorldState,
  template: WorldEventTemplate,
  nowCycle: number,
): WorldState {
  const event: WorldEvent = {
    id: `${template.id}_${nowCycle}`,
    kind: template.kind,
    started_at_cycle: nowCycle,
    ends_at_cycle: template.duration_cycles > 0 ? nowCycle + template.duration_cycles : nowCycle,
    region_id: template.applies_to_region_id,
    severity: template.severity,
    payload: { template_id: template.id },
  };
  let world = w;
  for (const effect of template.effects) {
    world = applyEventEffect(world, effect);
  }
  if (template.duration_cycles <= 0) {
    // One-shot: don't add to active list - just move to history
    return {
      ...world,
      historical_world_events: [...world.historical_world_events, event],
    };
  }
  return recordWorldEvent(world, event);
}

// Tick active events - end any whose ends_at_cycle has passed.
export function tickWorldEvents(w: WorldState): WorldState {
  const expired = w.active_world_events.filter((e) => e.ends_at_cycle != null && e.ends_at_cycle <= w.cycle);
  let world = w;
  for (const e of expired) {
    world = endWorldEvent(world, e.id);
  }
  return world;
}

export function validateWorldEventTemplate(input: unknown): {
  ok: boolean;
  data?: WorldEventTemplate;
  errors: string[];
} {
  const parsed = WorldEventTemplate.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { ok: true, data: parsed.data, errors: [] };
}
