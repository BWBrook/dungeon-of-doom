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

## Successor Handover

- `HANDOVER.md` is the compact entry point for a fresh task.
- On 7 September 2026, lint, typecheck/build, all 54 unit tests, and all 23
  Chromium scenarios passed again for the M8 commit and push closeout.
- Only `main` exists locally and remotely; this is the primary checkout, with
  no linked worktrees. No M9 scope has been approved.
