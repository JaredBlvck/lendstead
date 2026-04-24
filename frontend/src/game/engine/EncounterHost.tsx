// EncounterHost. Listens for backend threat_sighted events (via the
// BackendEventRelay pipeline) OR a manual start_encounter trigger from
// DevPanel / dev console. Picks a matching enemy from the registry
// based on severity + region and opens the CombatModal.
//
// Matching rule: filter EnemyRegistry by the event's severity + the
// region the center coords fall inside. If multiple match, random
// weighted pick. If none match, log a console note and ignore.

import { useEffect, useState } from 'react';
import { CombatModal } from '../ui/CombatModal';
import { useEngine } from './EngineContext';
import type { Enemy } from '../combat/enemyTypes';

declare global {
  interface Window {
    __lendsteadStartEncounter?: (enemyId: string) => void;
  }
}

export function EncounterHost() {
  const engine = useEngine();
  const [activeEnemy, setActiveEnemy] = useState<Enemy | null>(null);

  useEffect(() => {
    window.__lendsteadStartEncounter = (enemyId: string) => {
      const enemy = engine.bundle.enemies.get(enemyId);
      if (!enemy) {
        // eslint-disable-next-line no-console
        console.warn(`EncounterHost: unknown enemy ${enemyId}`);
        return;
      }
      setActiveEnemy(enemy);
    };
    return () => {
      delete window.__lendsteadStartEncounter;
    };
  }, [engine.bundle.enemies]);

  // Listen for threat_sighted via the existing GameEvent stream the
  // BackendEventRelay translates. BackendEventRelay currently emits
  // survive_event for storms; we extend it with threat_sighted in the
  // same PR so encounters can spawn from backend.
  // Subscription pattern: monkey-patch window.__lendsteadEmitEvent to
  // also observe encounter triggers. Keep it non-destructive.
  useEffect(() => {
    const previousEmit = window.__lendsteadEmitEvent;
    window.__lendsteadEmitEvent = (event) => {
      // threat_sighted is a routing-only event (not a GameEvent the quest
      // engine scores against) so handle it loosely before delegating.
      const anyEvent = event as unknown as { kind: string; payload?: Record<string, unknown> };
      if (anyEvent.kind === 'threat_sighted') {
        const severity = ((anyEvent.payload?.severity as string) || 'minor') as
          | 'minor'
          | 'major'
          | 'catastrophic';
        const regionId = engine.bundle.regions
          .containing({
            x: Number(anyEvent.payload?.x ?? engine.state.player.location.x),
            y: Number(anyEvent.payload?.y ?? engine.state.player.location.y),
          })?.id;
        const candidates = engine.bundle.enemies.spawnableFor({
          severity,
          region_id: regionId,
        });
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          setActiveEnemy(pick);
        } else {
          // eslint-disable-next-line no-console
          console.info(
            `EncounterHost: no enemies match threat_sighted severity=${severity} region=${regionId ?? 'unknown'}`,
          );
        }
      }
      previousEmit?.(event);
    };
    return () => {
      window.__lendsteadEmitEvent = previousEmit;
    };
  }, [engine.bundle.enemies, engine.bundle.regions, engine.state.player.location]);

  if (!activeEnemy) return null;
  return (
    <CombatModal
      enemy={activeEnemy}
      onClose={() => setActiveEnemy(null)}
    />
  );
}
