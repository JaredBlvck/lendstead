// Medicinal items — Iwen's pharmacy. Herbs gathered + processed at The
// Deepening herb cluster. Ties into the treat interaction loop in the sim
// (healers treat wounded); these items are the material expression of that
// mechanism.

import type { Item } from "../../game/items/itemTypes";

// Medicinal Herb Bundle — the gather-item for quest_the_medicinal_sweep,
// also sold by Iwen + Wyn. Uncommon because the herb cluster respawns on
// a slow cycle and the wrong-season harvest spoils. Bruiseroot + yarrow +
// fever-leaf bundled with wren-oak twine.
export const item_medicinal_herb_bundle: Item = {
  id: "item_medicinal_herb_bundle",
  schema_version: 1,
  name: "Medicinal Herb Bundle",
  category: "medicine",
  rarity: "uncommon",
  description:
    "Bruiseroot, yarrow, and fever-leaf tied with wren-oak twine. Iwen's standard bundle — enough herbs for one poultice or two teas. Must be used fresh; spoils in 5 cycles.",
  stackable: true,
  max_stack: 10,
  weight: 0.2,
  value: 12,
  source: [
    "gathered_region_the_deepening_herb_cluster",
    "quest_reward_quest_the_medicinal_sweep",
    "shop_inventory_iwen",
  ],
  uses: [
    "craft_ingredient_item_iwen_poultice",
    "heal_minor",
    "ritual_offering",
  ],
  stat_effects: [{ stat: "healing_received", delta: 2 }],
  crafting_recipes: [],
  quest_links: [
    "quest_the_medicinal_sweep",
    "quest_the_ember_satellite_inspection",
  ],
  drop_table_links: ["drop_the_deepening_foraging"],
  tags: ["medicine", "herbal", "architect_lane", "time_sensitive"],
};

// Iwen's Poultice — crafted from herb bundles. Used on wounded NPCs or the
// player. The canonical heal item for the first-tier wound system. Stacks
// up to 5 because they're meant to be kept in a pouch, not bulk-stockpiled.
export const item_iwen_poultice: Item = {
  id: "item_iwen_poultice",
  schema_version: 1,
  name: "Iwen's Poultice",
  category: "medicine",
  rarity: "common",
  description:
    "A cloth pouch of pounded herbs and boiled bark, still warm when freshly made. Apply to a wound and leave bound for a full day. Iwen sews a blue thread on each one she makes so her work can be recognized.",
  stackable: true,
  max_stack: 5,
  weight: 0.1,
  value: 20,
  source: ["crafted", "shop_inventory_iwen", "shop_inventory_wyn_partial"],
  uses: ["heal_moderate", "reduce_infection_risk", "quest_deliver"],
  stat_effects: [
    { stat: "hp_restore", delta: 25 },
    { stat: "condition_upgrade_chance", delta: 0.15 },
  ],
  crafting_recipes: [
    {
      station: "infirmary_table",
      skill_requirement: { skill: "healing", level: 3 },
      ingredients: [
        { item_id: "item_medicinal_herb_bundle", qty: 1 },
        { item_id: "item_thatch_moss", qty: 1 },
      ],
      produces_qty: 2,
    },
  ],
  quest_links: ["quest_the_medicinal_sweep"],
  drop_table_links: [],
  tags: ["medicine", "healer_crafted", "common_heal", "architect_lane"],
};
