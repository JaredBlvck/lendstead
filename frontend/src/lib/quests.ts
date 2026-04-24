// Quest library - per-NPC narrative quests. Backend now persists state
// via /api/quests so state is shared across sessions/viewers. This lib
// generates the quest content (deterministic from NPC); backend tracks
// accepted/completed/declined.

import type { NPC } from '../types';

export interface Quest {
  id: string;            // derived: `q:${npcName}:${quest_key}`
  quest_key: string;     // stable key the backend stores (e.g. 'deepening_vein')
  npcName: string;
  npcId: number;
  title: string;
  brief: string;
  reward: string;
  kind: 'gather' | 'scout' | 'defend' | 'deliver' | 'archive';
}

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

interface Template extends Omit<Quest, 'id' | 'npcName' | 'npcId'> {}

const QUEST_TEMPLATES: Record<string, Template[]> = {
  prospector: [
    { quest_key: 'deepening_vein', title: 'The Deepening Vein', brief: 'Three sacks of ore from the seam. Haul crew can carry them back if you want.', reward: 'Deeper respect from the forge crew.', kind: 'gather' },
    { quest_key: 'second_seam', title: 'Second Seam Hypothesis', brief: "I think there's a second vein below this one. Walk the inland ridges and confirm stone patterns.", reward: 'Acknowledgment when it is named.', kind: 'scout' },
  ],
  healer: [
    { quest_key: 'medicinal_sweep', title: 'Medicinal Sweep', brief: 'Bring cuttings from the rare herb cluster. I can triple our healing stock.', reward: 'Priority on next injury rotation.', kind: 'gather' },
    { quest_key: 'ember_inspection', title: 'Ember Satellite Inspection', brief: 'Walk the route from central tent to Ember satellite. I want eyes on whether the supply chain is holding.', reward: 'A marked path through the corridor.', kind: 'scout' },
  ],
  scout: [
    { quest_key: 'north_watch', title: 'North Cardinal Watch', brief: 'Scan the northern sector for tracks. If the pack returns we need to know first.', reward: 'A spear tip from the forge.', kind: 'scout' },
    { quest_key: 'lost_marker', title: 'Lost Marker', brief: 'A perimeter marker is out of place. Walk the S-flank line and set it back.', reward: 'Ration credit.', kind: 'deliver' },
  ],
  runner: [
    { quest_key: 'loop_stress_test', title: 'Triangular Loop Stress Test', brief: 'Run camp to NW to Ember to S-ridge and back without breaking pace. Time it.', reward: 'Recognition in the next rotation memo.', kind: 'scout' },
  ],
  crafter: [
    { quest_key: 'quality_control', title: 'Quality Control', brief: 'I need an outside eye on the latest vessel batch. Walk the stock at Ember and flag any cracks.', reward: 'First pick of the new batch.', kind: 'scout' },
  ],
  forager: [
    { quest_key: 'storm_forage_check', title: 'Storm-Safe Forage Check', brief: 'The shore zones shift after every storm. Walk the west coast and confirm which picks are still viable.', reward: 'Fresh kelp ration.', kind: 'scout' },
  ],
  organizer: [
    { quest_key: 'roster_review', title: 'Roster Review', brief: "Walk the central camp and count who's actually on-site vs rotation-listed.", reward: 'A say in the next rotation.', kind: 'scout' },
  ],
  scholar: [
    { quest_key: 'third_carving', title: 'Third Carving Hunt', brief: "Sweep the inland corridor between [14,10] and [24,11]. If a third carving exists, it's in there.", reward: 'Your name on the catalog entry.', kind: 'archive' },
  ],
  default: [
    { quest_key: 'status_sweep', title: 'Status Sweep', brief: 'Walk the island once. Tell me what you see.', reward: 'A story to share.', kind: 'scout' },
  ],
};

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

export function hasQuest(npc: NPC): boolean {
  return npc.skill >= 5 && npc.condition !== 'dead' && npc.condition !== 'incapacitated';
}

// Completion rules evaluated client-side against world + event history.
// Returns true if an accepted quest should auto-complete. Frontend POSTs
// the transition when this flips true.
export interface CompletionContext {
  world: { cycle: number; infrastructure: Record<string, unknown>; resources: Record<string, unknown> };
  acceptedCycle: number | null;
  events: Array<{ cycle: number; kind: string; payload: Record<string, unknown> }>;
}

const COMPLETION_RULES: Record<string, (ctx: CompletionContext) => boolean> = {
  deepening_vein: (ctx) =>
    Object.keys(ctx.world.infrastructure).some((k) => /ore_seam_site|ore_haul_chain/i.test(k)) ||
    !!ctx.world.resources.ore_seam_located,
  second_seam: (ctx) => {
    const oreEvents = ctx.events.filter((e) => e.kind === 'discovery' && /ore/i.test(String(e.payload.label ?? '')));
    return oreEvents.length >= 2;
  },
  medicinal_sweep: (ctx) =>
    !!ctx.world.resources.herb_cluster ||
    Object.keys(ctx.world.resources).some((k) => /herb|medicinal/i.test(k)),
  ember_inspection: (ctx) =>
    Object.keys(ctx.world.infrastructure).some((k) => /ember_spring_station|ember_spring/i.test(k)),
  north_watch: (ctx) => {
    const recent = ctx.events.filter(
      (e) => e.kind === 'threat_sighted' && e.cycle > (ctx.acceptedCycle ?? 0),
    );
    return recent.length > 0;
  },
  lost_marker: (ctx) =>
    Object.keys(ctx.world.infrastructure).some((k) => /s_palisade|perimeter/i.test(k)),
  loop_stress_test: (ctx) =>
    Object.keys(ctx.world.infrastructure).some((k) => /courier_network|hauler_sledge/i.test(k)),
  quality_control: (ctx) =>
    Object.keys(ctx.world.infrastructure).some((k) => /ember_spring_station/i.test(k)),
  storm_forage_check: (ctx) => {
    const storms = ctx.events.filter((e) => e.kind === 'storm');
    return storms.length >= 2;
  },
  roster_review: (ctx) =>
    ctx.acceptedCycle != null && ctx.world.cycle > ctx.acceptedCycle + 3,
  third_carving: (ctx) => {
    const carvings = ctx.events.filter(
      (e) => e.kind === 'discovery' && /carving/i.test(String(e.payload.label ?? '')),
    );
    return carvings.length >= 3;
  },
  status_sweep: (ctx) =>
    ctx.acceptedCycle != null && ctx.world.cycle > ctx.acceptedCycle + 5,
};

export function isQuestComplete(quest_key: string, ctx: CompletionContext): boolean {
  const rule = COMPLETION_RULES[quest_key];
  if (!rule) return false;
  try {
    return rule(ctx);
  } catch {
    return false;
  }
}

export function questFor(npc: NPC): Quest | null {
  if (!hasQuest(npc)) return null;
  const cat = roleCategory(npc.role);
  const templates = QUEST_TEMPLATES[cat] ?? QUEST_TEMPLATES.default;
  const seed = hashStr(`${npc.name}:${npc.role}`);
  const tpl = pick(templates, seed);
  return {
    id: `q:${npc.name}:${tpl.quest_key}`,
    quest_key: tpl.quest_key,
    npcName: npc.name,
    npcId: npc.id,
    title: tpl.title,
    brief: tpl.brief,
    reward: tpl.reward,
    kind: tpl.kind,
  };
}
