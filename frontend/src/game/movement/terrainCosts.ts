// Per-tile-type movement cost. Used by pathfinding + NPC movement.
// Water is impassable (Infinity). Mountain passable but expensive.
// Plains cheapest. Beach + forest moderate.
//
// Cost is interpreted as "time/energy to traverse this tile." Pathfinding
// minimizes total cost; higher cost = avoided unless necessary.

import type { TileType } from '../../lib/terrain';

export const TERRAIN_COST: Record<TileType, number> = {
  water: Infinity,  // impassable by default. Boats override this elsewhere.
  beach: 1.2,
  plains: 1.0,       // baseline
  forest: 1.5,
  mountain: 3.0,     // climbable but slow
};

export const IMPASSABLE_COST = Infinity;

export function isImpassable(cost: number): boolean {
  return !Number.isFinite(cost);
}

export function costForType(type: TileType): number {
  return TERRAIN_COST[type] ?? 1.0;
}

// Capability-aware cost: swimmers pay a high-but-finite cost for water,
// climbers pay a reduced cost for mountain. Other types unchanged.
export function costForTypeWithCaps(
  type: TileType,
  caps: { canSwim?: boolean; canClimbCliffs?: boolean } = {},
): number {
  if (type === 'water') return caps.canSwim ? 2.5 : Infinity;
  if (type === 'mountain' && caps.canClimbCliffs) return 2.0;
  return TERRAIN_COST[type] ?? 1.0;
}

// Slope penalty between two tiles. Going up a steep hill costs more.
export function slopePenalty(fromHeight: number, toHeight: number): number {
  const delta = toHeight - fromHeight;
  if (delta <= 0) return 0;        // flat or downhill, no penalty
  return Math.min(2.0, delta * 3); // uphill, capped at 2.0 extra cost
}
