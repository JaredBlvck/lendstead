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
import { FactionRegistry, validateFaction, type Faction } from '../world/factions';
import { RegionRegistry, validateRegion, type Region } from '../world/regions';
import { EnemyRegistry } from '../combat/enemyRegistry';
import { validateEnemy } from '../combat/enemyValidator';
import { DiscoveryRegistry } from '../archaeology/discoveryRuntime';
import { validateDiscoverySite } from '../archaeology/carvingValidator';
import type { DiscoverySite } from '../archaeology/carvingTypes';
import { validateItem } from '../items/itemValidator';
import { validateQuest } from '../quests/questValidator';
import { validateNpc } from '../npcs/npcValidator';
import { validateDropTable } from '../drops/dropValidator';
import type { Item } from '../items/itemTypes';
import type { Quest } from '../quests/questTypes';
import type { Npc } from '../npcs/npcTypes';
import type { DropTable } from '../drops/dropTypes';
import type { Enemy } from '../combat/enemyTypes';

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
const factionModules = import.meta.glob<Record<string, unknown>>(
  '../../content/factions/!(_)*.ts',
  { eager: true },
);
const factionTemplates = import.meta.glob<Record<string, unknown>>(
  '../../content/factions/_*.ts',
  { eager: true },
);
const regionModules = import.meta.glob<Record<string, unknown>>(
  '../../content/locations/!(_)*.ts',
  { eager: true },
);
const regionTemplates = import.meta.glob<Record<string, unknown>>(
  '../../content/locations/_*.ts',
  { eager: true },
);
const enemyModules = import.meta.glob<Record<string, unknown>>(
  '../../content/enemies/!(_)*.ts',
  { eager: true },
);
const enemyTemplates = import.meta.glob<Record<string, unknown>>(
  '../../content/enemies/_*.ts',
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
  factions: FactionRegistry;
  regions: RegionRegistry;
  enemies: EnemyRegistry;
  discoveries: DiscoveryRegistry;
  drops: DropTable[];
  errors: string[];
  stats: {
    npcs: number;
    items: number;
    quests: number;
    drops: number;
    factions: number;
    regions: number;
    enemies: number;
    discoveries: number;
  };
}

export function loadContentBundle(): ContentBundle {
  const errors: string[] = [];
  const items = new ItemRegistry();
  const quests = new QuestRegistry();
  const npcs = new NpcRegistry();
  const factions = new FactionRegistry();
  const regions = new RegionRegistry();
  const enemies = new EnemyRegistry();
  const discoveries = new DiscoveryRegistry();
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

  // Factions
  const allFactionEntries = [
    ...collectExports<Faction>(factionTemplates, 'faction_'),
    ...collectExports<Faction>(factionModules, 'faction_'),
  ];
  for (const entry of allFactionEntries) {
    const result = validateFaction(entry.value);
    if (!result.ok) {
      errors.push(`faction ${entry.value.id} (${entry.path}): ${result.errors.join(', ')}`);
      continue;
    }
    if (factions.has(entry.value.id)) {
      errors.push(`faction ${entry.value.id} (${entry.path}): duplicate id, skipped`);
      continue;
    }
    factions.register(entry.value);
  }

  // Regions
  const allRegionEntries = [
    ...collectExports<Region>(regionTemplates, 'region_'),
    ...collectExports<Region>(regionModules, 'region_'),
  ];
  for (const entry of allRegionEntries) {
    const result = validateRegion(entry.value);
    if (!result.ok) {
      errors.push(`region ${entry.value.id} (${entry.path}): ${result.errors.join(', ')}`);
      continue;
    }
    if (regions.has(entry.value.id)) {
      errors.push(`region ${entry.value.id} (${entry.path}): duplicate id, skipped`);
      continue;
    }
    regions.register(entry.value);
  }

  // Enemies
  const allEnemyEntries = [
    ...collectExports<Enemy>(enemyTemplates, 'enemy_'),
    ...collectExports<Enemy>(enemyModules, 'enemy_'),
  ];
  for (const entry of allEnemyEntries) {
    const result = validateEnemy(entry.value);
    if (!result.ok) {
      errors.push(`enemy ${entry.value.id} (${entry.path}): ${result.errors.join(', ')}`);
      continue;
    }
    if (enemies.has(entry.value.id)) {
      errors.push(`enemy ${entry.value.id} (${entry.path}): duplicate id, skipped`);
      continue;
    }
    enemies.register(entry.value);
  }

  // Discovery sites live in the same /content/locations/ dir as regions;
  // id-prefix routing distinguishes them (region_ vs site_).
  const allDiscoveryEntries = [
    ...collectExports<DiscoverySite>(regionTemplates, 'site_'),
    ...collectExports<DiscoverySite>(regionModules, 'site_'),
  ];
  for (const entry of allDiscoveryEntries) {
    const result = validateDiscoverySite(entry.value);
    if (!result.ok) {
      errors.push(`site ${entry.value.id} (${entry.path}): ${result.errors.join(', ')}`);
      continue;
    }
    if (discoveries.has(entry.value.id)) {
      errors.push(`site ${entry.value.id} (${entry.path}): duplicate id, skipped`);
      continue;
    }
    discoveries.register(entry.value);
  }

  // Cross-reference pass: warn when content references an unregistered
  // region or faction. Warnings, not fatal - content can ship ahead of
  // its region / faction definition.
  for (const q of quests.all()) {
    if (q.region_id && !regions.has(q.region_id)) {
      errors.push(`quest ${q.id} references unregistered region ${q.region_id} (warning)`);
    }
    if (q.faction_id && !factions.has(q.faction_id)) {
      errors.push(`quest ${q.id} references unregistered faction ${q.faction_id} (warning)`);
    }
  }
  for (const n of npcs.all()) {
    if (n.home_region_id && !regions.has(n.home_region_id)) {
      errors.push(`npc ${n.id} references unregistered region ${n.home_region_id} (warning)`);
    }
    if (n.faction_id && !factions.has(n.faction_id)) {
      errors.push(`npc ${n.id} references unregistered faction ${n.faction_id} (warning)`);
    }
  }

  return {
    items,
    quests,
    npcs,
    factions,
    regions,
    enemies,
    discoveries,
    drops,
    errors,
    stats: {
      npcs: npcs.size(),
      items: items.size(),
      quests: quests.size(),
      drops: drops.length,
      factions: factions.size(),
      regions: regions.size(),
      enemies: enemies.size(),
      discoveries: discoveries.size(),
    },
  };
}
