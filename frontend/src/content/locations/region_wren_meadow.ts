// Wren-Meadow — western interior forest. Named for Wren, first carpenter.
// Crafter lane + scout-in-training apprentice route.
// Transferred from Region Guide v1 §4, not new lore.

import type { Region } from "../../game/world/regions";

export const region_wren_meadow: Region = {
  id: "region_wren_meadow",
  schema_version: 1,
  name: "Wren-Meadow",
  summary:
    "Deep-shade hardwood grove — carpenters' source of haft wood and woodthrush omen-song.",
  description:
    "Leaf-rustle, resin, and the low-frequency woodthrush call that folklore says signals good morale. A grove of silver-barked trees grows at the heart of the meadow — reserved for ceremonial carving by Wren's lineage. Wildfire risk when dry streaks run long.",
  tile_bounds: {
    min: { x: 2, y: 7 },
    max: { x: 12, y: 14 },
  },
  terrain_types: ["forest", "plains"],
  gathering_spots: [
    {
      id: "gather_hardwood_stand",
      name: "Hardwood Stand",
      tile: { x: 6, y: 10 },
      drop_table_id: "drop_wren_meadow_foraging",
      respawn_cycles: 5,
    },
    {
      id: "gather_deadfall_kindling",
      name: "Deadfall Kindling",
      tile: { x: 9, y: 12 },
      drop_table_id: "drop_wren_meadow_foraging",
      respawn_cycles: 3,
    },
    {
      id: "gather_medicinal_bark",
      name: "Medicinal Bark",
      tile: { x: 4, y: 9 },
      drop_table_id: "drop_wren_meadow_foraging",
      respawn_cycles: 7,
    },
    {
      id: "gather_silverbark_grove",
      name: "Silver-bark Grove",
      tile: { x: 7, y: 11 },
      drop_table_id: "drop_wren_meadow_foraging",
      respawn_cycles: 15,
    },
  ],
  hazards: [
    {
      id: "hazard_wildfire",
      name: "Wildfire",
      description:
        "After 5+ cycles of dry streak without rain, a single spark (lightning, forge, camp fire) can ignite the forest. Damages all structures within 3 tiles; injures NPCs caught in the spread.",
      severity: "catastrophic",
    },
    {
      id: "hazard_getting_lost",
      name: "Getting Lost",
      description:
        "Scouts with skill < 4 have a chance to spend extra cycles crossing the meadow; quest-objective timers may stretch.",
      severity: "minor",
    },
  ],
  resident_npc_ids: [],
  quest_hook_ids: [],
  faction_home_ids: ["faction_architects"],
  unlock: { kind: "always", params: {} },
  neighbors: ["region_the_deepening", "region_ironback_ridge"],
  tags: ["forest", "crafter_lane", "architect_lane", "woodthrush_omen"],
};
