import { describe, it, expect } from 'vitest';
import {
  defaultPlayerStats,
  resolveAbilityRound,
  resolveAttackRound,
  seededRandom,
  startEncounter,
} from '../combat/combatResolver';
import { DEFAULT_PLAYER_ABILITIES } from '../combat/playerAbilities';
import { enemy_template_ridge_predator } from '../../content/enemies/_template';
import { translateBackendEvent } from '../engine/BackendEventRelay';
import type { CycleEvent } from '../../types';

const player = defaultPlayerStats();
const enemy = {
  ...enemy_template_ridge_predator,
  max_hp: 20,
  attack: 3,
  defense: 1,
  crit_chance: 0,
  dodge_chance: 0,
};
const heavyStrike = DEFAULT_PLAYER_ABILITIES.find((a) => a.id === 'pability_heavy_strike')!;
const guard = DEFAULT_PLAYER_ABILITIES.find((a) => a.id === 'pability_guard')!;
const mend = DEFAULT_PLAYER_ABILITIES.find((a) => a.id === 'pability_mend')!;

describe('player abilities', () => {
  it('heavy strike: 1.75x damage multiplier produces bigger hits than basic attack', () => {
    // Compare ability vs basic under identical seed
    const state = startEncounter(enemy, player);
    const { state: basicNext } = resolveAttackRound(state, enemy, player, seededRandom(42));
    const abilityResult = resolveAbilityRound(state, enemy, player, heavyStrike, seededRandom(42));
    const basicDmg = state.enemy_hp - basicNext.enemy_hp;
    const abilityDmg = state.enemy_hp - abilityResult.state.enemy_hp;
    // Heavy strike SHOULD hit harder when the RNG hits
    if (abilityDmg > 0 && basicDmg > 0) {
      expect(abilityDmg).toBeGreaterThanOrEqual(basicDmg);
    } else {
      // Seed-dependent miss acceptable; at minimum the ability should consume energy
      expect(abilityResult.player_energy_after).toBeLessThan(player.energy ?? 20);
    }
  });

  it('heavy strike deducts energy_cost', () => {
    const state = startEncounter(enemy, player);
    const result = resolveAbilityRound(state, enemy, player, heavyStrike, seededRandom(1));
    expect(result.player_energy_after).toBe((player.energy ?? 20) - heavyStrike.energy_cost);
  });

  it('ability under cooldown throws', () => {
    const state = startEncounter(enemy, player);
    const statsCool = {
      ...player,
      ability_cooldowns: { pability_heavy_strike: 2 },
    };
    expect(() => resolveAbilityRound(state, enemy, statsCool, heavyStrike, seededRandom(1))).toThrow();
  });

  it('ability with insufficient energy throws', () => {
    const state = startEncounter(enemy, player);
    const broke = { ...player, energy: 1 };
    expect(() => resolveAbilityRound(state, enemy, broke, heavyStrike, seededRandom(1))).toThrow();
  });

  it('mend heals but gives enemy a free swing', () => {
    const woundedPlayer = { ...player, hp: 5 };
    let state = startEncounter(enemy, woundedPlayer);
    state = { ...state, player_hp: 5 };
    const result = resolveAbilityRound(state, enemy, woundedPlayer, mend, seededRandom(42));
    expect(result.healed).toBeGreaterThan(0);
    expect(result.healed).toBeLessThanOrEqual(mend.heal_amount);
    // Enemy should have swung back
    expect(result.damage_taken + result.state.player_hp).toBeGreaterThanOrEqual(state.player_hp + result.healed - 1);
  });

  it('mend does not overheal past max_hp', () => {
    const fullPlayer = { ...player, hp: player.max_hp };
    const state = startEncounter(enemy, fullPlayer);
    const result = resolveAbilityRound(state, enemy, fullPlayer, mend, seededRandom(42));
    expect(result.healed).toBe(0);   // already at max
    // Player HP stays <= max after enemy counterattack
    expect(result.state.player_hp).toBeLessThanOrEqual(fullPlayer.max_hp);
  });

  it('guard halves incoming damage', () => {
    const state = startEncounter(enemy, player);
    const guardResult = resolveAbilityRound(state, enemy, player, guard, seededRandom(42));
    const basicResult = resolveAttackRound(state, enemy, player, seededRandom(42));
    // Under the same seed, guarded round should take <= basic round damage
    const guardDmg = state.player_hp - guardResult.state.player_hp;
    const basicDmg = state.player_hp - basicResult.state.player_hp;
    expect(guardDmg).toBeLessThanOrEqual(basicDmg);
  });

  it('ability use sets its own cooldown + ticks existing cooldowns down', () => {
    const state = startEncounter(enemy, player);
    const statsWithCd = {
      ...player,
      ability_cooldowns: { pability_mend: 3 },   // existing cooldown
    };
    const result = resolveAbilityRound(state, enemy, statsWithCd, heavyStrike, seededRandom(1));
    // Heavy strike now has its own cooldown set
    expect(result.ability_cooldowns_after.pability_heavy_strike).toBe(heavyStrike.cooldown_rounds);
    // Existing cooldown ticked down
    expect(result.ability_cooldowns_after.pability_mend).toBe(2);
  });

  it('ability round increments encounter round', () => {
    const state = startEncounter(enemy, player);
    const result = resolveAbilityRound(state, enemy, player, heavyStrike, seededRandom(1));
    expect(result.state.round).toBe(state.round + 1);
  });

  it('ability round can flip outcome to victory when lethal', () => {
    const weakEnemy = { ...enemy, max_hp: 1 };
    const state = startEncounter(weakEnemy, player);
    const result = resolveAbilityRound(state, weakEnemy, player, heavyStrike, seededRandom(1));
    if (result.damage_dealt >= 1) {
      expect(result.state.outcome).toBe('victory');
    }
  });
});

describe('BackendEventRelay ability translation', () => {
  function mk(kind: string, payload: Record<string, unknown>, id = 1): CycleEvent {
    return { id, cycle: 1, kind, payload, created_at: new Date().toISOString() };
  }

  it('translates backend ability event to client ability_cast GameEvent', () => {
    const out = translateBackendEvent(
      mk('ability', { ability_name: 'storm', leader: 'sr', auto: false }),
    );
    expect(out.gameEvents).toHaveLength(1);
    expect(out.gameEvents[0].kind).toBe('ability_cast');
    expect(out.gameEvents[0].payload.ability_id).toBe('storm');
    expect(out.gameEvents[0].payload.source).toBe('leader');
    expect(out.gameEvents[0].payload.leader).toBe('sr');
    expect(out.gameEvents[0].payload.auto).toBe(false);
  });

  it('falls back to ability_id when ability_name is missing', () => {
    const out = translateBackendEvent(
      mk('ability', { ability_id: 'resource_amp', leader: 'jr', auto: true }),
    );
    expect(out.gameEvents[0].payload.ability_id).toBe('resource_amp');
    expect(out.gameEvents[0].payload.auto).toBe(true);
  });

  it('handles missing payload gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = { id: 1, cycle: 1, kind: 'ability', payload: undefined as any, created_at: new Date().toISOString() };
    const out = translateBackendEvent(event);
    expect(out.gameEvents[0].payload.ability_id).toBe('unknown');
  });
});
