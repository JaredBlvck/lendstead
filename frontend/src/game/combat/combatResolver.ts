// Combat resolver. Pure functions that turn a combatant's stats +
// action choice + RNG into a round outcome. The UI layer calls these,
// displays the result, and decides when to call again.
//
// Design: deterministic under a seeded RNG so tests can assert exact
// outcomes. Damage is bounded (min 1 on a hit, 0 on miss), no stat
// under/overflow, HP always clamps >= 0.

import type { Enemy, EncounterState } from './enemyTypes';

export type RandomFn = () => number;   // [0, 1)

export interface PlayerCombatStats {
  attack: number;
  defense: number;
  crit_chance: number;    // default 0.1
  dodge_chance: number;   // default 0.05
  hp: number;
  max_hp: number;
}

export function defaultPlayerStats(): PlayerCombatStats {
  return {
    attack: 3,
    defense: 1,
    crit_chance: 0.1,
    dodge_chance: 0.05,
    hp: 20,
    max_hp: 20,
  };
}

export interface RoundResult {
  player_damage_dealt: number;
  player_hit: boolean;
  player_crit: boolean;
  enemy_damage_dealt: number;
  enemy_hit: boolean;
  enemy_crit: boolean;
  log: string[];
}

// Roll a single attack. Returns {hit, crit, damage}.
function rollAttack(
  attackerAttack: number,
  defenderDefense: number,
  attackerCrit: number,
  defenderDodge: number,
  random: RandomFn,
): { hit: boolean; crit: boolean; damage: number } {
  // Dodge check first: dodger avoids entirely
  if (random() < defenderDodge) return { hit: false, crit: false, damage: 0 };
  // Base damage = max(1, attacker.attack - defender.defense + random(0..2))
  const variance = Math.floor(random() * 3);
  const base = Math.max(1, attackerAttack - defenderDefense + variance);
  const crit = random() < attackerCrit;
  const damage = crit ? base * 2 : base;
  return { hit: true, crit, damage };
}

// Begin a new encounter.
export function startEncounter(
  enemy: Enemy,
  player: PlayerCombatStats,
): EncounterState {
  return {
    enemy_id: enemy.id,
    enemy_hp: enemy.max_hp,
    enemy_max_hp: enemy.max_hp,
    player_hp: player.hp,
    player_max_hp: player.max_hp,
    round: 0,
    log: [`A ${enemy.name} appears.`],
    outcome: 'in_progress',
  };
}

// Resolve one "Attack" action: player strikes first, then enemy counterattacks
// if still alive. Returns a new EncounterState.
export function resolveAttackRound(
  state: EncounterState,
  enemy: Enemy,
  player: PlayerCombatStats,
  random: RandomFn = Math.random,
): { state: EncounterState; result: RoundResult } {
  if (state.outcome !== 'in_progress') {
    throw new Error(`resolveAttackRound: encounter already ${state.outcome}`);
  }

  const log: string[] = [];

  // Player strikes
  const p = rollAttack(
    player.attack,
    enemy.defense,
    player.crit_chance,
    enemy.dodge_chance,
    random,
  );
  if (!p.hit) log.push('You swing wide.');
  else if (p.crit) log.push(`CRITICAL! You strike for ${p.damage}.`);
  else log.push(`You hit for ${p.damage}.`);

  const enemyHpAfter = Math.max(0, state.enemy_hp - p.damage);

  let ePlayerDamageDealt = 0;
  let eHit = false;
  let eCrit = false;

  // If enemy survived, counterattack
  if (enemyHpAfter > 0) {
    const e = rollAttack(
      enemy.attack,
      player.defense,
      enemy.crit_chance,
      player.dodge_chance,
      random,
    );
    ePlayerDamageDealt = e.damage;
    eHit = e.hit;
    eCrit = e.crit;
    if (!e.hit) log.push(`The ${enemy.name} misses.`);
    else if (e.crit) log.push(`The ${enemy.name} lands a brutal blow for ${e.damage}!`);
    else log.push(`The ${enemy.name} hits for ${e.damage}.`);
  } else {
    log.push(`You defeat the ${enemy.name}.`);
  }

  const playerHpAfter = Math.max(0, state.player_hp - ePlayerDamageDealt);

  let outcome: EncounterState['outcome'] = 'in_progress';
  if (enemyHpAfter <= 0) outcome = 'victory';
  else if (playerHpAfter <= 0) outcome = 'defeat';

  const nextState: EncounterState = {
    ...state,
    round: state.round + 1,
    enemy_hp: enemyHpAfter,
    player_hp: playerHpAfter,
    outcome,
    log: [...state.log, ...log],
  };

  return {
    state: nextState,
    result: {
      player_damage_dealt: p.damage,
      player_hit: p.hit,
      player_crit: p.crit,
      enemy_damage_dealt: ePlayerDamageDealt,
      enemy_hit: eHit,
      enemy_crit: eCrit,
      log,
    },
  };
}

// Attempt to flee. 50% base success, +20% if enemy is wounded. On
// failure the enemy gets one free swing at the player.
export function resolveFleeAttempt(
  state: EncounterState,
  enemy: Enemy,
  player: PlayerCombatStats,
  random: RandomFn = Math.random,
): EncounterState {
  if (state.outcome !== 'in_progress') {
    throw new Error(`resolveFleeAttempt: encounter already ${state.outcome}`);
  }
  if (!enemy.fleeable) {
    return {
      ...state,
      log: [...state.log, 'You cannot flee this foe.'],
    };
  }
  const wounded = state.enemy_hp < state.enemy_max_hp / 2;
  const chance = wounded ? 0.7 : 0.5;
  const fled = random() < chance;
  if (fled) {
    return {
      ...state,
      outcome: 'fled',
      log: [...state.log, 'You break away and escape.'],
    };
  }
  // Flee failure - enemy swings freely
  const e = rollAttack(
    enemy.attack,
    player.defense,
    enemy.crit_chance,
    player.dodge_chance,
    random,
  );
  const playerHpAfter = Math.max(0, state.player_hp - e.damage);
  const outcome: EncounterState['outcome'] = playerHpAfter <= 0 ? 'defeat' : 'in_progress';
  return {
    ...state,
    player_hp: playerHpAfter,
    outcome,
    log: [
      ...state.log,
      'Flee failed!',
      e.hit ? `The ${enemy.name} catches you for ${e.damage}.` : `The ${enemy.name} just misses.`,
    ],
  };
}

// Seeded RNG helper (mulberry32) - same implementation as dropRoller so
// tests can pin determinism without a second seed system.
export function seededRandom(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
