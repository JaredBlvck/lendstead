// Drop table roller. Pure function over a DropTable + optional condition set.
// Separates RNG via injected randomFn so tests can be deterministic.

import type { DropEntry, DropModifier, DropTable, IndependentDrop, RolledDrop } from './dropTypes';

export type RandomFn = () => number;   // returns [0,1)

export interface RollOptions {
  random?: RandomFn;
  activeConditions?: string[];   // e.g. ['biome:hollowmere', 'quest_complete:quest_founder']
  luck?: number;                 // global multiplier applied to rare + ultra_rare chance (default 1)
}

// Apply matching modifiers to get effective chances and per-item weight overrides.
function applyModifiers(
  table: DropTable,
  conditions: string[],
): {
  rareChance: number;
  ultraRareMul: number;
  weightBoosts: Record<string, number>;
} {
  let rareChance = table.rare_chance;
  let ultraRareMul = 1;
  const weightBoosts: Record<string, number> = {};

  const matches: DropModifier[] = table.modifiers.filter((m) => conditions.includes(m.condition));
  for (const mod of matches) {
    rareChance *= mod.rare_chance_multiplier;
    ultraRareMul *= mod.ultra_rare_chance_multiplier;
    for (const [itemId, mul] of Object.entries(mod.weight_boosts)) {
      weightBoosts[itemId] = (weightBoosts[itemId] ?? 1) * mul;
    }
  }
  return { rareChance: Math.min(1, rareChance), ultraRareMul, weightBoosts };
}

// Weighted pick from a list of DropEntry. Returns null if list empty or all weights 0.
function weightedPick(
  entries: DropEntry[],
  random: RandomFn,
  weightBoosts: Record<string, number>,
): DropEntry | null {
  if (entries.length === 0) return null;
  const effective = entries.map((e) => ({
    entry: e,
    w: e.weight * (weightBoosts[e.item_id] ?? 1),
  }));
  const total = effective.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (const { entry, w } of effective) {
    r -= w;
    if (r <= 0) return entry;
  }
  return effective[effective.length - 1].entry;
}

function rollQty(entry: DropEntry | IndependentDrop, random: RandomFn): number {
  if (entry.min_qty === entry.max_qty) return entry.min_qty;
  const span = entry.max_qty - entry.min_qty + 1;
  return entry.min_qty + Math.floor(random() * span);
}

export function rollDropTable(table: DropTable, opts: RollOptions = {}): RolledDrop[] {
  const random = opts.random ?? Math.random;
  const conditions = opts.activeConditions ?? [];
  const luck = opts.luck ?? 1;
  const { rareChance, ultraRareMul, weightBoosts } = applyModifiers(table, conditions);

  const results: RolledDrop[] = [];

  // 1. Guaranteed drops
  for (const entry of table.guaranteed_drops) {
    results.push({
      item_id: entry.item_id,
      qty: rollQty(entry, random),
      pool: 'guaranteed',
    });
  }

  // 2. Tiered pools: common -> uncommon -> rare, falling through on miss.
  const commonRoll = random();
  if (commonRoll < table.common_chance) {
    const pick = weightedPick(table.common_drops, random, weightBoosts);
    if (pick) {
      results.push({ item_id: pick.item_id, qty: rollQty(pick, random), pool: 'common' });
    }
  } else {
    const uncommonRoll = random();
    if (uncommonRoll < table.uncommon_chance) {
      const pick = weightedPick(table.uncommon_drops, random, weightBoosts);
      if (pick) {
        results.push({ item_id: pick.item_id, qty: rollQty(pick, random), pool: 'uncommon' });
      }
    } else {
      const effectiveRare = Math.min(1, rareChance * luck);
      const rareRoll = random();
      if (rareRoll < effectiveRare) {
        const pick = weightedPick(table.rare_drops, random, weightBoosts);
        if (pick) {
          results.push({ item_id: pick.item_id, qty: rollQty(pick, random), pool: 'rare' });
        }
      }
    }
  }

  // 3. Ultra-rare: always rolled independently with absolute chance.
  for (const drop of table.ultra_rare_drops) {
    const p = Math.min(1, drop.chance * ultraRareMul * luck);
    if (random() < p) {
      results.push({ item_id: drop.item_id, qty: rollQty(drop, random), pool: 'ultra_rare' });
    }
  }

  return results;
}

// Simulation helper - roll N times and return aggregate counts per item.
export function simulateDrops(
  table: DropTable,
  n: number,
  opts: RollOptions = {},
): {
  totals: Record<string, number>;
  perPool: Record<string, number>;
  rolls: number;
} {
  const totals: Record<string, number> = {};
  const perPool: Record<string, number> = {
    guaranteed: 0,
    common: 0,
    uncommon: 0,
    rare: 0,
    ultra_rare: 0,
  };
  for (let i = 0; i < n; i++) {
    const drops = rollDropTable(table, opts);
    for (const d of drops) {
      totals[d.item_id] = (totals[d.item_id] ?? 0) + d.qty;
      perPool[d.pool] += 1;
    }
  }
  return { totals, perPool, rolls: n };
}

// Deterministic seeded RNG helper (mulberry32) for tests and simulation mode.
export function seededRandom(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
