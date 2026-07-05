"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Flame, Copy, Check, Play, Square } from "lucide-react";
import { cn } from "../lib/utils";
import { Card, Mono, Avatar } from "./primitives";
import { BallMascot } from "./mascot";

/* ── StreakFlame ── the arcade dopamine badge */
export function StreakFlame({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const hot = count >= 5;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs tabular",
        hot ? "border-warn/60 bg-warn/15 text-warn" : "border-border-strong bg-surface-2 text-text-dim",
        className,
      )}
    >
      <Flame size={12} className={hot ? "text-warn" : "text-text-muted"} />
      {count}
    </span>
  );
}

/* ── LeaderboardRow ── */
export function LeaderboardRow({
  rank,
  name,
  points,
  streak = 0,
  you = false,
}: {
  rank: number;
  name: string;
  points: number;
  streak?: number;
  you?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card border-2 px-3 py-2.5",
        you ? "border-pitch bg-pitch/10" : "border-border-strong bg-surface-2",
      )}
    >
      <Mono className="w-6 text-sm font-bold text-text-muted">{rank}</Mono>
      <Avatar name={name} />
      <span className="flex-1 truncate font-medium text-text">
        {name}
        {you && <span className="ml-1 text-xs text-win">you</span>}
      </span>
      <StreakFlame count={streak} />
      <Mono className="w-16 text-right text-sm font-bold text-text">{points.toLocaleString("en-US")}</Mono>
    </div>
  );
}

export function LeaderboardTable({
  rows,
}: {
  rows: { rank: number; name: string; points: number; streak?: number; you?: boolean }[];
}) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <LeaderboardRow key={r.rank} {...r} />
      ))}
    </div>
  );
}

/* ── OracleBubble ── the pundit presence. The Gaffer wears the coach headset
   (BallMascot accessory="cap") and, when `speakable`, carries a play/stop
   toggle. Voice itself lives with the consumer: the button only fires
   `onSpeak`; `speaking` drives the wave bars. */
export function OracleBubble({
  persona,
  line,
  speaking = false,
  speakable = false,
  onSpeak,
}: {
  persona: string;
  line: string;
  speaking?: boolean;
  /** Show the voice toggle. The consumer wires actual TTS via `onSpeak`. */
  speakable?: boolean;
  onSpeak?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <Card className="flex items-start gap-3 border-l-4 border-l-pitch px-4 py-3">
        <div className="-my-0.5 shrink-0">
          <BallMascot accessory="cap" size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-display text-xs text-pitch">{persona}</span>
            {speaking && (
              <span className="flex items-end gap-0.5" aria-label="speaking">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="wave-bar w-0.5 rounded-full bg-win"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </span>
            )}
            {speakable && (
              <button
                type="button"
                onClick={onSpeak}
                aria-label={speaking ? "Stop voice" : "Hear the call"}
                aria-pressed={speaking}
                className={cn(
                  "ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  speaking
                    ? "border-win/60 bg-win/15 text-win"
                    : "border-border-strong bg-surface-2 text-text-muted hover:border-pitch-700 hover:text-win",
                )}
              >
                {speaking ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
              </button>
            )}
          </div>
          <p className="text-sm text-text">{line}</p>
        </div>
      </Card>
    </motion.div>
  );
}

/* ── RoomCodeChip ── the invite primitive with copy */
export function RoomCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-2 rounded-card border-2 border-border-strong bg-surface-2 px-3 py-1.5 font-mono text-sm tabular text-text transition-colors hover:border-chalk"
    >
      <span className="tracking-widest">{code}</span>
      {copied ? <Check size={14} className="text-win" /> : <Copy size={14} className="text-text-muted" />}
    </button>
  );
}
