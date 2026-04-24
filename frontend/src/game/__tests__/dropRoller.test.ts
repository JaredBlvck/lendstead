import { describe, it, expect } from 'vitest';
import { rollDropTable, simulateDrops, seededRandom } from '../drops/dropRoller';
import { validateDropTable, validateDropTables } from '../drops/dropValidator';
import { drop_template_boar } from '../../content/drops/_template';
import { ItemRegistry } from '../items/itemRegistry';
import {
  item_template_flint,
  item_template_knife,
  item_template_silver_coin,
} from '../../content/items/_template';
import type { DropTable } from '../drops/dropTypes';

function itemRegistry() {
  const reg = new ItemRegistry();
  reg.registerMany([item_template_flint, item_template_knife, item_template_silver_coin]);
  return reg;
}

describe('dropRoller', () => {
  it('template table validates against shape and item registry', () => {
    const r = validateDropTable(drop_template_boar, itemRegistry());
    expect(r.ok).toBe(true);
  });

  it('guaranteed drops fire every roll', () => {
    const random = seededRandom(1);
    const drops = rollDropTable(drop_template_boar, { random });
    expect(drops.some((d) => d.pool === 'guaranteed' && d.item_id === 'item_template_flint')).toBe(true);
  });

  it('common pool weighted to flint shows majority flint in simulation', () => {
    const sim = simulateDrops(drop_template_boar, 2000, { random: seededRandom(42) });
    const flintFromCommon = sim.totals.item_template_flint ?? 0;
    const coinFromCommon = sim.totals.item_template_silver_coin ?? 0;
    // Flint weight 70 vs silver 30 in the common pool; flint should dominate even counting guaranteed hits
    expect(flintFromCommon).toBeGreaterThan(coinFromCommon);
  });

  it('rolls stay within min/max qty for every entry', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 500; i++) {
      const drops = rollDropTable(drop_template_boar, { random });
      for (const d of drops) {
        expect(d.qty).toBeGreaterThanOrEqual(1);
        if (d.pool === 'common' && d.item_id === 'item_template_flint') {
          expect(d.qty).toBeLessThanOrEqual(5);
          expect(d.qty).toBeGreaterThanOrEqual(2);
        }
        if (d.pool === 'uncommon' && d.item_id === 'item_template_silver_coin') {
          expect(d.qty).toBeLessThanOrEqual(40);
          expect(d.qty).toBeGreaterThanOrEqual(20);
        }
      }
    }
  });

  it('modifier matching boosts rare chance visibly in simulation', () => {
    const cold = simulateDrops(drop_template_boar, 5000, { random: seededRandom(99) });
    const hot = simulateDrops(drop_template_boar, 5000, {
      random: seededRandom(99),
      activeConditions: ['quest_complete:quest_template_do_not_ship'],
    });
    expect(hot.perPool.rare + hot.perPool.ultra_rare)
      .toBeGreaterThanOrEqual(cold.perPool.rare + cold.perPool.ultra_rare);
  });

  it('luck multiplier raises rare + ultra_rare hit counts', () => {
    const normal = simulateDrops(drop_template_boar, 5000, { random: seededRandom(123), luck: 1 });
    const lucky = simulateDrops(drop_template_boar, 5000, { random: seededRandom(123), luck: 5 });
    expect(lucky.perPool.rare + lucky.perPool.ultra_rare)
      .toBeGreaterThan(normal.perPool.rare + normal.perPool.ultra_rare);
  });

  it('validator catches unknown item_id when registry is provided', () => {
    const bad: DropTable = {
      ...drop_template_boar,
      id: 'drop_template_bad',
      common_drops: [{ item_id: 'item_nonexistent', min_qty: 1, max_qty: 1, weight: 1 }],
    };
    const r = validateDropTable(bad, itemRegistry());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('unknown item');
  });

  it('validator rejects max_qty < min_qty', () => {
    const bad = {
      ...drop_template_boar,
      id: 'drop_template_badqty',
      common_drops: [{ item_id: 'item_template_flint', min_qty: 5, max_qty: 2, weight: 1 }],
    };
    const r = validateDropTable(bad, itemRegistry());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('max_qty < min_qty');
  });

  it('validator rejects ultra_rare chance outside (0, 1]', () => {
    const bad = {
      ...drop_template_boar,
      id: 'drop_template_badchance',
      ultra_rare_drops: [{ item_id: 'item_template_flint', chance: 0, min_qty: 1, max_qty: 1 }],
    };
    const r = validateDropTable(bad, itemRegistry());
    expect(r.ok).toBe(false);
  });

  it('bulk validator surfaces duplicate ids', () => {
    const r = validateDropTables([drop_template_boar, drop_template_boar], itemRegistry());
    expect(r.ok).toBe(false);
    expect(r.invalid.some((e) => e.errors.join(' ').includes('duplicate drop table id'))).toBe(true);
  });
});
