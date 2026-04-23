import { useEffect, useRef, useState } from 'react';
import type { World } from '../types';

interface Props {
  world: World;
}

// Highlight keys that changed since the previous render for a moment.
function useChangedKeys(map: Record<string, unknown>, resetMs: number): Set<string> {
  const prevRef = useRef<Record<string, unknown> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (!prev) {
      prevRef.current = map;
      return;
    }
    const diff = new Set<string>();
    Object.keys(map).forEach((k) => {
      if (JSON.stringify(map[k]) !== JSON.stringify(prev[k])) diff.add(k);
    });
    Object.keys(prev).forEach((k) => {
      if (!(k in map)) diff.add(k);
    });
    if (diff.size > 0) {
      setChanged(diff);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setChanged(new Set()), resetMs);
    }
    prevRef.current = map;
  }, [map, resetMs]);

  return changed;
}

function renderVal(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.join(', ');
  return JSON.stringify(v);
}

export function StatsCard({ world }: Props) {
  const resourceChanges = useChangedKeys(
    world.resources as unknown as Record<string, unknown>,
    2400,
  );
  const infraChanges = useChangedKeys(
    world.infrastructure as unknown as Record<string, unknown>,
    2400,
  );

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

      <div className="section-label">Resources</div>
      {Object.keys(world.resources || {}).length === 0 ? (
        <div className="empty-hint">None tracked</div>
      ) : (
        Object.entries(world.resources).map(([k, v]) => (
          <div className={`kv ${resourceChanges.has(k) ? 'flash' : ''}`} key={k}>
            <span className="k">{k}</span>
            <span className="v">{renderVal(v)}</span>
          </div>
        ))
      )}

      <div className="section-label" style={{ marginTop: 12 }}>
        Infrastructure
      </div>
      {Object.keys(world.infrastructure || {}).length === 0 ? (
        <div className="empty-hint">Nothing built yet</div>
      ) : (
        Object.entries(world.infrastructure).map(([k, v]) => (
          <div className={`kv ${infraChanges.has(k) ? 'flash' : ''}`} key={k}>
            <span className="k">{k}</span>
            <span className="v">{renderVal(v)}</span>
          </div>
        ))
      )}
    </div>
  );
}
