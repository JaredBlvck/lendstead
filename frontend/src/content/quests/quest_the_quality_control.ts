// Harlan's kiln-diagnostic quest. Migrates v8.4 canonical 'quality_control'.
// Uses infrastructure_built objective kind (the kiln fix becomes a new infra
// token) — closes a second stubbed objective kind PR #5's CycleEmitter
// wired up.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_quality_control: Quest = {
  id: "quest_the_quality_control",
  schema_version: 1,
  category: "crafting",
  title: "Quality Control",
  summary:
    "Harlan's kiln is giving uneven heat. Help him run three test-fires, identify the faulty tile, and help him repair it. The re-fired kiln will rebuild itself as a repaired infrastructure token.",
  giver_npc_id: "npc_harlan_toolmaker",
  region_id: "region_wren_meadow",
  faction_id: "faction_architects",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 12 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_harlan_toolmaker", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_harlan",
      kind: "talk_to_npc",
      target: { npc_id: "npc_harlan_toolmaker" },
      count: 1,
      hidden: false,
      description:
        "Meet Harlan at the potter kiln — he'll walk you through the test-fire method.",
    },
    {
      id: "obj_reach_kiln",
      kind: "reach_tile",
      target: { x: 7, y: 10, region_id: "region_wren_meadow" },
      count: 1,
      hidden: false,
      description: "Stand at the kiln with Harlan for the first test-fire.",
    },
    {
      id: "obj_gather_thatch",
      kind: "gather_item",
      target: { item_id: "item_thatch_moss" },
      count: 4,
      hidden: false,
      description:
        "Gather four bundles of thatch moss to patch the faulty kiln tile.",
    },
    {
      id: "obj_kiln_repaired",
      kind: "infrastructure_built",
      target: { infra_key: "potter_kiln_repaired" },
      count: 1,
      hidden: false,
      description:
        "Help Harlan repair the kiln — the repaired infrastructure token will register when the patch sets.",
    },
  ],
  choices: [],
  rewards: [
    { kind: "item", params: { item_id: "item_ember_flask", qty: 1 } },
    { kind: "skill_xp", params: { skill: "crafting", amount: 45 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_architects", delta: 10 },
    },
  ],
  repeatable: false,
  tags: [
    "quality_control",
    "harlan",
    "architect_lane",
    "crafter_family",
    "crafting",
    "infrastructure_objective",
  ],
};
