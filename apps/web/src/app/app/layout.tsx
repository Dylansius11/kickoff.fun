"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Ticket, Trophy, Shirt, LogIn } from "lucide-react";
import { BottomNav, Mono, VolumeControl, Avatar } from "@kick/ui";
import { KickAuthProvider, useKickUser } from "@/lib/auth";

const NAV = [
  { key: "pitch", label: "PITCH", icon: Home, href: "/app" },
  { key: "terrace", label: "TERRACE", icon: Ticket, href: "/app/terrace/QPR7" },
  { key: "table", label: "TABLE", icon: Trophy, href: "/app/table" },
  { key: "locker", label: "LOCKER", icon: Shirt, href: "/app/locker" },
];

function activeKey(pathname: string) {
  if (pathname.startsWith("/app/terrace")) return "terrace";
  if (pathname.startsWith("/app/table")) return "table";
  if (pathname.startsWith("/app/locker")) return "locker";
  return "pitch";
}

function AuthChip() {
  const { ready, authenticated, handle, login } = useKickUser();
  const router = useRouter();
  if (!ready) return <div className="h-8 w-8 rounded-full border border-border bg-surface-2" />;
  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-pitch-700 bg-pitch/10 px-2.5 font-display text-[10px] tracking-wide text-win transition-colors hover:bg-pitch/20"
      >
        <LogIn size={12} /> SIGN IN
      </button>
    );
  }
  return (
    <button type="button" onClick={() => router.push("/app/locker")} aria-label="Your locker">
      <Avatar name={handle ?? "?"} size={30} className="border-pitch-700" />
    </button>
  );
}

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <KickAuthProvider>
      <AppShell>{children}</AppShell>
    </KickAuthProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeKey(pathname);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col border-x border-border bg-bg">
      {/* top bar: brand, points, master fader */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur">
        <Link href="/app" className="flex shrink-0 items-center gap-2">
          <Image src="/logo.svg" alt="" width={26} height={26} priority />
          <span className="font-display text-base tracking-tight text-text">KICK.FUN</span>
        </Link>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-pitch-700 bg-pitch/10 px-2 py-1">
            <Mono className="text-xs font-bold text-win">11,205</Mono>
            <span className="hidden font-display text-[10px] text-text-muted min-[380px]:inline">PTS</span>
          </span>
          <VolumeControl compact />
          <AuthChip />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>

      <div className="sticky bottom-0 z-40 bg-bg">
        <BottomNav
          items={NAV.map(({ key, label, icon }) => ({ key, label, icon }))}
          active={active}
          onSelect={(key) => {
            const item = NAV.find((n) => n.key === key);
            if (item) router.push(item.href);
          }}
        />
      </div>
    </div>
  );
}
