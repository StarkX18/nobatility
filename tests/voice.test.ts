import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src/voice/speech";

describe("parseVoiceCommand", () => {
  it("maps spoken phrases onto overlay commands", () => {
    expect(parseVoiceCommand("please start the demo")).toBe("demo");
    expect(parseVoiceCommand("switch to camera")).toBe("camera");
    expect(parseVoiceCommand("show skeleton")).toBe("toggle-skeleton");
    expect(parseVoiceCommand("hide trails")).toBe("toggle-trails");
    expect(parseVoiceCommand("mirror")).toBe("toggle-mirror");
    expect(parseVoiceCommand("calibrate the screen")).toBe("calibrate");
    expect(parseVoiceCommand("reset calibration")).toBe("reset-cal");
    expect(parseVoiceCommand("next")).toBe("next");
  });

  it("ignores unrelated speech", () => {
    expect(parseVoiceCommand("open safari")).toBeNull();
    expect(parseVoiceCommand("")).toBeNull();
  });
});
