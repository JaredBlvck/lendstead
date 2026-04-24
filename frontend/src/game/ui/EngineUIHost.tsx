// EngineUIHost: top-level mount for the in-game engine UI family
// (QuestLog, InventoryHUD, DialogueModal). Handles the "talk to" event
// stream from the 3D view via a simple imperative channel.
//
// Components outside the Canvas (which can't share React refs cleanly
// across the Three.js tree boundary) use window.__lendsteadTalkTo(npcId)
// to open the dialogue modal. That's the lightest-touch bridge until
// ExplorationView gets a proper refactor pass.

import { useEffect, useState, type CSSProperties } from 'react';
import { QuestLog } from './QuestLog';
import { InventoryHUD } from './InventoryHUD';
import { DialogueModal } from './DialogueModal';
import { CraftingPanel } from './CraftingPanel';

declare global {
  interface Window {
    __lendsteadTalkTo?: (npcId: string) => void;
  }
}

const styles: Record<string, CSSProperties> = {
  legendButton: {
    position: 'fixed',
    left: 16,
    top: 16,
    background: 'rgba(10, 14, 20, 0.9)',
    color: '#bac6d9',
    border: '1px solid #2c3442',
    borderRadius: 6,
    padding: '6px 10px',
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    fontSize: 11,
    cursor: 'pointer',
    zIndex: 901,
  },
};

export function EngineUIHost() {
  const [questLogOpen, setQuestLogOpen] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [dialogueNpc, setDialogueNpc] = useState<string | null>(null);

  useEffect(() => {
    window.__lendsteadTalkTo = (npcId: string) => setDialogueNpc(npcId);
    return () => {
      delete window.__lendsteadTalkTo;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'q' || e.key === 'Q') setQuestLogOpen((v) => !v);
      if (e.key === 'i' || e.key === 'I') setInventoryOpen((v) => !v);
      if (e.key === 'c' || e.key === 'C') setCraftingOpen((v) => !v);
      if (e.key === 'Escape') setDialogueNpc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {!questLogOpen && (
        <button style={styles.legendButton} onClick={() => setQuestLogOpen(true)}>
          quests (q)
        </button>
      )}
      <QuestLog open={questLogOpen} onToggle={() => setQuestLogOpen(false)} />
      {inventoryOpen && !craftingOpen && <InventoryHUD />}
      {craftingOpen && <CraftingPanel onClose={() => setCraftingOpen(false)} />}
      <DialogueModal npcId={dialogueNpc} onClose={() => setDialogueNpc(null)} />
    </>
  );
}
