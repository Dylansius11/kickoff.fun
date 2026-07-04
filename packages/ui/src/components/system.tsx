"use client";

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { Card, Mono } from "./primitives";

/* ── SectionHeader ── pixel eyebrow + title */
export function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <div className="font-display text-xs tracking-widest text-pitch">{eyebrow}</div>
      <h2 className="font-display text-2xl text-text">{title}</h2>
    </div>
  );
}

/* ── StatTile ── */
export function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: { dir: "up" | "down"; value: string };
}) {
  return (
    <Card className="px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wide tabular text-text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <Mono className="text-2xl font-bold text-text">{value}</Mono>
        {delta && (
          <Mono className={cn("text-xs", delta.dir === "up" ? "text-win" : "text-danger")}>
            {delta.dir === "up" ? "▲" : "▼"} {delta.value}
          </Mono>
        )}
      </div>
    </Card>
  );
}

/* ── Toast ── */
export function Toast({
  tone = "default",
  children,
}: {
  tone?: "default" | "win" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const bar = {
    default: "before:bg-text-muted",
    win: "before:bg-pitch",
    warn: "before:bg-warn",
    danger: "before:bg-danger",
  }[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border-2 border-border-strong bg-surface-2 py-2.5 pl-4 pr-3 text-sm text-text shadow-hard",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        bar,
      )}
    >
      {children}
    </div>
  );
}

/* ── BottomNav ── mobile primary navigation */
export function BottomNav({
  items,
  active,
  onSelect,
}: {
  items: { key: string; label: string; icon: LucideIcon }[];
  active: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <nav className="flex items-stretch border-t-2 border-border-strong bg-surface">
      {items.map(({ key, label, icon: Icon }) => {
        const on = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(key)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors",
              on ? "text-win" : "text-text-muted hover:text-text-dim",
            )}
          >
            <Icon size={18} />
            <span className="font-display text-[10px] tracking-wide">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
