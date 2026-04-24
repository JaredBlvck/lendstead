// SAMPLE DISCOVERY SITE TEMPLATE. Quad B clones this into non-underscore
// files in /src/content/locations/ (same folder as regions - Regions and
// DiscoverySites are both location-kind content). Content loader picks
// up any file not starting with _ and routes exports by id prefix.
//
// Discovery sites surface archaeology lore and grant a fragment item on
// successful inspect. The collect_carving objective kind auto-advances
// when sites of kind='carving' are revealed.

import type { DiscoverySite } from '../../game/archaeology/carvingTypes';

export const site_template_marker_stone: DiscoverySite = {
  id: 'site_template_marker_stone',
  schema_version: 1,
  title: 'The Marker Stone (template)',
  kind: 'carving',
  region_id: 'region_the_deepening',
  tile: { x: 15, y: 10 },
  lore_text:
    'Weather-worn glyphs spiral around a central spiral. The outer ring spells an older name for the Deepening.',
  reveals_item_id: 'item_template_flint',   // placeholder; real carvings emit item_carving_fragment_*
  reveal_chance: 0.75,
  reveal_condition: { kind: 'always', params: {} },
  one_shot: true,
  tags: ['template', 'carving', 'deepening'],
};
