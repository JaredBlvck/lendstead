// Perric's route timing quest. Migrates v8.4 canonical 'loop_stress_test'.
// Uses elapsed_cycles + multi-region reach_tile.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_loop_stress_test: Quest = {
  id: "quest_the_loop_stress_test",
  schema_version: 1,
  category: "gathering",
  title: "The Loop Stress Test",
  summary:
    "Perric is running the Ironback-shore-hearth triangle solo and his shins are complaining. Run the three-point loop with him twice to stress-test the timing; he'll owe you a route map.",
  giver_npc_id: "npc_perric_runner",
  region_id: "region_the_deepening",
  faction_id: "faction_opportunists",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 8 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_perric_runner", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_perric",
      kind: "talk_to_npc",
      target: { npc_id: "npc_perric_runner" },
      count: 1,
      hidden: false,
      description:
        "Meet Perric at the load-out spot — he times runs by breath-count.",
    },
    {
      id: "obj_reach_ironback",
      kind: "reach_tile",
      target: { x: 22, y: 3, region_id: "region_ironback_ridge" },
      count: 2,
      hidden: false,
      description: "Run to the Ironback Ridge turnaround twice.",
    },
    {
      id: "obj_reach_shore",
      kind: "reach_tile",
      target: { x: 6, y: 21, region_id: "region_the_tidefast" },
      count: 2,
      hidden: false,
      description: "Run to the Tidefast shellfish beds twice.",
    },
    {
      id: "obj_total_elapsed",
      kind: "elapsed_cycles",
      target: { cycles: 2 },
      count: 1,
      hidden: false,
      description: "Complete both loops across two full cycles.",
    },
    {
      id: "obj_report_back",
      kind: "talk_to_npc",
      target: { npc_id: "npc_perric_runner" },
      count: 1,
      hidden: false,
      description: "Return to Perric — he'll tally the timings.",
    },
  ],
  choices: [],
  rewards: [
    { kind: "skill_xp", params: { skill: "running", amount: 50 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_opportunists", delta: 15 },
    },
  ],
  repeatable: false,
  tags: [
    "loop_stress_test",
    "perric",
    "opportunist_lane",
    "runner_family",
    "gathering",
    "multi_region",
  ],
};
