// Alda — forager-trader, opportunist lane. Bible canon (§5 role families).
// Lives between The Tidefast + Gull-Cove; carries goods across both.

import type { Npc } from "../../game/npcs/npcTypes";

export const npc_alda_forager_trader: Npc = {
  id: "npc_alda_forager_trader",
  schema_version: 1,
  name: "Alda",
  role: "forager-trader",
  faction_id: "faction_opportunists",
  home_region_id: "region_the_tidefast",
  home_location: { x: 6, y: 20 },
  personality:
    "practical, unsentimental about trade, reads weather like a second language",
  dialogue_style:
    "direct declaratives, quotes prices unprompted, trusts her nose over any forecast",
  schedule: [
    {
      phase: "dawn",
      location_id: "region_the_tidefast",
      activity: "shellfish_beds",
      duration_phases: 1,
    },
    {
      phase: "morning",
      location_id: "region_gull_cove",
      activity: "salt_trade",
      duration_phases: 1,
    },
    {
      phase: "midday",
      location_id: "poi_council_hearth",
      activity: "market_stall",
      duration_phases: 1,
    },
    {
      phase: "evening",
      location_id: "region_the_tidefast",
      activity: "driftwood_walk",
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
    { target_id: "npc_perric_runner", kind: "friend", strength: 0.55 },
    { target_id: "faction_opportunists", kind: "faction_ally", strength: 0.85 },
    { target_id: "faction_architects", kind: "friend", strength: 0.4 },
  ],
  quest_hooks: ["quest_the_storm_forage_check"],
  dialogue_lines: [
    {
      id: "line_first_hello",
      state: "first_meeting",
      text: "New face. Trade or trouble? If trade, speak — I'll quote before you finish the sentence.",
      sets_memory_flag: "met_alda",
      sets_dialogue_state: "neutral",
      weight: 1,
    },
    {
      id: "line_quest_offer_storm_forage",
      state: "quest_available",
      text: "Storm ran two cycles back and I haven't walked the tide-line since. Shellfish will be fat if the surge didn't scrape them, thin if it did. Walk the shore, tell me which it is. If I know, I'll price my salt fair tomorrow.",
      triggers_quest_id: "quest_the_storm_forage_check",
      weight: 1,
    },
    {
      id: "line_quest_active_storm_forage",
      state: "quest_active",
      text: "Watch the tide-mark. Where the salt-crust sits high, the beds held. Where the sand looks freshly sorted, the surge took them.",
      weight: 1,
    },
    {
      id: "line_quest_completed_storm_forage",
      state: "quest_completed",
      text: "Fat beds. Good. I'll set the salt price where it was last moon and everyone eats. You've earned a Shell-Pearl — small one, but it caught the right light the day I found it.",
      sets_dialogue_state: "friendly",
      weight: 1,
    },
    {
      id: "line_shop_browse",
      state: "neutral",
      text: "Looking? Salt at 4c, shell-pearl at 30 if I'm feeling generous, tide-glass by arrangement. I trade for driftwood + silverbark + anything that will carry the smell of salt out of it.",
      weight: 0.4,
    },
    {
      id: "line_hostile",
      state: "hostile",
      text: "No sale.",
      weight: 1,
    },
  ],
  shop_inventory: [
    {
      item_id: "item_thatch_moss",
      stock_qty: 15,
      sell_price: 4,
      buy_price: 1,
      restocks_every_cycles: 3,
    },
    {
      item_id: "item_berry_handful",
      stock_qty: 10,
      sell_price: 3,
      buy_price: 1,
      restocks_every_cycles: 2,
    },
  ],
  secrets: [
    {
      id: "secret_alda_weather_sense",
      text: "Alda can smell a storm 6 cycles out. She has never missed. She has never told anyone how — Council elders ask twice a season and she only ever laughs.",
      unlock_condition: "memory:alda_trusted_deeply",
    },
  ],
  personal_goals: [
    {
      id: "goal_shell_pearl_bracelet",
      text: "Finish the shell-pearl bracelet started for her sister before the next Long Winter.",
      progress_flag: "pearl_bracelet_finished",
    },
  ],
  default_movement_mode: "travel_to_job",
  default_dialogue_state: "neutral",
  tags: [
    "forager_family",
    "opportunist_lane",
    "weather_sense",
    "coastal_trade",
  ],
};
