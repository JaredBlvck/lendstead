// Content bundle: the bridge from /src/content/ authored modules into
// populated registries the engine can consume.
//
// Import strategy: explicit imports here so the tree-shaker keeps only
// what content is actually shipped. When Quad B adds a file, they also
// add one line here. Validators run at import time so bad content
// crashes the build, not the running game.

import { ItemRegistry } from '../items/itemRegistry';
import { QuestRegistry } from '../quests/questEngine';
import { NpcRegistry } from '../npcs/npcRegistry';
import { validateItem } from '../items/itemValidator';
import { validateQuest } from '../quests/questValidator';
import { validateNpc } from '../npcs/npcValidator';
import { validateDropTable } from '../drops/dropValidator';
import type { DropTable } from '../drops/dropTypes';

// Content imports
import {
  item_template_flint,
  item_template_knife,
  item_template_silver_coin,
} from '../../content/items/_template';
import {
  item_ember_flask,
  item_ember_water,
  item_inland_marker_staff,
} from '../../content/items/item_ember_flask';

import { quest_template_do_not_ship } from '../../content/quests/_template';
import { quest_tending_the_ember_spring } from '../../content/quests/quest_tending_the_ember_spring';

import { npc_template_giver } from '../../content/npcs/_template';
import { npc_wyn_inland_marker } from '../../content/npcs/npc_wyn_inland_marker';

import { drop_template_boar } from '../../content/drops/_template';
import { drop_wren_meadow_foraging } from '../../content/drops/drop_wren_meadow_foraging';

export interface ContentBundle {
  items: ItemRegistry;
  quests: QuestRegistry;
  npcs: NpcRegistry;
  drops: DropTable[];
  errors: string[];
}

export function loadContentBundle(): ContentBundle {
  const errors: string[] = [];
  const items = new ItemRegistry();
  const quests = new QuestRegistry();
  const npcs = new NpcRegistry();
  const drops: DropTable[] = [];

  // Items
  const allItems = [
    item_template_flint,
    item_template_knife,
    item_template_silver_coin,
    item_ember_flask,
    item_ember_water,
    item_inland_marker_staff,
  ];
  for (const item of allItems) {
    const result = validateItem(item);
    if (!result.ok) {
      errors.push(`item ${item.id}: ${result.errors.join(', ')}`);
      continue;
    }
    items.register(item);
  }

  // Quests
  const allQuests = [
    quest_template_do_not_ship,
    quest_tending_the_ember_spring,
  ];
  for (const q of allQuests) {
    const result = validateQuest(q);
    if (!result.ok) {
      errors.push(`quest ${q.id}: ${result.errors.join(', ')}`);
      continue;
    }
    quests.register(q);
  }

  // NPCs
  const allNpcs = [
    npc_template_giver,
    npc_wyn_inland_marker,
  ];
  for (const n of allNpcs) {
    const result = validateNpc(n);
    if (!result.ok) {
      errors.push(`npc ${n.id}: ${result.errors.join(', ')}`);
      continue;
    }
    npcs.register(n);
  }

  // Drops
  const allDrops = [
    drop_template_boar,
    drop_wren_meadow_foraging,
  ];
  for (const d of allDrops) {
    const result = validateDropTable(d, items);
    if (!result.ok) {
      errors.push(`drop ${d.id}: ${result.errors.join(', ')}`);
      continue;
    }
    drops.push(d);
  }

  return { items, quests, npcs, drops, errors };
}
