# Runeloom: agent instructions

Runeloom is a top-down action RPG where players build spells from runes and every element changes a simulated world. Read these before starting work:

- `docs/DESIGN.md`: what the game is, its systems, formulas and budgets
- `docs/CONTENT.md`: data tables (runes, enemies, items, rooms)
- `docs/BUILD_PLAN.md`: milestone order and acceptance criteria

If code and docs disagree, the docs win unless the designer decided otherwise. Record every such decision, and every ambiguity you resolved yourself, in `docs/DECISIONS.md` (date, question, decision, reason).

## Stack

- TypeScript (strict), Vite, PixiJS v8 for the game canvas, Preact with `@preact/signals` for the DOM overlay UI (menus, Loom editor, passive tree in SVG, console).
- Vitest for unit and scenario tests, Playwright for screenshots and browser tests, ZzFX for sound effects, lil-gui for the tuning panel, `pixi-filters` for bloom.
- Use the current stable version of each at project start and pin exact versions in `package.json`.
- No other engine or framework. No backend.

## Layout

```
CLAUDE.md
docs/          DESIGN.md, CONTENT.md, BUILD_PLAN.md, DECISIONS.md
src/
  sim/         pure deterministic game logic
    core/      loop, rng, hash, math, spatial hash
    grid/      materials, chemistry rules, fields
    weave/     notation parser/printer, compiler, runtime
    actors/    player and enemy bodies, movement, collision
    combat/    stats, damage, ailments
    ai/        enemy behaviors
    world/     room parser, puzzles, rifts
    items/     items, affixes, crafting, fuse
    hero/      character: level, XP, runes, equipment, passives, HeroMods
    meta/      hearth, rekindle (M7)
  render/      PixiJS; reads sim state, never writes it
  ui/          Preact overlay
  audio/       ZzFX presets and playback
  app/         bootstrap, input, scenes, saves, replays
data/          content modules (*.ts), tuning.ts, rooms/<region>/*.txt
tools/         sim CLI, bench, data validation, screenshots
tests/         mirrors src/
```

## Architecture rules

These are not optional. Breaking them breaks testing, replays and the DPS readout.

1. `src/sim/` is pure and deterministic. No DOM, no Pixi, no `Math.random`, no `Date` or `performance.now`, no async, no I/O. All randomness comes from the seeded `Rng`. The sim must run identically in Node and in the browser.
2. Fixed timestep: entities step at 60 Hz, the grid at 20 Hz (every 3rd tick). Rendering interpolates and never mutates sim state.
3. The sim advances with `step(state, input)`, where input is plain data (move vector, aim point, buttons). Replays, bots and the DPS worker all use this same entry point.
4. Every tunable number lives in `data/` (content) or `data/tuning.ts` (feel). No magic numbers in systems code.
5. Content is TypeScript modules typed with `satisfies`. Ids are string literals. `npm run validate` checks that every cross-reference resolves.
6. Room files are plain text. The parser takes a string; the browser imports rooms with Vite `?raw`, tools read them from disk.
7. Wall-clock time is used only for offline progress (M7), outside `src/sim/`.

## Commands

Create these in M0 and keep them working.

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run check` | Typecheck, lint, data validation, unit tests. Must pass before every commit |
| `npm run sim -- <args>` | Headless runner: scenarios, weaves, replays, balance reports |
| `npm run bench` | Sim and grid performance benchmarks against DESIGN §12 |
| `npm run shots` | Playwright screenshots of debug scenes into `shots/` |
| `npm run build` | Static production build into `dist/` |
| `npm run validate` | Data cross-reference checks |

## How to work

- Work milestone by milestone, task by task, in the order in `docs/BUILD_PLAN.md`.
- Every chemistry rule and every rune gets a unit test. Every bug fix gets a regression test.
- After any visual change, run `npm run shots` and look at the images before saying it works. Say what you see.
- You can't judge feel. When a value is a feel call, expose it in the tuning panel and list it in the milestone report.
- Commit after each completed task, with a message that says what changed. Keep commits small.
- Keep files under about 400 lines. Split by responsibility.
- When the design is ambiguous, pick the simplest option that fits the pillars (DESIGN §2), log it in `docs/DECISIONS.md`, and keep going. Ask the designer only about decisions that change scope or direction.
- When the designer sends playtest notes, address them before starting the next milestone. Apply tuning JSON they paste into `data/tuning.ts` exactly.
- End every milestone with the report described at the top of `docs/BUILD_PLAN.md`.

## Debug features

Available in dev builds from M0 onward. The designer relies on them for feedback.

| Key or command | Does |
|---|---|
| `` ` `` | Dev console: `spawn <enemy> [n]`, `give <rune>`, `weave <slot> <notation>`, `level <n>`, `seed <n>`, `room <id>`, `god`, `timescale <x>`, `killall`, Hearth: `embers <n>`, `ash <n>`, `building <id> <level>`, `rifttier <n>`, `offline <hours>`, `hearth` (go to the hub) |
| F1 | Overlays: material, fire, charge, wet, owner, AI targets, hitboxes |
| F2 | Tuning panel with a Copy JSON button |
| F9 | Save a replay (seed plus input log) to a file. `npm run sim -- --replay <file>` reproduces it |
| Debug overlay | FPS, sim ms, grid ms, live spell instances, dropped spawns, state hash |
