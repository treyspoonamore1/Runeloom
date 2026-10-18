# Runeloom: design and build package

A top-down action RPG. You weave your own spells from runes, and every element you cast changes a simulated world: fire spreads through grass, frost freezes rivers into bridges, lightning races through water and metal.

This package is everything a coding agent needs to build it, milestone by milestone.

| File | What it is |
|---|---|
| `CLAUDE.md` | Rules for the coding agent: stack, architecture, commands, how to work. Goes at the repo root |
| `docs/DESIGN.md` | The game design: pillars, systems, formulas, starting numbers, budgets |
| `docs/CONTENT.md` | Content tables: runes, reference weaves, spindles, enemies, room format, passives, rooms |
| `docs/BUILD_PLAN.md` | Milestones M0 to M8 with acceptance criteria and playtest questions |

## How to use it

1. Create an empty git repo. Put `CLAUDE.md` at the root and the `docs/` folder next to it.
2. Open a Claude Code session in that repo and paste the kickoff prompt below.
3. At the end of each milestone, play the build, fill in the playtest template at the bottom of `docs/BUILD_PLAN.md`, and paste it back with the next-milestone prompt.

Your job is feel and fun. The agent can prove that things work; only you can tell whether they feel good. The F2 tuning panel lets you adjust feel values live and copy them out as JSON.

## Kickoff prompt

```
Read CLAUDE.md, then docs/DESIGN.md, docs/CONTENT.md and docs/BUILD_PLAN.md in full.

We're building Runeloom. Do Milestone 0 and then Milestone 1 from docs/BUILD_PLAN.md.
Work through the tasks in order and verify every acceptance criterion yourself with
tests, headless sims, benchmarks and screenshots you actually look at. Commit as you go.

Stop when M1 is done and give me the end-of-milestone report described in
docs/BUILD_PLAN.md, including the playtest questions.
```

## Next-milestone prompt

```
Here are my playtest notes for M<n>:

<paste the filled-in template>

Address these notes first. Then do Milestone <n+1> from docs/BUILD_PLAN.md with the
same rules, and stop at the end with the end-of-milestone report.
```

## Tips

- M2 (the Loom) and M3 (the chemistry grid) are where the game's identity shows up. Spend real time playtesting them before moving on.
- If a milestone is going badly, ask the agent to cut scope within the milestone instead of skipping acceptance criteria.
- Bugs are easiest to fix from replays: press F9 right after something goes wrong and attach the file.
- Keep `docs/DECISIONS.md` honest. It's how a later session knows why things are the way they are.

## Tools

All commands run from the repo root. Flags go after `--`.

| Command | Flags |
|---|---|
| `npm run sim -- ...` | `--scenario <id>` (default `wander`), `--ticks N` (10000), `--seed S` (1), `--every N` print the hash every N ticks (to find where two runs diverge), `--json`, `--list`, `--replay <file>` (replays an F9 file, prints MATCH or MISMATCH, exits 1 on mismatch, warns if tuning was edited) |
| `npm run bench -- ...` | `--ticks N` (20000, min 10000), `--warmup N`, `--bench <id>`, `--strict` (exit 1 if over budget), `--json`. Budgets are DESIGN §12: entity step 2.7 ms, grid 2.0 ms (n/a until M3). Add benches to the `benches` list in `tools/bench.ts` |
| `npm run shots -- ...` | `--scene <id>`, `--milestone <name>` (m0), `--ticks N` (advance the sim first), `--viewport 390x844` (1280x720). Writes `shots/<milestone>_<scene>.png` |
| `npm run validate` | Rooms parse, scenario and scene rooms exist, tuning defaults are finite numbers > 0, spawn markers match `@spawn` headers (warning only) |
| `npm run test:browser` | Playwright determinism tests (Node vs. page hashes). Set `E2E_PORT` (default 5174) to avoid clashing with other dev servers |
