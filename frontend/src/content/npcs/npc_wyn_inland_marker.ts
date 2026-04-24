// Wyn — inland marker / scholar-family, custodian of the Ember Spring.
// Established character in Lendstead canon (Content Bible §7 names, §5 roles).
// Has organically become the village's master teacher through the sim —
// multiple apprentices (Bree, Bren, Oren) at friendly+ affinity tier.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_wyn_inland_marker: Npc = {
  id: "npc_wyn_inland_marker",
  schema_version: 1,
  name: "Wyn",
  role: "inland marker",
  faction_id: "faction_architects",
  home_region_id: "region_the_deepening",
  home_location: { x: 18, y: 11 },
  personality: "patient, observant, quietly devout to the Source",
  dialogue_style:
    "measured, uses terrain metaphors, answers questions with questions",
  schedule: [
    {
      phase: "dawn",
      location_id: "poi_ember_spring",
      activity: "tend_spring",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "region_the_deepening",
      activity: "mark_paths",
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
      activity: "study_carvings",
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
    { target_id: "npc_bree_scout", kind: "student", strength: 0.9 },
    { target_id: "npc_bren_scout_apprentice", kind: "student", strength: 0.75 },
    { target_id: "npc_oren_prospector", kind: "student", strength: 0.6 },
    { target_id: "faction_architects", kind: "faction_ally", strength: 0.9 },
  ],
  quest_hooks: [
    "quest_tending_the_ember_spring",
    "quest_the_inland_corridor_hypothesis",
  ],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "You walk well for someone new to this ground. The Deepening rewards patience. State your purpose.",
      sets_memory_flag: "met_wyn",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_ember",
      state: "quest_available",
      text: "The Ember Spring runs shallow this moon. Something has shifted in the water — I cannot leave the carvings half-read. Would you walk the spring-path and bring me back three flasks of its water?",
      triggers_quest_id: "quest_tending_the_ember_spring",
      weight: 1,
    },
    {
      id: "line_quest_active_ember",
      state: "quest_active",
      text: "The spring waits. Walk softly. Water that is rushed tastes of iron.",
      weight: 1,
    },
    {
      id: "line_quest_completed_ember",
      state: "quest_completed",
      text: "Three flasks, held gently. The Source ran cleaner than I feared — but ran shallow all the same. You have the patience of a scholar even if you walk like a scout. Keep the flask.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_teach_open",
      state: "quest_active",
      text: "You came at the right hour. If you would sit, I can show you how the marks on the carving-stones speak — the pattern repeats across two millennia of hands.",
      requires_reputation_at_least: 0.4,
      weight: 0.5,
    },
    {
      id: "line_faction_respected",
      state: "faction_respected",
      text: "The Architects remember those who walked their ground with care. You are known to us now.",
      requires_reputation_at_least: 0.6,
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "Walk away. The Deepening is not a place for unkept promises.",
      weight: 1,
    },
  ],
  shop_inventory: [
    {
      item_id: "item_ember_flask",
      stock_qty: 3,
      sell_price: 45,
      buy_price: 15,
      restocks_every_cycles: 12,
    },
    {
      item_id: "item_medicinal_herb_bundle",
      stock_qty: 8,
      sell_price: 6,
      buy_price: 2,
      restocks_every_cycles: 4,
    },
  ],
  secrets: [
    {
      id: "secret_wyn_remembers_the_long_winter",
      text: "Wyn was the first to name the Ember Spring after the Long Winter. Her memory of that season is sharper than most survivors allow themselves; she carries it because someone must.",
      unlock_condition: "memory:wyn_trusted_deeply",
    },
    {
      id: "secret_wyn_source_sensitivity",
      text: "Wyn can feel Source casts before they happen — a pressure behind her eyes when a ruler reaches for ability. She has not told the rulers this. She is unsure whether it is a gift or a warning.",
      unlock_condition: "quest_complete:quest_the_inland_corridor_hypothesis",
    },
  ],
  personal_goals: [
    {
      id: "goal_decipher_carvings",
      text: "Complete the translation of the three ancient carvings before another Long Winter arrives.",
      progress_flag: "carvings_fully_read",
    },
    {
      id: "goal_three_apprentices",
      text: "Raise three apprentices to skill 7 before retiring as marker.",
      progress_flag: "three_apprentices_graduated",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: ["elder", "mentor", "scholar_family", "architect_lane", "custodian"],
};
