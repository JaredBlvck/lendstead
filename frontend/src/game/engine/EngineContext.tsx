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
  type ReactNode,
} from 'react';
import { loadContentBundle, type ContentBundle } from './contentBundle';
import type { Inventory, Equipment } from '../items/itemTypes';
import type { QuestRuntimeState } from '../quests/questTypes';
import type { NpcRuntimeState } from '../npcs/npcTypes';
import type { WorldState } from '../world/worldState';
import { newWorldState } from '../world/worldState';
import { emptyInventory } from '../items/inventory';
import { emptyEquipment } from '../items/equipment';
import { buildSave } from '../save/saveGame';
import { loadSave } from '../save/loadGame';
import type { PlayerSnapshot } from '../save/saveTypes';
import type { ShopState } from '../npcs/trade';

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
  | { kind: 'upsert_shop_state'; row: ShopState };

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
      },
    },
    world: newWorldState(),
    inventory: emptyInventory(playerId, 28),
    equipment: emptyEquipment(playerId),
    questRuntime: [],
    npcRuntime: [],
    shopStates: [],
  };
}

function loadFromStorage(): EngineState | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SAVE_SLOT);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = loadSave(parsed);
    if (!result.ok || !result.save) return null;
    const s = result.save;
    // Save holds an array of inventories/equipment; we only persist one per player.
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

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const loaded = loadFromStorage();
    return loaded ?? freshState();
  });

  // Persist on every state change
  useEffect(() => {
    saveToStorage(state);
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
