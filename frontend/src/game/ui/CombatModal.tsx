// CombatModal. Click-to-attack encounter UI. Pure presentation; all
// combat math lives in combatResolver. Opens when EncounterHost
// receives a start_encounter signal (from backend threat_sighted via
// BackendEventRelay or a dev trigger).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useEngine } from '../engine/EngineContext';
import type { Enemy, EncounterState } from '../combat/enemyTypes';
import {
  resolveAttackRound,
  resolveFleeAttempt,
  startEncounter,
  type PlayerCombatStats,
} from '../combat/combatResolver';
import { rollDropTable } from '../drops/dropRoller';
import { addItem } from '../items/inventory';

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1300,
  },
  panel: {
    width: 'min(520px, 94vw)',
    background: 'rgba(10, 14, 20, 0.97)',
    color: '#e6edf7',
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    fontSize: 12,
    borderRadius: 10,
    border: '1px solid #8b3a2c',
    padding: 16,
    boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1px solid #2c3442',
  },
  title: { fontSize: 14, fontWeight: 700, color: '#f5a623' },
  hpRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  hpLabel: { minWidth: 60, fontSize: 11 },
  hpBar: {
    flex: 1,
    height: 10,
    background: '#1b2230',
    borderRadius: 3,
    border: '1px solid #2c3442',
    overflow: 'hidden',
  },
  hpFill: { height: '100%', transition: 'width 0.25s ease' },
  hpText: { fontSize: 10, minWidth: 44, textAlign: 'right' },
  log: {
    background: '#0c1118',
    padding: 8,
    borderRadius: 4,
    marginTop: 10,
    marginBottom: 10,
    maxHeight: 180,
    overflowY: 'auto',
    fontSize: 11,
    lineHeight: 1.5,
  },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  button: {
    padding: '6px 14px',
    background: '#8b3a2c',
    border: '1px solid #c85e47',
    color: '#fff',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  fleeBtn: {
    padding: '6px 14px',
    background: '#2a4a6b',
    border: '1px solid #3d6ba0',
    color: '#fff',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  outcomeVictory: { color: '#7bd88f', fontWeight: 700 },
  outcomeDefeat: { color: '#f5a623', fontWeight: 700 },
  outcomeFled: { color: '#bac6d9', fontStyle: 'italic' },
};

interface Props {
  enemy: Enemy;
  onClose: () => void;
}

function playerStatsFromEngine(
  combat: NonNullable<ReturnType<typeof useEngine>['state']['player']['combat']>,
): PlayerCombatStats {
  return {
    attack: combat.attack,
    defense: combat.defense,
    crit_chance: combat.crit_chance,
    dodge_chance: combat.dodge_chance,
    hp: combat.hp,
    max_hp: combat.max_hp,
  };
}

export function CombatModal({ enemy, onClose }: Props) {
  const engine = useEngine();
  const combatRef = useRef(engine.state.player.combat);
  const playerStats = playerStatsFromEngine(engine.state.player.combat!);
  const [state, setState] = useState<EncounterState>(() => startEncounter(enemy, playerStats));
  const [rewardsApplied, setRewardsApplied] = useState(false);
  const logBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.log.length]);

  // On victory, roll drops + emit defeat_enemy event + patch engine state
  useEffect(() => {
    if (state.outcome !== 'victory' || rewardsApplied) return;
    setRewardsApplied(true);

    let newInventory = engine.state.inventory;
    const granted: Array<{ item_id: string; qty: number }> = [];

    // Drop roll if the enemy has a drop table
    if (enemy.drop_table_id) {
      const table = engine.bundle.drops.find((d) => d.id === enemy.drop_table_id);
      if (table) {
        const drops = rollDropTable(table);
        for (const d of drops) {
          if (!engine.bundle.items.has(d.item_id)) continue;
          const res = addItem(newInventory, d.item_id, d.qty, engine.bundle.items.lookup);
          newInventory = res.inventory;
          granted.push({ item_id: d.item_id, qty: d.qty });
        }
      }
    }
    if (granted.length > 0) engine.setInventory(newInventory);

    // Sync final HP back to the engine so player doesn't re-heal on close
    if (combatRef.current) {
      engine.setPlayer({
        ...engine.state.player,
        combat: { ...combatRef.current, hp: state.player_hp },
      });
    }

    setState((s) => ({ ...s, rewards: granted, log: [...s.log, ...granted.map((g) => `You loot ${g.qty}x ${g.item_id}.`)] }));

    // Emit the defeat_enemy GameEvent for any quests tracking this kill
    window.__lendsteadEmitEvent?.({
      kind: 'defeat_enemy',
      payload: { enemy_id: enemy.id, level: enemy.level, region_id: enemy.spawn.region_ids[0] },
    });
  }, [state.outcome, rewardsApplied, enemy, engine, state.player_hp]);

  // On defeat, sync HP (probably 0) back to engine and let UI close
  useEffect(() => {
    if (state.outcome !== 'defeat') return;
    if (combatRef.current) {
      engine.setPlayer({
        ...engine.state.player,
        combat: { ...combatRef.current, hp: 0 },
      });
    }
  }, [state.outcome, engine]);

  const handleAttack = () => {
    const { state: next } = resolveAttackRound(state, enemy, {
      ...playerStats,
      hp: state.player_hp,
    });
    setState(next);
  };

  const handleFlee = () => {
    const next = resolveFleeAttempt(state, enemy, {
      ...playerStats,
      hp: state.player_hp,
    });
    setState(next);
  };

  const enemyPct = Math.round((state.enemy_hp / state.enemy_max_hp) * 100);
  const playerPct = Math.round((state.player_hp / state.player_max_hp) * 100);

  return (
    <div style={styles.backdrop}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.title}>{enemy.name}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Round {state.round}</div>
        </div>

        <div style={styles.hpRow}>
          <div style={styles.hpLabel}>{enemy.name}</div>
          <div style={styles.hpBar}>
            <div style={{ ...styles.hpFill, width: `${enemyPct}%`, background: '#8b3a2c' }} />
          </div>
          <div style={styles.hpText}>{state.enemy_hp}/{state.enemy_max_hp}</div>
        </div>
        <div style={styles.hpRow}>
          <div style={styles.hpLabel}>You</div>
          <div style={styles.hpBar}>
            <div style={{ ...styles.hpFill, width: `${playerPct}%`, background: '#7bd88f' }} />
          </div>
          <div style={styles.hpText}>{state.player_hp}/{state.player_max_hp}</div>
        </div>

        <div style={styles.log}>
          {state.log.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
          <div ref={logBottomRef} />
        </div>

        {state.outcome === 'in_progress' && (
          <div style={styles.actions}>
            <button style={styles.button} onClick={handleAttack}>attack</button>
            {enemy.fleeable && (
              <button style={styles.fleeBtn} onClick={handleFlee}>flee</button>
            )}
          </div>
        )}

        {state.outcome === 'victory' && (
          <div style={styles.actions}>
            <div style={{ flex: 1 }}>
              <div style={styles.outcomeVictory}>Victory.</div>
              {state.rewards && state.rewards.length > 0 && (
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 4 }}>
                  Loot: {state.rewards.map((r) => `${r.qty}x ${r.item_id}`).join(', ')}
                </div>
              )}
            </div>
            <button style={styles.fleeBtn} onClick={onClose}>close</button>
          </div>
        )}

        {state.outcome === 'defeat' && (
          <div style={styles.actions}>
            <div style={{ flex: 1, ...styles.outcomeDefeat }}>Defeated. Rest and recover.</div>
            <button style={styles.fleeBtn} onClick={onClose}>close</button>
          </div>
        )}

        {state.outcome === 'fled' && (
          <div style={styles.actions}>
            <div style={{ flex: 1, ...styles.outcomeFled }}>You live to fight another day.</div>
            <button style={styles.fleeBtn} onClick={onClose}>close</button>
          </div>
        )}
      </div>
    </div>
  );
}
