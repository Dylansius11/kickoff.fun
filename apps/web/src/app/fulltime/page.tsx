"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, VolumeControl, FullTimeScreen, useSound } from "@kick/ui";

/**
 * /fulltime — the immersive post-match screen, standalone for the demo cut.
 * Replay re-mounts the choreography (and fires the win fanfare) so the reveal
 * can be captured cleanly on video.
 */
export default function FullTimePage() {
  const [take, setTake] = useState(0);
  const { play } = useSound();

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-4xl flex-col px-5 pb-16">
      {/* floodlit backdrop */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-50"
        style={{ background: "radial-gradient(70% 50% at 50% -5%, rgba(34,197,94,0.18), transparent 65%)" }}
      />
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="KICK.FUN" className="h-7 w-7" />
          <span className="font-display text-lg tracking-tight text-text">KICK.FUN</span>
        </div>
        <VolumeControl />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <FullTimeScreen
          key={take}
          data={{
            fixture: "BRA v ARG",
            score: "2–1",
            handle: "@pixelpele",
            rank: 1,
            total: 8,
            points: 1840,
            streakBest: 5,
            anchor: "9Exb…cKaA",
            potLabel: "1,000 USDC · Adidas",
          }}
          onShare={() => play("win")}
        />

        <Button
          variant="ghost"
          size="sm"
          className="mt-8"
          onClick={() => {
            setTake((t) => t + 1);
            play("kickoff");
          }}
        >
          <RotateCcw size={14} /> Replay reveal
        </Button>
      </div>
    </main>
  );
}
