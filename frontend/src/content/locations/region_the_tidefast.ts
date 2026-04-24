// The Tidefast — coastal southwest arc. Forager + shoreline-mapper lane.
// Transferred from Region Guide v1 §1, not new lore.

import type { Region } from "../../game/world/regions";

export const region_the_tidefast: Region = {
  id: "region_the_tidefast",
  schema_version: 1,
  name: "The Tidefast",
  summary: "Coastal arc of beach, shallow cove, and tide-pool glass shards.",
  description:
    "Salt spray and gull-cries, rhythmic surf, wet stone underfoot. The southwest coast carries the island's storm-warning before anywhere else. Tide-pools hold glass shards worn smooth by centuries.",
  tile_bounds: {
    min: { x: 0, y: 16 },
    max: { x: 12, y: 23 },
  },
  terrain_types: ["beach", "water", "plains"],
  gathering_spots: [
    {
      id: "gather_shellfish_beds",
      name: "Shellfish Beds",
      tile: { x: 6, y: 21 },
      respawn_cycles: 3,
    },
    {
      id: "gather_driftwood_line",
      name: "Driftwood Line",
      tile: { x: 3, y: 19 },
      respawn_cycles: 5,
    },
    {
      id: "gather_tidepool_glass",
      name: "Tide-pool Glass",
      tile: { x: 9, y: 22 },
      respawn_cycles: 12,
    },
  ],
  hazards: [
    {
      id: "hazard_storm_surge",
      name: "Storm Surge",
      description:
        "Coastal storms flood interior tiles up to 3 rows deep; NPCs without canSwim capability get stuck until the water recedes.",
      severity: "major",
    },
    {
      id: "hazard_riptide",
      name: "Riptide",
      description:
        "Narrow shore channels pull swimmers out toward deeper water; fast-moving NPCs lose footing more easily.",
      severity: "minor",
    },
  ],
  resident_npc_ids: [],
  quest_hook_ids: [],
  faction_home_ids: ["faction_opportunists"],
  unlock: { kind: "always", params: {} },
  neighbors: ["region_the_deepening", "region_gull_cove"],
  tags: ["coastal", "foraging", "opportunist_lane", "storm_exposure"],
};
