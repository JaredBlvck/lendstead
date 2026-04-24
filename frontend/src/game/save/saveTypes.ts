// Save file schema. A save is a full snapshot of everything the runtime
// needs to resume: world state, inventory/equipment per owner, NPC runtime
// states, quest runtime states, player position, active event cursor.

import { z } from 'zod';
import { WorldState } from '../world/worldState';
import { Inventory, Equipment } from '../items/itemTypes';
import { NpcRuntimeState } from '../npcs/npcTypes';
import { QuestRuntimeState } from '../quests/questTypes';

export const SAVE_SCHEMA_VERSION = 1;

// Shop runtime state - per-NPC live stock snapshot
export const ShopStateSnapshot = z.object({
  npc_id: z.string(),
  lines: z.array(z.object({
    item_id: z.string(),
    current_stock: z.number().int().min(0),
    last_restocked_cycle: z.number().int(),
  })),
});
export type ShopStateSnapshot = z.infer<typeof ShopStateSnapshot>;

export const PlayerSnapshot = z.object({
  id: z.string(),
  location: z.object({ x: z.number(), y: z.number() }),
  region_id: z.string().optional(),
  capabilities: z.object({
    canSwim: z.boolean().optional(),
    canClimbCliffs: z.boolean().optional(),
    maxSlope: z.number().optional(),
  }).default({}),
});
export type PlayerSnapshot = z.infer<typeof PlayerSnapshot>;

export const Save = z.object({
  schema_version: z.number().int().min(1),
  saved_at_iso: z.string(),
  player: PlayerSnapshot,
  world: WorldState,
  inventories: z.array(Inventory).default([]),
  equipment: z.array(Equipment).default([]),
  npc_runtime: z.array(NpcRuntimeState).default([]),
  quest_runtime: z.array(QuestRuntimeState).default([]),
  shop_states: z.array(ShopStateSnapshot).default([]),
});
export type Save = z.infer<typeof Save>;
