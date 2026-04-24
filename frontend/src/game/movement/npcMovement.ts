// NPC movement layer that wraps the shared pathfinding + mover for NPCs.
// Wires the NpcRuntimeState to the headless MoverState so NPCs path via
// the same A* as the player. Behavior decisions (wander/patrol/flee) live
// in game/npcs/npcBehavior.ts - this module is the mechanical bridge.

import type { Tile } from '../../lib/terrain';
import type { Npc, NpcRuntimeState } from '../npcs/npcTypes';
import { advanceBehavior, stepAlongPath, type BehaviorContext } from '../npcs/npcBehavior';
import {
  newMover,
  setPath,
  tickMover,
  type MoverState,
} from './movementController';

export interface NpcMoverBundle {
  npc: Npc;
  runtime: NpcRuntimeState;
  mover: MoverState;
}

export function bootNpcMover(npc: Npc, runtime: NpcRuntimeState, speed = 2): NpcMoverBundle {
  const pos = runtime.current_location ?? runtime.target_location ?? { x: 0, y: 0 };
  return {
    npc,
    runtime,
    mover: newMover(npc.id, pos, speed),
  };
}

// One tick of NPC movement:
//   1. If no current path, ask behavior layer to plan one
//   2. Apply behavior path to the headless mover
//   3. Advance mover by deltaSeconds
//   4. Step runtime current_location forward to match mover
export function tickNpcMovement(
  bundle: NpcMoverBundle,
  tiles: Tile[],
  deltaSeconds: number,
  extra: Omit<BehaviorContext, 'tiles'> = {},
): NpcMoverBundle {
  let runtime = bundle.runtime;
  let mover = bundle.mover;

  // If no path is queued, ask the behavior layer to make one.
  if (mover.path.length === 0 || mover.arrived) {
    runtime = advanceBehavior(bundle.npc, runtime, { tiles, ...extra });
    if (runtime.path.length > 0) {
      mover = setPath(mover, runtime.path);
    }
  }

  mover = tickMover(mover, deltaSeconds);

  // When the mover crosses a tile boundary, sync runtime.current_location
  // for the behavior layer to see.
  const gridPos = {
    x: Math.round(mover.position.x),
    y: Math.round(mover.position.y),
  };
  const curr = runtime.current_location;
  if (!curr || curr.x !== gridPos.x || curr.y !== gridPos.y) {
    runtime = stepAlongPath({ ...runtime, current_location: gridPos });
  }

  return { npc: bundle.npc, runtime, mover };
}
