// Wyn's Ember Spring quest — migrates the v8.4 canonical quest_key
// 'ember_inspection' into the new Quest schema. Exemplar for Quad B
// first-batch authoring. Rooted in Content Bible §2 (the Source), §4
// (faction_architects), §5 (scholar-family quest giver).

import type { Quest } from "../../game/quests/questTypes";

export const quest_tending_the_ember_spring: Quest = {
  id: "quest_tending_the_ember_spring",
  schema_version: 1,
  category: "faction",
  title: "Tending the Ember Spring",
  summary:
    "The Ember Spring runs shallow. Wyn cannot leave the carvings half-read; walk to the spring, draw three flasks of its water, and bring them back to her before dusk.",
  giver_npc_id: "npc_wyn_inland_marker",
  region_id: "region_the_deepening",
  faction_id: "faction_architects",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 10 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_wyn_inland_marker", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_wyn",
      kind: "talk_to_npc",
      target: { npc_id: "npc_wyn_inland_marker" },
      count: 1,
      hidden: false,
      description:
        "Speak with Wyn at the Council hearth — she has a task for a careful walker.",
    },
    {
      id: "obj_reach_ember_spring",
      kind: "reach_tile",
      target: { x: 18, y: 11, region_id: "region_the_deepening" },
      count: 1,
      hidden: false,
      description: "Walk the spring-path to the Ember Spring itself.",
    },
    {
      id: "obj_gather_ember_water",
      kind: "gather_item",
      target: { item_id: "item_ember_water" },
      count: 3,
      hidden: false,
      description:
        "Draw three flasks of Ember Spring water. Do not rush — rushed water tastes of iron.",
    },
    {
      id: "obj_deliver_to_wyn",
      kind: "deliver_item",
      target: {
        npc_id: "npc_wyn_inland_marker",
        item_id: "item_ember_water",
        qty: 3,
      },
      count: 1,
      hidden: false,
      description: "Return to Wyn and hand over the three flasks before dusk.",
    },
  ],
  choices: [
    {
      at_objective: "obj_gather_ember_water",
      options: [
        {
          id: "choice_draw_reverently",
          label:
            "Draw each flask slowly, murmuring the older-tongue blessing Wyn half-taught me.",
          moral_weight: 0.4,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_architects", delta: 8 },
            },
            {
              kind: "flavor_only",
              params: {
                text: "The spring runs a little clearer after the third flask. Wyn will notice, even if you never mention it.",
              },
            },
          ],
        },
        {
          id: "choice_draw_quickly",
          label:
            "Draw all three in a hurry — dusk is closing, and the walk back is long.",
          moral_weight: -0.1,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [],
        },
        {
          id: "choice_take_an_extra_flask",
          label:
            "Fill a fourth flask for yourself. The Spring is generous today.",
          moral_weight: -0.5,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            { kind: "item", params: { item_id: "item_ember_water", qty: 1 } },
            {
              kind: "flavor_only",
              params: {
                text: "Wyn's eyes find yours when you return. She says nothing. She knows.",
              },
            },
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_architects", delta: -4 },
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    { kind: "item", params: { item_id: "item_ember_flask", qty: 1 } },
    { kind: "skill_xp", params: { skill: "scholar", amount: 25 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_architects", delta: 10 },
    },
  ],
  repeatable: false,
  tags: [
    "ember_inspection",
    "wyn",
    "architect_lane",
    "source_tied",
    "foundation_batch",
  ],
};
