import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NPC } from '../types';
import type { AbilityVFX } from '../lib/abilities';
import { GRID_W, GRID_H } from '../lib/terrain';

const UNIT = 2;

// Ruler avatar positions - must match ExplorationView layout
// (Sr at +4 x-offset from temple, Jr at -4).
const RULER_POS: Record<'sr' | 'jr', THREE.Vector3> = {
  sr: new THREE.Vector3(4, 3, 0),
  jr: new THREE.Vector3(-4, 3, 0),
};

// Temple-origin cast point for engine-driven auto-casts (not tied to a
// specific ruler avatar since the engine speaks for whichever leader
// has been idle).
const TEMPLE_ORIGIN = new THREE.Vector3(0, 2.2, 0);

// Energy beam: visible narrative link between the casting ruler and
// their target. Fades in over first 20% of lifespan, holds, fades out.
function CastBeam({
  from,
  to,
  color,
  seenAt,
  lifespanMs,
  auto,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  seenAt: number;
  lifespanMs: number;
  auto?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const mid = useRef(new THREE.Vector3());
  const length = useRef(0);
  const quat = useRef(new THREE.Quaternion());

  // Compute once per render
  mid.current.copy(from).lerp(to, 0.5);
  const dir = new THREE.Vector3().subVectors(to, from);
  length.current = dir.length();
  dir.normalize();
  quat.current.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  useFrame(() => {
    if (!meshRef.current) return;
    const age = (performance.now() - seenAt) / lifespanMs;
    let alpha = 1;
    if (age < 0.15) alpha = age / 0.15;
    else if (age > 0.7) alpha = Math.max(0, (1 - age) / 0.3);
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = alpha * (auto ? 0.55 : 0.75);
    // Auto casts pulse slower + softer so they read as ambient engine work
    // vs the sharper rhythm of leader-authored spells.
    const pulseRate = auto ? 200 : 80;
    mat.emissiveIntensity = (auto ? 1.2 : 2) + Math.sin(performance.now() / pulseRate) * (auto ? 0.8 : 1.5);
  });

  // Auto casts use a dashed-feeling thinner beam to read distinct
  const radius = auto ? 0.03 : 0.05;
  const tipRadius = auto ? 0.05 : 0.08;

  return (
    <mesh ref={meshRef} position={mid.current} quaternion={quat.current}>
      <cylinderGeometry args={[radius, tipRadius, length.current, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={auto ? 1.2 : 2.5}
        transparent
        opacity={auto ? 0.5 : 0.7}
        depthWrite={false}
      />
    </mesh>
  );
}

function getTargetPos(vfx: AbilityVFX, npcs: NPC[], heightAt: Map<string, number>): THREE.Vector3 | null {
  const td = vfx.target_data;
  if (vfx.kind === 'terrain_shape' || vfx.kind === 'protection') {
    const tile = td.tile as [number, number] | undefined;
    if (!tile) return null;
    const h = heightAt.get(`${tile[0]},${tile[1]}`) ?? 0.5;
    return new THREE.Vector3(
      (tile[0] - GRID_W / 2) * UNIT,
      h + 0.5,
      (tile[1] - GRID_H / 2) * UNIT,
    );
  }
  if (vfx.kind === 'npc_influence') {
    const ids = (td.affected_npc_ids as number[]) || [];
    const first = npcs.find((n) => ids.includes(n.id));
    if (!first || first.x == null || first.y == null) return null;
    return new THREE.Vector3(
      (first.x - GRID_W / 2) * UNIT,
      1.2,
      (first.y - GRID_H / 2) * UNIT,
    );
  }
  // resource_amp - target the temple (origin)
  return new THREE.Vector3(0, 1.5, 0);
}

// VFX per ability kind. Takes the live list of active ability VFX and
// renders a transient effect per one. Lifespans are enforced by
// buildAbilityVFX - once expired the event drops from the list.

interface Props {
  vfx: AbilityVFX[];
  npcs: NPC[];
  heightAt: Map<string, number>;
}

function TerrainShapeRipple({ vfx, heightAt }: { vfx: AbilityVFX; heightAt: Map<string, number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tile = vfx.target_data.tile as [number, number] | undefined;
  if (!tile) return null;
  const h = heightAt.get(`${tile[0]},${tile[1]}`) ?? 0.5;
  const x = (tile[0] - GRID_W / 2) * UNIT;
  const z = (tile[1] - GRID_H / 2) * UNIT;
  const color = vfx.leader === 'sr' ? '#fb923c' : '#38bdf8';

  useFrame(() => {
    if (!meshRef.current) return;
    const age = (performance.now() - vfx.seenAt) / vfx.lifespanMs;
    const scale = 0.5 + age * 4;
    meshRef.current.scale.setScalar(scale);
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = (1 - age) * 0.85;
  });

  return (
    <mesh ref={meshRef} position={[x, h + 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.6, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={3}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ResourceAmpBloom({ vfx }: { vfx: AbilityVFX }) {
  // Rising column of particles at temple origin
  const groupRef = useRef<THREE.Group>(null);
  const color = (vfx.target_data.kind === 'water') ? '#5eead4' : '#fbbf24';

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const age = (performance.now() - vfx.seenAt) / vfx.lifespanMs;
    groupRef.current.position.y = 0.5 + age * 3;
    groupRef.current.scale.setScalar(1 + age * 0.6);
    (groupRef.current.children[0] as THREE.Mesh).rotation.y = clock.elapsedTime * 2;
    const mesh = groupRef.current.children[0] as THREE.Mesh;
    (mesh.material as THREE.MeshStandardMaterial).opacity = (1 - age) * 0.8;
  });

  return (
    <group ref={groupRef} position={[0, 0.5, 0]}>
      <mesh>
        <torusGeometry args={[1.5, 0.25, 8, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

function NPCInfluenceGlow({ vfx, npcs }: { vfx: AbilityVFX; npcs: NPC[] }) {
  const ids = (vfx.target_data.affected_npc_ids as number[]) || [];
  const effect = vfx.target_data.effect as string | undefined;
  const color =
    effect === 'motivate' ? '#22c55e' :
    effect === 'calm'     ? '#5eead4' :
                            '#fbbf24';
  const age = (performance.now() - vfx.seenAt) / vfx.lifespanMs;
  const opacity = Math.max(0, (1 - age) * 0.8);

  return (
    <>
      {ids.map((id) => {
        const npc = npcs.find((n) => n.id === id);
        if (!npc || npc.x == null || npc.y == null) return null;
        const x = (npc.x - GRID_W / 2) * UNIT;
        const z = (npc.y - GRID_H / 2) * UNIT;
        return (
          <mesh key={id} position={[x, 1.0, z]}>
            <sphereGeometry args={[0.6, 12, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={2}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

function ProtectionDome({ vfx, heightAt }: { vfx: AbilityVFX; heightAt: Map<string, number> }) {
  const tile = vfx.target_data.tile as [number, number] | undefined;
  const radius = (vfx.target_data.radius as number) ?? 3;
  const mode = vfx.target_data.mode as string | undefined;
  if (!tile) return null;
  const h = heightAt.get(`${tile[0]},${tile[1]}`) ?? 0.5;
  const x = (tile[0] - GRID_W / 2) * UNIT;
  const z = (tile[1] - GRID_H / 2) * UNIT;
  const color = mode === 'threat_deterrent' ? '#f472b6' : '#818cf8';
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const age = (performance.now() - vfx.seenAt) / vfx.lifespanMs;
    const pulse = 0.8 + 0.2 * Math.sin(clock.elapsedTime * 4);
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = (1 - age) * 0.4 * pulse;
    mat.emissiveIntensity = 1 + pulse;
  });

  return (
    <mesh ref={meshRef} position={[x, h, z]}>
      <sphereGeometry args={[radius * UNIT, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function AbilityVFXLayer({ vfx, npcs, heightAt }: Props) {
  return (
    <>
      {vfx.map((v) => {
        const color = v.leader === 'sr' ? '#fb923c' : '#38bdf8';
        // Engine-driven auto-casts originate from the Temple spire, not
        // the ruler avatar - visually signals "this was automation, not a
        // ruler's decision."
        const from = v.auto ? TEMPLE_ORIGIN : RULER_POS[v.leader];
        const to = getTargetPos(v, npcs, heightAt);
        return (
          <group key={v.eventId}>
            {/* Cast beam from casting ruler (or temple if auto) to target */}
            {to && (
              <CastBeam
                from={from}
                to={to}
                color={color}
                seenAt={v.seenAt}
                lifespanMs={v.lifespanMs}
                auto={v.auto}
              />
            )}
            {/* Per-kind target effect */}
            {v.kind === 'terrain_shape' && (
              <TerrainShapeRipple vfx={v} heightAt={heightAt} />
            )}
            {v.kind === 'resource_amp' && <ResourceAmpBloom vfx={v} />}
            {v.kind === 'npc_influence' && <NPCInfluenceGlow vfx={v} npcs={npcs} />}
            {v.kind === 'protection' && <ProtectionDome vfx={v} heightAt={heightAt} />}
          </group>
        );
      })}
    </>
  );
}
