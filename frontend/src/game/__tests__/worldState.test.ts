import { describe, it, expect } from 'vitest';
import {
  newWorldState,
  advanceCycle,
  unlockRegion,
  discoverRegion,
  markQuestCompleted,
  setFlag,
  setInfrastructure,
  adjustFactionReputation,
  getFactionReputation,
  recordWorldEvent,
  endWorldEvent,
  upgradeSettlement,
  recordNpcDeath,
  type WorldEvent,
} from '../world/worldState';
import {
  DEFAULT_SETTLEMENT_RULES,
  canAdvanceTo,
  maxAchievableSettlement,
} from '../world/settlements';
import {
  applyEventEffect,
  spawnWorldEvent,
  tickWorldEvents,
  type WorldEventTemplate,
} from '../world/worldEvents';
import { addResourceNode, depleteNode, tickResourceNodes, availableNodesIn } from '../world/resources';

describe('worldState', () => {
  it('advanceCycle rotates through phases and bumps cycle at dawn rollover', () => {
    let w = newWorldState();
    expect(w.phase).toBe('morning');
    expect(w.cycle).toBe(0);
    w = advanceCycle(w);
    expect(w.phase).toBe('midday');
    w = advanceCycle(w);
    expect(w.phase).toBe('evening');
    w = advanceCycle(w);
    expect(w.phase).toBe('night');
    w = advanceCycle(w);
    expect(w.phase).toBe('dawn');
    expect(w.cycle).toBe(1);
    w = advanceCycle(w);
    expect(w.phase).toBe('morning');
  });

  it('unlockRegion and discoverRegion dedupe', () => {
    let w = newWorldState();
    w = unlockRegion(w, 'region_reedwake_marsh');
    w = unlockRegion(w, 'region_reedwake_marsh');
    expect(w.unlocked_region_ids.filter((r) => r === 'region_reedwake_marsh')).toHaveLength(1);
    w = discoverRegion(w, 'region_reedwake_marsh');
    expect(w.discovered_region_ids).toContain('region_reedwake_marsh');
  });

  it('adjustFactionReputation clamps to [-1, 1] and updates tier', () => {
    let w = newWorldState();
    w = adjustFactionReputation(w, 'faction_founders', 0.8);
    expect(getFactionReputation(w, 'faction_founders')?.tier).toBe('revered');
    w = adjustFactionReputation(w, 'faction_founders', 10);
    expect(getFactionReputation(w, 'faction_founders')?.score).toBe(1);
    w = adjustFactionReputation(w, 'faction_founders', -3);
    expect(getFactionReputation(w, 'faction_founders')?.score).toBe(-1);
    expect(getFactionReputation(w, 'faction_founders')?.tier).toBe('hated');
  });

  it('upgradeSettlement refuses downgrade', () => {
    let w = newWorldState();
    w = upgradeSettlement(w, 'first_village');
    expect(w.settlement_level).toBe('first_village');
    w = upgradeSettlement(w, 'working_camp');
    expect(w.settlement_level).toBe('first_village');
  });

  it('recordWorldEvent then endWorldEvent moves it to history', () => {
    let w = newWorldState();
    const event: WorldEvent = {
      id: 'event_test',
      kind: 'storm',
      started_at_cycle: 0,
      severity: 'minor',
      payload: {},
    };
    w = recordWorldEvent(w, event);
    expect(w.active_world_events).toHaveLength(1);
    w = endWorldEvent(w, 'event_test');
    expect(w.active_world_events).toHaveLength(0);
    expect(w.historical_world_events).toHaveLength(1);
  });

  it('setFlag, setInfrastructure, recordNpcDeath persist simple bits', () => {
    let w = newWorldState();
    w = setFlag(w, 'black_tide_defeated');
    expect(w.world_flags.black_tide_defeated).toBe(true);
    w = setInfrastructure(w, 'palisade_built');
    expect(w.infrastructure.palisade_built).toBe(true);
    w = recordNpcDeath(w, 'npc_elder');
    expect(w.npc_deaths).toContain('npc_elder');
  });

  it('markQuestCompleted dedupes', () => {
    let w = newWorldState();
    w = markQuestCompleted(w, 'quest_a');
    w = markQuestCompleted(w, 'quest_a');
    expect(w.completed_quest_ids).toEqual(['quest_a']);
  });
});

describe('settlements', () => {
  it('canAdvanceTo reports missing requirements', () => {
    const w = newWorldState();
    const rule = DEFAULT_SETTLEMENT_RULES[1];
    const result = canAdvanceTo(w, rule);
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.includes('population'))).toBe(true);
  });

  it('maxAchievableSettlement walks forward through the rules', () => {
    let w = newWorldState();
    w = { ...w, population: 5, food: 25 };
    w = setInfrastructure(w, 'campfire_built');
    expect(maxAchievableSettlement(w)).toBe('working_camp');
    w = { ...w, population: 10, food: 70, water: 50 };
    w = setInfrastructure(w, 'shelter_cluster_built');
    expect(maxAchievableSettlement(w)).toBe('first_village');
  });
});

describe('world events', () => {
  const template: WorldEventTemplate = {
    id: 'evt_storm',
    schema_version: 1,
    kind: 'storm',
    name: 'Salt Storm',
    description: 'A squall off the saltglass coast.',
    severity: 'major',
    trigger: { kind: 'cycle_interval', params: { every: 30 } },
    effects: [
      { kind: 'morale_delta', params: { delta: -0.1 } },
      { kind: 'food_delta', params: { delta: -5 } },
    ],
    duration_cycles: 2,
    tags: ['weather'],
  };

  it('applyEventEffect clamps morale and deducts food', () => {
    let w = newWorldState();
    w = { ...w, food: 20, morale: 0.5 };
    w = applyEventEffect(w, { kind: 'food_delta', params: { delta: -5 } });
    expect(w.food).toBe(15);
    w = applyEventEffect(w, { kind: 'morale_delta', params: { delta: -0.6 } });
    expect(w.morale).toBeCloseTo(0, 5);
    w = applyEventEffect(w, { kind: 'morale_delta', params: { delta: 5 } });
    expect(w.morale).toBe(1);
  });

  it('spawnWorldEvent with duration>0 records an active event', () => {
    const w = spawnWorldEvent({ ...newWorldState(), food: 20, morale: 0.5 }, template, 10);
    expect(w.active_world_events).toHaveLength(1);
    expect(w.active_world_events[0].ends_at_cycle).toBe(12);
    expect(w.food).toBe(15);
  });

  it('tickWorldEvents ends expired events when cycle advances', () => {
    let w = spawnWorldEvent(newWorldState(), template, 0);
    w = { ...w, cycle: 5 };
    w = tickWorldEvents(w);
    expect(w.active_world_events).toHaveLength(0);
    expect(w.historical_world_events).toHaveLength(1);
  });

  it('one-shot events (duration=0) bypass active list', () => {
    const instant: WorldEventTemplate = { ...template, duration_cycles: 0 };
    const w = spawnWorldEvent(newWorldState(), instant, 5);
    expect(w.active_world_events).toHaveLength(0);
    expect(w.historical_world_events).toHaveLength(1);
  });
});

describe('resource nodes', () => {
  it('depleteNode flags depleted and schedules respawn', () => {
    let w = newWorldState();
    w = addResourceNode(w, {
      id: 'node_1',
      region_id: 'region_founding_shore',
      location: { x: 1, y: 1 },
      kind: 'tree',
      depleted: false,
    });
    w = depleteNode(w, 'node_1', 3);
    expect(w.resource_nodes[0].depleted).toBe(true);
    expect(w.resource_nodes[0].respawn_at_cycle).toBe(3);
  });

  it('tickResourceNodes revives depleted nodes at respawn cycle', () => {
    let w = newWorldState();
    w = addResourceNode(w, {
      id: 'node_1',
      region_id: 'region_founding_shore',
      location: { x: 1, y: 1 },
      kind: 'tree',
      depleted: false,
    });
    w = depleteNode(w, 'node_1', 2);
    w = { ...w, cycle: 5 };
    w = tickResourceNodes(w);
    expect(w.resource_nodes[0].depleted).toBe(false);
  });

  it('availableNodesIn filters depleted nodes', () => {
    let w = newWorldState();
    w = addResourceNode(w, {
      id: 'node_1', region_id: 'region_founding_shore',
      location: { x: 1, y: 1 }, kind: 'tree', depleted: false,
    });
    w = addResourceNode(w, {
      id: 'node_2', region_id: 'region_founding_shore',
      location: { x: 2, y: 2 }, kind: 'rock', depleted: true,
    });
    expect(availableNodesIn(w, 'region_founding_shore')).toHaveLength(1);
  });
});
