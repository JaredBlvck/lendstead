// Map NPC status keywords to short chat-bubble phrases. These float over
// the NPC for a few seconds, refreshed per advance, so the island reads
// as full of people actively doing things.

import type { NPC } from '../types';

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

const KEYWORD_BUBBLES: Array<{ re: RegExp; phrases: string[] }> = [
  { re: /forge|smelt|smithy/i, phrases: ['Forging!', 'Metal sings...', 'Smelt going hot', 'Quench it!'] },
  { re: /mining|ore|vein|prospect/i, phrases: ['Pulling ore', 'Another sack', 'Good seam here', 'Pickaxe work'] },
  { re: /haul|courier|sledge/i, phrases: ['Loop run', 'Full load', 'One more leg', 'Sledge moves'] },
  { re: /fish|tide|shore/i, phrases: ['Tide is right', 'Good catch', 'Net full', 'Early shellfish'] },
  { re: /forage|gather|berry|grove/i, phrases: ['Baskets full', 'Grove yielding', 'Fresh picks', 'Kelp cut'] },
  { re: /build|construct|palisade|shelter|structure/i, phrases: ['Framing up', 'Walls rising', 'One more beam', 'Roof today'] },
  { re: /watch|guard|scout|patrol|perimeter/i, phrases: ['Watching...', 'Quiet tonight', 'All clear', 'No movement'] },
  { re: /medical|heal|tent|medicine|herb/i, phrases: ['Clean wounds', 'Herbs ready', 'Rest heals', 'Checking pulse'] },
  { re: /archaeology|carving|catalog/i, phrases: ['Rubbing stone', 'New glyph', 'Pattern repeats', 'Old markings'] },
  { re: /organize|rotation|lead|coordinate/i, phrases: ['Shifts set', 'Crew assigned', 'Rotation holds', 'Plan locked'] },
  { re: /map|survey/i, phrases: ['Marking grid', 'Terrain logged', 'Horizon scanned', 'Sketches ready'] },
  { re: /ember|spring|water|cistern/i, phrases: ['Water runs clean', 'Cistern full', 'Spring pools', 'Drink deep'] },
];

const FALLBACK = ['Working.', 'At it.', '...', 'Steady.', 'Heads down.'];

export function bubbleFor(npc: NPC, tick: number): string {
  const seed = hashStr(`${npc.name}:${npc.status}:${tick}`);
  for (const entry of KEYWORD_BUBBLES) {
    if (entry.re.test(npc.status || '')) return pick(entry.phrases, seed);
  }
  return pick(FALLBACK, seed);
}
