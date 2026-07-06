"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Lock, Check, Wallet, LogOut, LogIn, ChevronRight } from "lucide-react";
import { Avatar, Card, CountUp, Mono, Skeleton, StreakFlame, Tag, Button } from "@kick/ui";
import { COSMETICS, YOU, type Cosmetic } from "../mock";
import { useKickUser, shortAddress } from "@/lib/auth";
import { teamCode } from "@/lib/team-code";
import { formatKickoff } from "@/lib/format-kickoff";
import { useHistoryIdentity, useMatchHistory, type HistoryEntry } from "@/lib/use-history";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const item = {
  hidden: { y: 14, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 360, damping: 28 } },
};

/* deterministic 5x5 pixel-art swatch per cosmetic name: chunky, arcade, no assets */
const PIX = ["var(--pitch-500)", "var(--pitch-700)", "var(--chalk)", "var(--ink-700)", "var(--warn)"];
function pixelsFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return Array.from({ length: 25 }, (_, i) => {
    const v = (h ^ (i * 2654435761)) >>> 0;
    return v % 3 === 0 ? PIX[v % PIX.length] : "transparent";
  });
}

function CosmeticCard({ c }: { c: Cosmetic }) {
  const px = pixelsFor(c.name);
  return (
    <Card
      className={
        "flex flex-col gap-2 p-3 " +
        (c.unlocked ? "border-pitch-700" : "opacity-60")
      }
    >
      <div
        className="grid aspect-square w-full grid-cols-5 grid-rows-5 rounded-[2px] bg-surface p-1.5"
        aria-hidden
      >
        {px.map((color, i) => (
          <span key={i} style={{ background: color }} />
        ))}
      </div>
      <div className="min-h-8 text-xs font-bold leading-tight text-text">{c.name}</div>
      <div className="flex items-center justify-between">
        <Tag className="text-text-muted">{c.kind}</Tag>
        {c.unlocked ? (
          <span className="inline-flex items-center gap-1 text-xs text-win">
            <Check size={12} /> owned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-text-dim">
            <Lock size={11} />
            <Mono className="text-xs">{c.cost.toLocaleString("en-US")}</Mono>
          </span>
        )}
      </div>
    </Card>
  );
}

/* ── MatchHistoryRow ── one played fixture: teams, date, calls, net points */
function MatchHistoryRow({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  const won = entry.points > 0;
  return (
    <Card interactive onClick={onClick} className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm text-text">
            {teamCode(entry.home)}
            <span className="mx-1 text-text-muted">v</span>
            {teamCode(entry.away)}
          </span>
          {entry.allCorrect && <StreakFlame count={entry.correct} />}
        </div>
        <div className="mt-0.5 text-xs text-text-dim">
          {entry.correct} of {entry.total} calls · {formatKickoff(entry.kickoffAt).day}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Mono className={"text-sm font-bold " + (won ? "text-win" : "text-text-muted")}>
          {won ? `+${entry.points}` : "0"}
        </Mono>
        <ChevronRight size={14} className="text-text-muted" />
      </div>
    </Card>
  );
}

function MatchHistorySection() {
  const router = useRouter();
  const { login } = useKickUser();
  const { userId, resolved, guest } = useHistoryIdentity();
  const { entries, loading } = useMatchHistory(userId, resolved);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-sm text-text">MATCH HISTORY</span>
        {entries.length > 0 && <Mono className="text-xs text-text-muted">{entries.length}</Mono>}
      </div>
      {!resolved || loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[62px] w-full" />
          <Skeleton className="h-[62px] w-full" />
        </div>
      ) : entries.length > 0 ? (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <MatchHistoryRow
              key={e.fixtureId}
              entry={e}
              onClick={() => router.push(`/app/match/${e.fixtureId}`)}
            />
          ))}
        </div>
      ) : guest && !userId ? (
        <Card className="px-4 py-5 text-center">
          <p className="text-sm text-text-dim">
            Your calls live in this browser. Sign in to make them permanent.
          </p>
          <Button size="sm" className="mt-3" onClick={login}>
            <LogIn size={13} /> Sign in
          </Button>
        </Card>
      ) : (
        <Card className="px-4 py-5 text-center text-sm text-text-dim">
          No matches on the record yet. Call one tonight.
        </Card>
      )}
    </div>
  );
}

export default function LockerPage() {
  const { ready, authenticated, handle, address, login, logout } = useKickUser();
  const name = authenticated && handle ? handle : YOU;
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 px-4 pb-8 pt-5"
    >
      {/* profile header */}
      <motion.div variants={item} className="flex items-center gap-4">
        <Avatar name={name} size={64} className="border-2 border-pitch-700 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-2xl leading-tight text-text">{name}</h1>
            <StreakFlame count={4} />
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <CountUp to={11205} className="text-xl font-bold text-win" />
            <span className="font-display text-[10px] text-text-muted">GLORY</span>
          </div>
        </div>
        <div className="text-right">
          <Mono className="block text-lg font-bold text-text">#3</Mono>
          <Tag className="text-text-muted">GLOBAL</Tag>
        </div>
      </motion.div>

      {/* wallet identity: Privy embedded Solana wallet, the on-chain you */}
      <motion.div variants={item}>
        <Card className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-card border-2 " +
                (authenticated ? "border-pitch-700 bg-pitch/10 text-win" : "border-border-strong bg-surface text-text-muted")
              }
            >
              <Wallet size={16} />
            </span>
            <div className="min-w-0">
              <Tag className="text-text-muted">SOLANA WALLET</Tag>
              {authenticated && address ? (
                <Mono className="block truncate text-sm text-text">{shortAddress(address)}</Mono>
              ) : (
                <div className="text-sm text-text-dim">Sign in, wallet appears. No seed phrase.</div>
              )}
            </div>
          </div>
          {ready &&
            (authenticated ? (
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-card border-2 border-border-strong text-text-muted transition-colors hover:border-danger/60 hover:text-danger"
              >
                <LogOut size={15} />
              </button>
            ) : (
              <Button size="sm" onClick={login}>
                <LogIn size={13} /> Sign in
              </Button>
            ))}
        </Card>
      </motion.div>

      {/* form strip */}
      <motion.div variants={item}>
        <Card className="flex items-center justify-between px-4 py-3">
          <div>
            <Tag className="text-text-muted">FORM</Tag>
            <div className="mt-0.5 text-sm font-medium text-text">4 correct calls running</div>
          </div>
          <div className="flex gap-1" aria-label="Last five calls: hit, hit, miss, hit, hit">
            {["w", "w", "l", "w", "w"].map((r, i) => (
              <span
                key={i}
                className={
                  "flex h-6 w-6 items-center justify-center rounded-[2px] border font-mono text-[10px] font-bold tabular " +
                  (r === "w"
                    ? "border-pitch-700 bg-pitch/15 text-win"
                    : "border-danger/50 bg-danger/10 text-danger")
                }
              >
                {r === "w" ? "+" : "x"}
              </span>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* match history: the record of every fixture this player called */}
      <motion.div variants={item}>
        <MatchHistorySection />
      </motion.div>

      {/* cosmetics */}
      <motion.div variants={item}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display text-sm text-text">COSMETICS</span>
          <Mono className="text-xs text-text-muted">
            {COSMETICS.filter((c) => c.unlocked).length}/{COSMETICS.length} owned
          </Mono>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {COSMETICS.map((c) => (
            <CosmeticCard key={c.name} c={c} />
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-text-muted">
          Points buy flair, never cash. Glory is the currency here.
        </p>
      </motion.div>
    </motion.div>
  );
}
