import { describe, it, expect } from 'vitest';
import {
  validateDiscoverySite,
  validateDiscoverySites,
} from '../archaeology/carvingValidator';
import {
  DiscoveryRegistry,
  inspectSite,
  isConditionMet,
} from '../archaeology/discoveryRuntime';
import { site_template_marker_stone } from '../../content/locations/_template_discovery';
import type { DiscoverySite } from '../archaeology/carvingTypes';
import { newWorldState, setFlag, markQuestCompleted } from '../world/worldState';

describe('discovery validator', () => {
  it('accepts the template site', () => {
    const r = validateDiscoverySite(site_template_marker_stone);
    expect(r.ok).toBe(true);
  });

  it('rejects id without site_ prefix', () => {
    const bad = { ...site_template_marker_stone, id: 'marker_stone' };
    expect(validateDiscoverySite(bad).ok).toBe(false);
  });

  it('rejects tile outside grid bounds', () => {
    const bad = { ...site_template_marker_stone, tile: { x: 9999, y: 0 } };
    const r = validateDiscoverySite(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('grid bounds');
  });

  it('rejects non-region region_id reference', () => {
    const bad = { ...site_template_marker_stone, region_id: 'deepening' };
    expect(validateDiscoverySite(bad).ok).toBe(false);
  });

  it('bulk validator catches duplicate ids', () => {
    const r = validateDiscoverySites([site_template_marker_stone, site_template_marker_stone]);
    expect(r.ok).toBe(false);
    expect(r.invalid.some((e) => e.errors.join(' ').includes('duplicate site id'))).toBe(true);
  });
});

describe('DiscoveryRegistry', () => {
  it('register + lookup + byRegion', () => {
    const reg = new DiscoveryRegistry();
    reg.register(site_template_marker_stone);
    expect(reg.get('site_template_marker_stone')).toBeDefined();
    expect(reg.byRegion('region_the_deepening')).toHaveLength(1);
    expect(reg.byRegion('region_founding_shore')).toHaveLength(0);
    expect(reg.size()).toBe(1);
  });

  it('throws on duplicate register', () => {
    const reg = new DiscoveryRegistry();
    reg.register(site_template_marker_stone);
    expect(() => reg.register(site_template_marker_stone)).toThrow();
  });
});

describe('isConditionMet', () => {
  const w = newWorldState();

  it('always condition passes', () => {
    expect(isConditionMet({ kind: 'always', params: {} }, w)).toBe(true);
  });

  it('world_flag condition respects flag value', () => {
    expect(
      isConditionMet({ kind: 'world_flag', params: { key: 'test_flag', value: true } }, w),
    ).toBe(false);
    const w2 = setFlag(w, 'test_flag', true);
    expect(
      isConditionMet({ kind: 'world_flag', params: { key: 'test_flag', value: true } }, w2),
    ).toBe(true);
  });

  it('completed_quest reads world.completed_quest_ids', () => {
    expect(
      isConditionMet({ kind: 'completed_quest', params: { quest_id: 'quest_x' } }, w),
    ).toBe(false);
    const w2 = markQuestCompleted(w, 'quest_x');
    expect(
      isConditionMet({ kind: 'completed_quest', params: { quest_id: 'quest_x' } }, w2),
    ).toBe(true);
  });

  it('settlement_level threshold', () => {
    const w2 = { ...w, settlement_level: 'fortified_village' as const };
    expect(
      isConditionMet({ kind: 'settlement_level', params: { level: 'first_village' } }, w2),
    ).toBe(true);
    expect(
      isConditionMet({ kind: 'settlement_level', params: { level: 'lendstead_seat' } }, w2),
    ).toBe(false);
  });
});

describe('inspectSite', () => {
  const w = newWorldState();
  const site: DiscoverySite = site_template_marker_stone;

  it('returns reveal when RNG is below reveal_chance', () => {
    // reveal_chance 0.75; random returns 0 -> always reveals
    const out = inspectSite(site, undefined, w, () => 0);
    expect(out.ok).toBe(true);
    expect(out.revealed).toBe(true);
    expect(out.fragment_item_id).toBe('item_template_flint');
    expect(out.next_state.revealed).toBe(true);
    expect(out.next_state.inspections).toBe(1);
  });

  it('returns not-revealed when RNG is above reveal_chance', () => {
    const out = inspectSite(site, undefined, w, () => 0.99);
    expect(out.ok).toBe(true);
    expect(out.revealed).toBe(false);
    expect(out.fragment_item_id).toBeUndefined();
    expect(out.next_state.revealed).toBe(false);
    expect(out.next_state.inspections).toBe(1);
  });

  it('already-revealed one-shot returns lore only, no fragment', () => {
    const alreadyRevealedState = {
      site_id: site.id,
      revealed: true,
      inspections: 1,
      revealed_at_cycle: 0,
    };
    const out = inspectSite(site, alreadyRevealedState, w);
    expect(out.ok).toBe(true);
    expect(out.revealed).toBe(false);
    expect(out.already_revealed).toBe(true);
    expect(out.lore_text).toBe(site.lore_text);
    expect(out.fragment_item_id).toBeUndefined();
  });

  it('refuses when reveal_condition fails', () => {
    const gated: DiscoverySite = {
      ...site,
      id: 'site_gated_example',
      reveal_condition: { kind: 'world_flag', params: { key: 'cannot_be_true' } },
    };
    const out = inspectSite(gated, undefined, w, () => 0);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('conditions');
    expect(out.revealed).toBe(false);
    expect(out.next_state.revealed).toBe(false);
    expect(out.next_state.inspections).toBe(1);
  });

  it('increments inspections on every call whether revealed or not', () => {
    let state: ReturnType<typeof inspectSite>['next_state'] = {
      site_id: site.id,
      revealed: false,
      inspections: 0,
    };
    const outMiss = inspectSite(site, state, w, () => 0.99);
    state = outMiss.next_state;
    expect(state.inspections).toBe(1);
    const outHit = inspectSite(site, state, w, () => 0);
    state = outHit.next_state;
    expect(state.inspections).toBe(2);
    expect(state.revealed).toBe(true);
  });
});
