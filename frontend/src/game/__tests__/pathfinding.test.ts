import { describe, it, expect } from 'vitest';
import { findPath, nearestWalkable } from '../movement/pathfinding';
import { GRID_W, GRID_H, type Tile } from '../../lib/terrain';

// Build a synthetic tile grid for deterministic testing. The real game
// reads tiles from backend world.terrain; for tests we fabricate a
// known shape.
function makeGrid(fn: (x: number, y: number) => Tile['type']): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      tiles.push({ x, y, type: fn(x, y), height: 0.3 });
    }
  }
  return tiles;
}

describe('pathfinding/findPath', () => {
  it('finds a straight path on uniform plains', () => {
    const tiles = makeGrid(() => 'plains');
    const path = findPath(tiles, { x: 5, y: 5 }, { x: 10, y: 5 });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 5, y: 5 });
    expect(path![path!.length - 1]).toEqual({ x: 10, y: 5 });
  });

  it('returns null when goal is in water (impassable by default)', () => {
    const tiles = makeGrid((x, y) => (x === 10 && y === 5 ? 'water' : 'plains'));
    const path = findPath(tiles, { x: 5, y: 5 }, { x: 10, y: 5 });
    expect(path).toBeNull();
  });

  it('routes around a water barrier', () => {
    // Vertical water wall at x=10 except for an opening at y=0
    const tiles = makeGrid((x, y) => (x === 10 && y !== 0 ? 'water' : 'plains'));
    const path = findPath(tiles, { x: 5, y: 5 }, { x: 15, y: 5 });
    expect(path).not.toBeNull();
    // Path must not step on any water tile
    const waterHits = path!.filter((n) => n.x === 10 && n.y !== 0);
    expect(waterHits).toHaveLength(0);
  });

  it('prefers plains over forest (lower cost)', () => {
    // Left half forest, right half plains. Start + goal both on plains.
    const tiles = makeGrid((x) => (x < 10 ? 'forest' : 'plains'));
    const path = findPath(tiles, { x: 15, y: 5 }, { x: 18, y: 5 });
    expect(path).not.toBeNull();
    for (const n of path!) {
      const t = tiles[n.y * GRID_W + n.x];
      expect(t.type).toBe('plains');
    }
  });

  it('respects diagonal movement (Chebyshev)', () => {
    const tiles = makeGrid(() => 'plains');
    const path = findPath(tiles, { x: 5, y: 5 }, { x: 8, y: 8 });
    expect(path).not.toBeNull();
    // All adjacent steps should be Chebyshev-adjacent (max |dx|,|dy| === 1)
    for (let i = 1; i < path!.length; i++) {
      const a = path![i - 1];
      const b = path![i];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      expect(Math.max(dx, dy)).toBe(1);
    }
  });

  it('respects 4-directional when allowDiagonal=false', () => {
    const tiles = makeGrid(() => 'plains');
    const path = findPath(tiles, { x: 5, y: 5 }, { x: 8, y: 8 }, { allowDiagonal: false });
    expect(path).not.toBeNull();
    for (let i = 1; i < path!.length; i++) {
      const a = path![i - 1];
      const b = path![i];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      expect(dx + dy).toBe(1); // exactly one axis moved
    }
  });

  it('returns null when start is out of bounds', () => {
    const tiles = makeGrid(() => 'plains');
    const path = findPath(tiles, { x: -1, y: 5 }, { x: 10, y: 5 });
    expect(path).toBeNull();
  });

  it('respects maxSteps budget', () => {
    // Force it to search a complex path and cap expansions tightly
    const tiles = makeGrid((x, y) => (x > 3 && x < 35 && y > 3 && y < 20 ? 'mountain' : 'plains'));
    const path = findPath(tiles, { x: 0, y: 0 }, { x: 39, y: 23 }, { maxSteps: 5 });
    expect(path).toBeNull();
  });

  it('swimmer capability enters water', () => {
    const tiles = makeGrid(() => 'water');
    // Without canSwim, no path
    expect(findPath(tiles, { x: 5, y: 5 }, { x: 10, y: 5 })).toBeNull();
    // With canSwim, path exists
    const p = findPath(tiles, { x: 5, y: 5 }, { x: 10, y: 5 }, { capabilities: { canSwim: true } });
    expect(p).not.toBeNull();
  });
});

describe('pathfinding/nearestWalkable', () => {
  it('returns target if already walkable', () => {
    const tiles = makeGrid(() => 'plains');
    const n = nearestWalkable(tiles, { x: 5, y: 5 });
    expect(n).toEqual({ x: 5, y: 5 });
  });

  it('finds neighbor if target is water', () => {
    const tiles = makeGrid((x, y) => (x === 5 && y === 5 ? 'water' : 'plains'));
    const n = nearestWalkable(tiles, { x: 5, y: 5 });
    expect(n).not.toBeNull();
    expect(n).not.toEqual({ x: 5, y: 5 });
  });

  it('returns null when surrounded by water within radius', () => {
    const tiles = makeGrid(() => 'water');
    const n = nearestWalkable(tiles, { x: 5, y: 5 }, {}, 3);
    expect(n).toBeNull();
  });
});
