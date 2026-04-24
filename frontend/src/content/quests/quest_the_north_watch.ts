// Branoc's perimeter watch. Migrates v8.4 canonical quest_key 'north_watch'.
// Uses survive_event objective kind against threat_sighted events.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_north_watch: Quest = {
  id: "quest_the_north_watch",
  schema_version: 1,
  category: "exploration",
  title: "The North Watch",
  summary:
    "Branoc needs eyes at the far cairn overnight. Take the watch post on the ridge, observe whatever crosses the moonlight, and report the count + direction at morning muster.",
  giver_npc_id: "npc_branoc_scout",
  region_id: "region_ironback_ridge",
  faction_id: "faction_opportunists",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 6 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_branoc_scout", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_branoc",
      kind: "talk_to_npc",
      target: { npc_id: "npc_branoc_scout" },
      count: 1,
      hidden: false,
      description:
        "Speak with Branoc at the watchfire — he has a specific perch in mind.",
    },
    {
      id: "obj_reach_far_cairn",
      kind: "reach_tile",
      target: { x: 14, y: 2, region_id: "region_ironback_ridge" },
      count: 1,
      hidden: false,
      description:
        "Walk to the far cairn on the north ridge. Stay low approaching.",
    },
    {
      id: "obj_witness_threat",
      kind: "survive_event",
      target: { event_kind: "threat_sighted" },
      count: 1,
      hidden: false,
      description:
        "Hold the watch until the ridge tells you what it's hiding — watch for a threat-sighted event while on station.",
    },
    {
      id: "obj_report_back",
      kind: "talk_to_npc",
      target: { npc_id: "npc_branoc_scout" },
      count: 1,
      hidden: false,
      description: "Return to Branoc at morning muster with what you saw.",
    },
  ],
  choices: [
    {
      at_objective: "obj_witness_threat",
      options: [
        {
          id: "choice_report_quietly",
          label: "Count, note direction, withdraw without engaging.",
          moral_weight: 0.3,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_opportunists", delta: 6 },
            },
            {
              kind: "flavor_only",
              params: {
                text: 'Branoc grunts approval when you describe the angle — "right call, kept the cairn unknown."',
              },
            },
          ],
        },
        {
          id: "choice_confront",
          label: "Shout to drive the threat off before it crosses the saddle.",
          moral_weight: -0.2,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "flavor_only",
              params: {
                text: "The threat scatters but now knows a watch stands at the cairn. Future threat_sighted rolls may favor a different approach.",
              },
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    { kind: "skill_xp", params: { skill: "scouting", amount: 35 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_opportunists", delta: 12 },
    },
  ],
  repeatable: true,
  tags: [
    "north_watch",
    "branoc",
    "opportunist_lane",
    "scout_family",
    "exploration",
  ],
};
