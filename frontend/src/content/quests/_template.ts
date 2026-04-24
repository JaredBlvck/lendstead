// SAMPLE QUEST TEMPLATE for Quad B to clone.
// Every content file in this directory should export its Quest object
// with a typed const + a matching filename (e.g. quest_founders_first_hunger.ts
// exports quest_founders_first_hunger).
//
// Run validateQuest(data) on every export before committing. Invalid
// quests fail the content-validation test (Quad A tooling).

import type { Quest } from '../../game/quests/questTypes';

export const quest_template_do_not_ship: Quest = {
  id: 'quest_template_do_not_ship',
  schema_version: 1,
  category: 'exploration',
  title: 'The Template Quest',
  summary: 'A sample quest showing every field. Do not ship this ID.',
  giver_npc_id: 'npc_template_giver',
  region_id: 'region_founding_shore',
  faction_id: undefined,
  prerequisites: [
    { kind: 'cycle_at_least', params: { cycle: 1 } },
    // { kind: 'completed_quest', params: { quest_id: 'quest_some_prior' } },
    // { kind: 'region_unlocked', params: { region_id: 'region_reedwake_marsh' } },
  ],
  objectives: [
    {
      id: 'obj_reach_camp',
      kind: 'reach_tile',
      target: { x: 20, y: 12 },
      count: 1,
      hidden: false,
      description: 'Walk to the central camp marker.',
    },
    {
      id: 'obj_talk_to_elder',
      kind: 'talk_to_npc',
      target: { npc_id: 'npc_template_giver' },
      count: 1,
      hidden: false,
      description: 'Speak with the quest giver after arriving.',
    },
    {
      id: 'obj_gather_flint',
      kind: 'gather_item',
      target: { item_id: 'item_template_flint' },
      count: 3,
      hidden: false,
      description: 'Pick up three flint shards.',
    },
  ],
  choices: [
    {
      at_objective: 'obj_talk_to_elder',
      options: [
        {
          id: 'choice_help_gladly',
          label: 'I will help, gladly.',
          moral_weight: 0.3,
          unlocks_objectives: ['obj_gather_flint'],
          completes_objectives: [],
          extra_rewards: [
            { kind: 'faction_reputation', params: { faction_id: 'faction_founders', delta: 5 } },
          ],
        },
        {
          id: 'choice_demand_pay',
          label: 'Only for pay.',
          moral_weight: -0.2,
          unlocks_objectives: ['obj_gather_flint'],
          completes_objectives: [],
          extra_rewards: [
            { kind: 'item', params: { item_id: 'item_template_silver_coin', qty: 10 } },
          ],
        },
      ],
    },
  ],
  rewards: [
    { kind: 'item', params: { item_id: 'item_template_reedwake_knife', qty: 1 } },
    { kind: 'skill_xp', params: { skill: 'scout', amount: 50 } },
  ],
  repeatable: false,
  tags: ['intro', 'founders', 'template'],
};
