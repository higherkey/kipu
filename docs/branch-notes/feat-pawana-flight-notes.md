# Branch Notes: feat/pawana-flight

## 1. Discoveries & Deviations
- **Game Name & Concept**: **Pawana** ("The Flight Path / Wing / Flying Place" in Quechua), an educational Flappy Bird-style logic flight game located in the **Lab** portal.
- **Split-Gate Logic**: Incorporates dual-choice gates (Option A vs. Option B) and choice-vs-empty gates where passing through empty sky ("nothing") avoids a distractor and is the correct flight action.
- **Multi-Curriculum**: Includes Numbers (counting / skip counting / sums), Spelling (Andean nature & animal words), and Shapes/Colors (pattern sequence continuation).
- **Roster & Progression**: 4 unlockable Andean flyers (Q'inti, Pisqu, Kuntur, Wayra) with progression saved to `localStorage`.
- **Pre-Audit Invariants**: Fully aligned with `/frontend-ui-engineering-slim`, `/accessibility-and-a11y-slim`, `/doubt-driven-development-slim`, and `/test-driven-development-slim`.

## 2. Blockers & Risks (4a)
- None. Full test suite (38 test files, 201 tests) passing at 100%. Production build compiles with zero TypeScript errors.

## 3. Quick Wins (4b)
- Extended `BaseGame` to reuse global audio and haptics controllers seamlessly.
- Bounded 1500ms invulnerability and rounded hitboxes prevent frustrating multi-frame collisions.
- Full keyboard parity (`Space` / `ArrowUp` to flap, `Escape` to pause) alongside single-touch interaction.
- Resolved 15 adversarial peer review findings:
  1. Fixed choice-vs-empty text assignment in numbers skip-counting mode.
  2. Fixed choice-vs-empty text assignment in spelling mode.
  3. Added one-shot latch (`hasWonRound`) to prevent victory modal re-triggering on subsequent gates after score 10.
  4. Added dynamic clamping to split-gate gap positions guaranteeing >=45px middle pillar and floor clearance.
  5. Added Space key guard in menu state to prevent hijacking interactive button selection.
  6. Tuned invulnerability alpha strobing to <=2 Hz with constant alpha fallback under `prefers-reduced-motion`.
  7. Implemented persistent high score tracking (`kipu_pawana_highscores_v1`) across menu, HUD, and victory modals.
  8. Hooked `isWobbling` to visual wobble rotation on flyer collision.
  9. Added `aria-modal="true"` to all modal dialog containers.
  10. Added `aria-disabled="true"` to locked flyer roster cards.
  11. Added `role="status"` to HUD pills.
  12. Synchronized top HUD prompt when a gate passes the flyer without collision.
  13. Added `.pawana-diff-btn:focus-visible` to focus indicator styles.
  14. Fixed card selector in `src/style.css` to target `#game-list` and `.cards-grid`.
  15. Registered `pawana: 'feather'` in `iconMap` in `src/main.ts`.
- **Wind Gust Hazard System (Wayra Drafts)**: Short-lived (2.2-3s) random updrafts/downdrafts with clear 2.0s visual lead-time warning banners, directional animated chevrons across the flight corridor, and wind stream particles.
- **Dynamic Day/Night Andean Sky Cycle**: Procedurally blends canvas gradients from morning sun to midday alpine blue, golden Inti sunset, and starlit Andean night as score progresses.
- **Adversarial Peer Review Hardening & Quality Gate Audit**:
  16. Registered `pop` audio sound in `PawanaGame` constructor ensuring sound plays on cold-start navigations.
  17. Added `role="status"` to `.pawana-hud-prompt` in addition to `aria-live="polite"` for comprehensive screen-reader coverage.
  18. Adjusted `.pawana-overlay-container` in `PawanaGame.css` to `top: 60px; height: calc(100% - 60px);` to frame under the fixed global `#game-header`.
  19. Froze wind dash offset and wave displacement during active wind gusts when `prefers-reduced-motion` is active.
  20. Interpolated horizon color stop between sunset orange and dark night indigo at `p = 0.75` eliminating sky gradient flash.
  21. Scaled `gapHeight` and `minMiddlePillar` proportionally on short viewports to prevent floor collisions in mobile landscape.
  22. Added `.pawana-wind-banner.hidden { display: none; }` to `PawanaGame.css`.
  23. Implemented programmatic focus shifting to primary action buttons upon mounting game-over, victory, and pause modals.
  24. Dynamically mapped spelling `stepIndex` across cumulative word lengths preventing desynchronization across multi-word boundaries.
  25. Dynamically scaled victory round score threshold based on curriculum difficulty (8 on easy, 10 on normal, 12 on hard).

## 4. Deferred Items (4c)
- **TTS Word Pronunciation for Spelling Mode**: Voice readout of Quechua/Andean words upon gate sequence completion using `AudioController.speak()`.

