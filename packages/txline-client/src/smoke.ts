/* Live smoke test: guest session against TxLINE devnet.
   Run: pnpm --filter @kick/txline-client smoke */
import { TxLineClient } from "./client.js";

const base = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com";
const client = new TxLineClient({ baseUrl: base });

const jwt = await client.startGuestSession();
console.log(`guest session OK against ${base}`);
console.log(`jwt length: ${jwt.length}, starts: ${jwt.slice(0, 12)}...`);
