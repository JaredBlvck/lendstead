// First of the three canonical carvings. Bible §2 ref: "3 ancient carvings
// catalogued ([24,11] C11, [14,10] C20)." This is the spiral one at [14,10].

import type { DiscoverySite } from "../../game/archaeology/carvingTypes";

export const site_carving_deepening_spiral: DiscoverySite = {
  id: "site_carving_deepening_spiral",
  schema_version: 1,
  title: "The Deepening Spiral",
  kind: "carving",
  region_id: "region_the_deepening",
  tile: { x: 14, y: 10 },
  lore_text:
    'A tight inward spiral carved around a central well. The glyphs along the outer arc form a chain Wyn has partially translated as "walk once around a question, then walk again more slowly, then sit."',
  reveals_item_id: "item_field_carving_fragment",
  reveal_chance: 0.65,
  reveal_condition: { kind: "always", params: {} },
  one_shot: true,
  tags: ["carving", "deepening", "first_catalogued", "wyn_translated"],
};
