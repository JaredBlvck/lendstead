import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '../types';
import type { MagicTraces } from '../lib/magicTraces';
import { GRID_W, GRID_H } from '../lib/terrain';

const UNIT = 2;

// Unified trace shape that both backend-persisted monuments and
// frontend-aggregated event history normalize into. Lets the renderer
// stay one code path while the data source swaps.
interface UnifiedTrace {
  x: number;
  y: number;
  kind: 'obelisk' | 'protection' | 'npc' | 'resource';
  casts: number;
  dominantLeader: 'sr' | 'jr';
  leaderCounts?: { sr: number; jr: number };
  originCycle?: number;
  lastCycle?: number;
}

function normalize(world: World, fallback: MagicTraces): {
  tiles: UnifiedTrace[];
  protections: UnifiedTrace[];
  source: 'backend' | 'frontend';
} {
  // Prefer backend-persisted monuments when available - survives event
  // pruning, zero re-aggregation cost.
  const monuments = world.magic_monuments;
  if (monuments && monuments.length > 0) {
    const tiles: UnifiedTrace[] = [];
    const protections: UnifiedTrace[] = [];
    for (const m of monuments) {
      const base: UnifiedTrace = {
        x: m.x,
        y: m.y,
        kind: /protection/i.test(m.kind) ? 'protection' : 'obelisk',
        casts: m.casts,
        dominantLeader: m.dominant_leader,
        leaderCounts: m.leader_counts,
        originCycle: m.origin_cycle,
        lastCycle: m.last_cycle,
      };
      if (base.kind === 'protection') protections.push(base);
      else tiles.push(base);
    }
    return { tiles, protections, source: 'backend' };
  }

  // Fallback: use frontend-aggregated event history
  return {
    tiles: fallback.tiles.map((t) => ({
      x: t.x,
      y: t.y,
      kind: 'obelisk',
      casts: t.casts,
      dominantLeader: t.dominantLeader,
      lastCycle: t.last_cycle,
    })),
    protections: fallback.protections.map((t) => ({
      x: t.x,
      y: t.y,
      kind: 'protection',
      casts: t.casts,
      dominantLeader: 'sr',
      lastCycle: t.last_cycle,
    })),
    source: 'frontend',
  };
}

function TileMark({
  trace,
  heightAt,
}: {
  trace: UnifiedTrace;
  heightAt: Map<string, number>;
}) {
  const ref = useRef<THREE.Group>(null);
  const h = heightAt.get(`${trace.x},${trace.y}`) ?? 0.5;
  const x = (trace.x - GRID_W / 2) * UNIT;
  const z = (trace.y - GRID_H / 2) * UNIT;

  // If both leaders have cast here, color-blend at 0.5. Otherwise dominant.
  const lc = trace.leaderCounts;
  const mixed = lc && lc.sr > 0 && lc.jr > 0;
  const baseColor = trace.dominantLeader === 'sr' ? '#fb923c' : '#38bdf8';
  const accentColor = mixed
    ? new THREE.Color('#fb923c').lerp(new THREE.Color('#38bdf8'), lc!.jr / (lc!.sr + lc!.jr)).getStyle()
    : baseColor;

  const intensity = Math.min(4, 0.5 + Math.log(trace.casts + 1) * 1.5);
  const coneHeight = 0.4 + trace.casts * 0.08;
  const coneRadius = 0.12 + Math.log(trace.casts + 1) * 0.08;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.3;
  });

  return (
    <group ref={ref} position={[x, h + 0.15, z]}>
      <mesh castShadow>
        <coneGeometry args={[coneRadius, coneHeight, 6]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={intensity}
          roughness={0.3}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
        <circleGeometry args={[0.5 + Math.log(trace.casts + 1) * 0.1, 16]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.8}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function ProtectionMark({
  trace,
  heightAt,
}: {
  trace: UnifiedTrace;
  heightAt: Map<string, number>;
}) {
  const h = heightAt.get(`${trace.x},${trace.y}`) ?? 0.5;
  const x = (trace.x - GRID_W / 2) * UNIT;
  const z = (trace.y - GRID_H / 2) * UNIT;
  return (
    <mesh position={[x, h + 0.3, z]}>
      <octahedronGeometry args={[0.2 + trace.casts * 0.05]} />
      <meshStandardMaterial
        color="#818cf8"
        emissive="#818cf8"
        emissiveIntensity={1.5}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

interface Props {
  traces: MagicTraces;
  world: World;
  heightAt: Map<string, number>;
}

export function AbilityTracesLayer({ traces, world, heightAt }: Props) {
  const normalized = useMemo(() => normalize(world, traces), [world, traces]);
  const topTiles = useMemo(
    () => [...normalized.tiles].sort((a, b) => b.casts - a.casts).slice(0, 40),
    [normalized.tiles],
  );
  const topProtections = useMemo(
    () => [...normalized.protections].sort((a, b) => b.casts - a.casts).slice(0, 20),
    [normalized.protections],
  );

  return (
    <>
      {topTiles.map((t) => (
        <TileMark key={`${t.x},${t.y}`} trace={t} heightAt={heightAt} />
      ))}
      {topProtections.map((t) => (
        <ProtectionMark key={`p${t.x},${t.y}`} trace={t} heightAt={heightAt} />
      ))}
    </>
  );
}
