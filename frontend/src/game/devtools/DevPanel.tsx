// Root DevPanel. Tabs through Movement / Quest / Item / Drop / NPC / World
// debug surfaces. Every sub-panel is presentational - parent owns state.

import { useState } from 'react';
import { devStyles } from './devPanelStyles';
import { MovementDebug, type MovementDebugFlags } from './MovementDebug';
import { QuestDebug } from './QuestDebug';
import { ItemDebug } from './ItemDebug';
import { DropDebug } from './DropDebug';
import { NPCDebug } from './NPCDebug';
import { WorldDebug } from './WorldDebug';

import type { MoverState } from '../movement/movementController';
import type { QuestRegistry } from '../quests/questEngine';
import type { PlayerQuestState } from '../quests/questState';
import type { Inventory, Equipment } from '../items/itemTypes';
import type { QuestRuntimeState } from '../quests/questTypes';
import type { ItemRegistry } from '../items/itemRegistry';
import type { NpcRegistry } from '../npcs/npcRegistry';
import type { NpcRuntimeState } from '../npcs/npcTypes';
import type { DropTable } from '../drops/dropTypes';
import type { WorldState } from '../world/worldState';

type Tab = 'movement' | 'quest' | 'item' | 'drop' | 'npc' | 'world';

export interface DevPanelProps {
  visible: boolean;
  onClose: () => void;

  // Movement
  mover?: MoverState;
  movementFlags: MovementDebugFlags;
  onMovementFlagsChange: (flags: MovementDebugFlags) => void;
  onTeleport?: (pos: { x: number; y: number }) => void;

  // Quests
  questRegistry: QuestRegistry;
  playerQuests: PlayerQuestState;
  onQuestStart: (runtime: QuestRuntimeState) => void;
  onQuestComplete: (runtime: QuestRuntimeState, world: WorldState, inventory: Inventory, notes: string[]) => void;
  onQuestFail: (runtime: QuestRuntimeState, world: WorldState) => void;

  // Items
  itemRegistry: ItemRegistry;
  inventory: Inventory;
  equipment: Equipment;
  onItemsChange: (inv: Inventory, eq: Equipment) => void;

  // Drops
  dropTables: DropTable[];

  // NPCs
  npcRegistry: NpcRegistry;
  npcRuntime: NpcRuntimeState[];
  onNpcRuntimeChange: (next: NpcRuntimeState[]) => void;

  // World
  world: WorldState;
  onWorldChange: (next: WorldState) => void;
  nowCycle: number;
}

export function DevPanel(props: DevPanelProps) {
  const [tab, setTab] = useState<Tab>('movement');
  if (!props.visible) return null;

  const tabs: Tab[] = ['movement', 'quest', 'item', 'drop', 'npc', 'world'];

  return (
    <div style={devStyles.panel}>
      <div style={devStyles.header}>
        <div style={devStyles.title}>Dev Panel</div>
        <button style={devStyles.button} onClick={props.onClose}>close</button>
      </div>
      <div style={devStyles.tabs}>
        {tabs.map((t) => (
          <button
            key={t}
            style={{ ...devStyles.tab, ...(tab === t ? devStyles.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'movement' && (
        <MovementDebug
          mover={props.mover}
          flags={props.movementFlags}
          onFlagsChange={props.onMovementFlagsChange}
          onTeleport={props.onTeleport}
        />
      )}
      {tab === 'quest' && (
        <QuestDebug
          registry={props.questRegistry}
          playerQuests={props.playerQuests}
          world={props.world}
          inventory={props.inventory}
          itemLookup={props.itemRegistry.lookup}
          nowCycle={props.nowCycle}
          onStart={props.onQuestStart}
          onComplete={props.onQuestComplete}
          onFail={props.onQuestFail}
        />
      )}
      {tab === 'item' && (
        <ItemDebug
          registry={props.itemRegistry}
          inventory={props.inventory}
          equipment={props.equipment}
          onChange={props.onItemsChange}
        />
      )}
      {tab === 'drop' && <DropDebug tables={props.dropTables} />}
      {tab === 'npc' && (
        <NPCDebug
          registry={props.npcRegistry}
          runtime={props.npcRuntime}
          onChange={props.onNpcRuntimeChange}
        />
      )}
      {tab === 'world' && (
        <WorldDebug world={props.world} onChange={props.onWorldChange} />
      )}
    </div>
  );
}
