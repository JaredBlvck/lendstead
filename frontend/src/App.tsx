import {
  useWorld,
  useNPCs,
  useLogs,
  useAdvanceCycle,
  useAutoCycleStatus,
  useAutoCycleControl,
} from './hooks/useWorld';
import { GameMap } from './components/GameMap';
import { Header } from './components/Header';
import { StatsCard } from './components/StatsCard';
import { NPCList } from './components/NPCList';
import { LogsFeed } from './components/LogsFeed';

export default function App() {
  const world = useWorld();
  const npcs = useNPCs();
  const logs = useLogs();
  const manualAdvance = useAdvanceCycle();

  // Backend owns auto-cycle execution. UI picks the speed, server runs the
  // ticker, status query reflects what's actually running. World/npcs/logs
  // still poll every 3s so server advances appear naturally.
  const autoStatus = useAutoCycleStatus();
  const autoCtl = useAutoCycleControl();

  const currentSpeedMs =
    autoStatus.data?.running && autoStatus.data?.interval_sec
      ? autoStatus.data.interval_sec * 1000
      : 0;

  const onAutoSpeedChange = (ms: number) => {
    if (ms === 0) {
      autoCtl.stop.mutate();
    } else {
      autoCtl.start.mutate(Math.max(1, Math.round(ms / 1000)));
    }
  };

  const loading = world.isLoading || npcs.isLoading || logs.isLoading;
  const error =
    world.error ||
    npcs.error ||
    logs.error ||
    manualAdvance.error ||
    autoCtl.start.error ||
    autoCtl.stop.error;

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
  const autoPending =
    autoCtl.start.isPending || autoCtl.stop.isPending;

  return (
    <div className="app">
      <Header
        world={w}
        aliveNPCs={allNPCs.filter((n) => n.alive).length}
        autoSpeedMs={currentSpeedMs}
        autoPending={autoPending}
        autoStartedAt={autoStatus.data?.started_at ?? null}
        onAutoSpeedChange={onAutoSpeedChange}
        onAdvance={() => manualAdvance.mutate()}
        advancing={manualAdvance.isPending}
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
