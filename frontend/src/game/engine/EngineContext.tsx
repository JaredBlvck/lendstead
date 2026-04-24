// EngineContext: the React state layer that owns the client-side engine.
// Provides content registries + player runtime state to every component
// that needs engine access.
//
// Persistence: the full player state snapshot serializes into localStorage
// under 'lendstead_save' on every change. Load-on-boot hydrates from the
// same slot. Backend sync is handled separately by the app shell.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { loadContentBundle, type ContentBundle } from './contentBundle';
import { api as lendsteadApi } from '../../api';
import type { Inventory, Equipment } from '../items/itemTypes';
import type { QuestRuntimeState } from '../quests/questTypes';
import type { NpcRuntimeState } from '../npcs/npcTypes';
import type { WorldState } from '../world/worldState';
import { newWorldState } from '../world/worldState';
import { emptyInventory } from '../items/inventory';
import { emptyEquipment } from '../items/equipment';
import { buildSave } from '../save/saveGame';
import { loadSave } from '../save/loadGame';
import type { PlayerSnapshot, Save } from '../save/saveTypes';
import type { ShopState } from '../npcs/trade';
import type { DiscoveryState } from '../archaeology/carvingTypes';

const SAVE_SLOT = 'lendstead_save';

export interface PlayerState {
  id: string;
  location: { x: number; y: number };
  region_id?: string;
  capabilities: {
    canSwim?: boolean;
    canClimbCliffs?: boolean;
    maxSlope?: number;
  };
  combat?: {
    hp: number;
    max_hp: number;
    attack: number;
    defense: number;
    crit_chance: number;
    dodge_chance: number;
    energy?: number;
    max_energy?: number;
    ability_cooldowns?: Record<string, number>;
    ability_ids?: string[];   // unlocked ability ids from playerAbilities
  };
}

export interface EngineState {
  player: PlayerState;
  world: WorldState;
  inventory: Inventory;
  equipment: Equipment;
  questRuntime: QuestRuntimeState[];
  npcRuntime: NpcRuntimeState[];
  shopStates: ShopState[];
  discoveryStates: DiscoveryState[];
}

type Action =
  | { kind: 'set_state'; next: EngineState }
  | { kind: 'set_player'; next: PlayerState }
  | { kind: 'set_world'; next: WorldState }
  | { kind: 'set_inventory'; next: Inventory }
  | { kind: 'set_equipment'; next: Equipment }
  | { kind: 'set_quest_runtime'; next: QuestRuntimeState[] }
  | { kind: 'upsert_quest_runtime'; row: QuestRuntimeState }
  | { kind: 'set_npc_runtime'; next: NpcRuntimeState[] }
  | { kind: 'upsert_shop_state'; row: ShopState }
  | { kind: 'upsert_discovery_state'; row: DiscoveryState };

function reducer(state: EngineState, action: Action): EngineState {
  switch (action.kind) {
    case 'set_state': return action.next;
    case 'set_player': return { ...state, player: action.next };
    case 'set_world': return { ...state, world: action.next };
    case 'set_inventory': return { ...state, inventory: action.next };
    case 'set_equipment': return { ...state, equipment: action.next };
    case 'set_quest_runtime': return { ...state, questRuntime: action.next };
    case 'upsert_quest_runtime': {
      const existing = state.questRuntime.find((r) => r.quest_id === action.row.quest_id);
      const next = existing
        ? state.questRuntime.map((r) => (r.quest_id === action.row.quest_id ? action.row : r))
        : [...state.questRuntime, action.row];
      return { ...state, questRuntime: next };
    }
    case 'set_npc_runtime': return { ...state, npcRuntime: action.next };
    case 'upsert_shop_state': {
      const existing = state.shopStates.find((s) => s.npc_id === action.row.npc_id);
      const next = existing
        ? state.shopStates.map((s) => (s.npc_id === action.row.npc_id ? action.row : s))
        : [...state.shopStates, action.row];
      return { ...state, shopStates: next };
    }
    case 'upsert_discovery_state': {
      const existing = state.discoveryStates.find((s) => s.site_id === action.row.site_id);
      const next = existing
        ? state.discoveryStates.map((s) => (s.site_id === action.row.site_id ? action.row : s))
        : [...state.discoveryStates, action.row];
      return { ...state, discoveryStates: next };
    }
    default: return state;
  }
}

function freshState(): EngineState {
  const playerId = 'player_local';
  return {
    player: {
      id: playerId,
      location: { x: 20, y: 12 },        // starting tile near the Founding Shore
      region_id: 'region_founding_shore',
      capabilities: { canSwim: false, canClimbCliffs: false, maxSlope: 0.5 },
      combat: {
        hp: 20,
        max_hp: 20,
        attack: 3,
        defense: 1,
        crit_chance: 0.1,
        dodge_chance: 0.05,
        energy: 20,
        max_energy: 20,
        ability_cooldowns: {},
        ability_ids: ['pability_heavy_strike', 'pability_guard', 'pability_mend'],
      },
    },
    world: newWorldState(),
    inventory: emptyInventory(playerId, 28),
    equipment: emptyEquipment(playerId),
    questRuntime: [],
    npcRuntime: [],
    shopStates: [],
    discoveryStates: [],
  };
}

// Convert a validated Save snapshot into the in-memory EngineState shape.
// Exported so both localStorage and backend rehydration paths share the
// same destructuring logic.
export function snapshotToEngineState(s: Save): EngineState {
  const inv = s.inventories[0] ?? emptyInventory(s.player.id, 28);
  const eq = s.equipment[0] ?? emptyEquipment(s.player.id);
  return {
    player: s.player as PlayerState,
    world: s.world,
    inventory: inv,
    equipment: eq,
    questRuntime: s.quest_runtime,
    npcRuntime: s.npc_runtime,
    shopStates: (s.shop_states ?? []) as ShopState[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discoveryStates: ((s as any).discovery_states ?? []) as DiscoveryState[],
  };
}

// Compare two ISO timestamps (either may be empty / undefined). Returns
// true if `candidateISO` is strictly newer than `currentISO`. Pure.
export function isNewerSave(candidateISO: string | null | undefined, currentISO: string | null | undefined): boolean {
  const cand = candidateISO ? Date.parse(candidateISO) : 0;
  const curr = currentISO ? Date.parse(currentISO) : 0;
  if (!Number.isFinite(cand) || cand <= 0) return false;
  return cand > curr;
}

interface StorageLoadResult {
  state: EngineState;
  saved_at_iso: string;
}

function loadFromStorage(): StorageLoadResult | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SAVE_SLOT);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = loadSave(parsed);
    if (!result.ok || !result.save) return null;
    return {
      state: snapshotToEngineState(result.save),
      saved_at_iso: result.save.saved_at_iso ?? '',
    };
  } catch {
    return null;
  }
}

function saveToStorage(state: EngineState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const snap: PlayerSnapshot = state.player;
    const save = buildSave({
      player: snap,
      world: state.world,
      inventories: [state.inventory],
      equipment: [state.equipment],
      npc_runtime: state.npcRuntime,
      quest_runtime: state.questRuntime,
      shop_states: state.shopStates,
    });
    localStorage.setItem(SAVE_SLOT, JSON.stringify(save));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('save failed', e);
  }
}

export interface EngineApi {
  bundle: ContentBundle;
  state: EngineState;
  setPlayer: (p: PlayerState) => void;
  setWorld: (w: WorldState) => void;
  setInventory: (inv: Inventory) => void;
  setEquipment: (eq: Equipment) => void;
  upsertQuestRuntime: (row: QuestRuntimeState) => void;
  setQuestRuntime: (rows: QuestRuntimeState[]) => void;
  setNpcRuntime: (rows: NpcRuntimeState[]) => void;
  upsertShopState: (row: ShopState) => void;
  upsertDiscoveryState: (row: DiscoveryState) => void;
  resetToFresh: () => void;
}

const EngineCtx = createContext<EngineApi | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const bundle = useMemo(() => loadContentBundle(), []);

  // Surface content errors early - if Quad B shipped broken content, crash loudly.
  if (bundle.errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Content validation failed on boot:\n' + bundle.errors.join('\n'));
  }

  // Track the timestamp of the currently-loaded snapshot so the backend
  // rehydration effect knows whether a backend snapshot is actually
  // NEWER than what's live. We can't trust the in-memory state's
  // saved_at_iso (it updates on every save) - we need the boot-time
  // baseline that was loaded from localStorage.
  const loadedAtISORef = useRef<string>('');

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const loaded = loadFromStorage();
    if (loaded) {
      loadedAtISORef.current = loaded.saved_at_iso;
      return loaded.state;
    }
    return freshState();
  });

  // Boot-time backend rehydration. Kicks off once on mount:
  //   - fetch the backend's stored snapshot for this player
  //   - compare its saved_at_iso to what we loaded from localStorage
  //   - if backend is newer: replace state wholesale via set_state
  //   - if local is newer or backend unreachable: no-op (BackendStateSync
  //     will push local upstream within seconds)
  // This closes the read-side of the sync pair symmetrically with the
  // localStorage primary path. No loading UI; the first 200-500ms of
  // play runs on the localStorage snapshot, then backend replaces it
  // only if the backend truly has newer bits.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const playerId = state.player.id;
        const backend = await lendsteadApi.fetchPlayerState(playerId);
        if (cancelled || controller.signal.aborted) return;
        // backend.snapshot is opaque to the server; validate through loadSave
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = loadSave(backend.snapshot as any);
        if (!parsed.ok || !parsed.save) return;
        const backendSavedAt = backend.client_saved_at || parsed.save.saved_at_iso || backend.updated_at;
        if (!isNewerSave(backendSavedAt, loadedAtISORef.current)) return;
        // Backend is newer - replace state
        dispatch({ kind: 'set_state', next: snapshotToEngineState(parsed.save) });
        loadedAtISORef.current = backendSavedAt;
        // eslint-disable-next-line no-console
        console.info('[engine] rehydrated from backend player_state', {
          player_id: playerId,
          backend_saved_at: backendSavedAt,
          local_saved_at: loadedAtISORef.current,
        });
      } catch {
        // Backend unreachable or 404 (no snapshot yet). Silent no-op;
        // BackendStateSync will push local state upstream momentarily.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // Run once on mount. state.player.id should be stable across renders
    // within a session (player id is seeded in freshState or reloaded
    // from localStorage before the effect fires).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every state change
  useEffect(() => {
    saveToStorage(state);
    // Track the latest save timestamp so subsequent manual backend loads
    // (not on boot) can compare correctly. In practice only the boot
    // effect reads this, but keeping the ref current makes future
    // extensions (e.g., a manual "Sync from cloud" button) safe.
    try {
      const raw = localStorage.getItem(SAVE_SLOT);
      if (raw) {
        const parsed = JSON.parse(raw) as { saved_at_iso?: string };
        if (parsed.saved_at_iso) loadedAtISORef.current = parsed.saved_at_iso;
      }
    } catch {
      // ignore
    }
  }, [state]);

  const api = useMemo<EngineApi>(() => ({
    bundle,
    state,
    setPlayer: (p) => dispatch({ kind: 'set_player', next: p }),
    setWorld: (w) => dispatch({ kind: 'set_world', next: w }),
    setInventory: (inv) => dispatch({ kind: 'set_inventory', next: inv }),
    setEquipment: (eq) => dispatch({ kind: 'set_equipment', next: eq }),
    upsertQuestRuntime: (row) => dispatch({ kind: 'upsert_quest_runtime', row }),
    setQuestRuntime: (rows) => dispatch({ kind: 'set_quest_runtime', next: rows }),
    setNpcRuntime: (rows) => dispatch({ kind: 'set_npc_runtime', next: rows }),
    upsertShopState: (row) => dispatch({ kind: 'upsert_shop_state', row }),
    upsertDiscoveryState: (row) => dispatch({ kind: 'upsert_discovery_state', row }),
    resetToFresh: () => dispatch({ kind: 'set_state', next: freshState() }),
  }), [bundle, state]);

  return <EngineCtx.Provider value={api}>{children}</EngineCtx.Provider>;
}

export function useEngine(): EngineApi {
  const ctx = useContext(EngineCtx);
  if (!ctx) throw new Error('useEngine must be called inside <EngineProvider>');
  return ctx;
}

// Specialized hook that surfaces the PlayerQuestState helper.
export { PlayerQuestState } from '../quests/questState';
