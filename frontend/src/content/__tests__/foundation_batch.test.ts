// Content-side validation test: confirms Quad B's foundation batch
// (npc_wyn_inland_marker + item_ember_flask/water/staff + quest_tending_the_ember_spring
// + drop_wren_meadow_foraging) passes Sr's canonical zod validators.
// Quad B's authoring safety net — fails the test suite on schema violations
// before content reaches runtime.

import { describe, it, expect } from "vitest";
import { validateNpc } from "../../game/npcs/npcValidator";
import { validateItem } from "../../game/items/itemValidator";
import { validateQuest } from "../../game/quests/questValidator";
import { validateDropTable } from "../../game/drops/dropValidator";

import { npc_wyn_inland_marker } from "../npcs/npc_wyn_inland_marker";
import { npc_iwen_healer } from "../npcs/npc_iwen_healer";
import {
  item_ember_flask,
  item_ember_water,
  item_inland_marker_staff,
} from "../items/item_ember_flask";
import {
  item_medicinal_herb_bundle,
  item_iwen_poultice,
} from "../items/item_medicinal_herb_bundle";
import { quest_tending_the_ember_spring } from "../quests/quest_tending_the_ember_spring";
import { quest_the_medicinal_sweep } from "../quests/quest_the_medicinal_sweep";
import { drop_wren_meadow_foraging } from "../drops/drop_wren_meadow_foraging";
import { drop_the_deepening_foraging } from "../drops/drop_the_deepening_foraging";

describe("foundation content batch — validates against Quad A schemas", () => {
  it("npc_wyn_inland_marker passes validateNpc", () => {
    const result = validateNpc(npc_wyn_inland_marker);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("item_ember_flask passes validateItem", () => {
    const result = validateItem(item_ember_flask);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("item_ember_water passes validateItem", () => {
    const result = validateItem(item_ember_water);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("item_inland_marker_staff passes validateItem", () => {
    const result = validateItem(item_inland_marker_staff);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("quest_tending_the_ember_spring passes validateQuest", () => {
    const result = validateQuest(quest_tending_the_ember_spring);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("drop_wren_meadow_foraging passes validateDropTable", () => {
    const result = validateDropTable(drop_wren_meadow_foraging);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  // --- second batch: Iwen (healer) + medicinal_sweep ---

  it("npc_iwen_healer passes validateNpc", () => {
    const result = validateNpc(npc_iwen_healer);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("item_medicinal_herb_bundle passes validateItem", () => {
    const result = validateItem(item_medicinal_herb_bundle);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("item_iwen_poultice passes validateItem", () => {
    const result = validateItem(item_iwen_poultice);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("quest_the_medicinal_sweep passes validateQuest", () => {
    const result = validateQuest(quest_the_medicinal_sweep);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });

  it("drop_the_deepening_foraging passes validateDropTable", () => {
    const result = validateDropTable(drop_the_deepening_foraging);
    expect(result.ok, JSON.stringify(result.errors ?? result, null, 2)).toBe(
      true,
    );
  });
});
