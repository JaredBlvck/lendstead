import type { BreakthroughEvent } from '../lib/abilities';

const ABILITY_LABEL: Record<string, string> = {
  terrain_shape: 'TERRAIN SHAPING',
  resource_amp: 'RESOURCE AMPLIFICATION',
  npc_influence: 'POPULATION INFLUENCE',
  protection: 'PROTECTION',
};

const ABILITY_DESC: Record<string, string> = {
  terrain_shape: 'Reshape the land itself.',
  resource_amp: 'Amplify the flow of life.',
  npc_influence: 'Bend the will of the island.',
  protection: 'Shield what you cherish.',
};

export function BreakthroughBanner({ breakthrough }: { breakthrough: BreakthroughEvent }) {
  const label = ABILITY_LABEL[breakthrough.unlocks] ?? breakthrough.unlocks;
  const desc = breakthrough.description || ABILITY_DESC[breakthrough.unlocks] || '';
  const laneColor = breakthrough.leader === 'sr' ? 'var(--sr)' : 'var(--jr)';
  return (
    <div className="breakthrough-banner">
      <div className="breakthrough-lane" style={{ color: laneColor }}>
        {breakthrough.leader === 'sr' ? 'SR' : 'JR'}
      </div>
      <div className="breakthrough-title">BREAKTHROUGH</div>
      <div className="breakthrough-unlock">{label}</div>
      <div className="breakthrough-desc">{desc}</div>
    </div>
  );
}
