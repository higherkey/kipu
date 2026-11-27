# Branch Notes: fix/sound-memory-yuyay

## 1. Discoveries & Deviations
- **Game Rebranding**: Renamed "Sound Memory" to **Yuyay** (Quechua for "Memory / Remember / Mind"), aligning with Kipu's Quechua naming scheme (Poka, Eeno, Tapa, Sutuy, Maka, Nuko).
- **Deadlock State Machine Recovery**: Fixed complete freeze when player enters wrong note (`phase = 'lost'`). Added automatic gentle reset and interactive tap-to-retry mechanism.
- **Asynchronous Sequence Validation Race**: Discovered a critical race condition where note validation was delayed inside a 150ms `setTimeout`, causing rapid taps to validate against the wrong sequence index. Replaced with synchronous atomic step validation upon button tap.
- **Pointer & Touch Deduplication**: Replaced redundant `touchstart` + `mousedown` listeners with unified `pointerdown` listener to eliminate phantom double-taps on touch-enabled screens.
- **Responsive Layout & Dynamic Viewport Sizing**: Implemented `resize(width, height)` with dynamic radius and spacing calculation relative to viewport min-dimension (`Math.min(width, height)`), ensuring no button clipping on narrow mobile screens (320px–480px).
- **Sound Design Compliance**: Re-tuned notes to warm, gentle Andean pentatonic bells (C4, E4, G4, A4) with low-pass filtering and soft attack envelopes, adhering to `.agents/sound-design-rules.md`.
- **Pause/Resume Lifecycle Integration**: Implemented proper `pause()` and `resume()` hooks with active timer management to halt sequence timers when the menu opens or on idle timeout.

## 2. Blockers & Risks (4a)
- None. All automated test suites pass.

## 3. Quick Wins (4b)
- Added level progress celebratory visual feedback and gentle haptic pulses for child-friendly encouragement.

## 4. Deferred Items (4c)
- Optional difficulty mode toggles (e.g., 6-note pentatonic mode) deferred to future expansion.
