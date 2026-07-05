"use client";

/* ── KICK.FUN sound engine ──
   Fully synthesized (Web Audio): chiptune SFX + crowd ambience. No audio
   assets, no licensing, instant load, offline-safe. Fits Floodlit Arcade:
   the sounds ARE 8-bit, generated like a YM chip would.

   Rules (DESIGN_GUIDE §9): muted by default, one visible toggle, first user
   gesture unlocks the AudioContext, nothing essential is audio-only. */

export type SfxName =
  | "tap"        // UI tap / pick made
  | "lock"       // prediction window locks
  | "goal"       // the big one: rising fanfare
  | "win"        // settle correct: coin
  | "miss"       // settle wrong: soft low buzz
  | "var"        // VAR hold: two-tone alert
  | "streak"     // streak milestone: quick arpeggio
  | "kickoff";   // match start whistle-ish

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number };

/** Each SFX = tiny score of oscillator notes. f=freq(Hz), t=start(s), d=dur(s). */
const SCORES: Record<SfxName, Note[]> = {
  tap: [{ f: 880, t: 0, d: 0.05, type: "square", g: 0.25 }],
  lock: [
    { f: 660, t: 0, d: 0.07, type: "square", g: 0.3 },
    { f: 440, t: 0.08, d: 0.1, type: "square", g: 0.3 },
  ],
  goal: [
    { f: 523, t: 0, d: 0.09, type: "square", g: 0.4 },
    { f: 659, t: 0.09, d: 0.09, type: "square", g: 0.4 },
    { f: 784, t: 0.18, d: 0.09, type: "square", g: 0.4 },
    { f: 1047, t: 0.27, d: 0.28, type: "square", g: 0.5 },
    { f: 523, t: 0.27, d: 0.28, type: "triangle", g: 0.3 },
  ],
  win: [
    { f: 988, t: 0, d: 0.07, type: "square", g: 0.35 },
    { f: 1319, t: 0.08, d: 0.18, type: "square", g: 0.35 },
  ],
  miss: [{ f: 165, t: 0, d: 0.22, type: "sawtooth", g: 0.25 }],
  var: [
    { f: 740, t: 0, d: 0.12, type: "square", g: 0.3 },
    { f: 587, t: 0.16, d: 0.12, type: "square", g: 0.3 },
  ],
  streak: [
    { f: 659, t: 0, d: 0.06, type: "square", g: 0.3 },
    { f: 784, t: 0.06, d: 0.06, type: "square", g: 0.3 },
    { f: 988, t: 0.12, d: 0.06, type: "square", g: 0.3 },
    { f: 1319, t: 0.18, d: 0.12, type: "square", g: 0.35 },
  ],
  kickoff: [
    { f: 1568, t: 0, d: 0.35, type: "triangle", g: 0.35 },
    { f: 1568, t: 0.15, d: 0.2, type: "triangle", g: 0.25 },
  ],
};

const STORE_KEY = "kick.volume";
/** Master gain at full slider. Kept below 1 so summed oscillators never clip. */
const MAX_GAIN = 0.9;
const DEFAULT_VOLUME = 0.6;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowd: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private _volume = 0; // 0..1, source of truth. 0 == muted.
  private _lastNonZero = DEFAULT_VOLUME; // restore point for mute -> unmute
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      const raw = window.localStorage?.getItem(STORE_KEY);
      if (raw === null || raw === "") {
        // first visit: sound ON by default (audio still unlocks on first gesture)
        this._volume = DEFAULT_VOLUME;
      } else {
        const saved = Number(raw);
        // returning visitor: respect their level, including an explicit mute (0)
        this._volume = Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : DEFAULT_VOLUME;
      }
      if (this._volume > 0) this._lastNonZero = this._volume;
    }
  }

  get volume() {
    return this._volume;
  }
  get enabled() {
    return this._volume > 0;
  }

  /** React reactivity: subscribe returns an unsubscribe fn (useSyncExternalStore). */
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  private emit() {
    for (const cb of this.listeners) cb();
  }

  /** Set master volume 0..1. Must first be called from a user gesture (autoplay
      policy) so the AudioContext can unlock. Persists across reloads. */
  setVolume(v: number) {
    const vol = Math.max(0, Math.min(1, v));
    this._volume = vol;
    if (vol > 0) this._lastNonZero = vol;
    if (typeof window !== "undefined") window.localStorage?.setItem(STORE_KEY, String(vol));

    if (vol > 0) {
      this.ensureCtx();
      void this.ctx?.resume();
      if (this.master && this.ctx) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
        this.master.gain.linearRampToValueAtTime(vol * MAX_GAIN, now + 0.08);
      }
    } else if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.08);
    }
    this.emit();
  }

  private unlockAttached = false;
  /** With sound on by default, the AudioContext still needs a user gesture.
      Attach a one-time listener that unlocks audio + starts the crowd bed on
      the first tap/click anywhere. Safe to call many times. */
  attachAutoUnlock() {
    if (this.unlockAttached || typeof window === "undefined") return;
    this.unlockAttached = true;
    const unlock = () => {
      if (this.enabled) {
        this.ensureCtx();
        void this.ctx?.resume();
        this.startCrowd();
      }
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
  }

  /** Backward-compat on/off. Off remembers the last level for restore. */
  setEnabled(on: boolean) {
    this.setVolume(on ? this._lastNonZero : 0);
    if (!on) this.stopCrowd();
  }

  private ensureCtx() {
    if (this.ctx || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._volume * MAX_GAIN;
    this.master.connect(this.ctx.destination);
  }

  play(name: SfxName) {
    if (!this.enabled) return;
    this.ensureCtx();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    for (const n of SCORES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type ?? "square";
      osc.frequency.value = n.f;
      const g = n.g ?? 0.3;
      // fast attack, exponential decay: the chip-sound envelope
      gain.gain.setValueAtTime(0.0001, now + n.t);
      gain.gain.exponentialRampToValueAtTime(g, now + n.t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      osc.connect(gain).connect(master);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    }
  }

  /** Low filtered-noise loop that reads as distant stadium murmur. */
  startCrowd(level = 0.05) {
    if (!this.enabled) return;
    this.ensureCtx();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.crowd) return;
    const seconds = 2;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // brown-ish noise: integrate white noise
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    this.crowd = { src, gain };
  }

  /** Swell the crowd briefly (goal roar). */
  roar(peak = 0.22, ms = 1800) {
    const ctx = this.ctx;
    if (!ctx || !this.crowd || !this.enabled) return;
    const g = this.crowd.gain.gain;
    const base = 0.05;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(peak, now + 0.15);
    g.exponentialRampToValueAtTime(base, now + ms / 1000);
  }

  stopCrowd() {
    this.crowd?.src.stop();
    this.crowd = null;
  }
}

/** Singleton: one engine per tab. */
export const sound = new SoundEngine();
