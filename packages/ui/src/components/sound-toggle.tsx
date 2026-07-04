"use client";

import * as React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "../lib/utils";
import { sound, type SfxName } from "../sound";

/** React handle to the singleton engine. */
export function useSound() {
  const [enabled, setEnabled] = React.useState(sound.enabled);
  const toggle = React.useCallback(() => {
    const next = !sound.enabled;
    sound.setEnabled(next); // called inside the click gesture: unlocks AudioContext
    if (next) {
      sound.startCrowd();
      sound.play("tap");
    }
    setEnabled(next);
  }, []);
  const play = React.useCallback((name: SfxName) => sound.play(name), []);
  const roar = React.useCallback(() => sound.roar(), []);
  return { enabled, toggle, play, roar };
}

export function SoundToggle({ className }: { className?: string }) {
  const { enabled, toggle } = useSound();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Mute sound" : "Enable sound"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-card border-2 transition-colors",
        enabled
          ? "border-pitch-700 bg-pitch/10 text-win"
          : "border-border-strong bg-surface-2 text-text-muted hover:text-text-dim",
        className,
      )}
    >
      {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}
