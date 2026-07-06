/* Terrace invite links + the per-session "already joined" guard.
   A shared invite URL drops a mate straight into the room; the sessionStorage
   flag stops the terrace page from re-joining on every mount. */

export function inviteUrl(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://kick.fun";
  return `${origin}/app/terrace/${code.toUpperCase()}`;
}

const KEY = (code: string) => `kick-joined-${code.toUpperCase()}`;

/** Mark this browser session as a member of the terrace (skip auto-join). */
export function markJoined(code: string): void {
  try {
    sessionStorage.setItem(KEY(code), "1");
  } catch {
    /* private mode etc: auto-join stays idempotent server-side */
  }
}

/** Has this session already joined (or created) the terrace? */
export function hasJoined(code: string): boolean {
  try {
    return sessionStorage.getItem(KEY(code)) === "1";
  } catch {
    return false;
  }
}
