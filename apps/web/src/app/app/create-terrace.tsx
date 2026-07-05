"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronLeft, Globe, Lock, X } from "lucide-react";
import {
  Button,
  Input,
  LiveDot,
  MatchCard,
  Mono,
  PixelBurst,
  RoomCodeChip,
  Skeleton,
  Tag,
  sound,
} from "@kick/ui";
import type { FixtureRow } from "../../lib/supabase";
import { useKickUser } from "../../lib/auth";
import { teamCode } from "../../lib/team-code";

/* ── CREATE A TERRACE ── bottom-sheet stepper.
   1 PICK THE MATCH → 2 NAME IT → 3 THE GATES OPEN (create + code + share).
   Never blocks on auth: guests play as "guest" with a sign-in nudge. */

const DEFAULT_NAME = "North Stand Lads";
const STEP_TITLES = ["PICK THE MATCH", "NAME IT", "THE GATES OPEN"] as const;

type Phase = "form" | "creating" | "done" | "error";

const kickoffFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function kickoffLabel(f: FixtureRow): string {
  if (f.status === "live") return "LIVE";
  if (f.status === "final") return "FT";
  const t = Date.parse(f.kickoff_at);
  return Number.isNaN(t) ? "TBD" : kickoffFmt.format(t);
}

/* X (the platform) logo glyph; lucide has no brand mark for it. */
function XGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const stepVariants = {
  enter: (dir: number) => ({ x: dir * 56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -56, opacity: 0 }),
};
const stepSpring = { type: "spring" as const, stiffness: 360, damping: 30 };

export function CreateTerraceSheet({
  open,
  onClose,
  fixtures,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  fixtures: FixtureRow[];
  loading: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { ready, authenticated, handle, address, login } = useKickUser();

  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [fixture, setFixture] = React.useState<FixtureRow | null>(null);
  const [name, setName] = React.useState("");
  const [visibility, setVisibility] = React.useState<"private" | "public">("private");
  const [phase, setPhase] = React.useState<Phase>("form");
  const [result, setResult] = React.useState<{ code: string; roomId: string } | null>(null);

  // fresh sheet every open
  React.useEffect(() => {
    if (!open) return;
    setStep(0);
    setDir(1);
    setFixture(null);
    setName("");
    setVisibility("private");
    setPhase("form");
    setResult(null);
  }, [open]);

  // lock body scroll behind the sheet
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const goto = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const pickFixture = (f: FixtureRow) => {
    if (f.status === "final") return;
    sound.play("tap");
    setFixture(f);
    goto(1);
  };

  const create = async () => {
    if (!fixture) return;
    sound.play("lock");
    goto(2);
    setPhase("creating");
    const started = Date.now();
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixtureId: fixture.id,
          name: name.trim() || DEFAULT_NAME,
          visibility,
          handle: handle ?? undefined,
          wallet: address ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { code: string; roomId: string };
      // let "Chalking the lines" land before the confetti
      const wait = Math.max(0, 900 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setResult(data);
      setPhase("done");
      sound.play("kickoff");
    } catch {
      setPhase("error");
      sound.play("miss");
    }
  };

  const roomName = name.trim() || DEFAULT_NAME;
  const home = fixture ? teamCode(fixture.home_team) : "";
  const away = fixture ? teamCode(fixture.away_team) : "";

  const shareOnX = () => {
    if (!result) return;
    sound.play("tap");
    const text = `The terrace "${roomName}" is open for ${home} v ${away}. Code ${result.code}. Call it before the ref does. kick.fun`;
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const enterTerrace = () => {
    if (!result) return;
    sound.play("tap");
    onClose();
    router.push(`/app/terrace/${result.code}`);
  };

  const canGoBack = phase === "form" && step > 0;
  const canClose = phase !== "creating";

  return (
    <AnimatePresence>
      {open && (
        <React.Fragment key="create-terrace">
          {/* backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => canClose && onClose()}
            aria-hidden
          />

          {/* sheet */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Create a terrace"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (canClose && (info.offset.y > 90 || info.velocity.y > 600)) onClose();
            }}
          >
            <div className="rounded-t-card border-2 border-b-0 border-border-strong bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-hard">
              {/* drag handle */}
              <div className="flex justify-center pb-1 pt-2.5">
                <div className="h-1.5 w-10 rounded-full bg-border-strong" />
              </div>

              {/* header: back · title · progress dots · close */}
              <div className="flex items-center gap-2 px-4 pb-3 pt-1">
                <button
                  type="button"
                  onClick={() => canGoBack && goto(step - 1)}
                  aria-label="Back"
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-card border-2 border-border-strong text-text-dim transition-opacity hover:text-text " +
                    (canGoBack ? "opacity-100" : "pointer-events-none opacity-0")
                  }
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex-1 text-center">
                  <span className="font-display text-sm tracking-widest text-text">
                    {STEP_TITLES[step]}
                  </span>
                  <div className="mt-1.5 flex items-center justify-center gap-1.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={
                          "block h-2 w-2 rounded-[1px] transition-all duration-200 " +
                          (i === step
                            ? "scale-125 bg-pitch [box-shadow:0_0_8px_var(--glow)]"
                            : "bg-border-strong")
                        }
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => canClose && onClose()}
                  aria-label="Close"
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-card border-2 border-border-strong text-text-dim transition-colors hover:text-text " +
                    (canClose ? "" : "pointer-events-none opacity-40")
                  }
                >
                  <X size={16} />
                </button>
              </div>

              {/* step body */}
              <div className="overflow-hidden px-4">
                <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                  <motion.div
                    key={step}
                    custom={dir}
                    variants={reduce ? undefined : stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepSpring}
                  >
                    {step === 0 && (
                      <div className="flex max-h-[52dvh] flex-col gap-2 overflow-y-auto pb-4">
                        <p className="text-xs text-text-muted">
                          Every terrace lives on one match. Finished games are closed.
                        </p>
                        {loading
                          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[52px] w-full shrink-0" />)
                          : fixtures.map((f) => (
                              <div
                                key={f.id}
                                aria-disabled={f.status === "final"}
                                className={
                                  "shrink-0 " +
                                  (f.status === "final" ? "pointer-events-none opacity-40" : "")
                                }
                              >
                                <MatchCard
                                  home={teamCode(f.home_team)}
                                  away={teamCode(f.away_team)}
                                  kickoff={kickoffLabel(f)}
                                  status={f.status}
                                  onClick={() => pickFixture(f)}
                                />
                              </div>
                            ))}
                      </div>
                    )}

                    {step === 1 && fixture && (
                      <div className="flex flex-col gap-4 pb-4">
                        {/* chosen match summary */}
                        <div className="flex items-center justify-between rounded-card border-2 border-border-strong bg-surface-2 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Mono className="text-sm font-bold text-text">{home}</Mono>
                            <span className="text-xs text-text-muted">v</span>
                            <Mono className="text-sm font-bold text-text">{away}</Mono>
                          </div>
                          {fixture.status === "live" ? (
                            <LiveDot />
                          ) : (
                            <Mono className="text-xs text-text-dim">{kickoffLabel(fixture)}</Mono>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor="terrace-name"
                            className="font-display text-xs tracking-widest text-text-dim"
                          >
                            TERRACE NAME
                          </label>
                          <Input
                            id="terrace-name"
                            autoFocus
                            value={name}
                            maxLength={40}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && create()}
                            placeholder={DEFAULT_NAME}
                          />
                        </div>

                        {/* visibility toggle */}
                        <div className="flex flex-col gap-1.5">
                          <span className="font-display text-xs tracking-widest text-text-dim">
                            WHO GETS IN
                          </span>
                          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Visibility">
                            {(
                              [
                                { key: "private", label: "PRIVATE", hint: "Code only", Icon: Lock },
                                { key: "public", label: "PUBLIC", hint: "Anyone walks in", Icon: Globe },
                              ] as const
                            ).map(({ key, label, hint, Icon }) => {
                              const on = visibility === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  onClick={() => {
                                    sound.play("tap");
                                    setVisibility(key);
                                  }}
                                  className={
                                    "flex flex-col items-start gap-0.5 rounded-card border-2 px-3 py-2.5 text-left transition-colors " +
                                    (on
                                      ? "border-pitch-700 bg-pitch/10 text-win shadow-hard-pitch"
                                      : "border-border-strong bg-surface-2 text-text-dim hover:border-chalk")
                                  }
                                >
                                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold tracking-wide">
                                    <Icon size={12} /> {label}
                                  </span>
                                  <span className="text-[10px] text-text-muted">{hint}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <Button size="lg" className="w-full" onClick={create}>
                          Open the gates
                        </Button>

                        {ready && !authenticated && (
                          <p className="text-center text-xs text-text-muted">
                            Playing as guest.{" "}
                            <button
                              type="button"
                              onClick={login}
                              className="text-win underline underline-offset-2"
                            >
                              Sign in to keep your glory
                            </button>
                          </p>
                        )}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="relative flex min-h-[280px] flex-col items-center justify-center gap-4 pb-4 text-center">
                        {phase === "creating" && (
                          <div className="flex w-full flex-col items-center gap-3 py-6">
                            <Skeleton className="h-12 w-40" />
                            <Skeleton className="h-4 w-56" />
                            <Skeleton className="h-4 w-44" />
                            <Mono className="mt-2 animate-live text-xs tracking-widest text-text-dim">
                              CHALKING THE LINES
                            </Mono>
                          </div>
                        )}

                        {phase === "done" && result && (
                          <>
                            <PixelBurst burstKey={1} className="inset-x-0 top-0 h-48" />
                            <div className="font-display text-xs tracking-widest text-pitch">
                              {roomName.toUpperCase()}
                            </div>
                            <p className="text-sm text-text-dim">
                              {home} v {away} · the gates are open. Shout the code.
                            </p>
                            <motion.div
                              initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                              animate={reduce ? { opacity: 1 } : { scale: 1.45, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.1 }}
                              className="my-4"
                            >
                              <RoomCodeChip code={result.code} />
                            </motion.div>
                            <div className="flex w-full flex-col gap-2">
                              <Button size="lg" className="w-full" onClick={enterTerrace}>
                                Enter the terrace
                              </Button>
                              <Button variant="secondary" className="w-full" onClick={shareOnX}>
                                <XGlyph size={14} /> Rally the terrace
                              </Button>
                            </div>
                          </>
                        )}

                        {phase === "error" && (
                          <div className="flex w-full flex-col items-center gap-3 py-6">
                            <Tag className="text-danger">TUNNEL BLOCKED</Tag>
                            <p className="text-sm text-text-dim">
                              Could not open the terrace. The pitch may be offline.
                            </p>
                            <Button variant="secondary" onClick={() => goto(1)}>
                              <ChevronLeft size={14} /> Back and retry
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
