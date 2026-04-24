// Faction schema + registry. Content-owned. Reputation tiers define rewards,
// dialogue gating, and conflict logic.

import { z } from 'zod';

export const FACTION_SCHEMA_VERSION = 1;

export const FactionTierReward = z.object({
  tier: z.enum(['hated', 'hostile', 'wary', 'neutral', 'liked', 'trusted', 'revered']),
  unlocks_region_ids: z.array(z.string()).default([]),
  shop_discount: z.number().min(0).max(1).default(0),
  unlocks_quest_ids: z.array(z.string()).default([]),
});
export type FactionTierReward = z.infer<typeof FactionTierReward>;

export const Faction = z.object({
  id: z.string().regex(/^faction_/, 'faction id must start with faction_'),
  schema_version: z.literal(FACTION_SCHEMA_VERSION),
  name: z.string().min(1),
  philosophy: z.string().min(1),
  leader_npc_id: z.string().regex(/^npc_/).optional(),
  allies: z.array(z.string().regex(/^faction_/)).default([]),
  enemies: z.array(z.string().regex(/^faction_/)).default([]),
  home_region_id: z.string().regex(/^region_/).optional(),
  tier_rewards: z.array(FactionTierReward).default([]),
  questline_ids: z.array(z.string().regex(/^quest_/)).default([]),
  moral_tension: z.string().min(1),
  world_state_impact: z.string().min(1),
  tags: z.array(z.string()).default([]),
});
export type Faction = z.infer<typeof Faction>;

export class FactionRegistry {
  private byId = new Map<string, Faction>();

  register(f: Faction): void {
    if (this.byId.has(f.id)) throw new Error(`FactionRegistry: duplicate faction id ${f.id}`);
    this.byId.set(f.id, f);
  }

  registerMany(fs: Faction[]): void {
    for (const f of fs) this.register(f);
  }

  get(id: string): Faction | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): Faction[] {
    return Array.from(this.byId.values());
  }

  size(): number {
    return this.byId.size;
  }
}

export function validateFaction(input: unknown): { ok: boolean; data?: Faction; errors: string[] } {
  const parsed = Faction.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { ok: true, data: parsed.data, errors: [] };
}
