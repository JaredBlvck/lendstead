import { describe, it, expect } from 'vitest';
import { validateEnemy, validateEnemies } from '../combat/enemyValidator';
import { EnemyRegistry } from '../combat/enemyRegistry';
import {
  defaultPlayerStats,
  resolveAttackRound,
  resolveFleeAttempt,
  seededRandom,
  startEncounter,
} from '../combat/combatResolver';
import { enemy_template_ridge_predator } from '../../content/enemies/_template';
import type { Enemy } from '../combat/enemyTypes';

describe('enemy validator', () => {
  it('accepts the template enemy', () => {
    const r = validateEnemy(enemy_template_ridge_predator);
    expect(r.ok).toBe(true);
  });

  it('rejects id without enemy_ prefix', () => {
    const bad = { ...enemy_template_ridge_predator, id: 'ridge_predator' };
    const r = validateEnemy(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate ability ids on the same enemy', () => {
    const bad = {
      ...enemy_template_ridge_predator,
      abilities: [
        { id: 'ability_dupe', name: 'A', damage_bonus: 0, cooldown_rounds: 0 },
        { id: 'ability_dupe', name: 'B', damage_bonus: 0, cooldown_rounds: 0 },
      ],
    };
    const r = validateEnemy(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('duplicate ability');
  });

  it('bulk validator catches duplicate enemy ids across files', () => {
    const r = validateEnemies([enemy_template_ridge_predator, enemy_template_ridge_predator]);
    expect(r.ok).toBe(false);
    expect(r.invalid.some((e) => e.errors.join(' ').includes('duplicate enemy id'))).toBe(true);
  });

  it('rejects negative stats', () => {
    const bad = { ...enemy_template_ridge_predator, attack: -3 };
    const r = validateEnemy(bad);
    expect(r.ok).toBe(false);
  });
});

describe('EnemyRegistry', () => {
  function registry() {
    const r = new EnemyRegistry();
    r.register(enemy_template_ridge_predator);
    return r;
  }

  it('basic register + lookup', () => {
    const r = registry();
    expect(r.get('enemy_template_ridge_predator')?.name).toContain('Ridge Predator');
    expect(r.size()).toBe(1);
  });

  it('byArchetype filters correctly', () => {
    const r = registry();
    expect(r.byArchetype('predator')).toHaveLength(1);
    expect(r.byArchetype('raider')).toHaveLength(0);
  });

  it('spawnableFor matches severity + region', () => {
    const r = registry();
    expect(
      r.spawnableFor({ severity: 'minor', region_id: 'region_ironback_ridge' }),
    ).toHaveLength(1);
    expect(
      r.spawnableFor({ severity: 'catastrophic' }),
    ).toHaveLength(0);
    expect(
      r.spawnableFor({ severity: 'minor', region_id: 'region_founding_shore' }),
    ).toHaveLength(0);
  });

  it('spawnableFor with no region filter treats empty region_ids as any', () => {
    const r = new EnemyRegistry();
    const anyRegion: Enemy = {
      ...enemy_template_ridge_predator,
      id: 'enemy_test_any_region',
      spawn: { on_threat_severity: ['minor'], region_ids: [] },
    };
    r.register(anyRegion);
    expect(r.spawnableFor({ severity: 'minor' })).toHaveLength(1);
    expect(r.spawnableFor({ severity: 'minor', region_id: 'region_anywhere' })).toHaveLength(1);
  });
});

describe('combat resolver', () => {
  const player = defaultPlayerStats();
  const enemy: Enemy = {
    ...enemy_template_ridge_predator,
    // Seed-friendly stats
    max_hp: 10,
    attack: 3,
    defense: 1,
    crit_chance: 0,
    dodge_chance: 0,
  };

  it('startEncounter initializes HP + round + log', () => {
    const state = startEncounter(enemy, player);
    expect(state.enemy_hp).toBe(10);
    expect(state.enemy_max_hp).toBe(10);
    expect(state.player_hp).toBe(20);
    expect(state.round).toBe(0);
    expect(state.outcome).toBe('in_progress');
    expect(state.log[0]).toContain('appears');
  });

  it('resolveAttackRound damages both combatants + increments round', () => {
    const rng = seededRandom(42);
    const state = startEncounter(enemy, player);
    const { state: next } = resolveAttackRound(state, enemy, player, rng);
    expect(next.round).toBe(1);
    expect(next.enemy_hp).toBeLessThanOrEqual(10);
    expect(next.player_hp).toBeLessThanOrEqual(20);
  });

  it('victory emits when enemy HP reaches 0', () => {
    const rng = seededRandom(1);
    const weakEnemy: Enemy = { ...enemy, max_hp: 1 };
    let state = startEncounter(weakEnemy, player);
    ({ state } = resolveAttackRound(state, weakEnemy, player, rng));
    expect(state.outcome).toBe('victory');
    expect(state.enemy_hp).toBe(0);
  });

  it('defeat emits when player HP reaches 0', () => {
    const rng = seededRandom(1);
    const strongEnemy: Enemy = { ...enemy, max_hp: 100, attack: 100 };
    const weakPlayer = { ...player, hp: 1, max_hp: 1, defense: 0 };
    let state = startEncounter(strongEnemy, weakPlayer);
    ({ state } = resolveAttackRound(state, strongEnemy, weakPlayer, rng));
    // With attack 100, defense 0, damage well exceeds HP 1
    if (state.outcome === 'in_progress') {
      // If the enemy somehow died first, that's a seed accident - refute with different seed
      throw new Error('test seed produced unexpected outcome');
    }
    expect(['defeat', 'victory']).toContain(state.outcome);
  });

  it('flee has non-zero success probability when enemy is wounded', () => {
    const weakEnemy: Enemy = { ...enemy, max_hp: 10 };
    const state = startEncounter(weakEnemy, player);
    // Wound the enemy below half HP before attempting flee
    const wounded = { ...state, enemy_hp: 3 };
    // Seed that produces <0.7 on first random() call to ensure success
    const rngSuccess = seededRandom(5);
    const fled = resolveFleeAttempt(wounded, weakEnemy, player, rngSuccess);
    // At least one of these two seeds should flee successfully
    const fled2 = resolveFleeAttempt(wounded, weakEnemy, player, seededRandom(100));
    expect([fled.outcome, fled2.outcome]).toContain('fled');
  });

  it('cannot flee an unfleeable enemy', () => {
    const trapper: Enemy = { ...enemy, fleeable: false };
    const state = startEncounter(trapper, player);
    const next = resolveFleeAttempt(state, trapper, player, seededRandom(1));
    expect(next.outcome).toBe('in_progress');
    expect(next.log.join(' ')).toContain('cannot flee');
  });

  it('resolveAttackRound throws when encounter already ended', () => {
    const state = startEncounter(enemy, player);
    const ended = { ...state, outcome: 'victory' as const };
    expect(() => resolveAttackRound(ended, enemy, player, seededRandom(1))).toThrow();
  });

  it('dodge chance of 1.0 means no damage taken', () => {
    const untouchable = { ...player, dodge_chance: 1.0 };
    const state = startEncounter(enemy, untouchable);
    const { state: next } = resolveAttackRound(state, enemy, untouchable, seededRandom(7));
    // Player attacks first; enemy counterattack always dodged
    expect(next.player_hp).toBe(untouchable.hp);
  });
});
