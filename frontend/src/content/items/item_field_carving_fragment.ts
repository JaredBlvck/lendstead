// Carving fragments — physical artifacts yielded by archaeology discovery.
// Referenced by drops + quests. Source-tied per Bible §8.6 (rare+ items must
// tie to a Source event or monument location).

import type { Item } from "../../game/items/itemTypes";

export const item_field_carving_fragment: Item = {
  id: "item_field_carving_fragment",
  schema_version: 1,
  name: "Field Carving Fragment",
  category: "quest_item",
  rarity: "rare",
  description:
    "A palm-sized chip of weather-smoothed stone marked with spiral-glyphs that Saela catalogues as pre-Source pictography. Each fragment is a piece of a larger carving someone in the old island broke apart, or buried, or lost.",
  stackable: true,
  max_stack: 10,
  weight: 0.3,
  value: 80,
  source: [
    "discovery_site_carving",
    "gathered_region_the_deepening_rare",
    "quest_reward_quest_the_third_carving",
  ],
  uses: ["quest_deliver", "study_with_wyn_or_saela"],
  stat_effects: [],
  crafting_recipes: [],
  quest_links: ["quest_the_third_carving"],
  drop_table_links: ["drop_the_deepening_foraging"],
  tags: ["quest_item", "archaeology", "source_tied", "saela_catalogued"],
};

export const item_long_carving_fragment: Item = {
  id: "item_long_carving_fragment",
  schema_version: 1,
  name: "Long Carving Fragment",
  category: "relic",
  rarity: "ancient",
  description:
    "A longer piece — nearly the length of a forearm — bearing a continuous glyph-chain that Saela believes tells the name of the island's third voice. Held up to the Ember Spring at dawn, the stone runs warm against the palm.",
  stackable: false,
  max_stack: 1,
  weight: 0.9,
  value: 280,
  source: [
    "discovery_site_carving_ironback_glyphs",
    "quest_reward_quest_the_third_carving",
  ],
  uses: ["study_with_wyn_or_saela", "unlock_archaeology_chain_v2"],
  stat_effects: [{ stat: "skill_scholar", delta: 1 }],
  crafting_recipes: [],
  quest_links: ["quest_the_third_carving"],
  drop_table_links: ["drop_the_deepening_foraging"],
  tags: ["relic", "epic", "archaeology", "source_tied", "saela_third_carving"],
};
