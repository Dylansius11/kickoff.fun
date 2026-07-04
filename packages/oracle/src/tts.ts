/* ── Provider-agnostic TTS ──
   Browser fallback (speechSynthesis) ships first and can never be blocked;
   ElevenLabs is the premium voice swapped in via env. The interface stays
   identical so the demo never depends on a paid API being up. */

export interface TtsProvider {
  /** Returns a playable audio URL (object URL or remote), or null when the
      provider speaks directly (browser speechSynthesis). */
  speak(text: string, voice?: string): Promise<string | null>;
}

/** Browser-native, free, offline. Speaks immediately; returns null. */
export class BrowserTts implements TtsProvider {
  async speak(text: string, voice?: string): Promise<null> {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      const match = window.speechSynthesis.getVoices().find((v) => v.name.includes(voice));
      if (match) u.voice = match;
    }
    u.rate = 1.12;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
    return null;
  }
}

/** ElevenLabs Flash (server-side): returns an audio URL for the client. */
export class ElevenLabsTts implements TtsProvider {
  constructor(
    private apiKey: string,
    private voiceId: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async speak(text: string): Promise<string | null> {
    const res = await this.fetchImpl(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: { "xi-api-key": this.apiKey, "content-type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
      },
    );
    if (!res.ok) return null; // caller falls back to BrowserTts
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
}
