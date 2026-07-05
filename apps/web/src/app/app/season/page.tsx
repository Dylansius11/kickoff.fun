"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUp, ArrowRight, Check, Lock, CalendarRange } from "lucide-react";
import { Avatar, Button, Card, Mono, PixelBurst, Tag, sound } from "@kick/ui";
import { MY_TERRACES } from "../mock";

/* ── choreography: same spring language as the lobby ── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { y: 14, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
};

/* ── PixelTrophy ── the season silverware, drawn pixel by pixel. No asset, no emoji. */
const TROPHY_ROWS = [
  "..XXXXXXX..",
  "X.XXXXXXX.X",
  "X.XXhXXXX.X",
  "X.XXXXXXX.X",
  ".X.XXXXX.X.",
  "...XXXXX...",
  "....XXX....",
  ".....X.....",
  ".....X.....",
  "...XXXXX...",
  "..XXXXXXX..",
];
function PixelTrophy({ cell = 6 }: { cell?: number }) {
  return (
    <div
      aria-hidden
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${TROPHY_ROWS[0].length}, ${cell}px)`,
        filter: "drop-shadow(0 0 14px rgba(245,165,36,0.45))",
      }}
    >
      {TROPHY_ROWS.flatMap((row, y) =>
        row.split("").map((c, x) => (
          <span
            key={`${x}-${y}`}
            style={{
              width: cell,
              height: cell,
              background:
                c === "X" ? "var(--warn)" : c === "h" ? "var(--chalk)" : "transparent",
            }}
          />
        )),
      )}
    </div>
  );
}

/* ── division ladder data (mock, roadmap tease only) ── */
const HOME = MY_TERRACES[0]; // North Stand Lads
const DIVISIONS = [
  {
    n: 1,
    name: "DIVISION 1",
    blurb: "The invincibles. 20 terraces, one relegation trapdoor.",
    slot: "locked",
  },
  {
    n: 2,
    name: "DIVISION 2",
    blurb: "Your terrace starts here. Win the month, go up.",
    slot: "you",
  },
  {
    n: 3,
    name: "DIVISION 3",
    blurb: "Everyone else. Climb out or stay in the mud.",
    slot: "open",
  },
] as const;

const TIMELINE = [
  { label: "WC 2026", when: "JUN · JUL", now: true },
  { label: "EPL", when: "AUG 2026", now: false },
  { label: "LALIGA", when: "AUG 2026", now: false },
  { label: "UCL", when: "SEP 2026", now: false },
  { label: "AFCON", when: "DEC 2026", now: false },
];

export default function SeasonPage() {
  const reduce = useReducedMotion();
  const [reserved, setReserved] = React.useState(false);
  const [burst, setBurst] = React.useState(0);

  // ladder rows slide in from alternating sides; plain fade if reduced motion
  const ladderItem = (i: number) =>
    reduce
      ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
      : {
          hidden: { x: i % 2 === 0 ? -28 : 28, opacity: 0 },
          show: {
            x: 0,
            opacity: 1,
            transition: { type: "spring" as const, stiffness: 300, damping: 28 },
          },
        };

  const reserve = () => {
    if (reserved) return;
    sound.play("streak");
    setBurst((b) => b + 1);
    setReserved(true);
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6 px-4 pb-8 pt-5"
    >
      {/* header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2">
          <div className="font-display text-xs tracking-widest text-pitch">AFTER THE CUP</div>
          <Tag className="rounded-full border border-warn/50 bg-warn/10 px-2 py-0.5 text-warn">
            ROADMAP
          </Tag>
        </div>
        <h1 className="font-display text-3xl leading-tight text-text">THE SEASON</h1>
        <p className="mt-1 text-sm text-text-dim">
          104 matches is the warm-up. The terrace never closes.
        </p>
      </motion.div>

      {/* hero: silverware + the line */}
      <motion.div variants={item}>
        <Card className="relative overflow-hidden px-4 py-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(70% 60% at 50% 0%, rgba(245,165,36,0.12), transparent 70%)",
            }}
          />
          <div className="scanlines pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative flex flex-col items-center gap-4 text-center">
            <PixelTrophy />
            <div className="font-display text-2xl leading-tight text-text">
              THE WORLD CUP IS
              <br />
              <span className="text-warn">THE PRESEASON</span>
            </div>
            <p className="max-w-[260px] text-xs text-text-dim">
              When the final whistle goes in July, your terrace does not. It gets a division.
            </p>
          </div>
        </Card>
      </motion.div>

      {/* division ladder */}
      <motion.section variants={item} className="flex flex-col">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display text-sm text-text">THE LADDER</span>
          <Tag className="text-text-muted">MOCK STANDINGS</Tag>
        </div>
        <div className="flex flex-col gap-2">
          {DIVISIONS.map((d, i) => (
            <motion.div key={d.n} variants={ladderItem(i)}>
              <Card
                className={
                  "flex items-center gap-3 px-3 py-3 " +
                  (d.slot === "you" ? "border-pitch-700 shadow-glow" : "")
                }
              >
                <Mono
                  className={
                    "font-display text-2xl font-bold " +
                    (d.slot === "you" ? "text-win" : "text-text-muted")
                  }
                >
                  {d.n}
                </Mono>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm text-text">{d.name}</span>
                    {d.slot === "locked" && <Lock size={12} className="text-text-muted" />}
                  </div>
                  <p className="truncate text-xs text-text-muted">{d.blurb}</p>
                  {d.slot === "you" && (
                    <div className="mt-2 flex items-center justify-between rounded-card border border-pitch-700 bg-pitch/10 px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {HOME.members.slice(0, 3).map((m) => (
                            <Avatar key={m} name={m} size={18} className="ring-2 ring-surface-2" />
                          ))}
                        </div>
                        <span className="truncate text-xs font-bold text-text">{HOME.name}</span>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold tabular text-win">
                        <ArrowUp size={11} /> PROMOTION
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* season timeline strip */}
      <motion.section variants={item}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display text-sm text-text">THE CALENDAR</span>
          <CalendarRange size={14} className="text-text-muted" />
        </div>
        <div className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {TIMELINE.map((t, i) => (
            <React.Fragment key={t.label}>
              {i > 0 && <ArrowRight size={12} className="shrink-0 text-text-muted" />}
              <div
                className={
                  "shrink-0 rounded-card border-2 px-3 py-2 text-center " +
                  (t.now
                    ? "border-pitch-700 bg-pitch/10"
                    : "border-border bg-surface")
                }
              >
                <div
                  className={
                    "font-display text-xs tracking-wide " + (t.now ? "text-win" : "text-text-dim")
                  }
                >
                  {t.label}
                </div>
                <Mono className="text-[10px] text-text-muted">{t.when}</Mono>
              </div>
            </React.Fragment>
          ))}
        </div>
      </motion.section>

      {/* points carry over */}
      <motion.section variants={item}>
        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Mono className="font-display text-xl font-bold text-win">11,205</Mono>
            <ArrowRight size={14} className="text-text-muted" />
            <div>
              <div className="text-xs font-bold text-text">Points carry over</div>
              <p className="text-xs text-text-muted">
                Cup form seeds your division. Nothing resets to zero.
              </p>
            </div>
          </div>
        </Card>
      </motion.section>

      {/* CTA */}
      <motion.section variants={item} className="relative mt-auto flex flex-col gap-2">
        {burst > 0 && <PixelBurst burstKey={burst} />}
        <Button
          size="lg"
          className="w-full"
          onClick={reserve}
          variant={reserved ? "secondary" : "primary"}
          aria-live="polite"
        >
          {reserved ? (
            <>
              <Check size={18} className="text-win" /> Reserved · see you in August
            </>
          ) : (
            "Reserve your terrace"
          )}
        </Button>
        <p className="text-center text-xs text-text-muted">
          Roadmap preview. Same crew, same code, every season.
        </p>
      </motion.section>
    </motion.div>
  );
}
