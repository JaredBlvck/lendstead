// The canonical Founding Shore region. Every new player starts here.
// Home to the first NPCs the player meets.

import type { Region } from '../../game/world/regions';

export const region_founding_shore: Region = {
  id: 'region_founding_shore',
  schema_version: 1,
  name: 'Founding Shore',
  summary:
    'Where the Founders landed and built the first hearth. The cradle of every Lendstead story.',
  description:
    'A crescent beach backed by low plains. The camp hearth smokes at its center. The shore is safe but porous, and the wind carries more than salt after dark.',
  tile_bounds: {
    min: { x: 14, y: 10 },
    max: { x: 28, y: 18 },
  },
  terrain_types: ['beach', 'plains'],
  gathering_spots: [
    {
      id: 'gather_driftwood_pile',
      name: 'Driftwood piles',
      tile: { x: 17, y: 11 },
      respawn_cycles: 3,
    },
    {
      id: 'gather_saltgrass_patch',
      name: 'Saltgrass patch',
      tile: { x: 21, y: 15 },
      respawn_cycles: 4,
    },
  ],
  hazards: [
    {
      id: 'hazard_cold_tide',
      name: 'Cold Tide',
      description: 'Unshod visitors risk frostbite when the tide turns cold.',
      severity: 'minor',
    },
  ],
  resident_npc_ids: [],
  quest_hook_ids: [],
  faction_home_ids: [],
  unlock: { kind: 'always', params: {} },
  neighbors: ['region_the_deepening'],
  tags: ['starter', 'coast'],
};
