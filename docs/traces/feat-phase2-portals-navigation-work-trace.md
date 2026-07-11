# feat/phase2-portals-navigation Work Trace

## 1. Planned Work
- **TODO List**:
  - [x] Research existing codebase and write implementation plan
  - [x] Obtain user approval on implementation plan
  - [x] Update `src/core/Router.ts` to support `/portal/:portalId` dynamic routes
  - [x] Update `test/Router.test.ts` to verify portal routing
  - [x] Update `index.html` to replace category pills with three portal cards
  - [x] Add `data-portal` attributes to all game links in `index.html`
  - [x] Add back button and update title/tagline elements in `index.html` header
  - [x] Update `src/main.ts` to handle portal route navigation, header updates, and game filtering
  - [x] Extract monolithic styles from `src/style.css` into 6 separate component-local stylesheets and import them in TypeScript
  - [x] Implement enhanced portal selection card flairs & Tier 2 portal background animations in `src/style.css`
  - [x] Add portal choice instructional message to lobby homepage and manage its visibility dynamically
  - [x] Verify implementation using Vitest, type checks, and visual validation
- **File List**:
  - [src/core/Router.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/core/Router.ts): Add dynamic portal routing support
  - [test/Router.test.ts](file:///c:/Programming/kipu%20-%20kids%20games/test/Router.test.ts): Add test cases for portal routes
  - [index.html](file:///c:/Programming/kipu%20-%20kids%20games/index.html): Replace category tabs with Portal Cards, add back button, add IDs/attributes
  - [src/main.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/main.ts): Add routes handlers, toggle views, update header text, filter games, load 404 styles
  - [src/style.css](file:///c:/Programming/kipu%20-%20kids%20games/src/style.css): Style portal cards and implement portal-specific themes
  - [src/games/noButton/NoButtonGame.css](file:///c:/Programming/kipu%20-%20kids%20games/src/games/noButton/NoButtonGame.css) [NEW]: Local CSS for Eeno game
  - [src/ui/GameHeader.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/GameHeader.css) [NEW]: Local CSS for game header (HUD)
  - [src/ui/GameUI.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/GameUI.css) [NEW]: Local CSS for legacy HUD and settings slide menu
  - [src/ui/LoadingOverlay.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/LoadingOverlay.css) [NEW]: Local CSS for loading overlay
  - [src/ui/NotFound.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/NotFound.css) [NEW]: Local CSS for 404 screen
  - [src/ui/WinScreen.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/WinScreen.css) [NEW]: Local CSS for win celebration overlay
- **Rationale**: Restructures the homepage layout to split games into Sandbox, Workshop, and Lab play portals as per Issue #14, and modularizes the CSS architecture into encapsulated stylesheets.

## 2. In Progress Work
- **Active Files**: None

## 3. Completed Work
- **Summary**:
  - [src/core/Router.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/core/Router.ts): Added dynamic portal routing support (`/portal/:portalId`) and parameter extraction.
  - [test/Router.test.ts](file:///c:/Programming/kipu%20-%20kids%20games/test/Router.test.ts): Added unit tests verifying dynamic portal routing and parameter extraction.
  - [index.html](file:///c:/Programming/kipu%20-%20kids%20games/index.html): Replaced category pills with 3 Portal Cards, added data-portal attributes, header back button, IDs, and a portal choice instructional message.
  - [src/main.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/main.ts): Purged dead filter-pills logic, added route handlers for `/` and `/portal/:portalId`, added game list filtering, header updating, and route-based visibility toggling for the portal instruction text. Added imports for 404 screen styles.
  - [src/games/noButton/NoButtonGame.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/games/noButton/NoButtonGame.ts) & [NoButtonGame.css](file:///c:/Programming/kipu%20-%20kids%20games/src/games/noButton/NoButtonGame.css): Added import and migrated all custom voices dropdowns and giant yes/no button styles.
  - [src/ui/GameHeader.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/GameHeader.ts) & [GameHeader.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/GameHeader.ts): Added import and migrated HUD navigation layout styles.
  - [src/ui/GameUI.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/GameUI.ts) & [GameUI.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/GameUI.css): Added import and migrated legacy HUD, settings slide menu, settings toggle panels, and overlays.
  - [src/ui/LoadingOverlay.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/LoadingOverlay.ts) & [LoadingOverlay.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/LoadingOverlay.css): Added import and migrated loading overlay and pendulum knot bounce animations.
  - [src/ui/WinScreen.ts](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/WinScreen.ts) & [WinScreen.css](file:///c:/Programming/kipu%20-%20kids%20games/src/ui/WinScreen.css): Added import and migrated win overlays, confetti canvas, and popIn animations.
  - [src/style.css](file:///c:/Programming/kipu%20-%20kids%20games/src/style.css): Styled portal cards and back button, added custom hover animations and backgrounds tailored to each portal's concept. Trimmed extracted blocks.
- **Revised Rationale**: Restructured the main page and navigation routing from legacy categories to the modern 3 Play Portals, with distinct aesthetic backgrounds and animations, improving usability on mobile viewports. Segmented monolithic styling into decoupled, component-local stylesheet modules.

## 4. Issues and Out of Scope
- **4a) Potential Blockers**: None
- **4b) Opportunities**:
  - **Dynamic Portal Redirect**: Implemented dynamic portal redirect in `exitToHome()` so that exiting a game returns the child to the specific portal they came from instead of the root lobby.
  - **High-Flair Portal Personalities**: Custom styled the Sandbox portal with warm sand/orange colors and kinetic sand squishy hover effects; the Workshop portal with mint green glowing backgrounds and a bouncing music-note icon on hover; and the Lab portal with blueprint blue details, blueprint line grids, precise corner brackets, and rigid square game cards.
