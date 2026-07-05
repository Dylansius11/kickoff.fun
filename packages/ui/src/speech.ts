"use client";

/* ── Oracle voice ──
   Free, zero-asset TTS via the browser's speechSynthesis. The Gaffer speaks
   in a low, slightly slow register (gruff pundit). Respects the master
   fader: volume comes from the sound engine, and volume 0 means silence.

   Reactive like sound.ts: subscribe/emit so React reads `speaking` through
   useSyncExternalStore without polling. SSR-safe throughout. */

import * as React from "react";
import { sound } from "./sound";

/** Preferred voice names, best first. Gruff en-GB pundits when available. */
const VOICE_PREFERENCE = ["Daniel", "Google UK English Male"];

class OracleVoice {
  private _speaking = false;
  private listeners = new Set<() => void>();
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      // Voice list often loads async (Chrome); pick again when it arrives.
      window.speechSynthesis.addEventListener?.("voiceschanged", () => {
        this.voice = this.pickVoice();
      });
    }
  }

  get speaking() {
    return this._speaking;
  }

  /** React reactivity: subscribe returns an unsubscribe fn (useSyncExternalStore). */
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  private emit() {
    for (const cb of this.listeners) cb();
  }
  private setSpeaking(on: boolean) {
    if (this._speaking === on) return;
    this._speaking = on;
    this.emit();
  }

  /** Best available English voice: preferred en-GB names, then any en-GB,
      then any English voice, else the platform default. */
  private pickVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    for (const name of VOICE_PREFERENCE) {
      const hit = voices.find((v) => v.name.includes(name) && v.lang.toLowerCase().startsWith("en"));
      if (hit) return hit;
    }
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith("en-gb")) ??
      voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
      null
    );
  }

  /** Speak a line, cancelling anything mid-utterance. No-op when the master
      fader is at 0 or speechSynthesis is unavailable. */
  speak(line: string, opts?: { rate?: number; pitch?: number }) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const volume = sound.volume;
    if (volume <= 0 || !line.trim()) return;

    const synth = window.speechSynthesis;
    synth.cancel(); // one pundit, one mic: never overlap

    if (!this.voice) this.voice = this.pickVoice();

    const u = new SpeechSynthesisUtterance(line);
    if (this.voice) u.voice = this.voice;
    u.rate = opts?.rate ?? 0.98;
    u.pitch = opts?.pitch ?? 0.82;
    u.volume = volume;
    u.onstart = () => this.setSpeaking(true);
    u.onend = () => this.setSpeaking(false);
    u.onerror = () => this.setSpeaking(false);
    synth.speak(u);
  }

  stop() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.setSpeaking(false);
  }
}

/** Singleton: one voice per tab, same pattern as `sound`. */
export const oracleVoice = new OracleVoice();

const getSpeaking = () => oracleVoice.speaking;
const getServerSpeaking = () => false;

/** Reactive `oracleVoice.speaking` for components (drives the wave bars). */
export function useOracleSpeaking(): boolean {
  return React.useSyncExternalStore(oracleVoice.subscribe, getSpeaking, getServerSpeaking);
}
