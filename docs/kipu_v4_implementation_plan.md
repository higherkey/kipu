# Kipu v4: Master Implementation Plan

> Synthesized from the v4 Master Plan, Architecture Blueprint, New Games List, and Technical Spec — updated after Senior Architect plan review and Phase 1 completion.

---

## Current State Summary

| Metric | Status |
|--------|--------|
| **Games implemented** | 9 playable (Poka, Eeno, Tapa, Maka, Nuko, Sound Memory, Marble Pipe, Sound Board, Particle Play) |
| **Architecture** | Vanilla TS, `Game` interface, flat `src/games/` layout, decoupled dynamic `GameRegistry` orchestrator |
| **Design system** | Kipu/khipu theme (parchment/indigo/cochineal), 1615-line `style.css`, Fredoka font |
| **PWA** | `vite-plugin-pwa` configured, manifest + SW registered, dynamic offline assets |
| **CI/CD** | GitHub Actions build + lint + unit tests execution on pull requests |
| **Haptic Feedback** | Resolved using `@capacitor/haptics` with standard fallback |
| **Audio Engine** | Web Audio `SynthEngine` supporting custom bell, chime, pluck, click, and drum synthesis |
| **Memory Management** | Eliminated window resize listener leak and SoundMemory game timeout leaks |
| **Celebration UI** | High-performance HTML5 canvas confetti simulation with overlay buttons |

---

## Road Map (Phases of Development)

### [x] Phase 1: Architecture Hardening, Haptics Fix, & Audio Revamp (COMPLETED)
- **Haptics Fix:** Replaced `navigator.vibrate` with `@capacitor/haptics` to solve iOS Safari silence.
- **Audio Synthesizer:** Built client-side `SynthEngine` supporting chime, bell, pluck, drum, and click presets.
- **Leak Prevention:** Decoupled `GameRegistry` from main loop, stored & cleaned resize handlers, and wrapped `setTimeout` lifecycle bounds inside `SoundMemoryGame`.
- **Preloader & WinScreen:** Caches network assets using `fetch()` preloading. Built full celebration confetti overlay with actions.

---

### [ ] Phase 2: Three-Tier Design System & Portal Navigation
*Focus: Restructure the hub to use the Sandbox, Workshop, and Lab portals.*

#### [MODIFY] [index.html](file:///c:/Programming/kipu - kids games/index.html) & [Router.ts](file:///c:/Programming/kipu - kids games/src/core/Router.ts)
- Replace category pills with the three portal cards.
- Add `/portal/:portalId` routes.

#### [MODIFY] [style.css](file:///c:/Programming/kipu - kids games/src/style.css)
- Implement Tier 2 portal-specific styling (`.portal-sandbox`, `.portal-workshop`, `.portal-lab`).

#### [MODIFY] [GameRegistry.ts](file:///c:/Programming/kipu - kids games/src/core/GameRegistry.ts)
- **Portal Mapping:**
  - **Sandbox:** Poka (Bubble Wrap), Eeno (No Button), Sound Board, Particle Play
  - **Workshop:** Tapa (Balloon Pop), Maka (Color Mixer), Nuko (Bug Catcher), Sound Memory
  - **Lab:** Marble Pipe

---

### [ ] Phase 3: New v4 Games (Priority Batch)
*Focus: Add the core v4 game experiences.*

#### Sandbox Portal
- **[NEW] DigitalBusyBoard** (`src/games/busyBoard/`): Scaffold the base grid + Module Registry + **Board 1 (The Switchboard)** (10 tactile modules).
- **[NEW] CloudShapeFinder**: Procedural clouds morphing into SVG animals.

#### Workshop Portal
- **[NEW] DigitalLiteBrite**: Tracing challenges with glowing pegs.
- **[NEW] AnimalChoir**: Grid sequencer with animal characters and diverse audio sprites.

#### Lab Portal
- **[NEW] EquationTower**: Matter.js stacking blocks for arithmetic sums.
- **[NEW] TrashSorcerer**: Physics-based flick sorting.
- **[NEW] VibeCoder**: Block-based logic pathfinding.
- **[NEW] KhipuSynth**: A loop-based synthesizer and song maker game. Leverages the Sound Board concept into an interactive grid sequencer. Features multiple instrument tracks/synths (bell, pluck, drum, chime, click), custom BPM controls, real-time audio recording, and local WAV/audio download capability (no server-side requirements).

---

### [ ] Phase 4: Parental Gate & Monetization Prep
*Focus: UI and flows for commercialization, without actual payment processing.*

#### [NEW] [ParentalGate.ts](file:///c:/Programming/kipu - kids games/src/ui/ParentalGate.ts)
- Dynamic, non-verbal cognitive puzzle (e.g., visual arithmetic or pattern matching). Required for settings or external links.

#### [NEW] [MonetizationFlow.ts](file:///c:/Programming/kipu - kids games/src/ui/MonetizationFlow.ts)
- Build the UI for the pricing tiers (Free / Individual / Bundle / Lifetime).
- **MOCK MODE:** Integrate local-storage based unlocking. Do NOT integrate actual IAP APIs yet.

#### [NEW] [SettingsView.ts](file:///c:/Programming/kipu - kids games/src/ui/SettingsView.ts)
- Parent-facing settings panel (sound, vibration, mock purchase restore).

---

### [ ] Phase 5: Mobile Deployment Pipeline
*Focus: Wrapping the web app for app stores.*

#### PWABuilder (Android TWA)
- Wrap Vite build for Google Play Store (Kids category).

#### Capacitor Integration (iOS)
- `npx cap init` for iOS wrapper.

---

### [ ] Phase 6: Busy Board Expansion
*Focus: Post-launch content.*
- Boards 2–10 (90 modules) and 20 Wildcards.

---

## Verification Plan

### Automated Tests
- `npm run test` (Vitest) run locally and in GitHub Actions CI pipeline on branch PRs.

### Manual Verification
- **Haptics:** Test on physical iOS and Android devices to verify `@capacitor/haptics` fallback and native bridge.
- **Audio:** Verify zero-latency synth playback across devices.
- **Portal & Monetization:** Verify Maka is in Workshop, and that the paywall UI operates smoothly in mock mode.
