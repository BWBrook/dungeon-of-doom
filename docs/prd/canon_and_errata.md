# Canon And Errata

## Source Precedence

When sources conflict, use this order:

1. `manuals/book_of_lore.md`
2. corrected behavior inferred from `src/basic/*.bas`
3. `manuals/dungon_of_doom_transcript.md`
4. repo notes in `docs/`

The related C64 repo is informative, especially for validation and discipline,
but this file governs the modern rebuild.

## Locked Canon Decisions

- Player-facing rules, controls, spell names, and core dungeon fiction come
  from the Book of Lore.
- Numeric mechanics, item math, and packed-format archaeology come from the
  BASIC.
- Obvious transcription bugs are fixed, not preserved.
- Obvious storage artifacts are documented, not treated as sacred design.

## Core Game Facts

- Dungeon size is 15x15.
- Legacy map logic is 1-based.
- The actual implemented class set is five classes:
  Wanderer, Cleric, Mage, Warrior, Barbarian.
- The actual implemented spell set is six spells.
- Player controls in canon are `B`, `N`, `M`, `A`, `G`, `P`, `R`, `C`, `S`.
- The game follows one hero through a short series of authored dungeon levels.
- Three levels form the bundled modern quest; the Idol appears only in its
  final level.

## Canon Rules To Preserve

- Reveal is 3x3, not 7x7.
- Bumping a wall reveals that wall. BASIC line 210 sends the bumped square to
  the draw routine at line 580; the modern engine lost this until M13, which
  left a player with the bump message and nothing on screen.
- Get lights the square ahead. BASIC line 1500 sends the target square to the
  draw routine at line 570, which also wakes a monster drawn there when none is
  active (lines 590-600). The modern engine lost this until M16, so an item
  taken in the dark left its square unexplored.
- Reveal requires light and consumes one light use.
- Monsters revealed by light are activated.
- Only the nearest monster should actively chase at a time.
- Each level sets its exit target to the next whole experience value above the
  hero's experience on entry.
- The next level cannot be deeper than the hero's current experience.
- Current stats, inventory, gold, treasure, spell charges, and light uses carry
  unchanged between levels.
- Entering the next level resets position, facing, and transient status only; it
  does not heal the hero or replenish any resource.
- Traps are sticky and can delay movement until the hero breaks free.
- Potions and salves restore strength and vitality to starting values.
- Spells I-III are sourced from the Necronomicon.
- Spells IV-VI are sourced from the Scrolls.
- The last entrance placed in a level is the start location.
- A valid authored level must contain at least one entrance and one exit.

## Engine-Facing Canon Decisions

- Modern runtime coordinates may be 0-based internally.
- Legacy import/export must preserve 1-based semantics at the boundary.
- Modern save state is not constrained by the legacy packed formats.
- Active monsters should be modeled explicitly as entities, not as renderer-only
  tile side effects.
- The engine should preserve slot-based inventory semantics because the BASIC
  formulas address item ranges directly.
- Single-dungeon simulation and adventure progression are separate engine
  concerns. The renderer owns neither.

## Errata And Corrections

### Transcript-level drift

- References to eight spells are non-canonical. The game supports six.
- References to the generic six-class fantasy example are non-canonical for the
  implemented game. The game uses five classes.

### BASIC defects to correct in the modern engine

- `abx(dx)` in monster attack range is a typo for `abs(dx)`.
- The Reveal loop is malformed and should be treated as a broken transcription.
- Teleport uses broken RNG/string arithmetic in the archival BASIC.
- Powersurge uses broken RNG/string arithmetic in the archival BASIC.
- `get` clamps to 0 at map edges in the archival BASIC; modern behavior must
  clamp to the valid dungeon bounds.
- Low-tier monsters should not become immobile because of integer-floor step
  math.

### Archival artifacts that are not modern design constraints

- Legacy mid-game save recomputes spell charges on load from magic item value
  and aura.
- Legacy mid-game save resets light on load if the torch item is present.
- Legacy mid-game save also redefines the loaded current strength, vitality,
  and experience as the new starting baselines.
- Legacy save data overloads the level format so that the stored entrance slot
  becomes the current hero position during save-game.

These behaviors matter for archaeology and legacy import/export, but they
should not define the modern runtime save model.

### Important correction to earlier fix notes

- The extra `CHR$(AS)` written after gold in `character_creator.bas` is not a
  stray leading `A`. In the archival data model it is the initial treasure
  field, which the game module reads before the display label. Any modern
  legacy codec must preserve that interpretation.

## Intentional Modernizations

- Replace cassette-era loading and saving with integrated browser flows.
- Gear breakage keeps the BASIC roll (one chance in monster power per monster
  hit, lowest occupied slot first) but adds a luck save using the trap-release
  idiom: the item holds when `int(rnd*8+1) < luck`. Playtesting showed the
  raw rate destroying a Warrior's whole kit on level one.
- Walking into a dormant monster reveals and activates it, per the Book of
  Lore ("monsters will attack"); the archival BASIC only refused the move.
- Break messages name the item from the item catalog. The BASIC's `w$` table
  is misaligned with the item list from slot 3 onward and is not reproduced.
- Superzap draws one aura per cast, as Powersurge and Healing already do in
  the BASIC. Without it the balance harness (M11) showed every magic class
  winning every seed because Necronomicon value times aura gave 12 to 32 free
  kills against 16 monsters.
- Metamorphosis turns the target into a vase, chest, trap, safe place, or a
  tier-one monster. The BASIC range also allowed an idol, entrance, or exit,
  which can create a second Idol or seal a doorway with an exit tile; neither
  is "some other object" in the Lore's sense.
- A monster's blow misses when a twenty-sided roll lands at or under the
  hero's agility. The BASIC gave monsters no miss chance, so a Cleric's runs
  were a fixed script: aura 7 always won, aura 6 always died. Agility now
  matters in defence as well as attack.
- Superzap succeeds when a ten-sided roll is at or under aura plus two, in
  the spirit of the Lore's warning that Teleport "may not work". Failure still
  spends the charge and the aura.
- The seeded generator scrambles its seed through a hash before use. Raw
  xorshift with small seeds produced only small first outputs, which biased
  the first roll of every seeded run.
- Rest (the `.` key) idles until strength reaches two-thirds of its base or
  the active monster stands beside a hero who is not on a safe square. Resting
  costs no strength, and the active monster acts on every idle turn, as in the
  archival loop. This restores the original's between-keypress recovery in a
  turn-based form. It is bounded at two-thirds because unbounded resting made
  the harness quest almost deathless: in the original, only real-world patience
  limited it.
- A trapped hero can pull free only when rested, at or above the rest ceiling,
  and then only with the luck roll. The BASIC required more than 80% of base
  strength, which a rested hero could never reach without a potion.
- A level that still holds the Idol cannot be left: its exit answers "YOU NEED
  THE IDOL", as the experience gate answers "YOU NEED EXPERIENCE". Walking onto
  the final exit in the dark used to end the quest unwon without warning.
- The hero can strike the active monster only within one square in any
  direction, the reach monsters already have. The BASIC checked only that a
  monster was active, so a hero could kill an approaching monster from across
  the room, or from a safe square, without being touched. The engine domain
  model already specified "in range".
- No blow may be struck from a safe square. The BASIC stopped monsters hitting
  a hero on a safe square but let the hero hit back, so a hero in sanctuary
  could kill an adjacent monster without risk, and Sanctuary's plentiful
  charges made that available anywhere. The rule is now symmetric: "NONE MAY
  FIGHT IN SANCTUARY". Spells may still be cast from one.
- Experience gains are rounded to two decimals. The canonical increments
  (0.05, 0.1, 0.2) accumulate floating-point error otherwise, and five
  Metamorphosis casts left a hero at 1.9999 with the exit gate closed.
- Preserve the original rules where they are legible and defensible.
- Prefer semantic messages and validation over silent BASIC failure modes.
- Keep legacy import/export as an archival bridge, not as the primary runtime
  data model.

## Expansion Content

Additions the original never had, approved by Barry one at a time and kept
additive: a player who leaves them alone plays the archival game.

- The warden's relic (M16, the first). Level two of the bundled quest holds a
  relic in its western dark, and a verse carved above the stair down tells of
  it. A relic spares its bearer the next killing blow, restoring strength and
  vitality to their starting values, and then crumbles. It is guarded by a
  warden, a new monster tier (legacy code 118: power 14, 84 hit points; the
  strongest archival monster is power 9) asleep at the only way in. The warden
  travels in a packed LEVEL string as a monster code the archival game would
  read as a power-14 monster. The relic has no legacy form: it is exported as
  floor, and a hero carrying one loses it on export.

## Open Interpretation Notes

- The archival game ran in real time. Its main loop never waits for a key
  (`GET` is non-blocking and line 310 loops back to 40): strength recovers by
  vitality / 1100 on every pass (line 260) and the active monster moves on
  every pass (line 300), while the 1% decay needs a keypress (line 250). So in
  the original, pausing restored strength and standing beside a monster got
  you hit repeatedly. The modern engine resolves one turn per action, so both
  effects happen once per keypress and resting is not a tactic. The M13 fog
  harness shows this makes exploration in the dark the dominant cost of the
  quest. M14 restores resting in the bounded form recorded above.

- The Book of Lore should win on spell naming and reveal area.
- The BASIC should win on exact numeric formulas unless a line is clearly
  damaged.
- Where the lore expresses behavior but the BASIC is too broken to trust, the
  modern engine should choose the smallest coherent rule that matches the lore
  and document it in tests.
