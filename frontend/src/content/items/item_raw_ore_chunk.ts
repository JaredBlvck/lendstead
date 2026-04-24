// Core materials for the ore chain + cross-ref closures for drop tables.

import type { Item } from "../../game/items/itemTypes";

export const item_raw_ore_chunk: Item = {
  id: "item_raw_ore_chunk",
  schema_version: 1,
  name: "Raw Ore Chunk",
  category: "material",
  rarity: "common",
  description:
    "A dense chunk of iron-rich ore, freshly extracted. Heavy. Needs smelting at the smithy before it can become anything useful.",
  stackable: true,
  max_stack: 10,
  weight: 2.5,
  value: 18,
  source: [
    "gathered_region_the_deepening_ore_vein",
    "quest_reward_quest_the_deepening_vein",
    "shop_inventory_oren",
  ],
  uses: ["craft_ingredient_smelt_to_iron_ingot"],
  stat_effects: [],
  crafting_recipes: [],
  quest_links: ["quest_the_deepening_vein", "quest_the_second_seam_hypothesis"],
  drop_table_links: ["drop_the_deepening_foraging"],
  tags: ["material", "ore_chain", "architect_lane", "heavy"],
};

export const item_thatch_moss: Item = {
  id: "item_thatch_moss",
  schema_version: 1,
  name: "Thatch Moss",
  category: "material",
  rarity: "common",
  description:
    "A dense handful of moss harvested from shaded forest floor. Stays damp long enough to bind herbs into poultices. Also makes a cushion under roofing.",
  stackable: true,
  max_stack: 20,
  weight: 0.15,
  value: 3,
  source: ["gathered_region_wren_meadow"],
  uses: [
    "craft_ingredient_item_iwen_poultice",
    "craft_ingredient_shelter_roofing",
  ],
  stat_effects: [],
  crafting_recipes: [],
  quest_links: [],
  drop_table_links: ["drop_wren_meadow_foraging"],
  tags: ["material", "crafter_lane", "healer_adjacent"],
};

export const item_berry_handful: Item = {
  id: "item_berry_handful",
  schema_version: 1,
  name: "Berry Handful",
  category: "food",
  rarity: "common",
  description:
    "Three or four berries cupped loose in the hand. Won't keep past a cycle but eats easy on the walk.",
  stackable: true,
  max_stack: 5,
  weight: 0.1,
  value: 2,
  source: ["gathered_region_the_deepening_berry_grove"],
  uses: ["eat_restores_minor_energy", "shared_morale_boost"],
  stat_effects: [{ stat: "energy_restore", delta: 6 }],
  crafting_recipes: [],
  quest_links: [],
  drop_table_links: ["drop_the_deepening_foraging"],
  tags: ["food", "time_sensitive", "cheap"],
};
