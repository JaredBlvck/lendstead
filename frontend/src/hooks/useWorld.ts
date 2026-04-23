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

export function useAdvanceCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.advanceCycle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['world'] });
      qc.invalidateQueries({ queryKey: ['npcs'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}
