// SAMPLE FACTION TEMPLATE for Quad B to clone.
// Factions own philosophy, tier rewards, questlines, and moral tension.
// Quests and NPCs reference faction_id; that id must resolve to a
// registered faction.

import type { Faction } from '../../game/world/factions';

export const faction_template_founders: Faction = {
  id: 'faction_template_founders',
  schema_version: 1,
  name: 'The Founders',
  philosophy: 'Survive, then record. The camp must outlast its founders.',
  leader_npc_id: 'npc_template_giver',
  allies: [],
  enemies: [],
  home_region_id: 'region_founding_shore',
  tier_rewards: [
    {
      tier: 'neutral',
      unlocks_region_ids: [],
      shop_discount: 0,
      unlocks_quest_ids: [],
    },
    {
      tier: 'trusted',
      unlocks_region_ids: ['region_the_deepening'],
      shop_discount: 0.05,
      unlocks_quest_ids: [],
    },
  ],
  questline_ids: ['quest_template_do_not_ship'],
  moral_tension:
    'They chose memory over survival in the third winter and lost half the camp. Some still think they were right.',
  world_state_impact:
    'Settlement level progression is gated behind Founders rep. If they break, the camp loses its hearth keeper.',
  tags: ['template', 'founders', 'intro'],
};
