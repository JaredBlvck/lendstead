// Serialize a runtime snapshot to a Save object and optionally a JSON string
// (for localStorage or download). Schema-version stamps are written here so
// migrations can detect the source version on load.

import { Save, SAVE_SCHEMA_VERSION, type Save as SaveType, type PlayerSnapshot, type ShopStateSnapshot } from './saveTypes';
import type { WorldState } from '../world/worldState';
import type { Inventory, Equipment } from '../items/itemTypes';
import type { NpcRuntimeState } from '../npcs/npcTypes';
import type { QuestRuntimeState } from '../quests/questTypes';

export interface SnapshotInput {
  player: PlayerSnapshot;
  world: WorldState;
  inventories: Inventory[];
  equipment: Equipment[];
  npc_runtime: NpcRuntimeState[];
  quest_runtime: QuestRuntimeState[];
  shop_states?: ShopStateSnapshot[];
}

export function buildSave(input: SnapshotInput): SaveType {
  const save: SaveType = {
    schema_version: SAVE_SCHEMA_VERSION,
    saved_at_iso: new Date().toISOString(),
    player: input.player,
    world: input.world,
    inventories: input.inventories,
    equipment: input.equipment,
    npc_runtime: input.npc_runtime,
    quest_runtime: input.quest_runtime,
    shop_states: input.shop_states ?? [],
  };
  // Validate on the way out to catch authoring bugs early.
  const parsed = Save.safeParse(save);
  if (!parsed.success) {
    throw new Error(
      `buildSave: snapshot failed validation: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return parsed.data;
}

export function serializeSave(save: SaveType): string {
  return JSON.stringify(save);
}
