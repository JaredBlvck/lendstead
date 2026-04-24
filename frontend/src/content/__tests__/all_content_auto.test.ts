// Auto-discovering content validator. Globs every .ts file in
// /src/content/{npcs,items,quests,drops}/ except _template.ts and runs
// every export through the appropriate validator. New content authored
// in those directories is automatically covered by this test — no manual
// test-file extension required.
//
// Complements foundation_batch.test.ts which names specific exports for
// readable failure output. This file catches the "I forgot to add my new
// content to the manual test" class of drift.

import { describe, it, expect } from "vitest";
import { validateNpc } from "../../game/npcs/npcValidator";
import { validateItem } from "../../game/items/itemValidator";
import { validateQuest } from "../../game/quests/questValidator";
import { validateDropTable } from "../../game/drops/dropValidator";
import { validateRegion } from "../../game/world/regions";
import { validateFaction } from "../../game/world/factions";
import { validateEnemy } from "../../game/combat/enemyValidator";

// Vite / vitest glob helpers — eager loads every module at test time.
const npcModules = import.meta.glob<Record<string, unknown>>(
  "../npcs/!(_)*.ts",
  { eager: true },
);
const itemModules = import.meta.glob<Record<string, unknown>>(
  "../items/!(_)*.ts",
  { eager: true },
);
const questModules = import.meta.glob<Record<string, unknown>>(
  "../quests/!(_)*.ts",
  { eager: true },
);
const dropModules = import.meta.glob<Record<string, unknown>>(
  "../drops/!(_)*.ts",
  { eager: true },
);
const regionModules = import.meta.glob<Record<string, unknown>>(
  "../locations/!(_)*.ts",
  { eager: true },
);
const factionModules = import.meta.glob<Record<string, unknown>>(
  "../factions/!(_)*.ts",
  { eager: true },
);
const enemyModules = import.meta.glob<Record<string, unknown>>(
  "../enemies/!(_)*.ts",
  { eager: true },
);

type ValidatorResult = { ok: boolean; errors?: unknown };

function collectExports<T = unknown>(
  modules: Record<string, Record<string, unknown>>,
  idPrefix: string,
): { path: string; exportName: string; value: T }[] {
  const out: { path: string; exportName: string; value: T }[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    for (const [name, value] of Object.entries(mod)) {
      if (
        value &&
        typeof value === "object" &&
        "id" in (value as Record<string, unknown>) &&
        typeof (value as Record<string, unknown>).id === "string" &&
        ((value as Record<string, unknown>).id as string).startsWith(idPrefix)
      ) {
        out.push({ path, exportName: name, value: value as T });
      }
    }
  }
  return out;
}

describe("content auto-discovery validators", () => {
  const npcs = collectExports(npcModules, "npc_");
  const items = collectExports(itemModules, "item_");
  const quests = collectExports(questModules, "quest_");
  const drops = collectExports(dropModules, "drop_");
  const regions = collectExports(regionModules, "region_");
  const factions = collectExports(factionModules, "faction_");
  const enemies = collectExports(enemyModules, "enemy_");

  it("discovers at least one export per domain", () => {
    expect(npcs.length, "no NPC content found").toBeGreaterThan(0);
    expect(items.length, "no item content found").toBeGreaterThan(0);
    expect(quests.length, "no quest content found").toBeGreaterThan(0);
    expect(drops.length, "no drop table content found").toBeGreaterThan(0);
    expect(regions.length, "no region content found").toBeGreaterThan(0);
    expect(factions.length, "no faction content found").toBeGreaterThan(0);
    expect(enemies.length, "no enemy content found").toBeGreaterThan(0);
  });

  describe("npcs", () => {
    for (const { path, exportName, value } of npcs) {
      it(`validateNpc: ${exportName} (${path.replace(/^.*\/content\//, "")})`, () => {
        const result = validateNpc(value) as ValidatorResult;
        expect(
          result.ok,
          `validateNpc failed for ${exportName}: ${JSON.stringify(result.errors ?? result, null, 2)}`,
        ).toBe(true);
      });
    }
  });

  describe("items", () => {
    for (const { path, exportName, value } of items) {
      it(`validateItem: ${exportName} (${path.replace(/^.*\/content\//, "")})`, () => {
        const result = validateItem(value) as ValidatorResult;
        expect(
          result.ok,
          `validateItem failed for ${exportName}: ${JSON.stringify(result.errors ?? result, null, 2)}`,
        ).toBe(true);
      });
    }
  });

  describe("quests", () => {
    for (const { path, exportName, value } of quests) {
      it(`validateQuest: ${exportName} (${path.replace(/^.*\/content\//, "")})`, () => {
        const result = validateQuest(value) as ValidatorResult;
        expect(
          result.ok,
          `validateQuest failed for ${exportName}: ${JSON.stringify(result.errors ?? result, null, 2)}`,
        ).toBe(true);
      });
    }
  });

  describe("drops", () => {
    for (const { path, exportName, value } of drops) {
      it(`validateDropTable: ${exportName} (${path.replace(/^.*\/content\//, "")})`, () => {
        const result = validateDropTable(value) as ValidatorResult;
        expect(
          result.ok,
          `validateDropTable failed for ${exportName}: ${JSON.stringify(result.errors ?? result, null, 2)}`,
        ).toBe(true);
      });
    }
  });

  describe("regions", () => {
    for (const { path, exportName, value } of regions) {
      it(`validateRegion: ${exportName} (${path.replace(/^.*\/content\//, "")})`, () => {
        const result = validateRegion(value) as ValidatorResult;
        expect(
          result.ok,
          `validateRegion failed for ${exportName}: ${JSON.stringify(result.errors ?? result, null, 2)}`,
        ).toBe(true);
      });
    }
  });

  describe("factions", () => {
    for (const { path, exportName, value } of factions) {
      it(`validateFaction: ${exportName} (${path.replace(/^.*\/content\//, "")})`, () => {
        const result = validateFaction(value) as ValidatorResult;
        expect(
          result.ok,
          `validateFaction failed for ${exportName}: ${JSON.stringify(result.errors ?? result, null, 2)}`,
        ).toBe(true);
      });
    }
  });

  describe("enemies", () => {
    for (const { path, exportName, value } of enemies) {
      it(`validateEnemy: ${exportName} (${path.replace(/^.*\/content\//, "")})`, () => {
        const result = validateEnemy(value) as ValidatorResult;
        expect(
          result.ok,
          `validateEnemy failed for ${exportName}: ${JSON.stringify(result.errors ?? result, null, 2)}`,
        ).toBe(true);
      });
    }
  });

  describe("id uniqueness within each domain", () => {
    it("npc ids are unique", () => {
      const ids = npcs.map((n) => (n.value as { id: string }).id);
      expect(new Set(ids).size, `duplicate npc ids in: ${ids.join(", ")}`).toBe(
        ids.length,
      );
    });
    it("item ids are unique", () => {
      const ids = items.map((n) => (n.value as { id: string }).id);
      expect(
        new Set(ids).size,
        `duplicate item ids in: ${ids.join(", ")}`,
      ).toBe(ids.length);
    });
    it("quest ids are unique", () => {
      const ids = quests.map((n) => (n.value as { id: string }).id);
      expect(
        new Set(ids).size,
        `duplicate quest ids in: ${ids.join(", ")}`,
      ).toBe(ids.length);
    });
    it("drop table ids are unique", () => {
      const ids = drops.map((n) => (n.value as { id: string }).id);
      expect(
        new Set(ids).size,
        `duplicate drop ids in: ${ids.join(", ")}`,
      ).toBe(ids.length);
    });
    it("region ids are unique", () => {
      const ids = regions.map((n) => (n.value as { id: string }).id);
      expect(
        new Set(ids).size,
        `duplicate region ids in: ${ids.join(", ")}`,
      ).toBe(ids.length);
    });
    it("faction ids are unique", () => {
      const ids = factions.map((n) => (n.value as { id: string }).id);
      expect(
        new Set(ids).size,
        `duplicate faction ids in: ${ids.join(", ")}`,
      ).toBe(ids.length);
    });
    it("enemy ids are unique", () => {
      const ids = enemies.map((n) => (n.value as { id: string }).id);
      expect(
        new Set(ids).size,
        `duplicate enemy ids in: ${ids.join(", ")}`,
      ).toBe(ids.length);
    });
  });
});
