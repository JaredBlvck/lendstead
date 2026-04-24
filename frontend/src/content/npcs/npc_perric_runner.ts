// Perric — runner, long-route logistics. Canonical trade partner of Oren
// (live-sim score 0.78 through sustained trade interactions).

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_perric_runner: Npc = {
  id: "npc_perric_runner",
  schema_version: 1,
  name: "Perric",
  role: "runner",
  faction_id: "faction_opportunists",
  home_region_id: "region_the_deepening",
  home_location: { x: 20, y: 13 },
  personality:
    "energetic, jokes to mask exhaustion, remembers every route by foot-rhythm",
  dialogue_style: "fast talker, skips pronouns, names every landmark he passes",
  schedule: [
    {
      phase: "dawn",
      location_id: "region_the_deepening",
      activity: "load_out",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "region_ironback_ridge",
      activity: "ore_run",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "region_the_tidefast",
      activity: "food_return",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "poi_council_hearth",
      activity: "tally",
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
    { target_id: "npc_oren_prospector", kind: "friend", strength: 0.78 },
    { target_id: "npc_harlan_toolmaker", kind: "friend", strength: 0.55 },
    { target_id: "faction_opportunists", kind: "faction_ally", strength: 0.8 },
  ],
  quest_hooks: ["quest_the_loop_stress_test"],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "New legs! Good. I keep needing someone to run the triangle. Name?",
      sets_memory_flag: "met_perric",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_loop",
      state: "quest_available",
      text: "Three-point loop — Ironback to the shore to the hearth. I've been running it solo and my shins are complaining. Run it with me twice to stress-test the timing, and I'll owe you a full route map.",
      triggers_quest_id: "quest_the_loop_stress_test",
      weight: 1,
    },
    {
      id: "line_quest_active_loop",
      state: "quest_active",
      text: "Keep up! The kilometers lie — Ironback feels closer than it is.",
      weight: 1,
    },
    {
      id: "line_quest_completed_loop",
      state: "quest_completed",
      text: "Two clean loops. My legs hate you a little. My tally says we can cut 20% off the morning run if we stage a cache at the marker-stone. You just made a real difference.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "Not running with you today.",
      weight: 1,
    },
  ],
  shop_inventory: [],
  secrets: [
    {
      id: "secret_perric_shin_splints",
      text: "Perric has hidden shin splints for 30 cycles. He will not stop running because he believes the civilization depends on his routes. He will collapse before he admits it.",
      unlock_condition: "memory:perric_trusted_deeply",
    },
  ],
  personal_goals: [
    {
      id: "goal_cache_the_triangle",
      text: "Establish a supply cache at the marker-stone halfway point to cut routes by 20%.",
      progress_flag: "cache_established",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: ["runner_family", "opportunist_lane", "logistics", "trade_chain_oren"],
};
