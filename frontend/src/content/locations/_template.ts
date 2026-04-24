// SAMPLE REGION TEMPLATE for Quad B to clone.
// Regions describe named territories: bounds, terrain, NPCs who live there,
// gathering spots, hazards, unlock rules. Quests, NPCs, and drop tables
// must point at registered region ids.

import type { Region } from '../../game/world/regions';

export const region_template_founding_shore: Region = {
  id: 'region_template_founding_shore',
  schema_version: 1,
  name: 'Founding Shore',
  summary: 'The first beachhead. Where the Founders washed up and built the camp.',
  description:
    'A crescent of storm-smoothed sand backed by low plains. Saltwind carries from the west. The camp hearth is here; every story in Lendstead starts on this shore. Safe during the day, lonely at night.',
  tile_bounds: {
    min: { x: 14, y: 10 },
    max: { x: 28, y: 18 },
  },
  terrain_types: ['beach', 'plains'],
  gathering_spots: [
    {
      id: 'gather_driftwood_beach',
      name: 'Driftwood piles',
      tile: { x: 17, y: 11 },
      drop_table_id: undefined,
      respawn_cycles: 3,
    },
  ],
  hazards: [
    {
      id: 'hazard_cold_tide',
      name: 'Cold Tide',
      description: 'When the tide turns cold, unshod visitors risk frostbite.',
      severity: 'minor',
    },
  ],
  resident_npc_ids: ['npc_template_giver'],
  quest_hook_ids: ['quest_template_do_not_ship'],
  faction_home_ids: [],
  unlock: { kind: 'always', params: {} },
  neighbors: [],
  tags: ['intro', 'template', 'early_game'],
};
