import { describe, it, expect } from 'vitest';
import { buildSave, serializeSave } from '../save/saveGame';
import { deserializeSave, loadSave } from '../save/loadGame';
import { newWorldState, setFlag, unlockRegion, adjustFactionReputation } from '../world/worldState';
import { emptyInventory, addItem } from '../items/inventory';
import { ItemRegistry } from '../items/itemRegistry';
import {
  item_template_flint,
  item_template_knife,
  item_template_silver_coin,
} from '../../content/items/_template';

function registry() {
  const reg = new ItemRegistry();
  reg.registerMany([item_template_flint, item_template_knife, item_template_silver_coin]);
  return reg;
}

function snapshot() {
  const reg = registry();
  let world = newWorldState();
  world = setFlag(world, 'tutorial_done');
  world = unlockRegion(world, 'region_reedwake_marsh');
  world = adjustFactionReputation(world, 'faction_founders', 0.3);

  let inv = emptyInventory('player_1', 28);
  inv = addItem(inv, 'item_template_flint', 50, reg.lookup).inventory;
  inv = addItem(inv, 'item_template_reedwake_knife', 1, reg.lookup).inventory;

  return {
    player: {
      id: 'player_1',
      location: { x: 10, y: 10 },
      region_id: 'region_founding_shore',
      capabilities: { canSwim: false, canClimbCliffs: false, maxSlope: 0.5 },
    },
    world,
    inventories: [inv],
    equipment: [],
    npc_runtime: [],
    quest_runtime: [],
  };
}

describe('save / load', () => {
  it('build -> serialize -> deserialize round-trip preserves state', () => {
    const save = buildSave(snapshot());
    const json = serializeSave(save);
    const loaded = deserializeSave(json);
    expect(loaded.ok).toBe(true);
    expect(loaded.save?.world.world_flags.tutorial_done).toBe(true);
    expect(loaded.save?.world.unlocked_region_ids).toContain('region_reedwake_marsh');
    expect(loaded.save?.world.faction_reputation[0].score).toBeCloseTo(0.3, 5);
    expect(loaded.save?.inventories[0].stacks.length).toBeGreaterThan(0);
    expect(loaded.save?.player.location).toEqual({ x: 10, y: 10 });
  });

  it('build -> JSON -> text edit -> reload still parses', () => {
    const save = buildSave(snapshot());
    const json = serializeSave(save);
    // Round-trip through parse
    const copy = JSON.parse(json);
    const result = loadSave(copy);
    expect(result.ok).toBe(true);
  });

  it('rejects object that is not a save', () => {
    const result = loadSave({ foo: 'bar' });
    expect(result.ok).toBe(false);
  });

  it('rejects future version saves', () => {
    const save = buildSave(snapshot());
    const future = { ...save, schema_version: 999 };
    const result = loadSave(future);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('newer version');
  });

  it('rejects missing schema_version', () => {
    const result = loadSave({ player: { id: 'x', location: { x: 0, y: 0 } } });
    expect(result.ok).toBe(false);
  });

  it('rejects malformed JSON', () => {
    const result = deserializeSave('{not json');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('JSON');
  });
});
