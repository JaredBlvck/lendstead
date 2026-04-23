import { useEffect, useRef, useState } from 'react';
import type { NPC } from '../types';
import type { NPCPosition } from '../lib/positions';

// Tween NPC positions and track facing + motion state for sprite
// rendering. Returns a map of id -> { x, y, facing, moving, phase }.
//
// Phase is a 0..1 looping value driving breathing (idle) or walk cycle
// (moving). Facing is radians, recomputed when a tween is active so the
// avatar looks where it's heading.

const TWEEN_MS = 1500;
const IDLE_BREATH_MS = 2600;
const WALK_PHASE_MS = 360;

interface Animated {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startedAt: number;
}

export interface AnimatedEntity {
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  phase: number;
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
  const currentRef = useRef<Map<number, { x: number; y: number; facing: number }>>(new Map());

  useEffect(() => {
    const now = performance.now();
    const next = animatingRef.current;
    const targetMap = new Map(targets.map((t) => [t.id, t]));

    targetMap.forEach((target, id) => {
      const current = currentRef.current.get(id);
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
        });
      }
    });

    for (const id of Array.from(currentRef.current.keys())) {
      if (!targetMap.has(id)) {
        currentRef.current.delete(id);
        next.delete(id);
      }
    }
  }, [targets, npcs]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const animating = animatingRef.current;
      const nextEntities = new Map<number, AnimatedEntity>();

      currentRef.current.forEach((state, id) => {
        const anim = animating.get(id);
        let x = state.x;
        let y = state.y;
        let facing = state.facing;
        let moving = false;
        if (anim) {
          const t = Math.min(1, (now - anim.startedAt) / TWEEN_MS);
          const e = ease(t);
          x = anim.fromX + (anim.toX - anim.fromX) * e;
          y = anim.fromY + (anim.toY - anim.fromY) * e;
          const dx = anim.toX - anim.fromX;
          const dy = anim.toY - anim.fromY;
          if (dx !== 0 || dy !== 0) facing = Math.atan2(dy, dx);
          moving = t < 1;
          currentRef.current.set(id, { x, y, facing });
          if (t >= 1) animating.delete(id);
        } else {
          currentRef.current.set(id, { x, y, facing });
        }

        const phase = moving
          ? ((now % WALK_PHASE_MS) / WALK_PHASE_MS)
          : ((now + id * 137) % IDLE_BREATH_MS) / IDLE_BREATH_MS;

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
