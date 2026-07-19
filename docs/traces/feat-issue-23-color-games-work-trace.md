# feat/issue-23-color-games Work Trace

## 1) Planned Work

### TODO List
- [x] Research existing codebase and write implementation plan
- [x] Obtain user approval on implementation plan
- [x] Update `src/core/Router.ts` to support `/portal/:portalId` dynamic routes
- [x] Update `test/Router.test.ts` to verify portal routing
- [x] Update `index.html` to replace category pills with three portal cards
- [x] Add `data-portal` attributes to all game links in `index.html`
- [x] Add back button and update title/tagline elements in `index.html` header
- [x] Update `src/main.ts` to handle portal route navigation, header updates, and game filtering
- [x] Extract monolithic styles from `src/style.css` into 6 separate component-local stylesheets and import them in TypeScript
- [x] Implement enhanced portal selection card flairs & Tier 2 portal background animations in `src/style.css`
- [x] Add portal choice instructional message to lobby homepage and manage its visibility dynamically
- [x] Implement Switchboard, Luminary, and Mechanical Workshop busy boards
- [x] Review and align all busy board modules against their specifications:
  - [x] Add charging battery gauge to `TwoProngOutlet.ts` (022)
  - [x] Add looping synth arpeggio track to `AudioJack35mm.ts` (023)
  - [x] Lower click pitch to 180Hz (wood block) on `GearTrainTrio.ts` (021)
  - [x] Implement dual draggable nodes with distinct handle styles on `DualFingerGradient.ts` (020)
  - [x] Create brand new `RGBCanvasBlock.ts` (012b) and increase Luminary board grid to 5 columns to act as the central light block.
- [x] Verify implementation using Vitest, type checks, and manual validation
- [x] Core Registration & Integration
  - [x] Add droplet SVG icon to `src/ui/Icons.ts`
  - [x] Register `colorDropper` (Sutuy) and `colorMixer` (Maka) in `src/core/GameRegistry.ts`
  - [x] Add config and icon mapping to `src/main.ts`
  - [x] Add navigation list links to `index.html`
  - [x] Add background styling for `.cards-grid a[data-game="colorDropper"]` and update `colorMixer` styling in `src/style.css`
- [x] Game: Color Dropper (Sutuy)
  - [x] Create `src/games/colorDropper/ColorDropperGame.ts` from the original `ColorMixerGame.ts`
  - [x] Implement programmatic color mixing (weighted RGB averages based on RYB components)
  - [x] Implement nearest-color-name calculation (Euclidean distance lookup in RGB space) for translation and voice TTS
  - [x] Implement merge cooldown logic (800ms cooldown after split)
  - [x] Apply rendering optimizations (use custom flat shadows instead of canvas shadows, solid circles + bubble highlights instead of dynamic gradients, limit text rendering to large drops, use squared distances for collision tests, enforce 150-entity cap)
- [x] Game: Color Mixer (Maka)
  - [x] Create `src/games/colorMixer/ColorMixerGame.ts` from scratch
  - [x] Build top paint wells for Red, Yellow, Blue, White, Black, smudge tool, and trash button
  - [x] Implement offscreen `HTMLCanvasElement` buffer for paint layer
  - [x] Implement paint drop placement and copy-smear hand smudging
  - [x] Play squish/splat sounds and trigger light haptics on drawing/smearing
- [x] Verification & Testing
  - [x] Create unit tests in `test/ColorDropperGame.test.ts`
  - [x] Create unit tests in `test/ColorMixerGame.test.ts`
  - [x] Run `npm run test` to verify all tests pass
  - [x] Perform manual functional and performance testing in the browser

### File List
- **Core Registration & Routing**:
  - `src/core/Router.ts`
  - `src/core/GameRegistry.ts`
  - `src/main.ts`
  - `index.html`
- **Styling**:
  - `src/style.css`
  - `src/games/noButton/NoButtonGame.css`
  - `src/ui/GameHeader.css`
  - `src/ui/GameUI.css`
  - `src/ui/LoadingOverlay.css`
  - `src/ui/NotFound.css`
  - `src/ui/WinScreen.css`
  - `src/ui/Icons.ts`
- **Busy Board & Modules**:
  - `src/games/busyBoard/BoardModuleRegistry.ts`
  - `src/games/busyBoard/LuminaryBoardGame.ts`
  - `src/games/busyBoard/MechanicalWorkshopGame.ts`
  - `src/games/busyBoard/SwitchboardGame.ts`
  - `src/games/busyBoard/modules/RGBCanvasBlock.ts` [NEW]
  - Other modules in `src/games/busyBoard/modules/`
- **Color Games**:
  - `src/games/colorDropper/ColorDropperGame.ts` [NEW]
  - `src/games/colorMixer/ColorMixerGame.ts` [NEW/REPLACEMENT]
- **Tests**:
  - `test/Router.test.ts`
  - `test/LuminaryBoardGame.test.ts`
  - `test/MechanicalWorkshopGame.test.ts`
  - `test/SwitchboardGame.test.ts`
  - `test/ColorDropperGame.test.ts` [NEW]
  - `test/ColorMixerGame.test.ts` [NEW]

### Rationale
- Restructures Kipu lobby to support Play Portals (Sandbox, Workshop, Lab) for better organization.
- Implements thematic busy boards to provide high-fidelity sensory experiences.
- Aligns all busy board modules with their technical specifications.
- `src/games/colorDropper/ColorDropperGame.ts`: Physics-based drop mixing game with programmatic color blending, split recombination delay, and canvas performance optimizations.
- `src/games/colorMixer/ColorMixerGame.ts`: Standard non-physics canvas hand-mixing experience mimicking oil paint smudging and blending on a ceramic palette.
- Tests verify correctness and prevent regression across both game registries and custom engines.

---

## 2) In Progress Work
- None (all tasks completed)

---

## 3) Completed Work

### Summary
- **Routing & Navigation**: Restructured lobby home page in `index.html` and `src/main.ts` to show portals (Sandbox, Workshop, Lab). Dynamically handles dynamic portal routes, exit redirects, back button visibility, and header text.
- **CSS Modularization**: Extracted monolithic styles from `src/style.css` into 6 separate local stylesheets for cleaner maintenance.
- **Thematic Busy Boards**: Implemented three full-screen scrollable busy boards (`SwitchboardGame`, `LuminaryBoardGame`, `MechanicalWorkshopGame`) loaded with 28 highly interactive sensory widgets.
- **Specification Alignment**:
  - **Two-Prong Outlet**: Added a glowing battery gauge in the top-right corner that charges dynamically with a white lightning bolt when plugged, and drains/turns red when unplugged.
  - **3.5mm Audio Jack**: Connected a continuous, looping synth melody arpeggio that plays while connected.
  - **Gear Train Trio**: Lowered rotation click frequency to ~180Hz (hollow wood block clicking).
  - **Dual-Finger Gradient**: Updated handles to support two independent draggable points (`p1` and `p2`) with glowing outer handle indicators.
  - **RGB Central Light**: Added the `RGBCanvasBlock` module next to the Red, Green, and Blue sliders on a new 5-column grid layout, acting as the central mixed light block with high-intensity glass dome rendering and custom spark animations.
- **Droplet SVG Icon**: Added `droplet` SVG path into the central `Icons.ts` registry.
- **Integration**: Added navigation links in `index.html`, added hero configurations and icon mapping in `main.ts`, registered both `colorDropper` (Sutuy) and `colorMixer` (Maka) in `GameRegistry.ts` under the Workshop portal, and styled card background colors in `style.css`.
- **Color Dropper (Sutuy)**: Renamed and adapted the physics-based color dropping game to compute combined colors programmatically via RYB-weighted RGB interpolation, with a Euclidean distance color matching lookup for speech translation names. Added a split recombination delay of 800ms using a merge cooldown tracking field. Optimised drop rendering by utilizing simple flat offset shadow circles, solid color fills with a glassy bubble highlight arc overlay, threshold text labels, and squared distance collision checks. Enforced a max entity limit of 150 drops with oldest non-dragging drop recycling.
- **Color Mixer (Maka)**: Re-scaffolded the Color Mixer game from scratch to offer an authentic paint palette mixing experience. Created a UI palette with Red, Yellow, Blue, White, Black paint wells, a smudge tool, and a trash bin clear button. Managed an offscreen HTMLCanvasElement buffer to hold paint layers. Implemented drop painting and highly realistic copy-smear smudge dragging, using linear step interpolation for seamless smear paths. Integrated haptic feedback and speed-dependent click synth plucks.
- **Testing**: Added full Vitest test suites in `test/ColorDropperGame.test.ts` and `test/ColorMixerGame.test.ts` to verify functionality and integration correctness, passing all 61 tests without TS errors.

---

## 4) Issues and Out of Scope
- None
