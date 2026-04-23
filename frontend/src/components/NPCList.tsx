import { useEffect, useRef, useState } from 'react';
import type { NPC } from '../types';

interface Props {
  npcs: NPC[];
}

const moraleIcon: Record<NPC['morale'], string> = {
  low: '▼',
  med: '●',
  medium: '●',
  high: '▲',
};

const moraleColor: Record<NPC['morale'], string> = {
  low: 'var(--bad)',
  med: 'var(--text-dim)',
  medium: 'var(--text-dim)',
  high: 'var(--good)',
};

function shortRole(role: string): string {
  return role.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NPCList({ npcs }: Props) {
  const alive = npcs.filter((n) => n.alive);
  const srCount = alive.filter((n) => n.lane === 'sr').length;
  const jrCount = alive.filter((n) => n.lane === 'jr').length;

  const seenIds = useRef<Set<number>>(new Set());
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    const newOnes = new Set<number>();
    alive.forEach((n) => {
      if (!seenIds.current.has(n.id)) {
        newOnes.add(n.id);
        seenIds.current.add(n.id);
      }
    });
    if (newOnes.size > 0) {
      setFresh(newOnes);
      const t = window.setTimeout(() => setFresh(new Set()), 2400);
      return () => window.clearTimeout(t);
    }
  }, [alive]);

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
          {' '}&middot;{' '}
          <span style={{ color: 'var(--jr)' }}>Jr {jrCount}</span>
        </span>
      </h2>
      {alive.length === 0 && (
        <div className="empty-hint">No population yet.</div>
      )}
      {alive.map((n) => (
        <div
          className={`npc-row ${fresh.has(n.id) ? 'fresh' : ''}`}
          key={n.id}
        >
          <span className={`lane-dot ${n.lane}`} />
          <div>
            <div style={{ fontWeight: 600 }}>{n.name}</div>
            <div className="meta">
              {shortRole(n.role)} &middot; Skill {n.skill}
            </div>
          </div>
          <span
            style={{ color: moraleColor[n.morale] }}
            title={`Morale: ${n.morale}`}
          >
            {moraleIcon[n.morale] ?? '?'}
          </span>
          <span className="status" title={n.status}>
            {n.status}
          </span>
        </div>
      ))}
    </div>
  );
}
