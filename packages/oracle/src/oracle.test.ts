import { test } from "node:test";
import assert from "node:assert/strict";
import { speak, type OracleContext, type Persona } from "./oracle.js";
import type { MatchEvent } from "@kick/shared";

const goal: MatchEvent = {
  type: "goal",
  fixtureId: 1,
  side: "home",
  player: null,
  clockSeconds: 4200,
  delta: null,
  asOf: 1000,
};

const PERSONAS: Persona[] = ["announcer", "gaffer", "analyst"];

const TEAMS: OracleContext = { homeTeam: "Brazil", awayTeam: "Argentina" };

/** Score contexts that exercise every branch of every branched trigger. */
const SCORE_CONTEXTS: OracleContext[] = [
  {}, // no score info: plain / unknown branches
  { homeScore: 1, awayScore: 0 }, // opener / leading / thriller
  { homeScore: 1, awayScore: 1 }, // equaliser / level / draw
  { homeScore: 2, awayScore: 1 }, // plain / leading / thriller
  { homeScore: 1, awayScore: 3 }, // consolation / losing / comfortable
  { homeScore: 3, awayScore: 0 }, // leading / comfortable
];

const EVENTS: MatchEvent[] = [
  goal,
  { ...goal, clockSeconds: 5340 }, // minute 89: late-winner territory
  { ...goal, type: "yellow_card" },
  { ...goal, type: "red_card" },
  { ...goal, type: "corner" },
  { ...goal, type: "odds_swing", delta: 12 },
  { ...goal, type: "odds_swing", delta: -7 },
  { ...goal, type: "goal_disallowed" },
  { ...goal, type: "kickoff" },
  { ...goal, type: "full_time" },
];

/** Every (persona, trigger, context, seed) output the engine can produce. */
function sweep(): { persona: Persona; trigger: string; text: string }[] {
  const out: { persona: Persona; trigger: string; text: string }[] = [];
  for (const p of PERSONAS) {
    for (const e of EVENTS) {
      for (const sc of SCORE_CONTEXTS) {
        for (let seed = 0; seed < 12; seed++) {
          const ctx = { ...TEAMS, ...sc, heroName: "dylan", heroPoints: 50 };
          const line = speak({ ...e, asOf: seed }, ctx, p);
          if (line) out.push({ persona: p, trigger: e.type, text: line.text });
        }
      }
    }
    for (const t of ["settlement", "var_hold"] as const) {
      for (let seed = 0; seed < 12; seed++) {
        const line = speak({ type: t, asOf: seed }, { ...TEAMS, wreckedCount: 3 }, p);
        if (line) out.push({ persona: p, trigger: t, text: line.text });
      }
    }
  }
  return out;
}

test("goal produces priority-0 line with team + hero", () => {
  const line = speak(goal, { homeTeam: "Brazil", heroName: "dylan", heroPoints: 50 });
  assert.ok(line);
  assert.equal(line.priority, 0);
  assert.match(line.text, /Brazil/);
  assert.match(line.text, /dylan/);
});

test("same event same seed = same line (deterministic replay)", () => {
  const a = speak(goal, { homeTeam: "Brazil" });
  const b = speak(goal, { homeTeam: "Brazil" });
  assert.equal(a!.text, b!.text);
});

test("settlement lines carry the verified-data attitude somewhere in the pool", () => {
  for (const p of PERSONAS) {
    const pool = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      const line = speak({ type: "settlement", asOf: seed }, {}, p);
      assert.ok(line);
      pool.add(line.text);
    }
    const joined = [...pool].join(" ");
    assert.match(joined, /chain|signed|verified|proof/i, `no proof attitude in ${p} settlement pool`);
  }
});

test("NO em-dashes in any template output (golden rule)", () => {
  for (const { persona, trigger, text } of sweep()) {
    assert.ok(!text.includes("—"), `em-dash in ${persona}/${trigger}: ${text}`);
  }
});

test("every line is TTS-friendly: under 140 chars", () => {
  for (const { persona, trigger, text } of sweep()) {
    assert.ok(text.length < 140, `too long (${text.length}) in ${persona}/${trigger}: ${text}`);
  }
});

test("at least 6 distinct variants per persona x trigger", () => {
  const pools = new Map<string, Set<string>>();
  for (const { persona, trigger, text } of sweep()) {
    const key = `${persona}/${trigger}`;
    if (!pools.has(key)) pools.set(key, new Set());
    pools.get(key)!.add(text);
  }
  for (const [key, set] of pools) {
    assert.ok(set.size >= 6, `${key} has only ${set.size} variants`);
  }
});

test("goal lines are context-aware: opener, equaliser, late winner, consolation all differ", () => {
  for (const p of PERSONAS) {
    const at = (ctx: OracleContext, clockSeconds = 4200) =>
      speak({ ...goal, clockSeconds, asOf: 0 }, { ...TEAMS, ...ctx }, p)!.text;
    const opener = at({ homeScore: 1, awayScore: 0 });
    const equaliser = at({ homeScore: 1, awayScore: 1 });
    const lateWinner = at({ homeScore: 2, awayScore: 1 }, 5340);
    const consolation = at({ homeScore: 1, awayScore: 3 });
    const distinct = new Set([opener, equaliser, lateWinner, consolation]);
    assert.equal(distinct.size, 4, `${p} goal branches collide: ${[...distinct].join(" | ")}`);
  }
});

test("card lines read differently for a leading team vs a losing team", () => {
  for (const p of PERSONAS) {
    for (const type of ["yellow_card", "red_card"] as const) {
      const at = (ctx: OracleContext) => speak({ ...goal, type, asOf: 0 }, { ...TEAMS, ...ctx }, p)!.text;
      const leading = at({ homeScore: 2, awayScore: 0 });
      const losing = at({ homeScore: 0, awayScore: 2 });
      assert.notEqual(leading, losing, `${p}/${type} same line when leading and losing`);
    }
  }
});

test("full time reads differently for a comfortable win, a one-goal thriller, and a draw", () => {
  for (const p of PERSONAS) {
    const at = (ctx: OracleContext) =>
      speak({ ...goal, type: "full_time", asOf: 0 }, { ...TEAMS, ...ctx }, p)!.text;
    const comfortable = at({ homeScore: 3, awayScore: 0 });
    const thriller = at({ homeScore: 2, awayScore: 1 });
    const draw = at({ homeScore: 1, awayScore: 1 });
    const distinct = new Set([comfortable, thriller, draw]);
    assert.equal(distinct.size, 3, `${p} full_time branches collide`);
  }
});

test("no stiff-AI tells in any line", () => {
  const tells = /\bit seems\b|\binterestingly\b|\bwhat a moment\b|\bnotably\b|\bfurthermore\b/i;
  for (const { persona, trigger, text } of sweep()) {
    assert.ok(!tells.test(text), `AI tell in ${persona}/${trigger}: ${text}`);
  }
});
