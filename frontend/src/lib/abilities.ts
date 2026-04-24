// Ability-event → VFX descriptor mapping. Pulls ability kind + target
// data from backend event payload and returns a lightweight shape the
// renderer consumes. Kept in a lib so both 3D and 2D layers can reuse.

import type { CycleEvent, AbilityName } from '../types';

export interface AbilityVFX {
  eventId: number;
  leader: 'sr' | 'jr';
  kind: AbilityName;
  cycle: number;
  seenAt: number;
  target_data: Record<string, unknown>;
  lifespanMs: number;
}

// How long the VFX renders client-side, regardless of backend duration
// (backend duration drives actual effect, frontend just shows a burst).
const VFX_LIFESPAN: Record<AbilityName, number> = {
  terrain_shape: 3500,
  resource_amp: 2800,
  npc_influence: 2800,
  protection: 3500,
};

export function toAbilityVFX(
  event: CycleEvent,
  firstSeen: Map<number, number>,
  now: number,
): AbilityVFX | null {
  if (event.kind !== 'ability') return null;
  const payload = (event.payload || {}) as Record<string, unknown>;
  const abilityName = payload.ability_name as AbilityName | undefined;
  const leader = payload.leader as 'sr' | 'jr' | undefined;
  const targetData = payload.target_data as Record<string, unknown> | undefined;
  if (!abilityName || !leader || !targetData) return null;
  if (!['terrain_shape', 'resource_amp', 'npc_influence', 'protection'].includes(abilityName)) {
    return null;
  }

  const seenAt = firstSeen.get(event.id) ?? now;
  firstSeen.set(event.id, seenAt);

  return {
    eventId: event.id,
    leader,
    kind: abilityName,
    cycle: event.cycle,
    seenAt,
    target_data: targetData,
    lifespanMs: VFX_LIFESPAN[abilityName],
  };
}

export function buildAbilityVFX(
  events: CycleEvent[],
  firstSeen: Map<number, number>,
  now: number,
): AbilityVFX[] {
  const out: AbilityVFX[] = [];
  for (const e of events) {
    const v = toAbilityVFX(e, firstSeen, now);
    if (!v) continue;
    if (now - v.seenAt < v.lifespanMs) out.push(v);
  }
  return out;
}

// Breakthrough event: separate kind, fires once per unlock.
export interface BreakthroughEvent {
  eventId: number;
  leader: 'sr' | 'jr';
  unlocks: AbilityName;
  description: string;
  seenAt: number;
  lifespanMs: number;
}

export function toBreakthroughEvent(
  event: CycleEvent,
  firstSeen: Map<number, number>,
  now: number,
): BreakthroughEvent | null {
  if (event.kind !== 'breakthrough') return null;
  const p = (event.payload || {}) as Record<string, unknown>;
  const leader = p.leader as 'sr' | 'jr' | undefined;
  const unlocks = p.unlocks as AbilityName | undefined;
  const description = typeof p.description === 'string' ? p.description : '';
  if (!leader || !unlocks) return null;
  const seenAt = firstSeen.get(event.id) ?? now;
  firstSeen.set(event.id, seenAt);
  return {
    eventId: event.id,
    leader,
    unlocks,
    description,
    seenAt,
    lifespanMs: 5000,
  };
}

export function buildBreakthroughEvents(
  events: CycleEvent[],
  firstSeen: Map<number, number>,
  now: number,
): BreakthroughEvent[] {
  const out: BreakthroughEvent[] = [];
  for (const e of events) {
    const b = toBreakthroughEvent(e, firstSeen, now);
    if (!b) continue;
    if (now - b.seenAt < b.lifespanMs) out.push(b);
  }
  return out;
}
