// Per-player quest state bag. Tracks all QuestRuntimeState rows for a
// player (accepted, active, completed, failed, declined) and exposes
// helpers for the engine + UI.

import type { QuestRuntimeState, QuestStatus } from './questTypes';

export class PlayerQuestState {
  private byId = new Map<string, QuestRuntimeState>();

  constructor(rows: QuestRuntimeState[] = []) {
    for (const r of rows) this.byId.set(r.quest_id, r);
  }

  get(questId: string): QuestRuntimeState | undefined {
    return this.byId.get(questId);
  }

  has(questId: string): boolean {
    return this.byId.has(questId);
  }

  set(row: QuestRuntimeState): PlayerQuestState {
    const next = new PlayerQuestState(Array.from(this.byId.values()));
    next.byId.set(row.quest_id, row);
    return next;
  }

  remove(questId: string): PlayerQuestState {
    const next = new PlayerQuestState(Array.from(this.byId.values()));
    next.byId.delete(questId);
    return next;
  }

  all(): QuestRuntimeState[] {
    return Array.from(this.byId.values());
  }

  byStatus(status: QuestStatus): QuestRuntimeState[] {
    return this.all().filter((r) => r.status === status);
  }

  active(): QuestRuntimeState[] {
    return this.all().filter((r) => r.status === 'accepted' || r.status === 'active');
  }

  completed(): QuestRuntimeState[] {
    return this.byStatus('completed');
  }
}
