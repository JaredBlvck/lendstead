// Neve's roster walk. Migrates v8.4 canonical quest_key 'roster_review'.
// Uses elapsed_cycles objective that PR #5's CycleEmitter just wired up —
// quest completes when the player accompanies Neve for 3 full cycles.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_roster_review: Quest = {
  id: "quest_the_roster_review",
  schema_version: 1,
  category: "civilization",
  title: "The Roster Review",
  summary:
    "Neve hasn't done a full roster walk in three cycles. Accompany her through the camp, confirm each name, and help her catch anyone she's been missing. Small thing. Takes a day.",
  giver_npc_id: "npc_neve_organizer",
  region_id: "region_the_deepening",
  faction_id: "faction_council_of_the_source",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 5 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_neve_organizer", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_neve",
      kind: "talk_to_npc",
      target: { npc_id: "npc_neve_organizer" },
      count: 1,
      hidden: false,
      description:
        "Meet Neve at the Council hearth — she has the tally-stick out.",
    },
    {
      id: "obj_walk_three_cycles",
      kind: "elapsed_cycles",
      target: { cycles: 3 },
      count: 1,
      hidden: false,
      description:
        "Spend three full cycles walking the roster with Neve. Keep close.",
    },
    {
      id: "obj_report_back",
      kind: "talk_to_npc",
      target: { npc_id: "npc_neve_organizer" },
      count: 1,
      hidden: false,
      description: "Return to Neve and confirm the count.",
    },
  ],
  choices: [],
  rewards: [
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_council_of_the_source", delta: 15 },
    },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_architects", delta: 5 },
    },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_opportunists", delta: 5 },
    },
    {
      kind: "flavor_only",
      params: {
        text: "Neve writes your name in the count for the first time. It becomes a small permanent mark of belonging in the Council's records.",
      },
    },
  ],
  repeatable: true,
  tags: [
    "roster_review",
    "neve",
    "council_of_the_source",
    "organizer_family",
    "civilization",
  ],
};
