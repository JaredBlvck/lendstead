// Kestrel — senior scout, marker-stone specialist. Bible canon.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_kestrel_scout: Npc = {
  id: "npc_kestrel_scout",
  schema_version: 1,
  name: "Kestrel",
  role: "scout",
  faction_id: "faction_opportunists",
  home_region_id: "region_the_deepening",
  home_location: { x: 15, y: 10 },
  personality: "watchful, soft-spoken, sees detail others miss",
  dialogue_style:
    "almost-whisper, points rather than names, slow to start but precise",
  schedule: [
    {
      phase: "dawn",
      location_id: "region_the_deepening",
      activity: "check_markers",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "region_the_deepening",
      activity: "patrol",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "poi_watchfire",
      activity: "rest",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "region_the_tidefast",
      activity: "shore_sweep",
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
    { target_id: "npc_wyn_inland_marker", kind: "student", strength: 0.45 },
    { target_id: "npc_branoc_scout", kind: "rival", strength: -0.2 },
    { target_id: "faction_opportunists", kind: "faction_ally", strength: 0.82 },
  ],
  quest_hooks: ["quest_the_lost_marker"],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "Quiet walker. Good. Most people announce themselves three tiles out.",
      sets_memory_flag: "met_kestrel",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_lost_marker",
      state: "quest_available",
      text: "One of Wyn's marker-stones is missing from the ridge path. Could be storm-knocked, could be moved on purpose. I need someone to walk the path and find where it fell. Not difficult — just patient.",
      triggers_quest_id: "quest_the_lost_marker",
      weight: 1,
    },
    {
      id: "line_quest_active_lost_marker",
      state: "quest_active",
      text: "Check the low tiles first. Things that fall almost always land where the ground dips.",
      weight: 1,
    },
    {
      id: "line_quest_completed_lost_marker",
      state: "quest_completed",
      text: "You found it. And you put it back upright. Wyn will know because the path-song will sound right again at dawn. She might not say anything — she does that. But she'll know.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "Don't walk my ridge.",
      weight: 1,
    },
  ],
  shop_inventory: [],
  secrets: [
    {
      id: "secret_kestrel_watches_wyn",
      text: "Kestrel quietly tracks Wyn's carving-reading progress. She is the only scout who believes Wyn will finish the translations before another Long Winter.",
      unlock_condition: "memory:kestrel_trusted_deeply",
    },
  ],
  personal_goals: [
    {
      id: "goal_replace_every_marker",
      text: "Replace every storm-knocked marker on the ridge path within 3 cycles of it falling.",
      progress_flag: "marker_discipline_kept",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: ["scout_family", "opportunist_lane", "marker_path", "quiet_specialist"],
};
