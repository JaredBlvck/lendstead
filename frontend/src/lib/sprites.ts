// Lightweight humanoid-silhouette sprites drawn entirely with canvas
// primitives. No image loading, no library. Each archetype gets a distinct
// body shape + tool hint that reads cleanly at 14-20px tile size.
//
// Role -> archetype classifier moved here so renderers + layout logic
// share one source.

export type Archetype = 'scout' | 'builder' | 'forager' | 'specialist' | 'leader';

export function classify(role: string): Archetype {
  if (/scout|watcher|runner|guard|sentry|ranger|mapper|explorer/i.test(role))
    return 'scout';
  if (/carpenter|toolmaker|potter|organizer|field|planner|prospector|hauler|healer|inland|marker|forager-trader/i.test(role))
    return 'builder';
  if (/forager|fisher|gatherer|shore|tide|trader/i.test(role)) return 'forager';
  return 'specialist';
}

const OUTLINE = 'rgba(0,0,0,0.75)';

interface DrawOpts {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;        // nominal tile size in pixels (avatar scales off this)
  lane: 'sr' | 'jr';
  archetype: Archetype;
  facing: number;      // radians, 0=right, pi/2=down
  phase: number;       // 0..1 breathing phase
  highlighted?: boolean;
  leader?: boolean;
  condition?: 'healthy' | 'injured' | 'incapacitated' | 'dead';
  moraleLow?: boolean;
}

// Primary humanoid draw. Head + torso + legs + tool hint. Phase-animated
// so stationary sprites look alive.
export function drawAvatar(opts: DrawOpts) {
  const {
    ctx, x, y, size, lane, archetype, facing, phase, highlighted, leader,
    condition = 'healthy', moraleLow,
  } = opts;

  // Dead: render as faint marker, no body
  if (condition === 'dead') {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(150,150,150,0.45)';
    ctx.lineWidth = 1;
    const r = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(r, r);
    ctx.moveTo(r, -r);
    ctx.lineTo(-r, r);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const scale = leader ? 1.4 : 1.0;
  const headR = size * 0.18 * scale;
  const torsoH = size * 0.38 * scale;
  const torsoW = torsoArchetypeWidth(archetype) * size * scale;

  // Injured sprites breathe slower and more shallowly; incapacitated don't animate
  const breathAmp =
    condition === 'incapacitated' ? 0 : condition === 'injured' ? size * 0.01 : size * 0.02;
  const breath = Math.sin(phase * Math.PI * 2) * breathAmp;

  let fillColor = lane === 'sr' ? '#fb923c' : '#38bdf8';
  let accent = lane === 'sr' ? '#fdba74' : '#7dd3fc';
  if (moraleLow) {
    fillColor = lane === 'sr' ? '#b97340' : '#5089a6';
    accent = lane === 'sr' ? '#b97340' : '#5089a6';
  }
  if (condition === 'injured' || condition === 'incapacitated') {
    fillColor = mixWithGray(fillColor, 0.55);
    accent = mixWithGray(accent, 0.55);
  }

  ctx.save();
  ctx.translate(x, y + breath);

  // Shadow ellipse
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.44 * scale, size * 0.34 * scale, size * 0.12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Leader aura
  if (leader) {
    const auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
    auraGrad.addColorStop(0, `${fillColor}33`);
    auraGrad.addColorStop(1, `${fillColor}00`);
    ctx.fillStyle = auraGrad;
    ctx.fillRect(-size * 1.2, -size * 1.2, size * 2.4, size * 2.4);
  }

  // Highlight ring (focused/skill-6+ NPC)
  if (highlighted) {
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(phase * Math.PI * 2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.45 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Torso
  ctx.fillStyle = '#1a1f2a';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  roundedRect(ctx, -torsoW / 2, -torsoH / 2, torsoW, torsoH, torsoW * 0.3);
  ctx.fill();
  ctx.stroke();

  // Lane outline on torso (subtle, not full fill)
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 1.3;
  roundedRect(ctx, -torsoW / 2, -torsoH / 2, torsoW, torsoH, torsoW * 0.3);
  ctx.stroke();

  // Legs (tiny phased stance)
  const legY = torsoH / 2;
  const legSpread = torsoW * 0.3;
  const legStride = Math.sin(phase * Math.PI * 2) * (torsoW * 0.1);
  ctx.fillStyle = '#0f131c';
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.rect(-legSpread - size * 0.04, legY, size * 0.08 * scale, size * 0.14 * scale);
  ctx.rect(legSpread - size * 0.04, legY + legStride * 0.5, size * 0.08 * scale, size * 0.14 * scale);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = accent;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(0, -torsoH / 2 - headR * 0.6, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Facing indicator: tiny eye dot on the side the avatar is looking
  const eyeX = Math.cos(facing) * headR * 0.55;
  const eyeY = -torsoH / 2 - headR * 0.6 + Math.sin(facing) * headR * 0.25;
  ctx.fillStyle = '#0b0e14';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, Math.max(0.7, size * 0.03), 0, Math.PI * 2);
  ctx.fill();

  // Tool / archetype hint
  drawToolHint(ctx, archetype, size * scale, facing);

  // Injury X mark
  if (condition === 'injured' || condition === 'incapacitated') {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.4;
    const r = size * 0.12 * scale;
    const cx = torsoW / 2 - r * 0.3;
    const cy = -torsoH / 2;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy + r);
    ctx.stroke();
  }
  if (condition === 'incapacitated') {
    // Bedroll line under the torso
    ctx.fillStyle = 'rgba(200,180,140,0.4)';
    ctx.fillRect(-torsoW * 0.7, torsoH / 2 + size * 0.06, torsoW * 1.4, size * 0.06);
  }

  ctx.restore();
}

function mixWithGray(color: string, grayWeight: number): string {
  // Mix hex color with neutral gray #7a7a7a
  const target = [0x7a, 0x7a, 0x7a];
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const mix = (c: number, t: number) => Math.round(c * (1 - grayWeight) + t * grayWeight);
  const rr = mix(r, target[0]);
  const gg = mix(g, target[1]);
  const bb = mix(b, target[2]);
  return `rgb(${rr},${gg},${bb})`;
}

function torsoArchetypeWidth(a: Archetype): number {
  switch (a) {
    case 'scout': return 0.22;
    case 'forager': return 0.28;
    case 'builder': return 0.34;
    case 'specialist': return 0.3;
    case 'leader': return 0.32;
  }
}

function drawToolHint(
  ctx: CanvasRenderingContext2D,
  arch: Archetype,
  s: number,
  facing: number,
) {
  const sideX = Math.cos(facing) * s * 0.22;
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1.2;
  if (arch === 'scout') {
    // spear / staff
    ctx.beginPath();
    ctx.moveTo(sideX, -s * 0.22);
    ctx.lineTo(sideX * 1.4, s * 0.28);
    ctx.stroke();
  } else if (arch === 'builder') {
    // hammer/axe block
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(sideX, -s * 0.08, s * 0.12, s * 0.14);
    ctx.strokeRect(sideX, -s * 0.08, s * 0.12, s * 0.14);
  } else if (arch === 'forager') {
    // basket ellipse
    ctx.fillStyle = '#a16207';
    ctx.beginPath();
    ctx.ellipse(sideX, s * 0.18, s * 0.12, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // specialist: no tool hint, just silhouette
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

// Environmental tile assets (trees / rocks / shore edge) deterministically
// scattered. Seeded by tile x,y so they don't flicker between frames.
function hash2(x: number, y: number): number {
  let h = 2166136261;
  h ^= x * 374761393;
  h = Math.imul(h, 16777619);
  h ^= y * 668265263;
  h = Math.imul(h, 16777619);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

export function drawTree(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  seed: number,
) {
  const size = ts * (0.35 + (seed % 0.25));
  ctx.fillStyle = '#1f3d1a';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.8;
  // trunk
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(px - size * 0.08, py + size * 0.05, size * 0.16, size * 0.22);
  // crown
  ctx.fillStyle = '#1f3d1a';
  ctx.beginPath();
  ctx.arc(px, py - size * 0.05, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawRock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  seed: number,
) {
  const size = ts * (0.2 + (seed % 0.15));
  ctx.fillStyle = '#4b4f5a';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(px, py - size);
  ctx.lineTo(px + size, py);
  ctx.lineTo(px + size * 0.5, py + size * 0.8);
  ctx.lineTo(px - size * 0.7, py + size * 0.6);
  ctx.lineTo(px - size * 0.9, py - size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function tileAssetsSeed(x: number, y: number, density: number): Array<{ ox: number; oy: number; seed: number }> {
  // Return 0-2 positions inside tile with small jitter, deterministic
  const count = hash2(x, y) < density ? (hash2(x + 1, y) < 0.5 ? 1 : 2) : 0;
  const out: Array<{ ox: number; oy: number; seed: number }> = [];
  for (let i = 0; i < count; i++) {
    const jx = hash2(x + i * 7, y);
    const jy = hash2(y + i * 11, x);
    out.push({
      ox: (jx - 0.5) * 0.6,
      oy: (jy - 0.5) * 0.6,
      seed: hash2(x * 17 + i, y * 23 + i),
    });
  }
  return out;
}

// Structure draw. Small icon-ish sprite keyed by structure type.
export function drawStructure(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  kind: string,
  label?: string,
) {
  const s = ts * 0.7;
  ctx.save();
  ctx.translate(px, py);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.52, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1;

  if (/palisade/i.test(kind)) {
    // row of spikes
    ctx.fillStyle = '#6b4a2a';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.16, -s * 0.4);
      ctx.lineTo(i * s * 0.16 + s * 0.08, -s * 0.2);
      ctx.lineTo(i * s * 0.16 - s * 0.08, -s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (/cistern|spring|freshwater|water/i.test(kind)) {
    // circular pool with highlight
    ctx.fillStyle = '#2a7a9a';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 0.05, s * 0.16, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (/smithy|forge|furnace/i.test(kind)) {
    // hut with smoke plume
    ctx.fillStyle = '#4a2e1a';
    ctx.fillRect(-s * 0.22, -s * 0.2, s * 0.44, s * 0.35);
    ctx.strokeRect(-s * 0.22, -s * 0.2, s * 0.44, s * 0.35);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // smoke
    ctx.strokeStyle = 'rgba(200,200,200,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.25);
    ctx.quadraticCurveTo(s * 0.05, -s * 0.4, 0, -s * 0.55);
    ctx.stroke();
  } else if (/granary|storage|drying|dwelling|station|camp|shelter|tent|medical/i.test(kind)) {
    // tent: triangle roof + base
    ctx.fillStyle = '#9a7a5a';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.38);
    ctx.lineTo(s * 0.32, s * 0.12);
    ctx.lineTo(-s * 0.32, s * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-s * 0.3, s * 0.05, s * 0.6, s * 0.12);
    ctx.strokeRect(-s * 0.3, s * 0.05, s * 0.6, s * 0.12);
  } else if (/watch|post|tower|outpost/i.test(kind)) {
    // elevated platform
    ctx.fillStyle = '#6b5a3a';
    ctx.fillRect(-s * 0.06, -s * 0.05, s * 0.12, s * 0.4);
    ctx.strokeRect(-s * 0.06, -s * 0.05, s * 0.12, s * 0.4);
    ctx.fillStyle = '#8a7a5a';
    ctx.fillRect(-s * 0.28, -s * 0.25, s * 0.56, s * 0.18);
    ctx.strokeRect(-s * 0.28, -s * 0.25, s * 0.56, s * 0.18);
  } else {
    // generic marker
    ctx.fillStyle = '#5eead4';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (label) {
    ctx.fillStyle = '#e6edf3';
    ctx.font = '9px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, s * 0.78);
  }

  ctx.restore();
}
