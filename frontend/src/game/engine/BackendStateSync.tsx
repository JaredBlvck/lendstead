// BackendStateSync: second slice of the engine/backend bridge. Pushes
// the client engine snapshot to the backend on a throttled cadence so
// progress survives browser close and so Jr's backend sim can read
// player-side state when it needs to (e.g., NPC reactions gated on
// quest completions).
//
// READ SURFACE: backend is NOT used for client boot state today.
// Rehydration order on mount stays localStorage-first. The rationale:
// - localStorage is instant; backend round-trip adds 50-200ms to boot
// - client-side save is the authority for current session; backend is
//   a durable shadow for cross-device / cross-session recovery
// - conflict resolution stays simple: whichever side writes most
//   recently wins; a future PR adds explicit merge when we have a
//   reason to (multiplayer, session stealing, bots)
//
// WRITE CADENCE: one POST every N seconds (default 10) if the
// snapshot has changed since the last push. Change detection uses a
// lightweight hash over the engine state so we do not push on every
// mouse move that happens to trigger a state read.

import { useEffect, useRef } from 'react';
import { api } from '../../api';
import { useEngine } from './EngineContext';
import { buildSave } from '../save/saveGame';
import { SAVE_SCHEMA_VERSION } from '../save/saveTypes';

const DEFAULT_PUSH_INTERVAL_MS = 10_000;

// Cheap deterministic fingerprint of the snapshot. Not a cryptographic
// hash; just enough to detect "same bits since last push".
function fingerprint(obj: unknown): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `${str.length}:${hash}`;
}

interface Props {
  intervalMs?: number;
  enabled?: boolean;
}

export function BackendStateSync({
  intervalMs = DEFAULT_PUSH_INTERVAL_MS,
  enabled = true,
}: Props = {}) {
  const engine = useEngine();
  const lastFingerprintRef = useRef<string>('');
  const lastPushAtRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const pushIfChanged = async () => {
      try {
        const snapshot = buildSave({
          player: engine.state.player,
          world: engine.state.world,
          inventories: [engine.state.inventory],
          equipment: [engine.state.equipment],
          npc_runtime: engine.state.npcRuntime,
          quest_runtime: engine.state.questRuntime,
          shop_states: engine.state.shopStates,
        });
        const fp = fingerprint(snapshot);
        if (fp === lastFingerprintRef.current) return;

        await api.syncPlayerState({
          player_id: engine.state.player.id,
          snapshot,
          schema_version: SAVE_SCHEMA_VERSION,
          client_saved_at: snapshot.saved_at_iso,
        });
        lastFingerprintRef.current = fp;
        lastPushAtRef.current = Date.now();
      } catch (err) {
        // Backend may be offline in dev. Save loop silently, we'll retry
        // on the next tick. Console-warn at low volume so a real outage
        // is noticed without spamming.
        const now = Date.now();
        if (now - lastPushAtRef.current > 60_000) {
          // eslint-disable-next-line no-console
          console.warn('BackendStateSync push failed (will retry):', err);
          lastPushAtRef.current = now;
        }
      }
    };

    // Kick one soon-ish after mount so first real state lands quickly
    const bootTimeout = window.setTimeout(pushIfChanged, 2000);
    const handle = window.setInterval(pushIfChanged, intervalMs);
    return () => {
      window.clearTimeout(bootTimeout);
      window.clearInterval(handle);
    };
  }, [engine, intervalMs, enabled]);

  return null;
}
