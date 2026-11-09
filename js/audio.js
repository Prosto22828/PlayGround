/* Tiny procedural audio engine — no asset downloads, all WebAudio. */

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.enabled = true;
    this.volume = 0.8;
    this._padTimer = null;
    this._birdTimer = null;
    this._chordIndex = 0;
    this._started = false;
    this._chords = [
      [196.0, 246.94, 293.66, 392.0],   // G maj
      [174.61, 220.0, 261.63, 349.23],  // F maj
      [261.63, 329.63, 392.0, 523.25],  // C maj
      [220.0, 261.63, 329.63, 440.0],   // A min
    ];
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume * 0.55 : 0;
      this.master.connect(this.ctx.destination);
      this._startAmbience();
      return true;
    } catch (e) {
      console.warn('Audio unavailable', e);
      return false;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? this.volume * 0.55 : 0, t, 0.08);
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(this.enabled ? v * 0.55 : 0, this.ctx.currentTime, 0.08);
  }

  _startAmbience() {
    if (!this.ctx || this._started) return;
    this._started = true;
    this.ambient = this.ctx.createGain();
    this.ambient.gain.value = 0.0;
    this.ambient.connect(this.master);
    this.ambient.gain.setTargetAtTime(0.11, this.ctx.currentTime, 3);

    // soft wind: filtered noise loop
    try {
      const len = this.ctx.sampleRate * 3;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      const g = this.ctx.createGain();
      g.gain.value = 0.035;
      src.connect(lp).connect(g).connect(this.ambient);
      src.start();
    } catch (e) { /* ignore */ }

    const schedulePad = () => {
      this._pad();
      this._padTimer = setTimeout(schedulePad, 6800 + Math.random() * 1400);
    };
    schedulePad();

    const scheduleBird = () => {
      this._bird();
      this._birdTimer = setTimeout(scheduleBird, 5000 + Math.random() * 9000);
    };
    this._birdTimer = setTimeout(scheduleBird, 2600);
  }

  _pad() {
    if (!this.ctx) return;
    const notes = this._chords[this._chordIndex++ % this._chords.length];
    const now = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      const peak = 0.016 / (1 + i * 0.25);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + 2.0);
      g.gain.linearRampToValueAtTime(peak * 0.8, now + 4.6);
      g.gain.linearRampToValueAtTime(0, now + 7.2);
      osc.connect(g).connect(this.ambient);
      osc.start(now);
      osc.stop(now + 7.5);
    });
  }

  _bird() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const chirps = 2 + Math.floor(Math.random() * 3);
    const base = 1700 + Math.random() * 1200;
    for (let i = 0; i < chirps; i++) {
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * (1.35 + Math.random() * 0.3), t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(base * 0.95, t + 0.11);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.02);
      g.gain.linearRampToValueAtTime(0, t + 0.12);
      osc.connect(g).connect(this.ambient);
      osc.start(t);
      osc.stop(t + 0.14);
    }
  }

  _tone({ freq = 440, type = 'sine', dur = 0.16, vol = 0.14, slide = 0, delay = 0, attack = 0.008, dest = null }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest || this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.12, vol = 0.08, freq = 900, q = 1, type = 'bandpass', delay = 0, sweep = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  ui() { this._tone({ freq: 720, type: 'sine', dur: 0.07, vol: 0.055 }); }
  pickup(index = 0) {
    const f = 520 * Math.pow(1.06, index % 8);
    this._tone({ freq: f, type: 'triangle', dur: 0.11, vol: 0.11, slide: 190 });
    this._noise({ dur: 0.045, vol: 0.035, freq: 2200, type: 'highpass' });
  }
  place(index = 0) {
    this._noise({ dur: 0.09, vol: 0.09, freq: 740, q: 0.7, type: 'lowpass' });
    this._tone({ freq: 130 + (index % 5) * 8, type: 'sine', dur: 0.12, vol: 0.16, slide: -42 });
    this._tone({ freq: 2500, type: 'square', dur: 0.026, vol: 0.02, delay: 0.008 });
  }
  drop() {
    this._noise({ dur: 0.13, vol: 0.07, freq: 520, type: 'lowpass' });
    this._tone({ freq: 160, type: 'sine', dur: 0.14, vol: 0.11, slide: -60 });
  }
  throw() {
    this._noise({ dur: 0.2, vol: 0.055, freq: 1300, type: 'bandpass', sweep: -900, q: 0.8 });
  }
  magnet() {
    this._tone({ freq: 260, type: 'sine', dur: 0.5, vol: 0.11, slide: 900 });
    this._tone({ freq: 390, type: 'triangle', dur: 0.45, vol: 0.06, slide: 820, delay: 0.06 });
    this._noise({ dur: 0.4, vol: 0.03, freq: 2400, type: 'highpass', sweep: -1200 });
  }
  jump() {
    this._tone({ freq: 380, type: 'triangle', dur: 0.12, vol: 0.05, slide: 220 });
    this._noise({ dur: 0.05, vol: 0.02, freq: 1200, type: 'lowpass' });
  }
  footstep(soft = false) {
    this._noise({ dur: 0.06, vol: soft ? 0.018 : 0.034, freq: 260 + Math.random() * 160, type: 'lowpass' });
  }
  complete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._tone({ freq: f, type: 'triangle', dur: 0.55, vol: 0.12, delay: i * 0.11 });
      this._tone({ freq: f * 2, type: 'sine', dur: 0.42, vol: 0.035, delay: i * 0.11 });
    });
    this._noise({ dur: 0.5, vol: 0.022, freq: 5000, type: 'highpass', delay: 0.1 });
  }
  unlock() {
    [659.25, 880, 1108.73, 1318.51].forEach((f, i) => {
      this._tone({ freq: f, type: 'sine', dur: 0.42, vol: 0.1, delay: i * 0.09 });
    });
    this._noise({ dur: 0.4, vol: 0.018, freq: 6000, type: 'highpass', delay: 0.15 });
  }
  error() {
    this._tone({ freq: 220, type: 'square', dur: 0.09, vol: 0.045, slide: -40 });
  }
  page() {
    this._noise({ dur: 0.16, vol: 0.028, freq: 3000, type: 'highpass' });
  }
  finish() {
    const seq = [392, 523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    seq.forEach((f, i) => {
      this._tone({ freq: f, type: 'triangle', dur: 1.1, vol: 0.1, delay: i * 0.16 });
    });
    this._noise({ dur: 1.4, vol: 0.03, freq: 6000, type: 'highpass', delay: 0.2 });
  }
  dispose() {
    if (this._padTimer) clearTimeout(this._padTimer);
    if (this._birdTimer) clearTimeout(this._birdTimer);
    if (this.ctx) this.ctx.close();
  }
}
