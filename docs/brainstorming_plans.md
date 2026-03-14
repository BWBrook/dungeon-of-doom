# Question

Interested in a retro re-imagining project based on the Osborne book "Write Your Own Fantasy Game For Your Microcomputer", with a full code listing for the C64 (and other systems) . Are you familiar with it? The original code was written in BASIC, and I originally transcribed and ran it on my Commodore 64 back in the 1980s. 

Dungeon Of Doom was published as a type-in listing in the book Write Your Own Fantasy Games For Your Microcomputer.

The book is available for free as a PDF here: https://usborne.com/au/books/computer-and-coding-books (they link to an Usborne supplied version of the PDF here: https://drive.google.com/file/d/0Bxv0SsvibDMTel93SThEYkJkZHc/view?resourcekey=0-tcNIi_KcG38dlq7ttLdtaQ)

See also here: https://eggmceye.itch.io/usborne-dungeons-of-doom

There is also a BBC Micro version of it online here: https://bbcmicro.co.uk/game.php?id=3073

I've also partially transcribed the book text, as a markdown. See attached.

To start, do some detailed research on the book, "Write Your Own Fantasy Games for Your Microcomputer" and the game it focuses on, "Dungeon of Doom". This is in aid of assembling appropriate context for the next tasks I will request.


# Answer

Barry — here’s a tight research brief on the book and its showcase game, with primary sources cited throughout.

# Write Your Own Fantasy Games for Your Microcomputer (Usborne, 1984)

## Bibliographic core

* Authors: **Les Howarth** and **Cheryl Evans**. Programme editor: **Chris Oxlade**. Editor: **Jenny Tyler**. Designer: **Iain Ashman**. Illustrators: **Chris Riddell, Patrick Lynch, Rob McCaig, Simon Roulstone, Martin Newton**. 
* Publisher: **Usborne Publishing Ltd.**; UK first edition 1984; **ISBN 0-86020-835-4**; ~49 pages. ([computinghistory.org.uk][1])
* Official, free PDF distribution (non-commercial use, with credit and link back to Usborne page; adaptations permitted under those terms). ([Usborne][2])
* US reissue: *Fantasy Games/for Your Microcomputer* (Children’s Press, 1986). ([Amazon][3])

## Scope and structure

* The book is a guided build of a microcomputer RPG, centered on a complete type-in program, **Dungeon of Doom**. It mixes playable rules (“Book of Lore”), systematic program walkthroughs, and the full BASIC listing. Contents include: explanations (pp.10–23), **Book of Lore** (pp.28–31), listing (pp.32–45), debugging (p.24), expansions (pp.25–27). 
* Usborne positions its 1980s computing titles as free PDFs for personal/educational use; adaptations to modern languages are allowed, but hosting the original PDFs elsewhere and commercial reuse are disallowed. ([Usborne][2])
* Your transcript mirrors this structure and page map. 

# The example game: **Dungeon of Doom**

## Narrative frame

* Setting: beneath the ruined **Castle of Crekkan**; antagonist **Klimm**; ultimate objective is recovering the **Lost/Magic Idol** on the deepest level. 

## System design (how the program is organised)

* **Three-program architecture** to conserve RAM and encourage modularity:

  1. **Dungeon generator**, 2) **Character creator**, 3) **Game module**. Each is loaded separately from cassette. 
* **Data layout**: arrays initialised at the end of the listing (“INITIALIZATION”), then loaded and interpreted by the game module. 
* **Screen/map**: dungeon grid is **15×15** cells; rest of the screen reserved for messages and attribute display. 
* **Cross-machine design**: single listing with **conversion lines** for C64, VIC-20(+16K), Spectrum 48K, BBC Micro, Acorn Electron. 

## Character model and equipment

* **Attributes**: Strength, Vitality, Agility, Intelligence, **Experience**, Luck, **Aura**, **Morality**; modification points let you reshape stats and thus class. 
* **Classes** sketched (Barbarian, Knight, Scholar, Magician, Thief, Dwarf); buying rules differ by class; **bargaining** is explicitly modelled at the trading post.   

## Game loop & actions

* The **game module** loads a saved hero and a dungeon, checks experience vs. dungeon level to gate access, sets the hero at the entrance, and renders only changeable attributes on screen (e.g., STR, VIT, AUR, FACE, EXP).  
* **Player actions** include: Move, Change Direction, **Attack**, **Get**, **Reveal**, **Take Potion**, **Conjure**. The system implements **eight spells** and delegates battle outcomes to subroutines. 
* **Computer actions**: automatic activation of monsters and traps between player steps; then a status update step recalculates hero and dungeon state. 
* **Persistence**: uses **three cassettes** strategy—programs on one side, data on the other—plus **mid-game save** of position and attributes. 

## Programming idiom

* Described as a **“calculating database”**: everything is numbers; actions are decided by arithmetic over the relevant state arrays. Also uses **user-defined graphics** and simple sound. 

# Surviving versions & derivatives (useful for verification or porting)

* **BBC Micro**: playable online with notes; credits the original book and a community type-in/cleanup (“Brian”), and provides instructions and designed characters/levels. ([bbcmicro.co.uk][4])
* **Roguelike adaptation (C64-flavoured) by eggmceye**: merges character creation into the main game; replaces the manual generator with **procedural generation**; switches to **turn-based** play; compiled with **Blitz Basic**; fixes some combat omissions; provides keys and an annotated source. This is faithful to the spirit, not the letter, of the book. ([itch.io][5])
* **C64 code separation on GitHub** (character.bas, dungeon.bas, game.bas) mirrors the book’s three-module design. ([GitHub][6])

# Why it matters (for your next steps)

* It’s a quintessential **1980s educational type-in** that teaches modular game architecture under tight memory constraints, with clean separation of **content tooling** (generator/creator) from **runtime** (game module). The rules chapter (“Book of Lore”) gives a small but complete RPG ruleset you can **instrument** against the code paths. 

---

### Primary references

* Title page (credits). 
* Contents, Book of Lore and listing pages. 
* Official Usborne 1980s computer-books page and copyright/adaptation notice. ([Usborne][2])
* BBC Micro archive entry (playable). ([bbcmicro.co.uk][4])
* eggmceye RL adaptation (deviations and resources). ([itch.io][5])
* Bibliographic confirmation (ISBN, year). ([computinghistory.org.uk][1])
* Your working transcript for program structure, actions, attributes, and map specs.    

If you want a deeper dive (e.g., line-by-line BASIC analysis, the exact data tables/UDGs, or a portability plan to modern languages), say so and I’ll proceed.

[1]: https://www.computinghistory.org.uk/det/54789/Write%20Your%20Own%20Fantasy%20Games/?utm_source=chatgpt.com "Write Your Own Fantasy Games For Your Microcomputer - Book - Computing ..."
[2]: https://usborne.com/au/books/computer-and-coding-books "Computer and coding books from Usborne | Usborne | Be Curious"
[3]: https://www.amazon.com/Fantasy-Games-Your-Microcomputer-Write/dp/0516370316?utm_source=chatgpt.com "Fantasy Games/for Your Microcomputer (Write Your Own)"
[4]: https://www.bbcmicro.co.uk/game.php?id=3073 "Dungeon Of Doom"
[5]: https://eggmceye.itch.io/usborne-dungeons-of-doom "Usborne Dungeons of Doom RL by eggmceye"
[6]: https://github.com/HAnthonyHoyt/c64-dungeon-of-doom?utm_source=chatgpt.com "The BASIC game Dungeon of Doom for the C64. - GitHub"

### Initial reconnaissance

Yes—this is *Write Your Own Fantasy Games* (Usborne, 1984).
The core deliverable is **Dungeon of Doom**, split into three self‑contained BASIC listings (pp. 32‑46): dungeon‑generator, character‑creator, and game‑module. Each runs from cassette, hands control to the next, and stores state as ASCII strings in DATA statements and POKE’d screen memory. The flowchart on pp. 12‑13 outlines the game loop; the side‑bars on pp. 14‑19 annotate how global arrays and sub‑routines are organised. 

---

### What the original code is doing

| Module        | Responsibilities                                                                                    | Key global data                                                  |
| ------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Generator** | Draws a 15×15 dungeon map in screen RAM, lets user place symbols, then serialises to tape.          | `RM$`, `RL`, graphic symbol definitions                          |
| **Creator**   | Rolls attributes, lets player barter for gear, writes stats to tape.                                | `ST$` (strings of flags), several DATA blocks for prices/items   |
| **Game**      | Loads dungeon + hero, interprets single‑key commands (`M`, `A`, `C`, …), updates world, saves back. | 2‑D arrays for objects & monsters, message strings, sound tables |

Noteworthy quirks:

* **1‑based indexing** and liberal `GOTO`s—control flow is spaghetti.
* Heavy reliance on **numeric codes** (e.g. 0‑7 for sprites, 100‑199 for messages).
* Uses **screen characters as data** (graphics redefined via `POKE 53248, …`).
* **Persistence** = simply printing array contents to tape.

---

### Porting —principal questions

1. **ASCII vs. true graphics**

   * Keeping text‑mode fidelity is simplest (use `curses` or plain console).
   * For richer nostalgia, wrap a thin `pygame` or `tkinter` renderer later.

2. **Data representation**

   * Replace DATA lines with **JSON‑serialised dictionaries** or embedded fixtures.
   * Map the symbol table to `Enum`s; the dungeon grid to `list[list[int]]`.

3. **Control flow**

   * Break the loop on pp. 12‑13 into discrete functions: `reveal()`, `attack()`, `conjure()`… then dispatch via a `dict` of callables—no `goto`s.

4. **State persistence**

   * Pickle or JSON to disk; easier, faster, portable.

5. **Randomness & balancing**

   * Commodore’s `RND(1)` produced a uniform float (0,1). Python’s `random.random()` is a drop‑in.
   * Attribute/monster tables can be lifted verbatim, then tweaked once parity is proven.

---
Barry — let’s decide *how* to rebuild **Dungeon of Doom** before we touch a line of code. I’ll be blunt: the optimal route is a clean, modern re‑implementation that treats the 1980s BASIC as a *specification*, not as source to be preserved. Use the original listings to define rules and constants; write a fresh engine in a language that runs everywhere.

Below is a practical plan you can hand to your Codex CLI agent. It’s split into strategy, architecture, mechanics mapping, pseudocode, test strategy, and agent prompts (phase‑by‑phase). I assume the repo you showed is our starting point and remains the single source of truth for the original program.

---

## 1) Strategy (why this path)

**Goal:** a working prototype quickly, then iterative elaboration.

**Primary recommendation:** **TypeScript + Canvas/WebAudio** (Vite build).
Rationale:

* Zero install for end users; runs in any browser; deployment is a static site.
* The original rendering model (character cells, minimal sound, keyboard) maps trivially to Canvas 2D and WebAudio.
* Type safety + excellent tooling; unit tests with Vitest; deterministic RNG is straightforward.
* Future‑proof for expansions (UI polish, accessibility, mobile controls, save to `localStorage`, export/import JSON, shareable seeds).

**Secondary option (viable, but slower):** **Python** with **pygame** for desktop or **pygbag**/**Pyodide** for web. You’ll spend more time on packaging, input handling, and deployment, and you’ll give up some UI smoothness in the browser.

**Avoid**: “Transpile BASIC → JS/Python” or “write a BASIC interpreter.” Both are fun rabbit holes that delay reaching a robust game. Keep BASIC as the *oracle*, not the runtime.

---

## 2) Project architecture (web path)

**Monorepo layout (extend your existing repo):**

```
/docs/                    ← design notes, mapping tables, lore
/src/basic/               ← your original BASIC listings (read‑only spec)
/src/web/                 ← new modern implementation
  /engine/                ← pure logic (no rendering)
  /ui/                    ← canvas, input, audio, HUD
  /content/               ← data: tiles, items, messages, spells
  /persist/               ← save/load, JSON codecs, migration
  /test/                  ← unit/integration tests
```

**Engine/UI split** (non‑negotiable):

* **Engine**: grid, rules, state transitions, RNG; pure & testable.
* **UI**: rendering, input dispatch, audio cues; no game rules.
* **Persistence**: serializers; adapters for legacy “hero/level” encodings.
* **Content**: static data (tile catalog, messages, class definitions).

**Technical picks:**

* Tooling: **Vite** (TS), **Vitest**, **ESLint/Prettier**, **Playwright** (later).
* Rendering: Canvas 2D (no need for WebGL); font‑like sprite atlas optional.
* Input: keyboard (WASD or AZNM to echo the original).
* Audio: WebAudio for “j” tone bursts (map original `poke` sound patterns to short oscillators).
* Randomness: seedable PRNG (xorshift or Mulberry32) for determinism.

---

## 3) Canon extraction from the BASIC (what we must preserve)

Use the listings only to *define* the rules:

**World & files**

* Grid: **15×15**.
* Three artifacts: **character creator**, **dungeon generator**, **game module**.
* Files: `"hero"` (character) and `"level"` (grid + entry point + level index). We’ll supplant with JSON but keep importers from the original encodings for archaeology.

**Tiles** (from `dungeon_generator.bas` help and `game_module.bas` constants):

* `1` wall ⇒ impassable; small STR penalty on collision.
* `2` vase ⇒ on *Get*, increment two potion counters (used to restore STR/VIT).
* `3` chest ⇒ on *Get*, increment treasure count.
* `4` idol ⇒ win condition; computes score; ends run.
* `5` entrance ⇒ spawn point.
* `6` exit ⇒ level exit (message + exit handling).
* `7` trap ⇒ “stuck” flag (`tf`) until freed by stat/probability test.
* `8` safe place ⇒ special behaviour; some checks skip actions here.
* `9` guard ⇒ stationary monster (dynamic monster tiles are encoded as values > `c7`; the BASIC derives a strength metric `m = tile - c2`, with movement step `mv = m/16` and “monster strength” `ms = m*6`).

**Attributes & items**

* `f(1..8)` ≈ STR, VIT, AGI, INT, EXP, LUCK, AURA, MORALITY.
* Inventory `o(1..24)`, subset used actively in combat/defence: weapons (1..6), armour pieces (7..13), light (16), magic sources (17=necronomicon, 18=scrolls), potions (23,24).
* Direction vectors: `(0,-1) (1,0) (0,1) (-1,0)`; facing cycles N→E→S→W.

**Actions & keys (modern names)**

* `Move` (forward relative to facing).
* `Turn` (left/right cycle facing).
* `Attack` (`a`).
* `Get` (`g`) — interact with tile in front.
* `Potion` (`p`) — restore to STR/VIT maxima if you have the relevant potion.
* `Reveal` (`r`) — reveal 7×7 around, gated by experience/light.
* `Conjure` (`c`) — choose spell [1..6] if you possess source(s); decrements charges.

**Combat roughness** (from `game_module.bas`):

* Hit messaging (`t$(1..6)`), hit/miss rolls use STR, LUCK, weapon bonuses, `rnd(1)`, and monster “ms”.
* Armour reduces incoming damage (`h = h/(3 + sum(armour pieces))`).
* Kills clear the tile to floor; may “break” items (randomly zero out one carried item).

**Scoring**:

* `score = 10*treasure + gold*exp + STR + VIT + AGI` (per code path computing `thy score`).

We will treat ambiguities (e.g., exact spell behaviours, trap release probability, some typos in listing) as **hypotheses**, verify empirically, and lock them into tests.

---

## 4) Domain model (TS‑ish types)

```ts
type StatName = 'STR'|'VIT'|'AGI'|'INT'|'EXP'|'LUCK'|'AURA'|'MORAL';
type Stats = Record<StatName, number>;

enum Tile { Floor, Wall, Vase, Chest, Idol, Entrance, Exit, Trap, Safe, Monster /* + encoded */ }

type Facing = 'N'|'E'|'S'|'W';

interface Hero {
  name: string;
  classId: 'wanderer'|'cleric'|'mage'|'warrior'|'barbarian';
  stats: Stats;
  maxSTR: number;  // s1 in BASIC
  maxVIT: number;  // s2
  baseEXP: number; // s3 (for Reveal gating)
  facing: Facing;
  x: number; y: number;
  gold: number;
  treasure: number;
  items: Record<number, number>; // 1..24 counts
  spells: number[];              // m(1..6) charges derived from items*Aura
  light: number;                 // lt
}

interface Level {
  id: number;                    // le
  grid: Uint16Array;             // 225 cells; encode dynamic monsters as > Tile.Monster
  startX: number; startY: number;
}
```

---

## 5) Engine primitives (pseudocode)

**Deterministic RNG**

```txt
initRng(seed)
rand() -> [0,1)
randInt(a,b)
```

**Game loop (turn‑based)**

```txt
function step(input):
  if input is TURN: hero.facing ← rotate(hero.facing, input.dir)
  if input is MOVE:
    target ← frontCell(hero)
    if target is Wall: bumpBack(); hero.STR -= 0.03
    else if target is Trap: lockPos(); tf = 1
    else moveTo(target)

  if input is ATTACK: resolveAttack()
  if input is GET:    resolveGet()
  if input is POTION: consumePotion()
  if input is REVEAL: revealArea() // requires hero.light > 0 and EXP gating
  if input is CONJURE: castSpell()

  // passive recovery & fatigue
  if anyInput: hero.STR *= 0.99
  if hero.STR < hero.maxSTR: hero.STR += hero.VIT / 1100

  updateHUD()
  updateMonsters()     // move/resolve monster in view if encoded on tile
  if heroOnExit: message('exit from this level') // per BASIC
  if hero.STR <= 0: deathSequence()
```

**Attack resolution** (faithful to BASIC intent)

```txt
function resolveAttack():
  // compute H (our outgoing “hit power”)
  H = hero.STR
      + weaponBonus(items) 
      + randInt(0, hero.LUCK) 
  // miss check vs monster m
  if hero.AGI + hero.LUCK < randInt(0, m) + 2: miss()
  else:
    ms -= H
    hero.STR -= H/100
    hero.EXP += 0.05
    if ms <= 0: killMonster()
```

**Get resolution**

```txt
switch tileAhead:
  case Vase:    items[23]++, items[24]++, clearTile()
  case Chest:   treasure++, clearTile()
  case Idol:    winSequence()
  case Dynamic: // ignored; handled by attack or movement rules
  default:      // nothing
```

**Reveal**

```txt
if hero.light == 0: message('no light')
else if hero.EXP <= hero.baseEXP + 1: message('you need experience')
else reveal7x7Around(hero); hero.light--
```

**Potions**

```txt
if items[24] > 0 and STR < maxSTR: STR = maxSTR; items[24]--
if items[23] > 0 and VIT < maxVIT: VIT = maxVIT; items[23]--
```

**Spells** (names to fill from Book of Lore, but behaviours come from code branches)

* **#1**: multi‑pulse effect; if monster active, forcibly finishes it (sequence of tones then kill).
* **#2**: if floor, place a Safe tile (`c7`) at your feet (temporary sanctuary).
* **#3**: short‑range teleport (random `(nx,ny)`); screen flash.
* **#4**: buff (increase VIT and STR by random up to spell charges); decrements AURA.
* **#5**: scramble surrounding cells (illusion/chaos); also clears current monster if present.
* **#6**: full restore to `maxSTR` and `maxVIT`; consumes one charge.

(Where uncertain, we lock precise constants via tests against the listing behaviour.)

---

## 6) Persistence & interop

* **Modern save**: JSON blob `{ hero, level, seed, version }` to `localStorage` and downloadable file.
* **Legacy import**:

  * `hero` string format: parse `ot`, `f(1..8)`, `o(1..ot)`, `gc`, `tr`, `name-class` (original uses ASCII offsets `as=65`).
  * `level` string: 225 chars grid + `ix,iy,le` (ASCII offset `os=96`), originally written in chunks of 76 chars.
  * Provide a small script to turn BASIC tape text into JSON so players can bring in old creations.

---

## 7) Testing strategy (lock the spec first)

**Golden tests** (engine, no UI):

* Movement bump: walking into Wall reduces STR by `≈0.03` and reverts to prior cell.
* Trap lock/unlock: set tile `Trap`, verify `tf=1`, unlock probability depends on `LUCK` and current `STR` (> `0.8*maxSTR` improves release).
* Get semantics: Vase → potions; Chest → treasure; Idol → win + score formula.
* Attack: with fixed seed and items, assert deterministic `ms` decrement and EXP gain.
* Potions & Restore: refuse to over‑restore; decrement counts.
* Reveal gating: `light==0` → “no light”; insufficient EXP → “you need experience”.
* Monster loop: with “guard” tile value, assert “ms = m*6” and eventual clear upon kill.

**Round‑trip tests**:

* BASIC `hero/level` → JSON → Engine → save → JSON; fields preserved.

**UI smoke**:

* Render 15×15; HUD updates for STR/VIT/AURA/EXP face; message queue behaves.

---

## 8) Roadmap (phased; each with acceptance criteria)

**Phase 0 — Baseline artefacts**

* *Deliverables*: `docs/spec.md` (tiles, actions, stats), `docs/mapping.md` (BASIC→engine).
* *AC*: All constants and behaviours above written down; uncertainties listed.

**Phase 1 — Engine skeleton + CLI harness**

* *Deliverables*: pure engine with minimal CLI runner (Node) that loads a JSON level/hero and executes a script of inputs; unit tests pass.
* *AC*: Golden tests green.

**Phase 2 — Web shell (Canvas)**

* *Deliverables*: Vite app rendering grid + HUD; keyboard controls; messages; no monsters yet.
* *AC*: Move, Turn, Get, Exit/Idol, Save/Load work in browser.

**Phase 3 — Monsters & Combat**

* *Deliverables*: dynamic monsters (encoded tiles), attack loop, armour effects, break items, death sequence.
* *AC*: Deterministic test scene kills the guard, clears the tile, updates EXP/STR.

**Phase 4 — Magic, Reveal, Light**

* *Deliverables*: spell menu, charges, reveal logic, gating by light/EXP.
* *AC*: All six spells enact their effects; counters decrement; tests cover edge‑cases.

**Phase 5 — Level authoring**

* *Deliverables*: simple in‑browser editor or import from legacy `level` strings; export to JSON.
* *AC*: Round‑trip: design → play → save → reload.

**Phase 6 — Polish**

* *Deliverables*: sprite atlas, minimal SFX, accessibility options, documentation pages.
* *AC*: Ship a public demo (gh‑pages or itch.io).

---

## 9) “Prompt pack” for your Codex CLI agent

Use these *as‑is* task briefs. Each has an objective, constraints, and success checks. Feed them sequentially; do not skip acceptance criteria.

**Task 1 — Scaffold web workspace**

```
Create a TypeScript web app in ./src/web using Vite.
- Include: Vitest, ESLint, Prettier.
- npm scripts: dev, build, test, lint.
- Do not modify /src/basic; treat it as read-only.
- Add a top-level README section explaining the /src/web structure.

Success: `npm run dev` starts; `npm run test` executes a trivial test; README updated.
```

**Task 2 — Define domain types and constants**

```
In /src/web/engine, create:
- types.ts with Tile enum, Stats, Hero, Level, Facing, Input types.
- constants.ts with grid size, tile catalog, and mapping table for legacy tile indices (1..9) to Tile enum.
- prng.ts with a tiny seedable PRNG export { Rng }.

Success: unit tests assert mapping correctness and PRNG determinism across 100 draws.
```

**Task 3 — Implement pure engine core**

```
Create engine/Game.ts exposing:
- constructor({level, hero, rng})
- step(input): applies a single turn
- query: current HUD snapshot, visible cells, messages
- serialize(): { hero, level }
Implement: Move/Turn/Attack/Get/Potion/Reveal per the pseudocode spec.
No rendering code in engine.

Success: tests cover wall-bump penalty, vase/chest/idol semantics, potion restores, reveal gating.
```

**Task 4 — Monster encoding and combat**

```
Extend Game.ts with monster handling:
- Recognize dynamic monster tiles (> Safe threshold) and derive m, mv, ms as per BASIC (m = tile - c2; ms = m*6).
- Implement attack resolution and death cleanup; apply armour mitigation; random item breakage on kill.
- Add an engine test that seeds a guard in front of the hero and reproduces a deterministic kill sequence.

Success: tests green; no mutations to UI.
```

**Task 5 — Legacy importers**

```
Implement /src/web/persist/legacy.ts with:
- parseHeroString(s: string) -> Hero
- parseLevelString(s: string) -> Level
Assume ASCII offsets as=65 for hero stats/items; os=96 for level cells and coordinates.
Implement exporters to JSON.

Success: fixture strings round-trip back to same data; tests verify counts and coordinates.
```

**Task 6 — Canvas UI shell**

```
Create /src/web/ui/App.ts that:
- Renders a 15x15 grid (40x24 safe text margin unnecessary; use canvas 480x480).
- Draws hero, walls, special tiles using a simple sprite atlas or colored glyphs.
- Handles keyboard: arrows to move/turn, A=attack, G=get, P=potion, R=reveal, C=conjure.
- Shows HUD: STR, VIT, AURA, EXP, facing, messages.

Success: manual test in the browser: move, bump, get, exit, message scroll.
```

**Task 7 — Spells**

```
Implement a spell menu with 6 slots and behaviours matching engine.castSpell().
Map necronomicon/scrolls to available spells and charges.
Add unit tests for spell side-effects (safe tile, teleport, restore).

Success: tests green; UI updates spell charges live.
```

**Task 8 — Save/Load & shareable seeds**

```
Implement persist/save.ts to write/read to localStorage. 
Add import/export JSON buttons. 
Seed field in UI to re-seed the RNG for reproducibility.

Success: reload preserves state; exporting JSON and re-importing restores the run exactly.
```

**Task 9 — Level editor (minimal)**

```
A toggle that switches canvas to edit mode:
- Left click cycles tile types (Wall→Vase→Chest→Idol→Entrance→Exit→Trap→Safe→Guard→Floor).
- 'S' saves to JSON; 'L' loads JSON; 'E' exports legacy 'level' string.

Success: design a level, start the game with it, return to editor, and re-export.
```

**Task 10 — Polish & docs**

```
- Replace placeholder glyphs with a tiny sprite atlas.
- Add short SFX for hit/miss, kill, trap, spell.
- Write docs/spec.md capturing final rules, constants, and differences from the BASIC original.

Success: clean lighthouse-like bundle; docs published in /docs.
```

---

## 10) Risks, unknowns, and how we’ll resolve them fast

* **Spell semantics**: The listing telegraphs effects but not names. Use the Book of Lore transcript to label them; keep behaviours as per code. Where interpretation is fuzzy, write a micro‑scenario test and pin a decision.
* **Monster encoding**: The `m = tile - c2` trick implies stronger monsters at higher tile codes. Confirm by constructing tiles programmatically and observing `ms` and `mv` in engine tests.
* **Listing typos (“abx” vs “abs”, minor jumps)**: Treat them as transcription errors; prefer coherent mechanics over literal bugs. Document any departures in `docs/spec.md`.
* **Licensing**: Keep original text/art outside the bundle; link to Usborne’s page in README; ship only your code and your own assets.

---

## 11) Minimal pseudocode stubs (handy for the agent)

**Engine constructor**

```txt
Game(level, hero, rng):
  this.level = level
  this.hero  = hero
  this.rng   = rng
  this.messages = []
  this.visible = new Set()  // optional fog
```

**Front cell helper**

```txt
frontCell(hero):
  dx,dy = dirVector(hero.facing)    // N=(0,-1) etc.
  return clamp(hero.x+dx, 1, 15), clamp(hero.y+dy, 1, 15)
```

**Reveal**

```txt
reveal7x7Around(hero):
  for y in hero.y-3..hero.y+3:
    for x in hero.x-3..hero.x+3:
      if inside(x,y): visible.add(x,y)
  hero.light--
```

---

## 12) What the agent should *not* do

* Do **not** implement a BASIC interpreter.
* Do **not** tie game logic to rendering.
* Do **not** ship original Usborne art/text.
* Do **not** obscure randomness; seed everything and expose the seed.

---

If you want a Python path in parallel (pygame + a thin web export via pygbag), I’ll lay out an equivalent plan. Otherwise, feed the “prompt pack” verbatim to the Codex CLI agent and hold it to the acceptance criteria at each phase.

---

Acknowledged. I’ve read your full transcription (book + Book of Lore). Key refinements to my plan/spec:

* **Reveal radius**: Book of Lore defines **3×3** (not 7×7). Monsters revealed are immediately activated.
* **Movement keys (game)**: **B**=turn left, **N**=turn right, **M**=move forward. Keep A/Z/N/M only for editor/creator UIs.
* **Spell set & sources**: Exactly **six** spells; **I–III from Necronomicon**, **IV–VI from Scrolls**.
  I: *Superzap* (instant kill). II: *Sanctuary* (safe cell at current location). III: *Teleport* (random; fails on walls).
  IV: *Powersurge* (boost STR/VIT). V: *Metamorphosis* (random transform; may become another monster). VI: *Healing* (restore to starts).
* **Entrance/exit constraints**: Generator must enforce **≥1 entrance and ≥1 exit** to save; *last* entrance placed becomes the start.
* **Level gating**: Game compares **dungeon level vs EXP**; too deep → refuse and prompt to rewind/choose appropriate level.
* **Exiting**: You can **only exit** if EXP has increased (“YOU NEED EXPERIENCE” otherwise).
* **Traps**: “Sticky” (immobilise briefly), sap STR; repeated move attempts (and/or potion) to break free.
* **Attributes**: STR flickers with movement; idle slowly restores STR. Only STR, VIT, AUR, FACE, EXP are displayed; others still affect outcomes.
* **Monster semantics**: Any tile **> C7** is a monster; **strength/speed scale with tile code distance above C0** (higher code ⇒ tougher/faster).
* **Get actions**: Facing-interaction; Vase → potions; Chest → treasure; Idol → end quest and score.
* **Legacy formats**: `level` = 225 chars + entry (ix,iy) + level (le) with **`os=96`**; `hero` packed with **`as=65`**, name–class suffix; keep accurate importers.
* **Bargaining**: Random **BR ∈ {1,2,3}** discount; flags gate per-class purchases; potions/salves stack; others single-copy.
* **Book vs code divergences**: Where the listing shows typos/ambiguities, **prefer Book-of-Lore intent**; document any deliberate departures.

Ready for your next task.

# Question
Okay, I'm now at the command line in Ubuntu, in the ~/games folder. What are the setup steps I should execute, prior to firing up Codex CLI and providing the first prompt to it? We'll go with your TS/Vite/Canvas etc. approach for a browser-powered game. Makes total sense to me. I have these already installed and ready to go, along with pnpm etc.

# Answer
Barry — here’s the minimal, no-nonsense setup to get the repo ready for a TS/Vite/Canvas rebuild before you point Codex at it.

I’m assuming:

* you’re in `~/games`
* you either have the repo locally or can clone it
* Node ≥ 20 and `pnpm` are installed

---

## 0) Get the repo on disk and branch for the web port

```bash
# If you don’t already have it locally:
cd ~/games
git clone <YOUR-REMOTE-URL> dungeon-of-doom
cd dungeon-of-doom

# New branch for the modern web prototype
git switch -c web-prototype
```

Sanity: repo should already have `docs/dungon_of_doom_transcript.md` and `src/basic/*.bas`.

---

## 1) Create the web workspace (Vite + TS) in a subfolder

```bash
# Scaffold a vanilla TypeScript app (Canvas, not React)
pnpm create vite@latest src/web -- --template vanilla-ts
cd src/web
pnpm install
```

---

## 2) Add dev tooling (Vitest, ESLint, Prettier)

```bash
pnpm add -D vitest @vitest/coverage-c8 @types/node
pnpm add -D eslint eslint-config-prettier eslint-plugin-import eslint-plugin-unused-imports
pnpm add -D prettier
```

---

## 3) Tighten TS config and test config

Edit `tsconfig.json` (in `src/web`) to be strict and path-ready:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@engine/*": ["./engine/*"],
      "@ui/*": ["./ui/*"],
      "@content/*": ["./content/*"],
      "@persist/*": ["./persist/*"],
      "@test/*": ["./test/*"]
    }
  },
  "include": ["./**/*.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: { reporter: ['text', 'lcov'] }
  }
});
```

---

## 4) ESLint + Prettier (friction killers)

Create `.eslintrc.cjs`:

```js
module.exports = {
  root: true,
  env: { es2022: true, browser: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended', 'plugin:import/recommended', 'prettier'],
  plugins: ['unused-imports'],
  rules: {
    'import/order': ['warn', { 'newlines-between': 'always' }],
    'unused-imports/no-unused-imports': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  },
  ignorePatterns: ['dist']
};
```

Create `.prettierrc`:

```json
{ "semi": true, "singleQuote": true, "printWidth": 100, "trailingComma": "es5" }
```

Add scripts to `package.json` (inside `src/web`):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .ts",
    "format": "prettier -w .",
    "test": "vitest run",
    "tdd": "vitest"
  }
}
```

---

## 5) Lay down the engine/UI skeleton (empty but compilable)

Create folders:

```bash
mkdir -p engine ui content persist test
```

Create `engine/types.ts`:

```ts
export type StatName = 'STR'|'VIT'|'AGI'|'INT'|'EXP'|'LUCK'|'AURA'|'MORAL';
export type Facing = 'N'|'E'|'S'|'W';

export interface Stats { STR:number; VIT:number; AGI:number; INT:number; EXP:number; LUCK:number; AURA:number; MORAL:number; }

export enum Tile { Floor=0, Wall=1, Vase=2, Chest=3, Idol=4, Entrance=5, Exit=6, Trap=7, Safe=8, Monster=9 }

export interface Hero {
  name: string; classId: 'wanderer'|'cleric'|'mage'|'warrior'|'barbarian';
  stats: Stats; maxSTR:number; maxVIT:number; baseEXP:number;
  facing: Facing; x:number; y:number;
  gold:number; treasure:number;
  items: Record<number, number>;
  spells: number[]; light:number;
}

export interface Level { id:number; grid: Uint16Array; startX:number; startY:number; }
```

Create `engine/constants.ts`:

```ts
export const GRID_W = 15;
export const GRID_H = 15;
export const OS = 96; // legacy level ASCII offset
export const AS = 65; // legacy hero ASCII offset
```

Create `engine/prng.ts` (deterministic RNG):

```ts
export class Rng {
  private s: number;
  constructor(seed = 0x9e3779b9) { this.s = seed >>> 0; }
  next(): number {
    // xorshift32
    let x = this.s;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.s = x >>> 0;
    return (this.s >>> 0) / 0x100000000;
  }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
}
```

Create `engine/game.ts` (stub so it compiles):

```ts
import type { Hero, Level } from './types';
import { GRID_W, GRID_H } from './constants';

export class Game {
  level: Level; hero: Hero;
  constructor(opts: {level: Level; hero: Hero}) { this.level = opts.level; this.hero = opts.hero; }
  step(_input: unknown): void { /* to be implemented */ }
  snapshot() { return { hero: this.hero, levelId: this.level.id }; }
}

// Helper to make an empty level (for dev)
export function emptyLevel(id=1): Level {
  return { id, grid: new Uint16Array(GRID_W*GRID_H).fill(0), startX:1, startY:1 };
}
```

Create `persist/legacy.ts` (placeholders for later importers):

```ts
export function parseHeroString(_s: string) { throw new Error('todo'); }
export function parseLevelString(_s: string) { throw new Error('todo'); }
```

Create `ui/main.ts` to draw a grid and not crash:

```ts
import { emptyLevel, Game } from '@engine/game';
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const cell = 32, W = 15, H = 15;
canvas.width = cell*W; canvas.height = cell*H;

const level = emptyLevel(1);
const hero = { name:'Temp', classId:'warrior', stats:{STR:10,VIT:10,AGI:5,INT:5,EXP:0,LUCK:5,AURA:0,MORAL:5}, maxSTR:10,maxVIT:10,baseEXP:0,facing:'N',x:1,y:1,gold:0,treasure:0,items:{},spells:[0,0,0,0,0,0], light:0 };
const game = new Game({ level, hero });

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#888';
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    ctx.strokeRect(x*cell, y*cell, cell, cell);
  }
  // hero marker
  ctx.fillStyle = '#222';
  ctx.fillRect(hero.x*cell, hero.y*cell, cell, cell);
  requestAnimationFrame(draw);
}
draw();

window.addEventListener('keydown', (e) => {
  if (e.key === 'm') hero.y = Math.min(H-1, hero.y+1);
});
console.log('Game snapshot', game.snapshot());
```

Edit `index.html` (in `src/web`) to include a canvas:

```html
<body>
  <div id="app">
    <canvas id="game"></canvas>
  </div>
  <script type="module" src="/ui/main.ts"></script>
</body>
```

---

## 6) One tiny test to prove the harness

Create `test/prng.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Rng } from '@engine/prng';

describe('Rng', () => {
  it('is deterministic', () => {
    const a = new Rng(123), b = new Rng(123);
    const seqA = Array.from({length:5}, () => a.int(1,10));
    const seqB = Array.from({length:5}, () => b.int(1,10));
    expect(seqA).toEqual(seqB);
  });
});
```

Run:

```bash
pnpm test
pnpm dev
# open the printed localhost URL; you should see a 15x15 grid and a black hero square that moves down with 'm'
```

Commit:

```bash
git add .
git commit -m "Scaffold web prototype (Vite+TS), engine/UI skeleton, tooling"
```

---

## 7) Wire the modern workspace into the repo root

At repo root, add a short section to `/README.md` describing the web build:

````md
## Modern Web Reimplementation
The TS/Canvas port lives in `src/web`.

### Dev
```bash
cd src/web
pnpm install
pnpm dev
````

### Test

```bash
pnpm test
```

````

Commit:
```bash
git add README.md
git commit -m "Docs: add web build instructions"
````

---

## 8) (Optional now) Prepare GitHub Pages deploy

If you want a quick static deploy later:

```bash
# still in src/web
pnpm add -D gh-pages
# add to package.json
# "deploy": "vite build && gh-pages -d dist"
```

You can circle back once the prototype is playable.

---

## 9) You’re ready to invoke Codex CLI

From repo root, you now have a clean target for the agent. Your **first Codex task** should be Phase 1–3 from our plan (engine core + CLI tests, then Canvas shell). Here’s the exact first prompt I recommend:

> **Objective:** Implement the pure game engine (no rendering) in `src/web/engine/Game.ts` matching `docs/Book-of-Lore` rules.
> **Scope for this task:** movement (B/N/M), wall collision penalty, trap stickiness, GET interactions (Vase→potions, Chest→treasure, Idol→win), passive STR fatigue/recovery, HUD snapshot.
> **Constraints:**
>
> * No DOM/canvas in engine.
> * Deterministic RNG via `engine/prng.ts`.
> * Grid is 15×15. Treat any tile code > Safe as monster placeholder but DO NOT implement monsters yet.
> * Add unit tests in `src/web/test/engine.core.test.ts` covering: wall bump (STR −0.03, position unchanged), trap hold+release, GET semantics, STR flicker on move, recovery at rest.
>   **Acceptance:** `pnpm test` passes; `pnpm dev` still runs; engine exposes `step(input)` and `snapshot()`.

Run Codex from repo root, point it at `src/web`.

---

That’s it. You’ve got a clean scaffold, strict typing, tests wired, and a trivial canvas loop. Hand the engine work to Codex now.
