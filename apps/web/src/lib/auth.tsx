"use client";

import * as React from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useWallets, toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

/* ── KICK.FUN auth ── Privy email/social login → embedded Solana wallet.
   The wallet pubkey is the player identity (users.wallet_pubkey) and, later,
   the signer for the optional claim_pot tx. External wallets (Phantom etc.)
   ride the same provider as the power-user path. */

export function KickAuthProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  // No app id (e.g. fork without env): render unauthenticated, never crash.
  if (!appId) return <>{children}</>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "twitter"],
        appearance: {
          theme: "dark",
          accentColor: "#22c55e",
          logo: "/logo.svg",
          walletChainType: "solana-only",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          showWalletUIs: true,
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export interface KickUser {
  ready: boolean;
  authenticated: boolean;
  /** Short display handle derived from email/social, e.g. "muhamad" */
  handle: string | null;
  /** Embedded (or first connected) Solana wallet address, the player identity. */
  address: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

export function useKickUser(): KickUser {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const address = React.useMemo(() => {
    const embedded = wallets.find((w) => w.standardWallet?.name === "Privy");
    return embedded?.address ?? wallets[0]?.address ?? null;
  }, [wallets]);

  const handle = React.useMemo(() => {
    if (!user) return null;
    const email = user.email?.address ?? user.google?.email;
    if (email) return email.split("@")[0];
    if (user.twitter?.username) return user.twitter.username;
    if (address) return `${address.slice(0, 4)}…${address.slice(-4)}`;
    return "player";
  }, [user, address]);

  return { ready, authenticated, handle, address, login, logout };
}

/** Compact address for UI, "AaT2…K8Km" style. */
export function shortAddress(addr: string | null | undefined) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "";
}
