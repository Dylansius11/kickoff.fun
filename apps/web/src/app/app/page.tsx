"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check, Link2, Plus, Hash } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  LiveDot,
  MatchCard,
  Mono,
  Skeleton,
  Tag,
  sound,
} from "@kick/ui";
import { MY_TERRACES, YOU } from "./mock";
import { useFixtures } from "../../lib/use-fixtures";
import type { FixtureRow } from "../../lib/supabase";
import { useKickUser } from "../../lib/auth";
import { teamCode } from "../../lib/team-code";
import { formatKickoff, kickoffCompact } from "../../lib/format-kickoff";
import { inviteUrl, markJoined } from "../../lib/invite";
import { rememberUserId } from "../../lib/identity";
import { snapshotScore, useHistoryIdentity, usePlayedFixtureIds } from "../../lib/use-history";
import { CreateTerraceSheet } from "./create-terrace";

function kickoffLabel(f: FixtureRow): string {
  if (f.status === "live") return "LIVE";
  if (f.status === "final") return "FT";
  return kickoffCompact(f.kickoff_at);
}

/* ── FullTimeCard ── compact result tile for the horizontal FT strip */
function FullTimeCard({
  fixture,
  played,
  onClick,
}: {
  fixture: FixtureRow;
  played: boolean;
  onClick: () => void;
}) {
  const score = snapshotScore(fixture);
  return (
    <Card
      interactive
      onClick={onClick}
      className="flex w-[150px] shrink-0 snap-start flex-col gap-1.5 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-sm text-text">
          {teamCode(fixture.home_team)}
          <span className="mx-1 text-text-muted">v</span>
          {teamCode(fixture.away_team)}
        </span>
      </div>
      {score ? (
        <Mono className="text-2xl font-bold text-text">
          {score.home}–{score.away}
        </Mono>
      ) : (
        <Mono className="text-2xl font-bold text-text-muted">FT</Mono>
      )}
      <div className="flex items-center justify-between gap-1">
        <Mono className="text-[10px] text-text-muted">{formatKickoff(fixture.kickoff_at).day}</Mono>
        {played && (
          <Chip tone="pitch" className="px-1.5 py-0 text-[9px] font-bold tracking-wide">
            YOU PLAYED
          </Chip>
        )}
      </div>
    </Card>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const item = {
  hidden: { y: 14, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 360, damping: 28 } },
};

export default function LobbyPage() {
  const router = useRouter();
  const [joining, setJoining] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [joinBusy, setJoinBusy] = React.useState(false);
  const [joinError, setJoinError] = React.useState(false);
  const [shakes, setShakes] = React.useState(0);
  const { fixtures, loading, live } = useFixtures();
  const { handle, address } = useKickUser();
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const { userId } = useHistoryIdentity();
  const playedFixtureIds = usePlayedFixtureIds(userId);

  // live + upcoming stay in the fixtures list; finished matches move to the FT strip
  const tonight = React.useMemo(() => fixtures.filter((f) => f.status !== "final"), [fixtures]);
  const finished = React.useMemo(
    () =>
      fixtures
        .filter((f) => f.status === "final" && f.id > 0) // mock rows have no post-mortem to open
        .sort((a, b) => Date.parse(b.kickoff_at) - Date.parse(a.kickoff_at)),
    [fixtures],
  );

  const copyInvite = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    sound.play("tap");
    navigator.clipboard?.writeText(inviteUrl(code)).catch(() => {});
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500);
  };

  const join = async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 3 || joinBusy) return;
    setJoinBusy(true);
    setJoinError(false);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(c)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle ?? undefined, wallet: address ?? undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const info = (await res.json().catch(() => null)) as { userId?: string } | null;
      rememberUserId(info?.userId);
      markJoined(c);
      sound.play("kickoff");
      router.push(`/app/terrace/${c}`);
    } catch {
      setJoinError(true);
      setShakes((s) => s + 1);
      sound.play("miss");
      setJoinBusy(false);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6 px-4 pb-8 pt-5"
    >
      {/* greeting */}
      <motion.div variants={item}>
        <div className="font-display text-xs tracking-widest text-pitch">MATCHDAY 12</div>
        <h1 className="font-display text-3xl leading-tight text-text">
          Evening, {YOU}.
        </h1>
        <p className="mt-1 text-sm text-text-dim">
          Two knockouts tonight. Call it before the ref does.
        </p>
      </motion.div>

      {/* my terraces: horizontal strip */}
      <motion.section variants={item}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display text-sm text-text">MY TERRACES</span>
          <Mono className="text-xs text-text-muted">{MY_TERRACES.length}</Mono>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {MY_TERRACES.map((t) => (
            <Card
              key={t.code}
              interactive
              onClick={() => router.push(`/app/terrace/${t.code}`)}
              className={
                "w-[210px] shrink-0 snap-start p-3 " + (t.live ? "border-pitch-700" : "")
              }
            >
              <div className="flex items-center justify-between">
                <Mono className="text-xs font-bold tracking-widest text-text-dim">{t.code}</Mono>
                <div className="flex items-center gap-1.5">
                  {t.live ? <LiveDot /> : <Tag className="text-text-muted">{t.fixture}</Tag>}
                  <button
                    type="button"
                    onClick={(e) => copyInvite(e, t.code)}
                    aria-label={`Copy invite link for ${t.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-card border border-border-strong text-text-muted transition-colors hover:border-chalk hover:text-text"
                  >
                    {copiedCode === t.code ? (
                      <Check size={12} className="text-win" />
                    ) : (
                      <Link2 size={12} />
                    )}
                  </button>
                </div>
              </div>
              <div className="mt-2 truncate text-sm font-bold text-text">{t.name}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {t.members.slice(0, 4).map((m) => (
                    <Avatar key={m} name={m} size={22} className="ring-2 ring-surface-2" />
                  ))}
                </div>
                <Mono className="text-[10px] text-text-muted">{t.members.length} in</Mono>
              </div>
            </Card>
          ))}
        </div>
      </motion.section>

      {/* today's fixtures, live first */}
      <motion.section variants={item} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-sm text-text">TONIGHT&apos;S FIXTURES</span>
          <Tag className="text-text-muted">ROUND OF 16</Tag>
        </div>
        {!loading && (
          <div className="flex items-center gap-1.5">
            {live ? (
              <>
                <LiveDot />
                <Mono className="text-[10px] tracking-widest text-text-dim">TXLINE FEED</Mono>
              </>
            ) : (
              <Tag className="text-text-muted">DEMO DATA</Tag>
            )}
          </div>
        )}
        {loading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[52px] w-full" />)
          : tonight.map((f) => (
              <MatchCard
                key={f.id}
                home={teamCode(f.home_team)}
                away={teamCode(f.away_team)}
                kickoff={kickoffLabel(f)}
                status={f.status}
                onClick={() => router.push("/app/terrace/QPR7")}
              />
            ))}
      </motion.section>

      {/* full time: finished matches move off the main list into a compact strip */}
      {!loading && finished.length > 0 && (
        <motion.section variants={item}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-display text-sm text-text">FULL TIME</span>
            <Mono className="text-xs text-text-muted">{finished.length}</Mono>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {finished.map((f) => (
              <FullTimeCard
                key={f.id}
                fixture={f}
                played={playedFixtureIds.has(f.id)}
                onClick={() => {
                  sound.play("tap");
                  router.push(`/app/match/${f.id}`);
                }}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* the one primary action */}
      <motion.section variants={item} className="mt-auto flex flex-col gap-2">
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            sound.play("tap");
            setCreating(true);
          }}
        >
          <Plus size={18} /> Start a terrace
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setJoining((v) => !v)}
          aria-expanded={joining}
        >
          <Hash size={16} /> Join with code
        </Button>

        <AnimatePresence initial={false}>
          {joining && (
            <motion.div
              key="join"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-1">
                <motion.div
                  key={shakes}
                  className="flex-1"
                  animate={shakes > 0 ? { x: [0, -8, 8, -6, 6, -3, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <Input
                    autoFocus
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setJoinError(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && join()}
                    placeholder="BRA-7K2"
                    maxLength={8}
                    className={
                      "font-mono tabular uppercase tracking-[0.3em] " +
                      (joinError ? "border-danger focus:border-danger" : "")
                    }
                    aria-label="Terrace code"
                    aria-invalid={joinError}
                  />
                </motion.div>
                <Button
                  onClick={join}
                  loading={joinBusy}
                  disabled={code.trim().length < 3}
                  aria-label="Join terrace"
                >
                  <ArrowRight size={16} />
                </Button>
              </div>
              <p className={"mt-1.5 text-xs " + (joinError ? "text-danger" : "text-text-muted")}>
                {joinError
                  ? "No terrace answers to that code. Check it with your mate."
                  : "Ask a mate for their code. The terrace is better full."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <CreateTerraceSheet
        open={creating}
        onClose={() => setCreating(false)}
        fixtures={fixtures}
        loading={loading}
      />
    </motion.div>
  );
}
