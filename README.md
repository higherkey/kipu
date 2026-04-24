# 🎮 Kids Web Games Suite

> A premium, sensory-focused collection of tactile and educational mini-games built for the modern web.

[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Matter.js](https://img.shields.io/badge/Matter.js-EF5350?style=for-the-badge&logo=javascript&logoColor=white)](https://brm.io/matter-js/)

---

## 🌟 Overview

The **Kids Web Games Suite** is a mobile-first platform hosting high-performance, tactile mini-games designed for children (ages 2-10). Our primary focus is **immediate tactile engagement**—ensuring zero perceptible latency between touch events and their corresponding audio/haptic responses.

Built with a "Sensory-First" philosophy, the suite transforms a standard web browser into a responsive, near-native playground.

## 🚀 Key Features

- **⚡ Zero-Latency Feedback**: Optimized event handling and pre-cached audio sprites ensure instant gratification.
- **📱 PWA Ready**: Fully installable on mobile home screens with robust offline support via Service Workers.
- **🎨 Sensory Excellence**: Games like "Bubble Wrap" and "Balloon Pop" provide rich visual and auditory stimulation.
- **🛠️ Robust Architecture**: Clean MVC/ECS patterns separating logic from rendering for maximum performance.
- **📳 Haptic Integration**: Native vibration feedback synchronized with every interaction.

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Core** | Vite + TypeScript | High-performance build tool and type-safe logic. |
| **Physics** | Matter.js | Advanced 2D physics for stacking and fluid mechanics. |
| **Audio** | Howler.js | Zero-latency audio playback and sprite management. |
| **Persistence** | LocalStorage | Offline-ready state and progress tracking. |
| **Icons** | Lucide | Beautiful, lightweight SVG iconography. |

## 🕹️ Included Games (Phase 1)

1.  **Bubble Wrap**: A satisfying, multi-touch canvas experience for endless popping.
2.  **The "No" Button**: A playful DOM-based interaction with shake effects and auditory cues.
3.  **Balloon Pop**: Physics-driven balloon interactions with multi-layer scaling.
4.  **Color Mixer** *(Coming Soon)*: An exploration of physics-based fluid and color blending.

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/kids-games-site.git

# Install dependencies
npm install
```

### Development

```bash
# Start the local development server
npm run dev
```

### Production Build

```bash
# Build for production (outputs to /dist)
npm run build

# Preview the production build locally
npm run preview
```

## 🗺️ Roadmap

- **Phase 1: Proof of Concept** (In Progress)
  - [x] Core Infrastructure & PWA Setup
  - [x] Sensory Baseline Games
  - [ ] Basic Physics & Logic (Color Mixer)
- **Phase 2: Minimum Viable Product**
  - [ ] Advanced Math & Physics (Equation Tower)
  - [ ] Memory & Generative Content
  - [ ] Unified Win States & Polish
- **Phase 3: Post-Launch Expansion**
  - [ ] Digital Lite-Brite
  - [ ] 3D Pizza Physics

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. (Note: Audio assets are CC0 unless otherwise specified).
