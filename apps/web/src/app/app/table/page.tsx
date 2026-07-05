"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Trophy } from "lucide-react";
import { Avatar, Card, CountUp, LeaderboardTable, Mono, StatTile, StreakFlame, Tag } from "@kick/ui";
import { GLOBAL_BOARD } from "../mock";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const item = {
  hidden: { y: 14, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 360, damping: 28 } },
};

const PODIUM_STYLE: Record<number, { ring: string; text: string }> = {
  1: { ring: "border-warn", text: "text-warn" },
  2: { ring: "border-border-strong", text: "text-text" },
  3: { ring: "border-pitch-700", text: "text-win" },
};

export default function TablePage() {
  const podium = GLOBAL_BOARD.slice(0, 3);
  const you = GLOBAL_BOARD.find((r) => r.you)!;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 px-4 pb-8 pt-5"
    >
      <motion.div variants={item}>
        <div className="font-display text-xs tracking-widest text-pitch">TOURNAMENT</div>
        <h1 className="font-display text-3xl leading-tight text-text">THE TABLE</h1>
        <p className="mt-1 text-sm text-text-dim">104 matches. Nobody rigs this one.</p>
      </motion.div>

      {/* your numbers */}
      <motion.div variants={item} className="grid grid-cols-2 gap-2">
        <StatTile label="Your points" value={you.points.toLocaleString("en-US")} delta={{ dir: "up", value: "260" }} />
        <StatTile label="Global rank" value={`#${you.rank}`} delta={{ dir: "up", value: "2" }} />
        <StatTile label="Best streak" value="9" />
        <StatTile label="Terraces" value="3" />
      </motion.div>

      {/* podium */}
      <motion.div variants={item}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display text-sm text-text">THE PODIUM</span>
          <Tag className="text-text-muted">MATCHDAY 12</Tag>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {podium.map((p) => {
            const s = PODIUM_STYLE[p.rank];
            return (
              <Card
                key={p.name}
                className={`flex flex-col items-center gap-1.5 px-2 py-4 ${s.ring} ${
                  p.rank === 1 ? "shadow-glow" : ""
                }`}
              >
                {p.rank === 1 ? (
                  <Trophy size={16} className="text-warn" />
                ) : (
                  <Mono className={`text-sm font-bold ${s.text}`}>{p.rank}</Mono>
                )}
                <Avatar name={p.name} size={40} />
                <span className="w-full truncate text-center text-xs font-medium text-text">
                  {p.name}
                  {p.you && <span className="ml-1 text-win">you</span>}
                </span>
                <CountUp to={p.points} className={`text-sm font-bold ${s.text}`} />
                {p.streak ? <StreakFlame count={p.streak} /> : null}
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* full table */}
      <motion.div variants={item}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display text-sm text-text">TOP 12</span>
          <Tag className="text-win">PROVABLY FAIR</Tag>
        </div>
        <LeaderboardTable rows={GLOBAL_BOARD} />
        <p className="mt-3 text-center text-xs text-text-muted">
          Every point settled off signed TxLINE data, anchored on Solana.
        </p>
      </motion.div>

      {/* roadmap tease: the season */}
      <motion.div variants={item}>
        <Link href="/app/season" className="block">
          <Card interactive className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="font-display text-sm text-text">THE SEASON</span>
              <Tag className="text-warn">coming after the Cup</Tag>
            </div>
            <ArrowRight size={14} className="text-text-muted" />
          </Card>
        </Link>
      </motion.div>
    </motion.div>
  );
}
