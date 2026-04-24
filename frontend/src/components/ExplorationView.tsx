import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PointerLockControls, Sky, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
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
import { VirtualJoystick } from './VirtualJoystick';
import { audio } from '../lib/audio';
import { generateFlavor } from '../lib/flavor';
import {
  buildAbilityVFX,
  buildBreakthroughEvents,
  type AbilityVFX,
  type BreakthroughEvent,
} from '../lib/abilities';
import {
  buildInteractionVFX,
  buildSkillThresholdVFX,
  type InteractionVFX,
  type SkillThresholdVFX,
} from '../lib/interactions';
import { NPCInteractionLayer } from './NPCInteractionLayer';
import { SkillThresholdBanner } from './SkillThresholdBanner';
import {
  buildAffinityMilestoneVFX,
  type AffinityMilestoneVFX,
} from '../lib/affinity';
import { AffinityMilestoneBanner } from './AffinityMilestoneBanner';
import { BondedPairsLayer } from './BondedPairsLayer';
import { useAffinity } from '../hooks/useWorld';
import { ContentNpcsInScene } from '../game/scene/ContentNpcsInScene';
import { PlayerTileEmitter } from '../game/scene/PlayerTileEmitter';
import { RulerAvatar } from './RulerAvatar';
import { AbilityVFXLayer } from './AbilityVFXLayer';
import { BreakthroughBanner } from './BreakthroughBanner';
import { EnergyHUD } from './EnergyHUD';
import { aggregateMagicTraces } from '../lib/magicTraces';
import { AbilityTracesLayer } from './AbilityTracesLayer';
import { bubbleFor } from '../lib/chatBubbles';
import { ProgressionPanel } from './ProgressionPanel';
import { VerbMenu } from './VerbMenu';
import { useLogs } from '../hooks/useWorld';
import { TreasuryPanel } from './TreasuryPanel';
import { questFor, hasQuest, isQuestComplete } from '../lib/quests';
import { useQuests, useQuestTransition } from '../hooks/useWorld';

// Input state shared by keyboard + joystick + click-to-walk. FPSController
// reads this instead of a key map directly, so touch and mouse+keyboard
// both work. walkTarget is a one-shot - FPSController auto-moves toward
// it and clears on arrival.
const moveInput = { x: 0, y: 0 };
const lookInput = { yaw: 0, pitch: 0 };
const walkTarget: { x: number | null; z: number | null; setAt: number } = {
  x: null,
  z: null,
  setAt: 0,
};

function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && 'ontouchstart' in window;
}

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

type CamMode = 'orbit' | 'fps' | 'tp';

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
  onHover: (npc: NPC | null) => void;
  onClick: (npc: NPC) => void;
  onContextMenu?: (npc: NPC, screenX: number, screenY: number) => void;
  isSelected: boolean;
  bubbleText?: string;
  bubbleFadeMs?: number;
  showQuest?: boolean;
  questAccepted?: boolean;
}

function NPCMarker({ npc, tileHeight, onHover, onClick, onContextMenu, isSelected, bubbleText, bubbleFadeMs, showQuest, questAccepted }: NPCMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const prevPosRef = useRef({ x: 0, z: 0 });

  const targetPos = useMemo(() => {
    const x = ((npc.x ?? 0) - GRID_W / 2) * UNIT;
    const z = ((npc.y ?? 0) - GRID_H / 2) * UNIT;
    return new THREE.Vector3(x, 0, z);
  }, [npc.x, npc.y]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const SPEED = 0.8;
    const g = groupRef.current;
    const prev = prevPosRef.current;
    g.position.x += (targetPos.x - g.position.x) * Math.min(1, SPEED * delta);
    g.position.z += (targetPos.z - g.position.z) * Math.min(1, SPEED * delta);

    // Movement detection for walk cycle + facing
    const dx = g.position.x - prev.x;
    const dz = g.position.z - prev.z;
    const moving = dx * dx + dz * dz > 0.0001;
    if (moving) {
      const yaw = Math.atan2(dx, dz);
      const cy = g.rotation.y;
      let diff = yaw - cy;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.rotation.y = cy + diff * Math.min(1, 10 * delta);
    }
    prevPosRef.current = { x: g.position.x, z: g.position.z };

    const bob = Math.sin(clock.elapsedTime * 2 + npc.id) * 0.04;
    if (headRef.current) headRef.current.position.y = 1.42 + bob;

    // Walk cycle: legs + arms swing 180 degrees out of phase when moving,
    // subtle sway when idle
    const stridePhase = clock.elapsedTime * (moving ? 6 : 0.8) + npc.id;
    const strideAmp = moving ? 0.65 : 0.08;
    if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(stridePhase) * strideAmp;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.sin(stridePhase) * strideAmp;
    if (leftArmRef.current) leftArmRef.current.rotation.x = -Math.sin(stridePhase) * strideAmp * 0.85;
    if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(stridePhase) * strideAmp * 0.85;
  });

  const color = npc.lane === 'sr' ? '#fb923c' : '#38bdf8';
  const dim = npc.condition === 'injured' || npc.condition === 'incapacitated';
  const bodyColor = dim ? new THREE.Color(color).lerp(new THREE.Color('#7a7a7a'), 0.55).getStyle() : color;
  const legColor = '#2a2f3d';
  const skinColor = dim ? '#8a8a8a' : '#d4a684';
  const hairColor = dim ? '#5a5a5a' : '#2a1f15';

  const base = Math.max(0.4, tileHeight);

  return (
    <group
      ref={groupRef}
      position={targetPos}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(npc);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = '';
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick(npc);
      }}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.nativeEvent.preventDefault?.();
        const evt = (e as unknown as { nativeEvent: MouseEvent }).nativeEvent;
        onContextMenu(npc, evt.clientX, evt.clientY);
      }}
    >
      {/* Floating chat bubble above head */}
      {bubbleText && (
        <Html
          position={[0, Math.max(0.4, tileHeight) + 2.3, 0]}
          center
          distanceFactor={14}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="npc-chat-bubble"
            style={{ opacity: bubbleFadeMs != null ? Math.max(0, 1 - bubbleFadeMs / 4500) : 1 }}
          >
            {bubbleText}
          </div>
        </Html>
      )}
      {/* Quest indicator - pulsing yellow "?" or green "!" above head */}
      {showQuest && (
        <QuestIndicator baseY={Math.max(0.4, tileHeight) + 2.0} accepted={questAccepted ?? false} />
      )}
      {/* Selection ring under the feet */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, base + 0.06, 0]}>
          <ringGeometry args={[0.45, 0.6, 24]} />
          <meshStandardMaterial
            color="#fde047"
            emissive="#fde047"
            emissiveIntensity={1.5}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Body (torso) - lane-colored tunic */}
      <mesh position={[0, base + 0.95, 0]} castShadow>
        <boxGeometry args={[0.5, 0.55, 0.28]} />
        <meshStandardMaterial color={bodyColor} roughness={0.75} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, base + 1.42, 0]} castShadow>
        <boxGeometry args={[0.34, 0.32, 0.32]} />
        <meshStandardMaterial color={skinColor} roughness={0.55} />
      </mesh>

      {/* Role+skill tiered headwear */}
      <Headwear role={npc.role} skill={npc.skill} hairColor={hairColor} baseY={base + 1.6} laneColor={color} />

      {/* Eyes - tiny dark squares */}
      <mesh position={[-0.08, base + 1.44, 0.17]}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshStandardMaterial color="#0b0e14" />
      </mesh>
      <mesh position={[0.08, base + 1.44, 0.17]}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshStandardMaterial color="#0b0e14" />
      </mesh>

      {/* Left arm - pivoted at shoulder so rotation swings the whole arm */}
      <group ref={leftArmRef} position={[-0.34, base + 1.14, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color={bodyColor} roughness={0.75} />
        </mesh>
        {/* Hand tip */}
        <mesh position={[0, -0.58, 0]} castShadow>
          <boxGeometry args={[0.13, 0.1, 0.13]} />
          <meshStandardMaterial color={skinColor} roughness={0.55} />
        </mesh>
      </group>

      {/* Right arm */}
      <group ref={rightArmRef} position={[0.34, base + 1.14, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color={bodyColor} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.58, 0]} castShadow>
          <boxGeometry args={[0.13, 0.1, 0.13]} />
          <meshStandardMaterial color={skinColor} roughness={0.55} />
        </mesh>
      </group>

      {/* Left leg - pivot at hip */}
      <group ref={leftLegRef} position={[-0.14, base + 0.66, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.18, 0.55, 0.18]} />
          <meshStandardMaterial color={legColor} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.61, 0.04]} castShadow>
          <boxGeometry args={[0.2, 0.08, 0.24]} />
          <meshStandardMaterial color="#1a1f28" roughness={0.9} />
        </mesh>
      </group>

      {/* Right leg */}
      <group ref={rightLegRef} position={[0.14, base + 0.66, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.18, 0.55, 0.18]} />
          <meshStandardMaterial color={legColor} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.61, 0.04]} castShadow>
          <boxGeometry args={[0.2, 0.08, 0.24]} />
          <meshStandardMaterial color="#1a1f28" roughness={0.9} />
        </mesh>
      </group>

      {/* Lane badge - small glowing square on chest so team's visible at distance */}
      <mesh position={[0, base + 1.0, 0.15]}>
        <boxGeometry args={[0.12, 0.12, 0.02]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Role-specific prop - gives each archetype a readable silhouette */}
      <RoleProp role={npc.role} base={base} />
    </group>
  );
}

// Floating quest mark over NPC head - "?" for unaccepted, "!" for accepted
function QuestIndicator({ baseY, accepted }: { baseY: number; accepted: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = baseY + Math.sin(clock.elapsedTime * 2.5) * 0.12;
    ref.current.rotation.y = clock.elapsedTime * 1.5;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 2.5 + Math.sin(clock.elapsedTime * 4) * 0.8;
  });
  const color = accepted ? '#22c55e' : '#fde047';
  return (
    <>
      <mesh ref={ref} position={[0, baseY, 0]}>
        <torusGeometry args={[0.13, 0.05, 8, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
        />
      </mesh>
      <mesh position={[0, baseY - 0.08, 0]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
        />
      </mesh>
    </>
  );
}

function Headwear({ role, skill, hairColor, baseY, laneColor }: {
  role: string;
  skill: number;
  hairColor: string;
  baseY: number;
  laneColor: string;
}) {
  const ornate = skill >= 6;
  if (/scout|watcher|ranger|sentry|mapper|explorer/i.test(role)) {
    return (
      <>
        <mesh position={[0, baseY, -0.05]} castShadow>
          <boxGeometry args={[0.4, 0.14, 0.4]} />
          <meshStandardMaterial color={ornate ? '#4a2e1a' : hairColor} roughness={0.85} />
        </mesh>
        {ornate && (
          <mesh position={[0, baseY + 0.1, 0]}>
            <coneGeometry args={[0.04, 0.12, 4]} />
            <meshStandardMaterial color={laneColor} emissive={laneColor} emissiveIntensity={1.5} />
          </mesh>
        )}
      </>
    );
  }
  if (/carpenter|toolmaker|potter|organizer|inland|marker|prospector|hauler|healer/i.test(role)) {
    return ornate ? (
      <mesh position={[0, baseY, 0]} castShadow>
        <boxGeometry args={[0.38, 0.18, 0.36]} />
        <meshStandardMaterial color="#6b7280" roughness={0.4} metalness={0.6} />
      </mesh>
    ) : (
      <mesh position={[0, baseY - 0.02, 0.08]} castShadow>
        <boxGeometry args={[0.38, 0.1, 0.2]} />
        <meshStandardMaterial color={hairColor} roughness={0.65} />
      </mesh>
    );
  }
  if (/forager|fisher|gatherer|shore|tide|trader/i.test(role)) {
    return (
      <>
        <mesh position={[0, baseY, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.26, 0.03, 12]} />
          <meshStandardMaterial color="#c4a260" roughness={0.9} />
        </mesh>
        <mesh position={[0, baseY + 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.16, 0.1, 10]} />
          <meshStandardMaterial color="#c4a260" roughness={0.9} />
        </mesh>
      </>
    );
  }
  if (ornate) {
    return (
      <mesh position={[0, baseY - 0.04, 0]}>
        <torusGeometry args={[0.2, 0.025, 6, 12]} />
        <meshStandardMaterial color={laneColor} emissive={laneColor} emissiveIntensity={1.2} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, baseY, 0]} castShadow>
      <boxGeometry args={[0.36, 0.12, 0.34]} />
      <meshStandardMaterial color={hairColor} roughness={0.65} />
    </mesh>
  );
}

function RoleProp({ role, base }: { role: string; base: number }) {
  // Scouts carry a spear strapped to the back
  if (/scout|watcher|ranger|sentry|mapper|explorer/i.test(role)) {
    return (
      <group position={[0.12, base + 1.2, -0.2]} rotation={[0.3, 0, -0.15]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.025, 0.025, 1.0, 6]} />
          <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.55, 0]} castShadow>
          <coneGeometry args={[0.06, 0.18, 4]} />
          <meshStandardMaterial color="#c0c6d2" roughness={0.35} metalness={0.7} />
        </mesh>
      </group>
    );
  }
  // Builders carry a hammer in right hand
  if (/carpenter|toolmaker|potter|organizer|inland|marker|prospector|hauler|healer/i.test(role)) {
    return (
      <group position={[0.42, base + 0.7, 0.06]} rotation={[0, 0, -0.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.35, 6]} />
          <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.08]} />
          <meshStandardMaterial color="#555a63" roughness={0.5} metalness={0.5} />
        </mesh>
      </group>
    );
  }
  // Runners carry a small pack on their back
  if (/runner|courier/i.test(role)) {
    return (
      <mesh position={[0, base + 1.0, -0.18]} castShadow>
        <boxGeometry args={[0.32, 0.3, 0.14]} />
        <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
      </mesh>
    );
  }
  // Foragers/fishers carry a basket at hip
  if (/forager|fisher|gatherer|shore|tide|trader/i.test(role)) {
    return (
      <mesh position={[0.38, base + 0.8, 0.05]} castShadow>
        <cylinderGeometry args={[0.15, 0.13, 0.22, 8]} />
        <meshStandardMaterial color="#a16207" roughness={0.9} />
      </mesh>
    );
  }
  return null;
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

function Structure({
  placement,
  heightMap,
  onClick,
}: {
  placement: StructurePlacement;
  heightMap: Map<string, number>;
  onClick?: (p: StructurePlacement) => void;
}) {
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

  const groupProps = onClick
    ? {
        onPointerOver: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        },
        onPointerOut: () => { document.body.style.cursor = ''; },
        onPointerDown: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onClick(placement);
        },
      }
    : {};

  if (/palisade/.test(key)) {
    return (
      <group position={[wx, baseY, wz]} {...groupProps}>
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
      <group position={[wx, baseY, wz]} {...groupProps}>
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
      <group position={[wx, baseY, wz]} {...groupProps}>
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
      <group position={[wx, baseY, wz]} {...groupProps}>
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
    // Central camp handled as Temple at top level in ExplorationView
    // (needs world energy access). Skip here.
    if (/central/i.test(key)) return null;
    return (
      <group position={[wx, baseY, wz]} {...groupProps}>
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
    <group position={[wx, baseY, wz]} {...groupProps}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <coneGeometry args={[0.45, 1.0, 4]} />
        <meshStandardMaterial color="#9a7a5a" roughness={0.85} />
      </mesh>
    </group>
  );
}

// Large invisible pickable plane for click/tap-to-walk raycasting. Sits
// at y=0 under the terrain so clicks on any tile intersect it (3D tile
// boxes also intersect, but we only care about xz - height-follow in
// FPSController handles y on arrival).
function WalkTargetPicker({ enabled, onSet }: { enabled: boolean; onSet?: () => void }) {
  const markerRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!markerRef.current) return;
    if (walkTarget.x == null) {
      markerRef.current.visible = false;
      return;
    }
    markerRef.current.visible = true;
    markerRef.current.position.x = walkTarget.x;
    markerRef.current.position.z = walkTarget.z!;
    const pulse = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 6);
    markerRef.current.scale.setScalar(pulse);
  });

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerDown={(e) => {
          if (!enabled) return;
          e.stopPropagation();
          walkTarget.x = e.point.x;
          walkTarget.z = e.point.z;
          walkTarget.setAt = performance.now();
          onSet?.();
        }}
      >
        <planeGeometry args={[GRID_W * UNIT * 3, GRID_H * UNIT * 3]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh ref={markerRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.55, 24]} />
        <meshStandardMaterial
          color="#5eead4"
          emissive="#5eead4"
          emissiveIntensity={1.5}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

// ---------- EVENT MARKERS (Phase 5) ----------
//
// Lightweight 3D representations of storm / discovery / threat events.
// Uses point lights + simple geometry so we don't bloat the scene with
// particle systems. Each event gets a pulse animation driven off the
// display event's age.

// Storm effect: darkening dome + falling rain particles + internal
// lightning flicker. Particles re-emit when they hit the ground so the
// storm rains continuously without allocating new geometry per frame.
function StormEffect({ x, z, baseHeight, radius }: { x: number; z: number; baseHeight: number; radius: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const lightningRef = useRef<THREE.Mesh>(null);

  const rainGeom = useMemo(() => {
    const N = 180;
    const pos = new Float32Array(N * 3);
    const r = radius * UNIT;
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      pos[i * 3] = Math.cos(a) * d;
      pos[i * 3 + 1] = Math.random() * 8 + 2;
      pos[i * 3 + 2] = Math.sin(a) * d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [radius]);

  useFrame(({ clock }, delta) => {
    if (pointsRef.current) {
      const pos = rainGeom.attributes.position.array as Float32Array;
      const r = radius * UNIT;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] -= delta * 12;
        if (pos[i * 3 + 1] < -0.5) {
          pos[i * 3 + 1] = 8 + Math.random() * 2;
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * r;
          pos[i * 3] = Math.cos(a) * d;
          pos[i * 3 + 2] = Math.sin(a) * d;
        }
      }
      rainGeom.attributes.position.needsUpdate = true;
    }
    // Occasional lightning flash
    if (lightningRef.current) {
      const flash = Math.sin(clock.elapsedTime * 3.7) > 0.94 ? 1 : 0;
      (lightningRef.current.material as THREE.MeshStandardMaterial).opacity = flash * 0.6;
    }
  });

  return (
    <group position={[x, baseHeight + 0.5, z]}>
      {/* Dark dome */}
      <mesh>
        <sphereGeometry args={[radius * UNIT * 0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#1a1f2a"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Rain particles */}
      <points ref={pointsRef} geometry={rainGeom}>
        <pointsMaterial
          color="#b4c5d4"
          size={0.08}
          transparent
          opacity={0.6}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      {/* Lightning flash plane */}
      <mesh ref={lightningRef} position={[0, radius * 0.3, 0]}>
        <sphereGeometry args={[radius * UNIT * 0.5, 8, 4]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#e8f1ff"
          emissiveIntensity={3}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function EventMarker({ evt, baseHeight }: { evt: DisplayEvent; baseHeight: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const x = (evt.x - GRID_W / 2) * UNIT;
  const z = (evt.y - GRID_H / 2) * UNIT;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (evt.kind === 'storm') return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3);
    groupRef.current.scale.setScalar(0.92 + pulse * 0.12);
  });

  if (evt.kind === 'storm') {
    return <StormEffect x={x} z={z} baseHeight={baseHeight} radius={evt.radius} />;
  }

  if (evt.kind === 'discovery') {
    // Campfire marker - stone ring + wood + emissive fire + glow light
    return (
      <group ref={groupRef} position={[x, baseHeight + 0.05, z]}>
        {/* Stone ring */}
        <mesh position={[0, 0.08, 0]}>
          <torusGeometry args={[0.5, 0.12, 8, 16]} />
          <meshStandardMaterial color="#6b6b72" roughness={0.9} />
        </mesh>
        {/* Logs crossed */}
        <mesh position={[0, 0.18, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.7, 0.1, 0.1]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.18, 0]} rotation={[0, Math.PI / 2, -0.3]}>
          <boxGeometry args={[0.7, 0.1, 0.1]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.9} />
        </mesh>
        {/* Flame */}
        <mesh position={[0, 0.4, 0]}>
          <coneGeometry args={[0.22, 0.45, 8]} />
          <meshStandardMaterial
            color="#ff9a2a"
            emissive="#ff7a10"
            emissiveIntensity={2.5}
            transparent
            opacity={0.92}
          />
        </mesh>
        {/* Inner bright core */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial
            color="#ffe080"
            emissive="#ffe080"
            emissiveIntensity={3.5}
          />
        </mesh>
        <pointLight position={[0, 0.6, 0]} color="#ff9a40" intensity={1.4} distance={7} />
      </group>
    );
  }

  // threat: red warning cairn - spiked rock pile
  return (
    <group ref={groupRef} position={[x, baseHeight + 0.05, z]}>
      {/* Base rock */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <dodecahedronGeometry args={[0.45]} />
        <meshStandardMaterial color="#4a2020" roughness={0.9} />
      </mesh>
      {/* Top warning stone with emissive red */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <octahedronGeometry args={[0.3]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={1.5}
          roughness={0.4}
        />
      </mesh>
      <pointLight position={[0, 0.8, 0]} color="#ef4444" intensity={1.0} distance={5} />
    </group>
  );
}

// ---------- TEMPLE (central focal point) ----------
// Three-stepped stone pyramid with an emissive spire and rising particle
// sparks. The dominant structure on the island - visible from anywhere
// thanks to height + bloom.
function Temple({
  position,
  energyLevel = 0.5,
}: {
  position: [number, number, number];
  energyLevel?: number;
}) {
  const spireRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Rising particle cloud
  const particleGeom = useMemo(() => {
    const N = 40;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.6;
      pos[i * 3 + 1] = Math.random() * 2.0;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame(({ clock }, delta) => {
    if (spireRef.current) {
      // Intensity scales with energy (normalized 0..1). High energy = bright
      // fast-rotating spire; depleted = dim slow rotation.
      const base = 1.2 + energyLevel * 2.5;
      const pulse = base + Math.sin(clock.elapsedTime * (1.5 + energyLevel * 2)) * (0.4 + energyLevel * 0.6);
      (spireRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
      spireRef.current.rotation.y += delta * (0.2 + energyLevel * 0.6);
    }
    if (particlesRef.current) {
      const pos = particleGeom.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 1] += delta * (0.4 + (i % 7) * 0.05);
        if (pos[i * 3 + 1] > 3.5) {
          pos[i * 3 + 1] = 0;
          pos[i * 3] = (Math.random() - 0.5) * 0.6;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        }
      }
      particleGeom.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      {/* Base tier */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.6, 2.6]} />
        <meshStandardMaterial color="#7a7a85" roughness={0.9} />
      </mesh>
      {/* Second tier */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[2.0, 0.5, 2.0]} />
        <meshStandardMaterial color="#8a8a95" roughness={0.9} />
      </mesh>
      {/* Third tier */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[1.4, 0.4, 1.4]} />
        <meshStandardMaterial color="#9a9aa5" roughness={0.85} />
      </mesh>
      {/* Spire (glows + rotates) */}
      <mesh ref={spireRef} position={[0, 2.1, 0]} castShadow>
        <octahedronGeometry args={[0.35]} />
        <meshStandardMaterial
          color="#5eead4"
          emissive="#5eead4"
          emissiveIntensity={2.5}
        />
      </mesh>
      {/* Rising sparks */}
      <points ref={particlesRef} geometry={particleGeom} position={[0, 1.5, 0]}>
        <pointsMaterial
          color="#5eead4"
          size={0.06}
          transparent
          opacity={0.9}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      {/* Four corner torches */}
      {([[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]] as Array<[number, number]>).map(
        ([ox, oz], i) => (
          <group key={i} position={[ox, 0.7, oz]}>
            <mesh>
              <cylinderGeometry args={[0.06, 0.06, 0.5, 6]} />
              <meshStandardMaterial color="#4a2e1a" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial
                color="#ff9a2a"
                emissive="#ff7a10"
                emissiveIntensity={2.5}
              />
            </mesh>
          </group>
        ),
      )}
      {/* Central illumination */}
      <pointLight position={[0, 2.2, 0]} color="#5eead4" intensity={2.0} distance={12} />
    </group>
  );
}

// ---------- PLAYER CHARACTER (third-person entity) ----------

interface PlayerState {
  pos: THREE.Vector3;
  yaw: number;
  moving: boolean;
  walkPhase: number;
}

// ---------- FPS CONTROLLER ----------

// Third-person controller: a visible avatar entity moves via WASD /
// joystick / click-to-walk. Camera follows 5 units behind + 3 above
// with a smooth lag.
function ThirdPersonController({
  heightAt,
  enabled,
  playerRef,
}: {
  heightAt: Map<string, number>;
  enabled: boolean;
  playerRef: React.MutableRefObject<PlayerState>;
}) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const velocity = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3());
  const cameraLookAt = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const p = playerRef.current;
    const BASE_SPEED = 6;
    const sprint = keys.current['ShiftLeft'] || keys.current['ShiftRight'] ? 2.0 : 1;
    const speed = BASE_SPEED * sprint;

    // Movement vector in world space derived from camera yaw (so
    // W goes where the camera is pointing).
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
    if (Math.abs(moveInput.x) > 0.05 || Math.abs(moveInput.y) > 0.05) {
      velocity.current.add(fwd.clone().multiplyScalar(-moveInput.y));
      velocity.current.add(right.clone().multiplyScalar(moveInput.x));
    }

    const manualInput = velocity.current.lengthSq() > 0;
    if (walkTarget.x != null && walkTarget.z != null) {
      if (manualInput) {
        walkTarget.x = null;
        walkTarget.z = null;
      } else {
        const dx = walkTarget.x - p.pos.x;
        const dz = walkTarget.z - p.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.6) {
          walkTarget.x = null;
          walkTarget.z = null;
        } else {
          velocity.current.add(new THREE.Vector3(dx, 0, dz).normalize());
        }
      }
    }

    const wasMoving = p.moving;
    if (velocity.current.lengthSq() > 0) {
      velocity.current.normalize().multiplyScalar(speed * delta);
      p.pos.x += velocity.current.x;
      p.pos.z += velocity.current.z;
      p.yaw = Math.atan2(velocity.current.x, velocity.current.z);
      p.moving = true;
    } else {
      p.moving = false;
    }
    p.walkPhase += delta * (p.moving ? 6 : 0.8);

    // Clamp to bounds
    const halfX = (GRID_W / 2) * UNIT - 1;
    const halfZ = (GRID_H / 2) * UNIT - 1;
    p.pos.x = Math.max(-halfX - 15, Math.min(halfX + 15, p.pos.x));
    p.pos.z = Math.max(-halfZ - 15, Math.min(halfZ + 15, p.pos.z));

    // Terrain-follow for player y
    const tx = Math.round(p.pos.x / UNIT + GRID_W / 2);
    const tz = Math.round(p.pos.z / UNIT + GRID_H / 2);
    const h = heightAt.get(`${tx},${tz}`);
    if (h != null) p.pos.y = h;
    else p.pos.y = 0.2;

    // Camera chase position: behind player based on movement direction,
    // 3 above, 5.5 back. Smooth lag so it doesn't snap.
    const chaseYaw = p.yaw;
    const backDist = 5.5;
    const upDist = 3.0;
    cameraTarget.current.set(
      p.pos.x - Math.sin(chaseYaw) * backDist,
      p.pos.y + upDist,
      p.pos.z - Math.cos(chaseYaw) * backDist,
    );
    cameraLookAt.current.set(p.pos.x, p.pos.y + 1.2, p.pos.z);

    const lag = wasMoving || p.moving ? 4 : 2; // snappier when moving
    camera.position.lerp(cameraTarget.current, Math.min(1, lag * delta));
    const look = new THREE.Vector3();
    camera.getWorldDirection(look);
    const lookTarget = cameraLookAt.current.clone().sub(camera.position).normalize();
    const blended = look.lerp(lookTarget, Math.min(1, 6 * delta)).normalize();
    camera.lookAt(camera.position.clone().add(blended));
  });

  return null;
}

function PlayerAvatar({ playerRef }: { playerRef: React.MutableRefObject<PlayerState> }) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const p = playerRef.current;
    groupRef.current.position.copy(p.pos);
    groupRef.current.rotation.y = p.yaw;
    const amp = p.moving ? 0.65 : 0.08;
    const phase = p.walkPhase;
    if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(phase) * amp;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.sin(phase) * amp;
    if (leftArmRef.current) leftArmRef.current.rotation.x = -Math.sin(phase) * amp * 0.85;
    if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(phase) * amp * 0.85;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.5, 0.55, 0.28]} />
        <meshStandardMaterial color="#fde047" roughness={0.75} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.42, 0]} castShadow>
        <boxGeometry args={[0.34, 0.32, 0.32]} />
        <meshStandardMaterial color="#d4a684" roughness={0.55} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[0.36, 0.12, 0.34]} />
        <meshStandardMaterial color="#2a1f15" roughness={0.65} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.08, 1.44, 0.17]}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshStandardMaterial color="#0b0e14" />
      </mesh>
      <mesh position={[0.08, 1.44, 0.17]}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshStandardMaterial color="#0b0e14" />
      </mesh>
      {/* Player glowing crown - distinguishes from NPCs */}
      <mesh position={[0, 1.72, 0]}>
        <torusGeometry args={[0.18, 0.04, 6, 12]} />
        <meshStandardMaterial
          color="#fde047"
          emissive="#fde047"
          emissiveIntensity={1.5}
        />
      </mesh>
      {/* Arms */}
      <group ref={leftArmRef} position={[-0.34, 1.14, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color="#fde047" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.58, 0]} castShadow>
          <boxGeometry args={[0.13, 0.1, 0.13]} />
          <meshStandardMaterial color="#d4a684" roughness={0.55} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.34, 1.14, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color="#fde047" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.58, 0]} castShadow>
          <boxGeometry args={[0.13, 0.1, 0.13]} />
          <meshStandardMaterial color="#d4a684" roughness={0.55} />
        </mesh>
      </group>
      {/* Legs */}
      <group ref={leftLegRef} position={[-0.14, 0.66, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.18, 0.55, 0.18]} />
          <meshStandardMaterial color="#2a2f3d" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.61, 0.04]} castShadow>
          <boxGeometry args={[0.2, 0.08, 0.24]} />
          <meshStandardMaterial color="#1a1f28" roughness={0.9} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.14, 0.66, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.18, 0.55, 0.18]} />
          <meshStandardMaterial color="#2a2f3d" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.61, 0.04]} castShadow>
          <boxGeometry args={[0.2, 0.08, 0.24]} />
          <meshStandardMaterial color="#1a1f28" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function FPSController({ heightAt, enabled }: { heightAt: Map<string, number>; enabled: boolean }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const velocity = useRef(new THREE.Vector3());
  // Yaw/pitch state for touch look (keyboard doesn't touch these; mouse
  // look on desktop is still handled by PointerLockControls).
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    camera.position.set(0, 3, 0);
    yaw.current = camera.rotation.y;
    pitch.current = camera.rotation.x;
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
    const kbSprint = keys.current['ShiftLeft'] || keys.current['ShiftRight'] ? 2.2 : 1;
    const speed = BASE_SPEED * kbSprint;

    // Apply touch look deltas to yaw/pitch, then rotate camera to match.
    // Mouse-look via PointerLockControls mutates rotation directly and
    // we sync yaw/pitch on each frame so they don't drift apart.
    if (lookInput.yaw !== 0 || lookInput.pitch !== 0) {
      yaw.current -= lookInput.yaw;
      pitch.current -= lookInput.pitch;
      pitch.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch.current));
      camera.rotation.order = 'YXZ';
      camera.rotation.y = yaw.current;
      camera.rotation.x = pitch.current;
      lookInput.yaw = 0;
      lookInput.pitch = 0;
    } else {
      yaw.current = camera.rotation.y;
      pitch.current = camera.rotation.x;
    }

    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));

    velocity.current.set(0, 0, 0);
    // Keyboard input
    if (keys.current['KeyW'] || keys.current['ArrowUp']) velocity.current.add(fwd);
    if (keys.current['KeyS'] || keys.current['ArrowDown']) velocity.current.sub(fwd);
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) velocity.current.sub(right);
    if (keys.current['KeyD'] || keys.current['ArrowRight']) velocity.current.add(right);
    // Touch joystick input: y-negative = forward
    if (Math.abs(moveInput.x) > 0.05 || Math.abs(moveInput.y) > 0.05) {
      velocity.current.add(fwd.clone().multiplyScalar(-moveInput.y));
      velocity.current.add(right.clone().multiplyScalar(moveInput.x));
    }
    // Click/tap-to-walk: auto-move toward walkTarget until within arrival
    // radius. Keyboard or joystick input overrides (tap target clears on
    // manual input so the user always has authority).
    const manualInputActive =
      velocity.current.lengthSq() > 0 ||
      Math.abs(moveInput.x) > 0.05 ||
      Math.abs(moveInput.y) > 0.05;
    if (walkTarget.x != null && walkTarget.z != null) {
      if (manualInputActive) {
        walkTarget.x = null;
        walkTarget.z = null;
      } else {
        const dx = walkTarget.x - camera.position.x;
        const dz = walkTarget.z - camera.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.6) {
          walkTarget.x = null;
          walkTarget.z = null;
        } else {
          // Move forward in the target direction (ignore current facing)
          const dir = new THREE.Vector3(dx, 0, dz).normalize();
          velocity.current.add(dir);
          // Smoothly rotate yaw to face direction of travel
          const targetYaw = Math.atan2(-dx, -dz);
          const cur = yaw.current;
          let diff = targetYaw - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          yaw.current = cur + diff * Math.min(1, 4 * delta);
          camera.rotation.order = 'YXZ';
          camera.rotation.y = yaw.current;
        }
      }
    }
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
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    // Subtle color breathing to suggest flow without a custom shader
    if (matRef.current) {
      const t = Math.sin(clock.elapsedTime * 0.4) * 0.5 + 0.5;
      const c = new THREE.Color(0x13263d).lerp(new THREE.Color(0x1a3555), t * 0.3);
      matRef.current.color.copy(c);
    }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[GRID_W * UNIT * 3, GRID_H * UNIT * 3, 24, 24]} />
      <meshStandardMaterial
        ref={matRef}
        color="#13263d"
        transparent
        opacity={0.92}
        roughness={0.08}
        metalness={0.15}
      />
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
  const [hoveredNPC, setHoveredNPC] = useState<NPC | null>(null);
  const [selectedNPC, setSelectedNPC] = useState<NPC | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [verbMenu, setVerbMenu] = useState<{ npc: NPC; x: number; y: number } | null>(null);
  const [showProgression, setShowProgression] = useState(false);
  const [showTreasury, setShowTreasury] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<StructurePlacement | null>(null);
  // Accepted + completed quests come from /api/quests now. Compute the
  // same key-set shape my render uses (`q:<npcName>:<quest_key>`) from
  // the backend rows.
  const acceptedQuery = useQuests('accepted');
  const completedQuery = useQuests('completed');
  const questTransition = useQuestTransition();
  const acceptedQuestIds = useMemo(() => {
    const s = new Set<string>();
    (acceptedQuery.data ?? []).forEach((q) => {
      if (q.npc_name) s.add(`q:${q.npc_name}:${q.quest_key}`);
    });
    return s;
  }, [acceptedQuery.data]);
  const completedQuestIds = useMemo(() => {
    const s = new Set<string>();
    (completedQuery.data ?? []).forEach((q) => {
      if (q.npc_name) s.add(`q:${q.npc_name}:${q.quest_key}`);
    });
    return s;
  }, [completedQuery.data]);

  const autoCheckedRef = useRef<Set<string>>(new Set());
  const [chatTick, setChatTick] = useState(0);
  const [chatFade, setChatFade] = useState(0);
  const isTouch = useMemo(() => isTouchDevice(), []);

  const logsQuery = useLogs();

  // Chat bubble refresh: every cycle (detected via world.cycle change) set
  // a fresh chatTick so bubbles regenerate; fade out over 4.5s then go
  // blank until next cycle.
  useEffect(() => {
    setChatTick(world.cycle);
    setChatFade(0);
    const start = performance.now();
    const id = window.setInterval(() => {
      setChatFade(performance.now() - start);
    }, 200);
    return () => window.clearInterval(id);
  }, [world.cycle]);

  // Third-person player entity (position, yaw, motion state)
  const playerRef = useRef<PlayerState>({
    pos: new THREE.Vector3(0, 0.2, 0),
    yaw: 0,
    moving: false,
    walkPhase: 0,
  });

  // Smithy anvil clink while in 3D - periodic chime every 4-7 seconds to
  // suggest work happening at the forge. Only fires when sound is on.
  useEffect(() => {
    if (!soundOn) return;
    const tick = () => {
      if (!audio.isEnabled()) return;
      audio.anvil();
      setTimeout(tick, 4000 + Math.random() * 3000);
    };
    const id = setTimeout(tick, 3000 + Math.random() * 2000);
    return () => clearTimeout(id);
  }, [soundOn]);

  // Touch look: track single-finger drag outside the joystick area and
  // translate its delta into yaw/pitch in lookInput. Per-frame consumed
  // in FPSController.
  const lookTouchRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const onTouchStartCanvas = (e: React.TouchEvent) => {
    if (mode !== 'fps') return;
    const t = e.changedTouches[0];
    // Ignore touches inside the joystick area (bottom-left 200x200)
    if (t.clientX < 200 && t.clientY > window.innerHeight - 200) return;
    lookTouchRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
    if (!locked) setLocked(true);
  };
  const onTouchMoveCanvas = (e: React.TouchEvent) => {
    if (!lookTouchRef.current) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === lookTouchRef.current.id) {
        const dx = t.clientX - lookTouchRef.current.x;
        const dy = t.clientY - lookTouchRef.current.y;
        lookInput.yaw = dx * 0.005;
        lookInput.pitch = dy * 0.005;
        lookTouchRef.current.x = t.clientX;
        lookTouchRef.current.y = t.clientY;
        e.preventDefault();
        return;
      }
    }
  };
  const onTouchEndCanvas = (e: React.TouchEvent) => {
    if (!lookTouchRef.current) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === lookTouchRef.current.id) {
        lookTouchRef.current = null;
        return;
      }
    }
  };

  const eventsQuery = useEvents();

  // Auto-completion evaluator: when an accepted quest's condition is met
  // in current world + event state, POST transition to 'completed'. Runs
  // once per accepted-quest-update so we don't double-fire.
  useEffect(() => {
    const accepted = acceptedQuery.data ?? [];
    if (accepted.length === 0) return;
    const events = (eventsQuery.data ?? []).map((e) => ({
      cycle: e.cycle,
      kind: e.kind,
      payload: e.payload ?? {},
    }));
    for (const row of accepted) {
      const key = `${row.npc_id}:${row.quest_key}`;
      if (autoCheckedRef.current.has(key)) continue;
      const ctx = {
        world: {
          cycle: world.cycle,
          infrastructure: (world.infrastructure as unknown as Record<string, unknown>) ?? {},
          resources: (world.resources as unknown as Record<string, unknown>) ?? {},
        },
        acceptedCycle: row.accepted_cycle ?? null,
        events,
      };
      if (isQuestComplete(row.quest_key, ctx)) {
        autoCheckedRef.current.add(key);
        questTransition.mutate({
          npc_id: row.npc_id,
          quest_key: row.quest_key,
          to: 'completed',
        });
      }
    }
  }, [acceptedQuery.data, eventsQuery.data, world.cycle, world.infrastructure, world.resources, questTransition]);
  const firstSeenRef = useRef<Map<number, number>>(new Map());
  const abilityFirstSeenRef = useRef<Map<number, number>>(new Map());
  const breakFirstSeenRef = useRef<Map<number, number>>(new Map());
  const [displayEvents, setDisplayEvents] = useState<DisplayEvent[]>([]);
  const [abilityVFX, setAbilityVFX] = useState<AbilityVFX[]>([]);
  const [breakthroughs, setBreakthroughs] = useState<BreakthroughEvent[]>([]);
  const [interactionVFX, setInteractionVFX] = useState<InteractionVFX[]>([]);
  const [skillThresholds, setSkillThresholds] = useState<SkillThresholdVFX[]>([]);
  const [affinityMilestones, setAffinityMilestones] = useState<AffinityMilestoneVFX[]>([]);
  const [visibleBreakthrough, setVisibleBreakthrough] = useState<BreakthroughEvent | null>(null);
  const interactionFirstSeenRef = useRef<Map<number, number>>(new Map());
  const skillThresholdFirstSeenRef = useRef<Map<number, number>>(new Map());
  const affinityMilestoneFirstSeenRef = useRef<Map<number, number>>(new Map());

  // Affinity pairs for bonded-thread rendering + NPC card "closest bonds"
  const affinityQuery = useAffinity({ limit: 60 });

  // Cumulative magic traces from event history - updates whenever
  // eventsQuery data changes. Rendered as permanent-ish world marks.
  const magicTraces = useMemo(() => aggregateMagicTraces(eventsQuery.data ?? []), [eventsQuery.data]);

  // Ability-cast audio cues: fire sfx the first time we see each ability
  // event. Uses a ref set so we don't replay on every re-render.
  const abilityAudioSeenRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const events = eventsQuery.data ?? [];
    for (const e of events) {
      if (e.kind !== 'ability') continue;
      if (abilityAudioSeenRef.current.has(e.id)) continue;
      abilityAudioSeenRef.current.add(e.id);
      if (soundOn && audio.isEnabled()) {
        const kind = (e.payload as { ability_name?: string })?.ability_name;
        if (kind === 'terrain_shape' || kind === 'resource_amp' || kind === 'protection' || kind === 'npc_influence') {
          audio.abilityCast(kind);
        }
      }
    }
  }, [eventsQuery.data, soundOn]);

  // Staggered breakthrough banners: when a batch of new breakthroughs
  // arrives, show each for 3.5s with 0.8s stagger so the Awakening reads
  // as a sequence, not a single flash.
  const breakthroughQueueRef = useRef<{ list: BreakthroughEvent[]; index: number; seen: Set<number> }>({
    list: [], index: 0, seen: new Set(),
  });
  useEffect(() => {
    for (const b of breakthroughs) {
      if (breakthroughQueueRef.current.seen.has(b.eventId)) continue;
      breakthroughQueueRef.current.list.push(b);
      breakthroughQueueRef.current.seen.add(b.eventId);
    }
  }, [breakthroughs]);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        const q = breakthroughQueueRef.current;
        if (q.index >= q.list.length) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        const next = q.list[q.index++];
        setVisibleBreakthrough(next);
        await new Promise((r) => setTimeout(r, 3500));
        setVisibleBreakthrough(null);
        await new Promise((r) => setTimeout(r, 800));
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const rebuild = () => {
      const now = performance.now();
      const src = eventsQuery.data ?? [];
      setDisplayEvents(buildDisplayEvents(src, firstSeenRef.current, now));
      setAbilityVFX(buildAbilityVFX(src, abilityFirstSeenRef.current, now));
      setBreakthroughs(buildBreakthroughEvents(src, breakFirstSeenRef.current, now));
      setInteractionVFX(buildInteractionVFX(src, interactionFirstSeenRef.current, now));
      setSkillThresholds(buildSkillThresholdVFX(src, skillThresholdFirstSeenRef.current, now));
      setAffinityMilestones(buildAffinityMilestoneVFX(src, affinityMilestoneFirstSeenRef.current, now));
    };
    rebuild();
    const id = window.setInterval(rebuild, 500);
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
    setMode((m) => (m === 'orbit' ? 'tp' : m === 'tp' ? 'fps' : 'orbit'));
    setLocked(false);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      if (on) {
        audio.disable();
        return false;
      }
      audio.enable();
      audio.click();
      return true;
    });
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
            {mode === 'orbit' ? 'Orbit view' : mode === 'tp' ? 'Third-person' : 'First-person'}
          </div>
        </div>
        <div className="hud-right">
          <div className="hud-help">
            {mode === 'orbit'
              ? 'drag to orbit · scroll to zoom · right-drag to pan'
              : mode === 'tp'
                ? isTouch
                  ? 'tap to walk · joystick to move · drag to rotate camera'
                  : 'click to walk · WASD to move · shift to sprint'
                : isTouch
                  ? 'tap to walk · joystick for precision · drag empty space to look'
                  : 'click to walk · WASD + shift for precision · click blank for free look'}
          </div>
          <button className="mode-toggle" onClick={toggleMode}>
            {mode === 'orbit' ? 'Third Person' : mode === 'tp' ? 'First Person' : 'Orbit'}
          </button>
          <button
            className="sound-toggle"
            onClick={toggleSound}
            title={soundOn ? 'Mute' : 'Enable sound'}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button className="hud-exit" onClick={onExit}>
            ← Back to 2D
          </button>
        </div>
      </div>
      <Canvas
        shadows
        camera={{ position: [GRID_W * 0.4, GRID_H * 0.6, GRID_H * 0.9], fov: 65 }}
        style={{ background: '#081422', touchAction: mode === 'fps' ? 'none' : 'auto' }}
        onClick={(e) => {
          if (mode === 'fps' && !isTouch && !locked) setLocked(true);
          // In third-person, click-to-walk is handled by WalkTargetPicker
          void e;
        }}
        onTouchStart={onTouchStartCanvas}
        onTouchMove={onTouchMoveCanvas}
        onTouchEnd={onTouchEndCanvas}
      >
        {/* Day/night cycle - Sky + lighting change based on cycle % 20.
            Simple 2-state swap (day vs dusk) rather than continuous so
            the shift reads visibly. */}
        {(() => {
          const nightPhase = (world.cycle % 20) >= 15;
          return nightPhase ? (
            <Sky
              sunPosition={[-10, -5, -20]}
              turbidity={10}
              rayleigh={5}
              mieCoefficient={0.01}
              mieDirectionalG={0.85}
            />
          ) : (
            <Sky
              sunPosition={[100, 60, 50]}
              turbidity={7}
              rayleigh={2}
              mieCoefficient={0.005}
              mieDirectionalG={0.8}
            />
          );
        })()}
        {/* Depth fog for atmospheric distance falloff */}
        <fog attach="fog" args={['#7a9eb0', 25, 140]} />
        <SceneLighting />
        <WaterPlane />
        <Terrain tiles={tiles} />
        <WalkTargetPicker enabled={mode === 'fps' || mode === 'tp'} onSet={() => audio.tap()} />
        {structures.map((s, i) => (
          <Structure
            key={`${s.key}-${i}`}
            placement={s}
            heightMap={heightAt}
            onClick={setSelectedStructure}
          />
        ))}

        {/* Temple at central camp position with energy-driven reactivity */}
        <Temple
          position={[0, heightAt.get(`${Math.round(GRID_W * 0.5)},${Math.round(GRID_H * 0.5)}`) ?? 0.5, 0]}
          energyLevel={((world.sr_energy ?? 50) + (world.jr_energy ?? 50)) / 200}
        />
        {displayEvents.map((evt) => (
          <EventMarker
            key={evt.id}
            evt={evt}
            baseHeight={heightAt.get(`${evt.x},${evt.y}`) ?? 0.5}
          />
        ))}

        {/* Ability VFX layer (Magic Awakening, v7.3+) */}
        <AbilityVFXLayer vfx={abilityVFX} npcs={aliveNPCs} heightAt={heightAt} />

        {/* NPC-to-NPC interaction layer (v8.5) */}
        <NPCInteractionLayer interactions={interactionVFX} npcs={aliveNPCs} heightAt={heightAt} />

        {/* Bonded-pair persistent threads (v8.8) - only for score>=2.0 pairs */}
        <BondedPairsLayer
          pairs={(affinityQuery.data ?? []) as Array<Parameters<typeof BondedPairsLayer>[0]['pairs'][number]>}
          npcs={aliveNPCs}
          heightAt={heightAt}
        />

        {/* Ruler avatars flanking the temple - Sr and Jr as visible deities.
            Aura intensity tied to their per-leader energy pool. Rendered
            whether or not energy data is present (defaults to 50). */}
        <RulerAvatar
          position={[GRID_W * 0.5 * UNIT - GRID_W / 2 * UNIT + 4, 1.5, 0]}
          lane="sr"
          energy={world.sr_energy ?? 50}
        />
        <RulerAvatar
          position={[GRID_W * 0.5 * UNIT - GRID_W / 2 * UNIT - 4, 1.5, 0]}
          lane="jr"
          energy={world.jr_energy ?? 50}
        />
        {aliveNPCs.map((npc) => {
          const q = questFor(npc);
          return (
            <NPCMarker
              key={npc.id}
              npc={npc}
              tileHeight={heightAt.get(`${npc.x},${npc.y}`) ?? 0.5}
              onHover={setHoveredNPC}
              onClick={setSelectedNPC}
              onContextMenu={(n, x, y) => setVerbMenu({ npc: n, x, y })}
              isSelected={selectedNPC?.id === npc.id}
              bubbleText={bubbleFor(npc, chatTick)}
              bubbleFadeMs={chatFade}
              showQuest={hasQuest(npc) && !(q && completedQuestIds.has(q.id))}
              questAccepted={q ? acceptedQuestIds.has(q.id) : false}
            />
          );
        })}

        {/* Cumulative magic traces - prefers backend world.magic_monuments when present */}
        <AbilityTracesLayer traces={magicTraces} world={world} heightAt={heightAt} />
        {/* Hover label floating above hovered NPC */}
        {hoveredNPC && hoveredNPC.x != null && hoveredNPC.y != null && (
          <Html
            position={[
              ((hoveredNPC.x ?? 0) - GRID_W / 2) * UNIT,
              (heightAt.get(`${hoveredNPC.x},${hoveredNPC.y}`) ?? 0.5) + 1.8,
              ((hoveredNPC.y ?? 0) - GRID_H / 2) * UNIT,
            ]}
            center
            distanceFactor={15}
            style={{ pointerEvents: 'none' }}
          >
            <div className="npc-hover-label">
              <div className="npc-label-name">{hoveredNPC.name}</div>
              <div className="npc-label-role">{hoveredNPC.role} · Lv {hoveredNPC.skill}</div>
            </div>
          </Html>
        )}
        {/* Postprocessing: bloom on emissive materials (fire, beams), soft
            vignette, ACES tonemap for cinematic color. Bloom threshold 0.85
            so only actually-bright things glow; mild intensity so it reads
            atmospheric not cartoony. */}
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.35}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.15} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
        {mode === 'tp' && <PlayerAvatar playerRef={playerRef} />}
        {/* Engine-driven content NPCs (move via shared A*, click to talk) */}
        <ContentNpcsInScene tiles={tiles} heightAt={heightAt} />
        {/* Emit reach_tile GameEvents when the player crosses tiles */}
        <PlayerTileEmitter playerRef={playerRef} />
        {mode === 'orbit' && (
          <OrbitControls
            makeDefault
            minDistance={5}
            maxDistance={180}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0, 0]}
          />
        )}
        {mode === 'tp' && (
          <ThirdPersonController
            heightAt={heightAt}
            enabled={mode === 'tp'}
            playerRef={playerRef}
          />
        )}
        {mode === 'fps' && (
          <>
            <FPSController heightAt={heightAt} enabled={mode === 'fps' && (isTouch || locked)} />
            {locked && !isTouch && (
              <PointerLockControls
                onLock={() => setLocked(true)}
                onUnlock={() => setLocked(false)}
              />
            )}
          </>
        )}
      </Canvas>
      {(mode === 'fps' || mode === 'tp') && isTouch && (
        <VirtualJoystick
          onChange={(x, y) => {
            moveInput.x = x;
            moveInput.y = y;
          }}
        />
      )}

      {/* Selected NPC card (RS-style right-click-ish info) */}
      {selectedNPC && (
        <div className="npc-card">
          <div className="npc-card-head">
            <span className={`npc-card-lane ${selectedNPC.lane}`}>
              {selectedNPC.lane === 'sr' ? 'SR' : 'JR'}
            </span>
            <div className="npc-card-name">{selectedNPC.name}</div>
            <button
              className="npc-card-close"
              onClick={() => setSelectedNPC(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="npc-card-row">
            <span className="npc-card-k">Role</span>
            <span className="npc-card-v">{selectedNPC.role}</span>
          </div>
          <div className="npc-card-row">
            <span className="npc-card-k">Skill</span>
            <span className="npc-card-v">Level {selectedNPC.skill}</span>
          </div>
          <div className="npc-card-row">
            <span className="npc-card-k">Morale</span>
            <span className="npc-card-v">{selectedNPC.morale}</span>
          </div>
          {selectedNPC.condition && selectedNPC.condition !== 'healthy' && (
            <div className="npc-card-row">
              <span className="npc-card-k">Condition</span>
              <span className={`npc-card-v cond-${selectedNPC.condition}`}>
                {selectedNPC.condition}
              </span>
            </div>
          )}
          <div className="npc-card-status">{selectedNPC.status}</div>
          <div className="npc-card-flavor">
            <span className="npc-card-quote">"</span>
            {generateFlavor(selectedNPC, world.civ_name)}
            <span className="npc-card-quote">"</span>
          </div>
          {(() => {
            // Show top 3 closest bonds for this NPC from affinity data
            const id = selectedNPC.id;
            const pairs = (affinityQuery.data ?? [])
              .filter((p) => p.npc_a === id || p.npc_b === id)
              .sort((a, b) => parseFloat(String(b.score)) - parseFloat(String(a.score)))
              .slice(0, 3);
            if (pairs.length === 0) return null;
            return (
              <div className="npc-card-bonds">
                <div className="npc-card-bonds-label">CLOSEST BONDS</div>
                {pairs.map((p) => {
                  const otherName = p.npc_a === id ? p.b_name : p.a_name;
                  const otherRole = p.npc_a === id ? p.b_role : p.a_role;
                  // Tier from CURRENT score (respects decay) not historical
                  // milestones_reached (one-shot, never drops).
                  const s = parseFloat(String(p.score ?? 0));
                  const top = s >= 2.0 ? 'bonded'
                    : s >= 1.0 ? 'close'
                    : s >= 0.5 ? 'friendly'
                    : s >= 0.2 ? 'acquainted'
                    : null;
                  return (
                    <div key={`${p.npc_a}-${p.npc_b}`} className="bond-row">
                      <span className="bond-name">{otherName}</span>
                      {otherRole && <span className="bond-role">{otherRole}</span>}
                      {top && <span className={`bond-tier bond-${top}`}>{top}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {(() => {
            const q = questFor(selectedNPC);
            if (!q) return null;
            const isAccepted = acceptedQuestIds.has(q.id);
            const isCompleted = completedQuestIds.has(q.id);
            const pending = questTransition.isPending;
            const transition = (to: 'accepted' | 'completed' | 'declined') => {
              questTransition.mutate({ npc_id: q.npcId, quest_key: q.quest_key, to });
            };
            return (
              <div className={`npc-card-quest ${isCompleted ? 'quest-done' : ''}`}>
                <div className="npc-card-quest-head">
                  <span className="npc-card-quest-tag">
                    {isCompleted ? '✓ COMPLETED' : isAccepted ? '✓ ACCEPTED' : 'QUEST'}
                  </span>
                  <span className="npc-card-quest-title">{q.title}</span>
                </div>
                <div className="npc-card-quest-brief">{q.brief}</div>
                <div className="npc-card-quest-reward">Reward: <em>{q.reward}</em></div>
                {isCompleted ? (
                  <div className="npc-card-quest-completed-note">Already completed. Thank you for your service.</div>
                ) : !isAccepted ? (
                  <div className="npc-card-quest-actions">
                    <button className="npc-card-quest-accept" disabled={pending} onClick={() => transition('accepted')}>
                      Accept
                    </button>
                    <button className="npc-card-quest-decline" disabled={pending} onClick={() => transition('declined')}>
                      Decline
                    </button>
                  </div>
                ) : (
                  <div className="npc-card-quest-actions">
                    <button className="npc-card-quest-accept" disabled={pending} onClick={() => transition('completed')}>
                      Mark Complete
                    </button>
                    <button className="npc-card-quest-decline" disabled={pending} onClick={() => transition('declined')}>
                      Abandon
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Minimap - top-down quick-glance grid */}
      <Minimap tiles={tiles} npcs={aliveNPCs} />

      {/* Magic Awakening HUD + staggered breakthrough banner */}
      <EnergyHUD srEnergy={world.sr_energy} jrEnergy={world.jr_energy} />
      {visibleBreakthrough && <BreakthroughBanner breakthrough={visibleBreakthrough} />}
      {/* Skill threshold crossing banner - newest one shows at right-bottom area */}
      {skillThresholds.length > 0 && (
        <SkillThresholdBanner vfx={skillThresholds[skillThresholds.length - 1]} />
      )}
      {affinityMilestones.length > 0 && (
        <AffinityMilestoneBanner vfx={affinityMilestones[affinityMilestones.length - 1]} />
      )}

      {/* Progression + Treasury toggles */}
      <div className="panel-toggles">
        <button
          className="progression-toggle"
          onClick={() => setShowProgression((v) => !v)}
          title={showProgression ? 'Hide quests' : 'Show quests'}
        >
          {showProgression ? '✕' : '☰'} Quests
        </button>
        <button
          className="treasury-toggle"
          onClick={() => setShowTreasury((v) => !v)}
          title={showTreasury ? 'Hide treasury' : 'Show treasury'}
        >
          {showTreasury ? '✕' : '⚖'} Treasury
        </button>
      </div>
      {showProgression && <ProgressionPanel world={world} logs={logsQuery.data ?? []} />}
      <TreasuryPanel world={world} npcs={npcs} open={showTreasury} onClose={() => setShowTreasury(false)} />

      {/* Structure info card - appears when user clicks a building in 3D */}
      {selectedStructure && (
        <div className="structure-card">
          <div className="structure-card-head">
            <span className="structure-card-icon">⌂</span>
            <div className="structure-card-title">{selectedStructure.label}</div>
            <button
              className="structure-card-close"
              onClick={() => setSelectedStructure(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="structure-card-row">
            <span className="structure-card-k">Type</span>
            <span className="structure-card-v">{selectedStructure.key.replace(/_/g, ' ')}</span>
          </div>
          <div className="structure-card-row">
            <span className="structure-card-k">Location</span>
            <span className="structure-card-v">
              [{selectedStructure.x.toFixed(0)}, {selectedStructure.y.toFixed(0)}]
            </span>
          </div>
          {(() => {
            const v = (world.infrastructure as Record<string, unknown>)[selectedStructure.key];
            if (v == null) return null;
            return (
              <div className="structure-card-status">
                {typeof v === 'string' ? v : JSON.stringify(v)}
              </div>
            );
          })()}
        </div>
      )}

      {/* Right-click verb menu */}
      {verbMenu && (
        <VerbMenu
          npc={verbMenu.npc}
          screenX={verbMenu.x}
          screenY={verbMenu.y}
          onAction={(action) => {
            if (action === 'examine') setSelectedNPC(verbMenu.npc);
            else if (action === 'walk_to' && verbMenu.npc.x != null && verbMenu.npc.y != null) {
              walkTarget.x = (verbMenu.npc.x - GRID_W / 2) * UNIT;
              walkTarget.z = (verbMenu.npc.y - GRID_H / 2) * UNIT;
              walkTarget.setAt = performance.now();
            } else if (action === 'follow') {
              setSelectedNPC(verbMenu.npc);
              // Simple follow: snap walkTarget to npc repeatedly - could add a persistent follow state later
            }
            setVerbMenu(null);
          }}
          onClose={() => setVerbMenu(null)}
        />
      )}
    </div>
  );
}

// Minimap component - small top-down canvas in corner, shows terrain
// tiles + live NPC dots + selected NPC highlight. Reads backend state
// via its own 1s interval so it doesn't slow the 3D render loop.
function Minimap({ tiles, npcs }: { tiles: Tile[]; npcs: NPC[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const sx = W / GRID_W;
      const sy = H / GRID_H;
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, W, H);
      for (const t of tiles) {
        ctx.fillStyle =
          t.type === 'water' ? '#13263d' :
          t.type === 'beach' ? '#b89560' :
          t.type === 'plains' ? '#3d4d2a' :
          t.type === 'forest' ? '#1f3d1a' :
                                 '#555a63';
        ctx.fillRect(t.x * sx, t.y * sy, sx + 0.5, sy + 0.5);
      }
      for (const n of npcs) {
        if (n.x == null || n.y == null) continue;
        ctx.fillStyle = n.lane === 'sr' ? '#fb923c' : '#38bdf8';
        ctx.fillRect(n.x * sx - 1, n.y * sy - 1, 3, 3);
      }
    };
    draw();
    const id = window.setInterval(draw, 1000);
    return () => window.clearInterval(id);
  }, [tiles, npcs]);

  return (
    <div className="minimap">
      <div className="minimap-label">Island</div>
      <canvas ref={ref} width={160} height={96} />
    </div>
  );
}
