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
- **Busy Board & Modules**:
  - `src/games/busyBoard/BoardModuleRegistry.ts`
  - `src/games/busyBoard/LuminaryBoardGame.ts`
  - `src/games/busyBoard/MechanicalWorkshopGame.ts`
  - `src/games/busyBoard/SwitchboardGame.ts`
  - `src/games/busyBoard/modules/RGBCanvasBlock.ts` [NEW]
  - Other modules in `src/games/busyBoard/modules/`
- **Tests**:
  - `test/Router.test.ts`
  - `test/LuminaryBoardGame.test.ts`
  - `test/MechanicalWorkshopGame.test.ts`
  - `test/SwitchboardGame.test.ts`

### Rationale
- Restructures Kipu lobby to support Play Portals (Sandbox, Workshop, Lab) for better organization.
- Implements thematic busy boards to provide high-fidelity sensory experiences.
- Aligns all busy board modules with their technical specifications (battery gauges, independent controls, looping sound tracks, proper sound frequencies, and a central light block display).

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

---

## 4) Issues and Out of Scope
- None
