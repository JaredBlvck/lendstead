import { useMemo } from 'react';
import type { World, LogEntry } from '../types';
import { useQuests } from '../hooks/useWorld';

interface Props {
  world: World;
  logs: LogEntry[];
}

interface Milestone {
  label: string;
  at_cycle: number | null;
  achieved: boolean;
  description?: string;
}

const POP_STAGES = [
  { name: 'Camp', min: 0 },
  { name: 'Village', min: 10 },
  { name: 'Settlement', min: 25 },
  { name: 'City', min: 60 },
];

function deriveMilestones(world: World, logs: LogEntry[]): { completed: Milestone[]; active: Milestone[] } {
  const completed: Milestone[] = [];
  const active: Milestone[] = [];
  const pop = world.population;

  for (let i = 0; i < POP_STAGES.length; i++) {
    const s = POP_STAGES[i];
    if (pop >= s.min) {
      completed.push({ label: `Reached ${s.name}`, at_cycle: null, achieved: true, description: `Pop >= ${s.min}` });
    } else {
      active.push({ label: `Advance to ${s.name}`, at_cycle: null, achieved: false, description: `Need pop ${s.min} (currently ${pop})` });
    }
  }

  const infra = world.infrastructure || {};
  const checkKeys: Array<[RegExp, string]> = [
    [/smithy|forge/i, 'Smithy active'],
    [/palisade/i, 'Palisade built'],
    [/storm_shelter|shelter/i, 'Storm shelters deployed'],
    [/ember_spring|ember_spring_station/i, 'Ember Spring claimed'],
    [/watch_post|n_watch/i, 'Watch post established'],
    [/fishing_fleet|fishing_boats/i, 'Fishing fleet operational'],
    [/granary/i, 'Granary built'],
    [/cistern|well/i, 'Water storage built'],
    [/agriculture|irrigation|ag_field|seed_bank|tool_shed|nursery|plow/i, 'Agriculture tier active'],
  ];
  for (const [re, label] of checkKeys) {
    const found = Object.keys(infra).some((k) => re.test(k)) || Object.values(infra).some((v) => re.test(String(v)));
    if (found) completed.push({ label, at_cycle: null, achieved: true });
  }

  const breakthroughs = world.breakthroughs || [];
  for (const b of breakthroughs) {
    completed.push({
      label: `${b.leader.toUpperCase()} awakens: ${b.unlocks.replace(/_/g, ' ')}`,
      at_cycle: b.at_cycle,
      achieved: true,
    });
  }

  if (pop < 60) active.push({ label: 'Grow to City scale', at_cycle: null, achieved: false, description: `${60 - pop} more needed` });

  const recent = logs
    .filter((l) => l.leader !== 'auto')
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);
  for (const l of recent) {
    active.push({
      label: l.action,
      at_cycle: l.cycle,
      achieved: false,
      description: `${l.leader === 'sr' ? 'Sr' : 'Jr'} at C${l.cycle}`,
    });
  }

  return { completed, active };
}

export function ProgressionPanel({ world, logs }: Props) {
  const { completed, active } = useMemo(
    () => deriveMilestones(world, logs),
    [world, logs],
  );
  const acceptedQuests = useQuests('accepted');
  const completedQuests = useQuests('completed');

  return (
    <div className="progression-panel">
      <div className="prog-section">
        <div className="prog-title">ACTIVE QUESTS ({acceptedQuests.data?.length ?? 0})</div>
        {(!acceptedQuests.data || acceptedQuests.data.length === 0) && (
          <div className="prog-empty">No active quests. Click ? NPCs in 3D to pick one up.</div>
        )}
        {(acceptedQuests.data ?? []).slice(0, 10).map((q) => (
          <div key={q.id} className="prog-item active quest-item">
            <div className="prog-label">
              <span className="quest-npc-tag">{q.npc_name}</span> {q.quest_key.replace(/_/g, ' ')}
            </div>
            <div className="prog-desc">
              accepted C{q.accepted_cycle ?? '?'} {q.npc_role ? `· ${q.npc_role}` : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="prog-section">
        <div className="prog-title">ACTIVE MILESTONES</div>
        {active.length === 0 && <div className="prog-empty">All goals met.</div>}
        {active.slice(0, 8).map((m, i) => (
          <div key={`a${i}`} className="prog-item active">
            <div className="prog-label">{m.label}</div>
            {m.description && <div className="prog-desc">{m.description}</div>}
          </div>
        ))}
      </div>

      {(completedQuests.data?.length ?? 0) > 0 && (
        <div className="prog-section">
          <div className="prog-title">COMPLETED QUESTS ({completedQuests.data?.length ?? 0})</div>
          {(completedQuests.data ?? []).slice(0, 10).map((q) => (
            <div key={q.id} className="prog-item done quest-item">
              <div className="prog-label">
                <span className="prog-check">✓</span>
                <span className="quest-npc-tag">{q.npc_name}</span> {q.quest_key.replace(/_/g, ' ')}
              </div>
              {q.completed_cycle && (
                <div className="prog-desc">completed C{q.completed_cycle}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="prog-section">
        <div className="prog-title">COMPLETED MILESTONES</div>
        {completed.length === 0 && <div className="prog-empty">Nothing yet.</div>}
        {completed.slice(0, 10).map((m, i) => (
          <div key={`c${i}`} className="prog-item done">
            <div className="prog-label">
              <span className="prog-check">✓</span>
              {m.label}
            </div>
            {m.at_cycle != null && <div className="prog-desc">C{m.at_cycle}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
