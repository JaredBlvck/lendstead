import { describe, it, expect } from 'vitest';
import { validateNpc, validateNpcs } from '../npcs/npcValidator';
import { NpcRegistry } from '../npcs/npcRegistry';
import { npc_template_giver } from '../../content/npcs/_template';

describe('npcValidator', () => {
  it('accepts the template npc', () => {
    const r = validateNpc(npc_template_giver);
    expect(r.ok).toBe(true);
  });

  it('rejects id without npc_ prefix', () => {
    const bad = { ...npc_template_giver, id: 'iolo' };
    const r = validateNpc(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate schedule phases', () => {
    const bad = {
      ...npc_template_giver,
      schedule: [
        { phase: 'dawn' as const, location_id: 'poi_a', activity: 'wake', duration_phases: 1 },
        { phase: 'dawn' as const, location_id: 'poi_b', activity: 'forage', duration_phases: 1 },
      ],
    };
    const r = validateNpc(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('multiple schedule entries');
  });

  it('rejects duplicate dialogue line ids', () => {
    const bad = {
      ...npc_template_giver,
      dialogue_lines: [
        { id: 'line_dupe', state: 'neutral' as const, text: 'A', weight: 1 },
        { id: 'line_dupe', state: 'neutral' as const, text: 'B', weight: 1 },
      ],
    };
    const r = validateNpc(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('duplicate dialogue line id');
  });

  it('rejects shop entry that sells with zero stock', () => {
    const bad = {
      ...npc_template_giver,
      shop_inventory: [
        { item_id: 'item_template_flint', stock_qty: 0, sell_price: 3 },
      ],
    };
    const r = validateNpc(bad);
    expect(r.ok).toBe(false);
  });

  it('bulk validator catches duplicate npc ids', () => {
    const r = validateNpcs([npc_template_giver, npc_template_giver]);
    expect(r.ok).toBe(false);
    expect(r.invalid.some((e) => e.errors.join(' ').includes('duplicate npc id'))).toBe(true);
  });
});

describe('NpcRegistry', () => {
  it('registers and looks up npcs', () => {
    const reg = new NpcRegistry();
    reg.register(npc_template_giver);
    expect(reg.get('npc_template_giver')?.name).toBe('Iolo Reedwake');
    expect(reg.size()).toBe(1);
  });

  it('throws on duplicate register', () => {
    const reg = new NpcRegistry();
    reg.register(npc_template_giver);
    expect(() => reg.register(npc_template_giver)).toThrow();
  });

  it('filters by region, faction, and quest hook', () => {
    const reg = new NpcRegistry();
    reg.register(npc_template_giver);
    expect(reg.byRegion('region_founding_shore')).toHaveLength(1);
    expect(reg.byFaction('faction_founders')).toHaveLength(1);
    expect(reg.givingQuest('quest_template_do_not_ship')).toHaveLength(1);
    expect(reg.byRegion('region_hollowmere_ruins')).toHaveLength(0);
  });
});
