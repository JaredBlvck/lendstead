// Content bundle: auto-discovers every content file in /src/content/ and
// registers the exports whose ids match the domain prefix. When Quad B
// drops a new file into /src/content/{npcs,items,quests,drops}/ the engine
// picks it up at boot with no edit here.
//
// Validation runs at load time; files that fail their domain validator
// are logged to the returned errors[] instead of registered. The caller
// surfaces these on the console so broken content is loud, not silent.
//
// Templates (_template.ts) are skipped via the glob pattern.

import { ItemRegistry } from '../items/itemRegistry';
import { QuestRegistry } from '../quests/questEngine';
import { NpcRegistry } from '../npcs/npcRegistry';
import { validateItem } from '../items/itemValidator';
import { validateQuest } from '../quests/questValidator';
import { validateNpc } from '../npcs/npcValidator';
import { validateDropTable } from '../drops/dropValidator';
import type { Item } from '../items/itemTypes';
import type { Quest } from '../quests/questTypes';
import type { Npc } from '../npcs/npcTypes';
import type { DropTable } from '../drops/dropTypes';

// Vite eager glob: loads every matching file at build time.
// `!(_)` excludes files that start with an underscore (the templates).
const npcModules = import.meta.glob<Record<string, unknown>>(
  '../../content/npcs/!(_)*.ts',
  { eager: true },
);
const itemModules = import.meta.glob<Record<string, unknown>>(
  '../../content/items/!(_)*.ts',
  { eager: true },
);
const questModules = import.meta.glob<Record<string, unknown>>(
  '../../content/quests/!(_)*.ts',
  { eager: true },
);
const dropModules = import.meta.glob<Record<string, unknown>>(
  '../../content/drops/!(_)*.ts',
  { eager: true },
);

// Include templates so the original sample content also loads (useful
// for dev / demos, and none of our validators reject the template ids).
const npcTemplates = import.meta.glob<Record<string, unknown>>(
  '../../content/npcs/_*.ts',
  { eager: true },
);
const itemTemplates = import.meta.glob<Record<string, unknown>>(
  '../../content/items/_*.ts',
  { eager: true },
);
const questTemplates = import.meta.glob<Record<string, unknown>>(
  '../../content/quests/_*.ts',
  { eager: true },
);
const dropTemplates = import.meta.glob<Record<string, unknown>>(
  '../../content/drops/_*.ts',
  { eager: true },
);

interface ExportEntry<T> {
  path: string;
  exportName: string;
  value: T;
}

function collectExports<T>(
  modules: Record<string, Record<string, unknown>>,
  idPrefix: string,
): ExportEntry<T>[] {
  const out: ExportEntry<T>[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    for (const [name, value] of Object.entries(mod)) {
      if (
        value &&
        typeof value === 'object' &&
        'id' in (value as Record<string, unknown>) &&
        typeof (value as Record<string, unknown>).id === 'string' &&
        ((value as Record<string, unknown>).id as string).startsWith(idPrefix)
      ) {
        out.push({ path, exportName: name, value: value as T });
      }
    }
  }
  return out;
}

export interface ContentBundle {
  items: ItemRegistry;
  quests: QuestRegistry;
  npcs: NpcRegistry;
  drops: DropTable[];
  errors: string[];
  stats: {
    npcs: number;
    items: number;
    quests: number;
    drops: number;
  };
}

export function loadContentBundle(): ContentBundle {
  const errors: string[] = [];
  const items = new ItemRegistry();
  const quests = new QuestRegistry();
  const npcs = new NpcRegistry();
  const drops: DropTable[] = [];

  // Items - register BEFORE drops so drop-table validators can cross-ref.
  const allItemEntries = [
    ...collectExports<Item>(itemTemplates, 'item_'),
    ...collectExports<Item>(itemModules, 'item_'),
  ];
  for (const entry of allItemEntries) {
    const result = validateItem(entry.value);
    if (!result.ok) {
      errors.push(`item ${entry.value.id} (${entry.path}): ${result.errors.join(', ')}`);
      continue;
    }
    if (items.has(entry.value.id)) {
      errors.push(`item ${entry.value.id} (${entry.path}): duplicate id, skipped`);
      continue;
    }
    items.register(entry.value);
  }

  // Quests
  const allQuestEntries = [
    ...collectExports<Quest>(questTemplates, 'quest_'),
    ...collectExports<Quest>(questModules, 'quest_'),
  ];
  for (const entry of allQuestEntries) {
    const result = validateQuest(entry.value);
    if (!result.ok) {
      errors.push(`quest ${entry.value.id} (${entry.path}): ${result.errors.join(', ')}`);
      continue;
    }
    if (quests.has(entry.value.id)) {
      errors.push(`quest ${entry.value.id} (${entry.path}): duplicate id, skipped`);
      continue;
    }
    quests.register(entry.value);
  }

  // NPCs
  const allNpcEntries = [
    ...collectExports<Npc>(npcTemplates, 'npc_'),
    ...collectExports<Npc>(npcModules, 'npc_'),
  ];
  for (const entry of allNpcEntries) {
    const result = validateNpc(entry.value);
    if (!result.ok) {
      errors.push(`npc ${entry.value.id} (${entry.path}): ${result.errors.join(', ')}`);
      continue;
    }
    if (npcs.has(entry.value.id)) {
      errors.push(`npc ${entry.value.id} (${entry.path}): duplicate id, skipped`);
      continue;
    }
    npcs.register(entry.value);
  }

  // Drops: validate shape strictly, cross-reference item ids as warnings.
  // Content may reference items Quad B has not yet authored (the roller
  // gracefully skips unknown items at runtime), so a missing item does
  // not block the drop table from loading.
  const allDropEntries = [
    ...collectExports<DropTable>(dropTemplates, 'drop_'),
    ...collectExports<DropTable>(dropModules, 'drop_'),
  ];
  const seenDropIds = new Set<string>();
  for (const entry of allDropEntries) {
    // Shape-only validation (no registry) - fatal if it fails
    const shape = validateDropTable(entry.value);
    if (!shape.ok) {
      errors.push(`drop ${entry.value.id} (${entry.path}): ${shape.errors.join(', ')}`);
      continue;
    }
    if (seenDropIds.has(entry.value.id)) {
      errors.push(`drop ${entry.value.id} (${entry.path}): duplicate id, skipped`);
      continue;
    }

    // Cross-ref to item registry - warnings, not fatal
    const crossRef = validateDropTable(entry.value, items);
    if (!crossRef.ok) {
      errors.push(`drop ${entry.value.id} (${entry.path}) loaded with warnings: ${crossRef.errors.join(', ')}`);
    }
    seenDropIds.add(entry.value.id);
    drops.push(entry.value);
  }

  return {
    items,
    quests,
    npcs,
    drops,
    errors,
    stats: {
      npcs: npcs.size(),
      items: items.size(),
      quests: quests.size(),
      drops: drops.length,
    },
  };
}
