---
name: testing-kids-games
description: Test the Kipu app end-to-end. Use when verifying new game implementations or checking for regressions in existing games.
---

# Testing Kipu

## Dev Server

```bash
cd /home/ubuntu/repos/kipu
npm install --legacy-peer-deps   # needed due to vite-plugin-pwa peer dep range
npm run dev -- --host 0.0.0.0
```

App runs at `http://localhost:5173`. No CI is configured on this repo — testing is manual/visual.

## Build Check

```bash
npm run build
npm run test
```

Both must pass before creating a PR.

## Navigation Test

- Open `http://localhost:5173`
- Verify the title "Kipu" is visible
- Verify all game buttons are present with correct labels, icons (SVG), and background colors
- Each game button has a `data-game` attribute matching its game key

## Game-Specific Testing

### Canvas-Based Games (Bubble Wrap, Balloon Pop)
- Click the game button from navigation
- Verify the canvas renders with expected visual elements
- Bubble Wrap: grid of gradient circles on black background
- Balloon Pop: colorful balloons floating upward from bottom of screen

### Web Audio Games (Sound Board)
- Click the Sound Board button
- Verify 9 colored pads render in a 3×3 grid with labels
- Click pads and verify tones play (use console instrumentation to count oscillators):
  ```js
  const origCreate = AudioContext.prototype.createOscillator;
  window._oscCount = 0;
  AudioContext.prototype.createOscillator = function() {
    window._oscCount++;
    console.log('Oscillator created, total:', window._oscCount);
    return origCreate.call(this);
  };
  ```
- After clicking N pads, `window._oscCount` should equal N
- Note: AudioContext may be suspended by the browser after 30s of silence — the game handles this with auto-resume

### Physics Games (Particle Play)
- Click the Particle Play button
- Click and drag on the canvas to spawn particles
- Verify particles: spawn at cursor, fall with gravity, leave trails, bounce at edges, fade over time
- Release mouse — emission should stop, remaining particles continue simulation
- Note: Touch events (touchstart, touchmove, touchend, touchcancel) are all handled for mobile

### Interactive Games (The "No" Button)
- Click the button from navigation
- Verify the game loads and the button is interactive

## Regression Testing

When adding new games, always verify existing games still launch correctly from navigation. Key checks:
- Navigation shows correct number of buttons
- Each existing game renders its initial state without errors
- No console errors when switching between games

## Tips

- The app uses a canvas element for all games — DOM inspection won't show game content; use screenshots
- Games are loaded via dynamic import in `src/main.ts` with a switch statement on `data-game` attribute
- Game styles (button colors) are in `src/style.css` using `#game-list button[data-game="..."]` selectors
- Icons are defined in `src/ui/Icons.ts` and mapped in `src/main.ts`
- Use `--legacy-peer-deps` flag with npm install — the vite-plugin-pwa peer dep range might not cover the current vite version
