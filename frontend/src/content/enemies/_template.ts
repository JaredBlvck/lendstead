// SAMPLE ENEMY TEMPLATE for Quad B to clone. Content authoring lives
// in this directory; the engine loads every !(_)*.ts file on boot.
//
// Bible alignment: v1 only authored predator packs (Ironback Ridge) and
// reserved sea-raiders for v2. The real enemies should reference Bible
// regions + factions where applicable.
//
// Naming rules (Bible §7):
// - No real-world place names
// - No apostrophes except possessive
// - No numbers in display names

import type { Enemy } from '../../game/combat/enemyTypes';

export const enemy_template_ridge_predator: Enemy = {
  id: 'enemy_template_ridge_predator',
  schema_version: 1,
  name: 'Ridge Predator (template)',
  archetype: 'predator',
  description:
    'A wary mountain-stalker. Travels alone but sings when others of its kind are near. Example of a predator entry Quad B can clone.',

  max_hp: 14,
  attack: 4,
  defense: 1,
  crit_chance: 0.1,
  dodge_chance: 0.1,
  level: 2,

  abilities: [
    {
      id: 'ability_lunge',
      name: 'Lunge',
      damage_bonus: 2,
      cooldown_rounds: 3,
      description: 'A closing bite that hits past a short shield.',
    },
  ],

  spawn: {
    on_threat_severity: ['minor', 'major'],
    region_ids: ['region_ironback_ridge'],
  },

  drop_table_id: undefined,
  fleeable: true,
  aggression: 'reactive',
  tags: ['template', 'predator', 'ironback_ridge'],
};
