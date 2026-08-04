# Parity Test Matrix

## Purpose

The coding phase should begin with fixtures and golden tests, not ad hoc play.

This matrix defines the minimum behavior that must be pinned down before the
renderer becomes more than a thin shell.

Status: active behavior inventory. The rows describe distinct rules and
failure classes; they do not require one test function per row. Pure engine
and codec tests are the fast change gate, while the browser suite covers the
small number of end-to-end mode transitions.

## Test Suites

- codec tests
- engine rule tests
- canon divergence tests
- browser smoke tests

## Codec Tests

### C001 Hero Import

- Input: archival hero string fixture
- Verify: slot count, all eight stats, all twenty-four inventory slots, gold,
  treasure, and display label parse correctly

### C002 Level Import

- Input: archival level string fixture
- Verify: 225 cells, start position, and level id parse correctly

### C003 Hero Round Trip

- Input: archival hero string fixture
- Verify: import then export reproduces the original archival payload exactly

### C004 Level Round Trip

- Input: archival level string fixture
- Verify: import then export reproduces the original archival payload exactly

### C005 Treasure Byte Interpretation

- Input: archival hero string fixture
- Verify: the byte after gold is interpreted as treasure, not as a stray
  leading character in the display label

### C006 Mid-Game Save Overload

- Input: authored level fixture and legacy mid-game level fixture
- Verify: the codec distinguishes authored entrance metadata from saved current
  position semantics

## Engine Rule Tests

### E001 Facing Cycle

- Verify: left and right turning cycle through the four facings correctly

### E002 Movement Bounds

- Verify: forward movement never leaves the 15x15 dungeon

### E003 Wall Bump

- Scene: hero faces a wall
- Verify: position does not change and wall penalty is applied

### E004 Action Fatigue

- Scene: hero takes a valid input action
- Verify: the legacy fatigue tick is applied to strength

### E005 Passive Recovery

- Scene: hero strength is below baseline
- Verify: vitality-driven recovery occurs toward baseline

### E006 Trap Stickiness

- Scene: hero crosses a trap
- Verify: trapped state is set and movement can be blocked on later attempts

### E007 Trap Release

- Scene: trapped hero repeatedly attempts movement
- Verify: release check is deterministic under seed and can eventually free the
  hero

### E008 Exit Gate

- Scene: hero reaches exit without full experience gain
- Verify: exit is refused with the correct gate behavior

### E009 Vase Pickup

- Scene: hero gets a vase from the square ahead
- Verify: restorative stock increases correctly

### E010 Chest Pickup

- Scene: hero gets a chest from the square ahead
- Verify: treasure increases correctly

### E011 Idol Win

- Scene: hero gets the idol
- Verify: run ends in victory and score is computed

### E012 No-Light Reveal

- Scene: hero has zero light uses
- Verify: reveal fails with the no-light message

### E013 Reveal Area

- Scene: hero reveals in open space
- Verify: exactly the 3x3 neighborhood is revealed

### E014 Reveal Activates Monster

- Scene: reveal exposes multiple monsters
- Verify: the nearest one becomes active

### E015 Player Attack Hit Path

- Scene: active monster in range with deterministic seed
- Verify: hit path reduces monster hp and updates hero state correctly

### E016 Player Attack Miss Path

- Scene: active monster in range with deterministic seed
- Verify: miss path resolves cleanly and still applies appropriate turn costs

### E017 Monster Attack

- Scene: active monster reaches attack range
- Verify: armor mitigation and stat damage behave correctly

### E018 Monster Death

- Scene: active monster hp falls below threshold
- Verify: tile clears, experience increases, and kill messaging occurs

### E019 Item Breakage

- Scene: monster attack triggers breakage path
- Verify: the selected occupied slot is cleared correctly

### E020 Restorative Use

- Scene: hero has restorative stock and depleted current stats
- Verify: potion and salve restore to baseline values and decrement stock

### E021 Spell Source Gating

- Scene: hero lacks one or both magic sources
- Verify: only the valid spells are available

### E022 Superzap

- Scene: active monster present
- Verify: spell 1 defeats it immediately

### E023 Sanctuary

- Scene: hero stands on empty floor
- Verify: spell 2 creates a safe square at the hero location

### E024 Teleport

- Scene: teleport cast with deterministic seed
- Verify: destination is inside bounds and does not place the hero in a wall

### E025 Powersurge

- Scene: spell 4 cast with deterministic seed
- Verify: numeric RNG modifies strength and vitality coherently

### E026 Metamorphosis

- Scene: spell 5 targets a monster or occupied tile
- Verify: target transforms coherently and monster activation state is updated

### E027 Healing

- Scene: hero has depleted current strength and vitality
- Verify: spell 6 restores both to baseline values

### E028 Modern Save Fidelity

- Scene: mid-run state with visibility, spell charges, active monster, and
  partial light use
- Verify: modern save/load restores state exactly

## Canon Divergence Tests

### D001 Class Count

- Verify: the product exposes five classes, not the transcript's generic six

### D002 Spell Count

- Verify: the product exposes six spells, not eight

### D003 Reveal Size

- Verify: reveal is 3x3 in the modern engine

### D004 Generator Validation

- Verify: authored level validation requires entrance and exit

### D005 Legacy Save Artifacts Not Adopted

- Verify: modern save/load does not silently recompute spell charges, light, or
  baseline stats

## Browser Smoke Tests

These are post-engine tests.

### B001 Basic Run

- Load a fixture hero and level
- Move, reveal, attack, get, save, resume, and finish a run

### B002 Legacy Import Flow

- Import archival hero and level
- Start play successfully

### B003 Editor To Play

- Create a level in the editor
- Launch play mode directly from it

### B004 Creator To Play

- Create a hero in the creator
- Launch play mode directly from it

### B005 Archive Conversion

- Load or paste legacy HERO/LEVEL payloads in Archive mode
- Inspect or round-trip without mutating Play state
- Convert a legacy snapshot pair into a modern run explicitly

## Suggested Early Fixtures

- `warrior_starter`
- `cleric_starter`
- `wall_bump_level`
- `trap_escape_level`
- `reveal_guard_level`
- `idol_finish_level`

These fixtures should exist before significant UI work begins.
