Original prompt: Implement the approved M8 Adventure Progression plan.

# Current State

Dungeon of Doom is a private Vite + vanilla TypeScript + Canvas 2D browser
game. The active product surfaces are Play, Editor, Creator, and Archive.

The engine is deterministic and owns game rules; modern play-session JSON is
the runtime save model; legacy HERO/LEVEL strings remain an explicit
import/export and archaeology boundary. The app supports one bundled adventure
as well as isolated single-dungeon play.

Primary checks from `src/web` are `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm build`, and the Playwright browser smoke suite.

## M8 Complete

- Added the deterministic three-level Lost Idol adventure above the single-level
  engine.
- Hero resources carry exactly between levels; only placement, facing, and
  transient status reset.
- Browser persistence now saves either a single run or a complete adventure
  session. Earlier raw-run saves are intentionally unsupported.
- Play mode now defaults to Adventure, presents stage progress and outcomes, and
  retains Single Dungeon for fixture, imported, editor, creator, and archive
  launches.
- Automated coverage includes progression, carry-over, depth gates, outcomes,
  save fidelity, and browser resume/continue/victory flows.
- Organic browser playtests completed the full seeded Warrior adventure and the
  first level with the Cleric spell route; desktop and narrow layouts were
  visually checked.

No known M8 blockers remain.

## M9 Play Feel And Legibility

- Handed from Codex to Claude on 7 September 2026. A first playtest (Warrior,
  seed 1984) lost three items on level one and could not read hit results
  because the monster's reply always displaced them.
- Engine: gear breakage now has a luck save using the trap-release roll;
  walking into a dormant monster wakes it; break messages use catalog names.
- Presentation: the event line shows every message from the current turn in
  order; stale app messages clear when a run starts or resumes.
- Layout: compact masthead, two-column status, outcome panel at the top of
  the sidebar, dungeon canvas scales to fill its frame (up to 720px).
- `.claude/launch.json` starts the dev server on port 5174 for the in-app
  browser preview.

## M10 Authored Adventures And Lore

- Editor gains a Level Library (browser storage) and a Quest Builder that
  orders saved levels into an adventure. Depth is the stage position: level
  ids are renumbered 1..n when the quest is built.
- Quests validate through the existing adventure rules, save to a quest
  library, export and import as `dungeon-of-doom.quest` JSON, and appear in
  the Play adventure select. Saved sessions resolve bundled quests first,
  then the library.
- New Lore mode: a reference in the product's own words covering premise,
  keys, attributes, classes, gear, monsters, traps, spells, and authoring.
- Coverage: quest model and library unit tests, plus browser scenarios for
  library to quest to play with save and resume, and for the Lore panel.

## M11 Balance Harness

- `src/web/src/harness/` drives the bundled quest headlessly with a
  competent, map-aware policy; `pnpm balance --seeds N [--classes a,b]
  [--out file]` prints a per-class markdown table.
- First run (`docs/balance/`): Barbarian 88% and Warrior 76% win, all deaths
  on level two from strength attrition; Wanderer, Cleric, and Mage win every
  seed because Superzap costs one hit per monster. Salves are effectively
  unused. No adjustment made; candidates are listed in the findings note.
- `tsx` added as the script runner; esbuild's install script is approved in
  `pnpm-workspace.yaml`.

## Successor Handover

- `HANDOVER.md` is the compact entry point for a fresh task.
- On 7 September 2026, lint, typecheck/build, all 54 unit tests, and all 23
  Chromium scenarios passed again for the M8 commit and push closeout.
- Only `main` exists locally and remotely; this is the primary checkout, with
  no linked worktrees. No M9 scope has been approved.
