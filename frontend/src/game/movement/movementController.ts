// Headless movement controller. Pure state machine that advances an entity
// along a path from findPath() at a given speed. The caller (React useFrame
// or a test) feeds in deltaTime and gets back the new position + status.
// ExplorationView can adopt this incrementally without a destructive rewrite.

import type { PathNode } from './pathfinding';

export interface MoverState {
  owner_id: string;
  position: { x: number; y: number };      // world position (grid-space, fractional OK)
  path: PathNode[];                         // remaining tiles including current + target
  speed_tiles_per_sec: number;              // base speed (modifiable per-terrain at call site)
  arrived: boolean;
}

export function newMover(
  owner_id: string,
  position: { x: number; y: number },
  speed = 3,
): MoverState {
  return {
    owner_id,
    position: { ...position },
    path: [],
    speed_tiles_per_sec: speed,
    arrived: true,
  };
}

export function setPath(state: MoverState, path: PathNode[]): MoverState {
  if (path.length === 0) return { ...state, path: [], arrived: true };
  return { ...state, path: [...path], arrived: false };
}

// Advance the mover one tick. Returns new state. If the path is exhausted,
// arrived=true and path=[]. Does NOT perform collision checks - that's the
// caller's responsibility at path-plan time, not per-frame.
export function tickMover(state: MoverState, deltaSeconds: number): MoverState {
  if (state.arrived || state.path.length === 0) {
    return { ...state, arrived: true, path: [] };
  }
  // Find the next waypoint we're heading toward
  const nextIdx = state.path.findIndex((node) => node.x !== state.position.x || node.y !== state.position.y);
  if (nextIdx === -1) {
    return { ...state, arrived: true, path: [] };
  }
  const target = state.path[nextIdx];
  const dx = target.x - state.position.x;
  const dy = target.y - state.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) {
    // Already on target - drop it from path
    return {
      ...state,
      path: state.path.slice(nextIdx + 1),
    };
  }
  const step = state.speed_tiles_per_sec * deltaSeconds;
  if (step >= dist) {
    // Snap to target and consume this waypoint
    const remainingPath = state.path.slice(nextIdx + 1);
    const arrived = remainingPath.length === 0;
    return {
      ...state,
      position: { x: target.x, y: target.y },
      path: remainingPath,
      arrived,
    };
  }
  // Partial step toward target
  return {
    ...state,
    position: {
      x: state.position.x + (dx / dist) * step,
      y: state.position.y + (dy / dist) * step,
    },
  };
}

export function distanceToTarget(state: MoverState): number {
  if (state.path.length === 0) return 0;
  const last = state.path[state.path.length - 1];
  return Math.hypot(last.x - state.position.x, last.y - state.position.y);
}

// Stop mover in place.
export function haltMover(state: MoverState): MoverState {
  return { ...state, path: [], arrived: true };
}
