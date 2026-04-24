import { describe, it, expect } from 'vitest';
import { validateQuest, validateQuests } from '../quests/questValidator';
import { quest_template_do_not_ship } from '../../content/quests/_template';

describe('questValidator', () => {
  it('accepts the template quest', () => {
    const r = validateQuest(quest_template_do_not_ship);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects a quest missing required id', () => {
    const bad = { ...quest_template_do_not_ship, id: undefined };
    const r = validateQuest(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects a quest with id that does not start with quest_', () => {
    const bad = { ...quest_template_do_not_ship, id: 'hero_quest' };
    const r = validateQuest(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('must start with quest_');
  });

  it('rejects duplicate objective ids', () => {
    const bad = {
      ...quest_template_do_not_ship,
      objectives: [
        { id: 'obj_one', kind: 'reach_tile' as const, target: { x: 0, y: 0 }, count: 1, hidden: false },
        { id: 'obj_one', kind: 'reach_tile' as const, target: { x: 1, y: 1 }, count: 1, hidden: false },
      ],
    };
    const r = validateQuest(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('duplicate objective id');
  });

  it('rejects a choice at an unknown objective', () => {
    const bad = {
      ...quest_template_do_not_ship,
      choices: [
        {
          at_objective: 'obj_nonexistent',
          options: [
            { id: 'choice_a', label: 'A', moral_weight: 0, unlocks_objectives: [], completes_objectives: [], extra_rewards: [] },
          ],
        },
      ],
    };
    const r = validateQuest(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('unknown objective');
  });

  it('rejects invalid objective kind', () => {
    const bad = {
      ...quest_template_do_not_ship,
      objectives: [
        { id: 'obj_fake', kind: 'eat_cake', target: {}, count: 1, hidden: false },
      ],
    };
    const r = validateQuest(bad);
    expect(r.ok).toBe(false);
  });

  it('bulk validator splits valid + invalid', () => {
    const r = validateQuests([
      quest_template_do_not_ship,
      { id: 'hero_bad' }, // invalid
      quest_template_do_not_ship,
    ]);
    expect(r.valid.length).toBe(2);
    expect(r.invalid.length).toBe(1);
    expect(r.invalid[0].index).toBe(1);
  });
});
