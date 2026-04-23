// Display-layer event shape. Backend is now the source of truth via
// /api/events; we convert its storm / discovery / threat_sighted events
// into a small display model the map renderer consumes. Each event gets
// a client-side `seenAt` so first-observation controls fade-in/out - that
// way existing events on refresh don't all spawn at once.

import type { CycleEvent } from '../types';

export type DisplayEventKind = 'storm' | 'discovery' | 'threat';

export type EventSeverity = 'minor' | 'moderate' | 'critical';

export interface DisplayEvent {
  id: string;
  kind: DisplayEventKind;
  x: number;
  y: number;
  radius: number;
  label: string;
  seenAt: number;
  lifespanMs: number;
  severity: EventSeverity;
}

const LIFESPAN: Record<DisplayEventKind, number> = {
  storm: 12000,
  discovery: 14000,
  threat: 9000,
};

function asXY(v: unknown): [number, number] | null {
  if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
    return [v[0], v[1]];
  }
  return null;
}

// Convert a backend CycleEvent into a DisplayEvent, or null if the event
// kind isn't one we render.
export function toDisplayEvent(
  event: CycleEvent,
  firstSeen: Map<number, number>,
  now: number,
): DisplayEvent | null {
  const payload = (event.payload || {}) as Record<string, unknown>;

  let kind: DisplayEventKind;
  if (event.kind === 'storm') kind = 'storm';
  else if (event.kind === 'discovery') kind = 'discovery';
  else if (event.kind === 'threat_sighted' || event.kind === 'threat') kind = 'threat';
  else return null;

  // Position preference: center, tile, first affected tile
  let xy =
    asXY(payload.center) ||
    asXY(payload.tile) ||
    asXY((payload.affected_tiles as unknown[])?.[0]);
  if (!xy) return null;

  const severity: EventSeverity =
    payload.severity === 'critical' || payload.severity === 'moderate' || payload.severity === 'minor'
      ? (payload.severity as EventSeverity)
      : 'moderate';

  // Severity scales the visual radius: minor 0.75x, moderate 1x, critical 1.4x
  const severityScale = severity === 'critical' ? 1.4 : severity === 'minor' ? 0.75 : 1;
  const baseRadius =
    typeof payload.radius === 'number'
      ? payload.radius
      : kind === 'storm'
        ? 6
        : 2;
  const radius = baseRadius * severityScale;

  const label = typeof payload.label === 'string' ? payload.label : kind;

  const seenAt = firstSeen.get(event.id) ?? now;
  firstSeen.set(event.id, seenAt);

  // Critical events linger longer
  const lifespanMs =
    severity === 'critical' ? LIFESPAN[kind] * 1.35 : severity === 'minor' ? LIFESPAN[kind] * 0.75 : LIFESPAN[kind];

  return {
    id: `srv-${event.id}`,
    kind,
    x: xy[0],
    y: xy[1],
    radius,
    label,
    seenAt,
    lifespanMs,
    severity,
  };
}

export function buildDisplayEvents(
  events: CycleEvent[],
  firstSeen: Map<number, number>,
  now: number,
): DisplayEvent[] {
  const out: DisplayEvent[] = [];
  for (const e of events) {
    const d = toDisplayEvent(e, firstSeen, now);
    if (!d) continue;
    if (now - d.seenAt < d.lifespanMs) out.push(d);
  }
  return out;
}
