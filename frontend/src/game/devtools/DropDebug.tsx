// Dev panel: simulate drop tables 1/10/100/1000 times.

import { useState } from 'react';
import type { DropTable } from '../drops/dropTypes';
import { rollDropTable, simulateDrops, seededRandom } from '../drops/dropRoller';
import { devStyles } from './devPanelStyles';

interface Props {
  tables: DropTable[];
}

export function DropDebug({ tables }: Props) {
  const [selectedId, setSelectedId] = useState<string>(tables[0]?.id ?? '');
  const [conditions, setConditions] = useState('');
  const [luck, setLuck] = useState('1');
  const [lastResult, setLastResult] = useState<Array<{ item_id: string; qty: number; pool: string }> | null>(null);
  const [simStats, setSimStats] = useState<{
    rolls: number;
    totals: Record<string, number>;
    perPool: Record<string, number>;
  } | null>(null);

  const table = tables.find((t) => t.id === selectedId);

  const runSim = (n: number) => {
    if (!table) return;
    const stats = simulateDrops(table, n, {
      random: seededRandom(Date.now()),
      activeConditions: conditions.split(',').map((s) => s.trim()).filter(Boolean),
      luck: parseFloat(luck) || 1,
    });
    setSimStats({ rolls: n, totals: stats.totals, perPool: stats.perPool });
  };

  const runOnce = () => {
    if (!table) return;
    const drops = rollDropTable(table, {
      activeConditions: conditions.split(',').map((s) => s.trim()).filter(Boolean),
      luck: parseFloat(luck) || 1,
    });
    setLastResult(drops);
  };

  return (
    <div>
      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Drop Table</div>
        <select
          style={devStyles.input}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {tables.map((t) => (
            <option key={t.id} value={t.id}>{t.id} ({t.source_name})</option>
          ))}
        </select>
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Modifiers</div>
        <input
          style={devStyles.input}
          placeholder="conditions, comma-separated"
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
        />
        <input
          style={{ ...devStyles.input, marginTop: 4 }}
          placeholder="luck (default 1)"
          value={luck}
          onChange={(e) => setLuck(e.target.value)}
        />
      </div>

      <div style={devStyles.section}>
        <button style={devStyles.button} onClick={runOnce}>roll 1x</button>
        <button style={devStyles.button} onClick={() => runSim(10)}>sim 10</button>
        <button style={devStyles.button} onClick={() => runSim(100)}>sim 100</button>
        <button style={devStyles.button} onClick={() => runSim(1000)}>sim 1000</button>
      </div>

      {lastResult && (
        <div style={devStyles.section}>
          <div style={devStyles.sectionTitle}>Last Roll</div>
          {lastResult.length === 0 ? (
            <div style={devStyles.muted}>(empty)</div>
          ) : lastResult.map((d, i) => (
            <div key={i} style={devStyles.row}>
              <span>{d.item_id} x{d.qty}</span>
              <span style={devStyles.muted}>{d.pool}</span>
            </div>
          ))}
        </div>
      )}

      {simStats && (
        <div style={devStyles.section}>
          <div style={devStyles.sectionTitle}>Simulation ({simStats.rolls} rolls)</div>
          {Object.entries(simStats.totals).map(([id, qty]) => (
            <div key={id} style={devStyles.row}>
              <span>{id}</span>
              <span>{qty} total ({(qty / simStats.rolls).toFixed(2)}/roll)</span>
            </div>
          ))}
          <div style={devStyles.sectionTitle}>By pool</div>
          {Object.entries(simStats.perPool).map(([pool, hits]) => (
            <div key={pool} style={devStyles.row}>
              <span>{pool}</span>
              <span>{hits} ({((hits / simStats.rolls) * 100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
