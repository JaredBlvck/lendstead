// Resource pressure + zone risk helpers.
//
// Backend ships: food_production, food_consumption, food_balance (flat
// number = prod - cons), food_deficit_days (counter, ticks only while
// balance < 0). When balance >= 0 the deficit_days counter stays 0,
// which does NOT mean "no buffer" - it means "not currently in deficit".
// Our surplus_days field here normalizes:
//   positive number = days of deficit runway available (computed from surplus/consumption when backend doesn't ship it)
//   negative number = days already spent in deficit

import type { World, ResourceBalance } from '../types';

function computeSurplusDays(
  production: number,
  consumption: number,
  deficitDays: number | null,
): number {
  // In deficit: return negative of backend's accumulated deficit days
  if (deficitDays != null && deficitDays > 0) return -deficitDays;
  if (production < consumption) {
    // Currently in deficit, backend hasn't ticked the counter yet
    return -1;
  }
  // Surplus case: derive "days of runway if consumption doubled" as a
  // proxy for cushion. Cap at 10 so the bar doesn't feel static.
  const surplus = production - consumption;
  if (consumption <= 0) return 10;
  const runway = surplus / consumption * 10;
  return Math.max(0.1, Math.min(10, runway));
}

export function extractBalance(
  resources: Record<string, unknown>,
  prefix: 'food' | 'water',
): ResourceBalance | null {
  const rawObj = resources[`${prefix}_balance`];

  // Object shape: { production, consumption, surplus_days | deficit_days }
  if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj)) {
    const obj = rawObj as Record<string, unknown>;
    if (
      typeof obj.production === 'number' &&
      typeof obj.consumption === 'number'
    ) {
      const surplusExplicit =
        typeof obj.surplus_days === 'number' ? obj.surplus_days : null;
      const deficitExplicit =
        typeof obj.deficit_days === 'number' ? obj.deficit_days : null;
      const days =
        surplusExplicit != null
          ? surplusExplicit
          : computeSurplusDays(obj.production, obj.consumption, deficitExplicit);
      return {
        production: obj.production,
        consumption: obj.consumption,
        surplus_days: days,
      };
    }
  }

  // Flat shape
  const prod = resources[`${prefix}_production`];
  const cons = resources[`${prefix}_consumption`];
  const surplusDays = resources[`${prefix}_surplus_days`];
  const deficitDays = resources[`${prefix}_deficit_days`];

  if (typeof prod === 'number' && typeof cons === 'number') {
    const days =
      typeof surplusDays === 'number'
        ? surplusDays
        : computeSurplusDays(
            prod,
            cons,
            typeof deficitDays === 'number' ? deficitDays : null,
          );
    return { production: prod, consumption: cons, surplus_days: days };
  }
  return null;
}

export interface Pressure {
  food: ResourceBalance | null;
  water: ResourceBalance | null;
}

export function readPressure(world: World): Pressure {
  const r = world.resources as unknown as Record<string, unknown>;
  return {
    food: extractBalance(r, 'food'),
    water: extractBalance(r, 'water'),
  };
}

// Zone-risk coverage (unchanged v4.0)
export function computeProtectedTiles(
  infra: Record<string, unknown>,
  coverRadius: number,
  gridW: number,
  gridH: number,
): Set<string> {
  const out = new Set<string>();
  if (!infra) return out;
  const coverKeys = Object.keys(infra).filter((k) =>
    /palisade|shelter|watch|outpost|storm/i.test(k),
  );
  if (coverKeys.length === 0) return out;

  const anchors: Array<[number, number]> = [];
  for (const key of coverKeys) {
    if (/palisade|storm_shelter/i.test(key) && !/nw|ember|e_coast|w_coast/i.test(key))
      anchors.push([gridW * 0.45, gridH * 0.85]);
    if (/storm_shelter_nw/i.test(key)) anchors.push([gridW * 0.28, gridH * 0.28]);
    if (/storm_shelter_ember/i.test(key)) anchors.push([18, 12]);
    if (/storm_shelter_e_coast/i.test(key)) anchors.push([24, 13]);
    if (/w_coast|storm_shelter_w/i.test(key)) anchors.push([4, 14]);
    if (/n_watch|watch_post/i.test(key)) anchors.push([20, 6]);
    if (/outpost/i.test(key)) anchors.push([gridW * 0.42, gridH * 0.78]);
    if (/e_coast_hub|e_hub/i.test(key)) anchors.push([24, 13]);
  }

  for (const [ax, ay] of anchors) {
    const minX = Math.max(0, Math.floor(ax - coverRadius));
    const maxX = Math.min(gridW - 1, Math.ceil(ax + coverRadius));
    const minY = Math.max(0, Math.floor(ay - coverRadius));
    const maxY = Math.min(gridH - 1, Math.ceil(ay + coverRadius));
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const dx = tx - ax;
        const dy = ty - ay;
        if (dx * dx + dy * dy <= coverRadius * coverRadius) {
          out.add(`${tx},${ty}`);
        }
      }
    }
  }
  return out;
}
