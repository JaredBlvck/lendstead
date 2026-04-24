import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function useWorld() {
  return useQuery({ queryKey: ['world'], queryFn: api.world });
}

export function useNPCs() {
  return useQuery({ queryKey: ['npcs'], queryFn: api.npcs });
}

export function useLogs(cycle?: number) {
  return useQuery({
    queryKey: ['logs', cycle],
    queryFn: () => api.logs(cycle),
  });
}

export function useEvents(sinceISO?: string) {
  return useQuery({
    queryKey: ['events', sinceISO],
    queryFn: () => api.events(sinceISO),
  });
}

export function useAdvanceCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.advanceCycle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['world'] });
      qc.invalidateQueries({ queryKey: ['npcs'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Backend-driven auto-cycle. Picker fires /start or /stop; the server
// timer owns execution. World/npcs/logs queries still refetch on their
// own 3s cadence, so the dashboard reflects server state without any
// client-side interval.
export function useAutoCycleStatus() {
  return useQuery({ queryKey: ['auto-cycle'], queryFn: api.autoCycleStatus });
}

export function useQuests(status?: 'accepted' | 'completed' | 'declined') {
  return useQuery({
    queryKey: ['quests', status ?? 'all'],
    queryFn: () => api.quests(status),
  });
}

export function useQuestTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.questTransition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quests'] });
    },
  });
}

export function useAffinity(opts: { min_score?: number; npc_id?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['affinity', opts.min_score ?? 'all', opts.npc_id ?? 'all', opts.limit ?? 100],
    queryFn: () => api.affinity(opts),
  });
}

export function useAutoCycleControl() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['auto-cycle'] });
  };
  const start = useMutation({
    mutationFn: (interval_sec: number) => api.autoCycleStart(interval_sec),
    onSuccess: invalidate,
  });
  const stop = useMutation({
    mutationFn: api.autoCycleStop,
    onSuccess: invalidate,
  });
  return { start, stop };
}
