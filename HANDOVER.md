# Handover to the next agent

Prepared 7 September 2026 for a fresh task in this repository. This is a
bootstrap note, not a new specification or an instruction to replay the old
conversation. Verify the live checkout, then use the current PRD and code.

## Start here

The product is a faithful, playable browser revival of the 1984 Usborne
Dungeon of Doom: small, dangerous dungeon rules with modern local saves and
integrated authoring tools. Barry wants a maintainable game that feels good to
play, not a literal BASIC port or an expanding framework.

**Project checkout: `~/games/dungeon-of-doom`.** M8 and this note
are included in the commit `Complete Lost Idol adventure and successor handover`
on `main`. The closeout request includes pushing that commit to `origin/main`.
Local and remote branch inspection found only `main`, and Git lists only this
primary checkout, with no linked worktrees to retire. Verify current status and
remote synchronization on arrival; the earlier uncommitted-work warning is
superseded by this closeout.

Read this note, `progress.md`, then `docs/prd/product_requirements.md` and
`docs/prd/canon_and_errata.md`. Consult the engine model, legacy formats, and
parity matrix in `docs/prd/` as the task requires. The long brainstorming notes
are background, not an active backlog or authority over the PRD.

## What has been built

The project began with book transcription and BASIC archaeology, then a
specification before application code. Committed work established a seeded,
deterministic engine, browser Play mode, legacy import/export, Dungeon Editor,
Character Creator, visual/audio identity, Archive workbench, and (M10) a level library, quest builder, and Lore
reference. These are five connected surfaces in one static application.

The latest approved implementation tranche, **M8 Adventure Progression**, is
recorded as complete in `progress.md` and included in this closeout:

- Adventure is the default Play route. The bundled Lost Idol quest has three
  authored levels: The Shattered Gate, The Black Galleries, and The Idol Vault.
- Non-final exits pause for explicit continuation. Resources carry forward
  exactly; entering a level resets placement, facing, and transient status,
  without healing or replenishment.
- Saves preserve single runs or whole adventure sessions, including the
  between-level state. Progress and terminal outcomes are visible in Play.
- Single Dungeon remains available for fixtures, imports, Editor, Creator,
  and Archive launches. Final escape without the Idol abandons the adventure;
  taking the Idol wins it.

No known M8 blocker remains. Automated checks were rerun for this closeout;
organic gameplay observations below come from the earlier M8 acceptance.

## Contracts worth retaining

- Book of Lore governs player-facing rules; corrected BASIC governs numeric
  mechanics and packed-format archaeology. Transcript and older fix notes are
  subordinate. See the PRD's explicit errata before changing mechanics.
- Maps are 15x15; five classes and six spells are canonical. Reveal is 3x3,
  consumes light, and activates discovered monsters. Only the nearest monster
  actively chases. Preserve inventory slot identity for the original formulas.
- `Game` owns one dungeon; `Adventure` owns progression. Seeded RNG and rules
  belong outside UI code. A level's exit target is the next whole experience
  value above entry experience; next-level depth cannot exceed current experience.
- Modern JSON is the runtime save contract: exact resources, baselines,
  visibility, monsters, RNG, and progression. The session envelope is version 1,
  containing run version 2 and, where applicable, adventure version 1. Earlier
  raw-run saves are deliberately unsupported; do not add speculative migration.
- Legacy HERO/LEVEL strings remain a supported import/export feature. Archive
  snapshot conversion explicitly reports information loss. This boundary does
  not justify reproducing lossy legacy behavior in modern saves.

The related C64 project at
`~/games/c64/homebrew/dungeon-of-doom` is useful evidence when
needed, but its hardware constraints and wishlist do not govern this product.
Original book art/text is not to be shipped inside the application.

## Code and verification

Application root: `src/web/`. Stack: Vite, vanilla TypeScript, Canvas 2D,
generated audio, Vitest, and Playwright; package manager is pinned in
`package.json`. Preserve this stack and the established visual language.

| Concern | Path under `src/web/src/` |
| --- | --- |
| Rules, RNG, types, fixtures, level construction | `engine/` |
| Adventure coordinator and authored quest | `adventure/model.ts`, `content/adventures/` |
| Single/adventure session dispatch | `play/session.ts` |
| Modern persistence and archival codecs | `persist/` |
| Authoring models | `editor/model.ts`, `creator/model.ts` |
| App wiring, Canvas, input, sound | `ui/` |
| Adventure progress/outcomes | `ui/adventureView.ts` |
| Unit/regression coverage | `tests/` |

`ui/app.ts` remains the integration point; adventure presentation was extracted
to keep it manageable. Browser scenarios live in `src/web/e2e/app.spec.ts`.

Run commands from `src/web/`: `pnpm dev`, `pnpm typecheck`, `pnpm lint`,
`pnpm test`, `pnpm build`, and `pnpm test:browser`. Build includes typecheck.
Install dependencies with `pnpm install` if absent; browser tests need Chromium
(`pnpm exec playwright install chromium`). Playwright manages Vite on port 4173.

Fresh closeout checks on 7 September 2026 passed: lint, typecheck/build,
54 tests across eight files, 23 Chromium scenarios, and `git diff --check`.
Earlier organic play completed the seeded Warrior quest and level one with the
Cleric spell route; desktop and narrow layouts were checked. Organic play was
not repeated at closeout, and these checks do not establish balance across
all classes/seeds. Recheck what matters for the next change. An earlier broad
Prettier check reported existing style drift; avoid unrelated formatting churn.
Generated build/test output and macOS metadata are removed during cleanup;
installed dependencies are retained for the next agent.

## Direction and working style

The current endpoint is a coherent playable revival through M10 (Authored
Adventures And Lore, September 2026; see `progress.md`). The agreed next
tranche is M11, a headless balance harness across classes and seeds. Barry's stated direction:
fully land the modern retro-clone first, then add expansion content in a
measured way, eventually letting a player choose vanilla or expanded. The
expansion menu lives in the C64 repo's `docs/enhancement_wishlist.md` and the
book's "Expanding the game" chapter in the transcript. Recommended restart:
confirm the baseline, play the adventure as a player, and recommend one
substantive next tranche based on actual friction or missing value. Treat that
recommendation as proposed scope, not inherited authorization.

Use these personal skills:

- [Twilight Laboratory](~/.codex/skills/twilight-laboratory/SKILL.md):
  work toward coherent outcomes, make routine decisions autonomously, and
  involve Barry when direction or consequential trade-offs need his judgment.
  Apply the collaboration cadence without imposing a scientific reporting ritual.
- [Kill Your Darlings](~/.codex/skills/kill-your-darlings/SKILL.md):
  keep the active flow legible, remove only demonstrably obsolete machinery,
  and scale tests to distinct risks. It does not authorize deleting supported
  modes, archival interoperability, or uncommitted work.
- [Develop Web Game](~/.codex/skills/develop-web-game/SKILL.md),
  when implementing or playtesting: use the existing browser tooling and test
  real interaction, feedback, and felt play as well as engine behavior.

Barry prefers targeted improvements, concise updates, meaningful tranches,
and one focused review/repair pass over repeated approvals and optional polish.
Do not reopen settled canon without evidence. Cloud sync, online sharing,
multiplayer, procedural generation, and deluxe expansion are outside the
current scope. Barry authorized this handover plus committing, pushing, and
cleaning up the current work. That closes M8; it does not commission new
features or deployment. Follow Barry's new-task instruction for the next
operating scope.
