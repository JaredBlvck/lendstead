// Ambient + UI audio layer. Synthesized via WebAudio directly so we
// don't have to ship binary sound files. Keeps the bundle small and
// guarantees no CORS or licensing issues.

let audioCtx: AudioContext | null = null;
let enabled = false;
let ambientStarted = false;
let noiseBuffer: AudioBuffer | null = null;

function ctx(): AudioContext | null {
  if (!enabled) return null;
  if (!audioCtx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    audioCtx = new C();
  }
  return audioCtx;
}

function ensureNoise(): AudioBuffer | null {
  const c = ctx();
  if (!c) return null;
  if (!noiseBuffer) {
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
  }
  return noiseBuffer;
}

// Wind: filtered noise with slow LFO on volume
function startWind() {
  const c = ctx();
  const buf = ensureNoise();
  if (!c || !buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const gain = c.createGain();
  gain.gain.value = 0;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain).connect(gain.gain);
  src.connect(filter).connect(gain).connect(c.destination);
  lfo.start();
  src.start();
  // Fade in
  gain.gain.value = 0.015;
}

// Water lapping: bandpass noise bursts at random intervals
function startWater() {
  const c = ctx();
  const buf = ensureNoise();
  if (!c || !buf) return;

  const tick = () => {
    if (!enabled || !audioCtx) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800 + Math.random() * 600;
    filter.Q.value = 0.5;
    const gain = c.createGain();
    const now = c.currentTime;
    const peak = 0.015 + Math.random() * 0.015;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
    src.stop(now + 1.2);
    setTimeout(tick, 2800 + Math.random() * 3500);
  };
  tick();
}

// Bird chirp: short FM-synthesized tone
function chirp() {
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const mod = c.createOscillator();
  const modGain = c.createGain();
  modGain.gain.value = 200;
  mod.frequency.value = 8;
  mod.connect(modGain).connect(osc.frequency);
  osc.type = 'sine';
  osc.frequency.value = 1600 + Math.random() * 400;
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.04, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  osc.connect(g).connect(c.destination);
  mod.start(now);
  osc.start(now);
  mod.stop(now + 0.3);
  osc.stop(now + 0.3);
}

function startBirds() {
  const loop = () => {
    if (!enabled) return;
    chirp();
    if (Math.random() < 0.35) setTimeout(chirp, 180 + Math.random() * 200);
    setTimeout(loop, 5000 + Math.random() * 9000);
  };
  setTimeout(loop, 2000);
}

export const audio = {
  enable() {
    if (enabled) return;
    enabled = true;
    const c = ctx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    if (!ambientStarted) {
      startWind();
      startWater();
      startBirds();
      ambientStarted = true;
    }
  },
  disable() {
    enabled = false;
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
  },
  isEnabled() {
    return enabled;
  },
  // UI click blip
  click() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  },
  // Walk-target set (teal chime)
  tap() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  },
  // Anvil clink for smithy proximity
  anvil() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 2100;
    const g = c.createGain();
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 4;
    osc.connect(filter).connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  },
};
