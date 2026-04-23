import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

export function LogsFeed({ logs }: Props) {
  const sorted = [...logs].sort((a, b) => b.id - a.id);
  const seenIds = useRef<Set<number>>(new Set());
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    const newOnes = new Set<number>();
    sorted.forEach((l) => {
      if (!seenIds.current.has(l.id)) {
        newOnes.add(l.id);
        seenIds.current.add(l.id);
      }
    });
    if (newOnes.size > 0) {
      setFresh(newOnes);
      const t = window.setTimeout(() => setFresh(new Set()), 2400);
      return () => window.clearTimeout(t);
    }
  }, [sorted]);

  return (
    <div className="card logs">
      <h2>Decisions &amp; Actions ({logs.length})</h2>
      {sorted.length === 0 && (
        <div className="empty-hint">No decisions logged yet.</div>
      )}
      {sorted.map((log) => (
        <div
          key={log.id}
          className={`log-entry ${log.leader} ${fresh.has(log.id) ? 'fresh' : ''}`}
        >
          <div className="head">
            <span>
              <span className={`lane-icon ${log.leader}`}>
                {log.leader === 'sr' ? 'S' : 'J'}
              </span>
              Cycle {log.cycle} &middot;{' '}
              {log.leader === 'sr' ? 'Sr (Opportunist)' : 'Jr (Architect)'}
            </span>
            <span>{new Date(log.created_at).toLocaleTimeString()}</span>
          </div>
          <div className="action">{log.action}</div>
          {log.reasoning && <div className="reasoning">{log.reasoning}</div>}
        </div>
      ))}
    </div>
  );
}
