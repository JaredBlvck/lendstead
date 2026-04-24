// Bridge: reads ExplorationView's playerRef position each frame, detects
// tile-crossing events, and emits reach_tile GameEvents to the quest
// engine via the EventBridge window channel.
//
// Lives inside the Canvas tree so useFrame works. Must be kept simple
// and allocation-free on the hot path.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEngine } from '../engine/EngineContext';
import { GRID_W, GRID_H } from '../../lib/terrain';

interface PlayerStateRef {
  pos: THREE.Vector3;
  yaw: number;
  moving: boolean;
  walkPhase: number;
}

interface Props {
  playerRef: React.MutableRefObject<PlayerStateRef>;
}

// Inverse of ContentNpcsInScene's tileToWorld: translate world X/Z back
// to tile grid coordinates (clamped).
function worldToTile(x: number, z: number) {
  const tx = Math.round(x + GRID_W / 2 - 0.5);
  const ty = Math.round(z + GRID_H / 2 - 0.5);
  return {
    x: Math.max(0, Math.min(GRID_W - 1, tx)),
    y: Math.max(0, Math.min(GRID_H - 1, ty)),
  };
}

export function PlayerTileEmitter({ playerRef }: Props) {
  const engine = useEngine();
  const lastTileRef = useRef<{ x: number; y: number } | null>(null);

  // Seed the "last tile" to the engine's recorded player location so the
  // first tile-cross matches authority on boot (avoids spurious emit).
  useEffect(() => {
    lastTileRef.current = engine.state.player.location;
  }, [engine.state.player]);

  useFrame(() => {
    const p = playerRef.current;
    if (!p) return;
    const tile = worldToTile(p.pos.x, p.pos.z);
    const last = lastTileRef.current;
    if (last && last.x === tile.x && last.y === tile.y) return;

    lastTileRef.current = tile;
    // Sync engine player location so save/load + other systems see it
    engine.setPlayer({ ...engine.state.player, location: tile });
    // Emit reach_tile for quest objectives that care
    window.__lendsteadEmitEvent?.({
      kind: 'reach_tile',
      payload: { x: tile.x, y: tile.y },
    });
  });

  return null;
}
