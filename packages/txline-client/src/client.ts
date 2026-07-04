import { z } from "zod";

/* ── TxLINE REST + SSE client ──
   Auth flow (confirmed from official quickstart):
     1. POST /auth/guest/start            -> { token } guest JWT (30 days)
     2. on-chain `subscribe` (service keypair, free tier)
     3. POST /api/token/activate          -> API token
     4. data calls: Authorization: Bearer {jwt} + X-Api-Token: {apiToken}

   Endpoint paths under /api are inferred from the docs index and MUST be
   confirmed against https://txline.txodds.com/docs/docs.yaml (Q from
   INTEGRATIONS.md). Every path lives in the PATHS table below so fixing a
   wrong path is a one-line change. */

/* Paths confirmed live July 4 2026 (fixtures + odds verified against the real
   devnet API via the official example scripts). Stream/proof paths still to
   confirm against docs.yaml. */
export const PATHS = {
  guestStart: "/auth/guest/start",
  tokenActivate: "/api/token/activate",
  fixtures: "/api/fixtures/snapshot", // ?competitionId=72&startEpochDay=NNNNN (World Cup = 72)
  oddsSnapshot: "/api/odds/snapshot", // + /{fixtureId}
  oddsStream: "/api/odds/stream",
  scoresSnapshot: "/api/scores/snapshot",
  scoresStream: "/api/scores/stream",
  scoresProof: "/api/scores/proof",
} as const;

/** World Cup 2026 competition id on TxLINE. */
export const WORLD_CUP_COMPETITION_ID = 72;

const GuestSession = z.object({ token: z.string() });

export interface TxLineConfig {
  baseUrl: string; // e.g. https://txline-dev.txodds.com
  jwt?: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
}

export class TxLineClient {
  private jwt?: string;
  private apiToken?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: TxLineConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.jwt = cfg.jwt;
    this.apiToken = cfg.apiToken;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  /* ── auth ── */

  async startGuestSession(): Promise<string> {
    const res = await this.fetchImpl(`${this.baseUrl}${PATHS.guestStart}`, { method: "POST" });
    if (!res.ok) throw new TxLineError("guest session failed", res.status);
    this.jwt = GuestSession.parse(await res.json()).token;
    return this.jwt;
  }

  /** Activate the API token after the on-chain subscribe.
      `signedMessage` = signature over (subscribeTxSig + leagueIds + jwt),
      produced by the service keypair (see INTEGRATIONS.md). */
  async activateToken(body: Record<string, unknown>): Promise<string> {
    const res = await this.fetchImpl(`${this.baseUrl}${PATHS.tokenActivate}`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new TxLineError("token activation failed", res.status);
    const json = (await res.json()) as { apiToken?: string; token?: string };
    this.apiToken = json.apiToken ?? json.token;
    if (!this.apiToken) throw new TxLineError("no api token in activation response", 500);
    return this.apiToken;
  }

  setTokens(jwt: string, apiToken: string) {
    this.jwt = jwt;
    this.apiToken = apiToken;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.jwt) h.Authorization = `Bearer ${this.jwt}`;
    if (this.apiToken) h["X-Api-Token"] = this.apiToken;
    return h;
  }

  /* ── REST ── raw JSON; normalization to @kick/shared happens in ingest. */

  async get<T = unknown>(path: string, query?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
    const res = await this.fetchImpl(url, { headers: this.headers() });
    if (!res.ok) throw new TxLineError(`GET ${path} failed`, res.status);
    return (await res.json()) as T;
  }

  fixtures(query?: Record<string, string | number>) {
    return this.get(PATHS.fixtures, { competitionId: WORLD_CUP_COMPETITION_ID, ...query });
  }
  scoresSnapshot(fixtureId: number) {
    return this.get(`${PATHS.scoresSnapshot}/${fixtureId}`);
  }
  oddsSnapshot(fixtureId: number) {
    return this.get(`${PATHS.oddsSnapshot}/${fixtureId}`);
  }
  /** Validation proof for on-chain settlement (shape per tx-on-chain docs). */
  scoresProof(fixtureId: number, ts?: number) {
    return this.get(PATHS.scoresProof, ts ? { fixtureId, ts } : { fixtureId });
  }

  /* ── SSE ── minimal parser over fetch streaming; auto-reconnect with
     backoff belongs to the caller (ingest) so tests stay deterministic. */

  async *stream(path: string, query?: Record<string, string | number>, signal?: AbortSignal): AsyncGenerator<TxLineSseEvent> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
    const res = await this.fetchImpl(url, {
      headers: { ...this.headers(), accept: "text/event-stream" },
      signal,
    });
    if (!res.ok || !res.body) throw new TxLineError(`SSE ${path} failed`, res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = parseSse(raw);
        if (ev) yield ev;
      }
    }
  }

  scoresStream(fixtureId: number, signal?: AbortSignal) {
    return this.stream(PATHS.scoresStream, { fixtureId }, signal);
  }
  oddsStream(fixtureId: number, signal?: AbortSignal) {
    return this.stream(PATHS.oddsStream, { fixtureId }, signal);
  }
}

export interface TxLineSseEvent {
  event: string;
  data: unknown;
  id?: string;
}

export function parseSse(block: string): TxLineSseEvent | null {
  let event = "message";
  let id: string | undefined;
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    else if (line.startsWith("id:")) id = line.slice(3).trim();
  }
  if (dataLines.length === 0) return null;
  const rawData = dataLines.join("\n");
  let data: unknown = rawData;
  try {
    data = JSON.parse(rawData);
  } catch {
    /* keep as string */
  }
  return { event, data, id };
}

export class TxLineError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(`${message} (${status})`);
  }
}
