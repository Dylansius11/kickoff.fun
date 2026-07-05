import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* ── Minimal .env loader ──
   Walks up from this module toward the repo root looking for a `.env` and
   fills process.env with any keys not already set (real env always wins).
   No dotenv dependency; the file format we own is plain KEY=VALUE lines. */

export function loadRootEnv(): void {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const raw = readFileSync(join(dir, ".env"), "utf8");
      for (const line of raw.split("\n")) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
        if (!m) continue;
        const key = m[1]!;
        let val = m[2]!;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
      return;
    } catch {
      /* not here; climb */
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
