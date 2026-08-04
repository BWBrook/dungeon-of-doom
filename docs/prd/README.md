# PRD Package

This package is the implementation handoff for the modern browser rebuild of
Dungeon of Doom.

It exists to keep the next phase grounded in a stable source of truth instead
of relying on long brainstorming notes, imperfect transcript summaries, or
literal BASIC structure.

Status: active implementation reference

Reading order:

1. `product_requirements.md`
2. `canon_and_errata.md`
3. `engine_domain_model.md`
4. `legacy_formats.md`
5. `parity_test_matrix.md`

The application now has a working Play, Editor, Creator, and Archive surface;
the package remains the source of product and mechanics decisions rather than
a historical milestone ledger.

Package goals:

- define the product shape before scaffolding
- lock canon and errata before porting behavior
- define the engine as the primary implementation target
- keep legacy BASIC save formats at the import/export boundary
- keep the active coding phase test-first, deterministic, and proportionate

Related material:

- `../brainstorming_plans.md` remains useful background but is not canon
- `../c64_code_fixes.md` remains useful archaeology but contains some
  recommendations that should not be applied blindly
- `~/games/c64/homebrew/dungeon-of-doom/docs/` contains the C64
  proofing notes that informed this package, especially around canon and
  validation discipline
