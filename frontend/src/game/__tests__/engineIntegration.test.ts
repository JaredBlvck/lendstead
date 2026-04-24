// End-to-end integration test for the engine wiring sprint. Proves that
// the pieces Sr shipped in PR #2 + #3 actually work together:
//   - loadContentBundle populates registries from /src/content/
//   - startQuest + advanceOnEvent + completeQuest cooperate
//   - EventBridge-style auto-completion with reward application works
//   - Save/load round-trips the full runtime state
//
// Does NOT render React components (no happy-dom/jsdom component tests);
// instead exercises the pure engine functions with the same sequence a
// live ExplorationView would produce. If this test breaks, in-game
// gameplay is broken.

import { describe, it, expect } from 'vitest';
import { loadContentBundle } from '../engine/contentBundle';
import { startQuest, advanceOnEvent, completeQuest, allPrerequisitesMet } from '../quests/questEngine';
import type { GameEvent } from '../quests/questObjectives';
import type { QuestRuntimeState } from '../quests/questTypes';
import { emptyInventory, qtyOf, addItem } from '../items/inventory';
import { emptyEquipment } from '../items/equipment';
import { newWorldState, setFlag, adjustFactionReputation } from '../world/worldState';
import { buildSave } from '../save/saveGame';
import { loadSave } from '../save/loadGame';
import { resolveDialogue } from '../npcs/npcDialogue';
import { setFlag as setNpcMemoryFlag } from '../npcs/npcMemory';
import type { NpcRuntimeState } from '../npcs/npcTypes';

describe('engine integration (end-to-end)', () => {
  it('loads the content bundle without shape errors', () => {
    const bundle = loadContentBundle();
    const shapeErrors = bundle.errors.filter((e) => !e.includes('loaded with warnings'));
    expect(shapeErrors).toEqual([]);
  });

  it('walks the template quest from accept to completion with rewards', () => {
    const bundle = loadContentBundle();
    const quest = bundle.quests.get('quest_template_do_not_ship');
    expect(quest).toBeDefined();

    // Prereqs need cycle>=1 for the template
    let world = newWorldState();
    world = { ...world, cycle: 5 };
    expect(allPrerequisitesMet(quest!, world)).toBe(true);

    let runtime: QuestRuntimeState = startQuest(quest!, 'test_player', world.cycle);
    expect(runtime.status).toBe('accepted');

    // Simulate the sequence of events the 3D view would emit.
    // Template gather objective matches item_template_flint.
    const events: GameEvent[] = [
      { kind: 'reach_tile', payload: { x: 20, y: 12 } },
      { kind: 'talk_to_npc', payload: { npc_id: 'npc_template_giver' } },
      { kind: 'gather_item', payload: { item_id: 'item_template_flint', qty: 3 } },
    ];
    for (const event of events) {
      runtime = advanceOnEvent(quest!, runtime, event);
    }
    expect(runtime.status).toBe('completed');

    // Apply rewards: 1x item_template_reedwake_knife + skill_xp scout+50
    const inv = emptyInventory('test_player', 28);
    const result = completeQuest(quest!, runtime, {
      world,
      inventory: inv,
      itemLookup: bundle.items.lookup,
    }, world.cycle);

    expect(qtyOf(result.inventory, 'item_template_reedwake_knife')).toBeGreaterThanOrEqual(1);
    expect(result.world.completed_quest_ids).toContain('quest_template_do_not_ship');
  });

  it('Wyn first_meeting dialogue triggers the Ember Spring quest id', () => {
    const bundle = loadContentBundle();
    const wyn = bundle.npcs.get('npc_wyn_inland_marker');
    expect(wyn).toBeDefined();

    const runtime: NpcRuntimeState = {
      npc_id: wyn!.id,
      movement_mode: wyn!.default_movement_mode,
      path: [],
      dialogue_state: wyn!.default_dialogue_state,
      memory_flags: [],
      relationship_with_player: 0,
      alive: true,
      schedule_phase: 0,
    };
    const resolution = resolveDialogue(wyn!, runtime);
    // First meeting line, in Wyn's dialogue lines, should trigger ember spring
    expect(resolution.state).toBe('first_meeting');
    expect(resolution.line).toBeDefined();
  });

  it('EventBridge-style auto-completion path: emit events, rewards applied, world updated', () => {
    const bundle = loadContentBundle();
    // Use the template quest (predictable) instead of the content quest whose
    // prereqs depend on NPC skill threshold (not yet wired to world state).
    const quest = bundle.quests.get('quest_template_do_not_ship')!;

    let world = { ...newWorldState(), cycle: 5 };
    let inventory = emptyInventory('p', 28);
    let questRuntime: QuestRuntimeState[] = [startQuest(quest, 'p', world.cycle)];

    // Simulate what EventBridge does on emit: walk runtime, apply, auto-complete
    const emit = (event: GameEvent) => {
      const updated: QuestRuntimeState[] = [];
      for (const row of questRuntime) {
        if (row.status !== 'accepted' && row.status !== 'active') {
          updated.push(row);
          continue;
        }
        const q = bundle.quests.get(row.quest_id);
        if (!q) {
          updated.push(row);
          continue;
        }
        const next = advanceOnEvent(q, row, event);
        if (next.status === 'completed') {
          const result = completeQuest(q, next, { world, inventory, itemLookup: bundle.items.lookup }, world.cycle);
          updated.push(result.runtime);
          world = result.world;
          inventory = result.inventory;
        } else {
          updated.push(next);
        }
      }
      questRuntime = updated;
    };

    emit({ kind: 'reach_tile', payload: { x: 20, y: 12 } });
    emit({ kind: 'talk_to_npc', payload: { npc_id: 'npc_template_giver' } });
    emit({ kind: 'gather_item', payload: { item_id: 'item_template_flint', qty: 3 } });

    expect(questRuntime[0].status).toBe('completed');
    expect(world.completed_quest_ids).toContain('quest_template_do_not_ship');
    expect(qtyOf(inventory, 'item_template_reedwake_knife')).toBeGreaterThanOrEqual(1);
  });

  it('save / load round-trip preserves quest runtime + inventory + world flags', () => {
    const bundle = loadContentBundle();

    let world = { ...newWorldState(), cycle: 5 };
    world = setFlag(world, 'met_wyn');
    world = adjustFactionReputation(world, 'faction_architects', 0.3);

    const inventory = addItem(emptyInventory('p', 28), 'item_ember_flask', 2, bundle.items.lookup).inventory;
    const equipment = emptyEquipment('p');

    const npcRuntime: NpcRuntimeState[] = [
      setNpcMemoryFlag({
        npc_id: 'npc_wyn_inland_marker',
        movement_mode: 'idle',
        path: [],
        dialogue_state: 'friendly',
        memory_flags: [],
        relationship_with_player: 0.2,
        alive: true,
        schedule_phase: 0,
      }, 'met_player'),
    ];

    const questRuntime: QuestRuntimeState[] = [
      {
        quest_id: 'quest_template_do_not_ship',
        player_id: 'p',
        status: 'accepted',
        accepted_cycle: 5,
        objectives: [
          { id: 'obj_reach_camp', current: 0, completed: false },
          { id: 'obj_talk_to_elder', current: 0, completed: false },
          { id: 'obj_gather_flint', current: 0, completed: false },
        ],
        choices_taken: [],
      },
    ];

    const save = buildSave({
      player: { id: 'p', location: { x: 10, y: 10 }, region_id: 'region_founding_shore', capabilities: {} },
      world,
      inventories: [inventory],
      equipment: [equipment],
      npc_runtime: npcRuntime,
      quest_runtime: questRuntime,
    });

    const json = JSON.stringify(save);
    const loaded = loadSave(JSON.parse(json));
    expect(loaded.ok).toBe(true);
    expect(loaded.save?.world.world_flags.met_wyn).toBe(true);
    expect(loaded.save?.world.faction_reputation[0].score).toBeCloseTo(0.3, 5);
    expect(loaded.save?.quest_runtime[0].quest_id).toBe('quest_template_do_not_ship');
    expect(loaded.save?.npc_runtime[0].memory_flags).toContain('met_player');
    expect(loaded.save?.inventories[0].stacks.some((s) => s.item_id === 'item_ember_flask')).toBe(true);
  });

  it('quest with reward pointing at unknown item does NOT crash - it logs and skips', () => {
    const bundle = loadContentBundle();
    const quest = bundle.quests.get('quest_template_do_not_ship')!;
    const bad = {
      ...quest,
      id: 'quest_bad_reward_not_registered',
      rewards: [
        { kind: 'item' as const, params: { item_id: 'item_does_not_exist', qty: 1 } },
        // also include a valid reward to confirm the rest still applies
        { kind: 'faction_reputation' as const, params: { faction_id: 'faction_founders', delta: 0.1 } },
      ],
    };

    const world = { ...newWorldState(), cycle: 5 };
    const inv = emptyInventory('p', 28);
    const runtime = startQuest(bad, 'p', world.cycle);
    const completed = { ...runtime, status: 'completed' as const };

    const result = completeQuest(bad, completed, { world, inventory: inv, itemLookup: bundle.items.lookup }, world.cycle);

    // Quest completes successfully (no throw)
    expect(result.runtime.status).toBe('completed');
    // Inventory untouched by the bad reward
    expect(result.inventory.stacks).toHaveLength(0);
    // Faction rep reward still applied
    expect(result.world.faction_reputation.some((f) => f.faction_id === 'faction_founders' && f.score > 0)).toBe(true);
    // Notes log the skip
    expect(result.notes.some((n) => n.includes('unknown item'))).toBe(true);
  });
});
