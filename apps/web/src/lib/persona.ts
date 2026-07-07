/* ── Oracle persona selection ──
   The Locker's voice cosmetics pick which pundit calls the match. Choice is
   per-browser (localStorage), read by the terrace for TTS delivery and the
   Oracle bubble label. SSR-safe: server always answers the default. */

/* Mirrors `Persona` in packages/oracle/src/oracle.ts. Redeclared locally
   because apps/web does not depend on @kick/oracle (lines are generated
   server-side by the ingest worker); keep the two unions in sync. */
export type Persona = "gaffer" | "announcer" | "analyst";

const STORAGE_KEY = "kick-oracle-persona";
const DEFAULT_PERSONA: Persona = "gaffer";

const ALL: readonly Persona[] = ["gaffer", "announcer", "analyst"];

function isPersona(v: unknown): v is Persona {
  return typeof v === "string" && (ALL as readonly string[]).includes(v);
}

/** Selected persona, or the default off the server / a fresh browser. */
export function getPersona(): Persona {
  if (typeof window === "undefined") return DEFAULT_PERSONA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isPersona(raw) ? raw : DEFAULT_PERSONA;
  } catch {
    return DEFAULT_PERSONA;
  }
}

export function setPersona(p: Persona): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, p);
  } catch {
    /* private mode etc: selection just won't persist */
  }
}

/** TTS delivery per persona: the gaffer growls low and unhurried, the
    announcer runs hot and fast, the analyst stays measured. */
export function personaDelivery(p: Persona): { rate: number; pitch: number } {
  switch (p) {
    case "announcer":
      return { rate: 1.12, pitch: 1.0 };
    case "analyst":
      return { rate: 1.0, pitch: 0.9 };
    default:
      return { rate: 0.98, pitch: 0.82 };
  }
}

/** Display name for the Oracle bubble header. */
export function personaLabel(p: Persona): string {
  switch (p) {
    case "announcer":
      return "THE ANNOUNCER";
    case "analyst":
      return "THE ANALYST";
    default:
      return "THE GAFFER";
  }
}

/** One-line audition per persona, spoken when a voice is equipped. */
export function personaPreview(p: Persona): string {
  switch (p) {
    case "announcer":
      return "GOAL ENERGY, ALL NIGHT! You just hired the loudest man in the stadium!";
    case "analyst":
      return "Analyst voice active. From here, every touch is data.";
    default:
      return "Right then. The Gaffer's on the mic. Earn your points.";
  }
}
