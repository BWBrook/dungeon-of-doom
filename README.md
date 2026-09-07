# dungeon-of-doom
Transcription, BASIC code and modernisation of the Dungeon of Doom game, as described in the classic 1980s Usborne title "Write Your Own Fantasy Games for Your Microcomputer". 

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
