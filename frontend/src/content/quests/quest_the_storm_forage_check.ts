// Alda's post-storm shore survey. Migrates v8.4 canonical 'storm_forage_check'.
// Uses survive_event (storm_ended) + gather_item on post-storm shore yields.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_storm_forage_check: Quest = {
  id: "quest_the_storm_forage_check",
  schema_version: 1,
  category: "gathering",
  title: "The Storm Forage Check",
  summary:
    "Storm ran two cycles back and Alda hasn't walked the tide-line. Survey the shellfish beds after the next storm ends and bring back a count.",
  giver_npc_id: "npc_alda_forager_trader",
  region_id: "region_the_tidefast",
  faction_id: "faction_opportunists",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 5 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_alda_forager_trader", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_alda",
      kind: "talk_to_npc",
      target: { npc_id: "npc_alda_forager_trader" },
      count: 1,
      hidden: false,
      description:
        "Meet Alda at the tide-line — she'll describe what she needs counted.",
    },
    {
      id: "obj_survive_storm",
      kind: "survive_event",
      target: { event_kind: "storm_ended" },
      count: 1,
      hidden: false,
      description:
        "Wait out the next storm — shellfish surveys happen only after the surge passes.",
    },
    {
      id: "obj_reach_shellfish_beds",
      kind: "reach_tile",
      target: { x: 6, y: 21, region_id: "region_the_tidefast" },
      count: 1,
      hidden: false,
      description:
        "Walk to the shellfish beds at [6, 21] and note the salt-crust height.",
    },
    {
      id: "obj_gather_sample",
      kind: "gather_item",
      target: { item_id: "item_berry_handful" },
      count: 2,
      hidden: false,
      description:
        "Collect two sample handfuls (placeholder — would be shellfish, reusing common food until that item lands).",
    },
    {
      id: "obj_report_back",
      kind: "talk_to_npc",
      target: { npc_id: "npc_alda_forager_trader" },
      count: 1,
      hidden: false,
      description: "Return to Alda and report the salt-crust reading.",
    },
  ],
  choices: [
    {
      at_objective: "obj_reach_shellfish_beds",
      options: [
        {
          id: "choice_beds_held",
          label: "Salt-crust sits high. Beds held the surge.",
          moral_weight: 0.0,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_opportunists", delta: 8 },
            },
            {
              kind: "flavor_only",
              params: {
                text: 'Alda nods once. "Salt price holds. Good read."',
              },
            },
          ],
        },
        {
          id: "choice_beds_scraped",
          label: "Sand is freshly sorted. Surge took the beds.",
          moral_weight: 0.0,
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
                text: 'Alda sighs, adjusts her prices. "Expected it. Thanks for walking. I\'d have lost a cycle guessing."',
              },
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    { kind: "skill_xp", params: { skill: "foraging", amount: 30 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_opportunists", delta: 10 },
    },
  ],
  repeatable: true,
  tags: [
    "storm_forage_check",
    "alda",
    "opportunist_lane",
    "forager_family",
    "gathering",
    "storm_dependent",
  ],
};
