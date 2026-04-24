interface Props {
  srEnergy?: number;
  jrEnergy?: number;
}

function EnergyBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="energy-row">
      <span className="energy-label" style={{ color }}>{label}</span>
      <div className="energy-bar">
        <div
          className="energy-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="energy-val">{pct.toFixed(0)}</span>
    </div>
  );
}

export function EnergyHUD({ srEnergy, jrEnergy }: Props) {
  if (srEnergy == null && jrEnergy == null) return null;
  return (
    <div className="energy-hud">
      <div className="energy-title">SOURCE</div>
      <EnergyBar label="SR" value={srEnergy ?? 0} color="var(--sr)" />
      <EnergyBar label="JR" value={jrEnergy ?? 0} color="var(--jr)" />
    </div>
  );
}
