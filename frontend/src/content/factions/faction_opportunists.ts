// faction_opportunists. Per Content Bible v1.
// The grey-morality faction - takes what the charter will not sanction.
// Enemies of both Architects and Council. Not purely evil; sometimes
// right, always profitable.

import type { Faction } from '../../game/world/factions';

export const faction_opportunists: Faction = {
  id: 'faction_opportunists',
  schema_version: 1,
  name: 'The Opportunists',
  philosophy:
    'Rules bend. Hunger does not. We take the work the others will not, and we remember who owes us.',
  allies: [],
  enemies: ['faction_council_of_the_source', 'faction_architects'],
  tier_rewards: [
    { tier: 'hated', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'hostile', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'wary', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'neutral', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'liked', unlocks_region_ids: [], shop_discount: 0.1, unlocks_quest_ids: [] },
    { tier: 'trusted', unlocks_region_ids: [], shop_discount: 0.2, unlocks_quest_ids: [] },
    { tier: 'revered', unlocks_region_ids: [], shop_discount: 0.3, unlocks_quest_ids: [] },
  ],
  questline_ids: [],
  moral_tension:
    'They feed the hungry the Council will not feed. They also raid the Architects when the camp is out of grain. Both things are true.',
  world_state_impact:
    'High Opportunist rep unlocks faster trade routes but drops Architect + Council rep in lockstep. Two-way street.',
  tags: ['grey_morality', 'trade', 'rival'],
};
