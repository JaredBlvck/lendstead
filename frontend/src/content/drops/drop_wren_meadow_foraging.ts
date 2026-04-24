// Wren-Meadow foraging drops — what a forager-family NPC turns up when
// they work the forest region. Region-scoped table per Content Bible §7
// Region Guide and §8.5 role distribution. Targets forager skill ≥ 3.

import type { DropTable } from "../../game/drops/dropTypes";

export const drop_wren_meadow_foraging: DropTable = {
  id: "drop_wren_meadow_foraging",
  schema_version: 1,
  source_name: "Wren-Meadow Foraging Sweep",
  source_type: "wildlife", // treating "region forage" as a wildlife-equivalent encounter kind
  region_id: "region_wren_meadow",
  guaranteed_drops: [
    { item_id: "item_deadfall_kindling", min_qty: 1, max_qty: 3, weight: 1 },
  ],
  common_drops: [
    { item_id: "item_hardwood_billet", min_qty: 1, max_qty: 2, weight: 40 },
    { item_id: "item_medicinal_bark", min_qty: 1, max_qty: 2, weight: 30 },
    { item_id: "item_thatch_moss", min_qty: 2, max_qty: 4, weight: 30 },
  ],
  common_chance: 0.85,
  uncommon_drops: [
    { item_id: "item_woodthrush_feather", min_qty: 1, max_qty: 1, weight: 50 },
    {
      item_id: "item_medicinal_herb_bundle",
      min_qty: 1,
      max_qty: 1,
      weight: 35,
    },
    { item_id: "item_silverbark_sliver", min_qty: 1, max_qty: 1, weight: 15 },
  ],
  uncommon_chance: 0.18,
  rare_drops: [
    // Silver-bark sliver from ceremonial trees; §7 region lore.
    { item_id: "item_silverbark_sliver", min_qty: 1, max_qty: 2, weight: 70 },
    {
      item_id: "item_woodthrush_nest_omen",
      min_qty: 1,
      max_qty: 1,
      weight: 30,
    },
  ],
  rare_chance: 0.04,
  ultra_rare_drops: [
    // The "omen" — canonical Bible reference to full nest = +1 morale for
    // faction for 5 cycles. Ties into affinity/morale systems.
    {
      item_id: "item_woodthrush_nest_omen",
      chance: 0.003,
      min_qty: 1,
      max_qty: 1,
    },
  ],
  modifiers: [
    {
      // After a storm, deadfall is more abundant — per Bible §2 terrain notes.
      condition: "recent_event:storm:cycle_within_3",
      rare_chance_multiplier: 1.0,
      ultra_rare_chance_multiplier: 1.0,
      weight_boosts: {
        item_deadfall_kindling: 2.5,
        item_hardwood_billet: 1.5,
      },
    },
    {
      // Woodthrush-song + morale omen folds in: if faction morale is high,
      // rare nest drops boost.
      condition: "faction_morale_at_least:faction_architects:0.7",
      rare_chance_multiplier: 1.3,
      ultra_rare_chance_multiplier: 1.5,
      weight_boosts: {
        item_woodthrush_nest_omen: 1.4,
      },
    },
    {
      // Dry streak penalizes forage yields — wildfire risk per §7 hazards.
      condition: "dry_streak_at_least:5",
      rare_chance_multiplier: 0.6,
      ultra_rare_chance_multiplier: 0.5,
      weight_boosts: {
        item_thatch_moss: 0.5,
      },
    },
  ],
  notes:
    "Foundation-batch drop table for Wren-Meadow. Author additional region drops (The Tidefast, Ironback Ridge, Gull-Cove, The Deepening) against the same pattern: 1 guaranteed low-tier filler, 3 common weighted normal returns, 2-3 uncommon thematics, 1-2 rare region-lore hooks, 1 ultra-rare narrative omen.",
};
