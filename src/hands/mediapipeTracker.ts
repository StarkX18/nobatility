import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { LandmarkSmoother } from "../smoothing";
import type { TrackedHand } from "../types";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class MediaPipeHands {
  private landmarker: HandLandmarker | null = null;
  private smoother = new LandmarkSmoother();
  private lastVideoTime = -1;

  async load(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
  }

  reset(): void {
    this.smoother.reset();
    this.lastVideoTime = -1;
  }

  detect(video: HTMLVideoElement, t: number): TrackedHand[] {
    if (!this.landmarker) return [];
    if (video.readyState < 2) return [];
    if (video.currentTime === this.lastVideoTime) return [];
    this.lastVideoTime = video.currentTime;

    const result = this.landmarker.detectForVideo(video, t * 1000);
    const hands: TrackedHand[] = [];

    for (let i = 0; i < result.landmarks.length; i++) {
      const raw = result.landmarks[i];
      if (!raw) continue;
      const handed = result.handedness[i]?.[0];
      // Selfie cameras are mirrored; MediaPipe labels in image space.
      // After we mirror for display, swap labels so "Right" matches the user's right hand.
      const labelled = handed?.categoryName === "Left" ? "Right" : "Left";
      const side = labelled as TrackedHand["side"];
      const smoothed = this.smoother.smoothHand(
        `${side}-${i}`,
        raw.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        t,
      );
      const worldRaw = result.worldLandmarks[i];
      const world = worldRaw
        ? this.smoother.smoothHand(
            `world-${side}-${i}`,
            worldRaw.map((p) => ({ x: p.x, y: p.y, z: p.z })),
            t,
          )
        : undefined;
      hands.push({
        side,
        landmarks: smoothed,
        world,
        score: handed?.score ?? 0,
      });
    }

    return hands;
  }
}
