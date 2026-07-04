"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Plus, Hash } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Input,
  LiveDot,
  MatchCard,
  Mono,
  Tag,
  sound,
} from "@kick/ui";
import { FIXTURES, MY_TERRACES, YOU } from "./mock";

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

  const liveFirst = [...FIXTURES].sort(
    (a, b) => Number(b.status === "live") - Number(a.status === "live"),
  );

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length >= 3) router.push(`/app/terrace/${c}`);
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
                {t.live ? <LiveDot /> : <Tag className="text-text-muted">{t.fixture}</Tag>}
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
        {liveFirst.map((f) => (
          <MatchCard
            key={`${f.home}-${f.away}`}
            home={f.home}
            away={f.away}
            kickoff={f.kickoff}
            status={f.status}
            onClick={() => router.push("/app/terrace/QPR7")}
          />
        ))}
      </motion.section>

      {/* the one primary action */}
      <motion.section variants={item} className="mt-auto flex flex-col gap-2">
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            sound.play("kickoff");
            router.push("/app/terrace/QPR7");
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
                <Input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && join()}
                  placeholder="QPR7"
                  maxLength={6}
                  className="font-mono tabular uppercase tracking-[0.3em]"
                  aria-label="Terrace code"
                />
                <Button onClick={join} disabled={code.trim().length < 3} aria-label="Join terrace">
                  <ArrowRight size={16} />
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-text-muted">
                Ask a mate for their 4-letter code. The terrace is better full.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
