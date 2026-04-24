// Kestrel's marker recovery quest. Migrates v8.4 canonical 'lost_marker'.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_lost_marker: Quest = {
  id: "quest_the_lost_marker",
  schema_version: 1,
  category: "exploration",
  title: "The Lost Marker",
  summary:
    "One of Wyn's marker-stones is missing from the ridge path. Walk the route, find where it fell, and set it upright again before the path-song breaks at dawn.",
  giver_npc_id: "npc_kestrel_scout",
  region_id: "region_the_deepening",
  faction_id: "faction_opportunists",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 6 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_kestrel_scout", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_kestrel",
      kind: "talk_to_npc",
      target: { npc_id: "npc_kestrel_scout" },
      count: 1,
      hidden: false,
      description:
        "Meet Kestrel at the ridge path entrance — she'll point you at the gap.",
    },
    {
      id: "obj_search_low_tile_a",
      kind: "reach_tile",
      target: { x: 13, y: 9, region_id: "region_the_deepening" },
      count: 1,
      hidden: false,
      description:
        "Check the first low tile — things that fall land where the ground dips.",
    },
    {
      id: "obj_search_low_tile_b",
      kind: "reach_tile",
      target: { x: 16, y: 12, region_id: "region_the_deepening" },
      count: 1,
      hidden: false,
      description: "Check the second low tile if the first yields nothing.",
    },
    {
      id: "obj_report_back",
      kind: "talk_to_npc",
      target: { npc_id: "npc_kestrel_scout" },
      count: 1,
      hidden: false,
      description: "Report back to Kestrel — she'll record the find.",
    },
  ],
  choices: [],
  rewards: [
    { kind: "skill_xp", params: { skill: "scouting", amount: 25 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_opportunists", delta: 8 },
    },
    {
      kind: "flavor_only",
      params: {
        text: "At dawn the path-song sounds right again. Wyn doesn't say anything. She does that.",
      },
    },
  ],
  repeatable: true,
  tags: [
    "lost_marker",
    "kestrel",
    "opportunist_lane",
    "scout_family",
    "exploration",
  ],
};
