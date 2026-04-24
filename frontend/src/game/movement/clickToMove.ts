// React hook wrapping the headless movement controller for click-to-move.
// Caller gives it: tiles, current position ref, capabilities. Hook returns:
//   - onTileClick(x,y): plan a path and start walking
//   - tick(delta): advance along path (call from useFrame)
//   - position/path/arrived state accessors
//
// Keep it dependency-light so tests can drive it without a real Canvas.

import { useCallback, useRef } from 'react';
import type { Tile } from '../../lib/terrain';
import { findPath, nearestWalkable, type PathNode } from './pathfinding';
import type { MoverCapabilities } from './collision';
import {
  haltMover,
  newMover,
  setPath,
  tickMover,
  type MoverState,
} from './movementController';

export interface UseClickToMoveOptions {
  tiles: Tile[];
  capabilities?: MoverCapabilities;
  speedTilesPerSec?: number;
  onArrived?: () => void;
  onPathPlanned?: (path: PathNode[]) => void;
}

export interface UseClickToMoveApi {
  goto: (target: PathNode) => PathNode[] | null;
  halt: () => void;
  tick: (delta: number) => MoverState;
  state: () => MoverState;
  setPosition: (pos: { x: number; y: number }) => void;
}

// Non-hook factory (test-friendly). React wrappers should use useRef + useCallback
// around these to get a stable API.
export function createClickToMoveController(
  ownerId: string,
  start: { x: number; y: number },
  opts: UseClickToMoveOptions,
): UseClickToMoveApi {
  let mover: MoverState = newMover(ownerId, start, opts.speedTilesPerSec ?? 3);

  const goto: UseClickToMoveApi['goto'] = (target) => {
    const resolved = nearestWalkable(opts.tiles, target, opts.capabilities) ?? target;
    const current = {
      x: Math.round(mover.position.x),
      y: Math.round(mover.position.y),
    };
    const path = findPath(opts.tiles, current, resolved, { capabilities: opts.capabilities });
    if (!path) return null;
    mover = setPath(mover, path);
    opts.onPathPlanned?.(path);
    return path;
  };

  const halt: UseClickToMoveApi['halt'] = () => {
    mover = haltMover(mover);
  };

  const tick: UseClickToMoveApi['tick'] = (delta) => {
    const before = mover.arrived;
    mover = tickMover(mover, delta);
    if (!before && mover.arrived) opts.onArrived?.();
    return mover;
  };

  const state: UseClickToMoveApi['state'] = () => mover;

  const setPosition: UseClickToMoveApi['setPosition'] = (pos) => {
    mover = { ...mover, position: { ...pos }, path: [], arrived: true };
  };

  return { goto, halt, tick, state, setPosition };
}

// React hook wrapper that stabilizes the controller across renders.
// Caller is expected to run controller.tick(delta) inside useFrame().
export function useClickToMove(
  ownerId: string,
  start: { x: number; y: number },
  opts: UseClickToMoveOptions,
): UseClickToMoveApi {
  const controllerRef = useRef<UseClickToMoveApi | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createClickToMoveController(ownerId, start, opts);
  }

  // Stable callbacks that proxy through to the live controller.
  const goto = useCallback<UseClickToMoveApi['goto']>((target) => {
    return controllerRef.current!.goto(target);
  }, []);
  const halt = useCallback<UseClickToMoveApi['halt']>(() => {
    controllerRef.current!.halt();
  }, []);
  const tick = useCallback<UseClickToMoveApi['tick']>((delta) => {
    return controllerRef.current!.tick(delta);
  }, []);
  const state = useCallback<UseClickToMoveApi['state']>(() => {
    return controllerRef.current!.state();
  }, []);
  const setPosition = useCallback<UseClickToMoveApi['setPosition']>((pos) => {
    controllerRef.current!.setPosition(pos);
  }, []);

  return { goto, halt, tick, state, setPosition };
}
