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
};
