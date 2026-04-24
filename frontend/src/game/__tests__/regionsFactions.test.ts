import { describe, it, expect } from 'vitest';
import { validateRegion, RegionRegistry } from '../world/regions';
import { region_founding_shore } from '../../content/locations/region_founding_shore';
import { region_the_deepening } from '../../content/locations/region_the_deepening';
import { region_template_founding_shore } from '../../content/locations/_template';
import { validateFaction, FactionRegistry } from '../world/factions';
import { faction_architects } from '../../content/factions/faction_architects';
import { faction_council_of_the_source } from '../../content/factions/faction_council_of_the_source';
import { faction_opportunists } from '../../content/factions/faction_opportunists';
import { faction_template_founders } from '../../content/factions/_template';

describe('Region validator + registry', () => {
  it('accepts canonical regions', () => {
    expect(validateRegion(region_founding_shore).ok).toBe(true);
    expect(validateRegion(region_the_deepening).ok).toBe(true);
    expect(validateRegion(region_template_founding_shore).ok).toBe(true);
  });

  it('rejects id without region_ prefix', () => {
    const bad = { ...region_founding_shore, id: 'founding_shore' };
    expect(validateRegion(bad).ok).toBe(false);
  });

  it('rejects max < min bounds', () => {
    const bad = {
      ...region_founding_shore,
      tile_bounds: { min: { x: 20, y: 10 }, max: { x: 14, y: 18 } },
    };
    const r = validateRegion(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('tile_bounds');
  });

  it('containing() resolves a tile inside bounds', () => {
    const reg = new RegionRegistry();
    reg.registerMany([region_founding_shore, region_the_deepening]);
    // Tiles unambiguously only in Founding Shore (y > 14, east/south edge)
    expect(reg.containing({ x: 25, y: 16 })?.id).toBe('region_founding_shore');
    // Tiles unambiguously only in The Deepening (x < 14, y < 10 corner)
    expect(reg.containing({ x: 13, y: 9 })?.id).toBe('region_the_deepening');
    // Outside every region
    expect(reg.containing({ x: 0, y: 0 })).toBeUndefined();
  });

  it('rejects duplicate gathering spot ids within a region', () => {
    const bad = {
      ...region_founding_shore,
      gathering_spots: [
        { id: 'gather_dupe', name: 'A', tile: { x: 1, y: 1 }, respawn_cycles: 3 },
        { id: 'gather_dupe', name: 'B', tile: { x: 2, y: 2 }, respawn_cycles: 3 },
      ],
    };
    const r = validateRegion(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('duplicate gathering spot');
  });

  it('neighbor references must be region_ prefixed', () => {
    const bad = {
      ...region_founding_shore,
      neighbors: ['not_a_region'],
    };
    const r = validateRegion(bad);
    expect(r.ok).toBe(false);
  });
});

describe('Faction validator + registry', () => {
  it('accepts all canonical + template factions', () => {
    expect(validateFaction(faction_architects).ok).toBe(true);
    expect(validateFaction(faction_council_of_the_source).ok).toBe(true);
    expect(validateFaction(faction_opportunists).ok).toBe(true);
    expect(validateFaction(faction_template_founders).ok).toBe(true);
  });

  it('rejects id without faction_ prefix', () => {
    const bad = { ...faction_architects, id: 'architects' };
    expect(validateFaction(bad).ok).toBe(false);
  });

  it('ally / enemy cross-references must be faction_ prefixed', () => {
    const bad = { ...faction_architects, enemies: ['not_a_faction'] };
    expect(validateFaction(bad).ok).toBe(false);
  });

  it('registry lookup works', () => {
    const reg = new FactionRegistry();
    reg.registerMany([faction_architects, faction_council_of_the_source, faction_opportunists]);
    expect(reg.get('faction_architects')?.name).toBe('The Architects');
    expect(reg.size()).toBe(3);
  });
});
