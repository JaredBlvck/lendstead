import { describe, it, expect } from 'vitest';
import { translateBackendEvent } from '../engine/BackendEventRelay';
import type { CycleEvent } from '../../types';

function mkEvent(kind: string, payload: Record<string, unknown>, id = 1): CycleEvent {
  return {
    id,
    cycle: 1,
    kind,
    payload,
    created_at: new Date().toISOString(),
  };
}

describe('BackendEventRelay.translateBackendEvent', () => {
  it('translates skill_threshold_crossed into a reach_skill GameEvent', () => {
    const out = translateBackendEvent(
      mkEvent('skill_threshold_crossed', {
        npc_id: 'npc_iwen_healer',
        skill_from: 4,
        skill_to: 5,
        threshold: 'quest_giver',
      }),
    );
    expect(out.gameEvents).toHaveLength(1);
    expect(out.gameEvents[0].kind).toBe('reach_skill');
    expect(out.gameEvents[0].payload.skill).toBe('teaching');
    expect(out.gameEvents[0].payload.level).toBe(5);
    expect(out.gameEvents[0].payload.npc_id).toBe('npc_iwen_healer');
    expect(Object.keys(out.worldFlags)).toHaveLength(0);
  });

  it('translates storm to survive_event with severity', () => {
    const out = translateBackendEvent(mkEvent('storm', { severity: 'major' }));
    expect(out.gameEvents).toHaveLength(1);
    expect(out.gameEvents[0].kind).toBe('survive_event');
    expect(out.gameEvents[0].payload).toEqual({ event_kind: 'storm', severity: 'major' });
  });

  it('storm_ended also surfaces as a survive_event', () => {
    const out = translateBackendEvent(mkEvent('storm_ended', {}));
    expect(out.gameEvents[0].kind).toBe('survive_event');
    expect(out.gameEvents[0].payload.severity).toBe('minor');   // default
  });

  it('affinity_milestone sets a world flag keyed by pair ids', () => {
    const out = translateBackendEvent(
      mkEvent('affinity_milestone', { pair: ['npc_a', 'npc_b'], tier: 'bonded' }),
    );
    expect(out.gameEvents).toHaveLength(0);
    expect(out.worldFlags['affinity_milestone_npc_a_npc_b']).toBe(true);
  });

  it('conflict_argument sets a world flag keyed by npc id', () => {
    const out = translateBackendEvent(
      mkEvent('conflict_argument', { npc_id: 'npc_iwen_healer' }),
    );
    expect(out.worldFlags['conflict_conflict_argument_npc_iwen_healer']).toBe(true);
  });

  it('conflict_mishap falls back to source_npc_id when npc_id is absent', () => {
    const out = translateBackendEvent(
      mkEvent('conflict_mishap', { source_npc_id: 'npc_oren' }),
    );
    expect(out.worldFlags['conflict_conflict_mishap_npc_oren']).toBe(true);
  });

  it('unknown kinds produce no events and no flags', () => {
    const out = translateBackendEvent(mkEvent('some_future_backend_kind', { foo: 'bar' }));
    expect(out.gameEvents).toEqual([]);
    expect(out.worldFlags).toEqual({});
  });

  it('handles missing payload gracefully', () => {
    const event: CycleEvent = {
      id: 1,
      cycle: 1,
      kind: 'skill_threshold_crossed',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: undefined as any,
      created_at: new Date().toISOString(),
    };
    const out = translateBackendEvent(event);
    expect(out.gameEvents[0].payload.level).toBe(0);
    expect(out.gameEvents[0].payload.npc_id).toBeUndefined();
  });
});
