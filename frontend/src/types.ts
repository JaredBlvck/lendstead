// Wire types - must match backend API contract in /backend/README.md
// (Sr's lane to keep these in sync with Jr's DB schema.)

export interface World {
  cycle: number;
  population: number;
  resources: Record<string, number>;
  infrastructure: Record<string, number>;
  civ_name: string;
  updated_at: string;
}

export type Morale = 'low' | 'medium' | 'high';
export type Lane = 'sr' | 'jr';

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
}

export interface LogEntry {
  id: number;
  cycle: number;
  leader: Lane;
  action: string;
  reasoning: string;
  created_at: string;
}

export interface CycleEvent {
  id: number;
  cycle: number;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
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
