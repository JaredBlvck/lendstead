// A* pathfinding on the tile grid. Uses Chebyshev distance heuristic
// (supports 8-directional movement) + terrain cost + slope penalty.
// Returns the ordered tile list from start to goal, or null if no path
// exists within the step budget.
//
// Contract:
//   - input: tiles[] (row-major), start, goal, capabilities, maxSteps
//   - output: Array<{x, y}> inclusive of start + goal, or null
//   - tiles[] may be smaller than GRID_W*GRID_H if a region filter is
//     active; we look up by (x,y) via index function.

import type { Tile } from '../../lib/terrain';
import { GRID_W, GRID_H, tileAt } from '../../lib/terrain';
import { costForTypeWithCaps, slopePenalty, IMPASSABLE_COST } from './terrainCosts';
import { canStep, canEnter, withinBounds, type MoverCapabilities } from './collision';

export interface PathNode {
  x: number;
  y: number;
}

export interface PathfindOptions {
  capabilities?: MoverCapabilities;
  maxSteps?: number;       // node expansion cap to guard runtime
  allowDiagonal?: boolean; // default true (Chebyshev)
}

// Chebyshev distance: max(|dx|, |dy|). Admissible for 8-directional
// movement with uniform cost. We scale by min terrain cost (1.0) so
// it's admissible even with terrain cost variance.
function heuristic(a: PathNode, b: PathNode): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

interface OpenSetEntry {
  node: PathNode;
  gScore: number;
  fScore: number;
}

// Min-heap-free priority scan. The grid is small enough (960 tiles) that
// linear scan is fine and avoids binary heap complexity. If we scale up
// past 10k tiles, swap in a heap.
function popLowestF(open: OpenSetEntry[]): OpenSetEntry | null {
  if (open.length === 0) return null;
  let bestI = 0;
  for (let i = 1; i < open.length; i++) {
    if (open[i].fScore < open[bestI].fScore) bestI = i;
  }
  const [entry] = open.splice(bestI, 1);
  return entry;
}

function keyOf(n: PathNode): string {
  return `${n.x},${n.y}`;
}

export function findPath(
  tiles: Tile[],
  start: PathNode,
  goal: PathNode,
  opts: PathfindOptions = {},
): PathNode[] | null {
  const capabilities = opts.capabilities ?? {};
  const maxSteps = opts.maxSteps ?? 2000;
  const allowDiagonal = opts.allowDiagonal !== false;

  const startTile = tileAt(tiles, start.x, start.y);
  const goalTile = tileAt(tiles, goal.x, goal.y);
  if (!startTile || !goalTile) return null;
  if (!canEnter(goalTile, capabilities)) return null;

  const open: OpenSetEntry[] = [
    { node: start, gScore: 0, fScore: heuristic(start, goal) },
  ];
  const gScores = new Map<string, number>();
  gScores.set(keyOf(start), 0);
  const cameFrom = new Map<string, PathNode>();

  // 8-direction steps (or 4 if allowDiagonal=false)
  const steps: Array<[number, number]> = allowDiagonal
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1]];

  let expansions = 0;
  while (open.length > 0) {
    if (expansions++ > maxSteps) return null;
    const current = popLowestF(open);
    if (!current) return null;

    if (current.node.x === goal.x && current.node.y === goal.y) {
      // Reconstruct path
      const path: PathNode[] = [current.node];
      let cursor: PathNode | undefined = current.node;
      while (cursor && cameFrom.has(keyOf(cursor))) {
        cursor = cameFrom.get(keyOf(cursor));
        if (cursor) path.unshift(cursor);
      }
      return path;
    }

    const currentTile = tileAt(tiles, current.node.x, current.node.y);
    if (!currentTile) continue;

    for (const [dx, dy] of steps) {
      const nx = current.node.x + dx;
      const ny = current.node.y + dy;
      if (!withinBounds(nx, ny)) continue;
      const neighborTile = tileAt(tiles, nx, ny);
      if (!neighborTile) continue;
      if (!canStep(currentTile, neighborTile, capabilities)) continue;

      const terrainCost = costForTypeWithCaps(neighborTile.type, capabilities);
      if (!Number.isFinite(terrainCost)) continue;
      const slope = slopePenalty(currentTile.height ?? 0, neighborTile.height ?? 0);
      // Diagonal steps cost 1.4x (Euclidean approximation)
      const diagMul = dx !== 0 && dy !== 0 ? 1.4 : 1.0;
      const stepCost = (terrainCost + slope) * diagMul;
      if (!Number.isFinite(stepCost) || stepCost >= IMPASSABLE_COST) continue;

      const tentativeG = current.gScore + stepCost;
      const neighborKey = keyOf({ x: nx, y: ny });
      const existingG = gScores.get(neighborKey);
      if (existingG != null && tentativeG >= existingG) continue;

      gScores.set(neighborKey, tentativeG);
      cameFrom.set(neighborKey, current.node);
      open.push({
        node: { x: nx, y: ny },
        gScore: tentativeG,
        fScore: tentativeG + heuristic({ x: nx, y: ny }, goal),
      });
    }
  }

  return null;
}

// Convenience: find the nearest walkable tile if the target is impassable.
// Spirals outward from target up to maxRadius.
export function nearestWalkable(
  tiles: Tile[],
  target: PathNode,
  caps: MoverCapabilities = {},
  maxRadius = 6,
): PathNode | null {
  const targetTile = tileAt(tiles, target.x, target.y);
  if (targetTile && canEnter(targetTile, caps)) return target;
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = target.x + dx;
        const y = target.y + dy;
        if (!withinBounds(x, y)) continue;
        const t = tileAt(tiles, x, y);
        if (t && canEnter(t, caps)) return { x, y };
      }
    }
  }
  return null;
}

// Export grid dims for tests that want to construct paths
export const PATHFIND_GRID = { w: GRID_W, h: GRID_H };
