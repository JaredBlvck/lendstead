// Iwen's first-casting teach quest — migrates the idea of a "learn to cast"
// tutorial into structured content. Stress-tests PR #11's ability_cast
// objective closure: player must cast Mend in combat to complete. Iwen is
// the healer, so Mend is thematically her teaching moment.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_first_casting: Quest = {
  id: "quest_the_first_casting",
  schema_version: 1,
  category: "npc_personal",
  title: "The First Casting",
  summary:
    "Iwen says the Source responds to a specific kind of stillness. Survive a single encounter on the ridge, cast Mend on yourself mid-combat, and return — your first taste of the Source that lives in a healer's hands.",
  giver_npc_id: "npc_iwen_healer",
  region_id: "region_the_deepening",
  faction_id: "faction_architects",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 15 } },
    {
      kind: "completed_quest",
      params: { quest_id: "quest_the_medicinal_sweep" },
    },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_iwen_healer", skill: 6 },
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
        "Meet Iwen at the infirmary — she will explain what stillness means in the moment of casting.",
    },
    {
      id: "obj_reach_ridge",
      kind: "reach_tile",
      target: { x: 22, y: 3, region_id: "region_ironback_ridge" },
      count: 1,
      hidden: false,
      description:
        "Walk to the north ridge. Any predator pack will give you an encounter.",
    },
    {
      id: "obj_cast_mend",
      kind: "ability_cast",
      target: { ability_id: "ability_mend" },
      count: 1,
      hidden: false,
      description:
        "When the encounter opens, cast Mend on yourself. The Source responds only if you ask in the right silence.",
    },
    {
      id: "obj_survive_encounter",
      kind: "survive_event",
      target: { event_kind: "combat_victory" },
      count: 1,
      hidden: false,
      description:
        "Win the fight. You cannot report a casting that ended in retreat.",
    },
    {
      id: "obj_report_back",
      kind: "talk_to_npc",
      target: { npc_id: "npc_iwen_healer" },
      count: 1,
      hidden: false,
      description:
        "Return to Iwen — she will read the cast on you the moment you walk through the door.",
    },
  ],
  choices: [
    {
      at_objective: "obj_report_back",
      options: [
        {
          id: "choice_describe_the_stillness",
          label:
            "Describe the stillness honestly — how it felt, what broke it.",
          moral_weight: 0.4,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_architects", delta: 12 },
            },
            {
              kind: "flavor_only",
              params: {
                text: 'Iwen listens without interrupting. When you\'re done she says "Good. Most describe the cast. Almost no one describes the silence. You already know the harder half."',
              },
            },
          ],
        },
        {
          id: "choice_claim_mastery",
          label: 'Claim mastery — "Easy once you find the rhythm."',
          moral_weight: -0.3,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "flavor_only",
              params: {
                text: "Iwen's smile goes thin. \"The rhythm is not the cast. The rhythm is what you hear around the cast. Come back when you've cast it enough times to notice.\"",
              },
            },
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_architects", delta: -3 },
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    { kind: "item", params: { item_id: "item_iwen_poultice", qty: 3 } },
    { kind: "skill_xp", params: { skill: "healing", amount: 60 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_architects", delta: 15 },
    },
  ],
  repeatable: false,
  tags: [
    "first_casting",
    "iwen",
    "architect_lane",
    "healer_family",
    "ability_cast_exercise",
    "post_v8_4_polish",
  ],
};
