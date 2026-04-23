import { useState } from 'react';
import { useWorld, useNPCs, useLogs, useAutoCycle } from './hooks/useWorld';
import { GameMap } from './components/GameMap';
import { Header } from './components/Header';
import { StatsCard } from './components/StatsCard';
import { NPCList } from './components/NPCList';
import { LogsFeed } from './components/LogsFeed';

export default function App() {
  const [autoSpeedMs, setAutoSpeedMs] = useState(0);

  const world = useWorld();
  const npcs = useNPCs();
  const logs = useLogs();
  const advance = useAutoCycle(autoSpeedMs);

  const loading = world.isLoading || npcs.isLoading || logs.isLoading;
  const error = world.error || npcs.error || logs.error || advance.error;

  if (loading && !world.data) {
    return (
      <div className="boot">
        <div className="boot-title">Lendstead</div>
        <div className="boot-sub">Reading island state...</div>
      </div>
    );
  }

  if (!world.data) {
    return (
      <div style={{ padding: 24 }}>
        <div className="error">
          Couldn't reach the backend. Check <code>VITE_API_URL</code> and that
          the API is live.
          {error instanceof Error && (
            <div style={{ marginTop: 8 }}>{error.message}</div>
          )}
        </div>
      </div>
    );
  }

  const w = world.data;
  const allNPCs = npcs.data ?? [];
  const allLogs = logs.data ?? [];

  return (
    <div className="app">
      <Header
        world={w}
        aliveNPCs={allNPCs.filter((n) => n.alive).length}
        autoSpeedMs={autoSpeedMs}
        onAutoSpeedChange={setAutoSpeedMs}
        onAdvance={() => advance.mutate()}
        advancing={advance.isPending}
        lastSyncLabel={new Date(w.updated_at).toLocaleTimeString()}
        errorMessage={error instanceof Error ? error.message : undefined}
      />
      <GameMap world={w} npcs={allNPCs} />
      <StatsCard world={w} />
      <NPCList npcs={allNPCs} />
      <LogsFeed logs={allLogs} />
    </div>
  );
}
