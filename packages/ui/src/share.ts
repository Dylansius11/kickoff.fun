"use client";

import { toBlob } from "html-to-image";

/** How the share resolved: native share sheet, or the desktop fallback
 *  (PNG download + X intent composer). */
export type SharePath = "sheet" | "fallback";

const CARD_BG = "#080b09";
const FILE_NAME = "kickfun-fulltime.png";

/** Snapshot a DOM node to a PNG blob. ShareCard is dark, self-contained
 *  (inline SVG accessories, next/font faces already in the document), so a
 *  straight html-to-image capture is clean. pixelRatio 2 keeps the pixel
 *  type crisp when the 320px card lands on a retina feed. */
export async function captureNode(el: HTMLElement): Promise<Blob> {
  const blob = await toBlob(el, {
    pixelRatio: 2,
    backgroundColor: CARD_BG,
    cacheBust: true,
  });
  if (!blob) throw new Error("capture produced no image");
  return blob;
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

/** X intent composer with the caption prefilled (the desktop path). */
export function openXIntent(text: string) {
  const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer,width=560,height=640");
}

/** WhatsApp share link for an explicit WA button. */
export function waLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Share the rendered card as an image.
 *  Mobile: navigator.share with the PNG file, so the OS sheet offers
 *  WhatsApp, Instagram, X, and everything else installed.
 *  Desktop (or capture failure): download the PNG and open the X composer
 *  with the caption, so the user still gets both halves. */
export async function shareCard({ el, text }: { el: HTMLElement; text: string }): Promise<SharePath> {
  let blob: Blob | null = null;
  try {
    blob = await captureNode(el);
  } catch {
    blob = null;
  }

  if (blob) {
    const file = new File([blob], FILE_NAME, { type: "image/png" });
    const payload: ShareData = { files: [file], text };
    if (typeof navigator !== "undefined" && navigator.canShare?.(payload) && navigator.share) {
      try {
        await navigator.share(payload);
        return "sheet";
      } catch (err) {
        // user dismissed the sheet: do not double-fire the fallback
        if (err instanceof DOMException && err.name === "AbortError") return "sheet";
        // otherwise fall through to the desktop path
      }
    }
    downloadBlob(blob, FILE_NAME);
  }

  openXIntent(text);
  return "fallback";
}
