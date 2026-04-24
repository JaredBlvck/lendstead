import { useEffect } from 'react';
import type { NPC } from '../types';

interface Props {
  npc: NPC;
  screenX: number;
  screenY: number;
  onAction: (action: 'examine' | 'follow' | 'walk_to' | 'close') => void;
  onClose: () => void;
}

const ACTIONS: Array<{ key: 'examine' | 'follow' | 'walk_to'; label: string }> = [
  { key: 'examine', label: 'Examine' },
  { key: 'walk_to', label: 'Walk to' },
  { key: 'follow', label: 'Follow' },
];

export function VerbMenu({ npc, screenX, screenY, onAction, onClose }: Props) {
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.verb-menu')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="verb-menu"
      style={{ left: screenX, top: screenY }}
    >
      <div className="verb-menu-head">
        <span className={`verb-menu-lane ${npc.lane}`}>
          {npc.lane === 'sr' ? 'SR' : 'JR'}
        </span>
        <span className="verb-menu-name">{npc.name}</span>
      </div>
      {ACTIONS.map((a) => (
        <button
          key={a.key}
          type="button"
          className="verb-menu-item"
          onMouseDown={(e) => {
            e.stopPropagation();
            onAction(a.key);
          }}
        >
          {a.label} <span className="verb-menu-target">{npc.name}</span>
        </button>
      ))}
      <button
        type="button"
        className="verb-menu-item verb-menu-cancel"
        onMouseDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        Cancel
      </button>
    </div>
  );
}
