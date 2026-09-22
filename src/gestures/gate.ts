import type { GestureName, GestureScore } from "./geometry";

/** Ambiguous band: geometry is guessing, not sure. That's when Jev is worth a call. */
export function shouldAskJev(sample: GestureScore): boolean {
  if (sample.name === "none") return false;
  if (sample.confidence >= 0.78) return false;
  if (sample.confidence < 0.32 && sample.name === "unknown") return false;
  return sample.confidence < 0.78;
}

export function topLabels(sample: GestureScore, k = 3): GestureName[] {
  return (Object.entries(sample.scores) as [GestureName, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([name]) => name);
}
