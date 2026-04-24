// In-game Quest Log. Shows active + completed quests with objective
// progress. Collapsible. Reads directly from the engine context.

import { useState } from 'react';
import { useEngine } from '../engine/EngineContext';
import { PlayerQuestState } from '../quests/questState';
import type { Quest } from '../quests/questTypes';

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'fixed',
    left: 16,
    top: 80,
    width: 280,
    maxHeight: 'calc(100vh - 96px)',
    overflowY: 'auto',
    background: 'rgba(10, 14, 20, 0.9)',
    color: '#e6edf7',
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    fontSize: 12,
    borderRadius: 8,
    border: '1px solid #2c3442',
    zIndex: 900,
    padding: 10,
  },
  title: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.7 },
  quest: { marginTop: 8, padding: 6, background: '#141a25', borderRadius: 4 },
  objective: { display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' },
  done: { color: '#7bd88f' },
  sectionTitle: {
    fontSize: 10,
    color: '#8aa4c4',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  toggle: {
    background: 'transparent',
    border: '1px solid #3d6ba0',
    color: '#bac6d9',
    borderRadius: 4,
    padding: '2px 6px',
    cursor: 'pointer',
    fontSize: 10,
  },
};

interface Props {
  open?: boolean;
  onToggle?: () => void;
}

export function QuestLog({ open = true, onToggle }: Props) {
  const engine = useEngine();
  const playerQuests = new PlayerQuestState(engine.state.questRuntime);
  const [expanded, setExpanded] = useState<string | null>(null);
  const active = playerQuests.active();
  const completed = playerQuests.completed();

  if (!open) return null;

  const renderQuest = (questId: string, isActive: boolean) => {
    const q = engine.bundle.quests.get(questId);
    if (!q) return null;
    const rt = playerQuests.get(questId);
    if (!rt) return null;
    const isOpen = expanded === questId;
    return (
      <div key={questId} style={styles.quest}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setExpanded(isOpen ? null : questId)}
        >
          <span style={isActive ? {} : styles.done}>{q.title}</span>
          <span style={{ opacity: 0.6 }}>
            {rt.objectives.filter((o) => o.completed).length}/{q.objectives.length}
          </span>
        </div>
        {isOpen && (
          <>
            <div style={{ marginTop: 4, fontSize: 10, opacity: 0.7 }}>{q.summary}</div>
            {q.objectives.map((o) => {
              const p = rt.objectives.find((x) => x.id === o.id)!;
              if (o.hidden && !p.completed && p.current === 0) return null;
              return (
                <div key={o.id} style={{ ...styles.objective, ...(p.completed ? styles.done : {}) }}>
                  <span>{o.description ?? o.id}</span>
                  <span>{p.current}/{o.count}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.title}>Quest Log</div>
        {onToggle && <button style={styles.toggle} onClick={onToggle}>hide</button>}
      </div>
      {active.length > 0 && (
        <>
          <div style={styles.sectionTitle}>Active ({active.length})</div>
          {active.map((r) => renderQuest(r.quest_id, true))}
        </>
      )}
      {completed.length > 0 && (
        <>
          <div style={styles.sectionTitle}>Completed ({completed.length})</div>
          {completed.map((r) => renderQuest(r.quest_id, false))}
        </>
      )}
      {active.length === 0 && completed.length === 0 && (
        <div style={{ opacity: 0.5, marginTop: 8 }}>No quests accepted yet.</div>
      )}
    </div>
  );
}

// Convenience: quest of interest for debug inspection
export type _ = Quest;
