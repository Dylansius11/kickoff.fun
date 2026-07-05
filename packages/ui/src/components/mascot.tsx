"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { cn } from "../lib/utils";

export type MascotAccessory = "shades" | "crown" | "cap" | "none";

/**
 * BallMascot — the KICK.FUN pixel ball with drawn-on pixel accessories.
 * All accessories are SVG (no assets): "shades" the deal-with-it frames,
 * "crown" the champion's gold crown, "cap" the gaffer's flat cap.
 * Optionally tracks the cursor with a springy 3D tilt.
 */
export function BallMascot({
  src = "/logo.svg",
  size = 96,
  shades = true,
  accessory,
  track = false,
  dropShades = false,
  className,
}: {
  src?: string;
  size?: number;
  /** Back-compat: shades on/off. Ignored when `accessory` is set. */
  shades?: boolean;
  accessory?: MascotAccessory;
  /** Follow the cursor with a 3D tilt (desktop hero). */
  track?: boolean;
  /** Animate the accessory dropping in from above (celebration moment). */
  dropShades?: boolean;
  className?: string;
}) {
  const acc: MascotAccessory = accessory ?? (shades ? "shades" : "none");
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [14, -14]), { stiffness: 160, damping: 18 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-14, 14]), { stiffness: 160, damping: 18 });

  React.useEffect(() => {
    if (!track || reduce || typeof window === "undefined") return;
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth) * 2 - 1);
      my.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [track, reduce, mx, my]);

  return (
    <motion.div
      className={cn("relative inline-block select-none", className)}
      style={track && !reduce ? { rotateX: rx, rotateY: ry, transformPerspective: 600 } : undefined}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size} height={size} draggable={false} />
      {acc !== "none" && (
        <motion.svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0"
          width={size}
          height={size}
          initial={dropShades && !reduce ? { y: -size * 0.6, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: dropShades ? 0.45 : 0 }}
        >
          {acc === "shades" && (
            /* pixel shades: two chunky lenses + bridge + arms, chalk outline */
            <g shapeRendering="crispEdges">
              {/* arms */}
              <rect x="8" y="38" width="10" height="5" fill="var(--chalk)" />
              <rect x="82" y="38" width="10" height="5" fill="var(--chalk)" />
              {/* frame top bar */}
              <rect x="16" y="36" width="68" height="5" fill="var(--chalk)" />
              {/* left lens */}
              <rect x="20" y="41" width="24" height="14" fill="var(--ink-950)" />
              <rect x="20" y="41" width="24" height="3" fill="var(--ink-900)" />
              <rect x="23" y="44" width="7" height="4" fill="var(--pitch-400)" opacity="0.85" />
              {/* right lens */}
              <rect x="56" y="41" width="24" height="14" fill="var(--ink-950)" />
              <rect x="56" y="41" width="24" height="3" fill="var(--ink-900)" />
              <rect x="59" y="44" width="7" height="4" fill="var(--pitch-400)" opacity="0.85" />
              {/* bridge */}
              <rect x="44" y="43" width="12" height="4" fill="var(--chalk)" />
              {/* lens lower rim */}
              <rect x="20" y="55" width="24" height="3" fill="var(--chalk)" />
              <rect x="56" y="55" width="24" height="3" fill="var(--chalk)" />
            </g>
          )}
          {acc === "crown" && (
            /* champion's crown: amber gold, three pixel spikes, green jewel */
            <g shapeRendering="crispEdges">
              {/* band */}
              <rect x="26" y="14" width="48" height="8" fill="var(--warn)" />
              <rect x="26" y="20" width="48" height="2" fill="#b97a12" />
              {/* spikes */}
              <rect x="26" y="2" width="8" height="12" fill="var(--warn)" />
              <rect x="46" y="-2" width="8" height="16" fill="var(--warn)" />
              <rect x="66" y="2" width="8" height="12" fill="var(--warn)" />
              {/* spike tips highlight */}
              <rect x="26" y="2" width="8" height="3" fill="#ffd166" />
              <rect x="46" y="-2" width="8" height="3" fill="#ffd166" />
              <rect x="66" y="2" width="8" height="3" fill="#ffd166" />
              {/* jewel */}
              <rect x="47" y="16" width="6" height="5" fill="var(--pitch-500)" />
              <rect x="47" y="16" width="3" height="2" fill="var(--pitch-300)" />
            </g>
          )}
          {acc === "cap" && (
            /* the gaffer's headset: matchday coach comms, mic boom to the mouth */
            <g shapeRendering="crispEdges">
              {/* headband arcing over the top */}
              <rect x="24" y="12" width="52" height="5" fill="var(--chalk)" />
              <rect x="20" y="16" width="8" height="8" fill="var(--chalk)" />
              <rect x="72" y="16" width="8" height="8" fill="var(--chalk)" />
              {/* left ear cup */}
              <rect x="12" y="24" width="14" height="18" fill="var(--ink-700)" />
              <rect x="14" y="26" width="10" height="14" fill="var(--ink-600)" />
              <rect x="15" y="28" width="4" height="4" fill="var(--pitch-400)" />
              {/* right ear cup */}
              <rect x="74" y="24" width="14" height="18" fill="var(--ink-700)" />
              <rect x="76" y="26" width="10" height="14" fill="var(--ink-600)" />
              {/* mic boom, angled down-left toward the mouth */}
              <rect x="16" y="42" width="5" height="10" fill="var(--chalk)" />
              <rect x="20" y="52" width="10" height="5" fill="var(--chalk)" />
              {/* mic tip, live */}
              <rect x="30" y="50" width="9" height="9" fill="var(--ink-950)" />
              <rect x="32" y="52" width="5" height="5" fill="var(--pitch-500)" />
            </g>
          )}
        </motion.svg>
      )}
    </motion.div>
  );
}
