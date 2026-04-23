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

function conditionBadge(c: NPC['condition']): { label: string; className: string } | null {
  if (!c || c === 'healthy') return null;
  if (c === 'injured') return { label: 'INJ', className: 'condition-injured' };
  if (c === 'incapacitated') return { label: 'INC', className: 'condition-incap' };
  if (c === 'dead') return { label: 'DEAD', className: 'condition-dead' };
  return null;
}

export function NPCList({ npcs }: Props) {
  // Include dead NPCs in the list briefly so consequence is visible,
  // then drop them once the backend flags them not-alive.
  const visible = npcs.filter((n) => n.alive || n.condition === 'dead');
  const alive = npcs.filter((n) => n.alive && n.condition !== 'dead');
  const srCount = alive.filter((n) => n.lane === 'sr').length;
  const jrCount = alive.filter((n) => n.lane === 'jr').length;
  const injured = alive.filter((n) => n.condition === 'injured' || n.condition === 'incapacitated').length;
  const dead = visible.filter((n) => n.condition === 'dead').length;

  const seenIds = useRef<Set<number>>(new Set());
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    const newOnes = new Set<number>();
    visible.forEach((n) => {
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
  }, [visible]);

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
          {injured > 0 && (
            <>
              {' '}&middot;{' '}
              <span style={{ color: 'var(--warn)' }}>{injured} hurt</span>
            </>
          )}
          {dead > 0 && (
            <>
              {' '}&middot;{' '}
              <span style={{ color: 'var(--bad)' }}>{dead} lost</span>
            </>
          )}
        </span>
      </h2>
      {alive.length === 0 && (
        <div className="empty-hint">No population yet.</div>
      )}
      {visible.map((n) => {
        const badge = conditionBadge(n.condition);
        const classes = [
          'npc-row',
          fresh.has(n.id) && 'fresh',
          badge && badge.className,
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div className={classes} key={n.id}>
            <span className={`lane-dot ${n.lane}`} />
            <div>
              <div style={{ fontWeight: 600 }}>
                {n.name}
                {badge && (
                  <span
                    className={`condition-tag ${badge.className}`}
                    title={n.condition}
                  >
                    {badge.label}
                  </span>
                )}
              </div>
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
        );
      })}
    </div>
  );
}
