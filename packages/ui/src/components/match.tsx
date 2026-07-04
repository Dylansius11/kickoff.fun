"use client";

import * as React from "react";
import { ShieldCheck, Radio } from "lucide-react";
import { cn } from "../lib/utils";
import { Card, Mono, LiveDot, Tag } from "./primitives";

/* ── TeamCode ── 3-letter pixel team badge */
export function TeamCode({ code, className }: { code: string; className?: string }) {
  return <span className={cn("font-display text-lg text-text", className)}>{code}</span>;
}

/* ── Scoreboard ── the dense live match header */
export function Scoreboard({
  home,
  away,
  homeScore,
  awayScore,
  clock,
  live = true,
  className,
}: {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  clock: string;
  live?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("flex items-center justify-between px-4 py-3", className)}>
      <TeamCode code={home} />
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-3">
          <Mono className="text-3xl font-bold text-text">{homeScore}</Mono>
          <span className="text-text-muted">:</span>
          <Mono className="text-3xl font-bold text-text">{awayScore}</Mono>
        </div>
        {live ? (
          <Mono className="text-xs text-warn">{clock}</Mono>
        ) : (
          <Tag className="text-text-muted">FULL TIME</Tag>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <TeamCode code={away} />
        {live && <LiveDot />}
      </div>
    </Card>
  );
}

/* ── CountdownBar ── draining lock timer (amber near the end) */
export function CountdownBar({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const near = p < 0.25;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface">
      <div
        className={cn("h-full transition-[width] duration-500 ease-linear", near ? "bg-warn" : "bg-pitch")}
        style={{ width: `${p * 100}%` }}
      />
    </div>
  );
}

/* ── PredictionOption ── one tappable choice */
export function PredictionOption({
  name,
  odds,
  picked,
  disabled,
  onSelect,
}: {
  name: string;
  odds: string;
  picked?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-card border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed",
        picked ? "border-pitch-700 bg-pitch/10" : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span className="flex items-center gap-2 font-medium text-text">
        {picked && <span className="text-win">&#9673;</span>}
        {name}
      </span>
      <Mono className="text-text-dim">{odds}</Mono>
    </button>
  );
}

export type PredictionState = "open" | "locked" | "review" | "win" | "miss";

/* ── PredictionCard ── the star component, all 5 states */
export function PredictionCard({
  prompt,
  options,
  state,
  points = 0,
  correctAnswer,
  progress,
  onSelect,
}: {
  prompt: string;
  options: { name: string; odds: string; picked?: boolean }[];
  state: PredictionState;
  points?: number;
  correctAnswer?: string;
  progress?: number;
  onSelect?: (name: string) => void;
}) {
  const meta: Record<PredictionState, { badge: string; ring: string; badgeTone: string }> = {
    open: { badge: "OPEN", ring: "border-border-strong", badgeTone: "text-text-dim" },
    locked: { badge: "LOCKED", ring: "border-warn/60", badgeTone: "text-warn" },
    review: { badge: "VAR · HELD", ring: "border-warn animate-var scanlines", badgeTone: "text-warn" },
    win: { badge: "VERIFIED", ring: "border-pitch shadow-glow", badgeTone: "text-win" },
    miss: { badge: "MISSED", ring: "border-danger/60 opacity-75", badgeTone: "text-danger" },
  };
  const m = meta[state];
  const settled = state === "win" || state === "miss";

  return (
    <Card className={cn("border-2 p-4 transition-all", m.ring)}>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm text-text">{prompt}</span>
        <Tag className={m.badgeTone}>{m.badge}</Tag>
      </div>

      <div className="space-y-2">
        {options.map((o) => (
          <PredictionOption
            key={o.name}
            name={o.name}
            odds={o.odds}
            picked={o.picked}
            disabled={state !== "open"}
            onSelect={() => onSelect?.(o.name)}
          />
        ))}
      </div>

      {state === "open" && typeof progress === "number" && (
        <div className="mt-3">
          <CountdownBar progress={progress} />
        </div>
      )}

      {settled && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            {state === "win" ? (
              <>
                <ShieldCheck size={13} className="text-win" /> Signed by TxLINE, on-chain
              </>
            ) : (
              <>Correct: {correctAnswer ?? "n/a"}</>
            )}
          </span>
          <Mono className={cn("text-sm font-bold", state === "win" ? "text-win" : "text-text-muted")}>
            {state === "win" ? `+${points}` : "0"}
          </Mono>
        </div>
      )}
    </Card>
  );
}

/* ── ProofReceipt ── the crypto WOW as a ticket stub */
export function ProofReceipt({
  fixture,
  result,
  anchor,
  className,
}: {
  fixture: string;
  result: string;
  anchor: string;
  className?: string;
}) {
  const rows: [string, React.ReactNode][] = [
    ["FIXTURE", <span className="text-text" key="f">{fixture}</span>],
    ["RESULT", <span className="text-text" key="r">{result}</span>],
    ["SOURCE", <span className="text-win" key="s">TxLINE verified</span>],
    ["ANCHOR", <span className="text-text" key="a">{anchor}</span>],
  ];
  return (
    <div
      className={cn(
        "max-w-xs rounded-card border-2 border-dashed border-border-strong bg-surface px-4 py-4 font-mono text-xs tabular",
        className,
      )}
    >
      <div className="mb-2 text-center font-display text-sm tracking-wider text-pitch">
        KICK.FUN RECEIPT
      </div>
      <div className="space-y-1 text-text-dim">
        {rows.map(([k, v]) => (
          <div className="flex justify-between" key={k}>
            <span>{k}</span>
            {v}
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-dashed border-border pt-2 text-center text-[10px] text-text-muted">
        signed at source, nobody can fake this
      </div>
    </div>
  );
}

/* ── PotBanner ── sponsor pot state */
export function PotBanner({
  sponsor,
  amount,
  status,
}: {
  sponsor: string;
  amount: string;
  status: "funded" | "settled" | "claimed";
}) {
  const label = { funded: "leader claims at full time", settled: "ready to claim", claimed: "claimed" }[status];
  return (
    <Card className="flex items-center justify-between border-pitch-700 bg-pitch/5 px-4 py-3">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Radio size={12} className="text-win" /> POT by {sponsor}
        </div>
        <Mono className="text-xl font-bold text-win">{amount}</Mono>
      </div>
      <Tag className="text-text-dim">{label}</Tag>
    </Card>
  );
}

/* ── MatchCard ── lobby fixture */
export function MatchCard({
  home,
  away,
  kickoff,
  status,
  onClick,
}: {
  home: string;
  away: string;
  kickoff: string;
  status: "upcoming" | "live" | "final";
  onClick?: () => void;
}) {
  return (
    <Card interactive onClick={onClick} className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <TeamCode code={home} className="text-base" />
        <span className="text-text-muted">v</span>
        <TeamCode code={away} className="text-base" />
      </div>
      {status === "live" ? (
        <LiveDot />
      ) : status === "final" ? (
        <Tag className="text-text-muted">FT</Tag>
      ) : (
        <Mono className="text-xs text-text-dim">{kickoff}</Mono>
      )}
    </Card>
  );
}
