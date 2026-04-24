import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { NPC } from '../types';
import type { InteractionVFX } from '../lib/interactions';
import { INTERACTION_LABEL, INTERACTION_COLOR } from '../lib/interactions';
import { GRID_W, GRID_H } from '../lib/terrain';

const UNIT = 2;

function Connector({ vfx, npcs, heightAt }: {
  vfx: InteractionVFX;
  npcs: NPC[];
  heightAt: Map<string, number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  // For teach events, render the connector FROM teacher TO learner so
  // the direction is readable.
  const [pA, pB] = vfx.participantIds;
  const idA = vfx.type === 'teach' && vfx.teacherId != null ? vfx.teacherId : pA;
  const idB = vfx.type === 'teach' && vfx.learnerId != null ? vfx.learnerId : pB;
  const a = npcs.find((n) => n.id === idA);
  const b = npcs.find((n) => n.id === idB);
  if (!a || !b || a.x == null || a.y == null || b.x == null || b.y == null) return null;

  const aH = heightAt.get(`${a.x},${a.y}`) ?? 0.5;
  const bH = heightAt.get(`${b.x},${b.y}`) ?? 0.5;
  const ax = (a.x - GRID_W / 2) * UNIT;
  const az = (a.y - GRID_H / 2) * UNIT;
  const bx = (b.x - GRID_W / 2) * UNIT;
  const bz = (b.y - GRID_H / 2) * UNIT;
  const midX = (ax + bx) / 2;
  const midY = (aH + bH) / 2 + 1.6;
  const midZ = (az + bz) / 2;
  const color = INTERACTION_COLOR[vfx.type];

  // Align a cylinder between the two participants
  const dir = new THREE.Vector3(bx - ax, bH - aH, bz - az);
  const len = dir.length();
  dir.normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  useFrame(() => {
    if (!meshRef.current) return;
    const age = (performance.now() - vfx.seenAt) / vfx.lifespanMs;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    let alpha = 1;
    if (age < 0.15) alpha = age / 0.15;
    else if (age > 0.7) alpha = Math.max(0, (1 - age) / 0.3);
    // Skill-lifting teach glows brighter + pulses faster.
    // Argument/mishap get distinct aggressive/urgent pulses.
    const lifted = vfx.skillLifted === true;
    const argumentative = vfx.type === 'argument';
    const accident = vfx.type === 'mishap';
    mat.opacity = alpha * (lifted || accident ? 0.9 : argumentative ? 0.85 : 0.7);
    const pulseRate = accident ? 70 : argumentative ? 90 : lifted ? 100 : 150;
    const baseIntensity = lifted ? 2.5 : argumentative ? 2.2 : accident ? 2.8 : 1.5;
    const pulseAmp = accident ? 1.8 : argumentative ? 1.5 : lifted ? 1.4 : 0.8;
    mat.emissiveIntensity = baseIntensity + Math.sin(performance.now() / pulseRate) * pulseAmp;
  });

  return (
    <>
      {/* Dashed-looking thin connector between participant chests */}
      <mesh
        ref={meshRef}
        position={[((ax + bx) / 2), (aH + bH) / 2 + 0.95, ((az + bz) / 2)]}
        quaternion={quat}
      >
        <cylinderGeometry args={[0.025, 0.025, len, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={vfx.skillLifted ? 3 : 2}
          transparent
          opacity={vfx.skillLifted ? 0.9 : 0.7}
          depthWrite={false}
        />
      </mesh>
      {/* Skill-lift bonus: small "+1" numeric + sparkles over the learner */}
      {vfx.skillLifted && vfx.learnerId != null && (
        <SkillLiftSparkle
          npcId={vfx.learnerId}
          npcs={npcs}
          heightAt={heightAt}
          seenAt={vfx.seenAt}
          lifespanMs={vfx.lifespanMs}
          skillTo={vfx.skillTo}
        />
      )}
      {/* Floating interaction-type label at midpoint */}
      <Html
        position={[midX, midY, midZ]}
        center
        distanceFactor={12}
        style={{ pointerEvents: 'none' }}
      >
        <div className="npc-interaction-bubble" style={{ borderColor: color, color }}>
          {vfx.type === 'teach' && vfx.teacherId != null && vfx.learnerId != null ? (
            <>
              <span className="teach-arrow">{(vfx.participantNames[vfx.participantIds.indexOf(vfx.teacherId)] ?? 'teacher')}</span>
              {' → '}
              <span>{(vfx.participantNames[vfx.participantIds.indexOf(vfx.learnerId)] ?? 'learner')}</span>
            </>
          ) : (
            INTERACTION_LABEL[vfx.type]
          )}
        </div>
      </Html>
    </>
  );
}

function SkillLiftSparkle({
  npcId, npcs, heightAt, seenAt, lifespanMs, skillTo,
}: {
  npcId: number;
  npcs: NPC[];
  heightAt: Map<string, number>;
  seenAt: number;
  lifespanMs: number;
  skillTo?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const npc = npcs.find((n) => n.id === npcId);
  if (!npc || npc.x == null || npc.y == null) return null;
  const h = heightAt.get(`${npc.x},${npc.y}`) ?? 0.5;
  const x = (npc.x - GRID_W / 2) * UNIT;
  const z = (npc.y - GRID_H / 2) * UNIT;

  useFrame(() => {
    if (!groupRef.current) return;
    const age = (performance.now() - seenAt) / lifespanMs;
    groupRef.current.position.y = h + 2.2 + age * 0.6;
    const alpha = Math.max(0, 1 - age);
    const children = groupRef.current.children;
    for (const c of children) {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'opacity' in m) {
        m.opacity = alpha * 0.9;
        m.emissiveIntensity = 2.5 + Math.sin(performance.now() / 80) * 1;
      }
    }
  });

  return (
    <group ref={groupRef} position={[x, h + 2.2, z]}>
      {/* Central glowing star */}
      <mesh>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial
          color="#fde047"
          emissive="#fde047"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Ring of smaller sparkles */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.4, Math.sin(angle * 1.5) * 0.2, Math.sin(angle) * 0.4]}
          >
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial
              color="#fde047"
              emissive="#fde047"
              emissiveIntensity={2.5}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}
      {skillTo != null && (
        <Html center position={[0, 0.4, 0]} style={{ pointerEvents: 'none' }} distanceFactor={12}>
          <div className="skill-lift-label">+1 skill → {skillTo}</div>
        </Html>
      )}
    </group>
  );
}

interface Props {
  interactions: InteractionVFX[];
  npcs: NPC[];
  heightAt: Map<string, number>;
}

export function NPCInteractionLayer({ interactions, npcs, heightAt }: Props) {
  return (
    <>
      {interactions.map((v) => (
        <Connector key={v.eventId} vfx={v} npcs={npcs} heightAt={heightAt} />
      ))}
    </>
  );
}
