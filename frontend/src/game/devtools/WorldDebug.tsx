// Dev panel: inspect + edit world state.

import { useState } from 'react';
import type { WorldState } from '../world/worldState';
import {
  advanceCycle,
  adjustFactionReputation,
  setFlag,
  setInfrastructure,
  unlockRegion,
  upgradeSettlement,
  type SettlementLevel,
} from '../world/worldState';
import { devStyles } from './devPanelStyles';

interface Props {
  world: WorldState;
  onChange: (next: WorldState) => void;
}

const SETTLEMENT_LEVELS: SettlementLevel[] = [
  'stranded_camp',
  'working_camp',
  'first_village',
  'fortified_village',
  'trade_settlement',
  'island_holdfast',
  'lendstead_seat',
];

export function WorldDebug({ world, onChange }: Props) {
  const [flagKey, setFlagKey] = useState('debug_flag');
  const [infraKey, setInfraKey] = useState('campfire_built');
  const [regionId, setRegionId] = useState('region_reedwake_marsh');
  const [factionId, setFactionId] = useState('faction_founders');
  const [repDelta, setRepDelta] = useState('0.1');

  return (
    <div>
      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Cycle</div>
        <div style={devStyles.row}>
          <span>cycle</span><span>{world.cycle}</span>
        </div>
        <div style={devStyles.row}>
          <span>phase</span><span>{world.phase}</span>
        </div>
        <button style={devStyles.button} onClick={() => onChange(advanceCycle(world))}>
          advance phase
        </button>
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Stats</div>
        <div style={devStyles.row}><span>population</span><span>{world.population}</span></div>
        <div style={devStyles.row}><span>food</span><span>{world.food}</span></div>
        <div style={devStyles.row}><span>water</span><span>{world.water}</span></div>
        <div style={devStyles.row}><span>morale</span><span>{world.morale.toFixed(2)}</span></div>
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Settlement</div>
        <div style={devStyles.row}><span>level</span><span>{world.settlement_level}</span></div>
        {SETTLEMENT_LEVELS.map((lvl) => (
          <button
            key={lvl}
            style={devStyles.button}
            onClick={() => onChange(upgradeSettlement(world, lvl))}
            disabled={SETTLEMENT_LEVELS.indexOf(lvl) <= SETTLEMENT_LEVELS.indexOf(world.settlement_level)}
          >
            -&gt; {lvl.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Flags ({Object.keys(world.world_flags).length})</div>
        <input
          style={devStyles.input}
          value={flagKey}
          onChange={(e) => setFlagKey(e.target.value)}
          placeholder="flag key"
        />
        <button style={devStyles.button} onClick={() => onChange(setFlag(world, flagKey, true))}>set true</button>
        <button style={devStyles.button} onClick={() => onChange(setFlag(world, flagKey, false))}>set false</button>
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Infrastructure</div>
        <input
          style={devStyles.input}
          value={infraKey}
          onChange={(e) => setInfraKey(e.target.value)}
        />
        <button style={devStyles.button} onClick={() => onChange(setInfrastructure(world, infraKey, true))}>build</button>
        <button style={devStyles.button} onClick={() => onChange(setInfrastructure(world, infraKey, false))}>remove</button>
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Regions</div>
        <input
          style={devStyles.input}
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
        />
        <button style={devStyles.button} onClick={() => onChange(unlockRegion(world, regionId))}>unlock</button>
        <div style={{ ...devStyles.muted, marginTop: 4 }}>
          unlocked: {world.unlocked_region_ids.join(', ') || '(none)'}
        </div>
      </div>

      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Faction Reputation</div>
        <input
          style={devStyles.input}
          value={factionId}
          onChange={(e) => setFactionId(e.target.value)}
        />
        <input
          style={{ ...devStyles.input, marginTop: 4 }}
          value={repDelta}
          onChange={(e) => setRepDelta(e.target.value)}
          placeholder="delta e.g. 0.1 or -0.2"
        />
        <button
          style={devStyles.button}
          onClick={() => onChange(adjustFactionReputation(world, factionId, parseFloat(repDelta) || 0))}
        >
          apply delta
        </button>
        {world.faction_reputation.map((f) => (
          <div key={f.faction_id} style={devStyles.row}>
            <span>{f.faction_id}</span>
            <span>{f.tier} ({f.score.toFixed(2)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
