// Lightweight humanoid-silhouette sprites + environmental decoration
// drawn entirely with canvas primitives. No image loading, no library.
// v5.0: enhanced structures, action-loop poses, ambient motion, lighting.

export type Archetype = 'scout' | 'builder' | 'forager' | 'specialist' | 'leader';

export function classify(role: string): Archetype {
  if (/scout|watcher|runner|guard|sentry|ranger|mapper|explorer/i.test(role))
    return 'scout';
  if (/carpenter|toolmaker|potter|organizer|field|planner|prospector|hauler|healer|inland|marker|forager-trader/i.test(role))
    return 'builder';
  if (/forager|fisher|gatherer|shore|tide|trader/i.test(role)) return 'forager';
  return 'specialist';
}

export type ActionPose = 'walking' | 'gathering' | 'building' | 'idle';

// Infer pose from NPC status text. Keyword-based because status strings
// are free-form narrative from leader decisions.
export function posefromStatus(status: string, moving: boolean): ActionPose {
  if (moving) return 'walking';
  if (/harvest|forage|gather|catalog|survey|scout|watch|fish|trap|haul/i.test(status))
    return 'gathering';
  if (/build|forge|smelt|smithy|palisade|shelter|construct|rotation|drill|mining|ore/i.test(status))
    return 'building';
  return 'idle';
}

const OUTLINE = 'rgba(0,0,0,0.75)';

interface DrawOpts {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;
  lane: 'sr' | 'jr';
  archetype: Archetype;
  facing: number;
  phase: number;
  pose?: ActionPose;
  highlighted?: boolean;
  leader?: boolean;
  condition?: 'healthy' | 'injured' | 'incapacitated' | 'dead';
  moraleLow?: boolean;
}

export function drawAvatar(opts: DrawOpts) {
  const {
    ctx, x, y, size, lane, archetype, facing, phase, highlighted, leader,
    pose = 'walking',
    condition = 'healthy', moraleLow,
  } = opts;

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

  const breathAmp =
    condition === 'incapacitated' ? 0 : condition === 'injured' ? size * 0.01 : size * 0.02;
  const breath = Math.sin(phase * Math.PI * 2) * breathAmp;

  // Action-loop pose offsets
  let bodyTilt = 0;
  let armSwing = 0;
  let toolSwing = 0;
  if (pose === 'gathering' && condition !== 'incapacitated') {
    // Periodic bend forward as if picking
    const gatherPhase = Math.sin(phase * Math.PI * 2);
    bodyTilt = gatherPhase > 0.3 ? gatherPhase * 0.35 : 0;
  } else if (pose === 'building' && condition !== 'incapacitated') {
    // Hammer swing
    toolSwing = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.8 - 0.4;
  } else if (pose === 'walking' && condition !== 'incapacitated') {
    armSwing = Math.sin(phase * Math.PI * 2) * 0.25;
  }

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

  // Directional drop shadow (light from top-left -> shadow toward bottom-right)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(
    size * 0.08 * scale,
    size * 0.44 * scale,
    size * 0.34 * scale,
    size * 0.12 * scale,
    0, 0, Math.PI * 2,
  );
  ctx.fill();

  if (leader) {
    const auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
    auraGrad.addColorStop(0, `${fillColor}33`);
    auraGrad.addColorStop(1, `${fillColor}00`);
    ctx.fillStyle = auraGrad;
    ctx.fillRect(-size * 1.2, -size * 1.2, size * 2.4, size * 2.4);
  }

  if (highlighted) {
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(phase * Math.PI * 2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.45 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Body tilt for gather pose
  ctx.rotate(bodyTilt * 0.4);

  // Torso
  ctx.fillStyle = '#1a1f2a';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  roundedRect(ctx, -torsoW / 2, -torsoH / 2, torsoW, torsoH, torsoW * 0.3);
  ctx.fill();
  ctx.stroke();

  // Top-lit highlight on torso (subtle light catch)
  ctx.save();
  const lightGrad = ctx.createLinearGradient(-torsoW / 2, -torsoH / 2, torsoW / 2, torsoH / 2);
  lightGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
  lightGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lightGrad;
  roundedRect(ctx, -torsoW / 2, -torsoH / 2, torsoW, torsoH, torsoW * 0.3);
  ctx.fill();
  ctx.restore();

  // Lane outline on torso
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 1.3;
  roundedRect(ctx, -torsoW / 2, -torsoH / 2, torsoW, torsoH, torsoW * 0.3);
  ctx.stroke();

  // Legs with walk stride + arm swing
  const legY = torsoH / 2;
  const legSpread = torsoW * 0.3;
  const legStride = armSwing * (torsoW * 0.4);
  ctx.fillStyle = '#0f131c';
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.rect(-legSpread - size * 0.04 - legStride * 0.5, legY, size * 0.08 * scale, size * 0.14 * scale);
  ctx.rect(legSpread - size * 0.04 + legStride * 0.5, legY + Math.abs(legStride) * 0.3, size * 0.08 * scale, size * 0.14 * scale);
  ctx.fill();
  ctx.stroke();

  // Head (top-lit accent)
  ctx.fillStyle = accent;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(0, -torsoH / 2 - headR * 0.6, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(-headR * 0.25, -torsoH / 2 - headR * 0.8, headR * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Facing indicator
  const eyeX = Math.cos(facing) * headR * 0.55;
  const eyeY = -torsoH / 2 - headR * 0.6 + Math.sin(facing) * headR * 0.25;
  ctx.fillStyle = '#0b0e14';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, Math.max(0.7, size * 0.03), 0, Math.PI * 2);
  ctx.fill();

  // Tool / archetype hint with pose-driven swing
  drawToolHint(ctx, archetype, size * scale, facing, toolSwing);

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
    ctx.fillStyle = 'rgba(200,180,140,0.4)';
    ctx.fillRect(-torsoW * 0.7, torsoH / 2 + size * 0.06, torsoW * 1.4, size * 0.06);
  }

  ctx.restore();
}

function mixWithGray(color: string, grayWeight: number): string {
  const target = [0x7a, 0x7a, 0x7a];
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const mix = (c: number, t: number) => Math.round(c * (1 - grayWeight) + t * grayWeight);
  return `rgb(${mix(r, target[0])},${mix(g, target[1])},${mix(b, target[2])})`;
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
  swing: number,
) {
  const sideX = Math.cos(facing) * s * 0.22;
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1.2;
  if (arch === 'scout') {
    ctx.beginPath();
    ctx.moveTo(sideX, -s * 0.22);
    ctx.lineTo(sideX * 1.4, s * 0.28);
    ctx.stroke();
  } else if (arch === 'builder') {
    ctx.save();
    ctx.translate(sideX + s * 0.06, -s * 0.02);
    ctx.rotate(swing * Math.PI * 0.6);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-s * 0.02, -s * 0.08, s * 0.12, s * 0.14);
    ctx.strokeRect(-s * 0.02, -s * 0.08, s * 0.12, s * 0.14);
    ctx.restore();
  } else if (arch === 'forager') {
    ctx.fillStyle = '#a16207';
    ctx.beginPath();
    ctx.ellipse(sideX, s * 0.18, s * 0.12, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
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

function hash2(x: number, y: number): number {
  let h = 2166136261;
  h ^= x * 374761393;
  h = Math.imul(h, 16777619);
  h ^= y * 668265263;
  h = Math.imul(h, 16777619);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

export { hash2 };

export function drawTree(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  seed: number,
  now: number,
) {
  const size = ts * (0.35 + (seed % 0.25));
  // Sway: tree tips gently swing with time + seed offset
  const sway = Math.sin(now / 1800 + seed * 10) * size * 0.06;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.8;
  // Shadow under tree
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(px + size * 0.12, py + size * 0.22, size * 0.3, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Trunk
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(px - size * 0.08, py + size * 0.05, size * 0.16, size * 0.22);
  // Crown (sways)
  ctx.fillStyle = '#1f3d1a';
  ctx.beginPath();
  ctx.arc(px + sway, py - size * 0.05, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Top-lit highlight
  ctx.fillStyle = 'rgba(180,220,160,0.25)';
  ctx.beginPath();
  ctx.arc(px + sway - size * 0.1, py - size * 0.12, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

export function drawRock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  seed: number,
) {
  const size = ts * (0.2 + (seed % 0.15));
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(px + size * 0.15, py + size * 0.35, size * 0.6, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
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
  // Top-lit face
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(px, py - size);
  ctx.lineTo(px + size * 0.3, py - size * 0.3);
  ctx.lineTo(px - size * 0.3, py - size * 0.3);
  ctx.closePath();
  ctx.fill();
}

export function tileAssetsSeed(
  x: number,
  y: number,
  density: number,
): Array<{ ox: number; oy: number; seed: number }> {
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

// Smoke particles rising from a structure source. Deterministic trajectories
// from seed; varies with time for animation.
export function drawSmokePlume(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  now: number,
  intensity = 1,
) {
  const PARTICLE_COUNT = 6;
  const LIFESPAN_MS = 2400;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const spawnOffset = i * (LIFESPAN_MS / PARTICLE_COUNT);
    const age = ((now + spawnOffset) % LIFESPAN_MS) / LIFESPAN_MS;
    const driftX = Math.sin(age * Math.PI * 2 + i) * ts * 0.1;
    const driftY = -age * ts * 1.2;
    const alpha = (1 - age) * 0.5 * intensity;
    const radius = ts * (0.08 + age * 0.14);
    ctx.fillStyle = `rgba(200,200,200,${alpha})`;
    ctx.beginPath();
    ctx.arc(px + driftX, py + driftY - ts * 0.2, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawStructure(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  kind: string,
  now: number,
  label?: string,
) {
  const s = ts * 0.75;
  ctx.save();
  ctx.translate(px, py);

  // Directional shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(s * 0.08, s * 0.55, s * 0.45, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1;

  if (/palisade/i.test(kind)) {
    // Row of irregular spikes - varied heights
    ctx.fillStyle = '#6b4a2a';
    for (let i = -2; i <= 2; i++) {
      const tipH = s * 0.35 + ((i * 73) % 10) * 0.01 * s;
      ctx.beginPath();
      ctx.moveTo(i * s * 0.16, -tipH);
      ctx.lineTo(i * s * 0.16 + s * 0.08, -s * 0.16);
      ctx.lineTo(i * s * 0.16 - s * 0.08, -s * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Ground beam
    ctx.fillRect(-s * 0.42, -s * 0.14, s * 0.84, s * 0.08);
    ctx.strokeRect(-s * 0.42, -s * 0.14, s * 0.84, s * 0.08);
  } else if (/cistern|spring|freshwater|water|well/i.test(kind)) {
    // Stone ring pool
    ctx.fillStyle = '#555a63';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a7a9a';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    // Water highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 0.05, s * 0.14, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ripple
    const ripplePhase = (now / 1200) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - ripplePhase)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.15 * ripplePhase + s * 0.05, 0, Math.PI * 2);
    ctx.stroke();
  } else if (/smithy|forge|furnace/i.test(kind)) {
    // Hut base
    ctx.fillStyle = '#4a2e1a';
    ctx.fillRect(-s * 0.24, -s * 0.2, s * 0.48, s * 0.35);
    ctx.strokeRect(-s * 0.24, -s * 0.2, s * 0.48, s * 0.35);
    // Roof
    ctx.fillStyle = '#6b4a2a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.2);
    ctx.lineTo(0, -s * 0.4);
    ctx.lineTo(s * 0.3, -s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Fire glow inside
    const fireGlow = 0.7 + 0.3 * Math.sin(now / 150);
    const fireGrad = ctx.createRadialGradient(0, s * 0.05, 0, 0, s * 0.05, s * 0.3);
    fireGrad.addColorStop(0, `rgba(255,180,80,${fireGlow})`);
    fireGrad.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = fireGrad;
    ctx.fillRect(-s * 0.3, -s * 0.2, s * 0.6, s * 0.4);
    // Fire core
    ctx.fillStyle = `rgba(239,68,68,${fireGlow * 0.8})`;
    ctx.beginPath();
    ctx.arc(0, s * 0.05, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    // Smoke plume (above roof)
    drawSmokePlume(ctx, 0, -s * 0.35, ts, now, 1.2);
  } else if (/camp|central|outpost/i.test(kind)) {
    // Central camp: two tents + fire
    ctx.fillStyle = '#9a7a5a';
    // Tent 1
    ctx.beginPath();
    ctx.moveTo(-s * 0.28, s * 0.1);
    ctx.lineTo(-s * 0.1, -s * 0.3);
    ctx.lineTo(s * 0.05, s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tent 2
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.1);
    ctx.lineTo(s * 0.2, -s * 0.2);
    ctx.lineTo(s * 0.35, s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Fire between
    const fireFlicker = 0.7 + 0.3 * Math.sin(now / 120);
    ctx.fillStyle = `rgba(255,140,50,${fireFlicker})`;
    ctx.beginPath();
    ctx.ellipse(-s * 0.04, s * 0.15, s * 0.06, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    // Smoke
    drawSmokePlume(ctx, -s * 0.04, s * 0.12, ts * 0.7, now, 0.7);
  } else if (/granary|storage|drying|dwelling|station|shelter|tent|medical/i.test(kind)) {
    // Tent
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
    // Door
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(-s * 0.06, s * 0.05, s * 0.12, s * 0.12);
  } else if (/watch|post|tower/i.test(kind)) {
    // Ladder posts
    ctx.strokeStyle = '#6b5a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.35);
    ctx.lineTo(-s * 0.12, -s * 0.25);
    ctx.moveTo(s * 0.18, s * 0.35);
    ctx.lineTo(s * 0.12, -s * 0.25);
    ctx.stroke();
    // Rungs
    for (let i = 0; i < 4; i++) {
      const yy = s * 0.35 - i * s * 0.15;
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, yy);
      ctx.lineTo(s * 0.15, yy);
      ctx.stroke();
    }
    // Platform
    ctx.fillStyle = '#8a7a5a';
    ctx.fillRect(-s * 0.28, -s * 0.3, s * 0.56, s * 0.08);
    ctx.strokeRect(-s * 0.28, -s * 0.3, s * 0.56, s * 0.08);
    // Roof
    ctx.fillStyle = '#6b4a2a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, -s * 0.3);
    ctx.lineTo(0, -s * 0.48);
    ctx.lineTo(s * 0.32, -s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
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

// Birds: small triangle with flapping wings tracing an arc across the map.
// One or two active at any time, ambient texture.
export function drawBird(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  wingPhase: number,
) {
  const flap = Math.sin(wingPhase * Math.PI * 2);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.strokeStyle = 'rgba(30,30,40,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  // Left wing
  ctx.moveTo(-size, flap * size * 0.4);
  ctx.quadraticCurveTo(-size * 0.4, -flap * size * 0.3, 0, 0);
  // Right wing
  ctx.quadraticCurveTo(size * 0.4, -flap * size * 0.3, size, flap * size * 0.4);
  ctx.stroke();
  ctx.restore();
}
