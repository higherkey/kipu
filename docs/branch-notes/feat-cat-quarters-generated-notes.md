# Branch Notes for feat/cat-quarters-generated

## Discoveries and deviations

- A Cloudflare Pages Function generates original 7 × 7 boards. Puzzle generation needs no central database.
- IndexedDB keeps generated boards on the device, deduplicates layouts, and makes saved boards available offline.
- Nov 2026: boards now come in 5 × 5 to 10 × 10 and are built on the device in a web worker. The old builder left two one-tile rooms and grew the rest to about 20 tiles on 7 × 7, which made boards easy. Rooms are now 3 to ⌈1.6 × width⌉ tiles (2 on 5 × 5). The builder places the cats, grows rooms around them, then moves border tiles to break every other solution.

## Blockers and risks

## Quick wins

## Deferred items
