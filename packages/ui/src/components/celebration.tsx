"use client";

import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion, AnimatePresence } from "motion/react";
import { ShieldCheck, Copy, Check, Trophy, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Mono } from "./primitives";
import { BallMascot } from "./mascot";
import { shareToX, openXIntent, type SharePath } from "../share";

/* ── CountUp ── tabular number that rolls to its target (points, pot, rank). */
export function CountUp({
  to,
  from = 0,
  duration = 1.1,
  prefix = "",
  suffix = "",
  className,
  format = (n: number) => Math.round(n).toLocaleString("en-US"),
}: {
  to: number;
  from?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  format?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(from);
  const [n, setN] = React.useState(from);
  React.useEffect(() => {
    if (reduce) { setN(to); return; }
    const controls = animate(mv, to, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsub = mv.on("change", (v) => setN(v));
    return () => { controls.stop(); unsub(); };
  }, [to, duration, reduce, mv]);
  return (
    <Mono className={className}>
      {prefix}
      {format(n)}
      {suffix}
    </Mono>
  );
}

/* ── PixelBurst ── deterministic confetti of pixel shards (SSR-safe).
   Fires on mount and whenever `burstKey` changes. Pure decoration. */
const SHARD_COLORS = ["var(--pitch-400)", "var(--chalk)", "var(--pitch-500)", "var(--warn)"];
function shardVec(i: number, count: number) {
  // deterministic spread: golden-angle scatter, varied speed/size by index hash
  const angle = (i * 137.508 * Math.PI) / 180;
  const h = (i * 2654435761) >>> 0;
  const speed = 90 + (h % 120);
  const size = 4 + (h % 4) * 2;
  const spin = (h % 2 ? 1 : -1) * (180 + (h % 180));
  const delay = (h % 100) / 1000;
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed - 40,
    color: SHARD_COLORS[i % SHARD_COLORS.length],
    size,
    spin,
    delay,
  };
}

export function PixelBurst({ burstKey = 0, count = 28, className }: { burstKey?: number; count?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const shards = Array.from({ length: count }, (_, i) => shardVec(i, count));
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-20 flex items-center justify-center", className)} aria-hidden>
      {shards.map((s, i) => (
        <motion.span
          key={`${burstKey}-${i}`}
          className="absolute rounded-[1px]"
          style={{ width: s.size, height: s.size, background: s.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: s.x, y: [s.y, s.y + 120], opacity: [1, 1, 0], rotate: s.spin, scale: [1, 1, 0.4] }}
          transition={{ duration: 1.1, delay: s.delay, ease: [0.2, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

/* ── RankReveal ── the final placement, springing in with overshoot. */
const MEDAL: Record<number, { ring: string; text: string; glow: string; label: string }> = {
  1: { ring: "border-warn", text: "text-warn", glow: "0 0 40px rgba(245,165,36,0.45)", label: "CHAMPION OF THE TERRACE" },
  2: { ring: "border-text-dim", text: "text-text", glow: "0 0 30px rgba(241,245,240,0.25)", label: "RUNNER UP" },
  3: { ring: "border-pitch-700", text: "text-win", glow: "0 0 30px rgba(34,197,94,0.3)", label: "ON THE PODIUM" },
};
export function RankReveal({ rank, total }: { rank: number; total: number }) {
  const m = MEDAL[rank] ?? { ring: "border-border-strong", text: "text-text", glow: "none", label: "FULL TIME" };
  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.15 }}
        className={cn(
          "relative flex h-24 w-24 items-center justify-center rounded-full border-4 bg-ink-950",
          m.ring,
        )}
        style={{ boxShadow: m.glow }}
      >
        {rank === 1 && <Trophy size={20} className="absolute -top-3 text-warn" />}
        <Mono className={cn("font-display text-5xl font-bold leading-none", m.text)}>{rank}</Mono>
      </motion.div>
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-3 text-center"
      >
        <div className={cn("font-display text-xs tracking-widest", m.text)}>{m.label}</div>
        <Mono className="text-xs text-text-muted">
          {rank} of {total}
        </Mono>
      </motion.div>
    </div>
  );
}

/* ── ShareCard ── the viral full-time receipt. Portrait, screenshot-ready,
   floodlit glow + scanline + sheen sweep. This is what gets posted. */
export interface ShareCardData {
  fixture: string;          // "BRA v ARG"
  score: string;            // "2–1" (en-dash allowed for scores)
  handle: string;           // "@pixelpele"
  rank: number;
  total: number;
  points: number;
  streakBest?: number;
  anchor: string;           // short tx hash "9Exb…cKaA"
  potLabel?: string;        // "1,000 USDC · Adidas" if this player won it
}

export function ShareCard({ data, className }: { data: ShareCardData; className?: string }) {
  const reduce = useReducedMotion();
  const podium = data.rank <= 3;
  return (
    <div
      className={cn(
        "relative isolate w-[320px] overflow-hidden rounded-card border-2 border-pitch-700 bg-ink-950 shadow-hard",
        className,
      )}
    >
      {/* floodlit wash */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(80% 55% at 50% 0%, rgba(34,197,94,0.22), transparent 70%)" }}
      />
      <div className="scanlines pointer-events-none absolute inset-0 -z-10 opacity-40" />
      {/* sheen sweep (excluded from PNG capture: a mid-sweep frame smears) */}
      {!reduce && (
        <motion.div
          data-no-capture
          className="pointer-events-none absolute inset-y-0 -left-1/3 -z-10 w-1/3"
          style={{ background: "linear-gradient(105deg, transparent, rgba(241,245,240,0.10), transparent)" }}
          animate={{ x: ["0%", "420%"] }}
          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
        />
      )}

      <div className="flex flex-col p-5">
        {/* header */}
        <div className="flex items-center justify-between">
          <span className="font-display text-base tracking-tight text-text">KICK.FUN</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-pitch-700 bg-pitch/10 px-2 py-0.5 font-mono text-[10px] tabular text-win">
            <ShieldCheck size={11} /> VERIFIED
          </span>
        </div>

        {/* hero: the ball in shades, champion swagger */}
        <div className="mt-4 flex flex-col items-center">
          <div className="relative">
            {podium && (
              <div
                className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(34,197,94,0.3), transparent 70%)" }}
              />
            )}
            <BallMascot size={88} accessory={data.rank === 1 ? "crown" : podium ? "shades" : "none"} dropShades />
          </div>
          <Mono className="mt-3 text-xs uppercase tracking-widest text-text-muted">{data.fixture}</Mono>
          <div className="font-display text-5xl leading-none text-text">{data.score}</div>
          <Tag className="mt-1 text-text-muted">FULL TIME</Tag>
        </div>

        {/* placement strip: rank chip + points, one row, no collision */}
        <div className="mt-5 flex items-center justify-between rounded-card border-2 border-border-strong bg-surface/70 px-4 py-3">
          <div className="flex items-center gap-3">
            <motion.div
              initial={reduce ? false : { scale: 0.3, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 15, delay: 0.25 }}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border-[3px] bg-ink-950",
                data.rank === 1 ? "border-warn" : data.rank <= 3 ? "border-pitch-700" : "border-border-strong",
              )}
              style={data.rank === 1 ? { boxShadow: "0 0 24px rgba(245,165,36,0.4)" } : undefined}
            >
              <Mono className={cn("font-display text-2xl font-bold", data.rank === 1 ? "text-warn" : "text-text")}>
                {data.rank}
              </Mono>
            </motion.div>
            <div>
              <div className={cn("font-display text-[10px] tracking-widest", data.rank === 1 ? "text-warn" : "text-win")}>
                {data.rank === 1 ? "CHAMPION" : data.rank <= 3 ? "PODIUM" : "FULL TIME"}
              </div>
              <Mono className="text-xs text-text-muted">
                {data.rank} of {data.total} · {data.handle}
              </Mono>
            </div>
          </div>
          <CountUp to={data.points} className="font-display text-2xl text-win" />
        </div>

        {data.potLabel && (
          <div className="mt-3 self-center rounded-full border-2 border-warn/60 bg-warn/10 px-3 py-1 font-mono text-xs tabular text-warn">
            POT WON · {data.potLabel}
          </div>
        )}

        {/* proof footer */}
        <div className="mt-4 border-t border-dashed border-border pt-3">
          <div className="flex items-center justify-between font-mono text-[10px] tabular text-text-muted">
            <span>ANCHORED ON SOLANA</span>
            <span className="text-text-dim">{data.anchor}</span>
          </div>
          <div className="mt-1 text-center font-mono text-[10px] text-text-muted">
            signed at source by TxLINE · nobody can fake this
          </div>
        </div>
      </div>
    </div>
  );
}

// local Tag (kept internal to avoid a cross-file import cycle in the card)
function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("font-mono text-[10px] font-bold uppercase tracking-wide tabular", className)}>{children}</span>;
}

/* ── Share copy ── one caption per finish, chosen off the card data.
   Beats: flex the result, the proof angle, the invite. Under 240 chars,
   no em-dash, no emoji, no hashtags. */
function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const tail = ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${tail}`;
}

export function buildShareText(data: ShareCardData): string {
  const place = `${ordinal(data.rank)} of ${data.total}`;
  const pts = `${data.points.toLocaleString("en-US")} pts`;
  const invite = "Pull up a seat at kick.fun, the terrace is open.";
  if (data.rank === 1 && data.potLabel) {
    return `${place} in ${data.fixture}, walked off with the ${data.potLabel} pot. ${pts}, receipts signed by TxLINE and anchored on Solana. Nobody can fake this table. ${invite}`;
  }
  if (data.rank <= 3) {
    return `${place} in ${data.fixture}. ${pts}, receipts signed by TxLINE and anchored on Solana. Nobody can fake this table. ${invite}`;
  }
  return `${place} in ${data.fixture}. Mid table, still got receipts: ${pts}, signed by TxLINE and anchored on Solana. ${invite}`;
}

/* ── ShareActions ── one primary button, "Post to X". One click delivers
   caption AND card image: OS share sheet on mobile (image and text attached,
   user picks X), clipboard-plus-composer on desktop (paste to attach), or
   download-plus-composer as the last resort. A hint chip tells the user the
   one remaining step on the desktop paths. */
function XGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function pasteChord(): string {
  if (typeof navigator === "undefined") return "Ctrl+V";
  const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "") || /Mac OS X/.test(navigator.userAgent ?? "");
  return mac ? "Cmd+V" : "Ctrl+V";
}

const HINT_MS = 6000;

export function ShareActions({
  onShare,
  shareText,
  cardRef,
  className,
}: {
  onShare?: () => void;
  shareText?: string;
  /** Element to snapshot as the share image (wrap the ShareCard). Optional:
      without it the primary button falls back to the text-only X intent. */
  cardRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);
  const hintTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  const text = shareText ?? "";
  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const showHint = (msg: string) => {
    setHint(msg);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), HINT_MS);
  };
  const share = async () => {
    const el = cardRef?.current;
    if (el) {
      if (sharing) return;
      setSharing(true);
      try {
        // called with no awaits before it: shareToX needs the user gesture
        const path: SharePath = await shareToX({ el, text });
        if (path === "clipboard") showHint(`Image copied · press ${pasteChord()} in your post`);
        else if (path === "download") showHint("Image downloaded · attach it to your post");
      } catch {
        // whatever broke, the caption still ships
        openXIntent(text);
      } finally {
        setSharing(false);
      }
    } else {
      openXIntent(text);
    }
    onShare?.();
  };
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-card border-2 border-pitch-700 bg-pitch text-sm font-bold text-on-primary shadow-hard-pitch transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-press disabled:opacity-70"
        >
          {sharing ? <Loader2 size={15} className="animate-spin" /> : <XGlyph />}
          {sharing ? "Framing the card" : "Post to X"}
        </button>
        <button
        type="button"
        onClick={copy}
        aria-label="Copy result"
        className="inline-flex h-11 w-11 items-center justify-center rounded-card border-2 border-border-strong bg-surface-2 text-text shadow-hard transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-press"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="c" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
              <Check size={16} className="text-win" />
            </motion.span>
          ) : (
            <motion.span key="d" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
              <Copy size={16} className="text-text-muted" />
            </motion.span>
          )}
        </AnimatePresence>
        </button>
      </div>
      {/* one-step hint for the desktop paths, slides up under the button */}
      <AnimatePresence>
        {hint && (
          <motion.div
            key={hint}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="self-center rounded-full border border-pitch-700 bg-pitch/10 px-3 py-1"
            role="status"
          >
            <Mono className="text-[11px] text-win">{hint}</Mono>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── FullTimeScreen ── choreographed post-match reveal composition. */
export function FullTimeScreen({ data, onShare, className }: { data: ShareCardData; onShare?: () => void; className?: string }) {
  const [burst, setBurst] = React.useState(1);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
  };
  const item = {
    hidden: { y: 16, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 360, damping: 26 } },
  };
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={cn("relative mx-auto flex max-w-sm flex-col items-center gap-5", className)}
    >
      {data.rank <= 3 && <PixelBurst burstKey={burst} />}
      <motion.div variants={item} className="text-center">
        <div className="font-display text-xs tracking-[0.3em] text-pitch">MATCH SETTLED</div>
        <div className="font-display text-3xl text-text">FULL TIME</div>
      </motion.div>
      <motion.div variants={item}>
        {/* the ref wraps exactly the card so the capture is the card, nothing else */}
        <div ref={cardRef}>
          <ShareCard data={data} />
        </div>
      </motion.div>
      <motion.div variants={item} className="w-full px-2">
        <ShareActions
          cardRef={cardRef}
          onShare={() => { setBurst((b) => b + 1); onShare?.(); }}
          shareText={buildShareText(data)}
        />
      </motion.div>
    </motion.div>
  );
}
