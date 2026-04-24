// Oren's follow-up to the deepening_vein quest. Migrates v8.4 canonical
// 'second_seam'. Uses defeat_enemy objective kind (PR #9 closure).

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_second_seam_hypothesis: Quest = {
  id: "quest_the_second_seam_hypothesis",
  schema_version: 1,
  category: "mystery",
  title: "The Second Seam Hypothesis",
  summary:
    "Oren suspects ore veins #3 and #4 are the same seam, kinked where the ridge buckled. Follow the line, deal with anything that's been keeping prospectors from walking it, and bring back a chunk from the second seam for Harlan to lap against the first.",
  giver_npc_id: "npc_oren_prospector",
  region_id: "region_the_deepening",
  faction_id: "faction_architects",
  prerequisites: [
    {
      kind: "completed_quest",
      params: { quest_id: "quest_the_deepening_vein" },
    },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_oren_prospector", skill: 6 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_oren",
      kind: "talk_to_npc",
      target: { npc_id: "npc_oren_prospector" },
      count: 1,
      hidden: false,
      description:
        "Meet Oren — he'll walk you as far as the marker-stones, then send you on alone.",
    },
    {
      id: "obj_reach_vein_three_approach",
      kind: "reach_tile",
      target: { x: 18, y: 10, region_id: "region_the_deepening" },
      count: 1,
      hidden: false,
      description: "Walk the ridge to the approach of ore vein #3.",
    },
    {
      id: "obj_clear_the_path",
      kind: "defeat_enemy",
      target: { archetype: "predator" },
      count: 1,
      hidden: false,
      description:
        "The path has been hunted for two cycles. Clear whatever is keeping prospectors from walking it.",
    },
    {
      id: "obj_gather_second_seam_ore",
      kind: "gather_item",
      target: { item_id: "item_raw_ore_chunk" },
      count: 1,
      hidden: false,
      description:
        "Extract a single ore chunk from the second seam — quality matters more than quantity here.",
    },
    {
      id: "obj_deliver_to_oren",
      kind: "deliver_item",
      target: {
        npc_id: "npc_oren_prospector",
        item_id: "item_raw_ore_chunk",
        qty: 1,
      },
      count: 1,
      hidden: false,
      description:
        "Return the chunk to Oren — he'll lap it against one from vein #3 and see if they ring the same note.",
    },
  ],
  choices: [
    {
      at_objective: "obj_deliver_to_oren",
      options: [
        {
          id: "choice_same_seam",
          label: "Same ring. Same seam. Hypothesis confirmed.",
          moral_weight: 0.2,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "flavor_only",
              params: {
                text: 'Oren sets the two chunks side by side and closes his eyes. "Thirty years I walked past this without hearing it. Thank you for hearing it with me."',
              },
            },
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_architects", delta: 8 },
            },
          ],
        },
        {
          id: "choice_different_seam",
          label: "Different ring. They are different veins. Lore stays intact.",
          moral_weight: 0.0,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "flavor_only",
              params: {
                text: 'Oren laughs quietly. "Thirty years of guessing right, then. Good. The island is still bigger than my ear."',
              },
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    { kind: "item", params: { item_id: "item_ember_flask", qty: 1 } },
    { kind: "skill_xp", params: { skill: "prospecting", amount: 60 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_architects", delta: 15 },
    },
  ],
  repeatable: false,
  tags: [
    "second_seam",
    "oren",
    "architect_lane",
    "prospector_family",
    "mystery",
    "combat_objective",
    "defeat_enemy_exercise",
  ],
};
