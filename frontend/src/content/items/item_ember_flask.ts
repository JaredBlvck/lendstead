// Items authored against Content Bible §8.6 (rarity tiers) and §7 (naming).
// Source-tied items (Rare+) reference breakthroughs, monuments, or specific
// regional events per Bible design rules.

import type { Item } from "../../game/items/itemTypes";

// Ember Flask — ceramic vessel lined to hold Ember Spring water without
// tainting. Standard issue for anyone who visits the spring under Wyn's
// custody. Uncommon because the clay firing temperature is a craftsman
// secret; only Harlan (toolmaker) can reliably produce them.
export const item_ember_flask: Item = {
  id: "item_ember_flask",
  schema_version: 1,
  name: "Ember Flask",
  category: "trade_good",
  rarity: "uncommon",
  description:
    "A small fired-clay flask, inner wall glazed with grey ash slip. Holds water drawn from the Ember Spring without dulling its warmth. Bears Wyn's maker-mark on the base.",
  stackable: true,
  max_stack: 3,
  weight: 0.4,
  value: 35,
  source: ["crafted_by_harlan", "quest_reward_quest_tending_the_ember_spring"],
  uses: ["carry_liquid", "ritual_offering"],
  stat_effects: [],
  crafting_recipes: [
    {
      station: "potter_kiln",
      skill_requirement: { skill: "crafting", level: 4 },
      ingredients: [
        { item_id: "item_refined_clay", qty: 2 },
        { item_id: "item_ash_slip", qty: 1 },
      ],
      produces_qty: 1,
    },
  ],
  quest_links: ["quest_tending_the_ember_spring"],
  drop_table_links: [],
  tags: ["container", "architect_lane", "ember_spring", "wyn_custody"],
};

// Ember Spring Water — drawn only at dawn under Wyn's blessing. The quest
// gather item. Not stackable high because fresh water loses potency at
// 2 cycles; treat it as a time-bounded resource in v2.
export const item_ember_water: Item = {
  id: "item_ember_water",
  schema_version: 1,
  name: "Ember Spring Water",
  category: "medicine",
  rarity: "uncommon",
  description:
    "Clear water drawn from the Ember Spring. Faintly warm to the tongue even hours after drawing. Lendstead folklore says the Source chose this spring first.",
  stackable: true,
  max_stack: 5,
  weight: 0.3,
  value: 18,
  source: ["gathered_poi_ember_spring"],
  uses: ["drink_restores_energy", "ritual_offering", "heal_minor"],
  stat_effects: [{ stat: "energy_restore", delta: 15 }],
  crafting_recipes: [],
  quest_links: ["quest_tending_the_ember_spring"],
  drop_table_links: [],
  tags: ["consumable", "ember_spring", "source_tied", "time_sensitive"],
};

// Inland Marker Staff — Wyn's staff, carved from hardwood harvested in
// Wren-Meadow. Rare because the oakroot Wyn chose came down in the same
// storm that killed her mentor. The staff is a memorial; Wyn lends it, but
// it is not for sale. Referenced by the quest chain but not a reward.
export const item_inland_marker_staff: Item = {
  id: "item_inland_marker_staff",
  schema_version: 1,
  name: "Inland Marker Staff",
  category: "weapon",
  rarity: "rare",
  description:
    "A six-foot staff of wren-oak hardwood, worn smooth at the grip. Grooves along the haft mark the carvings Wyn has deciphered. Tap it against stone and the Deepening seems to listen.",
  stackable: false,
  max_stack: 1,
  weight: 2.6,
  value: 220,
  source: ["personal_relic_wyn_only", "not_lootable"],
  uses: ["attack", "map_read_bonus", "commune_at_carving_sites"],
  equip_slot: "main_hand",
  stat_effects: [
    { stat: "attack", delta: 2 },
    { stat: "skill_scholar", delta: 2 },
    { stat: "carving_decipher_speed", delta: 1 },
  ],
  crafting_recipes: [],
  quest_links: ["quest_the_inland_corridor_hypothesis"],
  drop_table_links: [],
  tags: ["weapon", "rare", "relic", "wyn_only", "source_tied"],
};
