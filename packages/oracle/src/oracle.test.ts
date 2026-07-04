import { test } from "node:test";
import assert from "node:assert/strict";
import { speak } from "./oracle.js";
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

test("settlement line mentions verification, no em-dash anywhere", () => {
  const line = speak({ type: "settlement", asOf: 5 }, {}, "gaffer");
  assert.ok(line);
  assert.match(line.text, /chain/i);
});

test("NO em-dashes in any template output (golden rule)", () => {
  const personas = ["announcer", "gaffer", "analyst"] as const;
  const events = [
    goal,
    { ...goal, type: "yellow_card" as const },
    { ...goal, type: "red_card" as const },
    { ...goal, type: "corner" as const },
    { ...goal, type: "odds_swing" as const, delta: 12 },
    { ...goal, type: "goal_disallowed" as const },
    { ...goal, type: "kickoff" as const },
    { ...goal, type: "full_time" as const },
  ];
  for (const p of personas) {
    for (const e of events) {
      const line = speak(e, { homeTeam: "Brazil", awayTeam: "Argentina", heroName: "x", heroPoints: 10 }, p);
      if (line) assert.ok(!line.text.includes("—"), `em-dash in ${p}/${e.type}: ${line.text}`);
    }
    for (const t of ["settlement", "var_hold"] as const) {
      const line = speak({ type: t, asOf: 1 }, {}, p);
      if (line) assert.ok(!line.text.includes("—"), `em-dash in ${p}/${t}`);
    }
  }
});
