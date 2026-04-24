// Cumulative magic-effect aggregator. Reads the full /api/events stream
// and accumulates per-tile / per-NPC / per-resource history so the world
// visibly remembers where magic has been used.
//
// Backend doesn't (yet) persist cumulative effects - this runs
// client-side from event history, so the "memory" lasts as long as
// events are queryable. Jr can mirror this with a persisted field later
// if we want truly permanent traces.

import type { CycleEvent } from '../types';

export interface TileTrace {
  x: number;
  y: number;
  casts: number;                 // total terrain_shape casts here
  last_cycle: number;
  dominantLeader: 'sr' | 'jr';
}

export interface NPCTrace {
  npcId: number;
  influences: number;            // total npc_influence events touching this NPC
  loyaltyShift: number;          // cumulative trust_shift (can be negative)
  last_cycle: number;
  dominantLeader: 'sr' | 'jr';
}

export interface ResourceTrace {
  kind: 'food' | 'water';
  blessings: number;             // total resource_amp casts for this kind
  last_cycle: number;
}

export interface ProtectionTrace {
  x: number;
  y: number;
  casts: number;
  last_cycle: number;
}

export interface MagicTraces {
  tiles: TileTrace[];
  npcs: NPCTrace[];
  resources: ResourceTrace[];
  protections: ProtectionTrace[];
  totalAbilityCasts: number;
}

export function aggregateMagicTraces(events: CycleEvent[]): MagicTraces {
  const tileMap = new Map<string, TileTrace>();
  const npcMap = new Map<number, NPCTrace>();
  const resMap = new Map<string, ResourceTrace>();
  const protMap = new Map<string, ProtectionTrace>();
  let total = 0;

  for (const e of events) {
    if (e.kind !== 'ability') continue;
    const p = (e.payload || {}) as Record<string, unknown>;
    const leader = p.leader as 'sr' | 'jr' | undefined;
    const name = p.ability_name as string | undefined;
    const target = (p.target_data || {}) as Record<string, unknown>;
    if (!leader || !name) continue;
    total++;

    if (name === 'terrain_shape') {
      const tile = target.tile as [number, number] | undefined;
      if (tile) {
        const k = `${tile[0]},${tile[1]}`;
        const prev = tileMap.get(k);
        if (prev) {
          prev.casts++;
          prev.last_cycle = Math.max(prev.last_cycle, e.cycle);
          if (leader !== prev.dominantLeader) {
            // simple counter-based dominance - last leader wins if counts equal
            prev.dominantLeader = leader;
          }
        } else {
          tileMap.set(k, { x: tile[0], y: tile[1], casts: 1, last_cycle: e.cycle, dominantLeader: leader });
        }
      }
    } else if (name === 'npc_influence') {
      const ids = (target.affected_npc_ids as number[]) || [];
      const shift = (target.trust_shift as number) ?? 0;
      for (const id of ids) {
        const prev = npcMap.get(id);
        if (prev) {
          prev.influences++;
          prev.loyaltyShift += shift;
          prev.last_cycle = Math.max(prev.last_cycle, e.cycle);
          prev.dominantLeader = leader;
        } else {
          npcMap.set(id, {
            npcId: id,
            influences: 1,
            loyaltyShift: shift,
            last_cycle: e.cycle,
            dominantLeader: leader,
          });
        }
      }
    } else if (name === 'resource_amp') {
      const kind = target.kind as 'food' | 'water' | undefined;
      if (kind) {
        const prev = resMap.get(kind);
        if (prev) {
          prev.blessings++;
          prev.last_cycle = Math.max(prev.last_cycle, e.cycle);
        } else {
          resMap.set(kind, { kind, blessings: 1, last_cycle: e.cycle });
        }
      }
    } else if (name === 'protection') {
      const tile = target.tile as [number, number] | undefined;
      if (tile) {
        const k = `${tile[0]},${tile[1]}`;
        const prev = protMap.get(k);
        if (prev) {
          prev.casts++;
          prev.last_cycle = Math.max(prev.last_cycle, e.cycle);
        } else {
          protMap.set(k, { x: tile[0], y: tile[1], casts: 1, last_cycle: e.cycle });
        }
      }
    }
  }

  return {
    tiles: Array.from(tileMap.values()),
    npcs: Array.from(npcMap.values()),
    resources: Array.from(resMap.values()),
    protections: Array.from(protMap.values()),
    totalAbilityCasts: total,
  };
}
