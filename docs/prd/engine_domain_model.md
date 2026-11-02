# Engine Domain Model

## Purpose

The engine is the primary implementation target. It should be fully usable and
testable without any browser renderer.

The renderer, editor, creator, and import/export UI all sit on top of the same
engine package.

`Game` owns exactly one dungeon. `Adventure` composes successive `Game`
instances and owns progression, stage summaries, and adventure save state.

## Design Principles

- Pure deterministic state transitions
- Seeded RNG for every probabilistic action
- Semantic game objects, not screen-memory objects
- Slot-preserving inventory because legacy formulas depend on item ranges
- Explicit runtime state for anything the legacy save format blurred or lost

## Core Runtime Objects

### GameState

The complete current simulation state.

Suggested shape:

- `hero`
- `level`
- `monsters`
- `visibility`
- `messages`
- `activeMonsterId`
- `rngState`
- `turnCount`
- `runStatus`
- `exitExperienceTarget`
- `lastActionResult`

### HeroState

Suggested fields:

- `name`
- `displayLabel`
- `classId`
- `stats`
- `baseStats`
- `gold`
- `treasure`
- `facing`
- `position`
- `inventorySlots`
- `spellCharges`
- `lightUses`
- `status`

Notes:

- `stats` holds current strength, vitality, agility, intelligence, experience,
  luck, aura, and morality.
- `baseStats` holds the loaded or created baseline values used by potions and
  healing. Exit progression uses an explicit per-level target instead.
- `inventorySlots` is keyed by legacy slot id `1..24`.
- `spellCharges` is explicit runtime state even though legacy load derives it.
- `status` should at minimum include `trapped`, `won`, `dead`, and any future
  temporary flags.

### LevelState

Suggested fields:

- `id`
- `width`
- `height`
- `cells`
- `startPosition`
- `authoredEntrancePosition`

Notes:

- The authored entrance should be kept as level metadata.
- The hero position is runtime state and should never be stored back into the
  authored level representation.

### MonsterState

Suggested fields:

- `id`
- `legacyTileCode`
- `tier`
- `position`
- `hp`
- `stepSize`
- `active`

Notes:

- Legacy tile codes above safe-place range map to monsters.
- `hp` should preserve the BASIC strength relationship.
- `stepSize` is the movement rate derived from monster tier, but the modern
  engine should guarantee that valid monsters can move.
- The warden (legacy code 118, power 14) is expansion content, a tier above the
  three archival monsters.

### AdventureState

Suggested fields:

- `definitionId`
- `rootSeed`
- `stageIndex`
- `status`
- `completedStages`
- `stageEntryMetrics`
- `currentRun`

Notes:

- Stage seeds are derived deterministically from the root seed and stage index.
- A successful non-final exit pauses between levels until the player continues.
- Hero state carries exactly between levels except for placement, facing, and
  transient status flags.
- A level that still holds the Idol cannot be left by its exit; recovering the
  Idol wins the quest.
- A stage may carry a verse, shown between levels before it and on the
  progress panel while it is played.

## Enumerations And Catalogs

The engine should use metadata catalogs for:

- stats
- classes
- tile kinds
- item slots
- spell ids
- messages

Catalogs belong outside mutable runtime state.

## Coordinate Model

- Internal engine coordinates may be 0-based.
- Legacy import/export uses 1-based map semantics.
- Any codec translating to or from legacy data must perform the conversion
  explicitly.

## Tile Model

Minimum semantic tile kinds:

- `floor`
- `wall`
- `vase`
- `chest`
- `idol`
- `entrance`
- `exit`
- `trap`
- `safe`
- `relic` (expansion content; exported to legacy formats as floor)
- `monsterDormant`

Notes:

- The hero is not a tile.
- The active monster is not the renderer's responsibility; it is runtime state.
- The entrance tile can be preserved as authored metadata even if play mode no
  longer needs it after spawn.

## Inventory Model

Inventory must preserve legacy slot identity.

Recommended approach:

- keep `inventorySlots[1..24]` as raw numeric values
- keep a separate immutable item catalog that explains what each slot means
- expose semantic selectors in the engine layer rather than hard-coding ranges
  in UI code

Important slot groups:

- `1..8`: weapon and attack-adjacent items
- `9..14`: armor and defensive items
- `16`: light source
- `17`: Necronomicon
- `18`: Scrolls
- `23`: healing salves
- `24`: potions
- `25`: relic (expansion content, modern saves only)

This lets the engine remain faithful while still being readable.

## Turn Model

Each call to `step(action)` resolves one full game turn.

Recommended order:

1. Read the action and capture pre-turn state.
2. Resolve facing changes or intended movement.
3. Resolve immediate interaction with the destination or target square.
4. Resolve action-specific logic:
   attack, get, reveal, potion, spell, save intent, or movement.
5. Apply fatigue tick for any action that counts as an input.
6. Apply passive recovery toward baseline strength.
7. Update visibility and activation state.
8. Resolve the active monster turn, if any.
9. Resolve exit, win, and death checks.
10. Emit messages, sound cues, and derived UI state.

## Action Semantics

### Turn Left / Turn Right

- Change facing only.
- Do not move the hero.

### Move Forward

- Attempt to move one square in facing direction.
- Clamp to valid bounds.
- If blocked by wall, leave the hero in place and apply the wall-bump penalty.
- If a trap is crossed, set trapped state.
- If already trapped, a move attempt may instead trigger a break-free check.

### Rest

- Idles until strength reaches two-thirds of base, or the active monster is
  adjacent while the hero is off a safe square.
- No strength decay while resting; recovery and the monster's turn run on
  every idle turn, and each idle turn counts toward the turn total.

### Attack

- Attack only matters when an active monster is in range: within one square
  in any direction, the same reach the monster has.
- Attack formula should preserve the role of strength, luck, and weapon slots.
- Missing and damage should be deterministic under a fixed seed.

### Get

- Operates on the square directly in front of the hero, lighting it first
  (BASIC line 1500), which wakes a monster found there.
- Vase grants salve and potion stock.
- Chest grants treasure.
- Idol ends the quest and computes score.
- Relic goes to slot 25. The next killing blow instead restores strength and
  vitality to baseline and spends it.

### Reveal

- Requires light.
- Reveals a 3x3 square centered on the hero.
- Consumes one light use.
- Activates monsters discovered by the reveal.

### Use Restorative

- Uses salve and potion stock to restore current vitality and strength to
  baseline values.

### Conjure

- Spell availability depends on carried magic items.
- Spells 1-3 come from the Necronomicon.
- Spells 4-6 come from the Scrolls.
- Runtime spell charges are explicit state.

## Spell Behaviors

### Spell 1: Superzap

- Instantly defeats the active monster if one exists.

### Spell 2: Sanctuary

- Creates a safe tile at the hero location if the location is empty.

### Spell 3: Teleport

- Chooses a random valid location.
- Must not place the hero inside a wall.
- If the attempted target is invalid, the modern engine should resolve the
  failure coherently and deterministically.

### Spell 4: Powersurge

- Grants a temporary current-stat boost to strength and vitality.
- Consumes aura according to the legacy behavior.

### Spell 5: Metamorphosis

- Randomly transforms the current target/location contents.
- Can turn a monster into another monster or into a non-monster.

### Spell 6: Healing

- Restores current strength and vitality to baseline values.
- Consumes aura according to the legacy behavior.

## Visibility Model

- The hero reveals the square occupied through movement.
- Revealed squares stay known for the duration of the run.
- Reveal expands visibility in a 3x3 area.
- Visibility should be tracked independently from renderer concerns.

## Messaging And Events

The engine should emit structured results, not just mutate state.

Suggested result fields:

- `messages`
- `sounds`
- `cellsChanged`
- `heroChanged`
- `monsterChanged`
- `runStatusChanged`

This keeps Canvas and tests thin and honest.

## Runtime Saves

Modern runtime save should preserve:

- full hero state
- full level state
- explicit monster state
- exact spell charges
- exact light uses
- baseline stats
- visibility
- active monster
- RNG state
- the current exit experience target
- adventure stage, completed-stage summaries, and root seed when applicable

Do not use legacy packed hero/level strings as the main runtime save model.
