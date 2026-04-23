import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PointerLockControls, Sky } from '@react-three/drei';
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { NPC, World } from '../types';
import {
  GRID_W,
  GRID_H,
  generateTerrain,
  type Tile,
  type TileType,
} from '../lib/terrain';
import { useEvents } from '../hooks/useWorld';
import { buildDisplayEvents, type DisplayEvent } from '../lib/events';

// v6.1 Phase 2+3+4: FPS walk mode, live NPC sync with tween, structures.

const TILE_TO_COLOR: Record<TileType, string> = {
  water: '#1f4e6c',
  beach: '#caa86c',
  plains: '#4e5f36',
  forest: '#2d4a28',
  mountain: '#6b6b72',
};

const UNIT = 2;
const MAX_ELEVATION = 5;

type CamMode = 'orbit' | 'fps';

// ---------- TERRAIN (unchanged from v6.0 + return a height map) ----------

function Terrain({ tiles }: { tiles: Tile[] }) {
  const group = useRef<THREE.Group>(null);
  const geom = useMemo(() => new THREE.BoxGeometry(UNIT, 1, UNIT), []);

  const byType = useMemo(() => {
    const m = new Map<TileType, Tile[]>();
    tiles.forEach((t) => {
      if (!m.has(t.type)) m.set(t.type, []);
      m.get(t.type)!.push(t);
    });
    return m;
  }, [tiles]);

  useEffect(() => {
    if (!group.current) return;
    group.current.clear();
    byType.forEach((typedTiles, type) => {
      const mat = new THREE.MeshStandardMaterial({
        color: TILE_TO_COLOR[type],
        roughness: type === 'water' ? 0.15 : 0.85,
        metalness: 0,
        transparent: type === 'water',
        opacity: type === 'water' ? 0.85 : 1,
      });
      const mesh = new THREE.InstancedMesh(geom, mat, typedTiles.length);
      mesh.castShadow = type !== 'water';
      mesh.receiveShadow = true;
      const m = new THREE.Matrix4();
      typedTiles.forEach((tile, i) => {
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
  }, [byType, geom]);

  return <group ref={group} />;
}

// ---------- NPC MARKER WITH LIVE TWEEN (Phase 3) ----------

interface NPCMarkerProps {
  npc: NPC;
  tileHeight: number;
}

function NPCMarker({ npc, tileHeight }: NPCMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);

  // Target position in world space - tweens toward this when npc.x/y change.
  const targetPos = useMemo(() => {
    const x = ((npc.x ?? 0) - GRID_W / 2) * UNIT;
    const z = ((npc.y ?? 0) - GRID_H / 2) * UNIT;
    return new THREE.Vector3(x, 0, z);
  }, [npc.x, npc.y]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    // Lerp toward target (matches the 2D ~1.5s tween feel with slightly
    // faster response because 3D positions update every 60s cycle).
    const SPEED = 0.8; // higher = snappier
    groupRef.current.position.x += (targetPos.x - groupRef.current.position.x) * Math.min(1, SPEED * delta);
    groupRef.current.position.z += (targetPos.z - groupRef.current.position.z) * Math.min(1, SPEED * delta);

    // Bob head
    if (headRef.current) {
      const bob = Math.sin(clock.elapsedTime * 2 + npc.id) * 0.08;
      headRef.current.position.y = Math.max(0.4, tileHeight) + 1.0 + bob;
    }
  });

  const color = npc.lane === 'sr' ? '#fb923c' : '#38bdf8';
  const dim = npc.condition === 'injured' || npc.condition === 'incapacitated';
  const finalColor = dim ? new THREE.Color(color).lerp(new THREE.Color('#7a7a7a'), 0.55).getStyle() : color;

  return (
    <group ref={groupRef} position={targetPos}>
      <mesh position={[0, Math.max(0.4, tileHeight) + 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.8, 10]} />
        <meshStandardMaterial color={finalColor} roughness={0.6} />
      </mesh>
      <mesh ref={headRef} position={[0, Math.max(0.4, tileHeight) + 1.0, 0]} castShadow>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color={finalColor} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ---------- STRUCTURES (Phase 4) ----------

interface StructurePlacement {
  key: string;
  x: number;
  y: number;
  label: string;
}

function layoutStructures(infra: Record<string, unknown>): StructurePlacement[] {
  const out: StructurePlacement[] = [];
  const push = (key: string, x: number, y: number, label: string) =>
    out.push({ key, x, y, label });
  push('central_camp', GRID_W * 0.5, GRID_H * 0.5, 'camp');
  for (const [k, v] of Object.entries(infra || {})) {
    const valStr = Array.isArray(v) ? v.join(' ') : String(v);
    if (/palisade/i.test(k)) push(k, GRID_W * 0.45, GRID_H * 0.85, 'palisade');
    else if (/storm_shelter_nw/i.test(k)) push(k, GRID_W * 0.28, GRID_H * 0.28, 'NW shelter');
    else if (/storm_shelter_ember/i.test(k)) push(k, 18, 12, 'Ember shelter');
    else if (/storm_shelter_e_coast/i.test(k)) push(k, 24, 13, 'E shelter');
    else if (/w_coast|storm_shelter_w/i.test(k)) push(k, 4, 14, 'W shelter');
    else if (/storm_shelter/i.test(k)) push(k, GRID_W * 0.42, GRID_H * 0.82, 'shelter');
    else if (/n_watch|watch_post/i.test(k)) push(k, GRID_W * 0.5, GRID_H * 0.25, 'watch');
    else if (/ember_spring_station|ember_spring/i.test(k)) push(k, 18, 12, 'Ember Spring');
    else if (/smithy|forge/i.test(k)) push(k, GRID_W * 0.54, GRID_H * 0.48, 'smithy');
    else if (/cistern/i.test(valStr) || /cistern|well/i.test(k)) push('cistern', GRID_W * 0.5, GRID_H * 0.52, 'cistern');
    else if (/outpost/i.test(k)) push(k, GRID_W * 0.42, GRID_H * 0.78, 'outpost');
    else if (/granary/i.test(valStr) || /granary/i.test(k)) push('granary', GRID_W * 0.48, GRID_H * 0.48, 'granary');
    else if (/drying/i.test(k)) push(k, GRID_W * 0.52, GRID_H * 0.52, 'drying');
  }
  return out;
}

function Structure({ placement, heightMap }: { placement: StructurePlacement; heightMap: Map<string, number> }) {
  const { key, x, y } = placement;
  const tileKey = `${Math.round(x)},${Math.round(y)}`;
  const baseY = heightMap.get(tileKey) ?? 0.5;
  const wx = (x - GRID_W / 2) * UNIT;
  const wz = (y - GRID_H / 2) * UNIT;

  const smithyFire = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (smithyFire.current) {
      const flicker = 0.7 + Math.sin(clock.elapsedTime * 8) * 0.3;
      (smithyFire.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker;
    }
  });

  if (/palisade/.test(key)) {
    return (
      <group position={[wx, baseY, wz]}>
        {[-1.5, -0.5, 0.5, 1.5].map((offset, i) => (
          <mesh key={i} position={[offset, 0.6, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.15, 1.2, 6]} />
            <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
          </mesh>
        ))}
      </group>
    );
  }
  if (/smithy|forge/.test(key)) {
    return (
      <group position={[wx, baseY, wz]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.35, 0]} castShadow>
          <coneGeometry args={[1.0, 0.8, 4]} />
          <meshStandardMaterial color="#6b4a2a" roughness={0.85} />
        </mesh>
        <mesh ref={smithyFire} position={[0, 0.6, 0.5]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial
            color="#ff6a1a"
            emissive="#ff3a00"
            emissiveIntensity={1}
          />
        </mesh>
        <pointLight
          position={[0, 0.6, 0.5]}
          color="#ff8040"
          intensity={0.8}
          distance={4}
        />
      </group>
    );
  }
  if (/cistern|well|spring/.test(key)) {
    return (
      <group position={[wx, baseY, wz]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.55, 0.6, 12]} />
          <meshStandardMaterial color="#6b6b72" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.02, 16]} />
          <meshStandardMaterial
            color="#2a7a9a"
            transparent
            opacity={0.8}
            roughness={0.15}
          />
        </mesh>
      </group>
    );
  }
  if (/watch|tower/.test(key)) {
    return (
      <group position={[wx, baseY, wz]}>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 2.0, 6]} />
          <meshStandardMaterial color="#6b5a3a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.0, 0]} castShadow>
          <boxGeometry args={[0.8, 0.15, 0.8]} />
          <meshStandardMaterial color="#8a7a5a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.35, 0]} castShadow>
          <coneGeometry args={[0.6, 0.5, 4]} />
          <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
        </mesh>
      </group>
    );
  }
  if (/outpost|camp|central/.test(key)) {
    return (
      <group position={[wx, baseY, wz]}>
        <mesh position={[-0.35, 0.5, 0]} castShadow>
          <coneGeometry args={[0.5, 1.0, 4]} />
          <meshStandardMaterial color="#9a7a5a" roughness={0.85} />
        </mesh>
        <mesh position={[0.35, 0.4, 0.25]} castShadow>
          <coneGeometry args={[0.4, 0.8, 4]} />
          <meshStandardMaterial color="#9a7a5a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial
            color="#ff6a1a"
            emissive="#ff3a00"
            emissiveIntensity={0.9}
          />
        </mesh>
      </group>
    );
  }
  // Generic tent
  return (
    <group position={[wx, baseY, wz]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <coneGeometry args={[0.45, 1.0, 4]} />
        <meshStandardMaterial color="#9a7a5a" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ---------- EVENT MARKERS (Phase 5) ----------
//
// Lightweight 3D representations of storm / discovery / threat events.
// Uses point lights + simple geometry so we don't bloat the scene with
// particle systems. Each event gets a pulse animation driven off the
// display event's age.

function EventMarker({ evt, baseHeight }: { evt: DisplayEvent; baseHeight: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const x = (evt.x - GRID_W / 2) * UNIT;
  const z = (evt.y - GRID_H / 2) * UNIT;
  const color =
    evt.kind === 'discovery' ? '#5eead4' :
    evt.kind === 'threat'    ? '#ef4444' :
                               '#5080b0';

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4);
    groupRef.current.scale.setScalar(0.8 + pulse * 0.4);
  });

  if (evt.kind === 'storm') {
    // Dark dome over affected area + subtle rain column sprite
    return (
      <group position={[x, baseHeight + 0.5, z]}>
        <mesh>
          <sphereGeometry args={[evt.radius * UNIT * 0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#1a1f2a"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[x, baseHeight + 0.5, z]}>
      {/* Vertical beam of light */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.15, 0.05, 4, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={evt.kind === 'threat' ? 2 : 1.5}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Rising orb */}
      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
        />
      </mesh>
      {/* Ground-level light source to illuminate surroundings */}
      <pointLight
        position={[0, 1.5, 0]}
        color={color}
        intensity={1.2}
        distance={6}
      />
    </group>
  );
}

// ---------- FPS CONTROLLER ----------

function FPSController({ heightAt, enabled }: { heightAt: Map<string, number>; enabled: boolean }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!enabled) return;
    // Position camera on the island surface when entering FPS
    camera.position.set(0, 3, 0);
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled, camera]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const BASE_SPEED = 6;
    const SPRINT = keys.current['ShiftLeft'] || keys.current['ShiftRight'] ? 2.2 : 1;
    const speed = BASE_SPEED * SPRINT;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));

    velocity.current.set(0, 0, 0);
    if (keys.current['KeyW'] || keys.current['ArrowUp']) velocity.current.add(fwd);
    if (keys.current['KeyS'] || keys.current['ArrowDown']) velocity.current.sub(fwd);
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) velocity.current.sub(right);
    if (keys.current['KeyD'] || keys.current['ArrowRight']) velocity.current.add(right);
    if (velocity.current.lengthSq() > 0) {
      velocity.current.normalize().multiplyScalar(speed * delta);
      camera.position.x += velocity.current.x;
      camera.position.z += velocity.current.z;
    }

    // Clamp to grid bounds
    const halfX = (GRID_W / 2) * UNIT - 1;
    const halfZ = (GRID_H / 2) * UNIT - 1;
    camera.position.x = Math.max(-halfX - 20, Math.min(halfX + 20, camera.position.x));
    camera.position.z = Math.max(-halfZ - 20, Math.min(halfZ + 20, camera.position.z));

    // Terrain-follow: sample nearest tile height, camera eye level = tile + 1.7
    const tx = Math.round(camera.position.x / UNIT + GRID_W / 2);
    const tz = Math.round(camera.position.z / UNIT + GRID_H / 2);
    const h = heightAt.get(`${tx},${tz}`);
    if (h != null) {
      const target = h + 1.7;
      camera.position.y += (target - camera.position.y) * Math.min(1, 8 * delta);
    } else {
      // Over water, sit low
      camera.position.y += (0.5 - camera.position.y) * Math.min(1, 8 * delta);
    }
  });

  return null;
}

// ---------- LIGHTING / WATER / SCENE SHELL ----------

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
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[GRID_W * UNIT * 3, GRID_H * UNIT * 3]} />
      <meshStandardMaterial color="#13263d" transparent opacity={0.9} roughness={0.1} />
    </mesh>
  );
}

// ---------- TOP-LEVEL VIEW ----------

interface Props {
  world: World;
  npcs: NPC[];
  onExit: () => void;
}

export function ExplorationView({ world, npcs, onExit }: Props) {
  const [mode, setMode] = useState<CamMode>('orbit');
  const [locked, setLocked] = useState(false);

  const eventsQuery = useEvents();
  const firstSeenRef = useRef<Map<number, number>>(new Map());
  const [displayEvents, setDisplayEvents] = useState<DisplayEvent[]>([]);

  useEffect(() => {
    const rebuild = () => {
      const now = performance.now();
      setDisplayEvents(buildDisplayEvents(eventsQuery.data ?? [], firstSeenRef.current, now));
    };
    rebuild();
    const id = window.setInterval(rebuild, 1500);
    return () => window.clearInterval(id);
  }, [eventsQuery.data]);

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

  const heightAt = useMemo(() => {
    const map = new Map<string, number>();
    tiles.forEach((t) => {
      const h = t.type === 'water' ? 0.05 : Math.max(0.2, t.height * MAX_ELEVATION);
      map.set(`${t.x},${t.y}`, h);
    });
    return map;
  }, [tiles]);

  const structures = useMemo(
    () => layoutStructures(world.infrastructure as unknown as Record<string, unknown>),
    [world.infrastructure],
  );

  const aliveNPCs = npcs.filter(
    (n) => n.alive && n.x != null && n.y != null && n.condition !== 'dead',
  );

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'orbit' ? 'fps' : 'orbit'));
    setLocked(false);
  }, []);

  // Esc from FPS -> back to orbit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && mode === 'fps') {
        setMode('orbit');
        setLocked(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  return (
    <div className="exploration">
      <div className="exploration-hud">
        <div className="hud-left">
          <div className="hud-title">{world.civ_name}</div>
          <div className="hud-sub">
            Cycle {world.cycle} &middot; {aliveNPCs.length} alive &middot;{' '}
            {mode === 'orbit' ? 'Orbit view' : 'First-person'}
          </div>
        </div>
        <div className="hud-right">
          <div className="hud-help">
            {mode === 'orbit'
              ? 'drag to orbit · scroll to zoom · right-drag to pan'
              : locked
                ? 'WASD to move · shift to sprint · Esc to orbit'
                : 'click canvas to lock pointer + move'}
          </div>
          <button className="mode-toggle" onClick={toggleMode}>
            {mode === 'orbit' ? 'Walk Mode' : 'Orbit Mode'}
          </button>
          <button className="hud-exit" onClick={onExit}>
            ← Back to 2D
          </button>
        </div>
      </div>
      <Canvas
        shadows
        camera={{ position: [GRID_W * 0.4, GRID_H * 0.6, GRID_H * 0.9], fov: 65 }}
        style={{ background: '#081422' }}
        onClick={() => {
          if (mode === 'fps' && !locked) setLocked(true);
        }}
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
        {structures.map((s, i) => (
          <Structure key={`${s.key}-${i}`} placement={s} heightMap={heightAt} />
        ))}
        {displayEvents.map((evt) => (
          <EventMarker
            key={evt.id}
            evt={evt}
            baseHeight={heightAt.get(`${evt.x},${evt.y}`) ?? 0.5}
          />
        ))}
        {aliveNPCs.map((npc) => (
          <NPCMarker
            key={npc.id}
            npc={npc}
            tileHeight={heightAt.get(`${npc.x},${npc.y}`) ?? 0.5}
          />
        ))}
        {mode === 'orbit' ? (
          <OrbitControls
            makeDefault
            minDistance={5}
            maxDistance={180}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0, 0]}
          />
        ) : (
          <>
            <FPSController heightAt={heightAt} enabled={locked} />
            {locked && (
              <PointerLockControls
                onLock={() => setLocked(true)}
                onUnlock={() => setLocked(false)}
              />
            )}
          </>
        )}
      </Canvas>
    </div>
  );
}
