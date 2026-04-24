import { useMemo } from 'react';
import type { World, NPC } from '../types';

interface Props {
  world: World;
  npcs: NPC[];
  open: boolean;
  onClose: () => void;
}

function aggregateRoles(npcs: NPC[]): Array<{ role: string; count: number }> {
  const map = new Map<string, number>();
  for (const n of npcs) {
    if (!n.alive || n.condition === 'dead') continue;
    const base = n.role.split(/[- ]/)[0];
    map.set(base, (map.get(base) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);
}

export function TreasuryPanel({ world, npcs, open, onClose }: Props) {
  const roles = useMemo(() => aggregateRoles(npcs), [npcs]);
  const alive = npcs.filter((n) => n.alive && n.condition !== 'dead').length;
  const injured = npcs.filter((n) => n.condition === 'injured' || n.condition === 'incapacitated').length;

  // Pull headline resource values from world.resources JSONB
  const r = (world.resources as unknown as Record<string, unknown>) || {};
  const food = typeof r.food_balance === 'number' ? r.food_balance : (typeof r.food_production === 'number' && typeof r.food_consumption === 'number' ? r.food_production - r.food_consumption : null);
  const water = typeof r.water_balance === 'number' ? r.water_balance : (typeof r.water_production === 'number' && typeof r.water_consumption === 'number' ? r.water_production - r.water_consumption : null);
  const materials = Array.isArray(r.materials) ? (r.materials as string[]) : [];
  const foodSources = Array.isArray(r.food_sources) ? (r.food_sources as string[]) : [];

  // Infrastructure summary
  const infraKeys = Object.keys(world.infrastructure || {}).length;

  if (!open) return null;

  return (
    <div className="treasury-panel">
      <div className="treasury-head">
        <span>TREASURY</span>
        <button className="treasury-close" onClick={onClose}>×</button>
      </div>

      <div className="treasury-section">
        <div className="treasury-section-label">CIVILIZATION</div>
        <div className="treasury-row">
          <span>{world.civ_name}</span>
          <span>Cycle {world.cycle}</span>
        </div>
        <div className="treasury-row">
          <span>Population</span>
          <span className="treasury-val">{alive}{injured > 0 && <span className="treasury-sub"> ({injured} hurt)</span>}</span>
        </div>
      </div>

      <div className="treasury-section">
        <div className="treasury-section-label">RESOURCE BALANCE</div>
        {food != null && (
          <div className="treasury-row">
            <span>Food flow</span>
            <span className={`treasury-val ${food >= 0 ? 'good' : 'bad'}`}>
              {food >= 0 ? '+' : ''}{food.toFixed(1)}/cycle
            </span>
          </div>
        )}
        {water != null && (
          <div className="treasury-row">
            <span>Water flow</span>
            <span className={`treasury-val ${water >= 0 ? 'good' : 'bad'}`}>
              {water >= 0 ? '+' : ''}{water.toFixed(1)}/cycle
            </span>
          </div>
        )}
        {materials.length > 0 && (
          <div className="treasury-row">
            <span>Materials</span>
            <span className="treasury-val treasury-sub">{materials.length} tracked</span>
          </div>
        )}
        {foodSources.length > 0 && (
          <div className="treasury-row">
            <span>Food sources</span>
            <span className="treasury-val treasury-sub">{foodSources.length} active</span>
          </div>
        )}
      </div>

      <div className="treasury-section">
        <div className="treasury-section-label">MAGIC</div>
        <div className="treasury-row">
          <span>SR Energy</span>
          <span className="treasury-val" style={{ color: 'var(--sr)' }}>{(world.sr_energy ?? 0).toFixed(0)}/100</span>
        </div>
        <div className="treasury-row">
          <span>JR Energy</span>
          <span className="treasury-val" style={{ color: 'var(--jr)' }}>{(world.jr_energy ?? 0).toFixed(0)}/100</span>
        </div>
        <div className="treasury-row">
          <span>Awakened abilities</span>
          <span className="treasury-val">{(world.breakthroughs || []).length}</span>
        </div>
      </div>

      <div className="treasury-section">
        <div className="treasury-section-label">INFRASTRUCTURE</div>
        <div className="treasury-row">
          <span>Structures + systems</span>
          <span className="treasury-val">{infraKeys}</span>
        </div>
      </div>

      <div className="treasury-section">
        <div className="treasury-section-label">ROSTER BY ROLE</div>
        {roles.slice(0, 12).map((r) => (
          <div key={r.role} className="treasury-row">
            <span className="treasury-role">{r.role.replace(/_/g, ' ')}</span>
            <span className="treasury-val">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
