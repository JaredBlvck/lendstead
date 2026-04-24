// Discovery runtime. Pure functions over DiscoverySite + WorldState +
// player DiscoveryState. Exposes:
//  - canInspect(): gate by reveal_condition + one_shot
//  - inspectSite(): rolls reveal_chance, grants fragment item, emits
//    collect_carving event through caller
// Component layer owns the emission + inventory writes; this module
// stays pure so it can be unit-tested without React.

import type { DiscoveryCondition, DiscoverySite, DiscoveryState } from './carvingTypes';
import type { WorldState } from '../world/worldState';
import { getFactionReputation } from '../world/worldState';

// Class registry for lookups.
export class DiscoveryRegistry {
  private byId = new Map<string, DiscoverySite>();

  register(s: DiscoverySite): void {
    if (this.byId.has(s.id)) throw new Error(`DiscoveryRegistry: duplicate site id ${s.id}`);
    this.byId.set(s.id, s);
  }

  registerMany(ss: DiscoverySite[]): void {
    for (const s of ss) this.register(s);
  }

  get(id: string): DiscoverySite | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): DiscoverySite[] {
    return Array.from(this.byId.values());
  }

  byRegion(regionId: string): DiscoverySite[] {
    return this.all().filter((s) => s.region_id === regionId);
  }

  size(): number {
    return this.byId.size;
  }

  lookup = (id: string): DiscoverySite | undefined => this.byId.get(id);
}

// Evaluate whether a discovery's reveal_condition is satisfied by world state.
export function isConditionMet(cond: DiscoveryCondition, world: WorldState): boolean {
  const p = cond.params;
  switch (cond.kind) {
    case 'always':
      return true;
    case 'world_flag':
      return world.world_flags[String(p.key ?? '')] === Boolean(p.value ?? true);
    case 'faction_reputation_at_least': {
      const rep = getFactionReputation(world, String(p.faction_id ?? ''));
      return (rep?.score ?? 0) >= Number(p.score ?? 0);
    }
    case 'settlement_level': {
      const levels = [
        'stranded_camp',
        'working_camp',
        'first_village',
        'fortified_village',
        'trade_settlement',
        'island_holdfast',
        'lendstead_seat',
      ];
      const required = String(p.level ?? 'stranded_camp');
      return levels.indexOf(world.settlement_level) >= levels.indexOf(required);
    }
    case 'completed_quest':
      return world.completed_quest_ids.includes(String(p.quest_id ?? ''));
    default:
      return false;
  }
}

export interface InspectOutcome {
  ok: boolean;
  reason?: string;
  revealed: boolean;       // true on the current inspect - site newly revealed this call
  already_revealed: boolean; // true when this site was previously revealed
  fragment_item_id?: string;
  lore_text?: string;
  next_state: DiscoveryState;
}

export type RandomFn = () => number;

function freshDiscoveryState(siteId: string): DiscoveryState {
  return {
    site_id: siteId,
    revealed: false,
    inspections: 0,
  };
}

export function inspectSite(
  site: DiscoverySite,
  state: DiscoveryState | undefined,
  world: WorldState,
  random: RandomFn = Math.random,
): InspectOutcome {
  const current = state ?? freshDiscoveryState(site.id);
  const incremented: DiscoveryState = {
    ...current,
    inspections: current.inspections + 1,
  };

  if (!isConditionMet(site.reveal_condition, world)) {
    return {
      ok: false,
      reason: 'conditions not met',
      revealed: false,
      already_revealed: current.revealed,
      next_state: incremented,
    };
  }

  // Already revealed and one-shot: return cached lore, no fragment
  if (current.revealed && site.one_shot) {
    return {
      ok: true,
      revealed: false,
      already_revealed: true,
      lore_text: site.lore_text,
      next_state: incremented,
    };
  }

  // Roll reveal chance
  const roll = random();
  if (roll >= site.reveal_chance) {
    return {
      ok: true,
      revealed: false,
      already_revealed: current.revealed,
      next_state: incremented,
    };
  }

  return {
    ok: true,
    revealed: true,
    already_revealed: current.revealed,
    fragment_item_id: site.reveals_item_id,
    lore_text: site.lore_text,
    next_state: {
      ...incremented,
      revealed: true,
      revealed_at_cycle: world.cycle,
    },
  };
}
