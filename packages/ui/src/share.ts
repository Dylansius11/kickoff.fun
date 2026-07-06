"use client";

import { toBlob } from "html-to-image";

/**
 * One-click share of the full-time card to X: text AND image, every platform.
 *
 * The x.com intent URL cannot attach an image, so the cascade is:
 *
 *  1. "sheet"     Mobile with Web Share Level 2 (iOS Safari, Android Chrome):
 *                 capture the card PNG, open the OS share sheet with
 *                 { files, text }. User picks X; image and caption arrive
 *                 attached. The sheet IS the composer, nothing else opens.
 *  2. "clipboard" Desktop (Chrome 105+, Edge, Safari 13.1+): write the PNG
 *                 to the clipboard, then open the X intent composer with the
 *                 caption prefilled. The user pastes (Ctrl+V / Cmd+V) and the
 *                 image lands in the post. Safari quirk handled: the
 *                 ClipboardItem must be constructed SYNCHRONOUSLY inside the
 *                 user gesture with a Promise<Blob> value; awaiting the
 *                 capture before clipboard.write() loses transient activation
 *                 and Safari rejects with NotAllowedError.
 *  3. "download"  Clipboard unavailable or refused (Firefox has no image
 *                 clipboard write): download the PNG, then open the X intent
 *                 composer. User attaches the downloaded file.
 *
 * Every branch ends with a composer or share sheet open. To dodge popup
 * blockers on the async branches, the composer window is pre-opened
 * synchronously in the gesture and navigated once the image work resolves.
 */

export type SharePath = "sheet" | "clipboard" | "download";

const CARD_BG = "#080b09";
const FILE_NAME = "kickfun-fulltime.png";
/** Below this the PNG is almost certainly a blank/black capture. */
const MIN_PLAUSIBLE_BYTES = 20_000;

/** Two animation frames + a beat, so springs and layout have settled and the
 *  clone html-to-image takes matches what the user sees (a mid-transform or
 *  mid-opacity capture comes out shifted, faded, or blank). */
async function settle(ms = 300): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await new Promise<void>((r) => window.setTimeout(r, ms));
}

/** Snapshot a DOM node to a PNG blob. ShareCard is dark and self-contained
 *  (inline SVG accessories, next/font faces already in the document), so a
 *  straight html-to-image capture is clean. pixelRatio 2 keeps the pixel
 *  type crisp when the 320px card lands on a retina feed.
 *  Elements marked data-no-capture (looping sheen sweeps, confetti) are
 *  excluded: snapshotting them mid-animation smears the image. */
export async function captureNode(el: HTMLElement): Promise<Blob> {
  const blob = await toBlob(el, {
    pixelRatio: 2,
    backgroundColor: CARD_BG,
    cacheBust: true,
    filter: (node) => !(node instanceof Element && node.hasAttribute("data-no-capture")),
    // The captured root must never carry an entrance transform or fade.
    style: { opacity: "1", transform: "none" },
  });
  if (!blob) throw new Error("capture produced no image");
  if (blob.size < MIN_PLAUSIBLE_BYTES) {
    console.warn(
      `[kick/share] captured PNG is suspiciously small (${blob.size} bytes); the card may have rendered blank`,
    );
  }
  return blob;
}

async function settleAndCapture(el: HTMLElement): Promise<Blob> {
  await settle();
  return captureNode(el);
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // give the browser a beat to start the download before revoking
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/** X intent composer with the caption prefilled. */
export function openXIntent(text: string) {
  window.open(xIntentUrl(text), "_blank", "noopener,noreferrer,width=560,height=640");
}

/** WhatsApp share link (kept for future placements; not in the primary UI). */
export function waLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Can this browser hand a PNG file to the OS share sheet? Checked with a
 *  synchronous dummy file so no capture work is spent finding out. */
function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function" || !navigator.share) return false;
  try {
    const probe = new File([new Uint8Array(8)], FILE_NAME, { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** One click, both halves. MUST be called directly from a user gesture
 *  (click handler, no awaits before it), or Safari's clipboard write and the
 *  share sheet both lose transient activation. Returns which path ran so the
 *  UI can show the matching hint. */
export async function shareToX({ el, text }: { el: HTMLElement; text: string }): Promise<SharePath> {
  /* ── Path 1: OS share sheet (mobile). The sheet call tolerates the short
     capture await; transient activation windows are seconds, not frames. */
  if (canShareFiles()) {
    let blob: Blob | null = null;
    try {
      blob = await settleAndCapture(el);
    } catch {
      blob = null;
    }
    if (blob) {
      const file = new File([blob], FILE_NAME, { type: "image/png" });
      const payload: ShareData = { files: [file], text };
      if (navigator.canShare?.(payload)) {
        try {
          await navigator.share(payload);
          return "sheet";
        } catch (err) {
          // user dismissed the sheet: their call, do not re-fire elsewhere
          if (err instanceof DOMException && err.name === "AbortError") return "sheet";
          // otherwise fall through to the desktop cascade below
        }
      }
    }
    // capture or share failed on a share-capable device: keep going, the
    // clipboard/download cascade still delivers both halves.
  }

  /* ── Desktop cascade. Pre-open the composer window NOW, synchronously in
     the gesture, so popup blockers never eat it; navigate it when ready.
     (No `noopener` in the feature string: that makes window.open return
     null. Severing the opener by hand gives the same isolation.) */
  const composer = window.open("about:blank", "_blank", "width=560,height=640");
  if (composer) composer.opener = null;
  const openComposer = () => {
    if (composer && !composer.closed) composer.location.href = xIntentUrl(text);
    else openXIntent(text);
  };

  /* ── Path 2: clipboard. Safari pattern: build the ClipboardItem around the
     PENDING capture promise and call clipboard.write() before any await. */
  const blobPromise = settleAndCapture(el);
  // hold the rejection so a capture failure can't surface as unhandled
  blobPromise.catch(() => {});
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({ "image/png": blobPromise });
      await navigator.clipboard.write([item]);
      openComposer();
      return "clipboard";
    } catch {
      // permission denied, Firefox, or capture failure: fall to download
    }
  }

  /* ── Path 3: download + composer. */
  try {
    const blob = await blobPromise;
    downloadBlob(blob, FILE_NAME);
  } catch {
    // even with no image, the composer still opens with the caption
  }
  openComposer();
  return "download";
}

/** @deprecated use shareToX; kept so older call sites keep compiling. */
export async function shareCard(args: { el: HTMLElement; text: string }): Promise<SharePath> {
  return shareToX(args);
}
