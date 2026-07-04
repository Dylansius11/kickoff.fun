"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Zap } from "lucide-react";
import {
  LeaderboardRow,
  LeaderboardTable,
  OracleBubble,
  PixelBurst,
  PotBanner,
  PredictionCard,
  RoomCodeChip,
  Scoreboard,
  Tag,
  sound,
  type PredictionState,
} from "@kick/ui";
import { ORACLE_LINES, ROOM_BOARD } from "../../mock";

const TABS = ["PREDICT", "TABLE", "ORACLE"] as const;
type Tab = (typeof TABS)[number];

const LOCK_WINDOW_MS = 45_000;

function fmtClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TerracePage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "QPR7").toUpperCase();

  const [tab, setTab] = React.useState<Tab>("PREDICT");
  const [score, setScore] = React.useState({ home: 2, away: 1 });
  const [clockSec, setClockSec] = React.useState(78 * 60 + 4);
  const [burst, setBurst] = React.useState(0);
  const [oracleLine, setOracleLine] = React.useState(ORACLE_LINES.idle);

  // open card: pick + draining lock window
  const [pick, setPick] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(1);
  const [openState, setOpenState] = React.useState<PredictionState>("open");

  // match clock ticks
  React.useEffect(() => {
    const id = window.setInterval(() => setClockSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // lock window drains; stamp shut at zero
  React.useEffect(() => {
    if (openState !== "open") return;
    const step = 250;
    const id = window.setInterval(() => {
      setProgress((p) => {
        const next = p - step / LOCK_WINDOW_MS;
        if (next <= 0) {
          window.clearInterval(id);
          setOpenState("locked");
          sound.play("lock");
          setOracleLine(ORACLE_LINES.lock);
          return 0;
        }
        return next;
      });
    }, step);
    return () => window.clearInterval(id);
  }, [openState]);

  const onPick = (name: string) => {
    setPick(name);
    sound.play("tap");
    setOracleLine(ORACLE_LINES.pick);
  };

  const fireGoal = () => {
    setScore((s) => ({ ...s, home: s.home + 1 }));
    setBurst((b) => b + 1);
    sound.play("goal");
    sound.roar();
    setOracleLine(ORACLE_LINES.goal);
  };

  const openOptions = [
    { name: "Brazil", odds: "1.65", picked: pick === "Brazil" },
    { name: "Argentina", odds: "3.10", picked: pick === "Argentina" },
    { name: "No more goals", odds: "4.50", picked: pick === "No more goals" },
  ];

  return (
    <div className="relative flex flex-1 flex-col">
      {/* goal burst overlays the whole terrace */}
      {burst > 0 && <PixelBurst burstKey={burst} className="fixed inset-x-0 top-24 h-64" />}

      {/* sticky live header */}
      <div className="sticky top-[57px] z-30 bg-bg px-4 pb-2 pt-3">
        <motion.div
          key={`${score.home}-${score.away}`}
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Scoreboard
            home="BRA"
            away="ARG"
            homeScore={score.home}
            awayScore={score.away}
            clock={fmtClock(clockSec)}
            live
          />
        </motion.div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-6">
        <PotBanner sponsor="Adidas" amount="1,000 USDC" status="funded" />

        {/* room strip: code + dev trigger for the demo goal moment */}
        <div className="flex items-center justify-between">
          <RoomCodeChip code={code} />
          <button
            type="button"
            onClick={fireGoal}
            className="inline-flex items-center gap-1 rounded-full border border-warn/50 bg-warn/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-warn transition-colors hover:bg-warn/20"
          >
            <Zap size={11} /> sim goal
          </button>
        </div>

        {/* tab strip */}
        <div className="flex border-b-2 border-border-strong" role="tablist" aria-label="Terrace views">
          {TABS.map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t)}
                className={
                  "relative flex-1 py-2.5 font-display text-xs tracking-widest transition-colors " +
                  (on ? "text-win" : "text-text-muted hover:text-text-dim")
                }
              >
                {t}
                {on && (
                  <motion.span
                    layoutId="terrace-tab"
                    className="absolute inset-x-4 -bottom-0.5 h-0.5 bg-pitch"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="flex flex-col gap-3"
          >
            {tab === "PREDICT" && (
              <>
                <OracleBubble persona="THE GAFFER" line={oracleLine} speaking />

                <PredictionCard
                  prompt="NEXT GOAL?"
                  options={openOptions}
                  state={openState}
                  progress={progress}
                  onSelect={onPick}
                />

                <PredictionCard
                  prompt="CARD THIS HALF?"
                  options={[
                    { name: "Yes", odds: "1.40", picked: true },
                    { name: "No", odds: "2.85" },
                  ]}
                  state="win"
                  points={50}
                />

                <div className="mt-1">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-display text-sm text-text">THE TABLE</span>
                    <Tag className="text-text-muted">TOP 4</Tag>
                  </div>
                  <div className="space-y-2">
                    {ROOM_BOARD.slice(0, 4).map((r) => (
                      <LeaderboardRow key={r.name} {...r} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === "TABLE" && (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm text-text">ROOM TABLE</span>
                  <Tag className="text-text-muted">{ROOM_BOARD.length} IN</Tag>
                </div>
                <LeaderboardTable rows={ROOM_BOARD} />
                <p className="text-center text-xs text-text-muted">
                  Leader claims the pot when the whistle&apos;s data is verified.
                </p>
              </>
            )}

            {tab === "ORACLE" && (
              <>
                <OracleBubble persona="THE GAFFER" line={oracleLine} speaking />
                <OracleBubble
                  persona="THE GAFFER"
                  line="VAR had a look at that tackle. Points frozen till it's final, that's the rule."
                />
                <OracleBubble persona="THE GAFFER" line={ORACLE_LINES.settle} />
                <p className="px-2 text-center text-xs text-text-muted">
                  The Gaffer calls it off signed TxLINE data. Every settle is anchored on Solana.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
