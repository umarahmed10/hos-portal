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

export function playJoin() {
  try {
    tone(587, 0.12, 0.10, "sine", 0);
    tone(784, 0.14, 0.12, "sine", 0.08);
  } catch { /* audio context not available */ }
}

export function playLeave() {
  try {
    tone(784, 0.12, 0.08, "sine", 0);
    tone(523, 0.16, 0.06, "sine", 0.08);
  } catch { /* audio context not available */ }
}

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

export function playConnected() {
  try {
    tone(523, 0.08, 0.07, "sine", 0);
    tone(659, 0.08, 0.08, "sine", 0.06);
    tone(784, 0.12, 0.09, "sine", 0.12);
  } catch { /* audio context not available */ }
}

export function playDisconnected() {
  try {
    tone(784, 0.08, 0.06, "sine", 0);
    tone(659, 0.08, 0.05, "sine", 0.06);
    tone(523, 0.12, 0.04, "sine", 0.12);
  } catch { /* audio context not available */ }
}

export function playScreenShare() {
  try {
    tone(440, 0.06, 0.06, "sine", 0);
    tone(660, 0.06, 0.07, "triangle", 0.04);
    tone(880, 0.10, 0.08, "sine", 0.08);
  } catch { /* audio context not available */ }
}

export function playScreenShareEnd() {
  try {
    tone(880, 0.06, 0.05, "sine", 0);
    tone(660, 0.06, 0.04, "triangle", 0.04);
    tone(440, 0.10, 0.03, "sine", 0.08);
  } catch { /* audio context not available */ }
}

export function playUploadComplete() {
  try {
    tone(880, 0.05, 0.06, "sine", 0);
    tone(1047, 0.08, 0.07, "sine", 0.04);
  } catch { /* audio context not available */ }
}

export function playMuteToggle() {
  try {
    const ac = audio();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = 600;
    g.gain.setValueAtTime(0.04, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.025);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.03);
  } catch { /* audio context not available */ }
}

export function playRingtone(): () => void {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let activeOscillators: OscillatorNode[] = [];

  function stop() {
    stopped = true;
    if (timeoutId !== null) clearTimeout(timeoutId);
    activeOscillators.forEach(osc => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    activeOscillators = [];
  }

  try {
    const ac = audio();

    const chords = [
      [523.3, 659.3, 784.0, 987.8],  // Cmaj7: C5 E5 G5 B5
      [440.0, 523.3, 659.3, 784.0],  // Am7:   A4 C5 E5 G5
    ];

    let chordIdx = 0;

    const playChord = () => {
      if (stopped) return;
      const notes = chords[chordIdx % chords.length];
      chordIdx++;

      notes.forEach((freq, i) => {
        if (stopped) return;
        const delay = i * 0.06;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.value = freq;
        const t = ac.currentTime + delay;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(g).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.5);
        activeOscillators.push(osc);
        osc.onended = () => {
          activeOscillators = activeOscillators.filter(o => o !== osc);
        };
      });

      timeoutId = setTimeout(playChord, 1400);
    };

    playChord();
  } catch { /* audio context not available */ }

  return stop;
}

export function playIncomingPing() {
  try {
    tone(880, 0.08, 0.12, "sine", 0);
    tone(1047, 0.08, 0.14, "sine", 0.06);
    tone(1319, 0.12, 0.10, "sine", 0.12);
  } catch { /* audio context not available */ }
}
