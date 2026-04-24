// Oren's ore-running quest. Migrates v8.4 canonical quest_key 'deepening_vein'.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_deepening_vein: Quest = {
  id: "quest_the_deepening_vein",
  schema_version: 1,
  category: "gathering",
  title: "The Deepening Vein",
  summary:
    "Oren has opened a fresh seam past the marker-stones but lost two picks to it. Bring three chunks of raw ore from the vein to the smithy for processing.",
  giver_npc_id: "npc_oren_prospector",
  region_id: "region_the_deepening",
  faction_id: "faction_architects",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 8 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_oren_prospector", skill: 5 },
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
        "Speak with Oren at the ore vein — he'll mark the seam for you.",
    },
    {
      id: "obj_reach_ore_vein",
      kind: "reach_tile",
      target: { x: 19, y: 15, region_id: "region_the_deepening" },
      count: 1,
      hidden: false,
      description:
        "Walk to ore vein #4. Mind the loose slate on the approach ridge.",
    },
    {
      id: "obj_gather_ore",
      kind: "gather_item",
      target: { item_id: "item_raw_ore_chunk" },
      count: 3,
      hidden: false,
      description:
        "Extract three chunks of raw ore. Heavy work — take your time.",
    },
    {
      id: "obj_deliver_to_oren",
      kind: "deliver_item",
      target: {
        npc_id: "npc_oren_prospector",
        item_id: "item_raw_ore_chunk",
        qty: 3,
      },
      count: 1,
      hidden: false,
      description: "Return to Oren with the three chunks before dusk.",
    },
  ],
  choices: [],
  rewards: [
    { kind: "skill_xp", params: { skill: "prospecting", amount: 40 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_architects", delta: 10 },
    },
  ],
  repeatable: true,
  tags: [
    "deepening_vein",
    "oren",
    "architect_lane",
    "prospector_family",
    "gathering",
  ],
};
