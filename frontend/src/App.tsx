import { lazy, Suspense, useState } from 'react';
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
import { DevPanelHost } from './game/engine/DevPanelHost';
import { EngineUIHost } from './game/ui/EngineUIHost';
import { EventBridge } from './game/engine/EventBridge';

// 3D exploration view is code-split so the Three.js bundle only loads
// when the user opens it.
const ExplorationView = lazy(() =>
  import('./components/ExplorationView').then((m) => ({ default: m.ExplorationView })),
);

export default function App() {
  const [mode, setMode] = useState<'dashboard' | 'exploration'>('dashboard');

  const world = useWorld();
  const npcs = useNPCs();
  const logs = useLogs();
  const manualAdvance = useAdvanceCycle();

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
  const autoPending = autoCtl.start.isPending || autoCtl.stop.isPending;

  if (mode === 'exploration') {
    return (
      <>
        <Suspense
          fallback={
            <div className="boot">
              <div className="boot-title">Lendstead</div>
              <div className="boot-sub">Entering the island...</div>
            </div>
          }
        >
          <ExplorationView
            world={w}
            npcs={allNPCs}
            onExit={() => setMode('dashboard')}
          />
        </Suspense>
        <EventBridge />
        <EngineUIHost />
        <DevPanelHost />
      </>
    );
  }

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
        onEnter3D={() => setMode('exploration')}
      />
      <GameMap world={w} npcs={allNPCs} />
      <StatsCard world={w} />
      <NPCList npcs={allNPCs} />
      <LogsFeed logs={allLogs} />
      <DevPanelHost />
    </div>
  );
}
