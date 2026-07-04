import { test } from "node:test";
import assert from "node:assert/strict";
import { diffStates, detectOddsSwing } from "./diff.js";
import { judge } from "./finality.js";
import type { MatchState } from "./types.js";

const base: MatchState = {
  fixtureId: 1,
  home: "BRA",
  away: "ARG",
  homeScore: 0,
  awayScore: 0,
  phase: "first_half",
  clockSeconds: 600,
  stats: { corners_home: 2 },
  asOf: 1000,
};

test("goal detected from score delta", () => {
  const next = { ...base, homeScore: 1, asOf: 2000 };
  const ev = diffStates(base, next);
  assert.equal(ev.length, 1);
  assert.equal(ev[0]!.type, "goal");
  assert.equal(ev[0]!.side, "home");
});

test("VAR chalk-off detected from score decrease", () => {
  const scored = { ...base, homeScore: 1, asOf: 2000 };
  const reversed = { ...scored, homeScore: 0, asOf: 3000 };
  const ev = diffStates(scored, reversed);
  assert.equal(ev[0]!.type, "goal_disallowed");
});

test("corner increments produce one event each", () => {
  const next = { ...base, stats: { corners_home: 4 }, asOf: 2000 };
  const ev = diffStates(base, next);
  assert.equal(ev.filter((e) => e.type === "corner").length, 2);
});

test("phase change to full_time emits event", () => {
  const next = { ...base, phase: "full_time" as const, asOf: 2000 };
  const ev = diffStates(base, next);
  assert.equal(ev[0]!.type, "full_time");
});

test("odds swing threshold", () => {
  assert.equal(detectOddsSwing(0.4, 0.44, 1, 1000), null);
  const swing = detectOddsSwing(0.4, 0.55, 1, 1000);
  assert.equal(swing?.type, "odds_swing");
  assert.ok(Math.abs((swing?.delta ?? 0) - 15) < 1e-9);
});

test("finality gate: pending then final; reverted on chalk-off", () => {
  const goal = diffStates(base, { ...base, homeScore: 1, asOf: 2000 })[0]!;
  const cand = { key: "goal:home:1", event: goal, seenAt: 2000 };
  assert.equal(judge(cand, [], 10_000), "pending");
  assert.equal(judge(cand, [], 2000 + 90_000), "final");
  const chalkOff = diffStates(
    { ...base, homeScore: 1, asOf: 2000 },
    { ...base, homeScore: 0, asOf: 5000 },
  )[0]!;
  assert.equal(judge(cand, [chalkOff], 2000 + 90_000), "reverted");
});
