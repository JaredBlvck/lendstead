import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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

// Auto-cycle ticker. Until backend /api/auto-cycle/{start,stop} ship,
// this is pure client-side: fires POST /api/cycle/advance every
// intervalMs while enabled. Zero on intervalMs disables.
export function useAutoCycle(intervalMs: number) {
  const advance = useAdvanceCycle();
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    if (!intervalMs) return;
    const id = window.setInterval(() => {
      if (!advanceRef.current.isPending) {
        advanceRef.current.mutate();
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return advance;
}
