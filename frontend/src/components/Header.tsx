import { useMemo } from 'react';
import type { World } from '../types';
import { deriveStage } from '../lib/progression';

interface Props {
  world: World;
  aliveNPCs: number;
  autoSpeedMs: number;
  onAutoSpeedChange: (ms: number) => void;
  onAdvance: () => void;
  advancing: boolean;
  lastSyncLabel: string;
  errorMessage?: string;
}

const SPEED_OPTIONS: Array<{ label: string; ms: number }> = [
  { label: 'Off', ms: 0 },
  { label: '3s', ms: 3000 },
  { label: '8s', ms: 8000 },
  { label: '20s', ms: 20000 },
];

export function Header({
  world,
  aliveNPCs,
  autoSpeedMs,
  onAutoSpeedChange,
  onAdvance,
  advancing,
  lastSyncLabel,
  errorMessage,
}: Props) {
  // Stage is derived from the canonical world.population so it only bumps
  // when a cycle advance commits. Header also shows alive NPCs so viewers
  // can see mid-cycle growth before the pop number syncs.
  const stage = useMemo(() => deriveStage(world.population), [world.population]);
  const mismatch = aliveNPCs !== world.population;

  return (
    <div className="header">
      <div>
        <h1>{world.civ_name}</h1>
        <div className="subtitle">
          Co-led by Sr (Opportunist) + Jr (Architect) &middot; Cycle {world.cycle} &middot;{' '}
          Pop {world.population}
          {mismatch && (
            <span style={{ color: 'var(--accent)', marginLeft: 6 }}>
              ({aliveNPCs} alive, syncs next advance)
            </span>
          )}
        </div>
      </div>

      <div className="header-right">
        <div className="stage-badge" style={{ borderColor: stage.accent }}>
          <div className="stage-label" style={{ color: stage.accent }}>
            {stage.stage}
          </div>
          <div className="stage-bar">
            <div
              className="stage-fill"
              style={{ width: `${stage.progress * 100}%`, background: stage.accent }}
            />
          </div>
          <div className="stage-next">
            {stage.next
              ? `${stage.stage} -> ${stage.next} at ${stage.threshold} pop`
              : 'max stage'}
          </div>
        </div>

        <div className="speed-picker">
          <span className="speed-label">AUTO</span>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.ms}
              className={`speed-btn ${autoSpeedMs === opt.ms ? 'on' : ''}`}
              onClick={() => onAutoSpeedChange(opt.ms)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button className="advance-btn" onClick={onAdvance} disabled={advancing}>
          {advancing ? 'Advancing...' : `Advance -> C${world.cycle + 1}`}
        </button>

        <div className="header-meta">
          {errorMessage && (
            <div className="error" style={{ padding: '4px 8px', fontSize: 11 }}>
              {errorMessage}
            </div>
          )}
          <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            Sync {lastSyncLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
