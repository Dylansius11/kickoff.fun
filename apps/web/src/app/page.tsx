"use client";

import * as React from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useScroll,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from "motion/react";
import { ArrowRight, ShieldCheck, Users, Radio, Zap } from "lucide-react";
import {
  Button,
  Mono,
  LiveDot,
  Scoreboard,
  ProofReceipt,
  OracleBubble,
  ShareCard,
  PixelBurst,
  BallMascot,
  VolumeControl,
  CountUp,
  useSound,
  sound,
} from "@kick/ui";

/* ── FloodlightBeams ── two stadium light cones swaying slowly from the top corners. */
function FloodlightBeams() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {[
        { left: "-4%", origin: "0% 0%", from: -8, to: 6, delay: 0 },
        { right: "-4%", origin: "100% 0%", from: 8, to: -6, delay: 1.6 },
      ].map((b, i) => (
        <motion.div
          key={i}
          className="absolute top-[-10%] h-[130%] w-[46%]"
          style={{
            left: b.left,
            right: b.right,
            transformOrigin: b.origin,
            background:
              "linear-gradient(178deg, rgba(34,197,94,0.13), rgba(34,197,94,0.05) 45%, transparent 72%)",
            clipPath: i === 0 ? "polygon(0 0, 30% 0, 100% 100%, 40% 100%)" : "polygon(70% 0, 100% 0, 60% 100%, 0 100%)",
          }}
          animate={reduce ? undefined : { rotate: [b.from, b.to, b.from] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: b.delay }}
        />
      ))}
    </div>
  );
}

/* ── Fireflies ── drifting pixel motes in the floodlight, cheap ambience. */
function Fireflies({ count = 9 }: { count?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const h = (i * 2654435761) >>> 0;
        const left = 6 + (h % 88);
        const top = 8 + ((h >> 4) % 70);
        const size = 2 + (i % 3);
        const dur = 7 + (i % 5) * 1.7;
        return (
          <motion.span
            key={i}
            className="absolute rounded-[1px] bg-pitch-glow"
            style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, opacity: 0.35 }}
            animate={{
              y: [0, -22 - (i % 4) * 8, 0],
              x: [0, (i % 2 ? 14 : -14), 0],
              opacity: [0.12, 0.5, 0.12],
            }}
            transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: (i % 6) * 0.8 }}
          />
        );
      })}
    </div>
  );
}

/* ── PixelBoot ── the boot that kicks the ball: swings in from the lower left. */
function PixelBoot({ kickKey }: { kickKey: number }) {
  const reduce = useReducedMotion();
  if (reduce || kickKey === 0) return null;
  return (
    <motion.svg
      key={kickKey}
      viewBox="0 0 60 40"
      className="pointer-events-none absolute -bottom-2 -left-16 z-10 h-16 w-24"
      initial={{ rotate: -55, x: -30, y: 26, opacity: 0 }}
      animate={{ rotate: [null, 18, 10], x: [null, 6, -4], y: [null, -2, 6], opacity: [0, 1, 0] }}
      transition={{ duration: 0.5, times: [0, 0.35, 1], ease: [0.2, 0.9, 0.3, 1] }}
      style={{ transformOrigin: "10% 90%" }}
      aria-hidden
    >
      <g shapeRendering="crispEdges">
        {/* boot body */}
        <rect x="6" y="10" width="18" height="18" fill="var(--ink-600)" />
        <rect x="20" y="16" width="26" height="12" fill="var(--ink-600)" />
        {/* toe cap */}
        <rect x="42" y="16" width="10" height="12" fill="var(--chalk)" />
        {/* sole */}
        <rect x="6" y="28" width="46" height="5" fill="var(--ink-950)" />
        {/* studs */}
        <rect x="12" y="33" width="4" height="4" fill="var(--ink-950)" />
        <rect x="26" y="33" width="4" height="4" fill="var(--ink-950)" />
        <rect x="40" y="33" width="4" height="4" fill="var(--ink-950)" />
        {/* laces */}
        <rect x="12" y="14" width="10" height="2" fill="var(--pitch-400)" />
        <rect x="12" y="18" width="10" height="2" fill="var(--pitch-400)" />
      </g>
    </motion.svg>
  );
}

/* ── PitchBackdrop ── a chalk-lined pitch receding to the horizon, pure CSS 3D. */
function PitchBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[62%] overflow-hidden" aria-hidden>
      <div
        className="absolute inset-x-[-40%] bottom-[-12%] top-0"
        style={{
          transform: "perspective(520px) rotateX(58deg)",
          transformOrigin: "50% 100%",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(34,197,94,0.16) 0 2px, transparent 2px 56px), repeating-linear-gradient(90deg, rgba(34,197,94,0.10) 0 2px, transparent 2px 88px)",
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.75), transparent 85%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.75), transparent 85%)",
        }}
      />
      {/* centre circle */}
      <div
        className="absolute bottom-[-6%] left-1/2 h-40 w-[380px] -translate-x-1/2 rounded-[50%] border-2 border-pitch/25"
        style={{ maskImage: "linear-gradient(to top, black 55%, transparent)" }}
      />
    </div>
  );
}

/* ── Magnetic ── the CTA leans toward the cursor, snaps back on leave. */
function Magnetic({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx2 = useSpring(x, { stiffness: 300, damping: 20 });
  const sy2 = useSpring(y, { stiffness: 300, damping: 20 });
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      style={{ x: sx2, y: sy2 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * 14);
        y.set(((e.clientY - r.top) / r.height - 0.5) * 10);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}

/* ── word-by-word headline reveal ── */
function Headline() {
  const words: { t: string; cls?: string; br?: boolean }[] = [
    { t: "CALL" },
    { t: "IT", br: true },
    { t: "BEFORE", br: true },
    { t: "THE" },
    { t: "REF", cls: "animate-flicker text-win" },
    { t: "DOES" },
  ];
  return (
    <h1 className="mt-4 font-display text-5xl leading-[0.95] text-text sm:text-7xl">
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <motion.span
            className={`inline-block ${w.cls ?? ""}`}
            initial={{ opacity: 0, y: 34, rotate: i % 2 ? 2 : -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.08 + i * 0.07 }}
          >
            {w.t}
          </motion.span>
          {w.br ? <br /> : " "}
        </React.Fragment>
      ))}
    </h1>
  );
}

/* ── the landing page ── web-scale, floodlit, cursor-reactive.
   "Launch app" drops into the mobile-format product at /app. */

const TICKER = [
  "GOAL 90+3 · BRA 2–1 ARG",
  "VERIFIED ON SOLANA",
  "pixelpele +50 pts",
  "VAR · HELD · 78:04",
  "POT 1,000 USDC · CLAIMED",
  "var_lord calls the corner",
  "SIGNED BY TXLINE",
  "MAR 1–0 JPN · FULL TIME",
];

function Ticker() {
  const reduce = useReducedMotion();
  const row = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {TICKER.map((t, i) => (
        <span key={i} className="flex items-center gap-8">
          <Mono className="text-xs uppercase tracking-wider text-text-dim">{t}</Mono>
          <span className="h-1 w-1 rounded-full bg-pitch" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/60 py-2.5">
      <motion.div
        className="flex w-max"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
      >
        {row}
        {row}
      </motion.div>
    </div>
  );
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StepCard({ n, icon: Icon, title, body }: { n: string; icon: typeof Users; title: string; body: string }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="rounded-card border-2 border-border-strong bg-surface-2 p-6 shadow-hard"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-card border-2 border-pitch-700 bg-pitch/10 text-win">
          <Icon size={18} />
        </span>
        <Mono className="font-display text-xs text-text-muted">{n}</Mono>
      </div>
      <h3 className="mt-4 font-display text-xl text-text">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-dim">{body}</p>
    </motion.div>
  );
}

export default function Landing() {
  const reduce = useReducedMotion();
  const { play, roar } = useSound();

  /* cursor floodlight: a spotlight that chases the pointer across the hero */
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.35);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const lx = useTransform(sx, (v) => `${v * 100}%`);
  const ly = useTransform(sy, (v) => `${v * 100}%`);
  const floodlight = useMotionTemplate`radial-gradient(42rem 30rem at ${lx} ${ly}, rgba(34,197,94,0.16), transparent 65%)`;

  /* hero scoreboard easter egg */
  const [score, setScore] = useState(1);
  const [burst, setBurst] = useState(0);
  const [kick, setKick] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  /* opening whistle: the boot kicks the ball once the entrance settles */
  React.useEffect(() => {
    sound.attachAutoUnlock(); // sound is on by default; first tap anywhere unlocks it
    if (reduce) return;
    const t = window.setTimeout(() => {
      setKick(1);
      setBurst((b) => b + 1);
      play("kickoff"); // silent until the AudioContext unlocks, that's fine
    }, 1400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* parallax on scroll */
  const { scrollYProgress } = useScroll();
  const ballY = useTransform(scrollYProgress, [0, 0.25], [0, -60]);

  const onHeroMove = (e: React.PointerEvent) => {
    const r = heroRef.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const simulateGoal = () => {
    setScore((s) => s + 1);
    setBurst((b) => b + 1);
    play("goal");
    roar();
  };

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      {/* pixel grid backdrop */}
      <div
        className="pointer-events-none fixed inset-0 -z-20 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(241,245,240,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(241,245,240,0.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="KICK.FUN" className="h-8 w-8" />
            <span className="font-display text-xl tracking-tight text-text">KICK.FUN</span>
          </div>
          <div className="flex items-center gap-2">
            <VolumeControl />
            <Link href="/app">
              <Button size="sm">
                Launch app <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        onPointerMove={reduce ? undefined : onHeroMove}
        className="relative isolate"
      >
        {/* chasing floodlight */}
        <motion.div className="pointer-events-none absolute inset-0 -z-10" style={{ background: floodlight }} />
        {/* static stadium wash */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(90% 60% at 50% -10%, rgba(34,197,94,0.14), transparent 70%)" }}
        />
        {/* chalk pitch receding to the horizon */}
        <PitchBackdrop />
        {/* swaying stadium beams + drifting motes */}
        <FloodlightBeams />
        <Fireflies />

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-16 md:grid-cols-[1.15fr_0.85fr] md:pb-28 md:pt-24">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              <LiveDot label="WORLD CUP 2026 · LIVE" />
            </motion.div>

            <Headline />

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 26, delay: 0.18 }}
              className="mt-5 max-w-md text-lg leading-relaxed text-text-dim"
            >
              Watch the World Cup with your mates. Predict live, roast the losers, and settle on
              data <span className="text-win">signed at the source</span>. Nobody rigs this table.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 26, delay: 0.28 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Magnetic>
                <Link href="/app">
                  <Button size="lg">
                    Launch app <ArrowRight size={16} />
                  </Button>
                </Link>
              </Magnetic>
              <Link href="/system">
                <Button variant="secondary" size="lg">
                  See the system
                </Button>
              </Link>
            </motion.div>

            {/* receipts strip: the numbers that matter, rolling in */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, type: "spring", stiffness: 240, damping: 26 }}
              className="mt-10 flex max-w-md items-stretch divide-x divide-border border-y border-border"
            >
              {(
                [
                  [60, "s", "SIGNED DATA LAG"],
                  [0, "", "SEED PHRASES"],
                  [100, "%", "ON-CHAIN RECEIPTS"],
                ] as const
              ).map(([n, suffix, label]) => (
                <div key={label} className="flex-1 px-4 py-3">
                  <CountUp to={n} suffix={suffix} duration={1.6} className="font-display text-2xl text-win" />
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 flex items-center gap-2"
            >
              <ShieldCheck size={14} className="text-win" />
              <Mono className="text-xs text-text-muted">
                every result anchored on Solana · powered by TxLINE
              </Mono>
            </motion.div>
          </div>

          {/* interactive ball + scoreboard */}
          <motion.div style={{ y: reduce ? 0 : ballY }} className="relative flex flex-col items-center gap-6">
            <PixelBurst burstKey={burst} count={burst ? 26 : 0} />
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
              className="relative"
            >
              {/* the ball is kickable: boot it and it backflips with a whistle */}
              <PixelBoot kickKey={kick} />
              <motion.button
                type="button"
                aria-label="Kick the ball"
                key={kick}
                onClick={() => {
                  setKick((k) => k + 1);
                  setBurst((b) => b + 1);
                  play("kickoff");
                }}
                animate={
                  reduce || kick === 0
                    ? undefined
                    : {
                        y: [0, -130, 0, -26, 0],
                        rotate: [0, 380, 720, 720, 720],
                        scaleY: [1, 1.06, 0.82, 1.04, 1],
                      }
                }
                transition={{ duration: 1.05, ease: [0.22, 0.9, 0.3, 1], times: [0, 0.4, 0.72, 0.86, 1] }}
                className="cursor-pointer select-none border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-pitch"
              >
                <BallMascot size={190} track shades dropShades className="drop-shadow-[0_0_50px_rgba(34,197,94,0.3)]" />
              </motion.button>
              <div className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-text-muted">
                [ kick him ]
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 26, delay: 0.35 }}
              className="w-full max-w-xs"
            >
              <Scoreboard home="BRA" away="ARG" homeScore={score} awayScore={1} clock="78:04" />
              <button
                type="button"
                onClick={simulateGoal}
                className="mx-auto mt-3 block font-mono text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-win"
              >
                [ tap for a goal ]
              </button>
            </motion.div>
          </motion.div>
        </div>

        <Ticker />
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <Reveal>
          <div className="font-display text-xs tracking-[0.3em] text-pitch">THE LOOP</div>
          <h2 className="mt-1 font-display text-3xl text-text sm:text-4xl">Ninety minutes of mouth, receipts at full time</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Reveal delay={0.05}>
            <StepCard
              n="01"
              icon={Users}
              title="START A TERRACE"
              body="Spin up a room in one tap, share the code, your mates pile in. No wallets, no forms, straight onto the terrace."
            />
          </Reveal>
          <Reveal delay={0.12}>
            <StepCard
              n="02"
              icon={Zap}
              title="CALL IT LIVE"
              body="Next goal, cards, corners: quickfire calls against live odds while the match runs. Streaks stack, the Oracle stirs the pot."
            />
          </Reveal>
          <Reveal delay={0.19}>
            <StepCard
              n="03"
              icon={ShieldCheck}
              title="SETTLE ON PROOF"
              body="Results come signed by TxLINE and anchored on Solana. The table settles itself, and nobody argues with a receipt."
            />
          </Reveal>
        </div>
      </section>

      {/* ── PROOF ── */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-28">
          <Reveal>
            <div className="font-display text-xs tracking-[0.3em] text-pitch">CAN&apos;T FAKE IT</div>
            <h2 className="mt-1 font-display text-3xl text-text sm:text-4xl">The ref can be wrong. The data can&apos;t.</h2>
            <p className="mt-4 max-w-md leading-relaxed text-text-dim">
              Every score, every card, every VAR call arrives cryptographically signed at the
              source and lands on-chain. Your bragging rights come with a hash.
            </p>
            <div className="mt-6">
              <OracleBubble
                persona="THE GAFFER"
                line="That result? Signed, sealed, anchored. Take it up with the blockchain, son."
                speaking
              />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="flex justify-center">
            <motion.div whileHover={{ rotate: -1.5, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <ProofReceipt fixture="BRA v ARG" result="2–1 FINAL" anchor="9Exb…cKaA" />
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── THE FLEX ── */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal className="order-2 flex justify-center md:order-1">
            <motion.div
              initial={{ rotate: -3 }}
              whileHover={{ rotate: 0, scale: 1.03 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <ShareCard
                data={{
                  fixture: "BRA v ARG",
                  score: "2–1",
                  handle: "@pixelpele",
                  rank: 1,
                  total: 8,
                  points: 1840,
                  anchor: "9Exb…cKaA",
                  potLabel: "1,000 USDC · Adidas",
                }}
              />
            </motion.div>
          </Reveal>
          <Reveal delay={0.1} className="order-1 md:order-2">
            <div className="font-display text-xs tracking-[0.3em] text-pitch">THE FLEX</div>
            <h2 className="mt-1 font-display text-3xl text-text sm:text-4xl">Full time hits different when it&apos;s provable</h2>
            <p className="mt-4 max-w-md leading-relaxed text-text-dim">
              Win the terrace, the ball puts its shades on, and your receipt goes straight to X.
              Sponsored pots pay the champion in USDC, on-chain, one tap.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Radio size={14} className="text-win" />
              <Mono className="text-xs text-text-muted">live money path already running on devnet</Mono>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(70% 90% at 50% 110%, rgba(34,197,94,0.18), transparent 70%)" }}
        />
        <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center md:py-32">
          <Reveal>
            <BallMascot size={72} shades />
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-6 font-display text-4xl leading-[0.95] text-text sm:text-6xl">
              THE TERRACE
              <br />
              IS <span className="text-win">OPEN</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-8">
              <Link href="/app">
                <Button size="lg">
                  Launch app <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 text-center">
          <Mono className="text-xs text-text-muted">
            KICK.FUN · built for the TxODDS x Solana hackathon · results signed by TxLINE, anchored on Solana
          </Mono>
          <Mono className="text-[10px] text-text-muted">points are for glory, not for cash</Mono>
        </div>
      </footer>
    </main>
  );
}
