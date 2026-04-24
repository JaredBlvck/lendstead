// NPC flavor dialog generator. Static template system - no LLM, no API
// cost, no network call. Each NPC's line is deterministic from their
// {name, role, status, lane, condition, skill, civ_name} so repeat
// clicks show the same line unless you pass a different seed.
//
// Template strategy: role determines VOICE (geological, medical,
// observational, etc.), status fills SPECIFICS (location, current
// work, neighboring NPCs), condition overlays a SECONDARY state.

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

function roleCategory(role: string): string {
  if (/prospector|miner/i.test(role)) return 'prospector';
  if (/healer|medical/i.test(role)) return 'healer';
  if (/scout|watcher|ranger|mapper|explorer/i.test(role)) return 'scout';
  if (/runner|hauler|courier/i.test(role)) return 'runner';
  if (/potter|carpenter|toolmaker|smith/i.test(role)) return 'crafter';
  if (/forager|fisher|gatherer|trader/i.test(role)) return 'forager';
  if (/organizer|planner|lead|coordinator|inland|marker/i.test(role)) return 'organizer';
  if (/archaeology|catalog/i.test(role)) return 'scholar';
  return 'default';
}

const TEMPLATES: Record<string, string[]> = {
  prospector: [
    "I've pulled ten sacks from the seam this cycle. The stone gets harder the deeper we dig.",
    "Ore's good. Harlan's going to love what we brought back today.",
    "There's a second vein below this one. I can feel it in the rock pattern.",
    "Rook and the haul crew run sample-to-camp while I work the face.",
    "Metal tier changed everything. Picks cut this stone like it's nothing.",
  ],
  healer: [
    "Clean wounds, fresh cloth. They'll be back to full work within a cycle.",
    "The herb cluster's been a godsend. Medicinal stock is at its highest ever.",
    "I keep a rotation. Nobody's idle, nobody's overworked.",
    "Ilka handles the central tent while I'm on the satellite.",
    "Morale dips before the body does. Watch the faces, not just the bruises.",
  ],
  scout: [
    "Quiet out here today. I'll walk the perimeter twice more before I rotate back.",
    "Watched that compass arc for three cycles. Nothing moves without me seeing it.",
    "If the pack comes back, they'll come from the north. I'll know before they're within sight.",
    "Metal spear changes the math. I can hold my own if it comes to that.",
    "Tracks fade fast after weather. Got to be out early.",
  ],
  runner: [
    "Camp to NW to Ember, then back. Four legs, thirty minutes if I don't stop.",
    "Cael taught me the trick of pacing with the sledge.",
    "I could run the full loop in my sleep by now.",
    "Ore haul got added to my leg this cycle. More weight, same time.",
  ],
  crafter: [
    "Harlan's forge is running hot. The smithy hasn't cooled in three cycles.",
    "I turned out twenty vessels last cycle. Osric says that's enough for Ember's cistern.",
    "Metal-nail-accelerated build times mean we finished three shelters in one cycle.",
    "Every tool I make outlives three of me. That's the point.",
  ],
  forager: [
    "Berry grove's yielding. I'll fill two baskets before the sun drops.",
    "Shellfish tide-line since dawn. Good harvest, even with the storm last cycle.",
    "Mott taught me the fishing rig. It's steady work now.",
    "I can feel the season shifting. The woodland forage is slowing.",
  ],
  organizer: [
    "Rotation's holding. Nobody's overworked, nobody's idle, nobody's hungry.",
    "I moved Cael to the triangular loop. He's the only one with the stamina for all four legs.",
    "When the storms came I had the shelter list memorized. Nobody was further than three tiles from cover.",
    "Leadership's not glory. It's remembering who slept well last night.",
  ],
  scholar: [
    "Two carvings, both in the inland corridor. Not coincidence - someone was here before us.",
    "I take rubbings, record position and style. Pattern work is for later generations.",
    "Alda catalogs at the shed, I sweep new sectors.",
    "Every stone tells a story. Some of them are older than the memory of the people who made them.",
  ],
  default: [
    "Cycle's running smooth.",
    "Got work to do. Back to it.",
    "Good to be useful.",
  ],
};

const CONDITION_OVERLAY: Record<string, string[]> = {
  injured: [
    " (And: I'm mending. Iwen says give it two cycles. I can still do light work.)",
    " (Took a bruise last cycle. Nothing a few days won't fix.)",
  ],
  incapacitated: [
    " (I'm down hard this cycle. Can't do much but wait and mend.)",
    " (Bed rest. Iwen's rotation covers me. Back as soon as I can stand.)",
  ],
};

const MORALE_OVERLAY: Record<string, string[]> = {
  low: [
    " Been a rough stretch, if I'm honest. Too many dry cycles.",
    " I'm tired. We all are.",
  ],
  high: [
    " Best I've felt since we landed. This cycle's going well.",
    " Morale's good. Work flows when people trust the call.",
  ],
};

const LANE_OVERLAY: Record<string, string[]> = {
  sr: [
    " Sr has us moving fast. I like it.",
    " Sr rotates me through new territory. Never dull.",
  ],
  jr: [
    " Jr keeps the camp running. I can do my work because someone else thought about mine.",
    " Jr's architecture makes days predictable. That matters.",
  ],
};

export function generateFlavor(npc: NPC, civName: string): string {
  const seed = hashStr(`${npc.name}:${npc.role}:${npc.status}:${civName}`);
  const cat = roleCategory(npc.role);
  const lines = TEMPLATES[cat] ?? TEMPLATES.default;
  let line = pick(lines, seed);

  // Condition overlay when relevant
  if (npc.condition === 'injured' && CONDITION_OVERLAY.injured) {
    line += pick(CONDITION_OVERLAY.injured, seed >> 8);
  } else if (npc.condition === 'incapacitated' && CONDITION_OVERLAY.incapacitated) {
    line += pick(CONDITION_OVERLAY.incapacitated, seed >> 8);
  } else {
    // Healthy: add either a morale or lane line, not both
    const useLane = (seed >> 16) & 1;
    if (useLane && LANE_OVERLAY[npc.lane]) {
      line += pick(LANE_OVERLAY[npc.lane], seed >> 12);
    } else if (npc.morale === 'low' || npc.morale === 'high') {
      const m = npc.morale === 'low' ? 'low' : 'high';
      if (MORALE_OVERLAY[m]) {
        line += pick(MORALE_OVERLAY[m], seed >> 12);
      }
    }
  }

  return line;
}
