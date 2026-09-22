import { describe, expect, it } from "vitest";
import { posedHand } from "../src/hands/demoHands";
import { classifyHand } from "../src/gestures/geometry";
import { GestureEngine } from "../src/gestures/engine";
import { HttpJevClient, LocalTieBreakClient, mergeJev } from "../src/jev/client";
import { previewIntent } from "../src/context/apps";

describe("Jev client", () => {
  it("posts a typed choice question when a key is present", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const client = new HttpJevClient("test-key", async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          gesture: { type: "choice", choice: "pinch", confidence: 0.81 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const sample = classifyHand(posedHand("Right", "pinch", { x: 0.4, y: 0.5 }));
    const res = await client.classify({ sample, context: "netflix" });
    expect(res?.gesture.choice).toBe("pinch");
    expect(calls[0]?.url).toContain("api.typesafe.ai");
    const body = calls[0]?.body as { questions: { gesture: { type: string } }; state: string };
    expect(body.questions.gesture.type).toBe("choice");
    expect(body.state).toContain("netflix");
  });

  it("keeps geometry when it is already sure", () => {
    const merged = mergeJev(
      { name: "open_palm", confidence: 0.9, scores: { open_palm: 0.9 }, features: null },
      { gesture: { type: "choice", choice: "fist", confidence: 0.95 } },
    );
    expect(merged).toEqual({ name: "open_palm", source: "geometry" });
  });

  it("lets Jev break a weak tie", () => {
    const merged = mergeJev(
      { name: "point", confidence: 0.48, scores: { point: 0.5, peace: 0.46 }, features: null },
      { gesture: { type: "choice", choice: "peace", confidence: 0.7 } },
    );
    expect(merged.source).toBe("jev");
    expect(merged.name).toBe("peace");
  });
});

describe("engine", () => {
  it("does not call Jev while a pinch is geometrically obvious", async () => {
    let calls = 0;
    const client = {
      available: true,
      classify: async () => {
        calls += 1;
        return { gesture: { type: "choice" as const, choice: "pinch", confidence: 0.8 } };
      },
    };
    const engine = new GestureEngine(client);
    const hand = posedHand("Right", "pinch", { x: 0.4, y: 0.5 });
    for (let i = 0; i < 16; i++) {
      engine.observe([hand], "general", i * 16);
    }
    await Promise.resolve();
    expect(calls).toBe(0);
  });

  it("uses the same contract offline without an API key", async () => {
    const sample = classifyHand(posedHand("Right", "point", { x: 0.4, y: 0.5 }));
    const local = new LocalTieBreakClient();
    const res = await local.classify({ sample, context: "code" });
    expect(res.gesture.type).toBe("choice");
    expect(res.gesture.choice).toBeTruthy();
  });
});

describe("context preview", () => {
  it("names future Netflix / notes / code actions without executing them", () => {
    expect(previewIntent("netflix", "pinch")).toMatch(/play/i);
    expect(previewIntent("notes", "point")).toMatch(/caret/i);
    expect(previewIntent("code", "open_palm")).toMatch(/escape/i);
  });
});
