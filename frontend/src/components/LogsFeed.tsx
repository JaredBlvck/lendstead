import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

function laneClass(leader: LogEntry['leader']): string {
  if (leader === 'sr') return 'sr';
  if (leader === 'jr') return 'jr';
  return 'auto';
}

function laneLabel(leader: LogEntry['leader']): string {
  if (leader === 'sr') return 'Sr (Opportunist)';
  if (leader === 'jr') return 'Jr (Architect)';
  return 'Engine (auto)';
}

function laneIconChar(leader: LogEntry['leader']): string {
  if (leader === 'sr') return 'S';
  if (leader === 'jr') return 'J';
  return 'A';
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
      {sorted.map((log) => {
        const lane = laneClass(log.leader);
        const severityClass = log.severity ? `sev-${log.severity}` : '';
        const linked = log.cause_event_id != null || log.cause_log_id != null;
        const classes = [
          'log-entry',
          lane,
          fresh.has(log.id) && 'fresh',
          severityClass,
          linked && 'has-cause',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div key={log.id} className={classes}>
            <div className="head">
              <span>
                <span className={`lane-icon ${lane}`}>{laneIconChar(log.leader)}</span>
                Cycle {log.cycle} &middot; {laneLabel(log.leader)}
                {log.severity && (
                  <span className={`severity-tag ${severityClass}`}>
                    {log.severity.toUpperCase()}
                  </span>
                )}
              </span>
              <span>{new Date(log.created_at).toLocaleTimeString()}</span>
            </div>
            <div className="action">{log.action}</div>
            {log.reasoning && <div className="reasoning">{log.reasoning}</div>}
            {linked && (
              <div className="cause-hint">
                caused by
                {log.cause_event_id != null && ` event #${log.cause_event_id}`}
                {log.cause_log_id != null && ` log #${log.cause_log_id}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
