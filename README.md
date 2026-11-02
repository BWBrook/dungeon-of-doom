# dungeon-of-doom

> **Status:** developed in the open as a working record. This is work in progress: contents may change, and nothing here is peer-reviewed unless stated.

A modern browser re-imagining of the Dungeon of Doom game, with a deterministic TypeScript engine, legacy-format codecs, and design and balance notes. The game comes from the classic 1980s Usborne title *Write Your Own Fantasy Games for Your Microcomputer* by Les Howarth and Cheryl Evans (Usborne, 1984).

## Credit and the Usborne book

The book is copyright Usborne Publishing. The original text, rules pages and BASIC listings are **not included** in this repository. This is a fan project and is not endorsed by Usborne. Usborne offers the book as a free download for personal use at <https://usborne.com/au/books/computer-and-coding-books> (not re-checked on 2 November 2026: the site answered an automated request with HTTP 403). Please get the book from there.

The original code in this repository (the web app and tools) is the author's own re-implementation. Some design notes under `docs/` refer to `manuals/` and `src/basic/`: these are local, git-ignored working copies of the book material kept by the author for reference, and nothing in the build or tests reads them.

For a fresh agent or task, start with [HANDOVER.md](HANDOVER.md) for current state, essential decisions, and the suggested restart.

Pre-implementation product and engine planning for the modern re-imagining now lives in `docs/prd/`.

The first browser-game checkpoint now lives in `src/web/` as a Vite + vanilla TypeScript + Canvas 2D app with a deterministic engine, legacy codecs, fixture data, Vitest coverage, and Playwright browser smoke tests.

Useful commands:

- `cd src/web && pnpm install`
- `cd src/web && pnpm exec playwright install chromium` (first browser-test run only)
- `cd src/web && pnpm dev`
- `cd src/web && pnpm test`
- `cd src/web && pnpm test:browser`
- `cd src/web && pnpm build`
- `cd src/web && pnpm balance --seeds 30` (headless balance report; see `docs/balance/`)

## Licence

Code is released under the [MIT Licence](LICENSE). Text, figures and data created for this project are released under [CC BY-SA 4.0](LICENSE-CONTENT). Third-party material keeps its own terms where stated. The Usborne book and anything derived verbatim from it are not covered by either licence.
