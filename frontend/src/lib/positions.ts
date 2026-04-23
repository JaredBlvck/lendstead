// Client-side NPC position seeder. Used until backend ships x/y columns.
// Positions are stable per (npc_name, cycle) so repeated renders don't
// jitter, but each cycle introduces small drift to give the island life.

import type { NPC } from '../types';
import { GRID_W, GRID_H, tileAt, type Tile } from './terrain';

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed: number) {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const perimeterRx = /scout|watcher|runner|guard|sentry|ranger/i;
const foragerRx = /forager|fisher|gatherer|shore|tide/i;
const builderRx = /carpenter|toolmaker|potter|organizer|field|planner|prospector|hauler|healer|inland|marker/i;

function preferredBand(role: string): 'outer' | 'edge' | 'inner' {
  if (perimeterRx.test(role)) return 'outer';
  if (foragerRx.test(role)) return 'edge';
  if (builderRx.test(role)) return 'inner';
  return 'inner';
}

export interface NPCPosition {
  id: number;
  x: number;
  y: number;
}

export function seedPositions(
  npcs: NPC[],
  tiles: Tile[],
  cycle: number,
): NPCPosition[] {
  const cx = GRID_W / 2;
  const cy = GRID_H / 2;
  const maxR = Math.min(GRID_W, GRID_H) / 2 - 1;

  return npcs
    .filter((n) => n.alive)
    .map((npc) => {
      const seed = hashStr(`${npc.name}:${cycle}`);
      const band = preferredBand(npc.role);
      const rA = rand(seed);
      const rB = rand(seed ^ 0x9e3779b9);

      // Pick radius by band with per-cycle jitter
      let r: number;
      if (band === 'outer') r = maxR * (0.78 + rA * 0.18);
      else if (band === 'edge') r = maxR * (0.48 + rA * 0.28);
      else r = maxR * (0.08 + rA * 0.22);

      const angle = rB * Math.PI * 2;
      let x = Math.round(cx + Math.cos(angle) * r);
      let y = Math.round(cy + Math.sin(angle) * r);

      // Pull NPCs out of water onto the nearest land tile so they visually
      // sit on the island. Search outward in a small spiral.
      const target = tileAt(tiles, x, y);
      if (!target || target.type === 'water') {
        outer: for (let d = 1; d < 6; d++) {
          for (let dx = -d; dx <= d; dx++) {
            for (let dy = -d; dy <= d; dy++) {
              const t = tileAt(tiles, x + dx, y + dy);
              if (t && t.type !== 'water') {
                x += dx;
                y += dy;
                break outer;
              }
            }
          }
        }
      }

      return { id: npc.id, x, y };
    });
}
