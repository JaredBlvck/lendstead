// Renders content NPCs (from engine.bundle.npcs) as visible, moving
// entities inside the existing ExplorationView Canvas. They wander
// using the shared pathfinder, click-to-talk opens dialogue.
//
// Keep rendering dead simple (capsule + nametag) so this is cheap to
// mount alongside the existing backend-driven NPCMarker set. Quad B's
// lore expresses through dialogue, not polygon budget.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useEngine } from '../engine/EngineContext';
import { bootNpcMover, tickNpcMovement, type NpcMoverBundle } from '../movement/npcMovement';
import type { Tile } from '../../lib/terrain';
import { GRID_W, GRID_H } from '../../lib/terrain';

interface Props {
  tiles: Tile[];
  heightAt: Map<string, number>;
}

// Translate tile coords (0..GRID_W, 0..GRID_H) into scene world coords.
// Matches the existing ExplorationView coordinate system: origin at
// grid center, X-east, Z-south.
function tileToWorld(x: number, y: number) {
  return {
    x: x - GRID_W / 2 + 0.5,
    z: y - GRID_H / 2 + 0.5,
  };
}

export function ContentNpcsInScene({ tiles, heightAt }: Props) {
  const engine = useEngine();
  const bundlesRef = useRef<Map<string, NpcMoverBundle>>(new Map());

  // Seed movers for each content NPC once tiles are known.
  useEffect(() => {
    if (tiles.length === 0) return;
    const next = new Map<string, NpcMoverBundle>();
    for (const npc of engine.bundle.npcs.all()) {
      const existing = bundlesRef.current.get(npc.id);
      if (existing) {
        next.set(npc.id, existing);
        continue;
      }
      // Place at home_location if walkable, else fall back to grid center
      const home = npc.home_location ?? { x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2) };
      const runtime = engine.state.npcRuntime.find((r) => r.npc_id === npc.id) ?? {
        npc_id: npc.id,
        current_location: home,
        movement_mode: npc.default_movement_mode,
        path: [],
        dialogue_state: npc.default_dialogue_state,
        memory_flags: [],
        relationship_with_player: 0,
        alive: true,
        schedule_phase: 0,
      };
      next.set(npc.id, bootNpcMover(npc, runtime, 1.8));
    }
    bundlesRef.current = next;
  }, [tiles, engine.bundle.npcs, engine.state.npcRuntime]);

  // Minimal per-NPC mesh state: position is a THREE.Vector3 ref we mutate.
  const meshRefs = useRef<Map<string, THREE.Group>>(new Map());

  // Advance movement every frame using the shared A*.
  useFrame((_, delta) => {
    if (tiles.length === 0) return;
    const clampedDelta = Math.min(0.1, delta);
    const playerLoc = engine.state.player.location;
    bundlesRef.current.forEach((bundle, id) => {
      const next = tickNpcMovement(bundle, tiles, clampedDelta, {
        player_location: playerLoc,
      });
      bundlesRef.current.set(id, next);

      // Update scene mesh to mover position (smooth floats)
      const mesh = meshRefs.current.get(id);
      if (!mesh) return;
      const w = tileToWorld(next.mover.position.x, next.mover.position.y);
      const h = heightAt.get(`${Math.round(next.mover.position.x)},${Math.round(next.mover.position.y)}`) ?? 0.3;
      mesh.position.x = w.x;
      mesh.position.y = h;
      mesh.position.z = w.z;
    });
  });

  const npcList = useMemo(() => engine.bundle.npcs.all(), [engine.bundle.npcs]);

  return (
    <>
      {npcList.map((npc) => {
        const home = npc.home_location ?? { x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2) };
        const initialW = tileToWorld(home.x, home.y);
        const initialH = heightAt.get(`${home.x},${home.y}`) ?? 0.3;
        return (
          <group
            key={npc.id}
            ref={(el) => {
              if (el) meshRefs.current.set(npc.id, el);
              else meshRefs.current.delete(npc.id);
            }}
            position={[initialW.x, initialH, initialW.z]}
            onPointerDown={(e) => {
              e.stopPropagation();
              window.__lendsteadTalkTo?.(npc.id);
            }}
          >
            {/* Body */}
            <mesh position={[0, 0.95, 0]} castShadow>
              <capsuleGeometry args={[0.22, 0.55, 4, 8]} />
              <meshStandardMaterial color="#c4a57a" roughness={0.7} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 1.48, 0]} castShadow>
              <sphereGeometry args={[0.18, 12, 10]} />
              <meshStandardMaterial color="#f4d4a8" roughness={0.5} />
            </mesh>
            {/* Nametag */}
            <Html
              center
              position={[0, 2.0, 0]}
              style={{ pointerEvents: 'none' }}
              distanceFactor={10}
            >
              <div style={{
                fontFamily: "'SF Mono', ui-monospace, monospace",
                fontSize: 11,
                color: '#e6edf7',
                background: 'rgba(10, 14, 20, 0.8)',
                padding: '2px 6px',
                borderRadius: 3,
                border: '1px solid #2c3442',
                whiteSpace: 'nowrap',
              }}>
                {npc.name}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
