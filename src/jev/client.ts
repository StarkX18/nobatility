import type { GestureName, GestureScore } from "../gestures/geometry";
import { topLabels } from "../gestures/gate";
import type { AppContext } from "../context/apps";

export interface JevChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities?: Record<string, number>;
}

export interface JevResponse {
  gesture: JevChoiceAnswer;
}

export interface JevAsk {
  sample: GestureScore;
  context: AppContext;
}

export interface JevClient {
  available: boolean;
  classify(ask: JevAsk): Promise<JevResponse | null>;
}

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

function compactState(ask: JevAsk): string {
  const f = ask.sample.features;
  return JSON.stringify({
    context: ask.context,
    geometry: {
      name: ask.sample.name,
      confidence: Number(ask.sample.confidence.toFixed(3)),
      top: topLabels(ask.sample),
      pinch: f ? Number(f.pinch.toFixed(3)) : null,
      extended: f?.extended ?? null,
    },
  });
}

export class HttpJevClient implements JevClient {
  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  async classify(ask: JevAsk): Promise<JevResponse | null> {
    if (!this.apiKey) return null;
    const body = {
      model: "jev-latest",
      state: compactState(ask),
      questions: {
        gesture: {
          type: "choice",
          instructions:
            "Which hand gesture is being performed? Prefer the geometry hint when it is strong; break ties using finger flags.",
          options: ["pinch", "point", "open_palm", "fist", "peace", "thumbs_up", "unknown"],
        },
      },
    };
    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      gesture?: { type: string; choice?: string; confidence?: number; probabilities?: Record<string, number> };
    };
    const g = json.gesture;
    if (!g?.choice) return null;
    return {
      gesture: {
        type: "choice",
        choice: g.choice,
        confidence: g.confidence ?? 0.5,
        probabilities: g.probabilities,
      },
    };
  }
}

/**
 * Offline stand-in: same contract as Jev, but a second geometric opinion.
 * Used when no API key is set so the gate still has a second voter for tests/demo.
 */
export class LocalTieBreakClient implements JevClient {
  available = true;

  async classify(ask: JevAsk): Promise<JevResponse> {
    const ranked = (Object.entries(ask.sample.scores) as [GestureName, number][]).sort(
      (a, b) => b[1] - a[1],
    );
    const best = ranked[0];
    const second = ranked[1];
    const pick = best && second && best[1] - second[1] < 0.08 ? second[0] : (best?.[0] ?? "unknown");
    return {
      gesture: {
        type: "choice",
        choice: pick,
        confidence: best?.[1] ?? 0.4,
      },
    };
  }
}

export function createJevClient(apiKey?: string): JevClient {
  const key = apiKey?.trim();
  if (key) return new HttpJevClient(key);
  return new LocalTieBreakClient();
}

export type JevSource = "geometry" | "jev" | "skipped";

export function mergeJev(geometry: GestureScore, jev: JevResponse | null): { name: GestureName; source: JevSource } {
  if (!jev) return { name: geometry.name, source: "skipped" };
  const choice = jev.gesture.choice as GestureName;
  if (geometry.confidence >= 0.78) return { name: geometry.name, source: "geometry" };
  if (choice === geometry.name) return { name: geometry.name, source: "geometry" };
  if (jev.gesture.confidence + 0.05 >= geometry.confidence) {
    return { name: choice, source: "jev" };
  }
  return { name: geometry.name, source: "geometry" };
}
