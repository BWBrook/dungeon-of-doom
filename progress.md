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

## M12 Balance Pass

- Rules: Superzap costs one aura; Metamorphosis yields vase, chest, trap,
  safe, or tier-one monster; experience rounds to two decimals (fixes a
  floating-point exit lock found by the harness).
- Content: level two sharpened, level three Idol behind a guarded vault door.
- Harness: careful, reckless, and completionist bots; per-level death and
  restorative columns; `--styles` flag; band regression test.
- Stochastic pass: monsters miss on a d20 under agility; Superzap succeeds
  on a d10 under aura plus two; RNG seeds are hashed to remove first-roll bias.
- Result (careful bot): Barbarian 100%, Warrior 100%, Wanderer 98%, Cleric
  75%, Mage 92% wins; reckless fighters 96 to 97%. Level one is a warm-up
  by decision. See `docs/balance/findings-2026-09-13.md`.

## M13 Fog-Limited Harness

- The harness bot now reads a `BotView`; `omniscientView` reproduces M12
  exactly, and `fogView` is built from the engine `Snapshot` the Canvas draws.
  The fog bot explores toward the nearest dark square, treats dark border
  squares as walls, and rations reveals across the levels ahead.
- Engine: a bumped wall is now revealed, restoring BASIC line 210.
- Bracket (careful, 50 seeds): with the map 80 to 100% wins; without it 0 to
  2%. Deaths without the map come on level three after exploration attrition
  spends the potions; level one never kills a careful player.
- The original was real time: its main loop recovered strength on every pass,
  so resting worked. The turn-based engine lost that. Resting and the Idol
  Vault exit hazard are open decisions. See
  `docs/balance/findings-2026-09-23.md`.

## M14 Resting And The Idol Vault

- Rest (`.`) idles up to two-thirds of base strength unless a monster is at
  hand; unbounded canonical resting made the quest almost deathless, so the
  harness set the ceiling. A trapped hero pulls free only when rested.
- A level holding the Idol cannot be exited ("YOU NEED THE IDOL"); the
  adventure's abandoned outcome no longer exists.
- Attacks reach one square, like monsters'. The engine previously allowed
  striking from anywhere, including from a safe square.
- The Idol Vault: the entrance tier-two became a vase, and two tier-two
  monsters on the way to the vault were removed.
- Bot: potions out of combat only when resting is impossible; rest before
  deliberate fights; the rest line never sits below the danger line.
- See `docs/balance/findings-2026-09-24.md`. Open: the Cleric is the hard
  class on a first visit; attacking from a safe square is an unmodelled
  exploit.

## M15 Sanctuary And The Cleric's Blessing

- Barry: keep the Cleric the hardest class, and reward it with a unique
  blessing on taking the Idol (an Easter egg, so not in the Lore). Forbid
  attacking from a safe square as a logical exploit fix.
- Balance matrix unchanged by the sanctuary rule; the bot now rests, casts, or
  steps off when a monster reaches it on a safe square.
- Proposed, not built: a guarded relic on level two, announced by a cryptic
  verse. Exploratory duels (scratch, 200 seeds) show no existing tier threatens
  a rested hero, so the guardian would need power near 20 for a real choice.

## M16 The Warden's Relic

- Barry approved the relic as the first expansion content, additive so that
  heeding the verse keeps the archival game. A relic at the west end of level
  two's bottom row spares its bearer one killing blow. A warden (code 118,
  power 14, 84 HP) sleeps in the niche mouth. The verse shows between levels
  and on the level-two progress panel. Power 20 proved far too lethal in the
  adventure, because the canonical to-hit roll scales with monster power;
  power 14 was chosen from a 12/14/16 sweep.
- Get lights the square ahead (BASIC line 1500). Without it, a seeking bot
  pressed Get on a spent relic's dark square forever.
- Harness: `--relic heed,seek`, verse knowledge for fog bots, Relic taken and
  Saved columns, and seeded explorer variation. The fog bot had walked one
  route per level, so every earlier first-visit figure carried route luck;
  the Cleric's published 62% is about 34% on the old layout.
- The warm-up band is now a rate (at most one level-one death in forty careful
  dark runs). The careful Mage's rare warm-up death, 2 of 50 in M14, landed on
  a band seed once routes varied.
- A bot that never reads the verse wakes the warden on 24-61% of level-two
  visits (the Mage's first-visit win falls from 86% to 52%), so the vanilla
  experience needs the verse heeded.
- See `docs/balance/findings-2026-09-26.md`. Open: whether to warn before
  contact with a warden; authoring tools for verses, relics, and wardens
  (quest JSON carries them; the Editor and Quest Builder do not).

## Successor Handover

- `HANDOVER.md` is the compact entry point for a fresh task.
- On 7 September 2026, lint, typecheck/build, all 54 unit tests, and all 23
  Chromium scenarios passed again for the M8 commit and push closeout.
- Only `main` exists locally and remotely; this is the primary checkout, with
  no linked worktrees. No M9 scope has been approved.
