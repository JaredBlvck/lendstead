// NPC registry. Quad B populates this by registering content NPCs; the
// runtime looks NPCs up by id, by region, by faction, or by quest hook.

import type { Npc } from './npcTypes';

export class NpcRegistry {
  private byId = new Map<string, Npc>();

  register(npc: Npc): void {
    if (this.byId.has(npc.id)) throw new Error(`NpcRegistry: duplicate npc id ${npc.id}`);
    this.byId.set(npc.id, npc);
  }

  registerMany(npcs: Npc[]): void {
    for (const npc of npcs) this.register(npc);
  }

  get(id: string): Npc | undefined {
    return this.byId.get(id);
  }

  getOrThrow(id: string): Npc {
    const n = this.byId.get(id);
    if (!n) throw new Error(`NpcRegistry: unknown npc ${id}`);
    return n;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): Npc[] {
    return Array.from(this.byId.values());
  }

  byRegion(regionId: string): Npc[] {
    return this.all().filter((n) => n.home_region_id === regionId);
  }

  byFaction(factionId: string): Npc[] {
    return this.all().filter((n) => n.faction_id === factionId);
  }

  givingQuest(questId: string): Npc[] {
    return this.all().filter((n) => n.quest_hooks.includes(questId));
  }

  size(): number {
    return this.byId.size;
  }

  lookup = (id: string): Npc | undefined => this.byId.get(id);
}
