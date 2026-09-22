# Nobatility

Far-field **finger + voice** overlay for a Mac. Not a single cursor: ten fingertip pointers, then (on other branches) calibration, then **gesture recognition**. Controlling Netflix / Notes / a code editor is **step 4** and is not in this branch.

## Roadmap

1. **Hand visuals** — `main`. Ten pointers, skeleton, trails.
2. **Calibration** — separate branch. Reverted on `main` until the fit is actually good.
3. **This branch — recognition** — geometry does the work; **Jev** (TypeSafe System One) is only asked when the geometry is in the uncertain band. App context (Netflix / notes / code) only *names* the future action.
4. **Use cases** — later: overlay on the real app and bind those names to hand controls.

## Recognition (step 3)

Every frame:

1. Scale-free features: pinch / hand-size, which fingers are extended.
2. Soft scores for `pinch`, `point`, `open_palm`, `fist`, `peace`, `thumbs_up`.
3. A 10-frame hold so a twitch is not a gesture.
4. **Skip Jev** if confidence is high or there are no hands.
5. **Ask Jev** only in the mid-confidence band (~2 Hz), with a compact JSON state (finger flags + top labels + app context). No API key → a local tie-break voter with the same interface.

Set `VITE_TYPESAFE_API_KEY` for live `POST https://api.typesafe.ai/v1/systemone`.

Demo **Pose** (`g`) cycles pinch / point / palm / fist / peace so you can see the HUD without a camera. **App** (`a`) cycles general → netflix → notes → code and shows a preview string only.

## Run

```bash
npm install
npm test
npm run dev
```

| Key | Action |
| --- | --- |
| `g` | Cycle demo pose |
| `a` | Cycle app context |
| `d` / `c` | Demo / camera |
| `s` / `t` / `m` | Skeleton / trails / mirror |

## Repo layout

```
src/gestures/   geometry, hold, Jev gate, engine
src/jev/        TypeSafe client + local fallback
src/context/    Netflix / notes / code intent previews (no control yet)
src/hands/      demo + MediaPipe
src/render/
```
