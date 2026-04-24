// SAMPLE NPC TEMPLATE for Quad B to clone.

import type { Npc } from '../../game/npcs/npcTypes';

export const npc_template_giver: Npc = {
  id: 'npc_template_giver',
  schema_version: 1,
  name: 'Iolo Reedwake',
  role: 'elder forager',
  faction_id: 'faction_founders',
  home_region_id: 'region_founding_shore',
  home_location: { x: 20, y: 12 },
  personality: 'measured, wry, pragmatic',
  dialogue_style: 'short sentences, marsh metaphors',
  schedule: [
    { phase: 'dawn', location_id: 'poi_camp_hearth', activity: 'wake', duration_phases: 1 },
    { phase: 'morning', location_id: 'region_reedwake_marsh', activity: 'forage', duration_phases: 1 },
    { phase: 'midday', location_id: 'poi_camp_hearth', activity: 'teach', duration_phases: 1 },
    { phase: 'evening', location_id: 'poi_camp_hearth', activity: 'cook', duration_phases: 1 },
    { phase: 'night', location_id: 'poi_camp_hearth', activity: 'sleep', duration_phases: 1 },
  ],
  relationships: [
    { target_id: 'npc_template_apprentice', kind: 'student', strength: 0.6 },
    { target_id: 'faction_black_tide', kind: 'faction_enemy', strength: -0.8 },
  ],
  quest_hooks: ['quest_template_do_not_ship'],
  dialogue_lines: [
    {
      id: 'line_first_hello',
      state: 'first_meeting',
      text: 'First time I\'ve seen that face. You\'ll learn the tides or lose a leg to them.',
      sets_memory_flag: 'met_player',
      sets_dialogue_state: 'neutral',
      weight: 1,
    },
    {
      id: 'line_quest_offer',
      state: 'quest_available',
      text: 'There\'s flint to gather and a camp marker to reach. Come, I\'ll walk you through it.',
      triggers_quest_id: 'quest_template_do_not_ship',
      weight: 1,
    },
    {
      id: 'line_quest_progress',
      state: 'quest_active',
      text: 'Keep at it. The marsh doesn\'t reward half-measures.',
      weight: 1,
    },
    {
      id: 'line_quest_done',
      state: 'quest_completed',
      text: 'That\'s the work. You\'ve earned the name Reedwake in this camp.',
      sets_dialogue_state: 'friendly',
      weight: 1,
    },
    {
      id: 'line_hostile',
      state: 'hostile',
      text: 'Walk the other way. You\'ve burned your welcome.',
      weight: 1,
    },
    {
      id: 'line_faction_respected',
      state: 'faction_respected',
      text: 'You\'ve been good to the Founders. That matters here.',
      requires_reputation_at_least: 0.6,
      weight: 1,
    },
  ],
  shop_inventory: [
    { item_id: 'item_template_flint', stock_qty: 20, sell_price: 3, buy_price: 1, restocks_every_cycles: 3 },
    { item_id: 'item_template_silver_coin', stock_qty: 0, buy_price: 1 },   // buy-only
  ],
  secrets: [
    {
      id: 'secret_ioloa_past',
      text: 'Iolo once served under the Black Tide. She does not speak of it without cause.',
      unlock_condition: 'memory:iolo_trusted_deeply',
    },
  ],
  personal_goals: [
    { id: 'goal_pass_on_craft', text: 'Teach the marsh knife to the next generation.', progress_flag: 'apprentice_graduated' },
  ],
  default_movement_mode: 'patrol',
  default_dialogue_state: 'neutral',
  tags: ['elder', 'mentor', 'founders', 'reedwake'],
};
