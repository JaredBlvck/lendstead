// Region schema + registry. A Region describes a named territory on the
// Lendstead island: terrain types present, resource nodes, hazards, quest
// hooks, unlock requirements, and world-state changes on discovery.
// Every NPC, quest, and drop table that references a region_id must point
// at a registered Region.

import { z } from 'zod';

export const REGION_SCHEMA_VERSION = 1;

// Terrain types this region contains. Used by the 3D view to know what
// biome colors + resource distributions to expect.
export const RegionTerrain = z.enum([
  'plains',
  'forest',
  'marsh',
  'hill',
  'mountain',
  'beach',
  'water',
  'ruin',
  'cave',
]);
export type RegionTerrain = z.infer<typeof RegionTerrain>;

// Named hazards that can affect movement, visibility, or NPC safety in
// this region. Free-form ids so content authors can extend.
export const RegionHazard = z.object({
  id: z.string().regex(/^hazard_/),
  name: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['minor', 'major', 'catastrophic']).default('minor'),
});
export type RegionHazard = z.infer<typeof RegionHazard>;

// Gathering spot: where in the region you can forage / mine / fish.
// tile coords are within the global grid.
export const GatheringSpot = z.object({
  id: z.string().regex(/^gather_/),
  name: z.string().min(1),
  tile: z.object({ x: z.number().int(), y: z.number().int() }),
  drop_table_id: z.string().regex(/^drop_/).optional(),
  respawn_cycles: z.number().int().min(1).default(5),
});
export type GatheringSpot = z.infer<typeof GatheringSpot>;

// Unlock prerequisite for the region: must be satisfied before the region
// appears on maps / is walkable. Keeps symmetry with quest prerequisites.
export const RegionUnlock = z.object({
  kind: z.enum([
    'always',              // unlocked at game start
    'completed_quest',
    'settlement_level',
    'world_flag',
    'faction_reputation',
  ]),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type RegionUnlock = z.infer<typeof RegionUnlock>;

export const Region = z.object({
  id: z.string().regex(/^region_/, 'region id must start with region_'),
  schema_version: z.literal(REGION_SCHEMA_VERSION),
  name: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().min(1),
  tile_bounds: z.object({
    min: z.object({ x: z.number().int(), y: z.number().int() }),
    max: z.object({ x: z.number().int(), y: z.number().int() }),
  }),
  terrain_types: z.array(RegionTerrain).min(1),
  gathering_spots: z.array(GatheringSpot).default([]),
  hazards: z.array(RegionHazard).default([]),
  resident_npc_ids: z.array(z.string().regex(/^npc_/)).default([]),
  quest_hook_ids: z.array(z.string().regex(/^quest_/)).default([]),
  faction_home_ids: z.array(z.string().regex(/^faction_/)).default([]),
  unlock: RegionUnlock.default({ kind: 'always', params: {} }),
  neighbors: z.array(z.string().regex(/^region_/)).default([]),
  tags: z.array(z.string()).default([]),
});
export type Region = z.infer<typeof Region>;

// Registry (mirrors the NpcRegistry / ItemRegistry pattern).
export class RegionRegistry {
  private byId = new Map<string, Region>();

  register(r: Region): void {
    if (this.byId.has(r.id)) throw new Error(`RegionRegistry: duplicate region id ${r.id}`);
    this.byId.set(r.id, r);
  }

  registerMany(rs: Region[]): void {
    for (const r of rs) this.register(r);
  }

  get(id: string): Region | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): Region[] {
    return Array.from(this.byId.values());
  }

  size(): number {
    return this.byId.size;
  }

  containing(tile: { x: number; y: number }): Region | undefined {
    return this.all().find((r) =>
      tile.x >= r.tile_bounds.min.x &&
      tile.x <= r.tile_bounds.max.x &&
      tile.y >= r.tile_bounds.min.y &&
      tile.y <= r.tile_bounds.max.y,
    );
  }

  lookup = (id: string): Region | undefined => this.byId.get(id);
}

// Validator
export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

export function validateRegion(input: unknown): ValidationResult<Region> {
  const parsed = Region.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const r = parsed.data;
  const errors: string[] = [];
  if (r.tile_bounds.max.x < r.tile_bounds.min.x || r.tile_bounds.max.y < r.tile_bounds.min.y) {
    errors.push(`region ${r.id}: tile_bounds.max < tile_bounds.min`);
  }
  const seenSpots = new Set<string>();
  for (const s of r.gathering_spots) {
    if (seenSpots.has(s.id)) errors.push(`region ${r.id}: duplicate gathering spot ${s.id}`);
    seenSpots.add(s.id);
  }
  const seenHazards = new Set<string>();
  for (const h of r.hazards) {
    if (seenHazards.has(h.id)) errors.push(`region ${r.id}: duplicate hazard ${h.id}`);
    seenHazards.add(h.id);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: r, errors: [] };
}

export function validateRegions(inputs: unknown[]): {
  ok: boolean;
  valid: Region[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: Region[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];
  inputs.forEach((input, index) => {
    const r = validateRegion(input);
    if (r.ok && r.data) valid.push(r.data);
    else invalid.push({ index, errors: r.errors });
  });
  const seen = new Set<string>();
  valid.forEach((r, i) => {
    if (seen.has(r.id)) invalid.push({ index: i, errors: [`duplicate region id ${r.id}`] });
    seen.add(r.id);
  });
  return { ok: invalid.length === 0, valid, invalid };
}
