"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { getBase58Decoder } from "@solana/kit";
import { Button, Mono, PixelBurst, sound } from "@kick/ui";
import { useKickUser } from "@/lib/auth";

/* ── ClaimPotButton ── the winner pulls the sponsor pot.
   Server (/api/claim) builds the unsigned claim_pot transaction with the
   winner as fee payer; the Privy embedded wallet signs and sends it here.
   The chain never trusts this UI: claim_pot re-checks signer == room.winner. */

type ClaimOk = { tx: string; potAmount: string; decimals: number; mint: string };
type ClaimErr = { error: string; reason?: string };

type Phase =
  | { k: "checking" }
  | { k: "ready"; pot: ClaimOk }
  | { k: "blocked"; label: string }
  | { k: "claiming"; pot: ClaimOk }
  | { k: "claimed"; sig: string; pot: ClaimOk }
  | { k: "error"; message: string; pot: ClaimOk | null };

function blockedLabel(reason?: string): string {
  switch (reason) {
    case "not_settled":
      return "Pot unlocks at full time";
    case "already_claimed":
      return "Pot already claimed";
    case "not_winner":
      return "Winner claims here at full time";
    default:
      return "Pot not claimable";
  }
}

function formatAmount(raw: string, decimals: number): string {
  const v = BigInt(raw);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const wholeStr = whole.toLocaleString("en-US");
  if (frac === BigInt(0)) return wholeStr;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${wholeStr}.${fracStr}`;
}

async function requestClaim(roomPda: string, winner: string): Promise<{ ok: ClaimOk | null; err: ClaimErr | null }> {
  const res = await fetch("/api/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomPda, winner }),
  });
  const json = (await res.json().catch(() => null)) as ClaimOk | ClaimErr | null;
  if (res.ok && json && "tx" in json) return { ok: json, err: null };
  return { ok: null, err: (json as ClaimErr) ?? { error: "network" } };
}

export function ClaimPotButton({ roomPda }: { roomPda: string }) {
  const { ready, authenticated, address, login } = useKickUser();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [phase, setPhase] = React.useState<Phase>({ k: "checking" });
  const [burst, setBurst] = React.useState(0);

  // Preflight: ask the server whether this wallet can claim (discard the tx;
  // a fresh one is built at click time so the blockhash never goes stale).
  React.useEffect(() => {
    if (!ready || !authenticated || !address) return;
    let alive = true;
    requestClaim(roomPda, address).then(({ ok, err }) => {
      if (!alive) return;
      if (ok) setPhase({ k: "ready", pot: ok });
      else setPhase({ k: "blocked", label: blockedLabel(err?.reason) });
    });
    return () => {
      alive = false;
    };
  }, [ready, authenticated, address, roomPda]);

  const claim = React.useCallback(async () => {
    if (!address) return;
    const prev = phase.k === "ready" || phase.k === "error" ? (phase as { pot: ClaimOk | null }).pot : null;
    const { ok, err } = await requestClaim(roomPda, address);
    if (!ok) {
      setPhase({ k: "blocked", label: blockedLabel(err?.reason) });
      return;
    }
    setPhase({ k: "claiming", pot: ok });
    try {
      const wallet =
        wallets.find((w) => w.standardWallet?.name === "Privy") ?? wallets[0];
      if (!wallet) throw new Error("No Solana wallet connected");
      const txBytes = Uint8Array.from(atob(ok.tx), (c) => c.charCodeAt(0));
      const { signature } = await signAndSendTransaction({
        transaction: txBytes,
        wallet,
        chain: "solana:devnet",
      });
      const sig = getBase58Decoder().decode(signature);
      setPhase({ k: "claimed", sig, pot: ok });
      setBurst((b) => b + 1);
      sound.play("win");
    } catch (e) {
      setPhase({
        k: "error",
        message: e instanceof Error ? e.message : "Transaction failed, try again",
        pot: ok ?? prev,
      });
    }
  }, [address, phase, roomPda, wallets, signAndSendTransaction]);

  if (!ready) {
    return <Button size="lg" disabled loading className="min-w-56" />;
  }

  if (!authenticated || !address) {
    return (
      <Button size="lg" className="min-w-56" onClick={login}>
        Sign in to claim
      </Button>
    );
  }

  if (phase.k === "checking") {
    return <Button size="lg" disabled loading className="min-w-56" />;
  }

  if (phase.k === "blocked") {
    return (
      <Button size="lg" disabled className="min-w-56">
        {phase.label}
      </Button>
    );
  }

  if (phase.k === "claimed") {
    const short = `${phase.sig.slice(0, 4)}…${phase.sig.slice(-4)}`;
    return (
      <div className="relative flex flex-col items-center gap-2">
        <PixelBurst burstKey={burst} className="pointer-events-none absolute inset-0" />
        <div className="font-display text-2xl text-win">
          Pot claimed: <Mono>{formatAmount(phase.pot.potAmount, phase.pot.decimals)}</Mono>
        </div>
        <a
          href={`https://explorer.solana.com/tx/${phase.sig}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-text-dim underline underline-offset-2 hover:text-text"
        >
          tx {short} <ExternalLink size={12} />
        </a>
      </div>
    );
  }

  const pot = phase.k === "ready" || phase.k === "claiming" || phase.k === "error" ? phase.pot : null;
  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="lg" className="min-w-56" loading={phase.k === "claiming"} onClick={claim}>
        Claim pot{pot ? <Mono> · {formatAmount(pot.potAmount, pot.decimals)}</Mono> : null}
      </Button>
      {phase.k === "error" ? (
        <p className="font-mono text-xs text-danger">{phase.message}</p>
      ) : null}
    </div>
  );
}
