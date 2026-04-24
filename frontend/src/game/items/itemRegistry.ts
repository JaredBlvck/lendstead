// Item registry. Quad B authors item definitions in /src/content/items/;
// they get bundled into a registry at load time. Lookup by id, list by
// category, or filter by source/use tags.

import type { Item } from './itemTypes';

export class ItemRegistry {
  private byId = new Map<string, Item>();

  register(item: Item): void {
    if (this.byId.has(item.id)) {
      throw new Error(`ItemRegistry: duplicate item id ${item.id}`);
    }
    this.byId.set(item.id, item);
  }

  registerMany(items: Item[]): void {
    for (const item of items) this.register(item);
  }

  get(id: string): Item | undefined {
    return this.byId.get(id);
  }

  getOrThrow(id: string): Item {
    const it = this.byId.get(id);
    if (!it) throw new Error(`ItemRegistry: unknown item ${id}`);
    return it;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): Item[] {
    return Array.from(this.byId.values());
  }

  byCategory(category: Item['category']): Item[] {
    return this.all().filter((i) => i.category === category);
  }

  byRarity(rarity: Item['rarity']): Item[] {
    return this.all().filter((i) => i.rarity === rarity);
  }

  withTag(tag: string): Item[] {
    return this.all().filter((i) => i.tags.includes(tag));
  }

  withUse(use: string): Item[] {
    return this.all().filter((i) => i.uses.includes(use));
  }

  size(): number {
    return this.byId.size;
  }

  // Bound ItemLookup compatible with inventory/equipment.
  lookup = (id: string): Item | undefined => this.byId.get(id);
}
