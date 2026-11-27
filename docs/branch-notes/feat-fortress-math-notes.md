# Branch Notes: feat/fortress-math

## 1. Discoveries & Deviations
- Build a local Lab area-control POC for roughly ages 6–10: addition within 10, visual counts, predictable capture outcomes, and two bots.
- Keep rules separate from DOM rendering. Reuse the registry, Game lifecycle, global header, and design tokens.
- Use one shared reserve per player, two actions per turn, and protect each player's last home to avoid elimination.

## 2. Blockers & Risks (4a)
- Production build and all 571 tests pass; independent rules/UI quality review passed. CSS audit: zero errors; measured APCA text contrast >=86.9 and interactive borders >=65.5 on the game's surfaces.
- Browser verified capture/reserve spending, both bots returning control, and 360/768/1024/1440px layouts. Child playtesting, physical touch devices, and screen-reader checks remain manual.
- Minimum-only captures can trade back and forth; a legal full-match regression proves a player can win by leaving extra defenders. Balance is still experimental.

## 3. Quick Wins (4b)
- Native keyboard-accessible region buttons, readable ownership labels, no timers for answering math.
- Countable defense icons, helpful answer previews, protected last homes, and focus restoration across captures and bot turns.
- Added rules, DOM integration, and a full legal playthrough regression; registered the game in Lab and updated catalogue/count fixtures.
- Quality review fixed unexplained disabled captures when reserves are too low and added accessible invalid-answer feedback, with regression tests and a 320px browser check.
- Local TypeScript gate passed; SonarCloud was not configured/verified. Build retains existing chunk-size and stale Browserslist warnings.

## 4. Deferred Items (4c)
- Percentages, multiplayer, saved campaigns, difficulty settings, and audio are outside this POC.
