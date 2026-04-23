import { useWorld, useNPCs, useLogs, useAdvanceCycle } from './hooks/useWorld';
import { IslandMap } from './components/IslandMap';
import { StatsCard } from './components/StatsCard';
import { NPCList } from './components/NPCList';
import { LogsFeed } from './components/LogsFeed';

export default function App() {
  const world = useWorld();
  const npcs = useNPCs();
  const logs = useLogs();
  const advance = useAdvanceCycle();

  const loading = world.isLoading || npcs.isLoading || logs.isLoading;
  const error = world.error || npcs.error || logs.error || advance.error;

  if (loading && !world.data) {
    return (
      <div className="app" style={{ gridTemplateAreas: '"header" "map" "stats"' }}>
        <div className="header">
          <div>
            <h1>Lendstead</h1>
            <div className="subtitle">Connecting to island…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!world.data) {
    return (
      <div style={{ padding: 24 }}>
        <div className="error">
          Couldn't reach the backend. Check <code>VITE_API_URL</code> and that the
          API is live.
          {error instanceof Error && <div style={{ marginTop: 8 }}>{error.message}</div>}
        </div>
      </div>
    );
  }

  const w = world.data;
  const allNPCs = npcs.data ?? [];
  const allLogs = logs.data ?? [];

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>{w.civ_name}</h1>
          <div className="subtitle">
            Co-led by Sr (Opportunist) + Jr (Architect) · Cycle {w.cycle} · {w.population} alive
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {error instanceof Error && (
            <div className="error" style={{ padding: '6px 10px', fontSize: 12 }}>
              {error.message}
            </div>
          )}
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            Last sync {new Date(w.updated_at).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <IslandMap npcs={allNPCs} cycle={w.cycle} />
      <StatsCard
        world={w}
        onAdvance={() => advance.mutate()}
        advancing={advance.isPending}
      />
      <NPCList npcs={allNPCs} />
      <LogsFeed logs={allLogs} />
    </div>
  );
}
