// Second canonical carving. Bible ref: "[24,11] C11" — the eastern marker.

import type { DiscoverySite } from "../../game/archaeology/carvingTypes";

export const site_carving_inland_marker: DiscoverySite = {
  id: "site_carving_inland_marker",
  schema_version: 1,
  title: "The Inland Marker",
  kind: "carving",
  region_id: "region_the_deepening",
  tile: { x: 24, y: 11 },
  lore_text:
    'An upright slab marked with three horizontal glyph-bands. Saela catalogues it as pre-Source "voice-of-two" pictography — dual-tongue script where the top band reads left-to-right and the bottom band right-to-left. The middle band remains undeciphered; Wyn is certain it names a direction, though neither north nor south.',
  reveals_item_id: "item_field_carving_fragment",
  reveal_chance: 0.6,
  reveal_condition: { kind: "always", params: {} },
  one_shot: true,
  tags: [
    "carving",
    "deepening",
    "second_catalogued",
    "saela_catalogued",
    "dual_tongue",
  ],
};
