# Branch Notes: feat/kinetic-sandbox-prototype

## 1. Discoveries & Deviations
- **Adversarial Quality Review Fixes**:
  - **GameLoop Milliseconds Normalization**: Discovered that `GameLoop` passes `dt` in milliseconds (~16.67ms). Added `dtSec` normalization and clamping `[0.001, 0.05]` to prevent physics over-speed.
  - **Newton's Cradle Separation Geometry**: Reconciled collision logic to account for spaced suspension pivots ($X = \text{startX} + i \cdot \text{ballSpacing}$), resolving collision detection at $\theta_1 \ge \theta_2$.
  - **Buffer Teardown on Unmount**: Implemented explicit `destroy()` methods on `HourglassInverter` (clearing `sandGrains`), `PlinkoFunnel` (clearing `balls` and `pegs`), `NewtonsCradle` (clearing `balls`), and `BellowsPump` (clearing `particles`).
  - **Division by Zero Protection**: Added `safeMw = Math.max(1, mw)` to prevent `NaN` coordinates when viewport or cell width is zero/uninitialized.
  - **Degenerate Peg Distance Safety**: Guarded zero-distance collision normal vectors in `PlinkoFunnel`.
- **Node 20.17 Environment Compatibility**: Pinned `jsdom: ^26.0.0` and installed `@rolldown/binding-win32-x64-msvc` to bypass ESM `require()` conflicts from newer `@exodus/bytes` on Node 20.17.
- **Frontend UI Engineering**: Minimum touch targets $\ge 44\times 44\text{px}$, deterministic pointer teardown, zero inline styles, zero `!important`.

## 2. Blockers & Risks (4a)
- None. All 36 test suites / 181 unit tests green. `tsc --noEmit` and Vite production build pass cleanly.

## 3. Quick Wins (4b)
- Reusable sound fallbacks via SynthEngine / Web Audio oscillator ticks when audio files are offline.

## 4. Deferred Items (4c)
- Remaining Board 6 modules (053 Iron Filing Magnet, 056 Box Tilt-Pad, 059 Sand Rake, 060 Conveyor Crank) for future post-prototype expansion.
