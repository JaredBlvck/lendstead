// Crag Stalker — lone predator that walks the Ironback saddles. Slower than
// a pack hunter but tougher and more accurate. Canonical per Bible §3 hazards
// ("predator packs drift through on cycles where threat_sighted rolls").

import type { Enemy } from "../../game/combat/enemyTypes";

export const enemy_ironback_crag_stalker: Enemy = {
  id: "enemy_ironback_crag_stalker",
  schema_version: 1,
  name: "Crag Stalker",
  archetype: "predator",
  description:
    "A lone mountain hunter the size of a small bear. Shoulders marked with pale rime from walking the high passes. Stalks by scent; waits for the moment the ridge wind shifts. Ironback folklore says it sings once, far away, before it chooses a kill.",

  max_hp: 24,
  attack: 6,
  defense: 2,
  crit_chance: 0.15,
  dodge_chance: 0.08,
  level: 3,

  abilities: [
    {
      id: "ability_crag_lunge",
      name: "Crag Lunge",
      damage_bonus: 3,
      cooldown_rounds: 4,
      description:
        "A full-body pounce off a high ledge. Ignores shield stance for the round.",
    },
    {
      id: "ability_warning_howl",
      name: "Warning Howl",
      damage_bonus: 0,
      cooldown_rounds: 6,
      description:
        "A low-pitched cry that raises its own accuracy for the next two rounds.",
    },
  ],

  spawn: {
    on_threat_severity: ["major"],
    region_ids: ["region_ironback_ridge"],
  },

  drop_table_id: "drop_enemy_ridge_predator",
  fleeable: true,
  aggression: "aggressive",
  tags: [
    "predator",
    "ironback_ridge",
    "solo",
    "major_severity",
    "bible_canonical",
  ],
};
