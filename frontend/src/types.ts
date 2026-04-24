// Wire types - must match backend API contract in /backend/README.md
// (Sr's lane to keep these in sync with Jr's DB schema.)

export interface World {
  cycle: number;
  population: number;
  resources: Record<string, number>;
  infrastructure: Record<string, number>;
  civ_name: string;
  updated_at: string;
  terrain?: Array<{ x: number; y: number; type: string; height?: number }>;
  // Magic Awakening (v7.3+). Per-leader energy pools populated once
  // backend migration 005 lands. Optional so rendering degrades cleanly
  // until then.
  sr_energy?: number;
  jr_energy?: number;
  breakthroughs?: string[];
}

export type AbilityName = 'terrain_shape' | 'resource_amp' | 'npc_influence' | 'protection';

export interface AbilityRecord {
  id: number;
  leader: 'sr' | 'jr';
  ability_name: AbilityName;
  target_data: Record<string, unknown>;
  energy_cost: number;
  cycle_used: number;
  expires_cycle: number;
  effect_summary: string;
  created_at: string;
}

// Backend seed uses 'med' not 'medium'. Accept both so the dashboard never
// renders undefined for a valid API response.
export type Morale = 'low' | 'med' | 'medium' | 'high';
export type Lane = 'sr' | 'jr';

export type Condition = 'healthy' | 'injured' | 'incapacitated' | 'dead';

export interface NPC {
  id: number;
  name: string;
  role: string;
  skill: number;
  morale: Morale;
  status: string;
  lane: Lane;
  alive: boolean;
  cycle_created: number;
  created_at: string;
  // Tile-grid position once backend ships x/y columns. Optional so we
  // fall back to deterministic client-seeded positions until backend
  // catches up.
  x?: number;
  y?: number;
  // Consequence system (v4 directive). All optional - frontend renders
  // gracefully whether or not the backend is populating them yet.
  condition?: Condition;
  injury_cycle?: number;
  death_cycle?: number;
}

export type LeaderKind = Lane | 'auto';

export interface LogEntry {
  id: number;
  cycle: number;
  leader: LeaderKind;
  action: string;
  reasoning: string;
  created_at: string;
  // Consequence chain (v4 directive). When a log is emitted as a
  // consequence of an event or another log, these point at the cause.
  cause_event_id?: number;
  cause_log_id?: number;
  severity?: 'minor' | 'moderate' | 'critical';
}

export interface CycleEvent {
  id: number;
  cycle: number;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

// Food/water balance surfaced into world.resources or a top-level field
// by the backend when the consequence directive lands. Optional.
export interface ResourceBalance {
  production: number;
  consumption: number;
  surplus_days: number; // negative = deficit
}

// Mirrors /api/auto-cycle/{status,start,stop} response.
export interface AutoCycleStatus {
  running: boolean;
  interval_sec: number | null;
  started_at: string | null;
}

export interface CycleAdvanceResponse {
  world: World;
  delta: {
    population: number;
    resources: Record<string, number>;
    infrastructure: Record<string, number>;
    npcs_added: number;
    npcs_lost: number;
  };
}
