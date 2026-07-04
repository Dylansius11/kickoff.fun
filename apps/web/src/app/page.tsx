"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/* ── primitives (preview only — will move to packages/ui) ── */

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-win">
      <span className="animate-live inline-block h-2 w-2 rounded-full bg-pitch" />
      LIVE
    </span>
  );
}

function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "pitch" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs tabular",
        tone === "pitch"
          ? "border-pitch-700 bg-pitch/10 text-win"
          : "border-border-strong bg-surface-2 text-text-dim",
      )}
    >
      {children}
    </span>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost";
function PixelButton({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-card px-4 py-2 text-sm font-bold transition-[transform,box-shadow] duration-100",
        "active:translate-x-[2px] active:translate-y-[2px]",
        variant === "primary" &&
          "border-2 border-pitch-700 bg-pitch text-on-primary shadow-hard-pitch active:shadow-press hover:brightness-110",
        variant === "secondary" &&
          "border-2 border-border-strong bg-transparent text-text shadow-hard active:shadow-press hover:border-chalk",
        variant === "ghost" && "text-text-dim hover:text-text",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <div className="mb-6">
        <div className="font-display text-xs tracking-widest text-pitch">{eyebrow}</div>
        <h2 className="font-display text-2xl text-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="overflow-hidden rounded-card border-2 border-border-strong">
      <div className="h-14" style={{ background: hex }} />
      <div className="bg-surface-2 px-2 py-1.5">
        <div className="text-xs font-medium text-text">{name}</div>
        <div className="font-mono text-[10px] uppercase tabular text-text-muted">{hex}</div>
      </div>
    </div>
  );
}

function Scoreboard({ hs, as: away }: { hs: number; as: number }) {
  return (
    <div className="flex items-center justify-between rounded-card border-2 border-border-strong bg-surface-2 px-4 py-3 shadow-hard">
      <span className="font-display text-lg text-text">BRA</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-3xl font-bold tabular text-text">{hs}</span>
        <span className="text-text-muted">–</span>
        <span className="font-mono text-3xl font-bold tabular text-text">{away}</span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-display text-lg text-text">ARG</span>
        <span className="font-mono text-xs tabular text-warn">78:04</span>
      </div>
    </div>
  );
}

type CardState = "open" | "locked" | "review" | "win" | "miss";
function PredictionCard({ state, points }: { state: CardState; points: number }) {
  const meta: Record<CardState, { badge: string; klass: string; badgeKlass: string }> = {
    open: { badge: "OPEN", klass: "border-border-strong", badgeKlass: "text-text-dim" },
    locked: { badge: "LOCKED", klass: "border-warn/60", badgeKlass: "text-warn" },
    review: { badge: "VAR — HELD", klass: "border-warn animate-var scanlines", badgeKlass: "text-warn" },
    win: { badge: "VERIFIED ✓", klass: "border-pitch shadow-glow", badgeKlass: "text-win" },
    miss: { badge: "MISSED", klass: "border-danger/60 opacity-70", badgeKlass: "text-danger" },
  };
  const m = meta[state];
  return (
    <div className={cn("rounded-card border-2 bg-surface-2 p-4 shadow-hard transition-all", m.klass)}>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm text-text">NEXT GOAL?</span>
        <span className={cn("font-mono text-[10px] font-bold tabular", m.badgeKlass)}>{m.badge}</span>
      </div>
      <div className="space-y-2">
        {[
          { name: "BRAZIL", odds: "1.85", picked: true },
          { name: "DRAW", odds: "3.20", picked: false },
        ].map((o) => (
          <div
            key={o.name}
            className={cn(
              "flex items-center justify-between rounded-card border px-3 py-2 text-sm",
              o.picked ? "border-pitch-700 bg-pitch/10" : "border-border bg-surface",
            )}
          >
            <span className="flex items-center gap-2 font-medium text-text">
              {o.picked && <span className="text-win">◉</span>}
              {o.name}
            </span>
            <span className="font-mono tabular text-text-dim">{o.odds}</span>
          </div>
        ))}
      </div>
      {(state === "win" || state === "miss") && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-text-muted">
            {state === "win" ? "Signed by TxLINE · on-chain" : "Correct: Draw"}
          </span>
          <span className={cn("font-mono text-sm font-bold tabular", state === "win" ? "text-win" : "text-text-muted")}>
            {state === "win" ? `+${points}` : "—"}
          </span>
        </div>
      )}
    </div>
  );
}

function ProofReceipt() {
  return (
    <div className="max-w-xs rounded-card border-2 border-dashed border-border-strong bg-surface px-4 py-4 font-mono text-xs tabular">
      <div className="mb-2 text-center font-display text-sm tracking-wider text-pitch">· KICK.FUN RECEIPT ·</div>
      <div className="space-y-1 text-text-dim">
        <div className="flex justify-between"><span>FIXTURE</span><span className="text-text">BRA–ARG</span></div>
        <div className="flex justify-between"><span>RESULT</span><span className="text-text">2–1 FINAL</span></div>
        <div className="flex justify-between"><span>SOURCE</span><span className="text-win">TxLINE ✓</span></div>
        <div className="flex justify-between"><span>ANCHOR</span><span className="text-text">9Exb…cKaA</span></div>
      </div>
      <div className="mt-3 border-t border-dashed border-border pt-2 text-center text-[10px] text-text-muted">
        signed at source — nobody can fake this
      </div>
    </div>
  );
}

function LeaderRow({ rank, name, pts, streak, you }: { rank: number; name: string; pts: number; streak?: number; you?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card border-2 px-3 py-2.5",
        you ? "border-pitch bg-pitch/10" : "border-border-strong bg-surface-2",
      )}
    >
      <span className="w-6 font-mono text-sm font-bold tabular text-text-muted">{rank}</span>
      <div className="h-7 w-7 rounded-full border border-border-strong bg-raised" />
      <span className="flex-1 font-medium text-text">
        {name}
        {you && <span className="ml-1 text-xs text-win">(you)</span>}
      </span>
      {streak ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-warn/50 bg-warn/10 px-2 py-0.5 font-mono text-xs tabular text-warn">
          🔥 {streak}
        </span>
      ) : null}
      <span className="w-14 text-right font-mono text-sm font-bold tabular text-text">{pts}</span>
    </div>
  );
}

/* ── the showcase ── */

export default function Page() {
  const [hs, setHs] = useState(1);
  const [carded, setCarded] = useState(false);
  const bumped = hs > 1;

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24">
      {/* top bar */}
      <header className="sticky top-0 z-10 -mx-5 flex items-center justify-between border-b border-border bg-bg/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="KICK.FUN" className="h-8 w-8" />
          <span className="font-display text-xl tracking-tight text-text">KICK.FUN</span>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="pitch">◆ 1,240</Chip>
          <Chip>#3 GLOBAL</Chip>
        </div>
      </header>

      {/* hero */}
      <section className="relative py-14">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{ background: "radial-gradient(60% 60% at 30% 20%, rgba(34,197,94,0.20), transparent 70%)" }}
        />
        <LiveDot />
        <h1 className="mt-3 font-display text-5xl leading-[0.95] text-text sm:text-6xl">
          FLOODLIT
          <br />
          ARCADE
        </h1>
        <p className="mt-4 max-w-md text-lg text-text-dim">
          The KICK.FUN design system. Watch the World Cup with your mates, predict live, and the
          results <span className="text-win">can&apos;t be faked</span>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <PixelButton>Start a terrace</PixelButton>
          <PixelButton variant="secondary">Join with code</PixelButton>
        </div>
      </section>

      <Section eyebrow="01 · COLOR" title="Floodlit palette">
        <p className="mb-4 max-w-lg text-sm text-text-muted">
          One hero accent (pitch green) on floodlit near-black. Amber &amp; red are match signals only —
          never decoration.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Swatch name="pitch-500" hex="#22c55e" />
          <Swatch name="pitch-400" hex="#38d673" />
          <Swatch name="ink-950" hex="#080b09" />
          <Swatch name="ink-800" hex="#141c17" />
          <Swatch name="warn" hex="#f5a524" />
          <Swatch name="danger" hex="#f4433b" />
        </div>
      </Section>

      <Section eyebrow="02 · TYPE" title="Three roles, never blurred">
        <div className="space-y-5">
          <div className="rounded-card border-2 border-border-strong bg-surface-2 p-4">
            <div className="mb-1 font-mono text-xs uppercase tabular text-text-muted">Display · Pixelify Sans</div>
            <div className="font-display text-3xl text-text">GOAL! 90+3&apos;</div>
          </div>
          <div className="rounded-card border-2 border-border-strong bg-surface-2 p-4">
            <div className="mb-1 font-mono text-xs uppercase tabular text-text-muted">Data · JetBrains Mono (→ Departure Mono)</div>
            <div className="font-mono text-2xl font-bold tabular text-text">2–1 · 1.85 · +50 · 9Exb…cKaA</div>
          </div>
          <div className="rounded-card border-2 border-border-strong bg-surface-2 p-4">
            <div className="mb-1 font-mono text-xs uppercase tabular text-text-muted">Body · Space Grotesk</div>
            <div className="text-base text-text">Call it before the ref does. Nobody rigs the table.</div>
          </div>
        </div>
      </Section>

      <Section eyebrow="03 · BUTTONS" title="Hard-edged, tactile">
        <div className="flex flex-wrap items-center gap-3">
          <PixelButton>Primary</PixelButton>
          <PixelButton variant="secondary">Secondary</PixelButton>
          <PixelButton variant="ghost">Ghost</PixelButton>
          <PixelButton disabled className="opacity-40">
            Disabled
          </PixelButton>
        </div>
        <p className="mt-3 text-sm text-text-muted">Press one — the shadow collapses and it sinks 2px. Arcade feel.</p>
      </Section>

      <Section eyebrow="04 · LIVE ROOM" title="The terrace (interactive)">
        <div className="space-y-4">
          <Scoreboard hs={hs} as={1} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PredictionCard state={bumped ? "win" : "open"} points={50} />
            <PredictionCard state={carded ? "review" : "locked"} points={0} />
          </div>
          <div className="flex flex-wrap gap-3">
            <PixelButton onClick={() => setHs((n) => (n === 1 ? 2 : 1))}>
              {bumped ? "Reset" : "⚽ Simulate goal"}
            </PixelButton>
            <PixelButton variant="secondary" onClick={() => setCarded((c) => !c)}>
              {carded ? "Clear VAR" : "🟥 Trigger VAR"}
            </PixelButton>
          </div>
          <p className="text-sm text-text-muted">
            Goal → card settles green + verified. VAR → amber &quot;held&quot; with a scanline until final.
          </p>
        </div>
      </Section>

      <Section eyebrow="05 · PROOF" title="A hash you can hold">
        <ProofReceipt />
      </Section>

      <Section eyebrow="06 · THE TABLE" title="Live leaderboard">
        <div className="space-y-2">
          <LeaderRow rank={1} name="pixelpelé" pts={1840} streak={5} />
          <LeaderRow rank={2} name="var_lord" pts={1620} />
          <LeaderRow rank={3} name="you" pts={1240} streak={2} you />
          <LeaderRow rank={4} name="mbappe_maxi" pts={980} />
        </div>
      </Section>

      <footer className="border-t border-border py-8 text-center font-mono text-xs tabular text-text-muted">
        KICK.FUN · Floodlit Arcade · floodlit pitch, pixel roar, receipt you can hold
      </footer>
    </main>
  );
}
