# 

Kipu: Master Project Plan & Commercial Positioning

**Version:** 4.0  
**Project Goal:** A modern, mobile-first suite of tactile, educational, and sensory play spaces for children, deployed as a high-performance Progressive Web App (PWA) and packaged for native application stores.

## **1\. Cultural Foundation & Narrative Positioning**

---

The platform takes its identity from the Andean *khipu*, an ancient three-dimensional, tactile recording system. Rather than relying on static screens and passive consumption, Kipu emphasizes active touch, physical coordination, and structural logic. This historical connection underpins every design choice, ensuring the application feels like a premium digital heirloom rather than a generic collection of browser games.

### **Cultural Sensitivities and Ethics**

To honor the source material without resorting to caricature, the visual style avoids stereotypical "ancient indigenous" tropes. The focus is strictly on the mechanical beauty of threads, knots, natural dyes, and geometric weavers. The educational games are framed as a continuation of tactile data organization and problem-solving, celebrating ancient human mathematical ingenuity.

## **2\. The Three-Tier Design Framework**

---

To establish a coherent user experience while granting individual games distinct interactive environments, the layout follows a nested design system:

| Tier Name | Visual Scope | Core Implementation Assets   |
| :---- | :---- | :---- |
| **Tier 1: Global** | Core App Container & Hub Navigation | Organic paper-like textures, neutral stone backgrounds, and fibrous borders. The main navigation is modeled as a vertical cord from which individual play portals hang like dyed threads. |
| **Tier 2: Sectional** | Play Portal Categories | **The Sandbox:** Fluid, elastic, organic layouts. **The Workshop:** Vibrating string pathways and rhythmic, glowing cues. **The Lab:** Rigid, grid-like weavers and precise structural geometries. |
| **Tier 3: Individual** | Specific Game/Board Modules | High-contrast local styling (e.g., shiny plastic for Bubble Wrap, carved wood for Equation Tower) which overrides the background while keeping the Tier 1 exit and navigation mechanics constant. |

## **3\. Play Portals (Age-Agnostic Classification)**

---

To avoid age-related alienation where older children reject simple games and younger children feel locked out of advanced ones, Kipu segments its library by play modality rather than target age.

### **3.1 The Sandbox (Sensory & Kinetic Exploration)**

Designed for open-ended, consequence-free interaction. There are no timer mechanisms, scoring metrics, or failure states. The system focuses on immediate tactile feedback, making it ideal for toddlers and early preschool development.

* **The Digital Busy Board:** A modular, full-screen grid featuring switches, toggles, rotating keys, and dial controls. Includes the RGB fader array controlling light emissions and dimmers.  
* **Poka (Bubble Wrap):** An infinite sheet of popping bubbles that utilize variable haptic intensities based on touch velocity.  
* **Pipo (The "No" Button):** Comedic cause-and-effect button utilizing physics deformation (squash and stretch) and a randomized audio bank of varying voices.  
* **Maka (Color Mixer):** A fluid-based canvas where color blobs are dragged and merged dynamically to explore primary and secondary color combinations.  
* **Cloud Shape Finder:** Relaxed visual search game where children tap drifting clouds to morph them into recognizable animal vectors.

### **3.2 The Workshop (Guided Creation & Sequence Building)**

Introduces simple rule systems, pattern matching, replication goals, and creative arrangement logic with clear, positive feedback loops.

* **Digital Lite-Brite:** Tracing challenges where children place glowing colored pegs onto grid lines to complete geometric shapes and simple images.  
* **Sound Memory:** A classic auditory recall sequencer using distinct animal calls in place of neon flash panels.  
* **Tapa (Balloon Pop):** A structured targeting game where floating elements must be popped, introducing speed variations and pattern requirements.  
* **Nuko (Bug Catcher):** A layered visual scanning puzzle where children slide natural grass assets aside to find specific target insects.  
* **Animal Choir:** Early musical arrangement utilizing character steps mapped to clean harmonic musical scales.

### **3.3 The Lab (Systems, Physics, & Strategic Logic)**

Features structural puzzles, physical mechanics, and logical constraints that challenge spatial reasoning, basic arithmetic, and planning.

* **Equation Tower:** Stacking numbered blocks under strict gravitational constraints to match a designated target arithmetic sum without the tower tipping.  
* **Marble Pipe Run:** A pipeline puzzle where grid components must be rotated to establish a clear conduit for a rolling marble.  
* **Trash Sorcerer:** A high-velocity sorting game utilizing physics-based flick inputs to categorize incoming materials into Compost, Recycle, and Waste.  
* **Vibe-Coder:** Simple block-based logic sequences where players construct paths to move a mechanical rover through coordinate grids.  
* **Bridge Builder:** Structural simulation where children join geometric beams to support crossing weights, visualizing load stress.

## **4\. Commercial Architecture & Monetization**

---

The monetization structure is designed to respect the user experience, avoiding mid-game advertising or predatory friction loops while establishing a sustainable revenue path.

### **Pricing Tier Model**

| Tier Option | Cost | Access Rights   |
| :---- | :---- | :---- |
| **Free Evaluation Core** | $0.00 | Provides access to the main hub and one foundational game in each portal (e.g., The Switchboard, Animal Choir, and basic Equation Tower stages). |
| **Individual Portals** | $0.99 per Portal | Unlocks the complete catalog and settings of a single category (Sandbox, Workshop, or Lab). |
| **The Core Bundle** | $2.50 once | Unlocks all three core portals, including settings, customization options, and offline capabilities. |
| **Lifetime All-Access Pass** | $4.99 once | Unlocks all current content and automatically grants access to future content expansion packs (e.g., upcoming themed busy boards) without additional cost. |

### **Parental Gate Protection**

In accordance with COPPA and App Store Kids Category regulations, any outgoing links, configuration panels, or in-app billing interfaces must be protected behind a secure parental gateway. This is implemented via a dynamic, non-verbal cognitive puzzle (such as drawing three lines to join matching geometric patterns or solving a multi-variable visual arithmetic problem) to prevent pre-literate or early-elementary kids from bypassing the wall.

## **5\. Web-to-Mobile Deployment Pipeline**

---

To preserve the lightweight profile of a high-performance PWA while securing play store accessibility, Kipu uses a two-phase native compilation strategy:

### **Phase 1: PWABuilder (Trusted Web Activity)**

The compiled Vite production build is wrapped using PWABuilder to generate an Android App Bundle (AAB). This represents a Trusted Web Activity (TWA), delivering direct access to the Google Play Store with zero framework overhead. It is ideal for rapid distribution, immediate feedback loops from your household, and testing initial play analytics.

### **Phase 2: Capacitor Integration**

As the application scales toward in-app billing mechanics, deep system-level hardware access, and Apple App Store deployment, the codebase will integrate Ionic Capacitor. The transition requires no restructuring of the core Canvas engine; Capacitor simply wraps the Vite build folder and exposes native plugins for iOS App Store and Google Play Store transactions.