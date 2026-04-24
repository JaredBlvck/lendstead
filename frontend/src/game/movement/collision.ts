// Tile collision checks. Separates "which tiles a mover can enter" from
// pathfinding cost calculation so we can compose rules (e.g. an NPC
// with boat ability can enter water; a normal NPC can't).

import type { Tile, TileType } from '../../lib/terrain';
import { GRID_W, GRID_H } from '../../lib/terrain';
import { isImpassable, costForType } from './terrainCosts';

export interface MoverCapabilities {
  canSwim?: boolean;          // ignore water impassability
  canClimbCliffs?: boolean;   // ignore mountain steep cost
  maxSlope?: number;          // max height delta permitted per step
}

const DEFAULT_CAPS: Required<MoverCapabilities> = {
  canSwim: false,
  canClimbCliffs: false,
  maxSlope: 0.5,
};

export function withinBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

export function canEnter(
  tile: Tile,
  caps: MoverCapabilities = {},
): boolean {
  const c = { ...DEFAULT_CAPS, ...caps };
  if (tile.type === 'water') return c.canSwim === true;
  const cost = costForType(tile.type);
  if (isImpassable(cost) && !c.canClimbCliffs) return false;
  return true;
}

export function canStep(
  from: Tile,
  to: Tile,
  caps: MoverCapabilities = {},
): boolean {
  if (!canEnter(to, caps)) return false;
  const c = { ...DEFAULT_CAPS, ...caps };
  const delta = Math.abs((to.height ?? 0) - (from.height ?? 0));
  if (delta > c.maxSlope) return false;
  return true;
}

// Tile type helper for narrowed checks - keeps TypeScript happy when
// other modules want to assert "this is a walkable tile."
export function isWalkableType(type: TileType): boolean {
  return type !== 'water';
}
