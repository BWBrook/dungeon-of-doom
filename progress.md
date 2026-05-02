Original prompt: PLEASE IMPLEMENT THIS PLAN: M4B Plan: Character Creator

## Progress

- Starting M4B from clean `main` at dungeon-editor checkpoint.
- Creator will follow the existing pure-model-first pattern used by the editor.
- Added pure creator model skeleton plus modern hero document persistence.
- Added creator model tests and confirmed the current Vitest suite is green.
- Wired Creator as a third app mode with rolling, stat edits, shop purchases, exports, and launch-to-play state.
- Added Playwright coverage for creator export/play, invalid names, forbidden buys, stacking, and mode switching.
- Acceptance is green: `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:browser`.
- Manual smoke covered Creator export, legacy HERO export, Play Created Hero, save, resume, and visual layout screenshots.

## Next Suggestions

- M5 can start from a full in-app authoring loop: legacy interop, dungeon editor, and character creator all now feed Play mode.
- A later polish pass could tighten shop row wrapping and add a compact store-table variant for small screens.
