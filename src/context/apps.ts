export const APP_CONTEXTS = ["general", "netflix", "notes", "code"] as const;
export type AppContext = (typeof APP_CONTEXTS)[number];

/**
 * Step 4 will bind these to real overlay controls.
 * Step 3 only *names* the future action so recognition can be judged in-context.
 */
export const INTENT_PREVIEW: Record<AppContext, Record<string, string>> = {
  general: {
    pinch: "select / click (later)",
    point: "move focus (later)",
    open_palm: "idle / cancel (later)",
    fist: "grab (later)",
    peace: "secondary action (later)",
    thumbs_up: "confirm (later)",
  },
  netflix: {
    pinch: "play / pause",
    point: "scrub / hover title",
    open_palm: "browse / pause hover",
    fist: "stop / back",
    peace: "skip intro (later)",
    thumbs_up: "thumbs up rating",
  },
  notes: {
    pinch: "drop cursor / tap",
    point: "move caret",
    open_palm: "palm erase / cancel",
    fist: "hold selection",
    peace: "two-finger scroll (later)",
    thumbs_up: "accept dictation",
  },
  code: {
    pinch: "click in editor",
    point: "move cursor",
    open_palm: "escape / blur",
    fist: "block select",
    peace: "split / next tab (later)",
    thumbs_up: "accept copilot-style suggest",
  },
};

export function previewIntent(ctx: AppContext, gesture: string): string {
  return INTENT_PREVIEW[ctx][gesture] ?? "no mapping yet";
}
