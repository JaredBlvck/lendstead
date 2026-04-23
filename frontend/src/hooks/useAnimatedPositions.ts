import { useEffect, useRef, useState } from 'react';
import type { NPC } from '../types';
import type { NPCPosition } from '../lib/positions';

// Tween NPC positions toward their target tile coordinates. Returns a
// map of id -> { x, y } updated on requestAnimationFrame. When target
// positions change (new cycle, new recruits), existing NPCs glide to
// their new tile over TWEEN_MS; new NPCs pop in at target.

const TWEEN_MS = 1400;

interface Animated {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startedAt: number;
}

function ease(t: number): number {
  // ease-in-out cubic
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function useAnimatedPositions(
  npcs: NPC[],
  targets: NPCPosition[],
): Map<number, { x: number; y: number }> {
  const [positions, setPositions] = useState<Map<number, { x: number; y: number }>>(
    () => new Map(),
  );
  const animatingRef = useRef<Map<number, Animated>>(new Map());
  const currentRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // On target change, seed animation state
  useEffect(() => {
    const now = performance.now();
    const next = animatingRef.current;
    const targetMap = new Map(targets.map((t) => [t.id, t]));

    // Kick off tweens for everything that has a new target
    targetMap.forEach((target, id) => {
      const current = currentRef.current.get(id);
      if (!current) {
        // New NPC, pop in at target
        currentRef.current.set(id, { x: target.x, y: target.y });
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

    // Drop any NPCs no longer alive
    for (const id of Array.from(currentRef.current.keys())) {
      if (!targetMap.has(id)) {
        currentRef.current.delete(id);
        next.delete(id);
      }
    }

    // Immediate paint so there's no flash
    setPositions(new Map(currentRef.current));
  }, [targets, npcs]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const animating = animatingRef.current;
      if (animating.size === 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const done: number[] = [];
      animating.forEach((a, id) => {
        const t = Math.min(1, (now - a.startedAt) / TWEEN_MS);
        const e = ease(t);
        const x = a.fromX + (a.toX - a.fromX) * e;
        const y = a.fromY + (a.toY - a.fromY) * e;
        currentRef.current.set(id, { x, y });
        if (t >= 1) done.push(id);
      });
      done.forEach((id) => animating.delete(id));
      setPositions(new Map(currentRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return positions;
}
