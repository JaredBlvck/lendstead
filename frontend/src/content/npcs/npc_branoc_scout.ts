// Branoc — scout, north perimeter specialist. Bible canon (§7 names).
// Live-sim signal: appears in 2 of 3 recent argument events — has an
// ongoing friction with Neve + Mirren that reads as a real social arc.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_branoc_scout: Npc = {
  id: "npc_branoc_scout",
  schema_version: 1,
  name: "Branoc",
  role: "scout",
  faction_id: "faction_opportunists",
  home_region_id: "region_ironback_ridge",
  home_location: { x: 22, y: 3 },
  personality: "wary, quick to argue, rarely wrong when he doesn't shout",
  dialogue_style:
    "clipped observations, uses directional shorthand (north-ridge, crag-face) instead of proper names",
  schedule: [
    {
      phase: "dawn",
      location_id: "region_ironback_ridge",
      activity: "north_watch",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "region_ironback_ridge",
      activity: "scout_ridge",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "poi_watchfire",
      activity: "report",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "poi_council_hearth",
      activity: "eat_alone",
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
    { target_id: "npc_wyn_inland_marker", kind: "student", strength: 0.5 },
    { target_id: "npc_neve_organizer", kind: "rival", strength: -0.4 },
    { target_id: "faction_opportunists", kind: "faction_ally", strength: 0.75 },
  ],
  quest_hooks: ["quest_the_north_watch"],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "You walked up from the south. Loud. If the ridge had a predator on it today you'd already be a warning.",
      sets_memory_flag: "met_branoc",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_north_watch",
      state: "quest_available",
      text: "Ridge has been quiet two cycles. Too quiet. I need eyes at the far cairn overnight — something is moving up there, or nothing is, and I need to know which. Take the watch post.",
      triggers_quest_id: "quest_the_north_watch",
      weight: 1,
    },
    {
      id: "line_quest_active_north_watch",
      state: "quest_active",
      text: "Keep low at the cairn. Sound travels up the saddle. If a shape crosses the moonlight, I want the count and direction, not bravery.",
      weight: 1,
    },
    {
      id: "line_quest_completed_north_watch",
      state: "quest_completed",
      text: "Clean watch. You counted right. The ridge is clear — for now. I'll speak well of you at the next muster. That's rare from me.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "Off my ridge.",
      weight: 1,
    },
  ],
  shop_inventory: [],
  secrets: [
    {
      id: "secret_branoc_long_winter_debt",
      text: "Branoc was saved by Iwen's apprentice in the Long Winter — the same apprentice Neve lost. His rivalry with Neve is grief on both sides; neither of them can name it out loud.",
      unlock_condition: "memory:branoc_trusted_deeply",
    },
  ],
  personal_goals: [
    {
      id: "goal_perimeter_clean",
      text: "Keep the north perimeter clear until the next full moon without a missed sighting.",
      progress_flag: "perimeter_clean_streak_30",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: ["scout_family", "opportunist_lane", "north_watch", "rival_neve"],
};
