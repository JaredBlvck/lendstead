// SAMPLE DROP TABLE TEMPLATE for Quad B to clone.

import type { DropTable } from '../../game/drops/dropTypes';

export const drop_template_boar: DropTable = {
  id: 'drop_template_boar',
  schema_version: 1,
  source_name: 'Marsh Boar',
  source_type: 'wildlife',
  region_id: 'region_founding_shore',
  guaranteed_drops: [
    { item_id: 'item_template_flint', min_qty: 1, max_qty: 1, weight: 1 },   // placeholder "hide"
  ],
  common_drops: [
    { item_id: 'item_template_flint', min_qty: 2, max_qty: 5, weight: 70 },
    { item_id: 'item_template_silver_coin', min_qty: 3, max_qty: 8, weight: 30 },
  ],
  common_chance: 0.8,
  uncommon_drops: [
    { item_id: 'item_template_silver_coin', min_qty: 20, max_qty: 40, weight: 50 },
    { item_id: 'item_template_reedwake_knife', min_qty: 1, max_qty: 1, weight: 10 },
  ],
  uncommon_chance: 0.18,
  rare_drops: [
    { item_id: 'item_template_reedwake_knife', min_qty: 1, max_qty: 1, weight: 100 },
  ],
  rare_chance: 0.02,
  ultra_rare_drops: [
    { item_id: 'item_template_reedwake_knife', chance: 0.001, min_qty: 1, max_qty: 1 },
  ],
  modifiers: [
    {
      condition: 'quest_complete:quest_template_do_not_ship',
      rare_chance_multiplier: 1.5,
      ultra_rare_chance_multiplier: 2,
      weight_boosts: { item_template_silver_coin: 1.25 },
    },
  ],
  notes: 'Early-game testing table; replace with real authored content.',
};
