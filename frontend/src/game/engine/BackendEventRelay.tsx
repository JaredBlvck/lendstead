// BackendEventRelay: the bridge from Jr's backend sim into Sr's engine.
// Polls GET /api/events (via the existing useEvents hook) and translates
// matching backend event rows into client GameEvents routed through the
// EventBridge window channel.
//
// This is the FIRST SLICE of engine/backend sync. Before this, the two
// sims ran in isolation: backend tracked affinity + skill thresholds +
// auto-casts, frontend engine tracked quests + inventory + world flags,
// nothing crossed. Now backend-emitted "skill_threshold_crossed" events
// advance reach_skill objectives in the client.
//
// DEDUP: backend returns all events in a rolling window. We track the
// max event id we have processed locally and only relay NEW rows, so
// the same threshold doesn't fire a quest objective twice across polls.
//
// RELAY TABLE (what backend kind maps to what client GameEvent):
//   skill_threshold_crossed -> reach_skill (closes that objective kind)
//   storm                   -> survive_event (event_kind: 'storm')
//   affinity_milestone      -> no direct objective kind yet; sets a
//                              world_flags key 'affinity_milestone_<pair>'
//                              via the engine api
//   conflict_argument /     -> similar; sets 'conflict_<npc_id>' flag
//   conflict_mishap
//
// Add new mappings by extending `relay` below. Keep each mapping pure
// and guardable so missing payload fields don't crash the relay.

import { useEffect, useRef } from 'react';
import { useEvents } from '../../hooks/useWorld';
import { useEngine } from './EngineContext';
import { setFlag } from '../world/worldState';
import type { CycleEvent } from '../../types';

export interface RelayedGameEvent {
  kind: string;
  payload: Record<string, unknown>;
}

export interface RelayOutcome {
  gameEvents: RelayedGameEvent[];
  worldFlags: Record<string, boolean>;
}

// Pure translation from a single backend event row to (a) GameEvents that
// should emit through the EventBridge and (b) world flags to set on the
// engine's WorldState. No side effects; the component below dispatches
// these via the real emitters. Exported for unit testing.
export function translateBackendEvent(event: CycleEvent): RelayOutcome {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const out: RelayOutcome = { gameEvents: [], worldFlags: {} };
  switch (event.kind) {
    case 'skill_threshold_crossed': {
      out.gameEvents.push({
        kind: 'reach_skill',
        payload: {
          npc_id: p.npc_id,
          skill: 'teaching',            // backend threshold is teach-derived
          level: Number(p.skill_to ?? 0),
          threshold: p.threshold,
        },
      });
      break;
    }
    case 'storm':
    case 'storm_ended': {
      out.gameEvents.push({
        kind: 'survive_event',
        payload: { event_kind: 'storm', severity: p.severity ?? 'minor' },
      });
      break;
    }
    case 'affinity_milestone': {
      const pair = Array.isArray(p.pair) ? (p.pair as string[]).join('_') : 'unknown';
      out.worldFlags[`affinity_milestone_${pair}`] = true;
      break;
    }
    case 'conflict_argument':
    case 'conflict_mishap': {
      const npcId = String(p.npc_id ?? p.source_npc_id ?? 'unknown');
      out.worldFlags[`conflict_${event.kind}_${npcId}`] = true;
      break;
    }
    default:
      break;
  }
  return out;
}

export function BackendEventRelay() {
  const engine = useEngine();
  const query = useEvents();
  const processedMaxIdRef = useRef<number>(-1);

  useEffect(() => {
    const rows: CycleEvent[] = query.data ?? [];
    if (rows.length === 0) return;

    // Backend returns newest-first (DESC) for the unfiltered query; sort
    // ascending so we replay in the order the sim produced them.
    const sorted = [...rows].sort((a, b) => a.id - b.id);

    // First observation: seed the high-water mark at the current max id
    // so we do not replay a full history of backlog events on boot.
    if (processedMaxIdRef.current === -1) {
      processedMaxIdRef.current = sorted[sorted.length - 1]?.id ?? -1;
      return;
    }

    const fresh = sorted.filter((r) => r.id > processedMaxIdRef.current);
    if (fresh.length === 0) return;

    let world = engine.state.world;
    let worldDirty = false;

    for (const event of fresh) {
      try {
        const outcome = translateBackendEvent(event);
        for (const ge of outcome.gameEvents) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          window.__lendsteadEmitEvent?.(ge as any);
        }
        for (const [key, value] of Object.entries(outcome.worldFlags)) {
          world = setFlag(world, key, value);
          worldDirty = true;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('BackendEventRelay failed for event', event.id, err);
      }
      processedMaxIdRef.current = Math.max(processedMaxIdRef.current, event.id);
    }

    if (worldDirty) engine.setWorld(world);
  }, [query.data, engine]);

  return null;
}
