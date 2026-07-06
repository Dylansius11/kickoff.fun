/* Client-side identity memory. The join/create room APIs mint a users row
   (guest or wallet-backed) and return its id; we pin that id in localStorage
   so guests keep their pick history across visits in this browser. Wallet
   users are resolved by wallet_pubkey instead, the stored id is a fallback. */

const KEY = "kick-user-id";

/** The users.id this browser last played as, or null. */
export function storedUserId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Remember a users.id returned by a rooms API response. No-op for junk. */
export function rememberUserId(id: unknown): void {
  if (typeof id !== "string" || id.length < 16) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode etc: history simply stays empty */
  }
}
