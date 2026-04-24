import { useMemo } from 'react';
import * as THREE from 'three';
import type { NPC } from '../types';
import { GRID_W, GRID_H } from '../lib/terrain';
import { affinityScore, MILESTONE_THRESHOLD, type AffinityPair } from '../lib/affinity';

const UNIT = 2;

// Persistent translucent threads between NPC pairs at 'bonded' tier
// (score >= 2.0). Very few pairs hit bonded at any given time, so
// render count stays low. Thread color tints by milestone tier for a
// subtle readable hierarchy.

interface Props {
  pairs: AffinityPair[];
  npcs: NPC[];
  heightAt: Map<string, number>;
}

function colorFor(pair: AffinityPair): string {
  const milestones = pair.milestones_reached || [];
  if (milestones.includes('bonded')) return '#fde047';
  if (milestones.includes('close')) return '#a78bfa';
  if (milestones.includes('friendly')) return '#5eead4';
  return '#94a3b8';
}

function Thread({ pair, npcs, heightAt }: { pair: AffinityPair; npcs: NPC[]; heightAt: Map<string, number> }) {
  const a = npcs.find((n) => n.id === pair.npc_a);
  const b = npcs.find((n) => n.id === pair.npc_b);
  if (!a || !b || a.x == null || a.y == null || b.x == null || b.y == null) return null;
  if (!a.alive || !b.alive) return null;

  const aH = heightAt.get(`${a.x},${a.y}`) ?? 0.5;
  const bH = heightAt.get(`${b.x},${b.y}`) ?? 0.5;
  const ax = (a.x - GRID_W / 2) * UNIT;
  const az = (a.y - GRID_H / 2) * UNIT;
  const bx = (b.x - GRID_W / 2) * UNIT;
  const bz = (b.y - GRID_H / 2) * UNIT;

  const dir = new THREE.Vector3(bx - ax, bH - aH, bz - az);
  const len = dir.length();
  if (len < 0.001) return null;
  dir.normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const color = colorFor(pair);
  const score = affinityScore(pair);
  // Thickness/opacity scale with score above the bonded threshold
  const aboveBonded = Math.max(0, score - MILESTONE_THRESHOLD.bonded);
  const radius = 0.012 + Math.min(0.04, aboveBonded * 0.015);
  const opacity = 0.25 + Math.min(0.45, aboveBonded * 0.08);

  return (
    <mesh
      position={[(ax + bx) / 2, (aH + bH) / 2 + 0.6, (az + bz) / 2]}
      quaternion={quat}
    >
      <cylinderGeometry args={[radius, radius, len, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.2}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

export function BondedPairsLayer({ pairs, npcs, heightAt }: Props) {
  // Filter by CURRENT score (not historical milestones) so decayed bonds
  // stop rendering threads when they drift below the bonded threshold.
  // Keeps the visual truthful to current state, not historical peak.
  const bonded = useMemo(
    () => pairs.filter((p) => affinityScore(p) >= MILESTONE_THRESHOLD.bonded),
    [pairs],
  );
  return (
    <>
      {bonded.map((p) => (
        <Thread key={`${p.npc_a}-${p.npc_b}`} pair={p} npcs={npcs} heightAt={heightAt} />
      ))}
    </>
  );
}
