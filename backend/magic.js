// Magic Awakening — ability catalog, cooldowns, unlock tiers, effect math.
// Pure logic module; server.js owns DB persistence + routing.

export const ABILITIES = {
  resource_amp: {
    energy_cost: 25,
    cooldown: 3,
    default_duration: 5,
    description: "Amplify food or water production for N cycles.",
  },
  protection: {
    energy_cost: 30,
    cooldown: 4,
    default_duration: 6,
    description: "Shield a zone from storms / threats for N cycles.",
  },
  npc_influence: {
    energy_cost: 20,
    cooldown: 3,
    default_duration: 1, // instant-feel, morale/trust nudge
    description: "Motivate, calm, or direct a subset of NPCs.",
  },
  terrain_shape: {
    energy_cost: 50,
    cooldown: 8,
    default_duration: 20,
    description: "Reshape a tile — water↔land, raise/lower, retype.",
  },
};

export const REGEN_BASE = 10;
export const REGEN_WITH_TEMPLE = 15;
export const ENERGY_CAP = 100;

// Unlock thresholds. Retroactive: any leader past a threshold fires the
// corresponding breakthrough on the next advance.
export const UNLOCK_TIERS = {
  resource_amp: { always: true },
  protection: { pop: 20, or_zones: 2 },
  npc_influence: { events_survived: 10 },
  terrain_shape: { pop: 30, events_survived: 15, both: true },
};

export function abilityUnlocked(name, state) {
  const tier = UNLOCK_TIERS[name];
  if (!tier) return false;
  if (tier.always) return true;
  const checks = [];
  if (tier.pop != null) checks.push(state.population >= tier.pop);
  if (tier.or_zones != null && tier.pop == null) {
    checks.push(state.zones_claimed >= tier.or_zones);
  }
  if (tier.events_survived != null)
    checks.push(state.events_survived >= tier.events_survived);
  // For "either pop OR zones" semantics used by protection.
  if (tier.or_zones != null && tier.pop != null) {
    return state.population >= tier.pop || state.zones_claimed >= tier.or_zones;
  }
  if (tier.both) return checks.every(Boolean);
  return checks.some(Boolean);
}

// Count abilities the leader has used since `cycle - cooldown`. If >=1,
// cooldown active and the ability cannot be used.
export function onCooldown(recentAbilities, leader, name, currentCycle) {
  const cd = ABILITIES[name]?.cooldown ?? 0;
  if (cd <= 0) return false;
  return recentAbilities.some(
    (a) =>
      a.leader === leader &&
      a.ability_name === name &&
      currentCycle - a.cycle_used < cd,
  );
}

// Validate an incoming ability post. Returns { ok, error? }.
export function validateAbility({
  leader,
  ability_name,
  target_data,
  energyAvailable,
  onCd,
  unlocked,
}) {
  if (!leader || !["sr", "jr"].includes(leader))
    return { ok: false, error: "leader must be 'sr' or 'jr'" };
  if (!ABILITIES[ability_name])
    return { ok: false, error: `unknown ability '${ability_name}'` };
  if (!unlocked)
    return { ok: false, error: `${ability_name} not yet unlocked` };
  if (onCd) return { ok: false, error: `${ability_name} on cooldown` };

  const spec = ABILITIES[ability_name];
  if (energyAvailable < spec.energy_cost)
    return {
      ok: false,
      error: `insufficient energy (need ${spec.energy_cost}, have ${energyAvailable})`,
    };

  // Per-ability target_data shape checks.
  const td = target_data || {};
  switch (ability_name) {
    case "resource_amp":
      if (!["food", "water"].includes(td.kind))
        return {
          ok: false,
          error: "resource_amp requires kind: 'food' or 'water'",
        };
      if (!(td.multiplier >= 1.1 && td.multiplier <= 2.0))
        return { ok: false, error: "resource_amp multiplier must be 1.1-2.0" };
      break;
    case "protection":
      if (!Array.isArray(td.tile) || td.tile.length !== 2)
        return { ok: false, error: "protection requires tile: [x,y]" };
      if (!(td.radius >= 1 && td.radius <= 6))
        return { ok: false, error: "protection radius must be 1-6" };
      break;
    case "npc_influence":
      if (
        !Array.isArray(td.affected_npc_ids) ||
        td.affected_npc_ids.length === 0
      )
        return {
          ok: false,
          error: "npc_influence requires affected_npc_ids[]",
        };
      if (!["motivate", "calm", "direct"].includes(td.effect))
        return {
          ok: false,
          error: "npc_influence effect must be motivate/calm/direct",
        };
      break;
    case "terrain_shape":
      if (!Array.isArray(td.tile) || td.tile.length !== 2)
        return { ok: false, error: "terrain_shape requires tile: [x,y]" };
      if (
        !["water", "beach", "plains", "forest", "mountain"].includes(
          td.new_type,
        )
      )
        return { ok: false, error: "terrain_shape new_type invalid" };
      if (!(td.new_height >= 0 && td.new_height <= 1))
        return { ok: false, error: "terrain_shape new_height must be 0-1" };
      break;
  }

  return { ok: true };
}

export function computeBreakthroughs(state, prior = []) {
  const priorSet = new Set(
    (prior || []).map((b) => `${b.leader}:${b.unlocks}`),
  );
  const current = [];
  const kinds = [
    "resource_amp",
    "protection",
    "npc_influence",
    "terrain_shape",
  ];
  for (const leader of ["sr", "jr"]) {
    for (const k of kinds) {
      if (!abilityUnlocked(k, state)) continue;
      const key = `${leader}:${k}`;
      if (!priorSet.has(key))
        current.push({ leader, unlocks: k, at_cycle: state.cycle });
    }
  }
  return current;
}

// Per-cycle resource multiplier from active resource_amp abilities.
export function resourceAmpMultipliers(activeAbilities) {
  const out = { food: 1.0, water: 1.0 };
  for (const a of activeAbilities) {
    if (a.ability_name !== "resource_amp") continue;
    const td = a.target_data || {};
    const m = Number(td.multiplier || 1.0);
    if (td.kind === "food") out.food = Math.max(out.food, m);
    else if (td.kind === "water") out.water = Math.max(out.water, m);
  }
  return out;
}

// Is a tile under an active protection aura? Returns { protected, mode }.
export function protectionAt(activeAbilities, tx, ty) {
  for (const a of activeAbilities) {
    if (a.ability_name !== "protection") continue;
    const td = a.target_data || {};
    if (!Array.isArray(td.tile)) continue;
    const [px, py] = td.tile;
    const r = Number(td.radius || 1);
    if (Math.hypot(tx - px, ty - py) <= r)
      return { protected: true, mode: td.mode || "storm_shield" };
  }
  return { protected: false };
}

// Rulership overuse detection — too many casts of the same ability in a
// short window imply tyrannical rule, reduces NPC trust + may spawn unrest.
export function overuseDetection(
  recentAbilities,
  leader,
  currentCycle,
  window = 10,
) {
  const recent = recentAbilities.filter(
    (a) => a.leader === leader && currentCycle - a.cycle_used < window,
  );
  return {
    count: recent.length,
    overuse: recent.length >= 6,
    trust_drift: recent.length >= 6 ? -0.08 : 0,
  };
}

export function flavorSummary(ability_name, target_data) {
  const td = target_data || {};
  switch (ability_name) {
    case "resource_amp":
      return `${td.kind} production ×${td.multiplier} for ${td.duration_cycles}c`;
    case "protection":
      return `${td.mode || "shield"} at [${td.tile?.[0]},${td.tile?.[1]}] r=${td.radius} for ${td.duration_cycles}c`;
    case "npc_influence":
      return `${td.effect} ${td.affected_npc_ids?.length || 0} NPCs`;
    case "terrain_shape":
      return `[${td.tile?.[0]},${td.tile?.[1]}] → ${td.new_type} (h=${td.new_height}) for ${td.duration_cycles}c`;
    default:
      return ability_name;
  }
}
