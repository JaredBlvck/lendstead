// NPC-to-NPC interaction event mapper. Backend emits one npc_interaction
// event per adjacent-pair interaction on each cycle_advance. Types are
// CANONICAL at: conversation / treat / trade / teach (per Jr backend).

import type { CycleEvent } from '../types';

export type InteractionType = 'conversation' | 'treat' | 'teach' | 'trade' | 'report' | 'argument' | 'mishap';

const KNOWN_TYPES: InteractionType[] = ['conversation', 'treat', 'teach', 'trade', 'report', 'argument', 'mishap'];

export interface InteractionVFX {
  eventId: number;
  type: InteractionType;
  participantIds: [number, number];
  participantNames: [string, string];
  outcome: Record<string, unknown>;
  // teach-only: direction + progression payload
  teacherId?: number;
  learnerId?: number;
  skillLifted?: boolean;     // true when learner's skill incremented
  skillTo?: number;          // post-teach skill value
  seenAt: number;
  lifespanMs: number;
}

const LIFESPAN: Record<InteractionType, number> = {
  conversation: 2800,
  treat: 3800,
  teach: 3800,
  trade: 2800,
  report: 2500,
  argument: 3500,
  mishap: 4200,
};

export function toInteractionVFX(
  event: CycleEvent,
  firstSeen: Map<number, number>,
  now: number,
): InteractionVFX | null {
  if (event.kind !== 'npc_interaction') return null;
  const p = (event.payload || {}) as Record<string, unknown>;
  const participants = p.participants as Array<{ id: number; name: string }> | undefined;
  if (!participants || participants.length !== 2) return null;
  const rawType = String(p.type || 'conversation');
  const type: InteractionType = KNOWN_TYPES.includes(rawType as InteractionType)
    ? (rawType as InteractionType)
    : 'conversation';
  const seenAt = firstSeen.get(event.id) ?? now;
  firstSeen.set(event.id, seenAt);

  // Teach events carry teacher_id + learner_id + skill progression in outcome payload
  const outcome = (p.outcome as Record<string, unknown>) || {};
  const teacherId = typeof outcome.teacher_id === 'number' ? outcome.teacher_id : undefined;
  const learnerId = typeof outcome.learner_id === 'number' ? outcome.learner_id : undefined;
  const skillLifted = outcome.skill_lifted === true;
  const skillTo = typeof outcome.skill_to === 'number' ? outcome.skill_to : undefined;

  // Successful teach (skill_lifted) lasts longer - bigger narrative moment
  const lifespan = type === 'teach' && skillLifted ? 5000 : LIFESPAN[type];

  return {
    eventId: event.id,
    type,
    participantIds: [participants[0].id, participants[1].id],
    participantNames: [participants[0].name, participants[1].name],
    outcome,
    teacherId,
    learnerId,
    skillLifted,
    skillTo,
    seenAt,
    lifespanMs: lifespan,
  };
}

// Skill threshold crossings - when an NPC crosses skill 5 via mentorship
// they become a quest-giver. Fires a celebration on frontend.
export interface SkillThresholdVFX {
  eventId: number;
  npcId: number;
  npcName: string;
  skillTo: number;
  seenAt: number;
  lifespanMs: number;
}

export function toSkillThresholdVFX(
  event: CycleEvent,
  firstSeen: Map<number, number>,
  now: number,
): SkillThresholdVFX | null {
  if (event.kind !== 'skill_threshold_crossed') return null;
  const p = (event.payload || {}) as Record<string, unknown>;
  const npcId = typeof p.npc_id === 'number' ? p.npc_id : undefined;
  const npcName = typeof p.npc_name === 'string' ? p.npc_name : undefined;
  const skillTo = typeof p.skill_to === 'number' ? p.skill_to : undefined;
  if (npcId == null || !npcName || skillTo == null) return null;
  const seenAt = firstSeen.get(event.id) ?? now;
  firstSeen.set(event.id, seenAt);
  return {
    eventId: event.id,
    npcId,
    npcName,
    skillTo,
    seenAt,
    lifespanMs: 6000,
  };
}

export function buildSkillThresholdVFX(
  events: CycleEvent[],
  firstSeen: Map<number, number>,
  now: number,
): SkillThresholdVFX[] {
  const out: SkillThresholdVFX[] = [];
  for (const e of events) {
    const v = toSkillThresholdVFX(e, firstSeen, now);
    if (!v) continue;
    if (now - v.seenAt < v.lifespanMs) out.push(v);
  }
  return out;
}

export function buildInteractionVFX(
  events: CycleEvent[],
  firstSeen: Map<number, number>,
  now: number,
): InteractionVFX[] {
  const out: InteractionVFX[] = [];
  for (const e of events) {
    const v = toInteractionVFX(e, firstSeen, now);
    if (!v) continue;
    if (now - v.seenAt < v.lifespanMs) out.push(v);
  }
  return out;
}

export const INTERACTION_LABEL: Record<InteractionType, string> = {
  conversation: 'chatting',
  treat: 'tending wounds',
  teach: 'teaching',
  trade: 'trading',
  report: 'reporting',
  argument: 'arguing',
  mishap: 'accident!',
};

export const INTERACTION_COLOR: Record<InteractionType, string> = {
  conversation: '#5eead4',
  treat: '#ef4444',
  teach: '#fde047',
  trade: '#a78bfa',
  report: '#94a3b8',
  argument: '#f87171',
  mishap: '#f59e0b',
};
