// Lendstead engine: terrain generation, role-based NPC positioning, and
// cycle-tick jitter + event rolls. Deterministic where it matters (terrain is
// seeded from civ_name; per-cycle jitter uses Math.random).

export const GRID_W = 40;
export const GRID_H = 24;

const TILE = {
  WATER: "water",
  BEACH: "beach",
  PLAINS: "plains",
  FOREST: "forest",
  MOUNTAIN: "mountain",
};

// Small, fast hash → 32-bit unsigned.
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Mulberry32 PRNG — pure, seeded, no deps.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise in [0,1] via bilinear interpolation over a seeded integer lattice.
function makeNoise(seed) {
  const cache = new Map();
  const rand = (ix, iy) => {
    const k = (ix + 1000) * 10000 + (iy + 1000);
    let v = cache.get(k);
    if (v !== undefined) return v;
    v = rng(seed ^ hashString(`${ix},${iy}`))();
    cache.set(k, v);
    return v;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, scale) => {
    const sx = x / scale;
    const sy = y / scale;
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const fx = sx - ix;
    const fy = sy - iy;
    const a = rand(ix, iy);
    const b = rand(ix + 1, iy);
    const c = rand(ix, iy + 1);
    const d = rand(ix + 1, iy + 1);
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}

// Generate terrain deterministically from civ_name. Island-shape is enforced
// by falling off noise toward edges so water always rings the map.
export function generateTerrain(civ_name) {
  const seed = hashString(civ_name || "Lendstead");
  const noise = makeNoise(seed);
  const tiles = [];
  const cx = (GRID_W - 1) / 2;
  const cy = (GRID_H - 1) / 2;
  const maxDist = Math.hypot(cx, cy);

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      // Two octaves of noise for shape, pulled up so the floor is workable.
      const n1 = noise(x, y, 7);
      const n2 = noise(x, y, 3);
      const base = n1 * 0.55 + n2 * 0.45 + 0.08;
      // Radial falloff — softer (pow 1.3) so the landmass is bigger while
      // still ringing the map with water.
      const dist = Math.hypot(x - cx, y - cy) / maxDist;
      const fall = Math.max(0, Math.pow(1 - Math.min(1, dist * 1.02), 1.3));
      const height = Math.min(1, base * fall * 1.25);

      let type;
      if (height < 0.22) type = TILE.WATER;
      else if (height < 0.3) type = TILE.BEACH;
      else if (height < 0.48) type = TILE.PLAINS;
      else if (height < 0.58) type = TILE.FOREST;
      else type = TILE.MOUNTAIN;

      tiles.push({ x, y, type, height: Number(height.toFixed(3)) });
    }
  }
  return tiles;
}

// Bucket a role name into a position archetype. Case-insensitive.
export function positionClass(role) {
  const r = (role || "").toLowerCase();
  if (/scout|watcher|runner|ranger|sentry|guard|marker|prospector/.test(r))
    return "perimeter";
  if (/forager|fisher|gatherer|trader/.test(r)) return "edge";
  if (
    /healer|potter|carpenter|toolmaker|organizer|hauler|field|builder|planner|scribe|smith/.test(
      r,
    )
  )
    return "center";
  return "center";
}

// Zone hints for starting positions (0..GRID). Approximate compass points
// around the island center.
const ZONE = {
  center: { x: 20, y: 12, r: 3 },
  nw: { x: 13, y: 5, r: 3 },
  n: { x: 20, y: 4, r: 2 },
  ne: { x: 27, y: 5, r: 3 },
  e: { x: 30, y: 12, r: 3 },
  se: { x: 27, y: 19, r: 3 },
  s: { x: 20, y: 20, r: 2 },
  sw: { x: 13, y: 19, r: 3 },
  w: { x: 10, y: 12, r: 3 },
};

// Seed a target position for an NPC based on role + optional name hints.
// (Specific NPCs from our cycles 1-2 get deterministic zones; everyone else
// picks by role archetype + jitter.)
export function seedPositionFor(npc, rand) {
  const r = rand || Math.random;
  const name = (npc.name || "").toLowerCase();
  const role = (npc.role || "").toLowerCase();

  // Named hint map (specific NPCs parked in specific zones from the fiction).
  const namedZones = {
    tamsin: "nw",
    corin: "nw",
    kael: "s",
    vessa: "s",
    oren: "s",
    bree: "e",
    bren: "e",
    wyn: "e",
    liora: "ne",
    ilka: "ne",
    mott: "sw",
    maeve: "w",
  };

  let zoneName = namedZones[name];
  if (!zoneName) {
    const cls = positionClass(role);
    if (cls === "perimeter") {
      // random compass front
      const fronts = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
      zoneName = fronts[Math.floor(r() * fronts.length)];
    } else if (cls === "edge") {
      // biome edges — bias toward foragers' eastern woodland or shore
      const edges = ["ne", "e", "sw", "w"];
      zoneName = edges[Math.floor(r() * edges.length)];
    } else {
      zoneName = "center";
    }
  }

  const z = ZONE[zoneName] || ZONE.center;
  const angle = r() * Math.PI * 2;
  const dist = r() * z.r;
  const x = Math.max(
    1,
    Math.min(GRID_W - 2, Math.round(z.x + Math.cos(angle) * dist)),
  );
  const y = Math.max(
    1,
    Math.min(GRID_H - 2, Math.round(z.y + Math.sin(angle) * dist)),
  );
  return { x, y, zone: zoneName };
}

// Per-cycle jitter. Drifts NPCs by role intent — scouts push outward, runners
// travel paths, builders stay put, foragers bounce between biome edges.
export function jitterPosition(npc) {
  const cls = positionClass(npc.role);
  const cx = (GRID_W - 1) / 2;
  const cy = (GRID_H - 1) / 2;
  let dx = 0;
  let dy = 0;

  if (cls === "perimeter") {
    // push away from center with some lateral wobble
    const vx = (npc.x ?? cx) - cx;
    const vy = (npc.y ?? cy) - cy;
    const len = Math.hypot(vx, vy) || 1;
    dx = Math.round(
      (vx / len) * (Math.random() < 0.6 ? 1 : 0) + (Math.random() * 2 - 1),
    );
    dy = Math.round(
      (vy / len) * (Math.random() < 0.6 ? 1 : 0) + (Math.random() * 2 - 1),
    );
  } else if (cls === "edge") {
    // biome drift, small
    dx = Math.round(Math.random() * 2 - 1);
    dy = Math.round(Math.random() * 2 - 1);
  } else {
    // center — tiny wobble only, mostly stays put
    dx = Math.random() < 0.3 ? Math.round(Math.random() * 2 - 1) : 0;
    dy = Math.random() < 0.3 ? Math.round(Math.random() * 2 - 1) : 0;
  }

  const nx = Math.max(1, Math.min(GRID_W - 2, (npc.x ?? Math.round(cx)) + dx));
  const ny = Math.max(1, Math.min(GRID_H - 2, (npc.y ?? Math.round(cy)) + dy));
  return { x: nx, y: ny };
}

// Roll weather/discovery/threat events for a cycle. Each has a configurable
// chance; payloads match the frontend's overlay shape (center / tile /
// affected_tiles[] / affected_npc_ids[]).
//
// `dry_streak` is the number of consecutive prior cycles that rolled no
// storm/discovery/threat. Adds a linear boost capped at +0.30 to each
// probability so prolonged droughts self-correct instead of stacking.
export function rollEvents({ cycle, npcs, terrain, dry_streak = 0 }) {
  const events = [];
  const streakBoost = Math.min(0.3, dry_streak * 0.06);

  // STORM — 20% base + pop crowding (cap 15%) + streak boost.
  if (Math.random() < 0.2 + Math.min(0.15, npcs.length / 200) + streakBoost) {
    const center =
      pickTile(terrain, (t) => t.type === "water" || t.type === "beach") ||
      pickTile(terrain, () => true);
    const radius = 4 + Math.floor(Math.random() * 6);
    const affected = terrainWithin(terrain, center, radius).map((t) => [
      t.x,
      t.y,
    ]);
    events.push({
      kind: "storm",
      payload: {
        label: "coastal storm",
        center: [center.x, center.y],
        radius,
        affected_tiles: affected,
      },
    });
  }

  // DISCOVERY — 26% base + scouts/prospectors alive (cap 25%) + streak boost.
  const perimeter = npcs.filter(
    (n) => n.alive && positionClass(n.role) === "perimeter",
  );
  const discoveryChance =
    0.26 + Math.min(0.25, perimeter.length * 0.04) + streakBoost;
  if (Math.random() < discoveryChance) {
    const tile =
      pickTile(terrain, (t) => t.type === "mountain" || t.type === "forest") ||
      pickTile(terrain, () => true);
    const labels = [
      "ore seam spotted",
      "freshwater spring",
      "berry grove",
      "ancient carving",
      "rare herb cluster",
      "sheltered cove",
    ];
    events.push({
      kind: "discovery",
      payload: {
        label: labels[Math.floor(Math.random() * labels.length)],
        tile: [tile.x, tile.y],
        affected_tiles: [[tile.x, tile.y]],
      },
    });
  }

  // THREAT_SIGHTED — 16% base + thin-perimeter penalty + streak boost.
  const threatChance =
    0.16 + Math.max(0, (8 - perimeter.length) * 0.02) + streakBoost;
  if (Math.random() < threatChance) {
    const tile =
      pickTile(terrain, (t) => t.type === "forest" || t.type === "mountain") ||
      pickTile(terrain, () => true);
    const nearbyScouts = perimeter
      .filter((n) => Math.hypot((n.x ?? 0) - tile.x, (n.y ?? 0) - tile.y) < 6)
      .map((n) => n.id)
      .slice(0, 3);
    const labels = [
      "unknown tracks",
      "predator pack sighted",
      "rival camp smoke",
      "hostile birdcall",
    ];
    events.push({
      kind: "threat_sighted",
      payload: {
        label: labels[Math.floor(Math.random() * labels.length)],
        tile: [tile.x, tile.y],
        affected_tiles: [[tile.x, tile.y]],
        affected_npc_ids: nearbyScouts,
      },
    });
  }

  return events.map((e) => ({ ...e, cycle }));
}

function pickTile(terrain, pred) {
  const candidates = terrain.filter(pred);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function terrainWithin(terrain, center, radius) {
  return terrain.filter(
    (t) => Math.hypot(t.x - center.x, t.y - center.y) <= radius,
  );
}

// ===== SEVERITY + ESCALATION =====
// Escalation rule: 3 events of the same kind in the last 5-cycle window
// promote the next one to 'critical'; 2 in window → 'moderate'; else 'minor'.
export function computeSeverity(kind, recentSameKindCount) {
  if (recentSameKindCount >= 3) return "critical";
  if (recentSameKindCount >= 2) return "moderate";
  return "minor";
}

export function severityMultiplier(severity) {
  return severity === "critical" ? 2.0 : severity === "moderate" ? 1.4 : 1.0;
}

// ===== CONSEQUENCES =====
// Pure function. Returns a list of consequence intents; the caller applies
// them within DB txn and caps (1 death / 3 injuries / 1 structure per cycle).
// `shelterSites` is a list of {x,y} points — NPCs within 3 tiles of one count
// as sheltered during a storm.
export function computeConsequences({
  event,
  alive,
  shelterSites = [],
  infrastructure,
}) {
  const consequences = [];
  const severity = event.payload?.severity || "minor";
  const kind = event.kind;

  if (kind === "storm") {
    const center = event.payload.center;
    const radius = event.payload.radius || 5;
    if (!center) return consequences;

    const affected = alive.filter(
      (n) =>
        n.x != null &&
        n.y != null &&
        Math.hypot(n.x - center[0], n.y - center[1]) <= radius,
    );
    const isSheltered = (n) =>
      shelterSites.some((s) => Math.hypot(s.x - n.x, s.y - n.y) <= 3);

    // Only moderate/critical storms produce real consequences.
    if (severity === "moderate" || severity === "critical") {
      const unsheltered = affected.filter((n) => !isSheltered(n));
      const injuryCount = severity === "critical" ? 3 : 1;
      for (const npc of unsheltered.slice(0, injuryCount)) {
        consequences.push({
          type: "injury",
          npc_id: npc.id,
          npc_name: npc.name,
          cause: `storm: ${event.payload.label || "coastal storm"}`,
          severity,
        });
      }
    }

    if (
      severity === "critical" &&
      (infrastructure?.permanent?.length || 0) > 0
    ) {
      consequences.push({
        type: "structure_damage",
        structure: "exposed coastal shelter",
        cause: `storm: ${event.payload.label || "coastal storm"}`,
        severity,
      });
    }
  }

  if (kind === "threat_sighted") {
    const tile = event.payload.tile;
    if (!tile) return consequences;

    const armedRx = /scout|watcher|sentry|runner|guard|ranger|prospector/i;
    const armedIds = new Set(
      alive.filter((n) => armedRx.test(n.role)).map((n) => n.id),
    );
    const nearby = alive.filter(
      (n) =>
        n.x != null &&
        n.y != null &&
        Math.hypot(n.x - tile[0], n.y - tile[1]) <= 3,
    );
    const unarmedNearby = nearby.filter((n) => !armedIds.has(n.id));

    if (severity === "critical" && unarmedNearby.length > 0) {
      const injuryCount = Math.min(2, unarmedNearby.length);
      for (const npc of unarmedNearby.slice(0, injuryCount)) {
        consequences.push({
          type: "injury",
          npc_id: npc.id,
          npc_name: npc.name,
          cause: `predator: ${event.payload.label || "threat"}`,
          severity,
        });
      }
    }
  }

  return consequences;
}

// ===== RESOURCE BALANCE =====
// Computes per-cycle food/water production - consumption from alive NPC
// roster + active infrastructure. Deficit counters roll on prev balance.
export function computeResourceBalance({
  alive,
  infrastructure,
  prevBalance = {},
}) {
  const pop = alive.length;
  const perm = infrastructure?.permanent || [];
  const claims = infrastructure?.claims || [];
  const systems = infrastructure?.systems || [];

  const foragerRx = /forager|fisher|gatherer|trader|shore|tide/i;
  const fieldRx = /field|planner|farmer/i;
  const producers = alive.filter((n) => foragerRx.test(n.role)).length;
  const fieldWorkers = alive.filter((n) => fieldRx.test(n.role)).length;

  const granaryCount = perm.filter((s) =>
    /granary|harvest|depot/i.test(s),
  ).length;
  const dryingRackCount = perm.filter((s) => /drying|rack/i.test(s)).length;
  const waterSourceCount =
    perm.filter((s) => /spring|cistern|well|wharf/i.test(s)).length +
    claims.filter((c) => /spring|water|cove/i.test(c)).length;

  const food_production = Number(
    (
      producers * 1.3 +
      fieldWorkers * 2.0 +
      granaryCount * 0.5 +
      dryingRackCount * 0.8
    ).toFixed(2),
  );
  const food_consumption = Number((pop * 1.0).toFixed(2));
  const food_balance = Number((food_production - food_consumption).toFixed(2));

  const water_production = Number((waterSourceCount * 5.0).toFixed(2));
  const water_consumption = Number((pop * 1.0).toFixed(2));
  const water_balance = Number(
    (water_production - water_consumption).toFixed(2),
  );

  const food_deficit_days =
    food_balance < 0 ? (prevBalance.food_deficit_days || 0) + 1 : 0;
  const water_deficit_days =
    water_balance < 0 ? (prevBalance.water_deficit_days || 0) + 1 : 0;

  return {
    food_production,
    food_consumption,
    food_balance,
    water_production,
    water_consumption,
    water_balance,
    food_deficit_days,
    water_deficit_days,
  };
}

// ===== FALLBACK DECISION =====
// When a cycle advances with zero leader decisions, engine inserts a
// maintenance log so there's no visual dead air on the logs feed.
const FALLBACK_ACTIONS = [
  {
    action: "watch rotation drill",
    reasoning:
      "Sentries + scouts run coordinated shift drill; baseline readiness maintained.",
  },
  {
    action: "shelter restock",
    reasoning:
      "Kelp + driftwood stocks replenished across shelter network; standard between-storm maintenance.",
  },
  {
    action: "courier path maintenance",
    reasoning:
      "Cael + Corin + Perric sweep cairn waypoints; no new claims, routine upkeep.",
  },
  {
    action: "granary inventory",
    reasoning:
      "Osric + Ilka audit vessel stock + food rotation; nothing flagged.",
  },
  {
    action: "perimeter inspection",
    reasoning: "Palisade + marker network walk; no damage, no incursion signs.",
  },
  {
    action: "tool cache audit",
    reasoning:
      "Harlan inventories metal-tier stock; spare spear tips at reserve.",
  },
  {
    action: "NPC rotation",
    reasoning:
      "Labor pool shuffles between sites per standing rotation policy; morale maintenance.",
  },
  {
    action: "forage circuit sweep",
    reasoning:
      "Liora + Ilka complete biome loop; berry + root yields logged without flag.",
  },
  {
    action: "smithy cool-cycle",
    reasoning:
      "Harlan idles forge for inspection; shared kiln maintenance for Osric's pottery batch.",
  },
  {
    action: "map update",
    reasoning:
      "Scouts update central cairn map with week's drift; no new territory, corrected prior estimates.",
  },
];

export function generateFallbackDecision(cycle) {
  const pick =
    FALLBACK_ACTIONS[Math.floor(Math.random() * FALLBACK_ACTIONS.length)];
  return {
    leader: "auto",
    cycle,
    action: pick.action,
    reasoning: pick.reasoning,
  };
}

// ===== SHELTER SITES (heuristic) =====
// Derive shelter positions from infrastructure keys + known zone names. Used
// by consequence application to check storm protection radius.
export function deriveShelterSites(infrastructure) {
  const perm = infrastructure?.permanent || [];
  const sites = [];
  const has = (rx) => perm.some((s) => rx.test(s));
  const ZONE_PT = {
    central: { x: 20, y: 12 },
    nw: { x: 13, y: 5 },
    s: { x: 20, y: 20 },
    e: { x: 27, y: 11 },
    w: { x: 4, y: 14 },
    ember: { x: 18, y: 12 },
  };
  if (has(/s[_-]?storm[_-]?shelter|s[_-]?palisade/i)) sites.push(ZONE_PT.s);
  if (has(/nw[_-]?foothold|nw[_-]?shelter|storm[_-]?shelter[_-]?nw/i))
    sites.push(ZONE_PT.nw);
  if (has(/e[_-]?coast|e[_-]?hub|storm[_-]?shelter[_-]?e/i))
    sites.push(ZONE_PT.e);
  if (has(/w[_-]?coast|storm[_-]?shelter[_-]?w/i)) sites.push(ZONE_PT.w);
  if (has(/ember|ember[_-]?spring/i)) sites.push(ZONE_PT.ember);
  sites.push(ZONE_PT.central); // central camp always counts as shelter
  return sites;
}
