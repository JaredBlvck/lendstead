import type { NPC } from '../types';

interface Props {
  npcs: NPC[];
}

const moraleIcon: Record<NPC['morale'], string> = {
  low: '▼',
  medium: '●',
  high: '▲',
};

const moraleColor: Record<NPC['morale'], string> = {
  low: 'var(--bad)',
  medium: 'var(--text-dim)',
  high: 'var(--good)',
};

export function NPCList({ npcs }: Props) {
  const alive = npcs.filter((n) => n.alive);
  const srCount = alive.filter((n) => n.lane === 'sr').length;
  const jrCount = alive.filter((n) => n.lane === 'jr').length;

  return (
    <div className="card npcs">
      <h2>
        Population ({alive.length})
        <span
          style={{
            float: 'right',
            fontSize: 11,
            color: 'var(--text-dim)',
            fontWeight: 'normal',
          }}
        >
          <span style={{ color: 'var(--sr)' }}>Sr {srCount}</span>
          {' · '}
          <span style={{ color: 'var(--jr)' }}>Jr {jrCount}</span>
        </span>
      </h2>
      {alive.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No population yet.</div>
      )}
      {alive.map((n) => (
        <div className="npc-row" key={n.id}>
          <span className={`lane-dot ${n.lane}`} />
          <div>
            <div style={{ fontWeight: 600 }}>{n.name}</div>
            <div className="meta">
              {n.role} · Skill {n.skill}
            </div>
          </div>
          <span
            style={{ color: moraleColor[n.morale] }}
            title={`Morale: ${n.morale}`}
          >
            {moraleIcon[n.morale]}
          </span>
          <span className="status" title={n.status}>
            {n.status}
          </span>
        </div>
      ))}
    </div>
  );
}
