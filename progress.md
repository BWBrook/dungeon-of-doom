# Current State

Dungeon of Doom is a private Vite + vanilla TypeScript + Canvas 2D browser
game. The active product surfaces are Play, Editor, Creator, and Archive.

The engine is deterministic and owns game rules; modern JSON is the runtime
save model; legacy HERO/LEVEL strings remain an explicit import/export and
archaeology boundary. The current cleanup work is focused on keeping the app
shell small, the active specification truthful, and verification proportional
to a single-owner project.

Primary checks from `src/web` are `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm build`, and the Playwright browser smoke suite.
