// Iwen — healer, primary medical caretaker for the Council of the Source.
// Established Bible character (§4, §5). Has been treating wounded NPCs
// organically in the interaction sim — the treat interaction pathway runs
// through her whenever she's adjacent to an injured villager.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_iwen_healer: Npc = {
  id: "npc_iwen_healer",
  schema_version: 1,
  name: "Iwen",
  role: "healer",
  faction_id: "faction_architects",
  home_region_id: "region_the_deepening",
  home_location: { x: 18, y: 11 },
  personality: "tender, weary, fiercely observant",
  dialogue_style:
    "soft voice, names body parts matter-of-factly, never minimizes pain",
  schedule: [
    {
      phase: "dawn",
      location_id: "poi_infirmary",
      activity: "morning_rounds",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "region_the_deepening",
      activity: "gather_herbs",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "poi_infirmary",
      activity: "treat_wounded",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "poi_council_hearth",
      activity: "teach",
      duration_phases: 1,
    },
    {
      phase: "night",
      location_id: "poi_infirmary",
      activity: "sleep",
      duration_phases: 1,
    },
  ],
  relationships: [
    { target_id: "npc_wyn_inland_marker", kind: "friend", strength: 0.7 },
    { target_id: "faction_architects", kind: "faction_ally", strength: 0.85 },
    { target_id: "faction_opportunists", kind: "friend", strength: 0.5 },
  ],
  quest_hooks: [
    "quest_the_medicinal_sweep",
    "quest_the_ember_satellite_inspection",
  ],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "You look uninjured. Good. Stay that way — I don't have hands for everyone.",
      sets_memory_flag: "met_iwen",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_sweep",
      state: "quest_available",
      text: "The herb cluster runs thin. Three more injuries this week and I'm reaching for the old roots. Would you walk the north corridor and bring back what you can find?",
      triggers_quest_id: "quest_the_medicinal_sweep",
      weight: 1,
    },
    {
      id: "line_quest_active_sweep",
      state: "quest_active",
      text: "The bruiseroot grows where the soil is wet — look under the silver-bark. The yarrow prefers sun. Take only the mature stems; young ones rot before they do any good.",
      weight: 1,
    },
    {
      id: "line_quest_completed_sweep",
      state: "quest_completed",
      text: "Six good handfuls. You've bought us two more moons of care. Sit — I'll teach you the poultice cut while the light holds.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_wounded_priority",
      state: "quest_active",
      text: "Wait — is that blood on your sleeve? Sit. Herbs can wait. You cannot.",
      requires_reputation_at_least: 0.0,
      weight: 0.8,
    },
    {
      id: "line_faction_respected",
      state: "faction_respected",
      text: "The Architects look out for each other. So do I. You are welcome at the hearth whenever you need it.",
      requires_reputation_at_least: 0.6,
      weight: 1,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "I treat anyone who needs it. Even you. But I will not give you the names of my herbs.",
      weight: 1,
    },
  ],
  shop_inventory: [
    {
      item_id: "item_medicinal_herb_bundle",
      stock_qty: 6,
      sell_price: 8,
      buy_price: 3,
      restocks_every_cycles: 3,
    },
    {
      item_id: "item_iwen_poultice",
      stock_qty: 4,
      sell_price: 14,
      buy_price: 5,
      restocks_every_cycles: 5,
    },
  ],
  secrets: [
    {
      id: "secret_iwen_lost_apprentice",
      text: "Iwen had an apprentice once — Neve's older sister. Taken by the storm that named the Frost-Hollow. Iwen carries the mortar she could not finish teaching.",
      unlock_condition: "memory:iwen_trusted_deeply",
    },
    {
      id: "secret_iwen_knows_deepening_paths",
      text: "Iwen can trace every herb site in The Deepening blindfolded. She will not share the map — some of them only grow if the location stays secret.",
      unlock_condition: "quest_complete:quest_the_medicinal_sweep",
    },
  ],
  personal_goals: [
    {
      id: "goal_stockpile_for_long_winter",
      text: "Maintain a 3-moon medicinal reserve in case of another Long Winter.",
      progress_flag: "medicinal_reserve_deep",
    },
    {
      id: "goal_take_an_apprentice",
      text: "Accept a healer apprentice before my hands lose their steadiness.",
      progress_flag: "healer_apprentice_named",
    },
  ],
  default_movement_mode: "patrol",
  default_dialogue_state: "neutral",
  tags: ["elder", "healer_family", "architect_lane", "medical_keystone"],
};
