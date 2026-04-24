// Saela — scout-archaeology. Reads carvings, walks the ridge paths with a
// notebook. Bible canon.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_saela_scout_archaeology: Npc = {
  id: "npc_saela_scout_archaeology",
  schema_version: 1,
  name: "Saela",
  role: "scout-archaeology",
  faction_id: "faction_opportunists",
  home_region_id: "region_ironback_ridge",
  home_location: { x: 24, y: 5 },
  personality:
    "patient, excitable about old things, keeps two notebooks (one public, one private)",
  dialogue_style:
    "asks questions in pairs, cites a date any time she mentions a find, calls carvings by nicknames",
  schedule: [
    {
      phase: "dawn",
      location_id: "region_ironback_ridge",
      activity: "carving_survey",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "region_the_deepening",
      activity: "copy_glyphs",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "poi_council_hearth",
      activity: "compare_with_wyn",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "region_the_deepening",
      activity: "notebook_work",
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
    { target_id: "npc_wyn_inland_marker", kind: "student", strength: 0.6 },
    { target_id: "npc_kestrel_scout", kind: "friend", strength: 0.45 },
    { target_id: "faction_opportunists", kind: "faction_ally", strength: 0.78 },
  ],
  quest_hooks: ["quest_the_third_carving"],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "Walker! Two questions: have you seen a carving? Not sure if it was a carving? Tell me where and I'll name it.",
      sets_memory_flag: "met_saela",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_third_carving",
      state: "quest_available",
      text: "Wyn and I have catalogued two carvings. I believe there's a third — smaller, older, somewhere on the ridge. I've heard the wind at a site three cycles running but never found the stone. Help me walk the ridge and discover it.",
      triggers_quest_id: "quest_the_third_carving",
      weight: 1,
    },
    {
      id: "line_quest_active_third_carving",
      state: "quest_active",
      text: "Listen at the saddle-crests. The old stone hums when wind crosses it right. Touch every tile that sounds wrong — it may be there.",
      weight: 1,
    },
    {
      id: "line_quest_completed_third_carving",
      state: "quest_completed",
      text: "You found it! Third carving confirmed, my hypothesis held — the island was three-voiced, not two. I'm writing it in the public notebook tonight. Wyn will know by dawn. Take the long fragment; it's yours now.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "My notebooks are closed to you.",
      weight: 1,
    },
  ],
  shop_inventory: [],
  secrets: [
    {
      id: "secret_saela_private_notebook",
      text: "Saela's second notebook has sketches of a fourth carving location she hasn't confirmed. She won't write it in the public book until she stands on the stone with her own hand on it.",
      unlock_condition: "quest_complete:quest_the_third_carving",
    },
  ],
  personal_goals: [
    {
      id: "goal_find_fourth",
      text: "Confirm the fourth carving before Wyn finishes her translation of the first.",
      progress_flag: "fourth_carving_confirmed",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: ["scout_family", "opportunist_lane", "archaeology", "wyn_student"],
};
