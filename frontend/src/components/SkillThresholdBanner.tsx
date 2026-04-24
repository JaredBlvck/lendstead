import type { SkillThresholdVFX } from '../lib/interactions';

// Center-screen celebration when an NPC crosses skill 5 via mentorship
// and becomes eligible as a quest-giver. Stacks if multiple cross in
// rapid succession (ExplorationView renders only the most recent).

export function SkillThresholdBanner({ vfx }: { vfx: SkillThresholdVFX }) {
  return (
    <div className="skill-threshold-banner">
      <div className="stb-icon">★</div>
      <div className="stb-lane">MENTORSHIP</div>
      <div className="stb-title">{vfx.npcName}</div>
      <div className="stb-sub">
        advances to skill {vfx.skillTo}
        {vfx.skillTo >= 5 && ' — now a quest-giver'}
      </div>
    </div>
  );
}
