# Kids Web Games Suite: Project Plan & Architecture

This document supplements the `README.md` and serves as our running work trace and architectural blueprint, following the project's adapted `/feature-tracking` workflow.

## 1. Architectural Vision & Tech Stack

The application delivers a highly responsive, near-native mobile experience through a standard web browser with zero perceptible latency for touch events and audio/haptic responses.

- **Core Framework**: Vite + TypeScript + HTML5 Canvas. Lightweight, structured, and ideal for AI-assisted generation.
- **Physics Engine**: Matter.js. For 2D physics (stacking mechanics, fluid movements).
- **Audio Engine**: Howler.js. For audio sprite pre-caching and zero-latency playback.
- **State Management**: Browser LocalStorage. Persists offline data (scores, stages, preferences) without a backend.
- **Feedback Systems**: Web Haptics API (`navigator.vibrate()`) wrapped by a central controller for simultaneous haptic and audio triggers.

### AI Developer Directives
- **Separation of Concerns**: Implement MVC or ECS patterns. Game logic must be entirely decoupled from DOM and Canvas rendering layers.
- **Event Handling**: Canvas touch event listeners must use `{ passive: false }` to prevent default browser behaviors (e.g., pull-to-refresh).
- **Asset Loading**: Generate a robust preloader class. Games must not initialize until all associated graphics, audio sprites, and physics boundaries are fully loaded into memory.
- **PWA Requirements**: Generate a compliant `manifest.json` and a service worker setup to ensure the application is installable on mobile home screens and functions entirely offline.

## 2. Planned Work (Roadmap & Milestones)

### Phase 1: Proof of Concept (The Foundation)
- [x] **Milestone 1 - Infrastructure**: Initialize Vite + TS repository, establish PWA manifest, create central navigation shell.
- [x] **Milestone 2 - The Sensory Baseline**: Implement "Bubble Wrap", "The 'No' Button", and "Balloon Pop" with a unified Pause/Idle system.
- [ ] **Milestone 3 - Basic Physics and Logic**: Implement "Color Mixer".
- [ ] **Milestone 4 - Exploratory UI**: Implement "Bug Catcher".

### Phase 2: Minimum Viable Product (The Core Suite)
- [ ] **Milestone 5 - Advanced Physics & Math**: "Equation Tower" and "Marble Pipe Run".
- [ ] **Milestone 6 - Memory & Generative Content**: "Sound Memory" and "Cloud Shape Finder".
- [ ] **Milestone 7 - Fast-Paced Mechanics**: "Trash Sorcerer".
- [ ] **Milestone 8 - Polish & Persistence**: Unified Win States (particle confetti), celebratory audio cues, and final LocalStorage tracking.

### Phase 3: Post-Launch Expansion
- [ ] Digital Lite-Brite tracing application.
- [ ] 3D physics-based Pizza game.

## 3. Target File Structure

```text
src/
├── core/
│   ├── AudioController.ts
│   ├── HapticController.ts
│   ├── StateManager.ts
│   └── Preloader.ts
├── games/
│   ├── bubbleWrap/
│   │   ├── logic.ts
│   │   ├── renderer.ts
│   │   └── assets/
│   ├── equationTower/
│   └── ...
├── ui/
│   ├── Navigation.ts
│   └── WinScreen.ts
├── index.html
├── main.ts
└── style.css
```

## 4. Work Trace (Branch: `feat/milestone-2-sensory-baseline`)

## 4. Work Trace: In Progress

- **Active Task**: Phase 1, Milestone 3 - Basic Physics and Logic
- **Current Objectives**:
  - Implement "Color Mixer".
  - Refine particle systems and physics consistency.

## 5. Work Trace: Completed Work

- **Phase 1, Milestone 1**: Initialized Vite + TS repository. Set up `vite-plugin-pwa`, `matter-js`, and `howler`. Scaffolded core UI and architecture classes (`AudioController`, `HapticController`, `StateManager`, `Preloader`). Established central navigation shell in `index.html` and `main.ts`.
- **Phase 1, Milestone 2**: Implemented `GameLoop`, `IdleManager` (60s timeout), and `PauseMenu`. Integrated **Lucide SVG icons** and established CC0 audio pipeline. Completed three sensory games: **The "No" Button** (DOM/shake), **Bubble Wrap** (Canvas/multi-touch), and **Balloon Pop** (Canvas/scaling/multi-layer). Ensured **iOS 12/13 compatibility** with CSS fallbacks and visual feedback.

## 6. Issues and Out of Scope

- **4b) Opportunities**:
  - Implement a dedicated splash/loading screen to handle asset pre-caching (Milestone 1 stubbed the `Preloader`, but a visual indicator is needed).
  - Add "Game Exit" functionality to return to the menu from within a game.
