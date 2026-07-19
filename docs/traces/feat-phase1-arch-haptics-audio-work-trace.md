# Work Trace: Phase 1 Architecture Hardening, Haptics Fix, & Audio Revamp

## 1. Planned Work

### TODO List
- [x] Install `@capacitor/core` and `@capacitor/haptics`
- [x] Refactor `HapticController.ts` for native iOS haptics
- [x] Revamp `AudioController.ts` for unified Audio Sprite and high-fidelity SynthEngine
- [x] Refactor `SoundBoardGame.ts` and `SoundMemoryGame.ts` to use synth notes instead of oscillators
- [x] Extract `GameRegistry.ts` from `main.ts`
- [x] Fix memory/resize listener leak in `main.ts`
- [x] Implement `Preloader.ts` audio loading
- [x] Implement visual `WinScreen.ts`
- [x] Update `build.yml` with `npm test`

### File List
- **core/**
  - `HapticController.ts` (Modify): Bridge to Capacitor Haptics.
  - `AudioController.ts` (Modify): Support high-fidelity Web Audio synthesis & routing.
  - `Game.ts` (Modify): Add dynamic lifecycle methods.
  - `Preloader.ts` (Modify): Load audio with fetch.
  - `GameRegistry.ts` (New): Centralize game metadata.
- **ui/**
  - `WinScreen.ts` (Modify): Implement overlay HTML/CSS/JS and canvas confetti.
- **games/**
  - `soundBoard/SoundBoardGame.ts` (Modify): Transition from oscillators to SynthEngine and fix coordinate translation.
  - `soundMemory/SoundMemoryGame.ts` (Modify): Transition to SynthEngine, clean active timeouts.
- **infrastructure & config**
  - `main.ts` (Modify): Clean routing, fix resize listener leaks, integrate registry.
  - `.github/workflows/build.yml` (Modify): Add CI testing.
  - `vite.config.ts` (Modify): Add setupFiles for Vitest.
  - `package.json` / `package-lock.json` (Modify): Add Capacitor dependencies.
  - `test/setup.ts` (New): Mock Capacitor Haptics for existing test coverage.

### Rationale
- **HapticController.ts**: Fix iOS vibration failure by bridging to native Capacitor.
- **AudioController.ts**: Replace dry oscillators with rich physical synthesis models (bells, string plucks, clicks).
- **GameRegistry.ts**: Decouple router and game setup, improving maintainability.
- **WinScreen.ts**: Real UI confetti component to celebrate completions.
- **main.ts**: Prevent memory leaks by cleaning up window handlers.
- **test/setup.ts**: Bridge Capacitor Haptics mock to `navigator.vibrate` to ensure backwards compatibility of test files.

---

## 2. In Progress Work
- None

---

## 3. Completed Work
- **Capacitor Integration**: Installed `@capacitor/core` and `@capacitor/haptics` and updated `HapticController.ts`.
- **Synth Engine & SoundBoard**: Created `SynthEngine` inside `AudioController.ts` to offer bell, pluck, drum, click, and chime presets. Updated `SoundBoardGame.ts` to trigger synth sounds.
- **Simon Pitch Fix & Timeouts**: Refactored `SoundMemoryGame.ts` with custom synth pitches (Do, Re, Mi, Sol) and introduced timeout lifecycle tracking to prevent SPA memory leaks.
- **Coordinate Correction**: Solved the hit-testing viewport bug in `SoundBoardGame` by incorporating canvas `getBoundingClientRect` translation.
- **Win Celebration Overlay**: Built `WinScreen.ts` overlay with dynamic high-fidelity canvas confetti, custom SVG star illustration, responsive scaling, and audio/haptic rewards.
- **CI Test Automation**: Added `npm run test` step to `.github/workflows/build.yml` and successfully ran 39 passing unit tests locally using the global `@capacitor/haptics` bridge mock.

---

## 4. Issues and Out of Scope
- None
