// Item schema - the contract between engine and content. All items in
// /src/content/items/ must validate against these zod schemas.
// Schema version bumps when breaking changes land.

import { z } from 'zod';

export const ITEM_SCHEMA_VERSION = 1;

export const ItemCategory = z.enum([
  'weapon',
  'tool',
  'armor',
  'clothing',
  'food',
  'medicine',
  'material',            // crafting raw
  'relic',
  'book',
  'quest_item',
  'artifact',            // magical
  'trade_good',
  'building_material',
  'farming',
  'fishing',
  'mining',
  'cosmetic',
]);
export type ItemCategory = z.infer<typeof ItemCategory>;

export const ItemRarity = z.enum([
  'common',
  'uncommon',
  'rare',
  'ancient',
  'mythic',
  'cursed',
  'founder_relic',
]);
export type ItemRarity = z.infer<typeof ItemRarity>;

export const EquipSlot = z.enum([
  'head',
  'body',
  'legs',
  'feet',
  'hands',
  'main_hand',
  'off_hand',
  'ring',
  'amulet',
  'tool',
  'cosmetic',
]);
export type EquipSlot = z.infer<typeof EquipSlot>;

// Stat effects - modifies NPC/player stats when equipped or consumed
export const StatEffect = z.object({
  stat: z.string().min(1),           // e.g. 'attack', 'defense', 'hunger', 'skill_forage'
  delta: z.number(),                 // positive or negative adjustment
  duration_cycles: z.number().int().min(0).optional(), // 0/absent = permanent-while-equipped; N = transient
});
export type StatEffect = z.infer<typeof StatEffect>;

// Crafting recipe - what ingredients + station produce this item
export const CraftingIngredient = z.object({
  item_id: z.string().regex(/^item_/),
  qty: z.number().int().min(1),
});
export type CraftingIngredient = z.infer<typeof CraftingIngredient>;

export const CraftingRecipe = z.object({
  station: z.string().min(1),                    // e.g. 'campfire', 'forge', 'loom'
  skill_requirement: z.object({
    skill: z.string().min(1),
    level: z.number().int().min(1),
  }).optional(),
  ingredients: z.array(CraftingIngredient).min(1),
  produces_qty: z.number().int().min(1).default(1),
});
export type CraftingRecipe = z.infer<typeof CraftingRecipe>;

export const Item = z.object({
  id: z.string().regex(/^item_/, 'item id must start with item_'),
  schema_version: z.literal(ITEM_SCHEMA_VERSION),
  name: z.string().min(1),
  category: ItemCategory,
  rarity: ItemRarity,
  description: z.string().min(1),
  stackable: z.boolean().default(false),
  max_stack: z.number().int().min(1).default(1),   // ignored when stackable=false
  weight: z.number().min(0).default(0),
  value: z.number().int().min(0).default(0),       // base shop value in silver_coin
  source: z.array(z.string()).default([]),          // free-form tags: 'foraged', 'crafted', 'boss_drop_X', etc.
  uses: z.array(z.string()).default([]),            // free-form tags: 'heal', 'feed', 'unlock_door', etc.
  equip_slot: EquipSlot.optional(),
  stat_effects: z.array(StatEffect).default([]),
  crafting_recipes: z.array(CraftingRecipe).default([]),
  quest_links: z.array(z.string().regex(/^quest_/)).default([]),
  drop_table_links: z.array(z.string().regex(/^drop_/)).default([]),
  tags: z.array(z.string()).default([]),
});
export type Item = z.infer<typeof Item>;

// Runtime: a single stack of an item in an inventory.
export const InventoryStack = z.object({
  item_id: z.string().regex(/^item_/),
  qty: z.number().int().min(1),
  // Per-instance state for non-stackable items (durability, enchant, etc.).
  // Stackable items ignore this field.
  instance: z.record(z.string(), z.unknown()).optional(),
});
export type InventoryStack = z.infer<typeof InventoryStack>;

// Runtime: an entire inventory (per player or per NPC).
export const Inventory = z.object({
  owner_id: z.string(),
  capacity: z.number().int().min(1).default(28),   // RuneScape-style 28-slot default
  stacks: z.array(InventoryStack).default([]),
});
export type Inventory = z.infer<typeof Inventory>;

// Runtime: equipped items keyed by slot. Using string-keyed record with
// InventoryStack value so we get a Partial<Record<EquipSlot, ...>> shape -
// z.record with a z.enum key in zod v4 demands every key be present, which
// doesn't match our sparse-slots runtime model.
export const Equipment = z.object({
  owner_id: z.string(),
  slots: z.record(z.string(), InventoryStack).default({}),
});
export type Equipment = {
  owner_id: string;
  slots: Partial<Record<EquipSlot, InventoryStack>>;
};
