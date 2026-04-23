import { useEffect, useRef, useState } from 'react';
import type { World, ResourceBalance } from '../types';
import { readPressure } from '../lib/pressure';

interface Props {
  world: World;
}

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

function BalanceBar({ label, balance }: { label: string; balance: ResourceBalance }) {
  const delta = balance.production - balance.consumption;
  const deficit = balance.surplus_days < 0 || delta < 0;
  const critical = balance.surplus_days < 1;
  const cls = critical ? 'balance critical' : deficit ? 'balance warn' : 'balance ok';
  const magnitude = Math.min(1, Math.abs(delta) / Math.max(1, balance.consumption));
  return (
    <div className={cls}>
      <div className="balance-head">
        <span className="balance-label">{label}</span>
        <span className="balance-days">
          {balance.surplus_days >= 0
            ? `${balance.surplus_days.toFixed(1)}d buffer`
            : `${Math.abs(balance.surplus_days).toFixed(1)}d deficit`}
        </span>
      </div>
      <div className="balance-bar">
        <div
          className="balance-fill"
          style={{
            width: `${Math.max(4, magnitude * 100)}%`,
          }}
        />
      </div>
      <div className="balance-meta">
        prod {balance.production.toFixed(1)} / cons {balance.consumption.toFixed(1)}
      </div>
    </div>
  );
}

export function StatsCard({ world }: Props) {
  const pressure = readPressure(world);
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

      {(pressure.food || pressure.water) && (
        <div style={{ marginBottom: 12 }}>
          <div className="section-label">Pressure</div>
          {pressure.food && <BalanceBar label="Food" balance={pressure.food} />}
          {pressure.water && <BalanceBar label="Water" balance={pressure.water} />}
        </div>
      )}

      <div className="section-label">Resources</div>
      {Object.keys(world.resources || {}).length === 0 ? (
        <div className="empty-hint">None tracked</div>
      ) : (
        Object.entries(world.resources)
          .filter(([k]) => !/_balance$|_production$|_consumption$|_surplus_days$|_deficit_days$/.test(k))
          .map(([k, v]) => (
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
