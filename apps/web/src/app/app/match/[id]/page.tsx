"use client";

/* Match post-mortem: the full-time scoreboard, how every prop settled,
   and (when this browser played) the user's own calls with points earned.
   Deliberately calmer than the live terrace: the whistle has gone. */

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, ShieldCheck, Ban } from "lucide-react";
import { Card, Chip, CountUp, Mono, Scoreboard, Skeleton, Tag } from "@kick/ui";
import { teamCode } from "@/lib/team-code";
import { kickoffCompact } from "@/lib/format-kickoff";
import {
  snapshotScore,
  useHistoryIdentity,
  useMatchDetail,
  type PickRow,
  type PropRow,
} from "@/lib/use-history";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const item = {
  hidden: { y: 14, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 360, damping: 28 } },
};

function optionLabel(p: PropRow, optionId: string | undefined): string {
  if (!optionId) return "n/a";
  return p.options.find((o) => o.id === optionId)?.label ?? optionId;
}

/** Props duplicate across rooms of the same fixture; collapse to one line each. */
function dedupeProps(props: PropRow[]): PropRow[] {
  const seen = new Set<string>();
  const out: PropRow[] = [];
  for (const p of props) {
    const key = `${p.prompt}|${p.state}|${p.resolution?.winning_option_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function SettledPropRow({ p }: { p: PropRow }) {
  const voided = p.state === "voided";
  const winner = optionLabel(p, p.resolution?.winning_option_id);
  return (
    <Card className={"flex items-center justify-between gap-3 px-4 py-3 " + (voided ? "opacity-50" : "")}>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-text">{p.prompt}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-dim">
          {voided ? (
            <>
              <Ban size={12} className="text-text-muted" /> No result. Nobody scored, nobody lost.
            </>
          ) : (
            <>
              <ShieldCheck size={12} className="text-win" /> {winner}
            </>
          )}
        </div>
      </div>
      <Tag className={voided ? "text-text-muted" : "text-win"}>{voided ? "VOIDED" : "SETTLED"}</Tag>
    </Card>
  );
}

function CallRow({ pick, prop }: { pick: PickRow; prop: PropRow }) {
  const hit = pick.is_correct === true;
  const voided = pick.settle_state === "voided";
  const yours = optionLabel(prop, pick.choice);
  const winner = optionLabel(prop, prop.resolution?.winning_option_id);
  return (
    <Card
      className={
        "flex items-center justify-between gap-3 px-4 py-3 " +
        (hit ? "border-pitch-700" : "opacity-60")
      }
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-text">{prop.prompt}</div>
        <div className="mt-0.5 text-xs text-text-dim">
          You: {yours}
          {!voided && !hit && <span className="text-text-muted"> · Winner: {winner}</span>}
          {voided && <span className="text-text-muted"> · voided</span>}
        </div>
      </div>
      <Mono className={"shrink-0 text-sm font-bold " + (hit ? "text-win" : "text-text-muted")}>
        {hit ? `+${pick.points_awarded}` : "0"}
      </Mono>
    </Card>
  );
}

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const fixtureId = Number(params.id);
  const { userId } = useHistoryIdentity();
  const { fixture, props, picks, loading } = useMatchDetail(fixtureId, userId);

  const settled = React.useMemo(() => dedupeProps(props), [props]);
  const propById = React.useMemo(() => new Map(props.map((p) => [p.id, p])), [props]);
  const calls = React.useMemo(
    () => picks.filter((k) => propById.has(k.prop_id)),
    [picks, propById],
  );
  const earned = calls.reduce((sum, k) => sum + (k.is_correct ? k.points_awarded : 0), 0);
  const score = fixture ? snapshotScore(fixture) : null;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-8 pt-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-[84px] w-full" />
        <Skeleton className="h-[64px] w-full" />
        <Skeleton className="h-[64px] w-full" />
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="flex flex-col items-start gap-4 px-4 pb-8 pt-5">
        <BackButton onClick={() => router.push("/app")} />
        <Card className="w-full px-4 py-6 text-center">
          <div className="font-display text-lg text-text">Lost in the tunnel.</div>
          <p className="mt-1 text-sm text-text-dim">This match never reached the wire.</p>
        </Card>
      </div>
    );
  }

  const home = teamCode(fixture.home_team);
  const away = teamCode(fixture.away_team);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 px-4 pb-8 pt-5"
    >
      {/* header: back + eyebrow */}
      <motion.div variants={item} className="flex items-center justify-between">
        <BackButton onClick={() => router.back()} />
        {fixture.group_round && <Tag className="text-text-muted">{fixture.group_round.toUpperCase()}</Tag>}
      </motion.div>

      {/* the final word */}
      <motion.div variants={item}>
        {score ? (
          <Scoreboard home={home} away={away} homeScore={score.home} awayScore={score.away} clock="" live={false} />
        ) : (
          <Card className="flex items-center justify-between px-4 py-3">
            <span className="font-display text-lg text-text">{home}</span>
            <div className="flex flex-col items-center gap-0.5">
              <Mono className="text-xl font-bold text-text-muted">· v ·</Mono>
              <Tag className="text-text-muted">FULL TIME</Tag>
            </div>
            <span className="font-display text-lg text-text">{away}</span>
          </Card>
        )}
        <div className="mt-1.5 text-center">
          <Mono className="text-xs text-text-muted">{kickoffCompact(fixture.kickoff_at)}</Mono>
        </div>
      </motion.div>

      {/* how it settled */}
      <motion.section variants={item} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-sm text-text">HOW IT SETTLED</span>
          <Mono className="text-xs text-text-muted">{settled.length}</Mono>
        </div>
        {settled.length === 0 ? (
          <Card className="px-4 py-5 text-center text-sm text-text-dim">
            Nothing settled here. The Oracle kept quiet.
          </Card>
        ) : (
          settled.map((p) => <SettledPropRow key={p.id} p={p} />)
        )}
      </motion.section>

      {/* your calls */}
      <motion.section variants={item} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-sm text-text">YOUR CALLS</span>
          {calls.length > 0 && (
            <Chip tone={earned > 0 ? "pitch" : "default"} className="gap-1">
              <CountUp to={earned} prefix="+" className="font-bold" />
              <span className="text-[10px]">PTS</span>
            </Chip>
          )}
        </div>
        {calls.length === 0 ? (
          <Card className="px-4 py-5 text-center text-sm text-text-dim">
            No calls made. The terrace waits.
          </Card>
        ) : (
          calls.map((k) => <CallRow key={k.prop_id} pick={k} prop={propById.get(k.prop_id)!} />)
        )}
      </motion.section>
    </motion.div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="inline-flex items-center gap-1.5 rounded-card border border-border-strong px-2.5 py-1.5 font-display text-xs text-text-dim transition-colors hover:border-chalk hover:text-text"
    >
      <ArrowLeft size={14} /> BACK
    </button>
  );
}
