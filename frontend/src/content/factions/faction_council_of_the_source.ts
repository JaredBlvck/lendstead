// faction_council_of_the_source. Per Content Bible v1.
// Keepers of the Source - the lawful faction aligned with the camp's founding charter.
// Stub depth only; full questline to be authored by Quad B in later batches.

import type { Faction } from '../../game/world/factions';

export const faction_council_of_the_source: Faction = {
  id: 'faction_council_of_the_source',
  schema_version: 1,
  name: 'Council of the Source',
  philosophy:
    'The Source binds us all. Keep the charter, keep the hearth, keep the count.',
  allies: ['faction_architects'],
  enemies: ['faction_opportunists'],
  tier_rewards: [
    { tier: 'hated', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'hostile', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'wary', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'neutral', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'liked', unlocks_region_ids: [], shop_discount: 0.05, unlocks_quest_ids: [] },
    { tier: 'trusted', unlocks_region_ids: [], shop_discount: 0.1, unlocks_quest_ids: [] },
    { tier: 'revered', unlocks_region_ids: [], shop_discount: 0.15, unlocks_quest_ids: [] },
  ],
  questline_ids: [],
  moral_tension:
    'The Council will uphold the charter even when the charter is wrong. Their discipline has saved the camp and also doomed individuals.',
  world_state_impact:
    'Settlement level progression beyond first_village requires Council standing at trusted or higher.',
  tags: ['council', 'lawful', 'charter'],
};
