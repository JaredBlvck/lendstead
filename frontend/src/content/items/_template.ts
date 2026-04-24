// SAMPLE ITEM TEMPLATES for Quad B to clone.
// Every content file in this directory should export its Item object(s)
// with a typed const + a matching filename. Run validateItem(data) on
// every export before committing.

import type { Item } from '../../game/items/itemTypes';

export const item_template_flint: Item = {
  id: 'item_template_flint',
  schema_version: 1,
  name: 'Flint Shard',
  category: 'material',
  rarity: 'common',
  description: 'A sharp chip of flint struck from a river stone.',
  stackable: true,
  max_stack: 99,
  weight: 0.1,
  value: 2,
  source: ['foraged_reedwake_marsh', 'quest_reward'],
  uses: ['craft_ingredient'],
  stat_effects: [],
  crafting_recipes: [],
  quest_links: [],
  drop_table_links: [],
  tags: ['early_game', 'material'],
};

export const item_template_knife: Item = {
  id: 'item_template_reedwake_knife',
  schema_version: 1,
  name: 'Reedwake Knife',
  category: 'weapon',
  rarity: 'uncommon',
  description: 'A short blade bound with marsh reed. Scout standard issue.',
  stackable: false,
  max_stack: 1,
  weight: 1.2,
  value: 35,
  source: ['crafted', 'quest_reward_quest_template_do_not_ship'],
  uses: ['attack'],
  equip_slot: 'main_hand',
  stat_effects: [
    { stat: 'attack', delta: 3 },
    { stat: 'skill_scout', delta: 1 },
  ],
  crafting_recipes: [
    {
      station: 'campfire',
      skill_requirement: { skill: 'crafting', level: 2 },
      ingredients: [
        { item_id: 'item_template_flint', qty: 2 },
      ],
      produces_qty: 1,
    },
  ],
  quest_links: ['quest_template_do_not_ship'],
  drop_table_links: [],
  tags: ['weapon', 'reedwake', 'scout'],
};

export const item_template_silver_coin: Item = {
  id: 'item_template_silver_coin',
  schema_version: 1,
  name: 'Silver Coin',
  category: 'trade_good',
  rarity: 'common',
  description: 'Island currency, struck by the Founders.',
  stackable: true,
  max_stack: 10000,
  weight: 0.01,
  value: 1,
  source: ['quest_reward', 'trade', 'loot'],
  uses: ['currency'],
  stat_effects: [],
  crafting_recipes: [],
  quest_links: [],
  drop_table_links: [],
  tags: ['currency'],
};
