# 

Kids Web Games Suite: Technical Specification & Roadmap

This document defines the architecture, project phases, and technical requirements for a mobile-first web platform hosting a collection of tactile, educational, and sensory mini-games designed for children ages 2 through 10\.

## **1\. Architectural Vision**

The application must deliver a highly responsive, near-native mobile experience through a standard web browser. The primary engagement driver is immediate tactile feedback. There must be zero perceptible latency between a touch event and the corresponding audio and haptic response.

### **1.1 Technology Stack**

| Component | Technology | Rationale |
| :---- | :---- | :---- |
| Core Framework | Vite \+ TypeScript \+ HTML5 Canvas | Provides a lightweight, highly structured environment ideal for AI-assisted generation, avoiding the heavy payload of a full game engine export. |
| Physics Engine | Matter.js | Robust 2D physics essential for stacking mechanics (Equation Tower) and fluid movements (Color Mixer). |
| Audio Engine | Howler.js | Enables audio sprite pre-caching to guarantee zero-latency playback upon user interaction. |
| State Management | Browser LocalStorage | Sufficient for persisting offline data such as highest scores, unlocked stages, and user preferences without requiring a backend database. |

### **1.2 Feedback Systems (Haptics & Audio)**

A central controller will manage all hardware feedback. The application will utilize the Web Haptics API via navigator.vibrate(). Touch event listeners must be wrapped by this controller to ensure a simultaneous haptic pulse and audio trigger. Patterns should be established early (e.g., 20ms pulse for a light tap, 50ms pulse for a collision).

## **2\. AI Developer Directives**

When parsing this document to generate scaffolding and game logic, the AI agent must adhere strictly to the following constraints:

1. **Separation of Concerns:** Game logic and state management must be entirely decoupled from the DOM and Canvas rendering layers. Implement a clear Model-View-Controller (MVC) or Entity-Component-System (ECS) pattern.  
2. **Event Handling:** All touch event listeners applied to the canvas must use { passive: false } to prevent default browser behaviors like pull-to-refresh or vertical scrolling during active gameplay.  
3. **Asset Loading:** Generate a robust preloader class. Games must not initialize until all associated graphics, audio sprites, and physics boundaries are fully loaded into memory.  
4. **PWA Requirements:** Generate a compliant manifest.json and a service worker setup to ensure the application is installable on mobile home screens and functions entirely offline.

## **3\. Project Phases and Milestones**

### **Phase 1: Proof of Concept (The Foundation)**

The objective of this phase is to validate the core technology stack, specifically testing mobile performance, latency, and the integration of haptics.

1. **Milestone 1 \- Infrastructure:** Initialize the Vite \+ TS repository, establish the PWA manifest, and create the central navigation shell.  
2. **Milestone 2 \- The Sensory Baseline:** Implement "Bubble Wrap" and "The 'No' Button". These will serve as the stress test for the audio and haptic feedback loop.  
3. **Milestone 3 \- Basic Physics and Logic:** Implement "Color Mixer" and "Balloon Pop". This validates collision detection, object pooling, and drag-and-drop mechanics.  
4. **Milestone 4 \- Exploratory UI:** Implement "Bug Catcher" to test sprite layering, search mechanics, and responsive scaling across different device sizes.

### **Phase 2: Minimum Viable Product (The Core Suite)**

The objective of this phase is to expand the platform into a fully functional 10-game suite with consistent art direction and educational value.

1. **Milestone 5 \- Advanced Physics & Math:** Develop "Equation Tower" and "Marble Pipe Run". These require precise Matter.js tuning to ensure physics feel fair and predictable for children solving arithmetic puzzles.  
2. **Milestone 6 \- Memory & Generative Content:** Implement "Sound Memory" and "Cloud Shape Finder". Focus on state tracking and procedural sprite generation.  
3. **Milestone 7 \- Fast-Paced Mechanics:** Implement the "Trash Sorcerer" wildcard game to introduce high-speed flicking interactions.  
4. **Milestone 8 \- Polish & Persistence:** Integrate unified "Win States" (e.g., particle system confetti), celebratory audio cues, and final LocalStorage persistence for user tracking.

### **Phase 3: Post-Launch Expansion**

Following a successful deployment of the MVP, development will shift toward more complex mechanics, such as the Digital Lite-Brite tracing application and the 3D physics-based Pizza game, utilizing the established asset pipelines.

## **4\. File Structure Convention**

The repository should follow this general structure to assist with automated generation:

`src/`  
`├── core/`  
`│   ├── AudioController.ts`  
`│   ├── HapticController.ts`  
`│   ├── StateManager.ts`  
`│   └── Preloader.ts`  
`├── games/`  
`│   ├── bubbleWrap/`  
`│   │   ├── logic.ts`  
`│   │   ├── renderer.ts`  
`│   │   └── assets/`  
`│   ├── equationTower/`  
`│   └── ...`  
`├── ui/`  
`│   ├── Navigation.ts`  
`│   └── WinScreen.ts`  
`├── index.html`  
`├── main.ts`  
`└── style.css`  
  