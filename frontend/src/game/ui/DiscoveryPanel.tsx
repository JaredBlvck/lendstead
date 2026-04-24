// Discovery / Carvings panel. Lists DiscoverySites in the player's
// current region (per engine.state.player.region_id). Inspect button
// per site runs the pure runtime, grants the fragment item on reveal,
// emits a collect_carving GameEvent for quest objectives to observe.
//
// Bound to hotkey 'K' (Knowledge) through EngineUIHost.

import { useMemo, useState, type CSSProperties } from 'react';
import { useEngine } from '../engine/EngineContext';
import { inspectSite, isConditionMet } from '../archaeology/discoveryRuntime';
import { addItem } from '../items/inventory';

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'fixed',
    left: '50%',
    top: 80,
    transform: 'translateX(-50%)',
    width: 'min(480px, 94vw)',
    maxHeight: '70vh',
    overflowY: 'auto',
    background: 'rgba(10, 14, 20, 0.94)',
    color: '#e6edf7',
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    fontSize: 12,
    borderRadius: 10,
    border: '1px solid #3d6ba0',
    padding: 14,
    zIndex: 950,
    boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid #2c3442',
  },
  title: { fontSize: 14, fontWeight: 700, letterSpacing: 0.4 },
  site: {
    padding: 8,
    marginBottom: 6,
    background: '#141a25',
    borderRadius: 4,
  },
  siteTitle: { fontSize: 12, fontWeight: 600 },
  small: { fontSize: 10, opacity: 0.7 },
  lore: { fontSize: 11, marginTop: 6, lineHeight: 1.5, fontStyle: 'italic', color: '#c9d5e6' },
  button: {
    marginTop: 6,
    padding: '3px 10px',
    background: '#2a4a6b',
    border: '1px solid #3d6ba0',
    color: '#fff',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
  },
  close: {
    background: 'transparent',
    border: '1px solid #3d6ba0',
    color: '#bac6d9',
    borderRadius: 3,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
  },
  disabled: {
    background: '#202731',
    borderColor: '#2c3442',
    color: '#8aa4c4',
    cursor: 'not-allowed',
  },
  revealed: { color: '#7bd88f' },
  note: { marginTop: 6, fontSize: 10, opacity: 0.75 },
};

interface Props {
  onClose: () => void;
}

export function DiscoveryPanel({ onClose }: Props) {
  const engine = useEngine();
  const regionId = engine.state.player.region_id;

  const sites = useMemo(
    () => (regionId ? engine.bundle.discoveries.byRegion(regionId) : []),
    [engine.bundle.discoveries, regionId],
  );
  const [notes, setNotes] = useState<Record<string, string>>({});

  const inspect = (siteId: string) => {
    const site = engine.bundle.discoveries.get(siteId);
    if (!site) return;
    const prevState = engine.state.discoveryStates.find((d) => d.site_id === siteId);
    const outcome = inspectSite(site, prevState, engine.state.world);

    engine.upsertDiscoveryState(outcome.next_state);

    if (!outcome.ok) {
      setNotes({ ...notes, [siteId]: outcome.reason ?? 'nothing yet' });
      return;
    }

    if (outcome.revealed) {
      // Grant fragment item if the site ships one
      if (outcome.fragment_item_id && engine.bundle.items.has(outcome.fragment_item_id)) {
        const add = addItem(engine.state.inventory, outcome.fragment_item_id, 1, engine.bundle.items.lookup);
        engine.setInventory(add.inventory);
      }
      // Emit the collect_carving event for quest objectives to observe
      if (site.kind === 'carving') {
        window.__lendsteadEmitEvent?.({
          kind: 'collect_carving',
          payload: {
            site_id: site.id,
            region_id: site.region_id,
            fragment_item_id: outcome.fragment_item_id,
          },
        });
      }
      setNotes({
        ...notes,
        [siteId]: outcome.fragment_item_id ? `Revealed. Found ${outcome.fragment_item_id}.` : 'Revealed.',
      });
    } else if (outcome.already_revealed) {
      setNotes({ ...notes, [siteId]: 'Already revealed. Lore re-read.' });
    } else {
      setNotes({ ...notes, [siteId]: 'You find nothing new. Try again later.' });
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Discoveries</div>
          <div style={styles.small}>region: {regionId ?? '(unset)'}</div>
        </div>
        <button style={styles.close} onClick={onClose}>close</button>
      </div>

      {sites.length === 0 && (
        <div style={{ opacity: 0.6 }}>
          No known sites in this region. Explore and return.
        </div>
      )}

      {sites.map((site) => {
        const state = engine.state.discoveryStates.find((d) => d.site_id === site.id);
        const canInspect = isConditionMet(site.reveal_condition, engine.state.world);
        const revealed = state?.revealed === true;
        return (
          <div key={site.id} style={styles.site}>
            <div style={styles.siteTitle}>
              {site.title}
              {revealed && <span style={{ ...styles.revealed, marginLeft: 6 }}>(read)</span>}
            </div>
            <div style={styles.small}>
              {site.kind} - tile ({site.tile.x}, {site.tile.y}) - reveal_chance {Math.round(site.reveal_chance * 100)}%
            </div>
            {revealed && <div style={styles.lore}>{site.lore_text}</div>}
            <button
              style={{ ...styles.button, ...(canInspect ? {} : styles.disabled) }}
              onClick={() => canInspect && inspect(site.id)}
              disabled={!canInspect}
            >
              inspect
            </button>
            {notes[site.id] && <div style={styles.note}>{notes[site.id]}</div>}
          </div>
        );
      })}
    </div>
  );
}
