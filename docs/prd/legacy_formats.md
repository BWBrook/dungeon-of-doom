# Legacy Formats

## Purpose

The legacy formats matter for archival compatibility and source validation.

They do not define the modern runtime save model.

## Constants

- `AS = 65`
- `OS = 96`
- dungeon size = `15 x 15`
- level payload length = `225 + 3 = 228` bytes

## Legacy Hero Format

### Overview

The hero file is a packed character string written by the character creator and
later re-read by the game module.

The modern codec should treat it as:

1. item-slot count byte
2. eight stat bytes
3. twenty-four inventory-slot bytes
4. gold byte
5. treasure byte
6. display label string

### Byte Layout

#### Byte 1

- `ot + AS`
- in the archival BASIC this is `24 + AS`

#### Bytes 2-9

The eight stats in creator order:

1. strength
2. vitality
3. agility
4. intelligence
5. experience
6. luck
7. aura
8. morality

#### Bytes 10-33

- inventory slot values `1..24`
- these are stored as `slotValue + AS`

#### Byte 34

- gold stored as `gold + AS`

#### Byte 35

- treasure stored as `treasure + AS`

#### Bytes 36-end

- display label string
- archival format is `name + " -" + class`

## Important Hero-Format Notes

- The extra `CHR$(AS)` after gold in the creator output is the initial treasure
  field, not a stray `A`.
- The modern legacy importer must preserve that interpretation exactly.
- Inventory slots are raw numeric values, not simple booleans.
- Mid-game save rewrites current stats back into the same packed structure.

## Legacy Level Format

### Overview

The level format is a packed grid string followed by three metadata bytes.

The modern codec should treat it as:

1. 225 map bytes, row-major
2. start x
3. start y
4. level id

### Byte Layout

#### Bytes 1-225

- raw map character codes
- stored row-major across the 15x15 dungeon

#### Byte 226

- start x stored as `x + OS`

#### Byte 227

- start y stored as `y + OS`

#### Byte 228

- level number stored as `level + OS`

### Record Chunking

The archival BASIC writes this as three 76-character records.

That chunking is an I/O artifact, not part of the semantic level model.

## Tile-Code Interpretation

### Derived Constants

- `c0 = OS + 6 = 102`
- `c1 = c0 + 1` wall
- `c2 = c0 + 2` vase
- `c3 = c0 + 3` chest
- `c4 = c0 + 4` idol
- `c0 + 5` entrance
- `c5 = c0 + 6` exit
- `c6 = c0 + 7` trap
- `c7 = c0 + 8` safe place
- `c0 + 9` to `c0 + 11` original monster range from generator output

Notes:

- The game module does not name the entrance constant directly because it uses
  the stored start coordinates instead.
- Monster behavior begins above the safe-place range.

## Legacy Save Overloading

The archival mid-game save overloads the authored level format:

- authored level writes the entrance position
- mid-game save writes the current hero position into those same slots

The modern system must not copy that design internally.

## Legacy Runtime Derivations

When the archival game module loads a hero:

- current loaded strength becomes the new baseline strength
- current loaded vitality becomes the new baseline vitality
- current loaded experience becomes the new exit-gating baseline
- spell charges are recomputed from carried magic item values and aura
- light is restored from torch possession

These are legacy behaviors that matter for archaeology and optional legacy
round-tripping, but modern runtime saves should preserve explicit current state
instead.

## Codec Policy

### Import

Legacy import should:

- parse packed bytes into semantic runtime structures
- preserve slot values exactly
- preserve display label exactly
- convert legacy coordinates into internal engine coordinates
- validate malformed or impossible inputs and fail clearly

### Export

Legacy export should:

- support archival hero export
- support archival authored level export
- support optional legacy-style save snapshot export only if explicitly desired

The default in-product save and load flow should always use modern JSON state.

## Recommended Fixtures

Create codec fixtures for:

- a freshly created hero
- a mid-game saved hero
- an authored level
- a mid-game saved level

These fixtures should be used in parity tests before any UI layer is trusted.
