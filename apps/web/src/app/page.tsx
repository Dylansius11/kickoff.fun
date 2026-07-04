"use client";

import { useState } from "react";
import { Ticket, Trophy, Volume2 } from "lucide-react";
import {
  Button,
  Chip,
  Tag,
  Mono,
  LiveDot,
  Input,
  Scoreboard,
  PredictionCard,
  PotBanner,
  MatchCard,
  ProofReceipt,
  LeaderboardTable,
  OracleBubble,
  RoomCodeChip,
  SectionHeader,
  StatTile,
  Toast,
  BottomNav,
} from "@kick/ui";

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="overflow-hidden rounded-card border-2 border-border-strong">
      <div className="h-14" style={{ background: hex }} />
      <div className="bg-surface-2 px-2 py-1.5">
        <div className="text-xs font-medium text-text">{name}</div>
        <Mono className="text-[10px] uppercase text-text-muted">{hex}</Mono>
      </div>
    </div>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <SectionHeader eyebrow={eyebrow} title={title} />
      {children}
    </section>
  );
}

export default function Page() {
  const [homeScore, setHomeScore] = useState(1);
  const [vard, setVard] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [nav, setNav] = useState("predict");
  const goal = homeScore > 1;

  const options = [
    { name: "BRAZIL", odds: "1.85", picked: true },
    { name: "DRAW", odds: "3.20" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-5 pb-28">
      {/* top bar */}
      <header className="sticky top-0 z-10 -mx-5 flex items-center justify-between border-b border-border bg-bg/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="KICK.FUN" className="h-8 w-8" />
          <span className="font-display text-xl tracking-tight text-text">KICK.FUN</span>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="pitch">1,240 pts</Chip>
          <Chip>#3 GLOBAL</Chip>
        </div>
      </header>

      {/* hero */}
      <section className="relative py-14">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{ background: "radial-gradient(60% 60% at 30% 20%, rgba(34,197,94,0.20), transparent 70%)" }}
        />
        <LiveDot />
        <h1 className="mt-3 font-display text-5xl leading-[0.95] text-text sm:text-6xl">
          FLOODLIT
          <br />
          ARCADE
        </h1>
        <p className="mt-4 max-w-md text-lg text-text-dim">
          The KICK.FUN component system. Watch the World Cup with your mates, predict live, and the
          results <span className="text-win">can&apos;t be faked</span>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button>Start a terrace</Button>
          <Button variant="secondary">Join with code</Button>
        </div>
      </section>

      <Section eyebrow="01 · COLOR" title="Floodlit palette">
        <p className="mb-4 max-w-lg text-sm text-text-muted">
          One hero accent (pitch green) on floodlit near-black. Amber and red are match signals only,
          never decoration.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Swatch name="pitch-500" hex="#22c55e" />
          <Swatch name="pitch-400" hex="#38d673" />
          <Swatch name="ink-950" hex="#080b09" />
          <Swatch name="ink-800" hex="#141c17" />
          <Swatch name="warn" hex="#f5a524" />
          <Swatch name="danger" hex="#f4433b" />
        </div>
      </Section>

      <Section eyebrow="02 · TYPE" title="Three roles, never blurred">
        <div className="space-y-4">
          <div className="rounded-card border-2 border-border-strong bg-surface-2 p-4">
            <Mono className="mb-1 block text-xs uppercase text-text-muted">Display · Pixelify Sans</Mono>
            <div className="font-display text-3xl text-text">GOAL 90+3</div>
          </div>
          <div className="rounded-card border-2 border-border-strong bg-surface-2 p-4">
            <Mono className="mb-1 block text-xs uppercase text-text-muted">Data · JetBrains Mono (target: Departure Mono)</Mono>
            <Mono className="text-2xl font-bold text-text">2–1 · 1.85 · +50 · 9Exb…cKaA</Mono>
          </div>
          <div className="rounded-card border-2 border-border-strong bg-surface-2 p-4">
            <Mono className="mb-1 block text-xs uppercase text-text-muted">Body · Space Grotesk</Mono>
            <div className="text-base text-text">Call it before the ref does. Nobody rigs the table.</div>
          </div>
        </div>
      </Section>

      <Section eyebrow="03 · CONTROLS" title="Buttons, chips, stats">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading>Loading</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip>default</Chip>
            <Chip tone="pitch">live</Chip>
            <Chip tone="warn">held</Chip>
            <Chip tone="danger">card</Chip>
            <Tag className="text-text-muted">EYEBROW TAG</Tag>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Volume" value="4.0B" delta={{ dir: "up", value: "12%" }} />
            <StatTile label="Odds BRA" value="1.85" delta={{ dir: "down", value: "0.05" }} />
            <StatTile label="Streak" value="5" />
            <StatTile label="Rank" value="#3" delta={{ dir: "up", value: "2" }} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input placeholder="Enter room code" className="max-w-xs" />
            <RoomCodeChip code="BRA-9F2" />
          </div>
        </div>
      </Section>

      <Section eyebrow="04 · THE TERRACE" title="Live room (interactive)">
        <div className="space-y-4">
          <PotBanner sponsor="Adidas" amount="1,000 USDC" status="funded" />
          <Scoreboard home="BRA" away="ARG" homeScore={homeScore} awayScore={1} clock="78:04" />
          <div className="grid gap-4 sm:grid-cols-2">
            <PredictionCard
              prompt="NEXT GOAL?"
              options={options}
              state={goal ? "win" : "open"}
              points={50}
              progress={0.6}
            />
            <PredictionCard
              prompt="CARD THIS HALF?"
              options={[
                { name: "YES", odds: "2.10", picked: true },
                { name: "NO", odds: "1.70" },
              ]}
              state={vard ? "review" : "locked"}
              correctAnswer="No"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setHomeScore((n) => (n === 1 ? 2 : 1))}>
              {goal ? "Reset" : "Simulate goal"}
            </Button>
            <Button variant="secondary" onClick={() => setVard((v) => !v)}>
              {vard ? "Clear VAR" : "Trigger VAR"}
            </Button>
          </div>
          <p className="text-sm text-text-muted">
            Goal settles the card green and verified. VAR holds it amber with a scanline until final.
          </p>
        </div>
      </Section>

      <Section eyebrow="05 · THE ORACLE" title="Your pundit, out loud">
        <div className="space-y-3">
          <OracleBubble
            persona="THE GAFFER"
            line="That result? Verified, signed by TxLINE, locked on-chain. Nobody's rigging this one."
            speaking={speaking}
          />
          <Button variant="secondary" size="sm" onClick={() => setSpeaking((s) => !s)}>
            {speaking ? "Stop speaking" : "Speak"}
          </Button>
        </div>
      </Section>

      <Section eyebrow="06 · PROOF" title="A hash you can hold">
        <ProofReceipt fixture="BRA v ARG" result="2–1 FINAL" anchor="9Exb…cKaA" />
      </Section>

      <Section eyebrow="07 · THE TABLE" title="Live leaderboard">
        <LeaderboardTable
          rows={[
            { rank: 1, name: "pixelpele", points: 1840, streak: 5 },
            { rank: 2, name: "var_lord", points: 1620 },
            { rank: 3, name: "you", points: 1240, streak: 2, you: true },
            { rank: 4, name: "maxi", points: 980 },
          ]}
        />
      </Section>

      <Section eyebrow="08 · LOBBY" title="Today's fixtures">
        <div className="space-y-2">
          <MatchCard home="BRA" away="ARG" kickoff="20:00" status="live" />
          <MatchCard home="FRA" away="ESP" kickoff="17:00" status="upcoming" />
          <MatchCard home="ENG" away="GER" kickoff="14:00" status="final" />
        </div>
      </Section>

      <Section eyebrow="09 · SYSTEM" title="Feedback">
        <div className="max-w-md space-y-2">
          <Toast tone="win">You called it. +50 points, top of the terrace.</Toast>
          <Toast tone="warn">VAR check. Points held until the call is final.</Toast>
          <Toast tone="danger">Missed that one. The table never lies.</Toast>
        </div>
      </Section>

      <footer className="border-t border-border py-8 text-center">
        <Mono className="text-xs text-text-muted">
          KICK.FUN · Floodlit Arcade · floodlit pitch, pixel roar, receipt you can hold
        </Mono>
      </footer>

      {/* fixed mobile nav preview */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-4xl">
        <BottomNav
          active={nav}
          onSelect={setNav}
          items={[
            { key: "predict", label: "PREDICT", icon: Ticket },
            { key: "table", label: "TABLE", icon: Trophy },
            { key: "oracle", label: "ORACLE", icon: Volume2 },
          ]}
        />
      </div>
    </main>
  );
}
