"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Zap } from "lucide-react";
import {
  Card,
  LeaderboardRow,
  LeaderboardTable,
  LiveDot,
  OracleBubble,
  PixelBurst,
  PotBanner,
  PredictionCard,
  PredictionOption,
  RoomCodeChip,
  Scoreboard,
  Tag,
  sound,
  oracleVoice,
  useOracleSpeaking,
  type PredictionState,
} from "@kick/ui";
import { ORACLE_LINES, ROOM_BOARD } from "../../mock";
import { teamCode } from "../../../../lib/team-code";
import { useKickUser } from "../../../../lib/auth";
import { getPersona, personaDelivery, personaLabel, type Persona } from "../../../../lib/persona";
import { hasJoined, markJoined } from "../../../../lib/invite";
import { useTerraceLive, type LiveProp } from "../../../../lib/use-terrace";

const TABS = ["PREDICT", "TABLE", "ORACLE"] as const;
type Tab = (typeof TABS)[number];

/** Real room from GET /api/rooms/[code]; null = unknown code, keep the demo terrace. */
interface RoomInfo {
  roomId: string;
  code: string;
  name: string | null;
  members: number;
  fixture: { id: number; home_team: string; away_team: string };
}

const LOCK_WINDOW_MS = 45_000;
/** Base points for a correct pick. Mirrors PROP_POINTS in apps/ingest/src/props.ts. */
const PROP_POINTS = 50;

function fmtClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── LivePropCard ── one real prop off the props engine, mapped onto the
   five-state PredictionCard. Voided gets its own dimmed treatment (the shared
   card has no voided state and MISSED would be a lie). */
function LivePropCard({
  prop,
  myPick,
  now,
  onPick,
}: {
  prop: LiveProp;
  myPick: string | undefined;
  now: number;
  onPick: (propId: string, optionId: string) => void;
}) {
  const options = prop.options.map((o) => ({
    name: o.label,
    odds: o.odds ?? "",
    picked: myPick === o.id,
  }));

  if (prop.state === "voided") {
    return (
      <Card className="border-2 border-border p-4 opacity-50">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-sm text-text">{prop.prompt}</span>
          <Tag className="text-text-muted">VOIDED</Tag>
        </div>
        <div className="space-y-2">
          {options.map((o) => (
            <PredictionOption key={o.name} {...o} disabled />
          ))}
        </div>
        <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
          VOIDED · VAR took it back
        </p>
      </Card>
    );
  }

  const locks = Date.parse(prop.locks_at);
  const opens = Date.parse(prop.opens_at);

  let state: PredictionState;
  let progress: number | undefined;
  let correctAnswer: string | undefined;
  if (prop.state === "open") {
    // The worker flips state on its own tick; stamp the card shut locally the
    // moment the window is past so nobody taps a dead market.
    if (now >= locks) {
      state = "locked";
    } else {
      state = "open";
      progress = Math.max(0, Math.min(1, (locks - now) / Math.max(1, locks - opens)));
    }
  } else if (prop.state === "locked") {
    state = "locked";
  } else if (prop.state === "under_review") {
    state = "review";
  } else {
    const winId = prop.resolution?.winning_option_id ?? null;
    state = myPick != null && myPick === winId ? "win" : "miss";
    correctAnswer = prop.options.find((o) => o.id === winId)?.label ?? "n/a";
  }

  return (
    <PredictionCard
      prompt={prop.prompt}
      options={options}
      state={state}
      points={PROP_POINTS}
      correctAnswer={correctAnswer}
      progress={progress}
      onSelect={
        state === "open"
          ? (name) => {
              const opt = prop.options.find((o) => o.label === name);
              if (opt) onPick(prop.id, opt.id);
            }
          : undefined
      }
    />
  );
}

export default function TerracePage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "QPR7").toUpperCase();

  const [tab, setTab] = React.useState<Tab>("PREDICT");
  const [score, setScore] = React.useState({ home: 2, away: 1 });
  const [clockSec, setClockSec] = React.useState(78 * 60 + 4);
  const [burst, setBurst] = React.useState(0);
  const [oracleLine, setOracleLine] = React.useState(ORACLE_LINES.idle);
  const oracleSpeaking = useOracleSpeaking();

  // Real room lookup: when the code exists in Supabase, the whole terrace goes
  // live (props, picks, table, Oracle, score). Unknown codes keep the demo.
  const [room, setRoom] = React.useState<RoomInfo | null>(null);
  React.useEffect(() => {
    let on = true;
    fetch(`/api/rooms/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? (r.json() as Promise<RoomInfo>) : null))
      .then((data) => {
        if (on && data) setRoom(data);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [code]);

  // Invite deep link: a visitor landing on a real room becomes a member with
  // zero prompts. sessionStorage guards against re-joining on every mount;
  // the join endpoint is idempotent anyway. Guests join as "guest".
  const { ready, authenticated, handle, address } = useKickUser();
  const [welcome, setWelcome] = React.useState(false);
  const joinFired = React.useRef(false);
  React.useEffect(() => {
    if (!room || !ready || joinFired.current || hasJoined(code)) return;
    joinFired.current = true;
    let on = true;
    fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        authenticated ? { handle: handle ?? undefined, wallet: address ?? undefined } : {},
      ),
    })
      .then((r) => (r.ok ? (r.json() as Promise<RoomInfo>) : null))
      .then((data) => {
        if (!data) return;
        markJoined(code);
        if (!on) return;
        setRoom((prev) => (prev ? { ...prev, members: data.members } : prev));
        setWelcome(true);
        sound.play("kickoff");
        window.setTimeout(() => on && setWelcome(false), 3000);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [room, ready, code, authenticated, handle, address]);

  // ── LIVE MODE ── real props, picks, leaderboard and Oracle off Supabase
  // Realtime. Settle/lock/goal reactions mirror the sim moments below.
  const {
    props: liveProps,
    propsLoaded,
    myPicks,
    members,
    snapshot,
    oracleFeed,
    userId,
    pick: sendPick,
  } = useTerraceLive(room?.roomId ?? null, room?.fixture.id ?? null, {
    onSettle: (_prop, _picked, won) => {
      if (won) {
        setBurst((b) => b + 1);
        sound.play("win");
      }
    },
    onLock: () => sound.play("lock"),
    onGoal: () => {
      setBurst((b) => b + 1);
      sound.play("goal");
      sound.roar();
    },
  });

  // The freshest Oracle line owns the bubble; the auto-speak effect below
  // reads it out when sound is up (first change after mount stays silent).
  React.useEffect(() => {
    if (room && oracleFeed[0]) setOracleLine(oracleFeed[0].line);
  }, [room, oracleFeed]);

  // Real countdowns tick against locks_at; only spin the wheel while a market
  // is actually open.
  const hasOpenProp = !!room && liveProps.some((p) => p.state === "open");
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!hasOpenProp) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [hasOpenProp]);

  // Match clock: seeded by every fixture snapshot, ticks between updates.
  const [liveClockSec, setLiveClockSec] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (snapshot?.clockSeconds != null) setLiveClockSec(snapshot.clockSeconds);
  }, [snapshot]);
  const phase = snapshot?.phase ?? "pre";
  const clockRunning = liveClockSec != null && phase !== "pre" && phase !== "ht" && phase !== "ft";
  React.useEffect(() => {
    if (!clockRunning) return;
    const id = window.setInterval(() => setLiveClockSec((s) => (s == null ? s : s + 1)), 1000);
    return () => window.clearInterval(id);
  }, [clockRunning]);

  const onLivePick = React.useCallback(
    async (propId: string, optionId: string) => {
      const outcome = await sendPick(propId, optionId, {
        wallet: address ?? undefined,
        handle: handle ?? undefined,
      });
      if (outcome === "ok") {
        sound.play("tap");
        setOracleLine(ORACLE_LINES.pick);
      } else if (outcome === "locked" || outcome === "error") {
        sound.play("miss");
      }
    },
    [sendPick, address, handle],
  );

  // Real leaderboard rows (room_members ordered by points in the hook).
  const board = React.useMemo(
    () =>
      members.map((m, i) => ({
        rank: i + 1,
        name: m.handle,
        points: m.points,
        streak: m.streak,
        you: userId != null && m.userId === userId,
      })),
    [members, userId],
  );

  // Selected Oracle voice (Locker cosmetic). Lines in oracleFeed are
  // generated server-side by the ingest worker with a fixed persona, so the
  // pick can only shape DELIVERY (TTS rate/pitch) and the bubble label here,
  // not the wording itself.
  const [persona, setPersonaState] = React.useState<Persona>("gaffer");
  React.useEffect(() => setPersonaState(getPersona()), []);
  // Real rooms show the equipped voice on the bubble; the sim keeps its
  // scripted Gaffer copy, so the label stays honest there.
  const bubblePersona = room ? personaLabel(persona) : "THE GAFFER";

  // The Oracle speaks over the tannoy: play toggles voice, wave bars follow.
  const toggleOracleVoice = React.useCallback(() => {
    if (oracleVoice.speaking) oracleVoice.stop();
    else oracleVoice.speak(oracleLine, personaDelivery(persona));
  }, [oracleLine, persona]);

  // Auto-call fresh lines (goal, lock, settle) when sound is up. speak()
  // cancels any in-flight utterance, so lines never overlap. Skip the first
  // line after mount (idle copy or realtime hydration).
  const firstLine = React.useRef(true);
  React.useEffect(() => {
    if (firstLine.current) {
      firstLine.current = false;
      return;
    }
    if (sound.volume > 0) oracleVoice.speak(oracleLine, personaDelivery(persona));
  }, [oracleLine, persona]);

  // Cut the mic when leaving the terrace.
  React.useEffect(() => () => oracleVoice.stop(), []);

  // ── DEMO MODE (unknown code) ── local simulation, untouched.
  const [pick, setPick] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(1);
  const [openState, setOpenState] = React.useState<PredictionState>("open");

  // match clock ticks (sim only; real mode follows the fixture snapshot)
  React.useEffect(() => {
    if (room) return;
    const id = window.setInterval(() => setClockSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [room]);

  // lock window drains; stamp shut at zero (sim only)
  React.useEffect(() => {
    if (room || openState !== "open") return;
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
  }, [room, openState]);

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

  // Header values: real fixture snapshot when live, sim state otherwise.
  const homeScore = room ? (snapshot?.homeScore ?? 0) : score.home;
  const awayScore = room ? (snapshot?.awayScore ?? 0) : score.away;
  const clockLabel = room
    ? liveClockSec != null
      ? fmtClock(liveClockSec)
      : "--:--"
    : fmtClock(clockSec);
  const isLive = room ? phase !== "pre" && phase !== "ft" : true;
  const memberCount = room ? (board.length > 0 ? board.length : room.members) : ROOM_BOARD.length;

  return (
    <div className="relative flex flex-1 flex-col">
      {/* goal / win burst overlays the whole terrace */}
      {burst > 0 && <PixelBurst burstKey={burst} className="fixed inset-x-0 top-24 h-64" />}

      {/* one-time welcome strip after an invite-link auto-join */}
      <AnimatePresence>
        {welcome && (
          <motion.div
            key="welcome"
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed inset-x-0 top-[57px] z-40 mx-auto w-full max-w-[430px] px-4 pt-2"
          >
            <div
              role="status"
              className="flex items-center justify-center gap-2 rounded-card border-2 border-pitch-700 bg-surface px-3 py-2 shadow-hard-pitch"
            >
              <span className="font-display text-xs tracking-widest text-win">YOU ARE IN</span>
              <span className="text-text-muted">·</span>
              <span className="text-xs text-text-dim">welcome to the terrace</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* sticky live header */}
      <div className="sticky top-[57px] z-30 bg-bg px-4 pb-2 pt-3">
        <motion.div
          key={`${homeScore}-${awayScore}`}
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Scoreboard
            home={room ? teamCode(room.fixture.home_team) : "BRA"}
            away={room ? teamCode(room.fixture.away_team) : "ARG"}
            homeScore={homeScore}
            awayScore={awayScore}
            clock={clockLabel}
            live={isLive}
          />
        </motion.div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-6">
        <PotBanner sponsor="Adidas" amount="1,000 USDC" status="funded" />

        {/* room strip: name, headcount, code + (demo only) the sim goal trigger */}
        {room && (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-display text-sm uppercase tracking-wide text-text">
              {room.name ?? "TERRACE"}
            </span>
            <Tag className="shrink-0 text-text-dim">{memberCount} IN</Tag>
          </div>
        )}
        <div className="flex items-center justify-between">
          <RoomCodeChip code={code} />
          {!room && (
            <button
              type="button"
              onClick={fireGoal}
              className="inline-flex items-center gap-1 rounded-full border border-warn/50 bg-warn/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-warn transition-colors hover:bg-warn/20"
            >
              <Zap size={11} /> sim goal
            </button>
          )}
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
                <OracleBubble
                  persona={bubblePersona}
                  line={oracleLine}
                  speaking={oracleSpeaking}
                  speakable
                  onSpeak={toggleOracleVoice}
                />

                {room ? (
                  <>
                    {propsLoaded && liveProps.length === 0 && (
                      <Card className="flex flex-col items-center gap-2 border-2 border-border-strong p-6 text-center">
                        <LiveDot label="ON WATCH" />
                        <p className="font-display text-sm text-text">The Oracle is watching.</p>
                        <p className="text-xs text-text-muted">
                          Markets open when the ball rolls.
                        </p>
                      </Card>
                    )}
                    {liveProps.map((p) => (
                      <LivePropCard
                        key={p.id}
                        prop={p}
                        myPick={myPicks[p.id]}
                        now={now}
                        onPick={onLivePick}
                      />
                    ))}
                  </>
                ) : (
                  <>
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
                  </>
                )}

                {(room ? board.length > 0 : true) && (
                  <div className="mt-1">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="font-display text-sm text-text">THE TABLE</span>
                      <Tag className="text-text-muted">TOP 4</Tag>
                    </div>
                    <div className="space-y-2">
                      {(room ? board : ROOM_BOARD).slice(0, 4).map((r) => (
                        <LeaderboardRow key={`${r.rank}-${r.name}`} {...r} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === "TABLE" && (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm text-text">ROOM TABLE</span>
                  <Tag className="text-text-muted">
                    {room ? board.length : ROOM_BOARD.length} IN
                  </Tag>
                </div>
                <LeaderboardTable rows={room ? board : ROOM_BOARD} />
                <p className="text-center text-xs text-text-muted">
                  Leader claims the pot when the whistle&apos;s data is verified.
                </p>
              </>
            )}

            {tab === "ORACLE" && (
              <>
                <OracleBubble
                  persona={bubblePersona}
                  line={oracleLine}
                  speaking={oracleSpeaking}
                  speakable
                  onSpeak={toggleOracleVoice}
                />
                {room ? (
                  oracleFeed.slice(1).map((e, i) => (
                    <OracleBubble key={`${i}-${e.line}`} persona={bubblePersona} line={e.line} />
                  ))
                ) : (
                  <>
                    <OracleBubble
                      persona="THE GAFFER"
                      line="VAR had a look at that tackle. Points frozen till it's final, that's the rule."
                    />
                    <OracleBubble persona="THE GAFFER" line={ORACLE_LINES.settle} />
                  </>
                )}
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
