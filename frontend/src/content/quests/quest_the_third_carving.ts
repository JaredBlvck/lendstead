// Saela's archaeology quest. Migrates v8.4 canonical 'third_carving'.
// Uses collect_carving objective kind (PR #10 closure).

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_third_carving: Quest = {
  id: "quest_the_third_carving",
  schema_version: 1,
  category: "mystery",
  title: "The Third Carving",
  summary:
    "Saela believes a third carving exists somewhere on Ironback Ridge — older, smaller, humming in the right wind. Walk the ridge with her, listen at the saddle-crests, and discover the stone that confirms her three-voiced-island hypothesis.",
  giver_npc_id: "npc_saela_scout_archaeology",
  region_id: "region_ironback_ridge",
  faction_id: "faction_opportunists",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 10 } },
    {
      kind: "npc_skill_at_least",
      params: { npc_id: "npc_saela_scout_archaeology", skill: 5 },
    },
  ],
  objectives: [
    {
      id: "obj_talk_to_saela",
      kind: "talk_to_npc",
      target: { npc_id: "npc_saela_scout_archaeology" },
      count: 1,
      hidden: false,
      description:
        "Meet Saela — she'll walk you as far as the saddle and then listen with you.",
    },
    {
      id: "obj_find_first_carving",
      kind: "collect_carving",
      target: { site_id: "site_carving_deepening_spiral" },
      count: 1,
      hidden: false,
      description:
        "Inspect the Deepening Spiral — Saela needs the rubbing to compare glyph-arcs.",
    },
    {
      id: "obj_find_second_carving",
      kind: "collect_carving",
      target: { site_id: "site_carving_inland_marker" },
      count: 1,
      hidden: false,
      description:
        "Inspect the Inland Marker — the middle band may key the third site's direction.",
    },
    {
      id: "obj_find_third_carving",
      kind: "collect_carving",
      target: { site_id: "site_carving_ironback_glyphs" },
      count: 1,
      hidden: false,
      description:
        "Find the Ironback Glyphs — hum at the saddle-crest, tile [22, 4]. The third voice.",
    },
    {
      id: "obj_report_back",
      kind: "talk_to_npc",
      target: { npc_id: "npc_saela_scout_archaeology" },
      count: 1,
      hidden: false,
      description: "Return to Saela with all three rubbings.",
    },
  ],
  choices: [
    {
      at_objective: "obj_report_back",
      options: [
        {
          id: "choice_share_with_wyn",
          label:
            "Take the rubbings to Wyn as well — the translation is her life's work.",
          moral_weight: 0.4,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_architects", delta: 10 },
            },
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_opportunists", delta: 5 },
            },
            {
              kind: "flavor_only",
              params: {
                text: 'Wyn reads the glyph-chain at dawn. She does not cry. She closes her notebook carefully and sets the third fragment on top of the first two. "Three voices. The island had three voices."',
              },
            },
          ],
        },
        {
          id: "choice_saela_only",
          label: "Hold the rubbings with Saela — she earned this find.",
          moral_weight: 0.2,
          unlocks_objectives: [],
          completes_objectives: [],
          extra_rewards: [
            {
              kind: "faction_reputation",
              params: { faction_id: "faction_opportunists", delta: 12 },
            },
            {
              kind: "flavor_only",
              params: {
                text: "Saela writes the find in her public notebook first, with your name beside hers. She keeps the sketches from her private notebook unshared for now.",
              },
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    { kind: "item", params: { item_id: "item_long_carving_fragment", qty: 1 } },
    { kind: "skill_xp", params: { skill: "archaeology", amount: 70 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_opportunists", delta: 15 },
    },
  ],
  repeatable: false,
  tags: [
    "third_carving",
    "saela",
    "opportunist_lane",
    "archaeology",
    "mystery",
    "collect_carving_exercise",
    "v8_4_closure",
  ],
};
