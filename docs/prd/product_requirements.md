# Product Requirements

## Summary

Dungeon of Doom will be rebuilt as a single browser product that preserves the
microcomputer feel of the original game while replacing cassette-era workflow
and opaque implementation quirks with a deterministic engine, modern save/load,
and integrated tooling.

The product is one game with four connected modes:

- Play mode
- Dungeon editor
- Character creator
- Archive workbench

Delivery order matters:

1. Play mode
2. Dungeon editor
3. Character creator

Legacy import/export for archival hero and level formats is an explicit product
feature. The quick import/export bridge belongs to Play mode; the Archive
workbench is an optional owner-facing archaeology tool, not an implementation
constraint on the core runtime.

## Product Vision

Preserve the soul of the 1984 game:

- small, legible rules
- dangerous dungeon pacing
- strong class and inventory identity
- simple but consequential magic
- visible ties to the original authored levels and saved heroes

Do not preserve the weakest parts of the 1984 delivery:

- cassette-driven module hopping
- fragile packed saves as the runtime state model
- transcription bugs
- screen-memory assumptions
- BASIC control-flow shape

## Design Pillars

- Faithful mechanics, modern ergonomics
- Spec first, engine first, renderer second
- Deterministic simulation over ad hoc UI logic
- Archival interoperability without archival UX baggage
- Minimal visual language with deliberate retro atmosphere

## Goals

- Build a rules-faithful web version that can be validated against the original
  BASIC and Book of Lore.
- Make the engine fully testable without a browser renderer.
- Support legacy hero and level import/export so the source repo remains
  materially relevant.
- Let players both play and author content in one product.
- Keep the UI fast, readable, and lightweight on desktop-class browsers.

## Non-Goals

- Emulating the BASIC programs line-for-line
- Emulating cassette or disk workflow in the modern runtime
- Shipping original Usborne art or book text inside the application
- Recreating PETSCII rendering as a hard requirement for v1
- Designing a deluxe roguelike expansion before the core game is stable

## Primary Audience

- Players curious about a faithful but playable revival of an obscure 1980s
  type-in RPG
- Designers and hobbyists interested in the original source material
- The repo owner, who wants a maintainable modern game rather than a museum
  replica of BASIC structure

## Product Shape

### Mode 1: Play

Core capabilities:

- begin the bundled three-level adventure or start a single-dungeon run
- carry the same hero and depleted resources through an adventure
- start a single run from a modern fixture hero and level
- import a legacy hero and level
- move, turn, attack, get, conjure, reveal, heal, save, and resume
- display messages, status, facing, inventory-derived capability, and win/loss
  state

### Mode 2: Dungeon Editor

Core capabilities:

- paint a 15x15 dungeon with semantic tiles
- validate authored levels against canon constraints
- export to modern JSON and legacy level format
- launch play mode directly from the authored level
- save levels to a local library and order them into a quest
- validate, save, export, and import quests, and play them as adventures

### Mode 3: Character Creator

Core capabilities:

- roll or seed starting attributes
- adjust points and derive class
- buy items through the original item/class restrictions
- export to modern JSON and legacy hero format
- launch play mode directly from the created hero

### Mode 5: Lore

A reference written in the product's own words: premise, keys, attributes,
character types, gear, monsters, traps, spells, and the authoring tools. It
replaces the role the printed Book of Lore played without shipping its text.

### Mode 4: Archive Workbench

The Archive workbench is intentionally separate from runtime persistence. It
can inspect and round-trip packed HERO/LEVEL payloads and convert a legacy
mid-game pair into a modern run with explicit loss warnings.

## UX Principles

- The engine owns rules, probabilities, and outcomes.
- The renderer owns only presentation, input collection, and animation timing.
- Player-facing language should follow the Book of Lore unless deliberately
  modernized for clarity.
- Historical quirks may be surfaced as optional notes, not as unavoidable UX.
- Save/load should be obvious and local-first.
- The game should feel concise and dangerous, not bloated.

## Technical Product Decisions

- Platform: browser
- Language: TypeScript
- Renderer: Canvas 2D
- Audio: lightweight generated effects
- Engine: pure deterministic module with seeded RNG
- Persistence: modern JSON save state plus legacy import/export adapters

## Out-of-Scope For First Implementation Pass

- Online sharing service
- Cloud sync
- Multiplayer
- Procedural dungeon generation
- Mobile-first controls
- Deluxe expansion mechanics from the C64 sandbox wishlist

## Milestones

### M0: PRD Signoff

Deliverables:

- this package
- locked canon and errata
- locked engine model
- locked legacy codec notes
- locked parity test matrix

### M1: Engine Vertical Slice

Deliverables:

- deterministic engine library
- fixture heroes and levels
- golden tests for movement, combat, reveal, get, spells, save state

Acceptance:

- the engine can run full turns without any DOM or Canvas code

### M2: Playable Browser Shell

Deliverables:

- Canvas renderer
- keyboard input
- HUD, messages, and save/load UI

Acceptance:

- a complete run can be started, played, saved, resumed, won, or lost

### M3: Legacy Interop

Deliverables:

- legacy hero import/export
- legacy level import/export
- validation and error messaging around malformed data

Acceptance:

- archival assets from the repo can be used inside the modern product

### M4: Editor And Creator

Deliverables:

- dungeon editor
- character creator
- transitions between authoring tools and play mode

Acceptance:

- a player can create a hero and a level entirely inside the web app, then play
  them immediately

### M5-M7: Playability And Archival Surfaces

Deliverables:

- Play command feedback, outcomes, and lightweight sensory identity
- Archive diagnostics and lossy legacy snapshot conversion

Acceptance:

- the active Play, Editor, Creator, and Archive surfaces remain usable through
  one static browser application, with modern run JSON as the only runtime save
  model

### M8: Adventure Progression

Deliverables:

- one bundled three-level adventure
- deterministic level transitions and exact hero carry-over
- adventure-aware modern save and resume
- stage and quest outcome summaries in Play mode

Acceptance:

- a hero can clear successive levels, retain depleted resources, save or resume
  at any stage, and recover the Idol in the final dungeon

### M9: Play Feel And Legibility

Deliverables:

- luck-gated gear breakage so a full kit survives a normal level
- dormant monsters wake when the hero walks into them
- the event line reports the whole turn in order, player result first
- play-first layout: compact masthead, two-column status, outcome panel
  beside the map, canvas that fills its frame

Acceptance:

- a first-time player can read what happened each turn without scanning the
  log, and finishes a level with most of their gear intact

### M10: Authored Adventures And Lore

Deliverables:

- local level library saved in the browser from the Editor
- quest builder that orders library levels into an adventure, with
  validation, save, export, and import as a modern JSON quest document
- authored quests selectable in Play and restorable from saves
- in-app Lore panel

Acceptance:

- a player can design a series of levels, assemble them into a quest, take
  any hero through it, save mid-quest, and resume, all without leaving the app

### M11: Balance Harness

Deliverables:

- headless auto-play harness over the real engine and adventure classes
- one archetype hero per class built through the Creator rules
- a CLI (`pnpm balance`) that reports win rate, death stage, gear loss, and
  restorative use per class across seeds, as a markdown table
- a findings note interpreting the first run

Acceptance:

- balance claims about the bundled quest cite the harness rather than a
  single playthrough

## Success Criteria

- The rules are understandable and stable enough that implementation decisions
  do not have to keep referring back to long-form brainstorming notes.
- The engine can be validated with repeatable tests rather than manual UI
  inspection alone.
- A user can play the game without understanding anything about the original
  tape workflow.
- The product still feels recognizably like Dungeon of Doom.
