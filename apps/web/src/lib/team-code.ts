/* 3-letter FIFA-style codes for common WC 2026 teams; fallback = first 3 letters.
   Shared by the lobby, the create flow, the terrace header, and the room-code
   generator on the server. */

export const COUNTRY_CODE: Record<string, string> = {
  brazil: "BRA",
  norway: "NOR",
  mexico: "MEX",
  england: "ENG",
  portugal: "POR",
  spain: "ESP",
  argentina: "ARG",
  france: "FRA",
  morocco: "MAR",
  japan: "JPN",
  usa: "USA",
  nigeria: "NGA",
  germany: "GER",
  netherlands: "NED",
  italy: "ITA",
  colombia: "COL",
  ghana: "GHA",
  paraguay: "PAR",
  australia: "AUS",
  belgium: "BEL",
  egypt: "EGY",
  switzerland: "SUI",
};

export function teamCode(name: string): string {
  const key = name.trim().toLowerCase();
  return (
    COUNTRY_CODE[key] ??
    name
      .trim()
      .replace(/[^a-z]/gi, "")
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, "X")
  );
}
