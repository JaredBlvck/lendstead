// Third carving — Saela's hypothesis made canon. Ironback Ridge, smaller
// than the first two, longer glyph-chain (hence Long Fragment drop).

import type { DiscoverySite } from "../../game/archaeology/carvingTypes";

export const site_carving_ironback_glyphs: DiscoverySite = {
  id: "site_carving_ironback_glyphs",
  schema_version: 1,
  title: "The Ironback Glyphs",
  kind: "carving",
  region_id: "region_ironback_ridge",
  tile: { x: 22, y: 4 },
  lore_text:
    'The third carving — smaller than the Deepening two and set into a saddle-crest overlook. Wind across it produces a low hum Saela first noticed on a patrol three cycles running. The glyph-chain is longer than either Deepening carving: a single continuous line that, held up to the Ember Spring at dawn, runs warm against the palm. Confirms Saela\'s "three-voiced island" hypothesis.',
  reveals_item_id: "item_long_carving_fragment",
  reveal_chance: 0.5,
  reveal_condition: { kind: "always", params: {} },
  one_shot: true,
  tags: [
    "carving",
    "ironback_ridge",
    "third_catalogued",
    "saela_hypothesis",
    "long_fragment",
    "source_warm",
  ],
};
