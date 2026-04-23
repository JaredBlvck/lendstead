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
