import { describe, it, expect } from 'vitest';
import {
  QuestRegistry,
  allPrerequisitesMet,
  availableQuests,
  startQuest,
  advanceOnEvent,
  completeQuest,
  failQuest,
  applyChoice,
} from '../quests/questEngine';
import { PlayerQuestState } from '../quests/questState';
import { quest_template_do_not_ship } from '../../content/quests/_template';
import { ItemRegistry } from '../items/itemRegistry';
import { emptyInventory, qtyOf } from '../items/inventory';
import { newWorldState, adjustFactionReputation } from '../world/worldState';
import {
  item_template_flint,
  item_template_knife,
  item_template_silver_coin,
} from '../../content/items/_template';

function registry() {
  const reg = new ItemRegistry();
  reg.registerMany([
    item_template_flint,
    item_template_knife,
    item_template_silver_coin,
  ]);
  return reg;
}

describe('questEngine', () => {
  it('prerequisites check cycle_at_least', () => {
    let world = newWorldState();
    expect(allPrerequisitesMet(quest_template_do_not_ship, world)).toBe(false);
    world = { ...world, cycle: 2 };
    expect(allPrerequisitesMet(quest_template_do_not_ship, world)).toBe(true);
  });

  it('availableQuests filters by acceptance + prereqs', () => {
    const reg = new QuestRegistry();
    reg.register(quest_template_do_not_ship);
    let world = newWorldState();
    // cycle=0, prereq cycle_at_least=1 fails -> not available
    let player = new PlayerQuestState();
    expect(availableQuests(reg, world, player.all())).toHaveLength(0);

    world = { ...world, cycle: 5 };
    expect(availableQuests(reg, world, player.all())).toHaveLength(1);

    // After accepting, it's no longer "available"
    player = player.set(startQuest(quest_template_do_not_ship, 'p1', 5));
    expect(availableQuests(reg, world, player.all())).toHaveLength(0);
  });

  it('startQuest creates runtime with zeroed objectives', () => {
    const rt = startQuest(quest_template_do_not_ship, 'p1', 3);
    expect(rt.status).toBe('accepted');
    expect(rt.objectives).toHaveLength(3);
    expect(rt.objectives.every((o) => o.current === 0 && !o.completed)).toBe(true);
  });

  it('advanceOnEvent progresses the correct objective', () => {
    let rt = startQuest(quest_template_do_not_ship, 'p1', 3);
    rt = advanceOnEvent(quest_template_do_not_ship, rt, {
      kind: 'reach_tile',
      payload: { x: 20, y: 12 },
    });
    const reach = rt.objectives.find((o) => o.id === 'obj_reach_camp')!;
    expect(reach.completed).toBe(true);
  });

  it('gather_item accumulates qty then completes', () => {
    let rt = startQuest(quest_template_do_not_ship, 'p1', 3);
    rt = advanceOnEvent(quest_template_do_not_ship, rt, {
      kind: 'gather_item',
      payload: { item_id: 'item_template_flint', qty: 1 },
    });
    let gather = rt.objectives.find((o) => o.id === 'obj_gather_flint')!;
    expect(gather.current).toBe(1);
    expect(gather.completed).toBe(false);

    rt = advanceOnEvent(quest_template_do_not_ship, rt, {
      kind: 'gather_item',
      payload: { item_id: 'item_template_flint', qty: 5 },
    });
    gather = rt.objectives.find((o) => o.id === 'obj_gather_flint')!;
    expect(gather.current).toBe(3);   // clamped to count=3
    expect(gather.completed).toBe(true);
  });

  it('completing all objectives flips status to completed', () => {
    let rt = startQuest(quest_template_do_not_ship, 'p1', 3);
    rt = advanceOnEvent(quest_template_do_not_ship, rt, { kind: 'reach_tile', payload: { x: 20, y: 12 } });
    rt = advanceOnEvent(quest_template_do_not_ship, rt, { kind: 'talk_to_npc', payload: { npc_id: 'npc_template_giver' } });
    rt = advanceOnEvent(quest_template_do_not_ship, rt, { kind: 'gather_item', payload: { item_id: 'item_template_flint', qty: 3 } });
    expect(rt.status).toBe('completed');
  });

  it('completeQuest applies rewards to world + inventory', () => {
    const reg = registry();
    let rt = startQuest(quest_template_do_not_ship, 'p1', 3);
    rt = advanceOnEvent(quest_template_do_not_ship, rt, { kind: 'reach_tile', payload: { x: 20, y: 12 } });
    rt = advanceOnEvent(quest_template_do_not_ship, rt, { kind: 'talk_to_npc', payload: { npc_id: 'npc_template_giver' } });
    rt = advanceOnEvent(quest_template_do_not_ship, rt, { kind: 'gather_item', payload: { item_id: 'item_template_flint', qty: 3 } });

    const world = newWorldState();
    const inv = emptyInventory('p1', 28);
    const result = completeQuest(quest_template_do_not_ship, rt, {
      world,
      inventory: inv,
      itemLookup: reg.lookup,
    }, 5);

    expect(result.runtime.status).toBe('completed');
    expect(result.world.completed_quest_ids).toContain('quest_template_do_not_ship');
    expect(qtyOf(result.inventory, 'item_template_reedwake_knife')).toBe(1);
  });

  it('applyChoice marks completes_objectives and logs the choice', () => {
    let rt = startQuest(quest_template_do_not_ship, 'p1', 3);
    rt = applyChoice(quest_template_do_not_ship, rt, 'choice_help_gladly');
    expect(rt.choices_taken).toContain('choice_help_gladly');
  });

  it('completeQuest applies choice extra_rewards', () => {
    const reg = registry();
    let rt = startQuest(quest_template_do_not_ship, 'p1', 3);
    rt = applyChoice(quest_template_do_not_ship, rt, 'choice_demand_pay');
    // force completion
    rt = { ...rt, status: 'completed', objectives: rt.objectives.map((o) => ({ ...o, completed: true, current: 1 })) };
    const world = newWorldState();
    const inv = emptyInventory('p1', 28);
    const result = completeQuest(quest_template_do_not_ship, rt, {
      world,
      inventory: inv,
      itemLookup: reg.lookup,
    }, 7);
    expect(qtyOf(result.inventory, 'item_template_silver_coin')).toBe(10);
  });

  it('failQuest marks runtime + world', () => {
    const rt = startQuest(quest_template_do_not_ship, 'p1', 3);
    const world = newWorldState();
    const result = failQuest(rt, world);
    expect(result.runtime.status).toBe('failed');
    expect(result.world.failed_quest_ids).toContain('quest_template_do_not_ship');
  });

  it('faction_reputation_at_least prerequisite reads world state', () => {
    let world = newWorldState();
    const qWithFaction = {
      ...quest_template_do_not_ship,
      prerequisites: [
        { kind: 'faction_reputation_at_least' as const, params: { faction_id: 'faction_founders', score: 0.3 } },
      ],
    };
    expect(allPrerequisitesMet(qWithFaction, world)).toBe(false);
    world = adjustFactionReputation(world, 'faction_founders', 0.4);
    expect(allPrerequisitesMet(qWithFaction, world)).toBe(true);
  });
});

describe('PlayerQuestState', () => {
  it('tracks active vs completed quests', () => {
    let state = new PlayerQuestState();
    state = state.set(startQuest(quest_template_do_not_ship, 'p1', 1));
    expect(state.active()).toHaveLength(1);
    expect(state.completed()).toHaveLength(0);
    const row = state.get('quest_template_do_not_ship')!;
    state = state.set({ ...row, status: 'completed' });
    expect(state.active()).toHaveLength(0);
    expect(state.completed()).toHaveLength(1);
  });
});
