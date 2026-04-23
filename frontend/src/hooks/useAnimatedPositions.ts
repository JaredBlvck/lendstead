import { useEffect, useRef, useState } from 'react';
import type { NPC } from '../types';
import type { NPCPosition } from '../lib/positions';

// Continuous-motion animation for NPCs.
//
// Previous version tweened 1.5s then stood idle for ~58s of every 60s
// cycle - reads as teleporting. This version:
// 1. Extends tween duration to ~45s so movement spans most of the cycle
// 2. Role-scaled speed (scouts faster, builders slower)
// 3. Adds a subtle perpendicular arc so paths aren't dead-straight
// 4. Idle wander: non-moving NPCs drift within a tile on a slow orbit
//    so the island never freezes even if a cycle doesn't move anyone
// 5. Walk phase advances continuously whether moving or idle so legs
//    and breathing never stop

const BASE_TWEEN_MS = 45000;
const ARC_MAGNITUDE = 0.35; // in tile units, perpendicular to path
const IDLE_ORBIT_RADIUS = 0.18; // tile units
const IDLE_ORBIT_MS = 9000;
const WALK_PHASE_MS = 480;

interface Animated {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startedAt: number;
  durationMs: number;
  archetype: 'scout' | 'forager' | 'builder' | 'specialist';
}

export interface AnimatedEntity {
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  phase: number;
}

function classify(role: string): Animated['archetype'] {
  if (/scout|watcher|runner|guard|sentry|ranger|mapper|explorer/i.test(role))
    return 'scout';
  if (/forager|fisher|gatherer|shore|tide|trader/i.test(role)) return 'forager';
  if (/carpenter|toolmaker|potter|organizer|field|planner|prospector|hauler|healer|inland|marker/i.test(role))
    return 'builder';
  return 'specialist';
}

function tweenMsFor(arch: Animated['archetype']): number {
  // Scouts cross ground faster, builders are slower, others in between.
  if (arch === 'scout') return BASE_TWEEN_MS * 0.75;
  if (arch === 'builder') return BASE_TWEEN_MS * 1.15;
  return BASE_TWEEN_MS;
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function useAnimatedPositions(
  npcs: NPC[],
  targets: NPCPosition[],
): Map<number, AnimatedEntity> {
  const [entities, setEntities] = useState<Map<number, AnimatedEntity>>(
    () => new Map(),
  );
  const animatingRef = useRef<Map<number, Animated>>(new Map());
  const currentRef = useRef<
    Map<number, { x: number; y: number; facing: number }>
  >(new Map());
  const npcByIdRef = useRef(new Map<number, NPC>());

  useEffect(() => {
    const map = new Map<number, NPC>();
    npcs.forEach((n) => map.set(n.id, n));
    npcByIdRef.current = map;
  }, [npcs]);

  useEffect(() => {
    const now = performance.now();
    const next = animatingRef.current;
    const targetMap = new Map(targets.map((t) => [t.id, t]));

    targetMap.forEach((target, id) => {
      const current = currentRef.current.get(id);
      const npc = npcByIdRef.current.get(id);
      const archetype = npc ? classify(npc.role) : 'specialist';
      if (!current) {
        currentRef.current.set(id, { x: target.x, y: target.y, facing: 0 });
        next.delete(id);
      } else if (current.x !== target.x || current.y !== target.y) {
        next.set(id, {
          fromX: current.x,
          fromY: current.y,
          toX: target.x,
          toY: target.y,
          startedAt: now,
          durationMs: tweenMsFor(archetype),
          archetype,
        });
      }
    });

    for (const id of Array.from(currentRef.current.keys())) {
      if (!targetMap.has(id)) {
        currentRef.current.delete(id);
        next.delete(id);
      }
    }
  }, [targets]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const animating = animatingRef.current;
      const nextEntities = new Map<number, AnimatedEntity>();

      currentRef.current.forEach((state, id) => {
        const npc = npcByIdRef.current.get(id);
        const anim = animating.get(id);
        let x = state.x;
        let y = state.y;
        let facing = state.facing;
        let moving = false;

        if (anim) {
          const t = Math.min(1, (now - anim.startedAt) / anim.durationMs);
          const e = ease(t);
          const baseX = anim.fromX + (anim.toX - anim.fromX) * e;
          const baseY = anim.fromY + (anim.toY - anim.fromY) * e;

          // Perpendicular arc: sin(pi*t) peaks at mid-path. Direction
          // alternates per NPC via id parity so groups don't all bow the
          // same way.
          const dx = anim.toX - anim.fromX;
          const dy = anim.toY - anim.fromY;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len;
          const perpY = dx / len;
          const arc = Math.sin(Math.PI * e) * ARC_MAGNITUDE * (id % 2 === 0 ? 1 : -1);

          x = baseX + perpX * arc;
          y = baseY + perpY * arc;

          if (dx !== 0 || dy !== 0) facing = Math.atan2(dy, dx);
          moving = t < 1;
          currentRef.current.set(id, { x: baseX, y: baseY, facing });
          if (t >= 1) animating.delete(id);
        } else {
          // Idle wander: slow circular drift around current tile so the
          // island never freezes between cycles. Dead/incapacitated NPCs
          // stay put.
          const cond = npc?.condition;
          if (cond !== 'dead' && cond !== 'incapacitated') {
            const orbitPhase = ((now + id * 613) % IDLE_ORBIT_MS) / IDLE_ORBIT_MS;
            const angle = orbitPhase * Math.PI * 2;
            x = state.x + Math.cos(angle) * IDLE_ORBIT_RADIUS;
            y = state.y + Math.sin(angle) * IDLE_ORBIT_RADIUS;
            // Face the direction of orbit so head reads alive
            facing = angle + Math.PI / 2;
          }
          currentRef.current.set(id, { x: state.x, y: state.y, facing });
        }

        // Phase is CONTINUOUS - legs keep cycling at walk rate whether
        // moving or idle-orbiting. Feels alive.
        const phase = ((now + id * 137) % WALK_PHASE_MS) / WALK_PHASE_MS;

        nextEntities.set(id, { x, y, facing, moving, phase });
      });

      setEntities(nextEntities);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return entities;
}
