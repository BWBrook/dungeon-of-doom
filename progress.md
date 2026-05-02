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

## M5 Progress

- Starting Run/Adventure Polish from clean `main` at `9b193a5 Add character creator`.
- Scope is Play mode presentation, command clarity, outcome panels, renderer feedback, and browser playtest hooks; no mechanics changes intended.
- Added pure run presentation helper and unit coverage; targeted Vitest pass is green.
- Wired the Play mode command surface, spell chooser, outcome panel, save/resume status, renderer effect inputs, and browser playtest hooks; `pnpm typecheck` is green after integration.
- Expanded browser coverage for command buttons, `C` conjure, exit-gate feedback, outcome panels, save/resume status, and `render_game_to_text`; Vitest and Playwright are green.
- Manual smoke used the shared web-game helper plus desktop/narrow Play mode screenshots; layout remains playable and command feedback is visible.
