import type { World } from '../types';

interface Props {
  world: World;
  onAdvance: () => void;
  advancing: boolean;
}

export function StatsCard({ world, onAdvance, advancing }: Props) {
  return (
    <div className="card stats">
      <h2>Civilization</h2>
      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div className="stat">
          <div className="label">Cycle</div>
          <div className="value">{world.cycle}</div>
        </div>
        <div className="stat">
          <div className="label">Population</div>
          <div className="value">{world.population}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            marginBottom: 4,
          }}
        >
          Resources
        </div>
        {Object.keys(world.resources || {}).length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>None tracked</div>
        ) : (
          Object.entries(world.resources).map(([k, v]) => (
            <div className="kv" key={k}>
              <span className="k">{k}</span>
              <span className="v">{v}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            marginBottom: 4,
          }}
        >
          Infrastructure
        </div>
        {Object.keys(world.infrastructure || {}).length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>Nothing built yet</div>
        ) : (
          Object.entries(world.infrastructure).map(([k, v]) => (
            <div className="kv" key={k}>
              <span className="k">{k}</span>
              <span className="v">{v}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        <button onClick={onAdvance} disabled={advancing}>
          {advancing ? 'Advancing…' : `Advance to Cycle ${world.cycle + 1}`}
        </button>
      </div>
    </div>
  );
}
