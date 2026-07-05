/* ── PROPS ENGINE ──
   Turns the live TxLINE state stream into prediction markets: generates props
   per open/live room, locks them on schedule, settles them off confirmed
   events (finality gate for goals, instant for cards/corners), awards points.

   ── THE CONTRACT (consumed by apps/web, do not drift) ──
   props.options   = PropOption[]        [{ id, label, odds? }]
   props.resolution = PropResolution     { winning_option_id, reason, source: "txline" }
   props.type       = PropType           (union below)
   Correct pick: picks.points_awarded = 50, picks.is_correct = true, plus a
   points_ledger row (delta 50, reason "prop:<type>") whose trigger updates
   users.tournament_points and room_members.points.

   ── Idempotency / crash-safety ──
   Every terminal transition is guarded in SQL (`state in (open,locked,
   under_review)` for props, `settle_state = 'pending'` for picks), so no
   prop settles twice and no pick double-pays. Settlement order is picks ->
   ledger -> prop state LAST: a crash mid-settle leaves the prop settleable,
   and the retried intent replays the (now no-op) pick updates before closing
   the prop. On boot the engine hydrates live prop counts from the DB, so a
   restart mid-match resumes instead of duplicating. Transport errors requeue
   the intent for the next tick. */

import {
  DEFAULT_BUFFER_MS,
  detectOddsSwing,
  judge,
  type Candidate,
  type MatchEvent,
  type MatchPhase,
  type MatchState,
} from "@kick/shared";
import {
  activePropCounts,
  createProps,
  findSettleableProps,
  lockDueProps,
  markPropsUnderReview,
  settlePicksForProp,
  settleProp,
  voidPicksForProp,
  voidProp,
} from "./db.js";

/* ── Contract types ── */

export type PropType = "next_goal" | "card_this_half" | "next_corner" | "ht_score" | "ft_score" | "odds_swing";

export interface PropOption {
  id: string;
  label: string;
  odds?: string;
}

export interface PropResolution {
  winning_option_id: string | null;
  reason: string;
  source: "txline";
}

/** Base points for a correct pick. */
export const PROP_POINTS = 50;

/** Lock windows per type, real-match milliseconds (divided by timeScale in sim). */
const LOCK_MS: Record<PropType, number> = {
  next_goal: 90_000,
  card_this_half: 600_000,
  next_corner: 60_000,
  odds_swing: 120_000,
  ht_score: 1_200_000,
  ft_score: 1_200_000,
};

/** Exact-score option grid for ht_score / ft_score. Ids stay ASCII; labels
    use the en-dash, the one dash allowed in user-facing score text. */
const SCORELINES = ["0-0", "1-0", "0-1", "1-1", "2-0", "0-2", "2-1", "1-2", "2-2"] as const;

function scoreOptions(): PropOption[] {
  return [
    ...SCORELINES.map((s) => ({ id: s, label: s.replace("-", "–") })),
    { id: "other", label: "Any other score" },
  ];
}

function scoreWinner(state: MatchState): string {
  const id = `${state.homeScore}-${state.awayScore}`;
  return (SCORELINES as readonly string[]).includes(id) ? id : "other";
}

type SettleIntent =
  | { kind: "settle"; type: PropType; winner: string; reason: string }
  | { kind: "void"; type: PropType; reason: string };

export interface PropsEngineOpts {
  fixtureId: number;
  /** Wall-clock compression for demo mode: lock windows and the goal
      finality buffer are divided by this. 1 (default) = real time. */
  timeScale?: number;
  /** Feature flag for the exact-score props (ht_score / ft_score). Default
      off: they work off MatchState scores, which the current TxLINE
      normalizer does fill, but the payload mapping is still provisional
      (see normalize() in main.ts), so they stay opt-in until confirmed. */
  exactScoreProps?: boolean;
}

export class PropsEngine {
  private readonly fixtureId: number;
  private readonly scale: number;
  private readonly exactScores: boolean;

  private hydrated = false;
  /** Live (open|locked|under_review) prop-row count per type, mirroring the DB. */
  private readonly active = new Map<PropType, number>();
  private prevPhase: MatchPhase | null = null;
  private pendingGoals: Candidate[] = [];
  private readonly history: MatchEvent[] = [];
  /** Intents that hit a transport error; replayed at the top of the next tick. */
  private retries: SettleIntent[] = [];
  private lastImplied: number | null = null;
  private swing: { baseline: number; direction: 1 | -1; decideAt: number; team: string } | null = null;

  constructor(opts: PropsEngineOpts) {
    this.fixtureId = opts.fixtureId;
    this.scale = Math.max(1, opts.timeScale ?? 1);
    this.exactScores = opts.exactScoreProps ?? false;
  }

  /** Scale a real-match duration into wall-clock ms for this run. */
  private ms(base: number): number {
    return Math.max(1_000, Math.round(base / this.scale));
  }

  private count(type: PropType): number {
    return this.active.get(type) ?? 0;
  }

  private isLive(phase: MatchPhase): boolean {
    return phase === "first_half" || phase === "second_half" || phase === "extra_time";
  }

  /** One pass of the lifecycle loop. Call once per poll tick with the fresh
      state and the events diffed since the previous tick. `impliedHome` is
      the home side's implied win probability from the odds stream when
      available; odds_swing props only exist while it flows. */
  async onTick(state: MatchState, events: MatchEvent[], now: number, impliedHome?: number): Promise<void> {
    if (!(await this.hydrate())) return; // DB unreachable; whole pass retries next tick

    const locked = await lockDueProps(this.fixtureId);
    if (locked) console.log(`[props] locked ${locked} prop(s) past locks_at`);

    const replay = this.retries;
    this.retries = [];
    for (const intent of replay) await this.apply(intent);

    await this.onPhase(state, now);
    for (const ev of events) await this.onEvent(ev, state, now);
    await this.onOdds(state, now, impliedHome);
    await this.judgeGoals(state, now);
    await this.ensureRolling(state, now);

    this.prevPhase = state.phase;
  }

  /** Rebuild the in-memory picture from the DB once per process, so restarts
      mid-match resume cleanly instead of duplicating open markets. */
  private async hydrate(): Promise<boolean> {
    if (this.hydrated) return true;
    const counts = await activePropCounts(this.fixtureId);
    if (counts === null) return false;
    for (const [type, n] of Object.entries(counts)) this.active.set(type as PropType, n);
    this.hydrated = true;
    // A restart loses the odds-swing baseline, so an inherited open swing
    // market cannot be settled honestly. Void it: nobody loses points.
    if (this.count("odds_swing") > 0 && !this.swing) {
      this.retries.push({ kind: "void", type: "odds_swing", reason: "Market data gap, market voided. No points move." });
    }
    return true;
  }

  /** Execute one settle/void intent against the whole fan-out group
      (fixture + type). Idempotent end to end; transport errors requeue. */
  private async apply(intent: SettleIntent): Promise<void> {
    const ids = await findSettleableProps(this.fixtureId, intent.type);
    if (ids === null) {
      this.retries.push(intent);
      return;
    }
    let failed = false;
    for (const id of ids) {
      if (intent.kind === "settle") {
        // Picks first, prop state last (see module header for why).
        const picks = await settlePicksForProp(id, intent.winner, `prop:${intent.type}`, PROP_POINTS);
        if (picks === null) {
          failed = true;
          continue;
        }
        if ((await settleProp(id, { winning_option_id: intent.winner, reason: intent.reason, source: "txline" })) === null) {
          failed = true;
          continue;
        }
        if (picks.winners + picks.losers > 0) {
          console.log(`[props] prop ${id}: ${picks.winners} correct (+${PROP_POINTS} each), ${picks.losers} wrong`);
        }
      } else {
        if ((await voidPicksForProp(id)) === null) {
          failed = true;
          continue;
        }
        if ((await voidProp(id, intent.reason)) === null) failed = true;
      }
    }
    if (failed) {
      this.retries.push(intent);
      return;
    }
    this.active.set(intent.type, 0);
    if (ids.length > 0) {
      const tail = intent.kind === "settle" ? `-> ${intent.winner}` : "voided";
      console.log(`[props] ${intent.type} x${ids.length} ${tail} (${intent.reason})`);
    }
  }

  private async create(type: PropType, prompt: string, options: PropOption[], locksAt: number): Promise<void> {
    const n = await createProps({ fixtureId: this.fixtureId, type, prompt, options, locksAt });
    if (n > 0) {
      this.active.set(type, n);
      console.log(`[props] open ${type} in ${n} room(s): "${prompt}"`);
    }
    // n === 0: no rooms listening or DB down. Rolling types (next_goal,
    // next_corner) self-heal via ensureRolling; half-edge types are simply
    // missed for that half, which is correct when nobody is in a room.
  }

  /** Phase transitions: open the half-scoped markets on kickoff of each
      half, close everything half-scoped at the whistle. */
  private async onPhase(state: MatchState, now: number): Promise<void> {
    const from = this.prevPhase;
    const to = state.phase;
    if (from === to) return;

    const halfStarted = (to === "first_half" && (from === null || from === "pre")) || to === "second_half";
    if (halfStarted) {
      await this.create(
        "card_this_half",
        "A card in this half?",
        [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ],
        now + this.ms(LOCK_MS.card_this_half),
      );
      if (this.exactScores) {
        const type: PropType = to === "first_half" ? "ht_score" : "ft_score";
        const prompt = type === "ht_score" ? "Score at the break?" : "Final score?";
        await this.create(type, prompt, scoreOptions(), now + this.ms(LOCK_MS[type]));
      }
    }

    if (to === "half_time" || to === "full_time") {
      const whistle = to === "half_time" ? "Half time" : "Full time";
      // A goal still inside the VAR window at the whistle outranks "none";
      // let judgeGoals resolve it instead of settling early.
      if (this.count("next_goal") > 0 && this.pendingGoals.length === 0) {
        await this.apply({ kind: "settle", type: "next_goal", winner: "none", reason: `${whistle}: no further goal` });
      }
      if (this.count("card_this_half") > 0) {
        await this.apply({ kind: "settle", type: "card_this_half", winner: "no", reason: `${whistle}: no card shown` });
      }
      if (to === "half_time" && this.count("ht_score") > 0) {
        await this.apply({
          kind: "settle",
          type: "ht_score",
          winner: scoreWinner(state),
          reason: `Half time score ${state.homeScore}–${state.awayScore}`,
        });
      }
      if (to === "full_time") {
        if (this.count("ft_score") > 0) {
          await this.apply({
            kind: "settle",
            type: "ft_score",
            winner: scoreWinner(state),
            reason: `Full time score ${state.homeScore}–${state.awayScore}`,
          });
        }
        if (this.count("next_corner") > 0) {
          await this.apply({ kind: "void", type: "next_corner", reason: "Full time before the next corner. No points move." });
        }
        if (this.count("odds_swing") > 0) {
          await this.apply({ kind: "void", type: "odds_swing", reason: "Full time before the market settled. No points move." });
          this.swing = null;
        }
      }
    }
  }

  private async onEvent(ev: MatchEvent, state: MatchState, now: number): Promise<void> {
    switch (ev.type) {
      case "goal": {
        // Provisional until it survives the finality buffer (VAR window).
        this.history.push(ev);
        this.pendingGoals.push({ key: `prop-goal:${ev.side}:${ev.asOf}`, event: ev, seenAt: now });
        const n = await markPropsUnderReview(this.fixtureId, "next_goal");
        if (n) console.log(`[props] next_goal x${n} under_review (VAR window)`);
        break;
      }
      case "goal_disallowed":
        this.history.push(ev); // judge() reads this to revert the candidate
        break;
      case "corner":
        if (ev.side && this.count("next_corner") > 0) {
          const team = ev.side === "home" ? state.home : state.away;
          await this.apply({ kind: "settle", type: "next_corner", winner: ev.side, reason: `Corner to ${team}` });
        }
        break;
      case "yellow_card":
      case "red_card":
        if (this.count("card_this_half") > 0) {
          const reason = ev.type === "red_card" ? "Red card shown" : "Yellow card shown";
          await this.apply({ kind: "settle", type: "card_this_half", winner: "yes", reason });
        }
        break;
      default:
        break; // kickoff/half_time/full_time handled via onPhase
    }
  }

  /** odds_swing lifecycle. Settlement is deliberately pragmatic: at the
      first odds snapshot after the lock window closes, compare home implied
      probability to its value when the swing prop opened. Held at or beyond
      the swung level (moved * direction >= 0) means the market did not snap
      back: "Follow" wins. Retraced past the open level: "Fade" wins. */
  private async onOdds(state: MatchState, now: number, impliedHome?: number): Promise<void> {
    if (impliedHome === undefined) return;

    if (this.swing && now >= this.swing.decideAt) {
      const moved = (impliedHome - this.swing.baseline) * this.swing.direction;
      const winner = moved >= 0 ? "follow" : "fade";
      const reason =
        winner === "follow" ? `Market held against ${this.swing.team}` : `Market snapped back toward ${this.swing.team}`;
      await this.apply({ kind: "settle", type: "odds_swing", winner, reason });
      this.swing = null;
    }

    if (!this.swing && this.lastImplied !== null && this.count("odds_swing") === 0 && this.isLive(state.phase)) {
      const sw = detectOddsSwing(this.lastImplied, impliedHome, this.fixtureId, now);
      if (sw && sw.delta !== null) {
        // Home implied probability rising means the market moves AGAINST away.
        const direction: 1 | -1 = sw.delta > 0 ? 1 : -1;
        const team = direction === 1 ? state.away : state.home;
        const locksAt = now + this.ms(LOCK_MS.odds_swing);
        await this.create(
          "odds_swing",
          `Odds moving against ${team}. Follow the market or fade it?`,
          [
            { id: "follow", label: "Follow the market" },
            { id: "fade", label: "Fade it" },
          ],
          locksAt,
        );
        if (this.count("odds_swing") > 0) {
          this.swing = { baseline: impliedHome, direction, decideAt: locksAt, team };
        }
      }
    }

    this.lastImplied = impliedHome;
  }

  /** Run provisional goals through the shared finality gate. Final: the
      next_goal market settles on the scoring side. Reverted (VAR chalk-off):
      the market voids, nobody loses points, and a fresh market rolls. */
  private async judgeGoals(state: MatchState, now: number): Promise<void> {
    const buffer = this.ms(DEFAULT_BUFFER_MS);
    for (let i = this.pendingGoals.length - 1; i >= 0; i--) {
      const candidate = this.pendingGoals[i]!;
      const verdict = judge(candidate, this.history, now, buffer);
      if (verdict === "pending") continue;
      this.pendingGoals.splice(i, 1);
      if (verdict === "final" && candidate.event.side) {
        const team = candidate.event.side === "home" ? state.home : state.away;
        await this.apply({
          kind: "settle",
          type: "next_goal",
          winner: candidate.event.side,
          reason: `Goal to ${team}, confirmed clear of the VAR window`,
        });
      } else {
        await this.apply({ kind: "void", type: "next_goal", reason: "Goal chalked off by VAR. No points move." });
      }
    }
  }

  /** Rolling markets: while the ball is in play there is always exactly one
      live next_goal and one live next_corner group. Settling one (or a fresh
      boot with none open) regrows it here, which is also what makes prop
      creation self-healing after a DB blip. */
  private async ensureRolling(state: MatchState, now: number): Promise<void> {
    if (!this.isLive(state.phase)) return;
    if (this.count("next_goal") === 0 && this.pendingGoals.length === 0) {
      await this.create(
        "next_goal",
        `Next goal: ${state.home}, ${state.away}, or nobody?`,
        [
          { id: "home", label: state.home },
          { id: "away", label: state.away },
          { id: "none", label: "No more goals this half" },
        ],
        now + this.ms(LOCK_MS.next_goal),
      );
    }
    if (this.count("next_corner") === 0) {
      await this.create(
        "next_corner",
        "Next corner: which end?",
        [
          { id: "home", label: state.home },
          { id: "away", label: state.away },
        ],
        now + this.ms(LOCK_MS.next_corner),
      );
    }
  }
}
