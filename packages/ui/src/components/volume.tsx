"use client";

import * as React from "react";
import { Volume2, Volume1, VolumeX } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/utils";
import { sound } from "../sound";

/** Reactive read of the singleton engine's volume (0..1). */
export function useVolume() {
  return React.useSyncExternalStore(
    sound.subscribe,
    () => sound.volume,
    () => 0,
  );
}

const BARS = 10;
// Equalizer silhouette: rises toward the middle-right, like a real EQ.
const HEIGHTS = [0.35, 0.5, 0.62, 0.75, 0.88, 1, 0.9, 0.74, 0.58, 0.42];

/**
 * VolumeControl — the arcade master fader.
 * An always-visible graphic-equalizer strip: drag anywhere on it to set the
 * level (bars fill fractionally, lit bars shimmer), tap the glyph to mute.
 * Touch-first: no hover dependency, big hit target, pointer capture so the
 * drag never drops. First interaction unlocks the AudioContext + crowd bed.
 */
export function VolumeControl({ className, compact = false }: { className?: string; compact?: boolean }) {
  const volume = useVolume();
  const reduce = useReducedMotion();
  const bars = compact ? HEIGHTS.filter((_, i) => i % 2 === 0) : HEIGHTS; // 5 bars in compact
  const trackRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const startedCrowd = React.useRef(false);
  const lastTick = React.useRef(0);

  const apply = React.useCallback((v: number, tick = false) => {
    const next = Math.max(0, Math.min(1, v));
    sound.setVolume(next);
    if (next > 0 && !startedCrowd.current) {
      sound.startCrowd();
      startedCrowd.current = true;
    }
    // audible feedback while dragging, throttled so it clicks like a dial
    if (tick && next > 0) {
      const now = performance.now();
      if (now - lastTick.current > 90) {
        sound.play("tap");
        lastTick.current = now;
      }
    }
  }, []);

  const fromPointer = React.useCallback(
    (clientX: number, tick = false) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      apply((clientX - r.left) / r.width, tick);
    },
    [apply],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);
    fromPointer(e.clientX, true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) fromPointer(e.clientX, true);
  };
  const endDrag = () => {
    dragging.current = false;
  };

  const lastNonZero = React.useRef(0.6);
  React.useEffect(() => {
    if (volume > 0) lastNonZero.current = volume;
  }, [volume]);
  const toggleMute = () => apply(volume > 0 ? 0 : lastNonZero.current || 0.6, true);

  const nudge = (d: number) => apply(Math.round((volume + d) * 20) / 20, true);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); nudge(0.05); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); nudge(-0.05); }
    else if (e.key === "Home") { e.preventDefault(); apply(0); }
    else if (e.key === "End") { e.preventDefault(); apply(1); }
  };

  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const muted = volume === 0;
  const pct = Math.round(volume * 100);

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-card border-2 bg-surface-2 transition-colors",
        compact ? "h-8 gap-0 pl-0 pr-1" : "h-10 gap-0.5 pl-0.5 pr-2",
        muted ? "border-border-strong" : "border-pitch-700",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-[3px] transition-colors",
          compact ? "h-7 w-7" : "h-8 w-8",
          muted ? "text-text-muted hover:text-text-dim" : "text-win",
        )}
      >
        <Icon size={compact ? 13 : 15} />
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={muted ? "Muted" : `${pct}%`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={cn(
          "flex cursor-ew-resize touch-none select-none items-end rounded-[3px] px-1 pb-1 pt-1.5 outline-none focus-visible:ring-2 focus-visible:ring-pitch",
          compact ? "h-7 w-[52px] gap-[2px]" : "h-8 w-[104px] gap-[3px]",
        )}
      >
        {bars.map((h, i) => {
          // fractional fill: bar i lights from its own share of the range
          const fill = Math.max(0, Math.min(1, volume * bars.length - i));
          const lit = fill > 0.02;
          return (
            <div key={i} className="relative h-full w-full">
              {/* unlit base */}
              <div
                className="absolute bottom-0 w-full rounded-[1px] bg-ink-800"
                style={{ height: `${h * 100}%` }}
              />
              {/* lit portion, grows bottom-up with the exact fraction */}
              <motion.div
                className="absolute bottom-0 w-full origin-bottom rounded-[1px] bg-pitch"
                style={{ height: `${h * 100}%`, boxShadow: lit ? "0 0 6px rgba(34,197,94,0.45)" : "none" }}
                animate={{ scaleY: fill }}
                transition={{ type: "tween", duration: 0.06, ease: "linear" }}
              />
              {/* shimmer: lit bars breathe gently when audio is on */}
              {lit && !reduce && (
                <motion.div
                  className="absolute bottom-0 w-full rounded-[1px] bg-pitch-glow/60"
                  style={{ height: `${h * 100}%`, transformOrigin: "bottom" }}
                  animate={{ scaleY: [fill * 0.85, fill, fill * 0.9], opacity: [0.25, 0.5, 0.3] }}
                  transition={{ duration: 1 + i * 0.06, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
