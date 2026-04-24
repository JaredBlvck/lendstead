// Harlan — toolmaker / crafter family. Makes Wyn's Ember Flasks + Oren's
// pick hafts. Bible canon.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_harlan_toolmaker: Npc = {
  id: "npc_harlan_toolmaker",
  schema_version: 1,
  name: "Harlan",
  role: "toolmaker",
  faction_id: "faction_architects",
  home_region_id: "region_wren_meadow",
  home_location: { x: 7, y: 10 },
  personality:
    "perfectionist, patient, quietly smug about his firing technique",
  dialogue_style:
    "precise, uses crafting verbs (temper, lap, seat), rarely elaborates without being asked",
  schedule: [
    {
      phase: "dawn",
      location_id: "poi_potter_kiln",
      activity: "fire_kiln",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "poi_potter_kiln",
      activity: "shape_clay",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "poi_smithy",
      activity: "deliver_hafts",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "region_wren_meadow",
      activity: "hardwood_cut",
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
    { target_id: "npc_wyn_inland_marker", kind: "friend", strength: 0.65 },
    { target_id: "npc_oren_prospector", kind: "friend", strength: 0.6 },
    { target_id: "faction_architects", kind: "faction_ally", strength: 0.8 },
  ],
  quest_hooks: ["quest_the_quality_control"],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "New hands. Show me a callus pattern before I decide how to talk to you.",
      sets_memory_flag: "met_harlan",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_quality",
      state: "quest_available",
      text: "I fired a batch of flasks for Wyn that cracked on the second temper. Kiln's giving me uneven heat. Could you run three test-fires with me and note which tile of the kiln fails the hardest?",
      triggers_quest_id: "quest_the_quality_control",
      weight: 1,
    },
    {
      id: "line_quest_active_quality",
      state: "quest_active",
      text: "Tap each test-tile, listen for the ring. A clean note means the heat sat even. A dull note means we patch.",
      weight: 1,
    },
    {
      id: "line_quest_completed_quality",
      state: "quest_completed",
      text: "Good ear. Tile three is the culprit — I'll relay it tomorrow. Take this flask; it's the first clean piece out of the re-fire.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_faction_respected",
      state: "faction_respected",
      text: "Architect with working hands. That's still how I define friend.",
      requires_reputation_at_least: 0.6,
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "My kiln doesn't serve you.",
      weight: 1,
    },
  ],
  shop_inventory: [
    {
      item_id: "item_ember_flask",
      stock_qty: 2,
      sell_price: 42,
      buy_price: 16,
      restocks_every_cycles: 8,
    },
    {
      item_id: "item_thatch_moss",
      stock_qty: 12,
      sell_price: 3,
      buy_price: 1,
      restocks_every_cycles: 3,
    },
  ],
  secrets: [
    {
      id: "secret_harlan_lost_kiln_notebook",
      text: "Harlan has a notebook of kiln-firing temperatures he has never shown anyone. He is afraid if he shares it, his craft becomes replaceable. He is also afraid of dying with the notebook unread.",
      unlock_condition: "memory:harlan_trusted_deeply",
    },
  ],
  personal_goals: [
    {
      id: "goal_teach_apprentice_firing",
      text: "Accept an apprentice and teach them the firing technique before the notebook is unreadable to anyone but him.",
      progress_flag: "kiln_apprentice_named",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: [
    "crafter_family",
    "architect_lane",
    "kiln_master",
    "ember_flask_source",
  ],
};
