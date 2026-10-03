// ============================================================
// AudioSystem — hiệu ứng âm thanh tổng hợp bằng WebAudio
// (không cần file âm thanh, không lo bản quyền, tải tức thì).
// Trình duyệt chỉ cho phát sau khi người dùng click => gọi unlock().
// ============================================================

const ELEMENT_PITCH = { kim: 880, moc: 520, thuy: 660, hoa: 400, tho: 260 };
const STORAGE_KEY = 'ngu-hanh-muted';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    try { this.muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch { /* storage bị chặn */ }
    this._last = {};
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch { return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0'); } catch { /* bỏ qua */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _ok(name, minGap = 0.03) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return false;
    const now = this.ctx.currentTime;
    if (this._last[name] && now - this._last[name] < minGap) return false;
    this._last[name] = now;
    return true;
  }

  _tone(type, f0, f1, dur, vol, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterType, f0, f1, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  cast(element, ultimate) {
    if (!this._ok('cast' + element, 0.05)) return;
    const f = ELEMENT_PITCH[element] ?? 500;
    if (ultimate) {
      this._tone('sawtooth', f * 0.25, f * 1.2, 0.7, 0.25);
      this._tone('square', f * 0.5, f * 0.12, 0.9, 0.12, 0.05);
      this._noise(0.9, 0.35, 'bandpass', 400, 3000);
    } else {
      this._tone('triangle', f, f * 0.5, 0.16, 0.22);
      this._noise(0.18, 0.15, 'highpass', 2500, 900);
    }
  }

  hit(big) {
    if (!this._ok('hit', 0.04)) return;
    this._tone('sine', big ? 180 : 220, 40, big ? 0.4 : 0.2, big ? 0.6 : 0.45);
    this._noise(big ? 0.35 : 0.15, big ? 0.5 : 0.3, 'lowpass', 3000, 200);
  }

  clash() {
    if (!this._ok('clash', 0.05)) return;
    this._tone('square', 1400, 900, 0.12, 0.12);
    this._tone('triangle', 2100, 1500, 0.25, 0.12);
    this._noise(0.2, 0.25, 'highpass', 4000, 2000);
  }

  edge() {
    if (!this._ok('edge', 0.35)) return;
    this._tone('sawtooth', 90, 70, 0.25, 0.12);
  }

  denied() {
    if (!this._ok('denied', 0.2)) return;
    this._tone('square', 200, 150, 0.12, 0.08);
  }

  beep(high) {
    if (!this._ok('beep' + high, 0.1)) return;
    this._tone('square', high ? 1046 : 523, high ? 1046 : 523, high ? 0.45 : 0.18, 0.15);
  }

  ko() {
    if (!this._ok('ko', 0.5)) return;
    this._tone('sine', 120, 30, 1.4, 0.7);
    this._noise(1.2, 0.5, 'lowpass', 1500, 60);
    this._tone('sawtooth', 300, 60, 1.0, 0.15, 0.05);
  }

  win() {
    if (!this._ok('win', 1)) return;
    [523, 659, 784, 1046].forEach((f, i) => this._tone('triangle', f, f, 0.35, 0.18, 0.12 * i));
  }
}
