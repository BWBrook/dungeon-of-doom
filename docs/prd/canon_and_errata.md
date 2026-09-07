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
- Preserve the original rules where they are legible and defensible.
- Prefer semantic messages and validation over silent BASIC failure modes.
- Keep legacy import/export as an archival bridge, not as the primary runtime
  data model.

## Open Interpretation Notes

- The Book of Lore should win on spell naming and reveal area.
- The BASIC should win on exact numeric formulas unless a line is clearly
  damaged.
- Where the lore expresses behavior but the BASIC is too broken to trust, the
  modern engine should choose the smallest coherent rule that matches the lore
  and document it in tests.
