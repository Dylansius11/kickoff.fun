/* Kickoff formatting: local day + time labels for fixture cards.
   "Today" / "Tomorrow" / "Wed 8 Jul" in the viewer's timezone, 24h clock. */

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Local midnight for a date, used to count whole-day offsets. */
function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Split an ISO kickoff into { day, time } in the user's locale/timezone.
 * day: "Today" | "Tomorrow" | short date like "Wed 8 Jul".
 * Invalid input returns { day: "TBD", time: "" }.
 */
export function formatKickoff(iso: string, now: Date = new Date()): { day: string; time: string } {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { day: "TBD", time: "" };
  const d = new Date(t);
  const diffDays = Math.round((dayStart(d) - dayStart(now)) / 86_400_000);
  const day = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : dateFmt.format(d);
  return { day, time: timeFmt.format(d) };
}

const NBSP = "\u00A0";

/**
 * One-line label for MatchCard's mono slot: "Tomorrow · 02:00" or "Wed 8 Jul · 03:00".
 * Uses non-breaking spaces so it never wraps at narrow widths. Invalid input: "TBD".
 */
export function kickoffCompact(iso: string, now: Date = new Date()): string {
  const { day, time } = formatKickoff(iso, now);
  if (!time) return "TBD";
  return `${day} · ${time}`.replace(/ /g, NBSP);
}
