"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { cn } from "../lib/utils";

/**
 * BallMascot — the KICK.FUN pixel ball wearing pixel shades.
 * The shades are drawn (SVG), not an asset: 8-bit "deal with it" frames that
 * drop onto the ball. Optionally tracks the cursor with a springy 3D tilt.
 */
export function BallMascot({
  src = "/logo.svg",
  size = 96,
  shades = true,
  track = false,
  dropShades = false,
  className,
}: {
  src?: string;
  size?: number;
  shades?: boolean;
  /** Follow the cursor with a 3D tilt (desktop hero). */
  track?: boolean;
  /** Animate the shades dropping in from above (celebration moment). */
  dropShades?: boolean;
  className?: string;
}) {
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
      {shades && (
        <motion.svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0"
          width={size}
          height={size}
          initial={dropShades && !reduce ? { y: -size * 0.6, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: dropShades ? 0.45 : 0 }}
        >
          {/* pixel shades: two chunky lenses + bridge + arms, chalk outline */}
          <g shapeRendering="crispEdges">
            {/* arms */}
            <rect x="8" y="38" width="10" height="5" fill="#f1f5f0" />
            <rect x="82" y="38" width="10" height="5" fill="#f1f5f0" />
            {/* frame top bar */}
            <rect x="16" y="36" width="68" height="5" fill="#f1f5f0" />
            {/* left lens */}
            <rect x="20" y="41" width="24" height="14" fill="#080b09" />
            <rect x="20" y="41" width="24" height="3" fill="#0c110e" />
            <rect x="23" y="44" width="7" height="4" fill="#38d673" opacity="0.85" />
            {/* right lens */}
            <rect x="56" y="41" width="24" height="14" fill="#080b09" />
            <rect x="56" y="41" width="24" height="3" fill="#0c110e" />
            <rect x="59" y="44" width="7" height="4" fill="#38d673" opacity="0.85" />
            {/* bridge */}
            <rect x="44" y="43" width="12" height="4" fill="#f1f5f0" />
            {/* lens lower rim */}
            <rect x="20" y="55" width="24" height="3" fill="#f1f5f0" />
            <rect x="56" y="55" width="24" height="3" fill="#f1f5f0" />
          </g>
        </motion.svg>
      )}
    </motion.div>
  );
}
