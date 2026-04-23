// Resource pressure + zone risk helpers.
//
// Backend ships: food_production, food_consumption, food_balance (flat
// number = prod - cons), food_deficit_days (counter, ticks when
// balance < 0; Jr's naming, not "surplus_days"). Same for water.
// Helpers normalize to a unified ResourceBalance so the UI renders
// off one shape regardless of which keys the backend prefers.

import type { World, ResourceBalance } from '../types';

export function extractBalance(
  resources: Record<string, unknown>,
  prefix: 'food' | 'water',
): ResourceBalance | null {
  // Object-shape preferred: { production, consumption, surplus_days | deficit_days }
  const rawObj = resources[`${prefix}_balance`];
  if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj)) {
    const obj = rawObj as Record<string, unknown>;
    if (
      typeof obj.production === 'number' &&
      typeof obj.consumption === 'number'
    ) {
      const days =
        typeof obj.surplus_days === 'number'
          ? obj.surplus_days
          : typeof obj.deficit_days === 'number'
            ? -obj.deficit_days
            : 0;
      return {
        production: obj.production,
        consumption: obj.consumption,
        surplus_days: days,
      };
    }
  }

  // Flat-shape: separate keys. Accept either surplus_days or deficit_days.
  const prod = resources[`${prefix}_production`];
  const cons = resources[`${prefix}_consumption`];
  const balanceFlat = resources[`${prefix}_balance`]; // flat number when not object
  const surplusDays = resources[`${prefix}_surplus_days`];
  const deficitDays = resources[`${prefix}_deficit_days`];

  if (typeof prod === 'number' && typeof cons === 'number') {
    let days: number;
    if (typeof surplusDays === 'number') days = surplusDays;
    else if (typeof deficitDays === 'number') days = -deficitDays;
    else if (typeof balanceFlat === 'number') {
      // Fallback: approximate surplus days from balance magnitude
      days = balanceFlat >= 0 ? 10 : -10;
    } else {
      days = 0;
    }
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

// Zone-risk coverage: a tile is PROTECTED if it's within `coverRadius`
// of any infrastructure key matching palisade / shelter / watch_post /
// outpost. Returns a Set<"x,y"> for fast lookup in the renderer.
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
