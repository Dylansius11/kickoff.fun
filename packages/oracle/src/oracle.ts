import type { MatchEvent } from "@kick/shared";

/* ── The Oracle: deterministic template engine ──
   MVP is templated on purpose (DESIGN spec): deterministic, fast, cheap,
   demo-safe. LLM color commentary is a stretch goal layered on top later.
   Every line is UI copy: NO em-dashes allowed (CLAUDE.md golden rule).
   En-dash (–) is permitted ONLY inside score strings like 2–1.
   Lines go through TTS: keep every one speakable in under 5 seconds. */

export type Persona = "gaffer" | "announcer" | "analyst";

export interface OracleLine {
  trigger: string;
  text: string;
  persona: Persona;
  /// priority 0 = speak immediately (goal), 1 = queue, 2 = drop if busy
  priority: 0 | 1 | 2;
}

export interface OracleContext {
  /// name of a room member whose pick this event affected, if any
  heroName?: string;
  heroPoints?: number;
  wreckedCount?: number;
  homeTeam?: string;
  awayTeam?: string;
  newFavorite?: string;
  /// score AFTER the event (a goal event includes the goal itself)
  homeScore?: number;
  awayScore?: number;
}

type Template = (e: MatchEvent, c: OracleContext) => string;

const pick = (arr: string[], seed: number) => arr[seed % arr.length]!;

/* ── context readers ── */

type GoalKind = "opener" | "equaliser" | "late_winner" | "consolation" | "plain";
type CardKind = "leading" | "losing" | "level";
type FtKind = "comfortable" | "thriller" | "draw" | "unknown";

const LATE_SECONDS = 80 * 60;

/** Scoring side's goals vs the other side's, post-event. Null when unknowable. */
function split(e: MatchEvent, c: OracleContext): { us: number; them: number } | null {
  if (e.side == null || c.homeScore == null || c.awayScore == null) return null;
  return e.side === "home"
    ? { us: c.homeScore, them: c.awayScore }
    : { us: c.awayScore, them: c.homeScore };
}

function goalKind(e: MatchEvent, c: OracleContext): GoalKind {
  const s = split(e, c);
  if (!s) return "plain";
  if (s.us + s.them === 1) return "opener";
  if (s.us === s.them) return "equaliser";
  if (s.us === s.them + 1 && (e.clockSeconds ?? 0) >= LATE_SECONDS) return "late_winner";
  if (s.us < s.them) return "consolation";
  return "plain";
}

function cardKind(e: MatchEvent, c: OracleContext): CardKind {
  const s = split(e, c);
  if (!s || s.us === s.them) return "level";
  return s.us > s.them ? "leading" : "losing";
}

function ftKind(c: OracleContext): FtKind {
  if (c.homeScore == null || c.awayScore == null) return "unknown";
  const diff = Math.abs(c.homeScore - c.awayScore);
  if (diff === 0) return "draw";
  if (diff === 1) return "thriller";
  return "comfortable";
}

function side(e: MatchEvent, c: OracleContext): string {
  if (e.side === "home") return c.homeTeam ?? "the home side";
  if (e.side === "away") return c.awayTeam ?? "the away side";
  return "the pitch";
}

function winner(c: OracleContext): string {
  if (c.homeScore == null || c.awayScore == null) return "the winners";
  if (c.homeScore > c.awayScore) return c.homeTeam ?? "the home side";
  if (c.awayScore > c.homeScore) return c.awayTeam ?? "the away side";
  return "nobody";
}

/** Score string. En-dash by golden-rule exception: allowed for scores only. */
function score(c: OracleContext): string {
  if (c.homeScore == null || c.awayScore == null) return "level";
  return `${c.homeScore}–${c.awayScore}`;
}

function minute(e: MatchEvent): number {
  return Math.max(1, Math.floor((e.clockSeconds ?? 0) / 60));
}

function hero(c: OracleContext): string {
  if (c.heroName && c.heroPoints)
    return `${c.heroName} called it, +${c.heroPoints}, top of the terrace!`;
  if (c.wreckedCount) return `${c.wreckedCount} picks just went up in smoke.`;
  return "";
}

function fmtDelta(delta: number | null): string {
  if (delta == null) return "hard";
  const pts = Math.abs(delta).toFixed(0);
  return `${pts} points ${delta > 0 ? "up" : "down"}`;
}

/* ── template pools ──
   Variation without Math.random: seeded by event timestamp so replays are
   deterministic (same feed = same commentary = testable demo).
   Branched triggers (goal, cards, full_time) key sub-pools off score context. */

const TEMPLATES: Record<Persona, Record<string, Template>> = {
  announcer: {
    goal: (e, c) => {
      const t = side(e, c);
      const pools: Record<GoalKind, string[]> = {
        opener: [
          `FIRST BLOOD! ${t} break the deadlock! ${hero(c)}`,
          `GOAL! ${t}! The deadlock is DEAD! ${hero(c)}`,
          `ONE UP! ${t} strike first! Hold onto something! ${hero(c)}`,
          `IT'S IN! ${t} open the scoring and this place shakes! ${hero(c)}`,
        ],
        equaliser: [
          `GOAL! GOAL! ${t} level it! We go again! ${hero(c)}`,
          `${t} EQUALISE! All square and the terrace is bouncing! ${hero(c)}`,
          `IT'S IN! ${t} drag it level! Nobody sit down! ${hero(c)}`,
          `LEVEL! ${t} breathe again! ${hero(c)}`,
        ],
        late_winner: [
          `LATE, LATE SHOW! ${t} in minute ${minute(e)}! ${hero(c)}`,
          `${t} WIN IT AT THE DEATH! Minute ${minute(e)}! ${hero(c)}`,
          `NO WAY! ${t} strike in minute ${minute(e)}! Limbs everywhere! ${hero(c)}`,
          `THE DAGGER! ${t}, minute ${minute(e)}, roof comes OFF! ${hero(c)}`,
        ],
        consolation: [
          `${t} pull one back! Is it on? IS IT ON? ${hero(c)}`,
          `GOAL for ${t}! Too little? They don't care! ${hero(c)}`,
          `${t} score! Still behind, still swinging! ${hero(c)}`,
          `One back for ${t}! This isn't buried yet! ${hero(c)}`,
        ],
        plain: [
          `GOOOAL! The terrace erupts for ${t}! ${hero(c)}`,
          `IT'S IN! ${t} score and the picks go flying! ${hero(c)}`,
          `${t}! ${t}! Say it twice, it counts once! ${hero(c)}`,
          `GOAL! ${t} turn the screw! ${hero(c)}`,
        ],
      };
      return pick(pools[goalKind(e, c)], e.asOf);
    },
    goal_disallowed: (e) =>
      pick(
        [
          "NO GOAL! VAR wipes it OFF! Points frozen!",
          "Hold everything! The flag kills it! NO goal!",
          "RULED OUT! The net moved, the scoreboard didn't!",
          "VAR SAYS NO! Take the celebration back!",
          "Chalked off! Lines drawn, hearts broken!",
          "NO GOAL! Screens up, arms crossed, it's gone!",
        ],
        e.asOf,
      ),
    red_card: (e, c) => {
      const t = side(e, c);
      const pools: Record<CardKind, string[]> = {
        leading: [
          `RED CARD! ${t} down to ten while AHEAD! Brave or mad!`,
          `OFF! ${t} lose a man with the lead! Bus incoming!`,
          `SENT OFF! ${t} defend a lead with TEN! Buckle up!`,
        ],
        losing: [
          `RED! ${t} down a man AND down on the scoreboard!`,
          `OFF HE GOES! ${t} chase the game with ten men now!`,
          `SENT OFF! ${t} needed a goal, now they need a miracle!`,
        ],
        level: [
          `RED CARD! ${t} down to ten! Everything just changed!`,
          `OFF! ${t} to ten men! Clean sheet picks are sweating!`,
          `SENT OFF! Ten for ${t} and the whole game tilts!`,
        ],
      };
      return pick(pools[cardKind(e, c)], e.asOf);
    },
    yellow_card: (e, c) => {
      const t = side(e, c);
      const pools: Record<CardKind, string[]> = {
        leading: [
          `Yellow for ${t}! Ahead and slowing it right DOWN!`,
          `Booking! ${t} manage the lead the dark arts way!`,
          `Card! ${t} up on the board, down in the book!`,
        ],
        losing: [
          `Yellow for ${t}! Frustration boiling over!`,
          `Booking! ${t} chasing and clattering!`,
          `Card! ${t} losing the game AND the head!`,
        ],
        level: [
          `Booking for ${t}! Card watchers cash in!`,
          `Yellow! ${t} in the book and the count ticks up!`,
          `Card shown to ${t}! Ref means business!`,
        ],
      };
      return pick(pools[cardKind(e, c)], e.asOf);
    },
    corner: (e, c) => {
      const t = side(e, c);
      return pick(
        [
          `Corner to ${t}! Bodies in the box!`,
          `Corner! ${t} load the mixer!`,
          `${t} win a corner! Eyes up, over-under players!`,
          `Corner, ${t}! Keeper's punching air already!`,
          `Flag kick for ${t}! Here comes chaos!`,
          `Corner! ${t} pile everyone forward!`,
        ],
        e.asOf,
      );
    },
    odds_swing: (e, c) => {
      const d = fmtDelta(e.delta);
      const fav = c.newFavorite ? `${c.newFavorite} now the favourite!` : "Big money is talking!";
      return pick(
        [
          `Whoa! The market just moved ${d}! ${fav}`,
          `Odds SWING ${d}! ${fav}`,
          `The board flips ${d}! ${fav}`,
          `Money moves! ${d} in one gulp! ${fav}`,
          `The line lurches ${d}! Someone saw something!`,
          `Market shock! ${d} and counting! ${fav}`,
        ],
        e.asOf,
      );
    },
    settlement: (e, c) =>
      pick(
        [
          `Result VERIFIED! Signed by TxLINE, locked on-chain! ${hero(c)}`,
          `Settled! The table is LAW! ${hero(c)}`,
          `It's official! Points paid off the signed feed! ${hero(c)}`,
          `Done and dusted! Points land where they belong! ${hero(c)}`,
          `Verified! Take it up with the blockchain! ${hero(c)}`,
          `Settled! No stewards' inquiry needed! ${hero(c)}`,
        ],
        e.asOf,
      ),
    var_hold: (e) =>
      pick(
        [
          "VAR check! Points held until the call is final!",
          "Hold your picks! Screens are up!",
          "VAR is looking! Nobody breathe!",
          "Check in progress! The terrace holds its breath!",
          "Frozen! VAR decides what's real!",
          "On hold! The ref jogs to the monitor!",
        ],
        e.asOf,
      ),
    kickoff: (e) =>
      pick(
        [
          "We are LIVE! Make your calls before the ball moves!",
          "KICKOFF! Ninety minutes, one table!",
          "And we're OFF! Lock your picks in!",
          "Here we GO! First touch, first nerves!",
          "Underway! The terrace is loud already!",
          "LIVE! Whistle's gone, game's on!",
        ],
        e.asOf,
      ),
    full_time: (e, c) => {
      const w = winner(c);
      const s = score(c);
      const pools: Record<FtKind, string[]> = {
        comfortable: [
          `FULL TIME! ${w} cruise it, ${s}!`,
          `It's over! ${w} by a distance, ${s}!`,
          `Done! ${w} stroll home ${s}! Settling now!`,
        ],
        thriller: [
          `FULL TIME! ${w} edge it ${s}! Check your heart rate!`,
          `Over! ${s}! ${w} by a whisker!`,
          `It ends ${s}! ${w} survive! Settling off the signed data!`,
        ],
        draw: [
          `Full time! ${s}! Nobody blinks, everybody argues!`,
          `All over! ${s} and honours even!`,
          `It ends level, ${s}! The draw pickers feast!`,
        ],
        unknown: [
          "Full time! Settling the table off the signed data now!",
          "That's it! Whistle's gone! Grading picks!",
          "Over! Final whistle! The table decides!",
        ],
      };
      return pick(pools[ftKind(c)], e.asOf);
    },
  },
  gaffer: {
    goal: (e, c) => {
      const t = side(e, c);
      const pools: Record<GoalKind, string[]> = {
        opener: [
          `First goal, ${t}. Someone had to blink. ${hero(c)}`,
          `${t} score. About time one of them did. ${hero(c)}`,
          `One up, ${t}. Now watch everyone panic. ${hero(c)}`,
          `${t} break the deadlock. Wasn't pretty. Counts. ${hero(c)}`,
        ],
        equaliser: [
          `${t} level it. Never in doubt, he says, lying. ${hero(c)}`,
          `Equaliser, ${t}. Told the lads this wasn't done. ${hero(c)}`,
          `All square. ${t} with the reply. Cagey now. ${hero(c)}`,
          `${t} peg it back. Somebody didn't track the runner. ${hero(c)}`,
        ],
        late_winner: [
          `Minute ${minute(e)}. ${t}. That's the game, son. ${hero(c)}`,
          `${t}, minute ${minute(e)}. Late goals win trophies. ${hero(c)}`,
          `Late one for ${t}. Legs went. Always do. ${hero(c)}`,
          `${t} nick it in minute ${minute(e)}. Cruel game. Good. ${hero(c)}`,
        ],
        consolation: [
          `${t} get one back. Pride goal, probably. ${hero(c)}`,
          `Consolation for ${t}. Frame it, lads. ${hero(c)}`,
          `${t} score. Bit late for heroics, but go on. ${hero(c)}`,
          `One back for ${t}. Keeps the bus quiet, at least. ${hero(c)}`,
        ],
        plain: [
          `That's a goal for ${t}. Told you. ${hero(c)}`,
          `${t} score. Route one. Lovely stuff. ${hero(c)}`,
          `Goal, ${t}. Keeper wants a word with his back four. ${hero(c)}`,
          `Goal for ${t}. Somebody switched off. ${hero(c)}`,
        ],
      };
      return pick(pools[goalKind(e, c)], e.asOf);
    },
    goal_disallowed: (e) =>
      pick(
        [
          "VAR's having a look. Nobody move.",
          "Chalked off. Linesman earns his tea.",
          "No goal. His toenail was offside, apparently.",
          "Ruled out. Celebrate less, lads.",
          "VAR wipes it. Fine margins. Cruel ones.",
          "No goal. The lines never lie. People do.",
        ],
        e.asOf,
      ),
    red_card: (e, c) => {
      const t = side(e, c);
      const pools: Record<CardKind, string[]> = {
        leading: [
          `Red for ${t}. Winning, and he does that. Have a word.`,
          `${t} down to ten with a lead. Park the bus, lads.`,
          `Off, while ahead. ${t} will defend for their lives now.`,
        ],
        losing: [
          `Red for ${t}. Losing, and now a man light. Shambles.`,
          `${t} chasing it with ten. Good luck with that.`,
          `Off he goes. ${t} were behind anyway. Now it's a wake.`,
        ],
        level: [
          `Red for ${t}. Studs up, off you go.`,
          `Ten men, ${t}. Someone's getting the hairdryer later.`,
          `Sent off. Daft challenge. ${t} dig in now.`,
        ],
      };
      return pick(pools[cardKind(e, c)], e.asOf);
    },
    yellow_card: (e, c) => {
      const t = side(e, c);
      const pools: Record<CardKind, string[]> = {
        leading: [
          `Yellow, ${t}. Winning ugly. I'd applaud.`,
          `Card, ${t}. Smart foul, that. Take the yellow.`,
          `Booked. ${t} ahead, so nobody's fussed.`,
        ],
        losing: [
          `Yellow, ${t}. Chasing shadows and kicking them too.`,
          `Booked. ${t} are rattled. You can smell it.`,
          `Card for ${t}. Losing your head won't find a goal, son.`,
        ],
        level: [
          `Yellow for ${t}. Soft, but it counts.`,
          `Booked. ${t} testing the ref early doors.`,
          `Card, ${t}. Welcome to a proper game.`,
        ],
      };
      return pick(pools[cardKind(e, c)], e.asOf);
    },
    corner: (e, c) => {
      const t = side(e, c);
      return pick(
        [
          `Corner, ${t}. Set piece merchants rejoice.`,
          `Corner. Stick it on the big lad's head.`,
          `${t} corner. Zonal marking, my eye.`,
          `Corner won. Cheapest chance in football.`,
          `${t} with a corner. Training ground stuff now.`,
          `Corner. Someone will lose his man. Always does.`,
        ],
        e.asOf,
      );
    },
    odds_swing: (e) => {
      const d = fmtDelta(e.delta);
      return pick(
        [
          `Market's flipped ${d}. Somebody knows something.`,
          `Odds move ${d}. Suits panicking again.`,
          `${d} on the line. Money's never sentimental.`,
          `Big swing, ${d}. The bookies blinked.`,
          `${d} shift. I trust my eyes, not the screen.`,
          `Odds jump ${d}. Fear does that.`,
        ],
        e.asOf,
      );
    },
    settlement: (e, c) =>
      pick(
        [
          `Verified on the chain. No arguments, no fix. ${hero(c)}`,
          `Settled. The table never lies. ${hero(c)}`,
          `Done. Signed data, so save your moaning. ${hero(c)}`,
          `That's settled. Points where they're earned. ${hero(c)}`,
          `All squared away. On to the next one. ${hero(c)}`,
          `Settled, official. Even the ref agrees with this one. ${hero(c)}`,
        ],
        e.asOf,
      ),
    var_hold: (e) =>
      pick(
        [
          "Held by VAR. Patience.",
          "VAR again. Put the kettle on.",
          "On hold. The monitor knows best, apparently.",
          "VAR check. In my day the ref just guessed.",
          "Held up. Deep breaths, everyone.",
          "Frozen while they squint at screens. Fine.",
        ],
        e.asOf,
      ),
    kickoff: (e) =>
      pick(
        [
          "Right then. Kickoff. Earn your points.",
          "We're off. First ten minutes tell you everything.",
          "Underway. Shape looks decent. For now.",
          "Kickoff. No excuses from here.",
          "Whistle's gone. Concentrate, all of you.",
          "Off we go. Big stage, small margins.",
        ],
        e.asOf,
      ),
    full_time: (e, c) => {
      const w = winner(c);
      const s = score(c);
      const pools: Record<FtKind, string[]> = {
        comfortable: [
          `Full time, ${s}. ${w} barely broke sweat.`,
          `${s}. Men against boys, that.`,
          `Done, ${s}. ${w} could've played in slippers.`,
        ],
        thriller: [
          `Full time, ${s}. ${w} by one. Football, eh.`,
          `${s}. Won by a nose. I've aged years.`,
          `All over, ${s}. Fine margins. Always are.`,
        ],
        draw: [
          `Full time, ${s}. A draw. Thrilling stuff.`,
          `${s}. Two teams scared of losing.`,
          `Level at the end, ${s}. Point apiece, moans all round.`,
        ],
        unknown: [
          "That's full time. The table never lies.",
          "Whistle's gone. Settling up now.",
          "Full time. Data's signed, so no moaning at me.",
        ],
      };
      return pick(pools[ftKind(c)], e.asOf);
    },
  },
  analyst: {
    goal: (e, c) => {
      const t = side(e, c);
      const pools: Record<GoalKind, string[]> = {
        opener: [
          `Opener, ${t}. First-goal props pay. Win odds swing hard. ${hero(c)}`,
          `${t} score first. Teams that do win two in three here. ${hero(c)}`,
          `Goal, ${t}. Deadlock was priced at evens. Not any more. ${hero(c)}`,
          `${t} on the board first. The whole market reprices. ${hero(c)}`,
        ],
        equaliser: [
          `Equaliser, ${t}. Draw probability just doubled. ${hero(c)}`,
          `Level, ${t}. The model resets to a coin flip. ${hero(c)}`,
          `${t} equalise. Every live prop reprices now. ${hero(c)}`,
          `All square. ${t} claw back twenty points of win probability. ${hero(c)}`,
        ],
        late_winner: [
          `Goal, ${t}, minute ${minute(e)}. Win probability near 90 and climbing. ${hero(c)}`,
          `${t} in minute ${minute(e)}. A low-xG dagger. ${hero(c)}`,
          `Minute ${minute(e)}, ${t}. Comeback odds are dust. ${hero(c)}`,
          `Late swing, ${t}. The market never saw it coming. ${hero(c)}`,
        ],
        consolation: [
          `${t} pull one back. The comeback stays priced long. ${hero(c)}`,
          `Goal, ${t}. Margin narrows, model barely moves. ${hero(c)}`,
          `Consolation numbers for ${t}. Ceiling stays low. ${hero(c)}`,
          `${t} score. Too far behind for the model to blink. ${hero(c)}`,
        ],
        plain: [
          `Goal, ${t}. Win probability just repriced sharply. ${hero(c)}`,
          `${t} score. Expected points change hands. ${hero(c)}`,
          `Goal, ${t}. xG said wait. The scoreboard didn't. ${hero(c)}`,
          `${t} convert. The table shuffles in real time. ${hero(c)}`,
        ],
      };
      return pick(pools[goalKind(e, c)], e.asOf);
    },
    goal_disallowed: (e) =>
      pick(
        [
          "Disallowed. Reverting the provisional settlement.",
          "No goal. Statistically, it never happened.",
          "Ruled out. All repricing rolls back to prior state.",
          "VAR overturn. The feed corrects, the ledger follows.",
          "Chalked off. Delta: zero. Carry on.",
          "No goal. Marginal calls go with the lines, not the noise.",
        ],
        e.asOf,
      ),
    red_card: (e, c) => {
      const t = side(e, c);
      const pools: Record<CardKind, string[]> = {
        leading: [
          `Red, ${t}. Holding a lead with ten drops the hold rate hard.`,
          `${t} to ten while ahead. Expect a deep block, thin corner volume.`,
          `Sending off. ${t} lead, but the model just shaved their edge.`,
        ],
        losing: [
          `Red, ${t}. Trailing with ten. Win probability rounds to zero.`,
          `${t} down a man, down a goal. Live odds go vertical.`,
          `Sending off while chasing. The comeback price just tripled.`,
        ],
        level: [
          `Red card, ${t}. Ten men costs about half a goal of xG.`,
          `${t} to ten. Every market moves against them now.`,
          `Sending off, ${t}. The board reprices in seconds.`,
        ],
      };
      return pick(pools[cardKind(e, c)], e.asOf);
    },
    yellow_card: (e, c) => {
      const t = side(e, c);
      const pools: Record<CardKind, string[]> = {
        leading: [
          `Yellow, ${t}. Leading teams foul more. Strategy, not accident.`,
          `Caution, ${t}. Game-state fouling. Card props love it.`,
          `Booking, ${t}. Protecting a lead costs a yellow a half.`,
        ],
        losing: [
          `Yellow, ${t}. Trailing sides pick up cards at twice the rate.`,
          `Caution while chasing. Desperation shows in the foul map.`,
          `Booking, ${t}. The pressure metrics said this was coming.`,
        ],
        level: [
          `Caution, ${t}. Logged. Card total ticks toward the over.`,
          `Yellow, ${t}. The booking market moves a tick.`,
          `Card noted, ${t}. The referee's baseline is set.`,
        ],
      };
      return pick(pools[cardKind(e, c)], e.asOf);
    },
    corner: (e, c) => {
      const t = side(e, c);
      return pick(
        [
          `Corner, ${t}. Roughly a 3 percent goal chance. Props update.`,
          `Corner ${t}. Count ticks toward the over.`,
          `Flag kick, ${t}. Corner rate running above the line.`,
          `Corner logged. Set pieces are where models go quiet.`,
          `Corner, ${t}. Priced small. Lands big when it lands.`,
          `Corner count up one. The over breathes.`,
        ],
        e.asOf,
      );
    },
    odds_swing: (e) => {
      const d = fmtDelta(e.delta);
      return pick(
        [
          `Consensus moved ${d} in one window. Notable.`,
          `${d} of implied probability just changed hands.`,
          `Sharp move: ${d}. That is not noise.`,
          `The line moves ${d}. Volume says conviction.`,
          `${d} swing. Models are chasing the tape now.`,
          `Reprice: ${d}. Watch the next five minutes.`,
        ],
        e.asOf,
      );
    },
    settlement: (e, c) =>
      pick(
        [
          `Settlement verified against the TxLINE Merkle proof. Receipt anchored. ${hero(c)}`,
          `Settled. Signed input, deterministic output. Argue with the math. ${hero(c)}`,
          `Books closed. Every pick graded off the feed. ${hero(c)}`,
          `Settlement complete. Final numbers posted. ${hero(c)}`,
          `Graded. The leaderboard is now historical fact. ${hero(c)}`,
          `Settled. Variance had its fun. Results are in. ${hero(c)}`,
        ],
        e.asOf,
      ),
    var_hold: (e) =>
      pick(
        [
          "Result held pending finality gate.",
          "Hold state. No settlement until the review clears.",
          "VAR window open. All grading paused.",
          "Pending. The feed confirms before we do.",
          "Review in progress. Provisional numbers only.",
          "Held. Uncertainty is priced in. Briefly.",
        ],
        e.asOf,
      ),
    kickoff: (e) =>
      pick(
        [
          "Match live. Prop generation running.",
          "Kickoff. Pre-match prices are history now.",
          "Underway. The live model takes over.",
          "Live. Every touch is data from here.",
          "Kickoff logged. Baseline odds locked.",
          "Game on. In-play markets open.",
        ],
        e.asOf,
      ),
    full_time: (e, c) => {
      const w = winner(c);
      const s = score(c);
      const pools: Record<FtKind, string[]> = {
        comfortable: [
          `Full time, ${s}. The model called this one early.`,
          `${s}. ${w} covered the margin with room to spare.`,
          `Over, ${s}. Comfortable, and the numbers agree.`,
        ],
        thriller: [
          `Full time, ${s}. One goal in it. Variance won today.`,
          `${s}. A coin flip that landed on its edge.`,
          `Final: ${s}. The tightest market stayed tight.`,
        ],
        draw: [
          `Full time, ${s}. The draw was the long price. It landed.`,
          `${s}. Stalemate. The unders cash.`,
          `Level at ${s}. Entropy wins again.`,
        ],
        unknown: [
          "Full time. Finality gate closing, settlement imminent.",
          "Whistle. Grading begins against the signed feed.",
          "Full time logged. Settlement queue running.",
        ],
      };
      return pick(pools[ftKind(c)], e.asOf);
    },
  },
};

const TRIGGER_PRIORITY: Record<string, 0 | 1 | 2> = {
  goal: 0,
  goal_disallowed: 0,
  settlement: 0,
  red_card: 1,
  odds_swing: 1,
  var_hold: 1,
  full_time: 1,
  kickoff: 1,
  yellow_card: 2,
  corner: 2,
};

/** Main entry: event in, spoken line out (or null for non-triggers). */
export function speak(
  e: MatchEvent | { type: "settlement" | "var_hold"; asOf: number; side?: null; delta?: null },
  ctx: OracleContext = {},
  persona: Persona = "announcer",
): OracleLine | null {
  const table = TEMPLATES[persona];
  const tmpl = table[e.type];
  if (!tmpl) return null;
  const text = tmpl(e as MatchEvent, ctx).trim();
  return {
    trigger: e.type,
    text,
    persona,
    priority: TRIGGER_PRIORITY[e.type] ?? 2,
  };
}
