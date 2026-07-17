// Minimal Web Audio sound effects for the comms module.
// All sounds are synthesized — zero external files, zero network requests.
// Inspired by Discord join/leave tones and Apple notification haptics.

let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, gain: number, type: OscillatorType = "sine", delay = 0) {
  const ac = audio();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ac.currentTime + delay;
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration);
}

// Two ascending tones — someone joined the call
export function playJoin() {
  try {
    tone(587, 0.12, 0.10, "sine", 0);      // D5
    tone(784, 0.14, 0.12, "sine", 0.08);    // G5
  } catch { /* audio context not available */ }
}

// Two descending tones — someone left the call
export function playLeave() {
  try {
    tone(784, 0.12, 0.08, "sine", 0);       // G5
    tone(523, 0.16, 0.06, "sine", 0.08);    // C5
  } catch { /* audio context not available */ }
}

// Short crisp pop — message sent
export function playSend() {
  try {
    const ac = audio();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.04);
    g.gain.setValueAtTime(0.06, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.06);
  } catch { /* audio context not available */ }
}

// Soft tap — message received
export function playReceive() {
  try {
    const ac = audio();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ac.currentTime + 0.05);
    g.gain.setValueAtTime(0.04, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.07);
  } catch { /* audio context not available */ }
}

// Connected to voice — confirmation chime
export function playConnected() {
  try {
    tone(523, 0.08, 0.07, "sine", 0);       // C5
    tone(659, 0.08, 0.08, "sine", 0.06);    // E5
    tone(784, 0.12, 0.09, "sine", 0.12);    // G5
  } catch { /* audio context not available */ }
}

// Disconnected from voice — descending triplet
export function playDisconnected() {
  try {
    tone(784, 0.08, 0.06, "sine", 0);       // G5
    tone(659, 0.08, 0.05, "sine", 0.06);    // E5
    tone(523, 0.12, 0.04, "sine", 0.12);    // C5
  } catch { /* audio context not available */ }
}
