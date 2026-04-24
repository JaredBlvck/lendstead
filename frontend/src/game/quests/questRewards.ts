// Per-kind reward appliers. When a quest completes, the engine walks the
// quest.rewards + any choice.extra_rewards, applying them to world state,
// inventories, and faction reputation.

import type { Quest, QuestReward } from './questTypes';
import type { WorldState } from '../world/worldState';
import {
  adjustFactionReputation,
  unlockRegion,
  setFlag,
} from '../world/worldState';
import type { Inventory } from '../items/itemTypes';
import { addItem, type ItemLookup } from '../items/inventory';

export interface RewardContext {
  world: WorldState;
  inventory: Inventory;
  itemLookup: ItemLookup;
}

export interface RewardOutcome {
  world: WorldState;
  inventory: Inventory;
  notes: string[];       // human-readable log of what was applied
}

export function applyReward(ctx: RewardContext, reward: QuestReward): RewardOutcome {
  const notes: string[] = [];
  let world = ctx.world;
  let inventory = ctx.inventory;

  const p = reward.params;
  switch (reward.kind) {
    case 'item': {
      const itemId = String(p.item_id ?? '');
      const qty = Number(p.qty ?? 1);
      if (!itemId) {
        notes.push('item reward missing item_id - skipped');
        break;
      }
      // Tolerate unknown item ids: content authors may reference items not
      // yet registered. Log a skip note rather than crashing the quest
      // completion pipeline.
      if (!ctx.itemLookup(itemId)) {
        notes.push(`item reward ${itemId} references unknown item - skipped`);
        break;
      }
      const result = addItem(inventory, itemId, qty, ctx.itemLookup);
      inventory = result.inventory;
      if (result.leftover > 0) notes.push(`inventory full - ${result.leftover} of ${itemId} dropped`);
      else notes.push(`granted ${qty}x ${itemId}`);
      break;
    }
    case 'faction_reputation': {
      const factionId = String(p.faction_id ?? '');
      const delta = Number(p.delta ?? 0);
      if (!factionId) {
        notes.push('faction_reputation reward missing faction_id - skipped');
        break;
      }
      world = adjustFactionReputation(world, factionId, delta);
      notes.push(`${factionId} reputation ${delta >= 0 ? '+' : ''}${delta}`);
      break;
    }
    case 'skill_xp': {
      const skill = String(p.skill ?? '');
      const amount = Number(p.amount ?? 0);
      // XP currently lives outside world state - engine layer hooks in here.
      notes.push(`skill_xp ${skill} +${amount} (routed to skill system)`);
      break;
    }
    case 'unlock_region': {
      const regionId = String(p.region_id ?? '');
      if (!regionId) break;
      world = unlockRegion(world, regionId);
      notes.push(`unlocked ${regionId}`);
      break;
    }
    case 'world_state_set': {
      const key = String(p.key ?? '');
      if (!key) break;
      world = setFlag(world, key, Boolean(p.value ?? true));
      notes.push(`world flag ${key}=${p.value ?? true}`);
      break;
    }
    case 'flavor_only':
      notes.push(`flavor: ${String(p.text ?? '')}`);
      break;
  }
  return { world, inventory, notes };
}

export function applyQuestRewards(
  ctx: RewardContext,
  quest: Quest,
  extraRewards: QuestReward[] = [],
): RewardOutcome {
  let world = ctx.world;
  let inventory = ctx.inventory;
  const notes: string[] = [];
  const all = [...quest.rewards, ...extraRewards];
  for (const reward of all) {
    const r = applyReward({ world, inventory, itemLookup: ctx.itemLookup }, reward);
    world = r.world;
    inventory = r.inventory;
    notes.push(...r.notes);
  }
  return { world, inventory, notes };
}
