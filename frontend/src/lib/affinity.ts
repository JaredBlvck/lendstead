// Affinity persistence layer - NPC-pair relationship scores backed by
// the backend's affinity table.

import type { CycleEvent } from '../types';

export interface AffinityPair {
  npc_a: number;
  npc_b: number;
  score: string | number; // backend returns as numeric string
  interactions: number;
  last_cycle: number;
  last_type: string;
  milestones_reached: Array<'acquainted' | 'friendly' | 'close' | 'bonded'>;
  a_name?: string;
  a_role?: string;
  a_lane?: 'sr' | 'jr';
  b_name?: string;
  b_role?: string;
  b_lane?: 'sr' | 'jr';
}

export function affinityScore(p: AffinityPair): number {
  const s = p.score;
  return typeof s === 'number' ? s : parseFloat(String(s));
}

export type MilestoneName = 'acquainted' | 'friendly' | 'close' | 'bonded';

export const MILESTONE_THRESHOLD: Record<MilestoneName, number> = {
  acquainted: 0.2,
  friendly: 0.5,
  close: 1.0,
  bonded: 2.0,
};

export interface AffinityMilestoneVFX {
  eventId: number;
  pair: Array<{ id: number; name: string; role: string; lane: 'sr' | 'jr' }>;
  milestone: MilestoneName;
  score: number;
  triggeredBy: string;
  seenAt: number;
  lifespanMs: number;
}

const MILESTONE_LIFESPAN: Record<MilestoneName, number> = {
  acquainted: 3500,
  friendly: 4500,
  close: 5500,
  bonded: 7000,
};

export function toAffinityMilestoneVFX(
  event: CycleEvent,
  firstSeen: Map<number, number>,
  now: number,
): AffinityMilestoneVFX | null {
  if (event.kind !== 'affinity_milestone') return null;
  const p = (event.payload || {}) as Record<string, unknown>;
  const pair = p.pair as Array<{ id: number; name: string; role: string; lane: 'sr' | 'jr' }> | undefined;
  const milestone = p.milestone as MilestoneName | undefined;
  if (!pair || pair.length !== 2 || !milestone) return null;
  if (!['acquainted', 'friendly', 'close', 'bonded'].includes(milestone)) return null;
  const seenAt = firstSeen.get(event.id) ?? now;
  firstSeen.set(event.id, seenAt);
  return {
    eventId: event.id,
    pair,
    milestone,
    score: typeof p.score === 'number' ? p.score : parseFloat(String(p.score ?? 0)),
    triggeredBy: String(p.triggered_by || ''),
    seenAt,
    lifespanMs: MILESTONE_LIFESPAN[milestone],
  };
}

export function buildAffinityMilestoneVFX(
  events: CycleEvent[],
  firstSeen: Map<number, number>,
  now: number,
): AffinityMilestoneVFX[] {
  const out: AffinityMilestoneVFX[] = [];
  for (const e of events) {
    const v = toAffinityMilestoneVFX(e, firstSeen, now);
    if (!v) continue;
    if (now - v.seenAt < v.lifespanMs) out.push(v);
  }
  return out;
}

export const MILESTONE_LABEL: Record<MilestoneName, string> = {
  acquainted: 'ACQUAINTED',
  friendly: 'FRIENDLY',
  close: 'CLOSE',
  bonded: 'BONDED',
};

export const MILESTONE_COLOR: Record<MilestoneName, string> = {
  acquainted: '#94a3b8',
  friendly: '#5eead4',
  close: '#a78bfa',
  bonded: '#fde047',
};
