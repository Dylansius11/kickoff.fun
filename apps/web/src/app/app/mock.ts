/* Mock matchday data for the demo build. Realistic World Cup 2026 content. */

export const YOU = "pixelpele";

export interface Terrace {
  code: string;
  name: string;
  fixture: string;
  members: string[];
  live: boolean;
}

export const MY_TERRACES: Terrace[] = [
  {
    code: "QPR7",
    name: "North Stand Lads",
    fixture: "BRA v ARG",
    members: ["pixelpele", "var_lord", "gaffer_joe", "tiki_taka_tim"],
    live: true,
  },
  {
    code: "KFD2",
    name: "Sunday League Rejects",
    fixture: "FRA v ESP",
    members: ["pixelpele", "nutmeg_nia", "offside_ollie"],
    live: false,
  },
  {
    code: "ZLW9",
    name: "The Gaffer's Office",
    fixture: "MAR v JPN",
    members: ["pixelpele", "gaffer_joe", "clean_sheet_carl", "xg_merchant", "top_bins_tara"],
    live: false,
  },
];

export interface Fixture {
  home: string;
  away: string;
  kickoff: string;
  status: "upcoming" | "live" | "final";
  round: string;
}

export const FIXTURES: Fixture[] = [
  { home: "BRA", away: "ARG", kickoff: "LIVE", status: "live", round: "Round of 16" },
  { home: "FRA", away: "ESP", kickoff: "19:00", status: "upcoming", round: "Round of 16" },
  { home: "MAR", away: "JPN", kickoff: "21:30", status: "upcoming", round: "Round of 16" },
  { home: "USA", away: "NGA", kickoff: "FT", status: "final", round: "Round of 16" },
];

export interface BoardRow {
  rank: number;
  name: string;
  points: number;
  streak?: number;
  you?: boolean;
}

export const ROOM_BOARD: BoardRow[] = [
  { rank: 1, name: "var_lord", points: 340, streak: 6 },
  { rank: 2, name: "gaffer_joe", points: 285, streak: 2 },
  { rank: 3, name: "pixelpele", points: 260, streak: 4, you: true },
  { rank: 4, name: "tiki_taka_tim", points: 195 },
  { rank: 5, name: "nutmeg_nia", points: 140, streak: 1 },
  { rank: 6, name: "offside_ollie", points: 85 },
];

export const GLOBAL_BOARD: BoardRow[] = [
  { rank: 1, name: "var_lord", points: 12480, streak: 9 },
  { rank: 2, name: "xg_merchant", points: 11930, streak: 3 },
  { rank: 3, name: "pixelpele", points: 11205, streak: 4, you: true },
  { rank: 4, name: "gaffer_joe", points: 10850, streak: 2 },
  { rank: 5, name: "top_bins_tara", points: 9990, streak: 5 },
  { rank: 6, name: "tiki_taka_tim", points: 9410 },
  { rank: 7, name: "nutmeg_nia", points: 8875, streak: 1 },
  { rank: 8, name: "clean_sheet_carl", points: 8320 },
  { rank: 9, name: "offside_ollie", points: 7740, streak: 2 },
  { rank: 10, name: "false_nine_finn", points: 7115 },
  { rank: 11, name: "row_z_ricky", points: 6480 },
  { rank: 12, name: "panenka_pri", points: 5920, streak: 1 },
];

export interface Cosmetic {
  name: string;
  kind: "voice" | "skin" | "badge";
  cost: number;
  unlocked: boolean;
}

export const COSMETICS: Cosmetic[] = [
  { name: "THE GAFFER voice", kind: "voice", cost: 0, unlocked: true },
  { name: "Calm Analyst voice", kind: "voice", cost: 2500, unlocked: false },
  { name: "Chalk Frame", kind: "skin", cost: 1200, unlocked: true },
  { name: "VAR Static skin", kind: "skin", cost: 3000, unlocked: false },
  { name: "Golden Boot badge", kind: "badge", cost: 5000, unlocked: false },
  { name: "Terrace Founder badge", kind: "badge", cost: 800, unlocked: true },
];

export const ORACLE_LINES = {
  idle: "Seventy eight on the clock. Brazil knocking on the door, Argentina hanging on by their studs.",
  pick: "Bold call. Lock it in before the ref makes it for you.",
  lock: "Window's shut. No takebacks, that's your call on the record.",
  goal: "GOOOAL! Brazil! That just wrecked half the terrace, but somebody called it. Top of the table, take a bow.",
  settle: "That result? Verified. Signed by TxLINE, locked on-chain. Nobody's rigging this one.",
};
