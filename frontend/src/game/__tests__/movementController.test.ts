import { describe, it, expect } from 'vitest';
import {
  newMover,
  setPath,
  tickMover,
  haltMover,
  distanceToTarget,
} from '../movement/movementController';
import { createClickToMoveController } from '../movement/clickToMove';
import { GRID_W, GRID_H, type Tile } from '../../lib/terrain';

// Build a plains grid at the real game dimensions so tileAt() index math works.
function plainsGrid(): Tile[] {
  const out: Tile[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      out.push({ x, y, type: 'plains', height: 0 } as Tile);
    }
  }
  return out;
}

// Build a mostly-water grid with only a single plains tile as an island.
function isolatedIsland(center: { x: number; y: number }): Tile[] {
  const out: Tile[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const type = x === center.x && y === center.y ? 'plains' : 'water';
      out.push({ x, y, type, height: 0 } as Tile);
    }
  }
  return out;
}

describe('movementController', () => {
  it('arrives after enough ticks along a straight path', () => {
    let m = newMover('p1', { x: 0, y: 0 }, 5);   // 5 tiles/sec
    m = setPath(m, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(m.arrived).toBe(false);
    for (let i = 0; i < 20; i++) m = tickMover(m, 0.1);
    expect(m.arrived).toBe(true);
    expect(m.position).toEqual({ x: 3, y: 0 });
  });

  it('interpolates partial steps between tiles', () => {
    let m = newMover('p1', { x: 0, y: 0 }, 1);
    m = setPath(m, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    m = tickMover(m, 0.5);
    expect(m.arrived).toBe(false);
    expect(m.position.x).toBeCloseTo(0.5, 5);
  });

  it('haltMover clears path and flags arrived', () => {
    let m = newMover('p1', { x: 0, y: 0 }, 1);
    m = setPath(m, [{ x: 0, y: 0 }, { x: 5, y: 5 }]);
    m = haltMover(m);
    expect(m.arrived).toBe(true);
    expect(m.path).toHaveLength(0);
  });

  it('distanceToTarget reports remaining distance', () => {
    let m = newMover('p1', { x: 0, y: 0 }, 1);
    m = setPath(m, [{ x: 0, y: 0 }, { x: 4, y: 3 }]);
    expect(distanceToTarget(m)).toBe(5);
  });
});

describe('createClickToMoveController', () => {
  it('goto plans a path and tick advances the mover', () => {
    const tiles = plainsGrid();
    const ctl = createClickToMoveController('p1', { x: 0, y: 0 }, {
      tiles,
      speedTilesPerSec: 10,
    });
    const path = ctl.goto({ x: 3, y: 0 });
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);

    for (let i = 0; i < 10; i++) ctl.tick(0.1);
    const s = ctl.state();
    expect(s.arrived).toBe(true);
    expect(s.position).toEqual({ x: 3, y: 0 });
  });

  it('onArrived fires exactly once per path completion', () => {
    const tiles = plainsGrid();
    let arrivedCount = 0;
    const ctl = createClickToMoveController('p1', { x: 0, y: 0 }, {
      tiles,
      speedTilesPerSec: 10,
      onArrived: () => arrivedCount++,
    });
    ctl.goto({ x: 2, y: 2 });
    for (let i = 0; i < 30; i++) ctl.tick(0.1);
    expect(arrivedCount).toBe(1);

    ctl.goto({ x: 0, y: 0 });
    for (let i = 0; i < 30; i++) ctl.tick(0.1);
    expect(arrivedCount).toBe(2);
  });

  it('onPathPlanned fires with the planned path on each goto', () => {
    const tiles = plainsGrid();
    let last: unknown = null;
    const ctl = createClickToMoveController('p1', { x: 0, y: 0 }, {
      tiles,
      onPathPlanned: (p) => (last = p),
    });
    ctl.goto({ x: 3, y: 3 });
    expect(Array.isArray(last)).toBe(true);
    expect((last as Array<unknown>).length).toBeGreaterThan(1);
  });

  it('goto returns null when no path exists', () => {
    // Single-tile plains island surrounded by water; every neighbor is blocked
    const tiles = isolatedIsland({ x: 5, y: 5 });
    const ctl = createClickToMoveController('p1', { x: 5, y: 5 }, { tiles });
    const path = ctl.goto({ x: 15, y: 15 });
    expect(path).toBeNull();
  });

  it('setPosition teleports the mover without a path', () => {
    const tiles = plainsGrid();
    const ctl = createClickToMoveController('p1', { x: 0, y: 0 }, { tiles });
    ctl.setPosition({ x: 4, y: 4 });
    expect(ctl.state().position).toEqual({ x: 4, y: 4 });
    expect(ctl.state().arrived).toBe(true);
  });
});
