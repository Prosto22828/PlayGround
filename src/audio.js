export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastDig = 0;
    this.lastStep = 0;
    this.ambientGain = null;
    this.ambientFilter = null;
    this.rumbleGain = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);

    // noise buffer
    const len = Math.floor(this.ctx.sampleRate * 2);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }

    // ambient wind
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.value = 420;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.055;
    src.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.master);
    src.start();

    // underground rumble
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 41;
    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;
    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 90;
    osc.connect(rumbleFilter);
    rumbleFilter.connect(this.rumbleGain);
    this.rumbleGain.connect(this.master);
    osc.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  setDepth(depth) {
    if (!this.ctx) return;
    const t = Math.max(0, Math.min(1, (depth - 2) / 30));
    this.ambientFilter.frequency.setTargetAtTime(420 - t * 280, this.ctx.currentTime, 0.4);
    this.ambientGain.gain.setTargetAtTime(0.055 - t * 0.03, this.ctx.currentTime, 0.4);
    this.rumbleGain.gain.setTargetAtTime(t * 0.045, this.ctx.currentTime, 0.5);
  }

  _env(node, gain, attack, decay, time = 0) {
    const t = this.ctx.currentTime + time;
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _noise(duration, filterType, freq, q, gain, time = 0) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime + time;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  _tone(freq, duration, type, gain, slideTo = null, time = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + time;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + duration + 0.03);
  }

  digLoop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastDig < 0.13) return;
    this.lastDig = now;
    this._noise(0.09, 'bandpass', 900 + Math.random() * 900, 1.2, 0.06);
    this._tone(120 + Math.random() * 50, 0.07, 'triangle', 0.035);
  }

  breakBlock() {
    this._noise(0.2, 'lowpass', 780, 0.8, 0.12);
    this._tone(95, 0.16, 'sine', 0.09, 55);
  }

  pickup() {
    this._tone(660, 0.07, 'sine', 0.045, 990);
  }

  cash() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.06, null, i * 0.07));
  }

  buy() {
    this._tone(392, 0.1, 'triangle', 0.07, 523);
    this._tone(523, 0.16, 'triangle', 0.06, 784, 0.08);
  }

  clank() {
    this._noise(0.1, 'highpass', 1400, 1.4, 0.05);
    this._tone(150, 0.1, 'square', 0.035, 90);
  }

  jump() { this._tone(240, 0.11, 'sine', 0.04, 430); }
  land() { this._noise(0.12, 'lowpass', 360, 0.9, 0.08); }

  step() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStep < 0.12) return;
    this.lastStep = now;
    this._noise(0.07, 'bandpass', 300 + Math.random() * 200, 1.6, 0.025);
  }

  winch() {
    this._noise(0.6, 'bandpass', 700, 0.7, 0.05);
    this._tone(220, 0.5, 'sine', 0.05, 700);
  }

  win() {
    [392, 523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.7, 'triangle', 0.08, null, i * 0.12));
    this._noise(1.4, 'lowpass', 500, 0.6, 0.06);
  }
}
