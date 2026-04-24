// Drop table for Ironback predators (Crag Stalker + Ridge Hound). Combat
// victory rolls this table via the PR #9 combatResolver flow. Rewards reflect
// fur/teeth salvage + occasional crafter-grade materials.

import type { DropTable } from "../../game/drops/dropTypes";

export const drop_enemy_ridge_predator: DropTable = {
  id: "drop_enemy_ridge_predator",
  schema_version: 1,
  source_name: "Ridge Predator Defeat",
  source_type: "wildlife",
  region_id: "region_ironback_ridge",
  guaranteed_drops: [],
  common_drops: [
    { item_id: "item_medicinal_bark", min_qty: 1, max_qty: 2, weight: 40 },
    { item_id: "item_raw_ore_chunk", min_qty: 1, max_qty: 1, weight: 30 },
    { item_id: "item_thatch_moss", min_qty: 2, max_qty: 3, weight: 30 },
  ],
  common_chance: 0.7,
  uncommon_drops: [
    {
      item_id: "item_medicinal_herb_bundle",
      min_qty: 1,
      max_qty: 1,
      weight: 50,
    },
    { item_id: "item_silverbark_sliver", min_qty: 1, max_qty: 1, weight: 30 },
    { item_id: "item_ember_water", min_qty: 1, max_qty: 1, weight: 20 },
  ],
  uncommon_chance: 0.22,
  rare_drops: [
    { item_id: "item_ember_flask", min_qty: 1, max_qty: 1, weight: 100 },
  ],
  rare_chance: 0.05,
  ultra_rare_drops: [
    {
      item_id: "item_inland_marker_staff",
      chance: 0.001,
      min_qty: 1,
      max_qty: 1,
    },
  ],
  modifiers: [
    {
      condition: "region_id:region_ironback_ridge",
      rare_chance_multiplier: 1.2,
      ultra_rare_chance_multiplier: 1.0,
      weight_boosts: {
        item_raw_ore_chunk: 1.4,
      },
    },
  ],
  notes:
    "Defeated Ironback predators. Lorewise: the ore comes from what they have been scavenging near the veins; medicinal bark + moss from brush caught in fur; rare Ember Flask is a found traveler-drop from a pack that caught an unlucky scout years back. Ultra-rare Inland Marker Staff is Wyn's lost first staff (pre-current) — heavily weighted against because Wyn carries hers visibly.",
};
