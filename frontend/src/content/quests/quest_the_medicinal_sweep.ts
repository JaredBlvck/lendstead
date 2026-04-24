// Iwen's gathering quest. Migrates v8.4 canonical quest_key 'medicinal_sweep'
// into Quest schema. Rooted in Content Bible §2 (the Source — Iwen is a
// healer whose work IS the Source's ground-level expression), §5 (healer
// family giver), §8.1 (3-5 objectives).

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_medicinal_sweep: Quest = {
  id: "quest_the_medicinal_sweep",
  schema_version: 1,
  category: "gathering",
  title: "The Medicinal Sweep",
  summary:
    "The herb cluster runs thin. Iwen asks you to walk the inland corridor, gather six medicinal herb bundles, and return before the light fades. Careless harvesters spoil the stand for a full season.",
  giver_npc_id: "npc_iwen_healer",
  region_id: "region_the_deepening",
  faction_id: "faction_architects",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 5 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_iwen_healer", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_iwen",
      kind: "talk_to_npc",
      target: { npc_id: "npc_iwen_healer" },
      count: 1,
      hidden: false,
      description:
        "Speak with Iwen at the infirmary — she has the herb-stand map in her head.",
    },
    {
      id: "obj_reach_herb_cluster",
      kind: "reach_tile",
      target: { x: 18, y: 11, region_id: "region_the_deepening" },
      count: 1,
      hidden: false,
      description: "Walk to the herb cluster adjacent to the Ember Spring.",
    },
    {
      id: "obj_gather_herb_bundles",
      kind: "gather_item",
      target: { item_id: "item_medicinal_herb_bundle" },
      count: 6,
      hidden: false,
      description:
        "Harvest six bundles. Take only mature stems — the young ones rot before they heal.",
    },
    {
      id: "obj_deliver_to_iwen",
      kind: "deliver_item",
      target: {
        npc_id: "npc_iwen_healer",
        item_id: "item_medicinal_herb_bundle",
        qty: 6,
      },
      count: 1,
      hidden: false,
      description: "Return to Iwen with all six bundles before dusk.",
    },
  ],
  choices: [
    {
      at_objective: "obj_gather_herb_bundles",
      options: [
        {
          id: "choice_careful_harvest",
          label: "Take only mature stems. The cluster will regrow.",
          moral_weight: 0.5,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_architects", delta: 6 },
            },
            {
              kind: "flavor_only",
              params: {
                text: "The cluster looks almost untouched from a step back. Iwen will know you walked with care.",
              },
            },
          ],
        },
        {
          id: "choice_greedy_harvest",
          label:
            "Take every stem worth taking. Iwen will appreciate the full haul.",
          moral_weight: -0.3,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "item",
              params: { item_id: "item_medicinal_herb_bundle", qty: 2 },
            },
            {
              kind: "flavor_only",
              params: {
                text: "You return with eight bundles. The cluster will not produce again until after the next full moon. Iwen thanks you. Her thanks are quieter than you expected.",
              },
            },
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_architects", delta: -3 },
            },
          ],
        },
        {
          id: "choice_share_with_opportunists",
          label:
            "Leave one bundle cached near the eastern perimeter — a scout might need it.",
          moral_weight: 0.3,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_opportunists", delta: 5 },
            },
            {
              kind: "flavor_only",
              params: {
                text: "Two cycles later a scout finds the bundle and speaks of you at the watch-fire. Reputation crosses the lane.",
              },
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    { kind: "item", params: { item_id: "item_iwen_poultice", qty: 3 } },
    { kind: "skill_xp", params: { skill: "healing", amount: 40 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_architects", delta: 12 },
    },
  ],
  repeatable: true,
  tags: [
    "medicinal_sweep",
    "iwen",
    "architect_lane",
    "healer_family",
    "gathering",
    "second_batch",
  ],
};
