// Oren — prospector, ore-vein specialist. Bible-canon NPC (§7 names). Has
// a sustained trade relationship with Perric (runner) in the interaction
// sim — their affinity score climbed past 'close' organically.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_oren_prospector: Npc = {
  id: "npc_oren_prospector",
  schema_version: 1,
  name: "Oren",
  role: "prospector",
  faction_id: "faction_architects",
  home_region_id: "region_the_deepening",
  home_location: { x: 19, y: 15 },
  personality: "stubborn, thorough, quietly prideful of his work",
  dialogue_style: "short declaratives, gestures with his pick when explaining",
  schedule: [
    {
      phase: "dawn",
      location_id: "poi_ore_vein_1",
      activity: "survey",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "poi_ore_vein_1",
      activity: "prospect",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "poi_council_hearth",
      activity: "report",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "poi_smithy",
      activity: "deliver_ore",
      duration_phases: 1,
    },
    {
      phase: "night",
      location_id: "poi_council_hearth",
      activity: "sleep",
      duration_phases: 1,
    },
  ],
  relationships: [
    { target_id: "npc_perric_runner", kind: "friend", strength: 0.78 },
    { target_id: "npc_wyn_inland_marker", kind: "student", strength: 0.52 },
    { target_id: "faction_architects", kind: "faction_ally", strength: 0.8 },
  ],
  quest_hooks: ["quest_the_deepening_vein", "quest_the_second_seam_hypothesis"],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "Didn't hear you coming. Good feet. You after ore? The Deepening has veins. Not all of them want to be found.",
      sets_memory_flag: "met_oren",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_deepening",
      state: "quest_available",
      text: "There's a vein past the marker-stones — number four if I'm counting. I've lost two picks opening the ridge. Would you run three raw chunks back to the smithy for me? Save me a trip, save you a share.",
      triggers_quest_id: "quest_the_deepening_vein",
      weight: 1,
    },
    {
      id: "line_quest_active_deepening",
      state: "quest_active",
      text: "Mind the loose slate. You hit it wrong and the whole ridge sings in a bad register.",
      weight: 1,
    },
    {
      id: "line_quest_completed_deepening",
      state: "quest_completed",
      text: "Three chunks, good weight. Take this — it's the first bracelet I ever made. My hands were younger. It'll hold.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_faction_respected",
      state: "faction_respected",
      text: "Architects who work their ground right get my time. You qualify.",
      requires_reputation_at_least: 0.6,
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "The vein doesn't know your name and I'm not introducing you.",
      weight: 1,
    },
  ],
  shop_inventory: [
    {
      item_id: "item_raw_ore_chunk",
      stock_qty: 4,
      sell_price: 18,
      buy_price: 9,
      restocks_every_cycles: 5,
    },
  ],
  secrets: [
    {
      id: "secret_oren_second_seam_hypothesis",
      text: "Oren believes vein #3 and #4 are the same seam kinked by terrain shifts. He hasn't told Wyn because he wants to confirm it first with his own pick.",
      unlock_condition: "quest_complete:quest_the_second_seam_hypothesis",
    },
  ],
  personal_goals: [
    {
      id: "goal_fifth_vein",
      text: "Find a fifth ore vein before winter — would let the smithy run two chains in parallel.",
      progress_flag: "vein_five_located",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: ["prospector_family", "architect_lane", "ore_chain", "stubborn"],
};
