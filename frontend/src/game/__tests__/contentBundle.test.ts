// Regression test: loadContentBundle() must auto-discover every content
// file in /src/content/{npcs,items,quests,drops}/ via import.meta.glob.
// Before commit 478822d's auto-discovery test existed, a hardcoded-imports
// version of this bundle would silently ship only the content listed in
// its own imports, leaving new Quad B content invisible at runtime.

import { describe, it, expect } from 'vitest';
import { loadContentBundle } from '../engine/contentBundle';

describe('loadContentBundle auto-discovery', () => {
  const bundle = loadContentBundle();

  it('registers at least one NPC, item, quest, and drop table', () => {
    expect(bundle.stats.npcs).toBeGreaterThan(0);
    expect(bundle.stats.items).toBeGreaterThan(0);
    expect(bundle.stats.quests).toBeGreaterThan(0);
    expect(bundle.stats.drops).toBeGreaterThan(0);
  });

  it('picks up non-template files automatically', () => {
    // These are the two NPC files Quad B has authored so far.
    // Future-proof: assert both are present without naming them
    // one-by-one beyond this sanity check.
    expect(bundle.npcs.has('npc_wyn_inland_marker')).toBe(true);
    expect(bundle.npcs.has('npc_iwen_healer')).toBe(true);
  });

  it('picks up authored items and quests', () => {
    expect(bundle.items.has('item_ember_flask')).toBe(true);
    expect(bundle.quests.has('quest_tending_the_ember_spring')).toBe(true);
    expect(bundle.quests.has('quest_the_medicinal_sweep')).toBe(true);
  });

  it('includes template content too', () => {
    expect(bundle.npcs.has('npc_template_giver')).toBe(true);
    expect(bundle.items.has('item_template_flint')).toBe(true);
  });

  it('registered drop tables are inspectable by id', () => {
    const ids = bundle.drops.map((d) => d.id);
    expect(ids).toContain('drop_wren_meadow_foraging');
    expect(ids).toContain('drop_the_deepening_foraging');
  });

  it('boot errors array exists (may contain cross-ref warnings, that is expected)', () => {
    expect(Array.isArray(bundle.errors)).toBe(true);
    // Any shape-level errors would be a real failure; cross-ref warnings are
    // expected because authored drops / quests may reference items, regions,
    // or factions not yet shipped.
    const shapeErrors = bundle.errors.filter(
      (e) => !e.includes('loaded with warnings') && !e.includes('(warning)'),
    );
    expect(shapeErrors).toEqual([]);
  });

  it('picks up registered regions and factions', () => {
    expect(bundle.stats.regions).toBeGreaterThan(0);
    expect(bundle.stats.factions).toBeGreaterThan(0);
    expect(bundle.regions.has('region_founding_shore')).toBe(true);
    expect(bundle.regions.has('region_the_deepening')).toBe(true);
    expect(bundle.factions.has('faction_architects')).toBe(true);
    expect(bundle.factions.has('faction_council_of_the_source')).toBe(true);
    expect(bundle.factions.has('faction_opportunists')).toBe(true);
  });
});
