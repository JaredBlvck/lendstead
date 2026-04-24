// Ridge Hound — common pack-member, seen as a single encounter in v1 (multi-
// enemy encounters are future work per Sr's PR #9 notes). Smaller + faster
// than the Crag Stalker but stays in the saddles for hours at a time.

import type { Enemy } from "../../game/combat/enemyTypes";

export const enemy_ironback_ridge_hound: Enemy = {
  id: "enemy_ironback_ridge_hound",
  schema_version: 1,
  name: "Ridge Hound",
  archetype: "predator",
  description:
    "Lean grey-furred hunter, shoulder-high to a walking scout. Travels the saddles with its kin but singles out the nearest prey. Ironback shepherds learned to read its tracks three generations before any scout of the Council did.",

  max_hp: 16,
  attack: 4,
  defense: 1,
  crit_chance: 0.1,
  dodge_chance: 0.14,
  level: 2,

  abilities: [
    {
      id: "ability_nip_and_retreat",
      name: "Nip and Retreat",
      damage_bonus: 1,
      cooldown_rounds: 2,
      description: "A quick bite that sets up a dodge the following round.",
    },
  ],

  spawn: {
    on_threat_severity: ["minor", "major"],
    region_ids: ["region_ironback_ridge", "region_the_deepening"],
  },

  drop_table_id: "drop_enemy_ridge_predator",
  fleeable: true,
  aggression: "reactive",
  tags: ["predator", "ironback_ridge", "pack", "common", "bible_canonical"],
};
