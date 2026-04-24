// Unit tests for the pure helpers that back the boot-time rehydration
// effect in EngineProvider. The component-level effect itself wires
// into useEffect + fetch; these tests cover the logic-island bits
// (freshness comparison + snapshot->state transform) without requiring
// a DOM + jsdom fetch stub.

import { describe, it, expect } from 'vitest';
import { isNewerSave, snapshotToEngineState } from '../engine/EngineContext';
import { buildSave } from '../save/saveGame';
import { newWorldState } from '../world/worldState';
import { emptyInventory } from '../items/inventory';
import { emptyEquipment } from '../items/equipment';

function makeSave(savedAtIso: string) {
  const worldBase = newWorldState();
  const save = buildSave({
    player: {
      id: 'player_test',
      location: { x: 5, y: 5 },
      region_id: 'region_founding_shore',
      capabilities: {},
    },
    world: worldBase,
    inventories: [emptyInventory('player_test', 28)],
    equipment: [emptyEquipment('player_test')],
    npc_runtime: [],
    quest_runtime: [],
    shop_states: [],
  });
  return { ...save, saved_at_iso: savedAtIso };
}

describe('isNewerSave', () => {
  it('returns true when candidate is strictly newer', () => {
    expect(isNewerSave('2026-04-24T12:00:00Z', '2026-04-24T10:00:00Z')).toBe(true);
  });

  it('returns false when candidate equals current', () => {
    const iso = '2026-04-24T12:00:00Z';
    expect(isNewerSave(iso, iso)).toBe(false);
  });

  it('returns false when candidate is older', () => {
    expect(isNewerSave('2026-04-23T00:00:00Z', '2026-04-24T00:00:00Z')).toBe(false);
  });

  it('returns false when candidate is missing', () => {
    expect(isNewerSave(undefined, '2026-04-24T00:00:00Z')).toBe(false);
    expect(isNewerSave(null, '2026-04-24T00:00:00Z')).toBe(false);
    expect(isNewerSave('', '2026-04-24T00:00:00Z')).toBe(false);
  });

  it('returns true when current is missing and candidate is valid', () => {
    expect(isNewerSave('2026-04-24T00:00:00Z', undefined)).toBe(true);
    expect(isNewerSave('2026-04-24T00:00:00Z', '')).toBe(true);
  });

  it('returns false for unparseable candidate ISO strings', () => {
    expect(isNewerSave('garbage', '2026-04-24T00:00:00Z')).toBe(false);
  });
});

describe('snapshotToEngineState', () => {
  it('transfers player + world from the save', () => {
    const save = makeSave('2026-04-24T12:00:00Z');
    const state = snapshotToEngineState(save);
    expect(state.player.id).toBe('player_test');
    expect(state.player.location).toEqual({ x: 5, y: 5 });
    expect(state.world.cycle).toBe(0);
  });

  it('uses the first inventory / equipment from the save arrays', () => {
    const save = makeSave('2026-04-24T12:00:00Z');
    const state = snapshotToEngineState(save);
    expect(state.inventory.owner_id).toBe('player_test');
    expect(state.equipment.owner_id).toBe('player_test');
  });

  it('defaults empty inventory / equipment if arrays are absent', () => {
    const save = makeSave('2026-04-24T12:00:00Z');
    // Wipe the arrays to simulate an oddly-shaped backend snapshot
    const thinned = { ...save, inventories: [], equipment: [] };
    const state = snapshotToEngineState(thinned);
    expect(state.inventory.stacks).toEqual([]);
    expect(Object.keys(state.equipment.slots)).toEqual([]);
  });

  it('defaults empty shop_states and discovery_states when absent', () => {
    const save = makeSave('2026-04-24T12:00:00Z');
    const withoutOptional = { ...save, shop_states: undefined, discovery_states: undefined };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = snapshotToEngineState(withoutOptional as any);
    expect(state.shopStates).toEqual([]);
    expect(state.discoveryStates).toEqual([]);
  });

  it('preserves questRuntime + npcRuntime arrays', () => {
    const save = makeSave('2026-04-24T12:00:00Z');
    const withRuntime = {
      ...save,
      quest_runtime: [
        {
          quest_id: 'quest_test',
          player_id: 'player_test',
          status: 'active' as const,
          objectives: [],
          choices_taken: [],
        },
      ],
      npc_runtime: [
        {
          npc_id: 'npc_test',
          movement_mode: 'idle' as const,
          path: [],
          dialogue_state: 'neutral' as const,
          memory_flags: ['met_player'],
          relationship_with_player: 0.2,
          alive: true,
          schedule_phase: 0,
        },
      ],
    };
    const state = snapshotToEngineState(withRuntime);
    expect(state.questRuntime).toHaveLength(1);
    expect(state.npcRuntime[0].memory_flags).toContain('met_player');
  });
});
