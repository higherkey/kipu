# Music Experiments Work Trace

## Context
The original music direction contained three overlapping ideas: a simplified GarageBand-like track maker, a simple Workshop sound board, and a more programmable Launchpad-like Lab tool. To avoid product-name collisions and premature architecture, this pass uses three neutral experiment names.

## Experiments added
- **Tone Garden** (`toneGarden`, Workshop): 4x4 tactile sound grid. Rows explore Air, Wood, Spark, and Low sound shapes. Immediate one-shot audio; no persistence.
- **Pattern Loom** (`patternLoom`, Lab): 2-lane, 16-step looping pattern. Users toggle steps and hear the loop evolve. This tests whether a compact sequencer is more compelling than a full timeline.
- **Track Sketcher** (`trackSketcher`, Lab): tap notes onto a simple timeline. Notes autosave to localStorage under `kipu-track-sketcher-v1`; tapping the header clears the sketch. This tests whether a timeline model adds useful creative control without requiring a DAW.

## Implementation notes
- The prototypes live together in `src/games/musicExperiments/MusicExperiments.ts` so this round stays intentionally disposable.
- They use the browser Web Audio API and the existing Kipu `Game` lifecycle rather than introducing a shared music framework before the interaction has been evaluated.
- Names intentionally avoid GarageBand, Launchpad, and other branded/product-specific language.
- Track Sketcher is the only prototype with persistence, and its storage is deliberately versioned.

## What to evaluate next
1. Does Tone Garden feel sufficiently different from existing Sound Board and Animal Choir experiences?
2. Does Pattern Loom communicate looping without instructions, and does the playhead feel musically stable?
3. Does Track Sketcher feel more useful than Pattern Loom, or does it add complexity without improving musical play?
4. Which code is genuinely shared after hands-on testing: audio startup, note mapping, transport, grid geometry, or persistence?
5. Test at desktop and narrow touch viewport before extracting architecture.

## Likely decision gate
Keep Tone Garden if its instant cause-and-effect is meaningfully more approachable than existing sound games. Choose either Pattern Loom or Track Sketcher as the Lab direction based on which produces more satisfying repeatable creation. Defer MIDI, audio recording, imported media, and a broad shared framework until this comparison is complete.

## Validation
- Run `npm run build` and `npm run test`.
- Use the Kipu browser test workflow to launch each new registration, click the canvas, confirm audio interaction, and verify navigation back to the portal.

## Files changed
- `src/games/musicExperiments/MusicExperiments.ts`
- `src/core/GameRegistry.ts`
- `docs/traces/music-experiments-work-trace.md`
