# Work Trace: feat/voice-install-check

## 1. Planned Work

- **TODO List**:
    - [ ] Add `isLanguageSupported(langCode)` check to `AudioController.ts`.
    - [ ] Update voice selection logic in `AudioController.ts` to strictly require exact accent matches for regionalized languages (en, es, pt) and avoid fallback accents.
    - [ ] Build a custom styled HTML/CSS dropdown in `NoButtonGame.ts` to replace the native select box.
    - [ ] Dynamically check voice installation on the host device: disable unsupported languages, label them "Not Installed", and show OS-specific tooltips on hover.
    - [ ] Style the custom dropdown, badges, and tooltips in `style.css`.
    - [ ] Add `dev-dist/` to `.gitignore`.
    - [ ] Run Vitest suite and production build verification.

- **File List**:
    - `src/core/AudioController.ts` [MODIFY]: Strict voice checks and exact regional matching.
    - `src/games/noButton/NoButtonGame.ts` [MODIFY]: Custom dropdown, installation status checks, OS tooltips.
    - `src/style.css` [MODIFY]: Custom dropdown, option hover states, badges, and tooltips.
    - `.gitignore` [MODIFY]: Ignore local Vite PWA generated `dev-dist/` files.

- **Rationale**:
    - **UI/UX Clarity**: Allows users to see exactly which languages are supported by their device. Tooltips help them install missing language packs instead of playing wrong fallback accents.

## 2. In Progress Work

- **Active Files**:
    - None (Implementation completed and verified).

## 3. Completed Work

- **Summary**:
    - Implemented `isLanguageSupported(langCode)` in `AudioController.ts`.
    - Simplified voice selection in `AudioController.ts` to strictly require exact accent matches for regionalized languages (en, es, pt) to avoid incorrect fallback accent voice synthesis.
    - Built a custom styled HTML/CSS dropdown in `NoButtonGame.ts` to replace the native select box.
    - Integrated dynamic checks for voice installation on the host device: unsupported languages are disabled, labeled "Not Installed", and display OS-specific installation instructions in a tooltip on hover.
    - Styled the custom dropdown, badges, and tooltips in `style.css`.
    - Added `dev-dist/` to `.gitignore`.
    - Ran the Vitest suite and production build verification successfully.

## 4. Issues and Out of Scope

- **4a) Potential Blockers**:
    - None

- **4b) Opportunities**:
    - None
