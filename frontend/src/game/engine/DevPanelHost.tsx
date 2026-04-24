// DevPanelHost: mounts the DevPanel, handles the hotkey toggle (~), and
// glues engine state into the panel's inputs. Lives in App so the panel
// renders over the whole UI.

import { useEffect, useState } from 'react';
import { DevPanel } from '../devtools/DevPanel';
import type { MovementDebugFlags } from '../devtools/MovementDebug';
import { useEngine } from './EngineContext';
import { PlayerQuestState } from '../quests/questState';

export function DevPanelHost() {
  const engine = useEngine();
  const [visible, setVisible] = useState(false);
  const [movementFlags, setMovementFlags] = useState<MovementDebugFlags>({
    showWalkable: false,
    showBlocked: false,
    showPath: false,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Backtick toggles the dev panel
      if (e.key === '`' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Ignore if the user is typing in an input
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const playerQuests = new PlayerQuestState(engine.state.questRuntime);

  return (
    <DevPanel
      visible={visible}
      onClose={() => setVisible(false)}
      movementFlags={movementFlags}
      onMovementFlagsChange={setMovementFlags}
      onTeleport={(pos) => engine.setPlayer({ ...engine.state.player, location: pos })}
      questRegistry={engine.bundle.quests}
      playerQuests={playerQuests}
      onQuestStart={(runtime) => engine.upsertQuestRuntime(runtime)}
      onQuestComplete={(runtime, world, inventory, _notes) => {
        engine.upsertQuestRuntime(runtime);
        engine.setWorld(world);
        engine.setInventory(inventory);
      }}
      onQuestFail={(runtime, world) => {
        engine.upsertQuestRuntime(runtime);
        engine.setWorld(world);
      }}
      itemRegistry={engine.bundle.items}
      inventory={engine.state.inventory}
      equipment={engine.state.equipment}
      onItemsChange={(inv, eq) => {
        engine.setInventory(inv);
        engine.setEquipment(eq);
      }}
      dropTables={engine.bundle.drops}
      npcRegistry={engine.bundle.npcs}
      npcRuntime={engine.state.npcRuntime}
      onNpcRuntimeChange={engine.setNpcRuntime}
      world={engine.state.world}
      onWorldChange={engine.setWorld}
      nowCycle={engine.state.world.cycle}
    />
  );
}
