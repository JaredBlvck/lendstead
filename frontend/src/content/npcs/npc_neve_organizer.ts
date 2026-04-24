// Neve — organizer, labor coordinator for the Council of the Source. Bible
// canon. In the live sim she's crossed 'acquainted' affinity with multiple
// scout-family apprentices through teach interactions.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_neve_organizer: Npc = {
  id: "npc_neve_organizer",
  schema_version: 1,
  name: "Neve",
  role: "organizer",
  faction_id: "faction_council_of_the_source",
  home_region_id: "region_the_deepening",
  home_location: { x: 17, y: 12 },
  personality: "attentive, brisk, counts everyone twice out of habit",
  dialogue_style:
    "crisp sentences, always says people's names, rarely smiles until she knows you",
  schedule: [
    {
      phase: "dawn",
      location_id: "poi_council_hearth",
      activity: "morning_muster",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "region_the_deepening",
      activity: "walk_the_lane",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "poi_council_hearth",
      activity: "teach",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "poi_council_hearth",
      activity: "evening_roll_call",
      duration_phases: 1,
    },
    {
      phase: "night",
      location_id: "poi_council_hearth",
      activity: "sleep",
      duration_phases: 1,
    },
  ],
  relationships: [
    { target_id: "npc_iwen_healer", kind: "friend", strength: 0.55 },
    { target_id: "npc_tavin_scout", kind: "student", strength: 0.4 },
    { target_id: "npc_bree_scout", kind: "student", strength: 0.35 },
    {
      target_id: "faction_council_of_the_source",
      kind: "faction_ally",
      strength: 0.9,
    },
    { target_id: "faction_architects", kind: "faction_ally", strength: 0.45 },
    { target_id: "faction_opportunists", kind: "faction_ally", strength: 0.45 },
  ],
  quest_hooks: ["quest_the_roster_review"],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "New face. Name? Role? I'll find work that suits the answer.",
      sets_memory_flag: "met_neve",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_roster",
      state: "quest_available",
      text: "I haven't done a full roster walk in three cycles. Walk the camp with me — I'll point, you confirm each name, and we'll catch anyone I've been missing. Small thing. Takes a day. I'll owe you.",
      triggers_quest_id: "quest_the_roster_review",
      weight: 1,
    },
    {
      id: "line_quest_active_roster",
      state: "quest_active",
      text: "Keep counting. If someone's not where they should be, I want to know why today, not next moon.",
      weight: 1,
    },
    {
      id: "line_quest_completed_roster",
      state: "quest_completed",
      text: "Thirty-six confirmed. That's the first clean count I've had in a season. Thank you — precisely. You've earned a favor from me.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_faction_respected",
      state: "faction_respected",
      text: "The Council keeps names. I keep yours with care.",
      requires_reputation_at_least: 0.6,
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "Move along. My roster doesn't list trouble by choice.",
      weight: 1,
    },
  ],
  shop_inventory: [],
  secrets: [
    {
      id: "secret_neve_sister_lost_to_frost_hollow",
      text: "Neve's older sister was Iwen's apprentice — lost in the Frost-Hollow storm. Neve keeps counting names because letting one slip is a weight she cannot carry twice.",
      unlock_condition: "memory:neve_trusted_deeply",
    },
  ],
  personal_goals: [
    {
      id: "goal_no_name_slipping",
      text: "Do a roster walk every 5 cycles without fail.",
      progress_flag: "roster_discipline_kept",
    },
    {
      id: "goal_bridge_the_lanes",
      text: "Hold enough respect from both Architects and Opportunists that neither feels under-counted.",
      progress_flag: "lanes_bridged",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: [
    "organizer_family",
    "council_of_the_source",
    "lane_bridge",
    "meticulous",
  ],
};
