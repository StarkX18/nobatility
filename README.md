# Nobatility

Far-field **finger + voice** overlay for a Mac. Not a single cursor: up to **ten fingertip pointers**, skeletons, trails, voice, and a **4-corner display fit** in the same family as Apple Head Pointer.

## What you get today

- **Demo mode** — two kinematic hands, all 10 named pointers, no camera required
- **Camera mode** — MediaPipe Hand Landmarker, 21 points per hand, two hands
- **Calibration** — point your index at four on-screen marks and hold; we solve a homography from camera space onto this window and remember it
- **Overlay** — per-finger color, labels, trails, pinch rings
- **Voice** — “calibrate”, “demo”, “camera”, “skeleton”, “trails”, “mirror”, “reset calibration”
- **Smoothing** — One Euro filter on live landmarks

Controlling Finder, clicking, dragging, and accessibility APIs are still out of scope.

## Run it on your Mac

Chrome or Edge (MediaPipe WASM). Safari can run **demo** and calibration; live hands want Chromium.

```bash
npm install
npm test
npm run dev
```

Fullscreen the tab (`Control-Command-F`). Stand where you’ll actually use it, hit **Camera**, then **Calibrate**.

### Fit the display

Uncalibrated mapping is only a selfie-mirror plus a guessed inset — it will not match your distance or screen. Calibration is the Head Pointer trick:

1. Four marks appear: top-left, top-right, bottom-right, bottom-left.
2. Point your **index finger** at the glow (from your seat, as if touching that corner) and **hold still** ~1s. Pinch, click the mark, or press `Space` to lock early.
3. After four corners, a homography maps that reach onto the window. Status reads **fitted to display**. Saved in `localStorage`.

In **Demo**, the wizard parks a right index on each mark so you can see the flow without a camera.

| Key | Action |
| --- | --- |
| `k` | Calibrate / cancel |
| `Space` | Lock current corner |
| `Escape` | Cancel calibration |
| `d` | Demo |
| `c` | Camera |
| `s` / `t` / `m` | Skeleton / trails / mirror |

**Reset fit** returns to the default inset map.

Everything runs **on device**.

## How this compares to Head Pointer

| Head Pointer | This |
| --- | --- |
| Face / head pose | Hands, 21 landmarks each |
| One pointer | Ten fingertip pointers |
| System-wide accessibility cursor | In-page overlay (no event injection yet) |
| Move to each edge / corner | Index dwell on four marks → homography |
| Heavy smoothing | One Euro on each landmark |

## What it would take to actually drive the Mac

1. **Native overlay** — `NSPanel` over all Spaces, click-through.
2. **Vision** — `VNDetectHumanHandPoseRequest`, or keep MediaPipe in a helper.
3. **Control policy** — dominant index = pointer, pinch = click; other eight stay visual/gestures.
4. **Voice** — `SFSpeechRecognizer` → Accessibility / `CGEvent`.
5. **Permissions** — Camera, Microphone, Accessibility.

## Repo layout

```
src/hands/          demo, MediaPipe, calibration guide pose
src/render/         canvas overlay + corner marks
src/calibration.ts  dwell session + localStorage
src/homography.ts   4-point DLT
src/mapping.ts      default inset map or fitted homography
src/voice/
```
