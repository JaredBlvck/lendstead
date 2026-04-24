// Player combat abilities. Distinct from backend leader magic (magic.js
// handles Sr/Jr ruler abilities like storm/resource_amp/protection);
// these are player-facing combat moves used in encounters via the
// CombatModal.
//
// Each ability modifies a base attack: damage multiplier, crit boost,
// defense stance, heal, etc. Energy cost limits spam. Cooldown in
// rounds prevents always-best-move selection.

import { z } from 'zod';

export const PlayerAbilityKind = z.enum([
  'heavy_strike',    // sacrifice accuracy for big damage
  'quick_strike',    // sacrifice damage for a second chance
  'guard',           // reduce incoming damage this round
  'rend',            // damage over time (not yet implemented in resolver)
  'mend',            // heal self
  'taunt',           // force enemy to attack next round (no effect yet)
]);
export type PlayerAbilityKind = z.infer<typeof PlayerAbilityKind>;

export const PlayerAbility = z.object({
  id: z.string().regex(/^pability_/),
  kind: PlayerAbilityKind,
  name: z.string().min(1),
  description: z.string().min(1),
  energy_cost: z.number().int().min(0).default(5),
  cooldown_rounds: z.number().int().min(0).default(0),
  // Per-kind tuning knobs; resolver interprets these
  damage_multiplier: z.number().min(0).default(1),
  accuracy_multiplier: z.number().min(0).default(1),    // 1 = default; >1 boosts hit, <1 reduces
  damage_reduction: z.number().min(0).max(1).default(0), // fraction of incoming damage reduced
  heal_amount: z.number().int().min(0).default(0),
});
export type PlayerAbility = z.infer<typeof PlayerAbility>;

// Canonical starter set. Every fresh PlayerState begins with these.
// Quad B can extend via content files later if we decide abilities are
// authored rather than engine-seeded.
export const DEFAULT_PLAYER_ABILITIES: PlayerAbility[] = [
  {
    id: 'pability_heavy_strike',
    kind: 'heavy_strike',
    name: 'Heavy Strike',
    description: 'A brutal swing. 1.75x damage, slightly less accurate.',
    energy_cost: 4,
    cooldown_rounds: 1,
    damage_multiplier: 1.75,
    accuracy_multiplier: 0.85,
    damage_reduction: 0,
    heal_amount: 0,
  },
  {
    id: 'pability_guard',
    kind: 'guard',
    name: 'Guard',
    description: 'Brace and block. Half incoming damage this round; no attack.',
    energy_cost: 2,
    cooldown_rounds: 2,
    damage_multiplier: 0,
    accuracy_multiplier: 0,
    damage_reduction: 0.5,
    heal_amount: 0,
  },
  {
    id: 'pability_mend',
    kind: 'mend',
    name: 'Mend',
    description: 'Patch your wounds. Heal 6 HP. Enemy gets a free swing.',
    energy_cost: 5,
    cooldown_rounds: 3,
    damage_multiplier: 0,
    accuracy_multiplier: 0,
    damage_reduction: 0,
    heal_amount: 6,
  },
];
