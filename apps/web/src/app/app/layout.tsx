"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Ticket, Trophy, Shirt } from "lucide-react";
import { BottomNav, Mono, VolumeControl } from "@kick/ui";

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

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
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
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-pitch-700 bg-pitch/10 px-2.5 py-1">
            <Mono className="text-xs font-bold text-win">11,205</Mono>
            <span className="font-display text-[10px] text-text-muted">PTS</span>
          </span>
          <VolumeControl />
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
