export type VoiceStatus = "idle" | "listening" | "unsupported" | "denied";

export interface VoiceEvent {
  transcript: string;
  final: boolean;
}

export class VoiceListener {
  private rec: {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((ev: { error: string }) => void) | null;
    onresult: ((ev: {
      resultIndex: number;
      results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }>;
    }) => void) | null;
    start(): void;
    stop(): void;
  } | null = null;
  status: VoiceStatus = "idle";
  transcript = "";
  private onEvent: ((e: VoiceEvent) => void) | null = null;

  start(onEvent: (e: VoiceEvent) => void): VoiceStatus {
    this.onEvent = onEvent;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      this.status = "unsupported";
      return this.status;
    }

    this.rec = new Ctor();
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.rec.lang = "en-US";
    this.rec.onstart = () => {
      this.status = "listening";
    };
    this.rec.onerror = (ev) => {
      if (ev.error === "not-allowed") this.status = "denied";
    };
    this.rec.onend = () => {
      if (this.status === "listening") {
        try {
          this.rec?.start();
        } catch {
          /* already started */
        }
      }
    };
    this.rec.onresult = (ev) => {
      let interim = "";
      let finals = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i];
        if (!piece) continue;
        if (piece.isFinal) finals += piece[0]?.transcript ?? "";
        else interim += piece[0]?.transcript ?? "";
      }
      const text = (finals || interim).trim();
      this.transcript = text;
      this.onEvent?.({ transcript: text, final: Boolean(finals) });
    };

    try {
      this.rec.start();
      this.status = "listening";
    } catch {
      this.status = "idle";
    }
    return this.status;
  }

  stop(): void {
    this.status = "idle";
    this.rec?.stop();
    this.rec = null;
  }
}

export function parseVoiceCommand(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  if (/\b(demo|simulate)\b/.test(t)) return "demo";
  if (/\b(camera|live|webcam)\b/.test(t)) return "camera";
  if (/\b(skeleton|bones)\b/.test(t)) return "toggle-skeleton";
  if (/\b(trail)s?\b/.test(t)) return "toggle-trails";
  if (/\bmirror\b/.test(t)) return "toggle-mirror";
  return null;
}
