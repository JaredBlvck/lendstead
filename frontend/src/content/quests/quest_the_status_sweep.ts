// Iwen's welfare check. Migrates v8.4 canonical 'status_sweep'. Generic-
// baseline quest (v8.4 'default' role = fallback) anchored to Iwen because
// her dialogue already interrupts with wounded-priority — this is that
// impulse scaled to a full cycle of village-wide welfare walks.

import type { Quest } from "../../game/quests/questTypes";

export const quest_the_status_sweep: Quest = {
  id: "quest_the_status_sweep",
  schema_version: 1,
  category: "civilization",
  title: "The Status Sweep",
  summary:
    "Iwen asks you to walk among the people for two cycles, check on anyone she hasn't seen recently, and report any injuries, low morale, or isolation.",
  giver_npc_id: "npc_iwen_healer",
  region_id: "region_the_deepening",
  faction_id: "faction_council_of_the_source",
  prerequisites: [
    { kind: "cycle_at_least", params: { cycle: 4 } },
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
        "Meet Iwen at the infirmary — she has a short list of names she hasn't seen in several cycles.",
    },
    {
      id: "obj_walk_two_cycles",
      kind: "elapsed_cycles",
      target: { cycles: 2 },
      count: 1,
      hidden: false,
      description:
        "Spend two full cycles walking the camp, checking on anyone who looks out of place.",
    },
    {
      id: "obj_check_three_npcs",
      kind: "talk_to_npc",
      target: { npc_id: "npc_neve_organizer" },
      count: 1,
      hidden: false,
      description:
        "Check in with Neve (the Council's roster-keeper knows who is where).",
    },
    {
      id: "obj_report_back",
      kind: "talk_to_npc",
      target: { npc_id: "npc_iwen_healer" },
      count: 1,
      hidden: false,
      description: "Return to Iwen with what you saw.",
    },
  ],
  choices: [],
  rewards: [
    { kind: "item", params: { item_id: "item_iwen_poultice", qty: 2 } },
    { kind: "skill_xp", params: { skill: "healing", amount: 20 } },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_architects", delta: 6 },
    },
    {
      kind: "faction_reputation",
      params: { faction_id: "faction_council_of_the_source", delta: 6 },
    },
  ],
  repeatable: true,
  tags: [
    "status_sweep",
    "iwen",
    "architect_lane",
    "council_of_the_source",
    "civilization",
    "default_fallback_migrated",
  ],
};
