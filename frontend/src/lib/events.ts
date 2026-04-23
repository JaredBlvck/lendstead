// Client-side event simulator. Generates storm / discovery / threat events
// on a timer so the map feels alive even before the backend emits them.
// When /api/events returns real events with these kinds, they take priority
// and the simulator stays quiet.

import { GRID_W, GRID_H, tileAt, type Tile } from './terrain';

export type LocalEventKind = 'storm' | 'discovery' | 'threat';

export interface LocalEvent {
  id: string;
  kind: LocalEventKind;
  x: number;
  y: number;
  radius: number;
  spawnedAt: number;
  lifespanMs: number;
  label: string;
}

const STORM_LABELS = ['squall', 'heavy rain', 'coastal storm', 'wind front'];
const DISCOVERY_LABELS = [
  'fresh spring found',
  'ore seam spotted',
  'wild grain patch',
  'driftwood cache',
  'cave entrance',
  'game trail',
];
const THREAT_LABELS = [
  'unknown tracks',
  'distant smoke',
  'cliff collapse risk',
  'animal sighting',
];

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function rollEvent(tiles: Tile[], now: number): LocalEvent | null {
  const rand = Math.random;
  // 60% chance to skip on any roll so the pace stays patient
  if (rand() < 0.6) return null;

  const roll = rand();
  let kind: LocalEventKind;
  if (roll < 0.5) kind = 'discovery';
  else if (roll < 0.8) kind = 'storm';
  else kind = 'threat';

  // Pick a valid tile for the event type
  let tries = 0;
  let x = 0;
  let y = 0;
  let tile: Tile | undefined;
  while (tries < 20) {
    x = Math.floor(rand() * GRID_W);
    y = Math.floor(rand() * GRID_H);
    tile = tileAt(tiles, x, y);
    if (!tile) {
      tries++;
      continue;
    }
    if (kind === 'discovery' && tile.type !== 'water') break;
    if (kind === 'storm') break;
    if (kind === 'threat' && tile.type !== 'water') break;
    tries++;
  }
  if (!tile) return null;

  const label =
    kind === 'storm' ? pick(STORM_LABELS, rand)
    : kind === 'discovery' ? pick(DISCOVERY_LABELS, rand)
    : pick(THREAT_LABELS, rand);

  return {
    id: `${now}-${kind}-${x}-${y}`,
    kind,
    x,
    y,
    radius: kind === 'storm' ? 6 + Math.floor(rand() * 4) : 2,
    spawnedAt: now,
    lifespanMs: kind === 'storm' ? 9000 : kind === 'threat' ? 7000 : 11000,
    label,
  };
}

export function pruneExpired(events: LocalEvent[], now: number): LocalEvent[] {
  return events.filter((e) => now - e.spawnedAt < e.lifespanMs);
}
