import type { AppContext } from "../context/apps";
import { classifyHands, GestureHold, type GestureName, type GestureScore } from "./geometry";
import { shouldAskJev } from "./gate";
import { createJevClient, mergeJev, type JevClient, type JevSource } from "../jev/client";
import type { TrackedHand } from "../types";

export interface Recognition {
  name: GestureName;
  confidence: number;
  source: JevSource;
  askedJev: boolean;
  stable: boolean;
  geometry: GestureScore;
  context: AppContext;
}

export class GestureEngine {
  private hold = new GestureHold(10);
  private jev: JevClient;
  private lastAsk = 0;
  private inFlight = false;
  private jevName: GestureName | null = null;
  private jevSource: JevSource = "skipped";

  constructor(client?: JevClient) {
    this.jev = client ?? createJevClient(import.meta.env.VITE_TYPESAFE_API_KEY);
  }

  get jevReady(): boolean {
    return this.jev.available;
  }

  reset(): void {
    this.hold.reset();
    this.jevName = null;
    this.jevSource = "skipped";
  }

  /**
   * Geometry every frame. Jev at most ~2 Hz, and only in the uncertain band.
   */
  observe(hands: TrackedHand[], context: AppContext, nowMs: number): Recognition {
    const geometry = classifyHands(hands);
    const held = this.hold.push(geometry);
    const ask = held.stable && shouldAskJev(held);

    if (ask && !this.inFlight && nowMs - this.lastAsk > 450) {
      this.lastAsk = nowMs;
      this.inFlight = true;
      void this.jev
        .classify({ sample: held, context })
        .then((res) => {
          const merged = mergeJev(held, res);
          this.jevName = merged.name;
          this.jevSource = merged.source;
        })
        .catch(() => {
          this.jevSource = "skipped";
        })
        .finally(() => {
          this.inFlight = false;
        });
    }

    if (!ask) {
      this.jevName = null;
      this.jevSource = "skipped";
    }

    const name = ask && this.jevName ? this.jevName : held.name;
    const source: JevSource = ask ? this.jevSource : "skipped";

    return {
      name,
      confidence: held.confidence,
      source,
      askedJev: ask,
      stable: held.stable,
      geometry: held,
      context,
    };
  }
}
