// CycleEmitter: watches engine.state.world for cycle rollover, faction
// reputation tier changes, and infrastructure toggles. Emits the
// corresponding GameEvents so quest objectives of kind elapsed_cycles /
// faction_reputation / infrastructure_built advance without every
// content feature having to thread its own event plumbing.
//
// Mount this once inside <EngineProvider>. It is render-free - just
// watches state via useEffect and calls into the EventBridge.

import { useEffect, useRef } from 'react';
import { useEngine } from './EngineContext';

export function CycleEmitter() {
  const engine = useEngine();
  const prevCycleRef = useRef<number>(engine.state.world.cycle);
  const prevRepRef = useRef<Record<string, number>>({});
  const prevInfraRef = useRef<Record<string, boolean>>({});

  // Seed refs on first mount so we don't emit events for initial state
  useEffect(() => {
    prevCycleRef.current = engine.state.world.cycle;
    const reps: Record<string, number> = {};
    for (const f of engine.state.world.faction_reputation) reps[f.faction_id] = f.score;
    prevRepRef.current = reps;
    prevInfraRef.current = { ...engine.state.world.infrastructure };
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Emit elapsed_cycles when cycle advances.
  useEffect(() => {
    const current = engine.state.world.cycle;
    const delta = current - prevCycleRef.current;
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        window.__lendsteadEmitEvent?.({
          kind: 'elapsed_cycles',
          payload: { cycle: current - delta + i + 1 },
        });
      }
    }
    prevCycleRef.current = current;
  }, [engine.state.world.cycle]);

  // Emit faction_reputation when scores change.
  useEffect(() => {
    for (const f of engine.state.world.faction_reputation) {
      const prev = prevRepRef.current[f.faction_id];
      if (prev === undefined || prev !== f.score) {
        window.__lendsteadEmitEvent?.({
          kind: 'faction_reputation',
          payload: {
            faction_id: f.faction_id,
            score: f.score,
            tier: f.tier,
            previous_score: prev ?? 0,
          },
        });
        prevRepRef.current[f.faction_id] = f.score;
      }
    }
  }, [engine.state.world.faction_reputation]);

  // Emit infrastructure_built when a new infrastructure key flips true.
  useEffect(() => {
    const infra = engine.state.world.infrastructure;
    for (const [key, val] of Object.entries(infra)) {
      const prev = prevInfraRef.current[key];
      if (val && !prev) {
        window.__lendsteadEmitEvent?.({
          kind: 'infrastructure_built',
          payload: { key },
        });
      }
      prevInfraRef.current[key] = val;
    }
  }, [engine.state.world.infrastructure]);

  return null;
}
