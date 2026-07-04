"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/* ── Button ── hard-edged, tactile arcade button (see DESIGN_GUIDE §7.1) */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 rounded-card font-bold transition-[transform,box-shadow,filter] duration-100 active:translate-x-[2px] active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch",
  {
    variants: {
      variant: {
        primary:
          "border-2 border-pitch-700 bg-pitch text-on-primary shadow-hard-pitch active:shadow-press hover:brightness-110",
        secondary:
          "border-2 border-border-strong bg-transparent text-text shadow-hard active:shadow-press hover:border-chalk",
        danger:
          "border-2 border-danger bg-danger/15 text-danger shadow-hard active:shadow-press hover:bg-danger/25",
        ghost: "text-text-dim hover:text-text",
      },
      size: {
        sm: "min-h-9 px-3 py-1.5 text-xs",
        md: "min-h-11 px-4 py-2 text-sm",
        lg: "min-h-13 px-6 py-3 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="animate-live">...</span> : children}
    </button>
  );
}

/* ── Chip ── */
const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs tabular",
  {
    variants: {
      tone: {
        default: "border-border-strong bg-surface-2 text-text-dim",
        pitch: "border-pitch-700 bg-pitch/10 text-win",
        warn: "border-warn/50 bg-warn/10 text-warn",
        danger: "border-danger/50 bg-danger/10 text-danger",
      },
    },
    defaultVariants: { tone: "default" },
  },
);
export function Chip({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}

/* ── Tag ── tiny mono status label */
export function Tag({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("font-mono text-[10px] font-bold uppercase tracking-wide tabular", className)}
      {...props}
    />
  );
}

/* ── Card / Panel ── sharp surfaces */
export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border-2 border-border-strong bg-surface-2 shadow-hard",
        interactive && "cursor-pointer transition-transform hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-border bg-surface", className)} {...props} />;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

/* ── Mono ── tabular numeric wrapper (all numbers go through this) */
export function Mono({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("font-mono tabular", className)} {...props} />;
}

/* ── Avatar ── */
export function Avatar({
  name,
  size = 28,
  className,
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
  const initials = (name ?? "").slice(0, 2).toUpperCase();
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border border-border-strong bg-raised font-mono text-xs font-bold text-text-dim",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

/* ── LiveDot ── the universal "this is live" mark */
export function LiveDot({ label = "LIVE", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-win", className)}>
      <span className="animate-live inline-block h-2 w-2 rounded-full bg-pitch" />
      {label}
    </span>
  );
}

/* ── Skeleton ── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-live rounded-card bg-surface-2", className)} />;
}

/* ── Input ── arcade field */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-card border-2 border-border-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-pitch focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
