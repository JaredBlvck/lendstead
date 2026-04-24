// faction_architects. Scholar-family of the Deepening. They read carvings,
// tend the Ember Spring, and teach the young to listen before acting.
// Per Content Bible v1.

import type { Faction } from '../../game/world/factions';

export const faction_architects: Faction = {
  id: 'faction_architects',
  schema_version: 1,
  name: 'The Architects',
  philosophy:
    'The carvings remember what the camp forgets. We read, we record, we do not rush. Act only when the stone has spoken.',
  leader_npc_id: 'npc_wyn_inland_marker',
  allies: ['faction_council_of_the_source'],
  enemies: ['faction_opportunists'],
  home_region_id: 'region_the_deepening',
  tier_rewards: [
    { tier: 'hated', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'hostile', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'wary', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    { tier: 'neutral', unlocks_region_ids: [], shop_discount: 0, unlocks_quest_ids: [] },
    {
      tier: 'liked',
      unlocks_region_ids: [],
      shop_discount: 0.05,
      unlocks_quest_ids: ['quest_tending_the_ember_spring'],
    },
    {
      tier: 'trusted',
      unlocks_region_ids: [],
      shop_discount: 0.1,
      unlocks_quest_ids: ['quest_the_medicinal_sweep'],
    },
    {
      tier: 'revered',
      unlocks_region_ids: [],
      shop_discount: 0.2,
      unlocks_quest_ids: [],
    },
  ],
  questline_ids: ['quest_tending_the_ember_spring', 'quest_the_medicinal_sweep'],
  moral_tension:
    'The Architects will let a camp member die of fever rather than break a reading ritual. Patience or cruelty, depending who you ask.',
  world_state_impact:
    'Ember Spring maintenance stops if Architects turn hostile. Dry-streak morale drops hit harder without their rituals.',
  tags: ['scholar', 'deepening', 'council_aligned'],
};
