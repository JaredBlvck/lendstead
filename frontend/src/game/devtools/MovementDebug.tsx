// Dev panel: movement inspector. Shows mover state, teleport, and grid
// visualization toggles the parent Canvas can read.

import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { MoverState } from '../movement/movementController';
import { devStyles } from './devPanelStyles';

export interface MovementDebugFlags {
  showWalkable: boolean;
  showBlocked: boolean;
  showPath: boolean;
}

interface Props {
  mover?: MoverState;
  flags: MovementDebugFlags;
  onFlagsChange: (flags: MovementDebugFlags) => void;
  onTeleport?: (pos: { x: number; y: number }) => void;
}

export function MovementDebug({ mover, flags, onFlagsChange, onTeleport }: Props) {
  const [tpX, setTpX] = useState('0');
  const [tpY, setTpY] = useState('0');

  const toggle = (key: keyof MovementDebugFlags) => {
    onFlagsChange({ ...flags, [key]: !flags[key] });
  };

  const pillStyle = (active: boolean): CSSProperties => ({
    ...devStyles.button,
    background: active ? '#3d6ba0' : '#1b2230',
  });

  return (
    <div>
      <div style={devStyles.section}>
        <div style={devStyles.sectionTitle}>Overlays</div>
        <button style={pillStyle(flags.showWalkable)} onClick={() => toggle('showWalkable')}>walkable</button>
        <button style={pillStyle(flags.showBlocked)} onClick={() => toggle('showBlocked')}>blocked</button>
        <button style={pillStyle(flags.showPath)} onClick={() => toggle('showPath')}>path</button>
      </div>

      {mover && (
        <div style={devStyles.section}>
          <div style={devStyles.sectionTitle}>Player mover</div>
          <div style={devStyles.row}>
            <span>position</span>
            <span>({mover.position.x.toFixed(2)}, {mover.position.y.toFixed(2)})</span>
          </div>
          <div style={devStyles.row}>
            <span>arrived</span>
            <span style={mover.arrived ? devStyles.good : devStyles.warn}>{String(mover.arrived)}</span>
          </div>
          <div style={devStyles.row}>
            <span>path length</span>
            <span>{mover.path.length}</span>
          </div>
          <div style={devStyles.row}>
            <span>speed (tiles/s)</span>
            <span>{mover.speed_tiles_per_sec.toFixed(1)}</span>
          </div>
        </div>
      )}

      {onTeleport && (
        <div style={devStyles.section}>
          <div style={devStyles.sectionTitle}>Teleport player</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input style={devStyles.input} value={tpX} onChange={(e) => setTpX(e.target.value)} placeholder="x" />
            <input style={devStyles.input} value={tpY} onChange={(e) => setTpY(e.target.value)} placeholder="y" />
          </div>
          <button
            style={devStyles.button}
            onClick={() => onTeleport({ x: parseInt(tpX, 10) || 0, y: parseInt(tpY, 10) || 0 })}
          >
            teleport
          </button>
        </div>
      )}
    </div>
  );
}
