// Sound, synthesised with WebAudio: no audio files, no network. Every effect is
// a few oscillators or a burst of filtered noise, built on the first user gesture
// (browsers only allow audio after one). Volume falls with distance for bot shots.
export function createAudio() {
  let context = null;
  let master = null;
  let lastBeep = 0;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, gain, slideTo) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(duration, filterFreq, gain) {
    if (!context || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const amp = context.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(now);
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
    },
    shot(distance = 0, friendly = true) {
      if (!ensure()) return;
      const volume = friendly ? 0.5 : Math.max(0.05, 0.4 / (1 + distance * 0.09));
      noise(0.09, 2400, volume);
      tone(friendly ? 160 : 120, 0.08, 'square', volume * 0.5, 60);
    },
    dryFire() {
      tone(1400, 0.03, 'square', 0.12);
    },
    reload() {
      tone(700, 0.05, 'square', 0.15);
      setTimeout(() => tone(900, 0.05, 'square', 0.15), 180);
    },
    hit() {
      tone(2100, 0.05, 'sine', 0.25);
    },
    kill() {
      tone(1200, 0.07, 'sine', 0.25);
      setTimeout(() => tone(1800, 0.09, 'sine', 0.25), 70);
    },
    hurt() {
      tone(110, 0.18, 'sawtooth', 0.3, 60);
      noise(0.12, 500, 0.2);
    },
    plantTick(progress) {
      if (!ensure()) return;
      const now = context.currentTime;
      if (now - lastBeep < 0.25) return;
      lastBeep = now;
      tone(900 + progress * 300, 0.05, 'sine', 0.18);
    },
    planted() {
      tone(880, 0.1, 'sine', 0.25);
      setTimeout(() => tone(880, 0.1, 'sine', 0.25), 140);
      setTimeout(() => tone(1320, 0.16, 'sine', 0.25), 280);
    },
    fuseBeep(timer) {
      if (!ensure()) return;
      const now = context.currentTime;
      const gap = timer > 20 ? 1 : timer > 10 ? 0.6 : 0.3;
      if (now - lastBeep < gap) return;
      lastBeep = now;
      tone(timer > 10 ? 1000 : 1400, 0.06, 'sine', 0.2);
    },
    explosion() {
      noise(0.7, 400, 0.8);
      tone(90, 0.6, 'sine', 0.5, 30);
    },
    throwWhoosh() {
      noise(0.25, 900, 0.2);
    },
    roundWin() {
      [523, 659, 784].forEach((freq, i) => setTimeout(() => tone(freq, 0.16, 'sine', 0.25), i * 110));
    },
    roundLose() {
      [392, 330, 262].forEach((freq, i) => setTimeout(() => tone(freq, 0.18, 'sine', 0.25), i * 120));
    },
    buy() {
      tone(1400, 0.06, 'sine', 0.2);
      setTimeout(() => tone(1900, 0.08, 'sine', 0.2), 60);
    },
  };
}
