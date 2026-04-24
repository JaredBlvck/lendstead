import type { World, NPC, LogEntry, CycleEvent, CycleAdvanceResponse, Lane, AutoCycleStatus } from './types';

// VITE_API_URL set on Railway frontend service to the backend's public URL.
// Local dev falls back to localhost:3000 where the backend runs.
const API = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  world: () => req<World>('/api/world'),
  npcs: () => req<NPC[]>('/api/npcs'),
  logs: (cycle?: number) =>
    req<LogEntry[]>(`/api/logs${cycle != null ? `?cycle=${cycle}` : ''}`),
  events: (sinceISO?: string) =>
    req<CycleEvent[]>(`/api/events${sinceISO ? `?since=${encodeURIComponent(sinceISO)}` : ''}`),
  advanceCycle: () =>
    req<CycleAdvanceResponse>('/api/cycle/advance', { method: 'POST' }),
  autoCycleStatus: () => req<AutoCycleStatus>('/api/auto-cycle/status'),
  autoCycleStart: (interval_sec: number) =>
    req<AutoCycleStatus>('/api/auto-cycle/start', {
      method: 'POST',
      body: JSON.stringify({ interval_sec }),
    }),
  autoCycleStop: () =>
    req<AutoCycleStatus>('/api/auto-cycle/stop', { method: 'POST' }),
  quests: (status?: 'accepted' | 'completed' | 'declined') =>
    req<Array<{
      id: number;
      npc_id: number;
      quest_key: string;
      status: 'accepted' | 'completed' | 'declined' | 'offered';
      accepted_cycle?: number;
      accepted_by?: 'sr' | 'jr';
      completed_cycle?: number;
      completed_by?: 'sr' | 'jr';
      declined_cycle?: number;
      npc_name?: string;
      npc_role?: string;
      npc_lane?: 'sr' | 'jr';
    }>>(`/api/quests${status ? `?status=${status}` : ''}`),
  questTransition: (body: {
    npc_id: number;
    quest_key: string;
    to: 'accepted' | 'completed' | 'declined';
    leader?: 'sr' | 'jr';
  }) =>
    req<{ ok: boolean; id: number; status: string }>('/api/quests/transition', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  affinity: (opts: { min_score?: number; npc_id?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.min_score != null) params.set('min_score', String(opts.min_score));
    if (opts.npc_id != null) params.set('npc_id', String(opts.npc_id));
    if (opts.limit != null) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return req<Array<{
      npc_a: number;
      npc_b: number;
      score: string | number;
      interactions: number;
      last_cycle: number;
      last_type: string;
      milestones_reached: string[];
      a_name?: string; a_role?: string; a_lane?: 'sr' | 'jr';
      b_name?: string; b_role?: string; b_lane?: 'sr' | 'jr';
    }>>(`/api/affinity${qs ? `?${qs}` : ''}`);
  },
  decide: (body: {
    leader: Lane;
    cycle: number;
    action: string;
    reasoning: string;
    npc_changes?: Partial<NPC>[];
    resource_delta?: Record<string, number>;
    infra_delta?: Record<string, number>;
  }) =>
    req<{ ok: true; log_id: number }>('/api/decisions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  // Player state (Sr client engine snapshot). Backend stores as opaque
  // JSONB; shape validation is owned by the client Save schema.
  syncPlayerState: (body: {
    player_id: string;
    snapshot: unknown;
    schema_version?: number;
    client_saved_at?: string;
  }) =>
    req<{
      id: number;
      player_id: string;
      schema_version: number;
      updated_at: string;
    }>('/api/player-state', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  fetchPlayerState: (playerId: string) =>
    req<{
      player_id: string;
      snapshot: unknown;
      schema_version: number;
      client_saved_at: string | null;
      updated_at: string;
    }>(`/api/player-state/${encodeURIComponent(playerId)}`),
};
