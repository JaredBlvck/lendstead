// Ironback Ridge — northern mountain spine. Scout-ranger + prospector lane.
// Transferred from Region Guide v1 §3, not new lore.

import type { Region } from "../../game/world/regions";

export const region_ironback_ridge: Region = {
  id: "region_ironback_ridge",
  schema_version: 1,
  name: "Ironback Ridge",
  summary:
    "Mountain spine along the northern horizon — cold stone, saddle passes, and eagle-cry at dawn.",
  description:
    "High wind, thin air, and the bones of the pre-Source civilization half-buried under shale. The Frost-Hollow cave opens somewhere on the southern face; scholars say it leads down to older memory. Terrain shaping here is politically sensitive — the mountain remembers.",
  tile_bounds: {
    min: { x: 8, y: 0 },
    max: { x: 35, y: 6 },
  },
  terrain_types: ["mountain", "hill", "forest", "cave"],
  gathering_spots: [
    {
      id: "gather_high_ore_vein",
      name: "High Ore Vein",
      tile: { x: 22, y: 3 },
      respawn_cycles: 10,
    },
    {
      id: "gather_mountain_herbs",
      name: "Mountain Herbs",
      tile: { x: 18, y: 4 },
      respawn_cycles: 8,
    },
    {
      id: "gather_eyrie_feathers",
      name: "Eyrie Feathers",
      tile: { x: 14, y: 2 },
      respawn_cycles: 15,
    },
    {
      id: "gather_cold_spring",
      name: "Cold Spring",
      tile: { x: 28, y: 5 },
      respawn_cycles: 6,
    },
  ],
  hazards: [
    {
      id: "hazard_altitude_fatigue",
      name: "Altitude Fatigue",
      description:
        "NPCs without canClimbCliffs capability move at half speed above y=3.",
      severity: "minor",
    },
    {
      id: "hazard_cold_exposure",
      name: "Cold Exposure",
      description:
        "Active storms amplify injuries on ridge tiles; wounded NPCs at altitude risk downgrade without shelter.",
      severity: "major",
    },
    {
      id: "hazard_rockslide",
      name: "Rockslide",
      description:
        "Terrain-shape casts within 4 tiles may trigger rockslides that damage nearby structures and bystanders.",
      severity: "catastrophic",
    },
  ],
  resident_npc_ids: [],
  quest_hook_ids: [],
  faction_home_ids: [],
  unlock: {
    kind: "completed_quest",
    params: { quest_id: "quest_the_inland_corridor_hypothesis" },
  },
  neighbors: ["region_the_deepening", "region_wren_meadow"],
  tags: ["mountain", "archaeology", "ore", "source_tied"],
};
