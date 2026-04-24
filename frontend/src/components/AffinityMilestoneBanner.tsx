import type { AffinityMilestoneVFX } from '../lib/affinity';
import { MILESTONE_LABEL, MILESTONE_COLOR } from '../lib/affinity';

export function AffinityMilestoneBanner({ vfx }: { vfx: AffinityMilestoneVFX }) {
  const color = MILESTONE_COLOR[vfx.milestone];
  const [a, b] = vfx.pair;
  return (
    <div className="affinity-banner" style={{ borderColor: color, boxShadow: `0 0 30px ${color}55` }}>
      <div className="aff-tier" style={{ color }}>{MILESTONE_LABEL[vfx.milestone]}</div>
      <div className="aff-names">
        <span className={`aff-name ${a.lane}`}>{a.name}</span>
        <span className="aff-join">&amp;</span>
        <span className={`aff-name ${b.lane}`}>{b.name}</span>
      </div>
      <div className="aff-sub">
        {a.role} + {b.role}
        {vfx.triggeredBy && ` · last ${vfx.triggeredBy}`}
      </div>
    </div>
  );
}
