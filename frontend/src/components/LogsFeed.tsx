import type { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

export function LogsFeed({ logs }: Props) {
  const sorted = [...logs].sort((a, b) => b.id - a.id);

  return (
    <div className="card logs">
      <h2>Decisions & Actions ({logs.length})</h2>
      {sorted.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No decisions logged yet.</div>
      )}
      {sorted.map((log) => (
        <div key={log.id} className={`log-entry ${log.leader}`}>
          <div className="head">
            <span>
              Cycle {log.cycle} · {log.leader === 'sr' ? 'Sr (Opportunist)' : 'Jr (Architect)'}
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
