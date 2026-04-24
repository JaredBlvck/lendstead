// Enemy registry. Mirrors NpcRegistry / ItemRegistry pattern.

import type { Enemy } from './enemyTypes';

export class EnemyRegistry {
  private byId = new Map<string, Enemy>();

  register(e: Enemy): void {
    if (this.byId.has(e.id)) throw new Error(`EnemyRegistry: duplicate enemy id ${e.id}`);
    this.byId.set(e.id, e);
  }

  registerMany(es: Enemy[]): void {
    for (const e of es) this.register(e);
  }

  get(id: string): Enemy | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): Enemy[] {
    return Array.from(this.byId.values());
  }

  byArchetype(archetype: Enemy['archetype']): Enemy[] {
    return this.all().filter((e) => e.archetype === archetype);
  }

  byRegion(regionId: string): Enemy[] {
    return this.all().filter((e) => e.spawn.region_ids.includes(regionId));
  }

  // Find enemies eligible to spawn for a threat_sighted event, given
  // severity + optional region + optional settlement level.
  spawnableFor(opts: {
    severity: 'minor' | 'major' | 'catastrophic';
    region_id?: string;
    settlement_level?: string;
  }): Enemy[] {
    return this.all().filter((e) => {
      if (!e.spawn.on_threat_severity.includes(opts.severity)) return false;
      if (
        opts.region_id &&
        e.spawn.region_ids.length > 0 &&
        !e.spawn.region_ids.includes(opts.region_id)
      ) return false;
      return true;
    });
  }

  size(): number {
    return this.byId.size;
  }

  lookup = (id: string): Enemy | undefined => this.byId.get(id);
}
