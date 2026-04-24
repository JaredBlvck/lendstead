// Gull-Cove — narrow southeastern coastal pocket. Fisher + shell-pearl site.
// Transferred from Region Guide v1 §5, not new lore.

import type { Region } from "../../game/world/regions";

export const region_gull_cove: Region = {
  id: "region_gull_cove",
  schema_version: 1,
  name: "Gull-Cove",
  summary:
    "Narrow southeast cove — tight canyon acoustics, fishing fleet, and the seasonal seal colony.",
  description:
    "Sound bounces in Gull-Cove the way it does nowhere else on the island. Fishermen use the acoustic dead zones to locate fish. Folklore says the Source speaks here first when it's about to manifest — the Brine-Whisper.",
  tile_bounds: {
    min: { x: 24, y: 18 },
    max: { x: 33, y: 22 },
  },
  terrain_types: ["beach", "water", "plains"],
  gathering_spots: [
    {
      id: "gather_fishing_grounds",
      name: "Fishing Grounds",
      tile: { x: 27, y: 20 },
      respawn_cycles: 4,
    },
    {
      id: "gather_sea_salt_flat",
      name: "Sea Salt Flat",
      tile: { x: 25, y: 19 },
      respawn_cycles: 10,
    },
    {
      id: "gather_shell_pearl_bed",
      name: "Shell-Pearl Bed",
      tile: { x: 30, y: 21 },
      respawn_cycles: 18,
    },
  ],
  hazards: [
    {
      id: "hazard_cove_surge",
      name: "Cove Storm Surge",
      description:
        "Canyon geometry funnels storm surge into a narrow channel; worse damage than The Tidefast per unit storm severity.",
      severity: "major",
    },
    {
      id: "hazard_boat_launch_fail",
      name: "Boat Launch Failure",
      description:
        "Major storms make fishing-boat launches impossible for 2-4 cycles; food balance dips.",
      severity: "minor",
    },
  ],
  resident_npc_ids: [],
  quest_hook_ids: [],
  faction_home_ids: ["faction_opportunists"],
  unlock: { kind: "always", params: {} },
  neighbors: ["region_the_tidefast"],
  tags: [
    "coastal",
    "fishing",
    "opportunist_lane",
    "seasonal",
    "source_sensitive",
  ],
};
