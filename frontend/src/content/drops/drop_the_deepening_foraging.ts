// The Deepening region forage drops — interior plains + scattered forest
// pockets. Heavier on ore + herbs + berries than Wren-Meadow's hardwood
// focus. Ties into medicinal_sweep quest (herb bundles) and ore-chain
// quests (second_seam, deepening_vein in the canonical quest_key set).

import type { DropTable } from "../../game/drops/dropTypes";

export const drop_the_deepening_foraging: DropTable = {
  id: "drop_the_deepening_foraging",
  schema_version: 1,
  source_name: "The Deepening Foraging Sweep",
  source_type: "wildlife",
  region_id: "region_the_deepening",
  guaranteed_drops: [
    {
      item_id: "item_medicinal_herb_bundle",
      min_qty: 1,
      max_qty: 1,
      weight: 1,
    },
  ],
  common_drops: [
    {
      item_id: "item_medicinal_herb_bundle",
      min_qty: 1,
      max_qty: 2,
      weight: 45,
    },
    { item_id: "item_berry_handful", min_qty: 2, max_qty: 4, weight: 30 },
    { item_id: "item_raw_ore_chunk", min_qty: 1, max_qty: 2, weight: 25 },
  ],
  common_chance: 0.85,
  uncommon_drops: [
    { item_id: "item_silverbark_sliver", min_qty: 1, max_qty: 1, weight: 30 },
    { item_id: "item_raw_ore_chunk", min_qty: 2, max_qty: 4, weight: 40 },
    {
      item_id: "item_field_carving_fragment",
      min_qty: 1,
      max_qty: 1,
      weight: 30,
    },
  ],
  uncommon_chance: 0.2,
  rare_drops: [
    {
      item_id: "item_field_carving_fragment",
      min_qty: 1,
      max_qty: 1,
      weight: 60,
    },
    { item_id: "item_ember_water", min_qty: 1, max_qty: 1, weight: 40 },
  ],
  rare_chance: 0.04,
  ultra_rare_drops: [
    // The Long Carving — canonical Bible §2 / §7 ref. Discovering a fragment
    // near the ore veins is a narrative beat that seeds deeper archaeology.
    {
      item_id: "item_long_carving_fragment",
      chance: 0.002,
      min_qty: 1,
      max_qty: 1,
    },
  ],
  modifiers: [
    {
      // Near the Ember Spring the herb cluster gives boosted herb yields.
      condition: "within_tiles:poi_ember_spring:3",
      rare_chance_multiplier: 1.0,
      ultra_rare_chance_multiplier: 1.0,
      weight_boosts: {
        item_medicinal_herb_bundle: 2.0,
        item_ember_water: 3.0,
      },
    },
    {
      // After a successful medicinal_sweep quest the cluster is thinner;
      // penalize common herbs for ~10 cycles (would need runtime flag).
      condition: "flag_set:herb_cluster_recently_harvested",
      rare_chance_multiplier: 0.5,
      ultra_rare_chance_multiplier: 1.0,
      weight_boosts: {
        item_medicinal_herb_bundle: 0.3,
      },
    },
    {
      // Prospector role + Deepening forage = more ore.
      condition: "gatherer_role_family:prospector",
      rare_chance_multiplier: 1.2,
      ultra_rare_chance_multiplier: 1.1,
      weight_boosts: {
        item_raw_ore_chunk: 1.8,
      },
    },
  ],
  notes:
    "Ties into the second_seam + deepening_vein quest chain (ore drops) and medicinal_sweep (herb drops). Field carving fragments are the archaeology hook — each fragment is a piece of the proto-Source pictography. Ultra-rare Long Carving fragment escalates to quest_the_inland_corridor_hypothesis.",
};
