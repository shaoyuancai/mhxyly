/* 轻量合成音效：无音频文件，首次交互后初始化 WebAudio。 */
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let enabled = true;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 1.2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!ctx) return;
    const t0 = now() + (when || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, gain, filterType, freq, when, q) {
    if (!ctx || !noiseBuf) return;
    const t0 = now() + (when || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.setValueAtTime(freq || 1200, t0);
    f.Q.value = q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.06, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  const PENTA = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99];

  const SOUNDS = {
    tap() { noise(0.06, 0.03, 'highpass', 2200); tone(520, 0.06, 'triangle', 0.03); },
    open() { tone(392, 0.22, 'sine', 0.04); tone(587.33, 0.3, 'sine', 0.03, 0.05); },
    wash() {
      noise(0.7, 0.075, 'bandpass', 700, 0, 1.4);
      noise(0.5, 0.05, 'highpass', 1800, 0.12);
      tone(180, 0.6, 'sine', 0.05, 0, 90);
      tone(392, 0.25, 'triangle', 0.03, 0.4);
    },
    reveal() {
      [0, 2, 4, 5].forEach((n, i) => tone(PENTA[n], 0.5, 'triangle', 0.045, i * 0.07));
      noise(0.25, 0.02, 'highpass', 3000, 0.1);
    },
    great() {
      [0, 2, 4, 5, 7].forEach((n, i) => tone(PENTA[n], 0.7, 'sine', 0.05, i * 0.08));
      [2, 4].forEach(n => tone(PENTA[n] * 2, 0.9, 'sine', 0.02, 0.3));
      noise(0.4, 0.025, 'highpass', 4200, 0.1);
    },
    book() {
      noise(0.22, 0.06, 'bandpass', 1600, 0, 0.9);
      tone(660, 0.12, 'square', 0.018, 0.02);
      tone(880, 0.2, 'sine', 0.03, 0.1);
    },
    openSlot() {
      [0, 4, 5, 7].forEach((n, i) => tone(PENTA[n], 0.55, 'sine', 0.05, i * 0.06));
      noise(0.3, 0.03, 'highpass', 3600);
    },
    fusion() {
      noise(0.9, 0.08, 'lowpass', 500);
      tone(70, 1.1, 'sawtooth', 0.04, 0, 40);
      tone(140, 0.8, 'triangle', 0.03, 0.2, 90);
      [0, 2, 4].forEach((n, i) => tone(PENTA[n], 0.6, 'sine', 0.035, 0.7 + i * 0.09));
    },
    fail() {
      [4, 2, 0].forEach((n, i) => tone(PENTA[n] / 2, 0.45, 'triangle', 0.05, i * 0.13));
      noise(0.4, 0.04, 'lowpass', 320, 0.1);
    },
    coin() {
      tone(1046.5, 0.18, 'sine', 0.035);
      tone(1568, 0.25, 'sine', 0.025, 0.06);
    },
    achievement() {
      [0, 2, 4, 7].forEach((n, i) => tone(PENTA[n] * 2, 0.5, 'sine', 0.035, i * 0.08));
    },
  };

  window.Sfx = {
    init,
    setEnabled(v) { enabled = !!v; if (enabled) init(); },
    play(name) {
      if (!enabled) return;
      if (!ctx) init();
      if (!ctx || ctx.state === 'suspended') return;
      const fn = SOUNDS[name] || SOUNDS.tap;
      try { fn(); } catch (e) { /* 忽略音频异常 */ }
    },
  };
})();
