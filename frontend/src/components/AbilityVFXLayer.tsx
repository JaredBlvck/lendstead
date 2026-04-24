import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NPC } from '../types';
import type { AbilityVFX } from '../lib/abilities';
import { GRID_W, GRID_H } from '../lib/terrain';

const UNIT = 2;

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
        switch (v.kind) {
          case 'terrain_shape':
            return <TerrainShapeRipple key={v.eventId} vfx={v} heightAt={heightAt} />;
          case 'resource_amp':
            return <ResourceAmpBloom key={v.eventId} vfx={v} />;
          case 'npc_influence':
            return <NPCInfluenceGlow key={v.eventId} vfx={v} npcs={npcs} />;
          case 'protection':
            return <ProtectionDome key={v.eventId} vfx={v} heightAt={heightAt} />;
          default:
            return null;
        }
      })}
    </>
  );
}
