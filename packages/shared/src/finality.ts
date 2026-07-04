import type { MatchEvent } from "./types.js";

/* ── Finality gate ──
   A result is PROVISIONAL until it survives a confirmation buffer without
   being superseded (VAR chalk-off). Settling off the SL1 60s-delayed feed
   already absorbs most reversals; this gate is the second belt.
   State machine per candidate result:
     provisional --(buffer elapses, no supersede)--> final
     provisional --(goal_disallowed for same side)--> reverted */

export interface Candidate {
  key: string;            // e.g. "goal:home:2" (side + new score)
  event: MatchEvent;
  seenAt: number;         // ms
}

export type GateVerdict = "pending" | "final" | "reverted";

export const DEFAULT_BUFFER_MS = 90_000;

export function judge(
  candidate: Candidate,
  laterEvents: MatchEvent[],
  now: number,
  bufferMs: number = DEFAULT_BUFFER_MS,
): GateVerdict {
  const superseded = laterEvents.some(
    (e) =>
      e.type === "goal_disallowed" &&
      e.side === candidate.event.side &&
      e.asOf >= candidate.event.asOf,
  );
  if (superseded) return "reverted";
  if (now - candidate.seenAt >= bufferMs) return "final";
  return "pending";
}
