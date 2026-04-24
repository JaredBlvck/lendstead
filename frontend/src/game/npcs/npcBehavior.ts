// NPC behavior runtime. Consumes an NPC + NpcRuntimeState and advances
// movement one tick, respecting mode (wander/patrol/travel/flee/follow).
// Uses the shared pathfinding module - NPCs route through the same A* as
// the player. No mutation - returns a new state.

import type { Npc, NpcRuntimeState } from './npcTypes';
import { findPath, type PathNode } from '../movement/pathfinding';
import type { Tile } from '../../lib/terrain';
import type { MoverCapabilities } from '../movement/collision';

export interface BehaviorContext {
  tiles: Tile[];
  player_location?: PathNode;
  capabilities?: MoverCapabilities;
  threat_locations?: PathNode[];            // for flee mode
  patrol_route?: PathNode[];                // for patrol mode
  patrol_cursor?: number;                   // which patrol_route index the NPC is heading to
  random?: () => number;
}

// Compute next path for the NPC given its current mode.
export function advanceBehavior(
  _npc: Npc,
  state: NpcRuntimeState,
  ctx: BehaviorContext,
): NpcRuntimeState {
  const rng = ctx.random ?? Math.random;
  const here = state.current_location;
  if (!here) return state;

  switch (state.movement_mode) {
    case 'idle':
      return { ...state, path: [] };

    case 'wander': {
      // Pick a random tile within radius 3 of current location that's walkable.
      for (let tries = 0; tries < 6; tries++) {
        const dx = Math.floor(rng() * 7) - 3;
        const dy = Math.floor(rng() * 7) - 3;
        const target = { x: here.x + dx, y: here.y + dy };
        const path = findPath(ctx.tiles, here, target, { capabilities: ctx.capabilities, maxSteps: 200 });
        if (path && path.length > 1) {
          return { ...state, path, target_location: target };
        }
      }
      return { ...state, path: [] };
    }

    case 'patrol': {
      if (!ctx.patrol_route || ctx.patrol_route.length === 0) return state;
      const cursor = ctx.patrol_cursor ?? 0;
      const target = ctx.patrol_route[cursor % ctx.patrol_route.length];
      const path = findPath(ctx.tiles, here, target, { capabilities: ctx.capabilities });
      return {
        ...state,
        path: path ?? [],
        target_location: target,
        movement_mode: path ? 'patrol' : 'blocked',
      };
    }

    case 'travel_to_job':
    case 'travel_home':
    case 'quest_target': {
      if (!state.target_location) return state;
      const path = findPath(ctx.tiles, here, state.target_location, { capabilities: ctx.capabilities });
      return {
        ...state,
        path: path ?? [],
        movement_mode: path ? state.movement_mode : 'blocked',
      };
    }

    case 'flee': {
      // Pick the tile furthest from all known threats within radius 5.
      const threats = ctx.threat_locations ?? [];
      if (threats.length === 0) return { ...state, movement_mode: 'idle', path: [] };
      let bestTarget: PathNode | null = null;
      let bestScore = -Infinity;
      for (let dx = -5; dx <= 5; dx++) {
        for (let dy = -5; dy <= 5; dy++) {
          if (dx === 0 && dy === 0) continue;
          const cand = { x: here.x + dx, y: here.y + dy };
          let minDistSq = Infinity;
          for (const th of threats) {
            const d = (cand.x - th.x) ** 2 + (cand.y - th.y) ** 2;
            if (d < minDistSq) minDistSq = d;
          }
          if (minDistSq > bestScore) {
            bestScore = minDistSq;
            bestTarget = cand;
          }
        }
      }
      if (!bestTarget) return state;
      const path = findPath(ctx.tiles, here, bestTarget, { capabilities: ctx.capabilities });
      return { ...state, path: path ?? [], target_location: bestTarget };
    }

    case 'follow_player': {
      if (!ctx.player_location) return { ...state, path: [] };
      // Stop at 1-tile gap from player to avoid collision/overlap
      const path = findPath(ctx.tiles, here, ctx.player_location, { capabilities: ctx.capabilities });
      if (!path) return { ...state, movement_mode: 'blocked', path: [] };
      // Trim final step so we don't stand on the player
      const trimmed = path.length > 1 ? path.slice(0, -1) : path;
      return { ...state, path: trimmed, target_location: ctx.player_location };
    }

    case 'blocked': {
      // Retry repath to last target
      if (!state.target_location) return { ...state, movement_mode: 'idle', path: [] };
      const path = findPath(ctx.tiles, here, state.target_location, { capabilities: ctx.capabilities });
      if (!path) return state;
      return { ...state, path, movement_mode: 'travel_to_job' };
    }

    default:
      return state;
  }
}

// Advance one tile along the NPC's current path. Drops the front element.
// Returns the NPC sitting on the next path tile; when path is empty returns
// state with empty path + arrived-at-target handling.
export function stepAlongPath(state: NpcRuntimeState): NpcRuntimeState {
  if (state.path.length === 0) return state;
  const [, next, ...rest] = state.path;   // [0] is current, [1] is next
  if (!next) return { ...state, path: [] };
  return {
    ...state,
    current_location: next,
    path: [next, ...rest],
  };
}
