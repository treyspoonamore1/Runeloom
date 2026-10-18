# Decisions

Ambiguities resolved during development, and designer decisions that differ from the docs. Newest last.

| Date | Question | Decision | Reason |
|---|---|---|---|
| 2026-10-18 | Which TypeScript version? | 5.9.3, not 7.x or 6.x | typescript-eslint 8.71 supports TypeScript below 6.1; 5.9 is the most widely supported. |
| 2026-10-18 | Which Preact version? | 10.29.8, not 11.0 | Preact 11 shipped this month; 10.x is what the Vite preset and signals are proven on. |
| 2026-10-18 | Which Playwright version? | 1.56.1 | Matches the Chromium build preinstalled in the cloud dev environment. Locally, run `npx playwright install chromium` once. |
| 2026-10-18 | Where do player and enemy bodies live in src/sim? | `src/sim/actors/` | The CLAUDE.md layout had no home for movement and bodies. |
| 2026-10-18 | How is "no DOM in the sim" enforced? | `tsconfig.sim.json` typechecks `src/sim` and `data/` with no DOM or Node types, and ESLint bans `Math.random`, `Date`, `performance` and render/UI imports there | Mistakes fail `npm run check` instead of relying on review. |
| 2026-10-18 | Is the sim deterministic across all browsers? | Guaranteed within V8 (Node and Chromium). The sim avoids transcendental math where it can; replays from other engines may diverge | IEEE basic ops are identical everywhere, but `Math.sin` and friends are not specified bit-exactly. |
| 2026-10-18 | How does tuning reach the sim? | Each GameState owns a copy of the tuning values. The F2 panel edits the live copy. Replays store the tuning they were recorded with | Keeps the sim pure (no global mutable config) and replays exact. |
| 2026-10-18 | Units | Positions and distances in cells, time in seconds, speeds in cells per second. 1 tile = 4×4 cells, 1 cell = 8 px at 720p | DESIGN §4 and CONTENT §6. |
