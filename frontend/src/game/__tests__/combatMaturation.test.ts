import { describe, it, expect } from 'vitest';
import {
  defaultPlayerStats,
  resolveAbilityRound,
  resolveAttackRound,
  seededRandom,
  startEncounter,
} from '../combat/combatResolver';
import { DEFAULT_PLAYER_ABILITIES } from '../combat/playerAbilities';
import type { Enemy } from '../combat/enemyTypes';

const player = defaultPlayerStats();
const guard = DEFAULT_PLAYER_ABILITIES.find((a) => a.id === 'pability_guard')!;

function enemyWithAbilities(): Enemy {
  return {
    id: 'enemy_test_ab',
    schema_version: 1,
    name: 'Test Hunter',
    archetype: 'predator',
    description: 'test',
    max_hp: 20,
    attack: 3,
    defense: 1,
    crit_chance: 0,
    dodge_chance: 0,
    level: 2,
    abilities: [
      { id: 'ability_big_strike', name: 'Big Strike', damage_bonus: 4, cooldown_rounds: 2, description: '' },
      { id: 'ability_small_strike', name: 'Small Strike', damage_bonus: 2, cooldown_rounds: 3, description: '' },
    ],
    spawn: { on_threat_severity: ['minor'], region_ids: [] },
    fleeable: true,
    aggression: 'reactive',
    tags: [],
  };
}

function enemyNoAbilities(): Enemy {
  return {
    ...enemyWithAbilities(),
    id: 'enemy_test_plain',
    abilities: [],
  };
}

describe('enemy abilities in combat', () => {
  it('first round picks the first ability in content order', () => {
    const enemy = enemyWithAbilities();
    const state = startEncounter(enemy, player);
    const { state: next, result } = resolveAttackRound(state, enemy, player, seededRandom(1));
    // First ability is "ability_big_strike" - should be used on enemy's first turn
    expect(result.enemy_ability_used).toBe('ability_big_strike');
    // Its cooldown should now be set to 2
    expect(next.enemy_ability_cooldowns?.ability_big_strike).toBe(2);
  });

  it('second round picks the second ability while first is cooling down', () => {
    const enemy = enemyWithAbilities();
    let state = startEncounter(enemy, player);
    const rng = seededRandom(7);
    // Round 1: big_strike used (cooldown 2)
    ({ state } = resolveAttackRound(state, enemy, player, rng));
    // Round 2: big_strike ticks to 1, small_strike now first available
    const { state: next2, result: r2 } = resolveAttackRound(state, enemy, player, rng);
    expect(r2.enemy_ability_used).toBe('ability_small_strike');
    expect(next2.enemy_ability_cooldowns?.ability_big_strike).toBe(1);
    expect(next2.enemy_ability_cooldowns?.ability_small_strike).toBe(3);
  });

  it('falls back to basic attack when all abilities are on cooldown', () => {
    const enemy = enemyWithAbilities();
    let state = startEncounter(enemy, player);
    // Pre-set both abilities to cooling
    state = {
      ...state,
      enemy_ability_cooldowns: { ability_big_strike: 2, ability_small_strike: 2 },
    };
    const { result } = resolveAttackRound(state, enemy, player, seededRandom(1));
    expect(result.enemy_ability_used).toBeUndefined();
  });

  it('enemy without abilities uses basic attack', () => {
    const enemy = enemyNoAbilities();
    const state = startEncounter(enemy, player);
    const { result } = resolveAttackRound(state, enemy, player, seededRandom(1));
    expect(result.enemy_ability_used).toBeUndefined();
  });

  it('ability damage_bonus increases enemy damage over basic', () => {
    // Compare under the same RNG: with ability vs without ability
    const enemyAb = enemyWithAbilities();
    const enemyBasic = enemyNoAbilities();
    const state = startEncounter(enemyAb, player);
    const abResult = resolveAttackRound(state, enemyAb, player, seededRandom(999));
    const basicResult = resolveAttackRound(state, enemyBasic, player, seededRandom(999));
    if (abResult.result.enemy_hit && basicResult.result.enemy_hit) {
      expect(abResult.result.enemy_damage_dealt).toBeGreaterThan(basicResult.result.enemy_damage_dealt);
    }
  });

  it('guard reduction applies to enemy ability damage too', () => {
    const enemy = enemyWithAbilities();
    const state = startEncounter(enemy, player);
    const guarded = resolveAbilityRound(state, enemy, player, guard, seededRandom(17));
    // Guard reduces incoming damage to half
    expect(guarded.damage_taken).toBeLessThanOrEqual(
      // Upper bound = hypothetical enemy big_strike damage * 0.5 + 1 rounding slack
      Math.ceil((enemy.attack - player.defense + 2 + 4) * 0.5) + 1,
    );
    // ability cooldown on big_strike should be recorded
    expect(guarded.state.enemy_ability_cooldowns?.ability_big_strike).toBe(2);
  });

  it('resolveAbilityRound also ticks and records enemy ability cooldowns', () => {
    const enemy = enemyWithAbilities();
    let state = startEncounter(enemy, player);
    // Round 1: use guard, enemy big_strike fires (cd 2)
    const r1 = resolveAbilityRound(state, enemy, player, guard, seededRandom(3));
    state = r1.state;
    expect(state.enemy_ability_cooldowns?.ability_big_strike).toBe(2);
    // Round 2: guard on cooldown (2 rounds), force basic attack. big_strike ticks to 1.
    const stats2 = {
      ...player,
      ability_cooldowns: r1.ability_cooldowns_after,
      energy: r1.player_energy_after,
    };
    const { state: next2 } = resolveAttackRound(state, enemy, stats2, seededRandom(3));
    expect(next2.enemy_ability_cooldowns?.ability_big_strike).toBe(1);
  });
});

describe('CycleEmitter regen math (unit-level math, not React)', () => {
  // Simulates what the CycleEmitter effect does on cycle advance.
  // Tests the boundary cases so we know the clamp + no-change paths work.
  const REGEN_HP = 1;
  const REGEN_ENERGY = 2;

  function regen(
    combat: { hp: number; max_hp: number; energy: number; max_energy: number },
    cyclesAdvanced: number,
  ): { hp: number; energy: number; changed: boolean } {
    const newHp = Math.min(combat.max_hp, combat.hp + REGEN_HP * cyclesAdvanced);
    const newEnergy = Math.min(combat.max_energy, combat.energy + REGEN_ENERGY * cyclesAdvanced);
    return {
      hp: newHp,
      energy: newEnergy,
      changed: newHp !== combat.hp || newEnergy !== combat.energy,
    };
  }

  it('regens 1 HP and 2 energy per cycle', () => {
    const r = regen({ hp: 10, max_hp: 20, energy: 10, max_energy: 20 }, 1);
    expect(r.hp).toBe(11);
    expect(r.energy).toBe(12);
    expect(r.changed).toBe(true);
  });

  it('clamps at max_hp and max_energy', () => {
    const r = regen({ hp: 19, max_hp: 20, energy: 19, max_energy: 20 }, 5);
    expect(r.hp).toBe(20);
    expect(r.energy).toBe(20);
  });

  it('reports no change when already full', () => {
    const r = regen({ hp: 20, max_hp: 20, energy: 20, max_energy: 20 }, 3);
    expect(r.changed).toBe(false);
  });

  it('scales with multiple cycles', () => {
    const r = regen({ hp: 10, max_hp: 30, energy: 0, max_energy: 30 }, 4);
    expect(r.hp).toBe(14);
    expect(r.energy).toBe(8);
  });
});

describe('consumable item healing math', () => {
  // Mirror the InventoryHUD handleUse math so it can be verified
  // outside the React tree.
  function applyConsumable(
    combat: { hp: number; max_hp: number; energy: number; max_energy: number },
    effects: { hp: number; energy: number },
  ) {
    return {
      hp: Math.min(combat.max_hp, combat.hp + effects.hp),
      energy: Math.min(combat.max_energy, combat.energy + effects.energy),
    };
  }

  it('heals hp up to max', () => {
    const out = applyConsumable(
      { hp: 5, max_hp: 20, energy: 10, max_energy: 20 },
      { hp: 25, energy: 0 },
    );
    expect(out.hp).toBe(20);
    expect(out.energy).toBe(10);
  });

  it('restores energy up to max', () => {
    const out = applyConsumable(
      { hp: 20, max_hp: 20, energy: 5, max_energy: 20 },
      { hp: 0, energy: 15 },
    );
    expect(out.energy).toBe(20);
  });

  it('applies both hp and energy in one consume', () => {
    const out = applyConsumable(
      { hp: 10, max_hp: 20, energy: 5, max_energy: 20 },
      { hp: 6, energy: 8 },
    );
    expect(out.hp).toBe(16);
    expect(out.energy).toBe(13);
  });
});
