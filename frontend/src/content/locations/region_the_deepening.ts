// The Deepening. Scholar-family territory. Where Wyn reads carvings and
// the Ember Spring runs shallow in dry cycles.

import type { Region } from '../../game/world/regions';

export const region_the_deepening: Region = {
  id: 'region_the_deepening',
  schema_version: 1,
  name: 'The Deepening',
  summary: 'A sunken valley of old carvings, mineral springs, and patient silence.',
  description:
    'Cool shadow and damp stone. Ancient carvings lie half-worn along the ridges; the Ember Spring runs shallow in dry cycles. Scholars listen here. Strangers who rush leave with nothing.',
  tile_bounds: {
    min: { x: 12, y: 8 },
    max: { x: 24, y: 14 },
  },
  terrain_types: ['hill', 'forest', 'ruin'],
  gathering_spots: [
    {
      id: 'gather_ember_spring',
      name: 'Ember Spring',
      tile: { x: 18, y: 11 },
      drop_table_id: 'drop_the_deepening_foraging',
      respawn_cycles: 6,
    },
    {
      id: 'gather_carving_rubble',
      name: 'Carving rubble',
      tile: { x: 15, y: 10 },
      drop_table_id: 'drop_the_deepening_foraging',
      respawn_cycles: 8,
    },
  ],
  hazards: [
    {
      id: 'hazard_dry_spring',
      name: 'Dry Spring',
      description: 'During dry streaks the Ember Spring gives iron-tasting water.',
      severity: 'minor',
    },
    {
      id: 'hazard_loose_slate',
      name: 'Loose Slate',
      description: 'Unstable ridge tiles shift underfoot after rain; moving too fast risks a fall.',
      severity: 'major',
    },
  ],
  resident_npc_ids: ['npc_wyn_inland_marker'],
  quest_hook_ids: ['quest_tending_the_ember_spring'],
  faction_home_ids: ['faction_architects'],
  unlock: { kind: 'always', params: {} },
  neighbors: ['region_founding_shore'],
  tags: ['scholar', 'mystery', 'ember_spring'],
};
