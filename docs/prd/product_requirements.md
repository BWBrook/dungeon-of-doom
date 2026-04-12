# Product Requirements

## Summary

Dungeon of Doom will be rebuilt as a single browser product that preserves the
microcomputer feel of the original game while replacing cassette-era workflow
and opaque implementation quirks with a deterministic engine, modern save/load,
and integrated tooling.

The product is one game with three connected modes:

- Play mode
- Dungeon editor
- Character creator

Delivery order matters:

1. Play mode
2. Dungeon editor
3. Character creator

Legacy import/export for archival hero and level formats is an explicit product
feature, not an implementation constraint on the core runtime.

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

- start a run from a modern fixture hero and level
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

### Mode 3: Character Creator

Core capabilities:

- roll or seed starting attributes
- adjust points and derive class
- buy items through the original item/class restrictions
- export to modern JSON and legacy hero format
- launch play mode directly from the created hero

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

## Success Criteria

- The rules are understandable and stable enough that implementation decisions
  do not have to keep referring back to long-form brainstorming notes.
- The engine can be validated with repeatable tests rather than manual UI
  inspection alone.
- A user can play the game without understanding anything about the original
  tape workflow.
- The product still feels recognizably like Dungeon of Doom.
