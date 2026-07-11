# Kipu

> A premium, sensory-focused collection of tactile and educational mini-games built for the modern web.

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/richardlitt/standard-readme)
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=flat-square)](https://kipu-games.vercel.app/)
[![Build Status](https://github.com/higherkey/kipu/actions/workflows/build.yml/badge.svg)](https://github.com/higherkey/kipu/actions/workflows/build.yml)
[![Vite 8](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)](https://vite.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-007ACC?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](#)
[![Matter.js](https://img.shields.io/badge/Matter.js-0.20-EF5350?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**Kipu** is a mobile-first platform hosting high-performance, tactile mini-games designed for children (ages 2-10). Our primary focus is **immediate tactile engagement**—ensuring zero perceptible latency between touch events and their corresponding audio/haptic responses.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Background

Built with a "Sensory-First" philosophy, the suite transforms a standard web browser into a responsive, near-native playground using MVC/ECS design patterns.

### Key Features
- **⚡ Zero-Latency Feedback**: Optimized event handling and pre-cached audio sprites ensure instant gratification.
- **📱 PWA Ready**: Fully installable on mobile home screens with robust offline support via Service Workers.
- **🎨 Sensory Excellence**: Games like "Bubble Wrap" and "Balloon Pop" provide rich visual and auditory stimulation.
- **🛠️ Robust Architecture**: Clean MVC/ECS patterns separating logic from rendering for maximum performance.
- **📳 Haptic Integration**: Native vibration feedback synchronized with every interaction.

### Tech Stack Details
- **Core**: Vite 8 + TypeScript 6 (High-performance build tool and type-safe logic).
- **Physics**: Matter.js 0.20 (Advanced 2D physics for stacking and fluid mechanics).
- **Audio**: Howler.js 2.2 (Zero-latency audio playback and sprite management).
- **Persistence**: LocalStorage (Offline-ready state and progress tracking).
- **Icons**: Lucide (Lightweight SVG iconography).

### Included Games (Phase 1)
1. **Bubble Wrap**: A satisfying, multi-touch canvas experience for endless popping.
2. **The "No" Button**: A playful DOM-based interaction with shake effects and auditory cues.
3. **Balloon Pop**: Physics-driven balloon interactions with multi-layer scaling.
4. **Color Mixer** *(Coming Soon)*: An exploration of physics-based fluid and color blending.

For technical specifications, refer to [PROJECT.md](PROJECT.md).

---

## Install

### Prerequisites
- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- npm

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/higherkey/kipu.git
   cd kipu
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```

---

## Usage

### Local Development
To launch the hot-reloaded development server locally:
```bash
npm run dev
```

### Production Build
To compile the type-safe static application to the `/dist` directory:
```bash
npm run build
```
Preview the built product:
```bash
npm run preview
```

---

## Contributing

Please review `PROJECT.md` for our sensory-first coding standards before making changes. Ensure any testing changes align with our `testing-kipu` plugin workflow.

### Project Roadmap
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

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. (Note: Audio assets are CC0 unless otherwise specified).
