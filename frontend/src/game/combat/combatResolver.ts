// Combat resolver. Pure functions that turn a combatant's stats +
// action choice + RNG into a round outcome. The UI layer calls these,
// displays the result, and decides when to call again.
//
// Design: deterministic under a seeded RNG so tests can assert exact
// outcomes. Damage is bounded (min 1 on a hit, 0 on miss), no stat
// under/overflow, HP always clamps >= 0.

import type { Enemy, EncounterState } from './enemyTypes';
import type { PlayerAbility } from './playerAbilities';

export type RandomFn = () => number;   // [0, 1)

export interface PlayerCombatStats {
  attack: number;
  defense: number;
  crit_chance: number;    // default 0.1
  dodge_chance: number;   // default 0.05
  hp: number;
  max_hp: number;
  energy?: number;        // for ability use
  max_energy?: number;
  ability_cooldowns?: Record<string, number>;   // ability_id -> rounds remaining
}

export function defaultPlayerStats(): PlayerCombatStats {
  return {
    attack: 3,
    defense: 1,
    crit_chance: 0.1,
    dodge_chance: 0.05,
    hp: 20,
    max_hp: 20,
    energy: 20,
    max_energy: 20,
    ability_cooldowns: {},
  };
}

export interface RoundResult {
  player_damage_dealt: number;
  player_hit: boolean;
  player_crit: boolean;
  enemy_damage_dealt: number;
  enemy_hit: boolean;
  enemy_crit: boolean;
  enemy_ability_used?: string;   // ability id if the enemy used one this round
  log: string[];
}

// Choose the enemy's next action. Picks the first off-cooldown ability
// in content order, otherwise basic attack. Content-order rotation
// is deterministic so tests can pin outcomes via the seeded RNG.
interface EnemyAction {
  kind: 'basic' | 'ability';
  ability?: Enemy['abilities'][number];
}

function chooseEnemyAction(enemy: Enemy, state: EncounterState): EnemyAction {
  const cooldowns = state.enemy_ability_cooldowns ?? {};
  for (const ab of enemy.abilities) {
    if ((cooldowns[ab.id] ?? 0) === 0) {
      return { kind: 'ability', ability: ab };
    }
  }
  return { kind: 'basic' };
}

// Tick every enemy ability cooldown down by 1. Returns the new map
// (omits any entry that hits 0). Passed back to the caller who merges
// into EncounterState.enemy_ability_cooldowns.
function tickEnemyCooldowns(current: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [id, rounds] of Object.entries(current)) {
    if (rounds > 1) next[id] = rounds - 1;
  }
  return next;
}

// Resolve the enemy's outgoing damage for a given action. Returns
// {hit, crit, damage, log_line}. damage_reduction is applied upstream
// by callers that implement guard-style player abilities.
function resolveEnemyAction(
  enemy: Enemy,
  player: PlayerCombatStats,
  action: EnemyAction,
  random: RandomFn,
): { hit: boolean; crit: boolean; damage: number; log_line: string; ability_id?: string } {
  const hit = rollAttack(
    enemy.attack,
    player.defense,
    enemy.crit_chance,
    player.dodge_chance,
    random,
  );
  const bonus = action.kind === 'ability' && action.ability
    ? Math.max(0, action.ability.damage_bonus)
    : 0;
  const damage = hit.hit ? hit.damage + (hit.crit ? bonus * 2 : bonus) : 0;

  let log_line: string;
  if (action.kind === 'ability' && action.ability) {
    if (!hit.hit) log_line = `The ${enemy.name} uses ${action.ability.name} but misses.`;
    else if (hit.crit) log_line = `The ${enemy.name} uses ${action.ability.name} - CRIT for ${damage}!`;
    else log_line = `The ${enemy.name} uses ${action.ability.name} for ${damage}.`;
  } else {
    if (!hit.hit) log_line = `The ${enemy.name} misses.`;
    else if (hit.crit) log_line = `The ${enemy.name} lands a brutal blow for ${damage}!`;
    else log_line = `The ${enemy.name} hits for ${damage}.`;
  }

  return {
    hit: hit.hit,
    crit: hit.crit,
    damage,
    log_line,
    ability_id: action.kind === 'ability' ? action.ability?.id : undefined,
  };
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
  let nextEnemyCooldowns = tickEnemyCooldowns(state.enemy_ability_cooldowns ?? {});
  let enemyAbilityUsed: string | undefined;

  // If enemy survived, counterattack (ability if available, else basic)
  if (enemyHpAfter > 0) {
    const action = chooseEnemyAction(enemy, state);
    const resolved = resolveEnemyAction(enemy, player, action, random);
    ePlayerDamageDealt = resolved.damage;
    eHit = resolved.hit;
    eCrit = resolved.crit;
    log.push(resolved.log_line);
    if (action.kind === 'ability' && action.ability) {
      enemyAbilityUsed = action.ability.id;
      // Apply cooldown (to the pre-tick snapshot so the ability isn't ticked this round)
      nextEnemyCooldowns = {
        ...nextEnemyCooldowns,
        [action.ability.id]: action.ability.cooldown_rounds,
      };
    }
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
    enemy_ability_cooldowns: nextEnemyCooldowns,
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
      enemy_ability_used: enemyAbilityUsed,
      log,
    },
  };
}

// Resolve a player ability use. Returns the new state and the
// outgoing player_stats diff (new energy, new cooldowns) the caller
// should merge back into engine state.
export interface AbilityRoundResult {
  state: EncounterState;
  player_energy_after: number;
  ability_cooldowns_after: Record<string, number>;
  damage_dealt: number;
  damage_taken: number;
  healed: number;
  ability_id: string;
}

export function resolveAbilityRound(
  state: EncounterState,
  enemy: Enemy,
  player: PlayerCombatStats,
  ability: PlayerAbility,
  random: RandomFn = Math.random,
): AbilityRoundResult {
  if (state.outcome !== 'in_progress') {
    throw new Error(`resolveAbilityRound: encounter already ${state.outcome}`);
  }

  const energy = player.energy ?? 0;
  const cooldowns = { ...(player.ability_cooldowns ?? {}) };

  if (energy < ability.energy_cost) {
    throw new Error(`not enough energy for ${ability.id} (${energy}/${ability.energy_cost})`);
  }
  if ((cooldowns[ability.id] ?? 0) > 0) {
    throw new Error(`${ability.id} is on cooldown (${cooldowns[ability.id]} rounds)`);
  }

  const log: string[] = [];
  let enemyHpAfter = state.enemy_hp;
  let playerHpAfter = state.player_hp;
  let damageDealt = 0;
  let damageTaken = 0;
  let healed = 0;

  // Heal abilities resolve first, before the enemy counterattack
  if (ability.heal_amount > 0) {
    const h = Math.min(player.max_hp - playerHpAfter, ability.heal_amount);
    playerHpAfter += h;
    healed = h;
    log.push(`${ability.name}: you heal ${h}.`);
  }

  // Damage abilities roll an attack with modified accuracy + damage
  if (ability.damage_multiplier > 0) {
    const missed = random() >= ability.accuracy_multiplier;
    const dodged = random() < enemy.dodge_chance;
    if (missed || dodged) {
      log.push(`${ability.name}: you swing wide.`);
    } else {
      const variance = Math.floor(random() * 3);
      const base = Math.max(1, player.attack - enemy.defense + variance);
      const crit = random() < player.crit_chance;
      const raw = crit ? base * 2 : base;
      const dmg = Math.max(1, Math.round(raw * ability.damage_multiplier));
      enemyHpAfter = Math.max(0, enemyHpAfter - dmg);
      damageDealt = dmg;
      log.push(crit ? `${ability.name}: CRITICAL ${dmg}!` : `${ability.name}: ${dmg} damage.`);
    }
  }

  // Guard / ability_reduction: enemy counterattack is reduced this round
  const reduction = ability.damage_reduction;

  // Enemy counterattack if still alive. Use ability rotation same as
  // resolveAttackRound so the enemy gets to flourish against guard too.
  let nextEnemyCooldowns = tickEnemyCooldowns(state.enemy_ability_cooldowns ?? {});
  if (enemyHpAfter > 0) {
    const action = chooseEnemyAction(enemy, state);
    const resolved = resolveEnemyAction(enemy, player, action, random);
    // Apply guard reduction
    const appliedDamage = Math.max(0, Math.round(resolved.damage * (1 - reduction)));
    playerHpAfter = Math.max(0, playerHpAfter - appliedDamage);
    damageTaken = appliedDamage;
    if (reduction > 0 && resolved.hit) {
      log.push(`${resolved.log_line} (reduced by guard)`);
    } else {
      log.push(resolved.log_line);
    }
    if (action.kind === 'ability' && action.ability) {
      nextEnemyCooldowns = {
        ...nextEnemyCooldowns,
        [action.ability.id]: action.ability.cooldown_rounds,
      };
    }
  } else {
    log.push(`You defeat the ${enemy.name}.`);
  }

  const nextEnergy = energy - ability.energy_cost;
  const nextCooldowns: Record<string, number> = {};
  // Tick existing cooldowns down by 1 each round
  for (const [id, rounds] of Object.entries(cooldowns)) {
    if (rounds > 1) nextCooldowns[id] = rounds - 1;
  }
  // Set this ability's cooldown
  if (ability.cooldown_rounds > 0) nextCooldowns[ability.id] = ability.cooldown_rounds;

  let outcome: EncounterState['outcome'] = 'in_progress';
  if (enemyHpAfter <= 0) outcome = 'victory';
  else if (playerHpAfter <= 0) outcome = 'defeat';

  return {
    state: {
      ...state,
      round: state.round + 1,
      enemy_hp: enemyHpAfter,
      player_hp: playerHpAfter,
      outcome,
      log: [...state.log, ...log],
      enemy_ability_cooldowns: nextEnemyCooldowns,
    },
    player_energy_after: nextEnergy,
    ability_cooldowns_after: nextCooldowns,
    damage_dealt: damageDealt,
    damage_taken: damageTaken,
    healed,
    ability_id: ability.id,
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
