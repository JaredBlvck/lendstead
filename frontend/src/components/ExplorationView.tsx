import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { NPC, World } from '../types';
import {
  GRID_W,
  GRID_H,
  generateTerrain,
  type Tile,
  type TileType,
} from '../lib/terrain';

// Phase 1 prototype: terrain heightmap + NPC placeholders + orbit camera.
// Reads directly from backend state, adds nothing to engine contract.
// This layer is purely visual - 2D dashboard continues to own interactivity.

const TILE_TO_COLOR: Record<TileType, string> = {
  water: '#1f4e6c',
  beach: '#caa86c',
  plains: '#4e5f36',
  forest: '#2d4a28',
  mountain: '#6b6b72',
};

// World units per tile on the 3D plane.
const UNIT = 2;
const MAX_ELEVATION = 5;

function Terrain({ tiles }: { tiles: Tile[] }) {
  const geom = useMemo(() => {
    // One plane tile at a time instead of a single displaced mesh - cheaper
    // and lets us set per-tile colors without writing a vertex shader.
    const g = new THREE.BoxGeometry(UNIT, 1, UNIT);
    return g;
  }, []);

  const group = useRef<THREE.Group>(null);

  // Colored instance matrices per tile type (grouped so we don't create
  // 960 separate materials). For the MVP we create 5 meshes (one per tile
  // type) with instanced rendering.
  const instancedByType = useMemo(() => {
    const byType = new Map<TileType, Tile[]>();
    tiles.forEach((t) => {
      if (!byType.has(t.type)) byType.set(t.type, []);
      byType.get(t.type)!.push(t);
    });
    return byType;
  }, [tiles]);

  useEffect(() => {
    if (!group.current) return;
    group.current.clear();

    instancedByType.forEach((group_tiles, type) => {
      const mat = new THREE.MeshStandardMaterial({
        color: TILE_TO_COLOR[type],
        roughness: type === 'water' ? 0.15 : 0.85,
        metalness: 0,
        transparent: type === 'water',
        opacity: type === 'water' ? 0.85 : 1,
      });
      const mesh = new THREE.InstancedMesh(geom, mat, group_tiles.length);
      mesh.castShadow = type !== 'water';
      mesh.receiveShadow = true;

      const m = new THREE.Matrix4();
      group_tiles.forEach((tile, i) => {
        const h = type === 'water' ? 0.05 : Math.max(0.2, tile.height * MAX_ELEVATION);
        const x = (tile.x - GRID_W / 2) * UNIT;
        const z = (tile.y - GRID_H / 2) * UNIT;
        m.makeTranslation(x, h / 2, z);
        m.scale(new THREE.Vector3(1, h, 1));
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.current!.add(mesh);
    });
  }, [instancedByType, geom]);

  return <group ref={group} />;
}

interface NPCMarkerProps {
  npc: NPC;
  tileHeight: number;
}

function NPCMarker({ npc, tileHeight }: NPCMarkerProps) {
  const mesh = useRef<THREE.Mesh>(null);
  // NPCs gently bob in place as an "alive" indicator
  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.position.y =
        Math.max(0.4, tileHeight) + 0.4 + Math.sin(clock.elapsedTime * 2 + npc.id) * 0.08;
    }
  });

  const x = ((npc.x ?? 0) - GRID_W / 2) * UNIT;
  const z = ((npc.y ?? 0) - GRID_H / 2) * UNIT;
  const color = npc.lane === 'sr' ? '#fb923c' : '#38bdf8';

  return (
    <group position={[x, 0, z]}>
      {/* Body capsule-like (cylinder + sphere approximation) */}
      <mesh ref={mesh} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.8, 10]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Head */}
      <mesh position={[0, Math.max(0.4, tileHeight) + 1.0, 0]} castShadow>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[30, 40, 20]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-GRID_W}
        shadow-camera-right={GRID_W}
        shadow-camera-top={GRID_H}
        shadow-camera-bottom={-GRID_H}
      />
    </>
  );
}

function WaterPlane() {
  // Big water plane under the whole grid for that "island in a sea" feel
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[GRID_W * UNIT * 3, GRID_H * UNIT * 3]} />
      <meshStandardMaterial color="#13263d" transparent opacity={0.9} roughness={0.1} />
    </mesh>
  );
}

interface Props {
  world: World;
  npcs: NPC[];
  onExit: () => void;
}

export function ExplorationView({ world, npcs, onExit }: Props) {
  const tiles = useMemo<Tile[]>(() => {
    if (world.terrain && world.terrain.length === GRID_W * GRID_H) {
      return world.terrain.map((t) => ({
        x: t.x,
        y: t.y,
        type: (t.type as TileType) || 'plains',
        height: t.height ?? 0.3,
      }));
    }
    return generateTerrain(world.civ_name);
  }, [world.terrain, world.civ_name]);

  // Build a fast height lookup for NPC placement
  const heightAt = useMemo(() => {
    const map = new Map<string, number>();
    tiles.forEach((t) => {
      const h = t.type === 'water' ? 0.05 : Math.max(0.2, t.height * MAX_ELEVATION);
      map.set(`${t.x},${t.y}`, h);
    });
    return map;
  }, [tiles]);

  const aliveNPCs = npcs.filter(
    (n) => n.alive && n.x != null && n.y != null && n.condition !== 'dead',
  );

  return (
    <div className="exploration">
      <div className="exploration-hud">
        <div className="hud-left">
          <div className="hud-title">{world.civ_name}</div>
          <div className="hud-sub">
            Cycle {world.cycle} &middot; {aliveNPCs.length} alive &middot; 3D Exploration
          </div>
        </div>
        <div className="hud-right">
          <div className="hud-help">
            drag to orbit &middot; scroll to zoom &middot; right-drag to pan
          </div>
          <button className="hud-exit" onClick={onExit}>
            ← Back to 2D
          </button>
        </div>
      </div>
      <Canvas
        shadows
        camera={{ position: [GRID_W * 0.4, GRID_H * 0.6, GRID_H * 0.9], fov: 55 }}
        style={{ background: '#081422' }}
      >
        <Sky
          sunPosition={[100, 60, 50]}
          turbidity={7}
          rayleigh={2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
        <SceneLighting />
        <WaterPlane />
        <Terrain tiles={tiles} />
        {aliveNPCs.map((npc) => (
          <NPCMarker
            key={npc.id}
            npc={npc}
            tileHeight={heightAt.get(`${npc.x},${npc.y}`) ?? 0.5}
          />
        ))}
        <OrbitControls
          makeDefault
          minDistance={5}
          maxDistance={180}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
