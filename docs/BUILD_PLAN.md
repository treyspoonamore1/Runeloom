# Runeloom: Build Plan

Milestones M0 to M8. Each one ends with a playable build, a report from the agent, and a playtest by the designer.

## How milestones work

- Do tasks in order. A milestone is done when every acceptance criterion is verified.
- **Acceptance** items are verified by the agent with tests, headless sims, benchmarks or screenshots it has looked at.
- **Playtest** items are for the designer. Only a human can judge feel and fun. The agent lists these questions in its end-of-milestone report.
- Don't start the next milestone until the designer replies with playtest notes or says to continue. If the designer's prompt asks for several milestones in one go (the kickoff prompt asks for M0 and M1), do them in order and report once at the end.
- Content marked with a later milestone in `docs/CONTENT.md` stays out of earlier milestones.

## End-of-milestone report

The agent ends every milestone with:

1. How to run it (one command) and where to start (scene or save).
2. What was verified, and how: test counts, bench numbers, screenshots looked at.
3. What couldn't be verified.
4. Known issues and shortcuts taken.
5. Feel values that are guesses and are exposed in the F2 tuning panel.
6. The playtest questions for this milestone.

---

## M0: Foundation

Goal: a deterministic sim with a player who moves and dodges, plus the tooling every later milestone depends on.

Tasks:

1. Scaffold: Vite, TypeScript strict, ESLint, Prettier, Vitest, Playwright. Folder layout per `CLAUDE.md`. All npm scripts from `CLAUDE.md` exist, even if some are stubs.
2. Sim core: fixed 60 Hz timestep with an accumulator and render interpolation. `Rng` (sfc32, seedable, `fork(label)` for independent streams). State hash (FNV-1a over sim state).
3. Input: `InputFrame` (move vector, aim point in world space, button bitmask). Input recorder for replays.
4. Player: movement with acceleration and deceleration, dodge with charges and i-frames, circle-vs-tile collision with walls.
5. Rendering: PixiJS app, camera follow with look-ahead, a test room drawn as flat tiles, the player as layered shapes with procedural bob and lean.
6. Debug tools: dev console (backtick), F1 overlay stub, F2 tuning panel bound to `data/tuning.ts` with a Copy JSON button, FPS and sim-time graph.
7. Headless runner: `npm run sim` runs a scenario for N ticks with scripted input and prints the state hash.
8. Screenshots: `npm run shots` loads `?scene=<id>` debug scenes in Playwright and saves PNGs to `shots/`.

Acceptance:

- `npm run check` passes.
- Determinism: same seed and input log give the same state hash after 10,000 ticks, in Node and in the browser (a Playwright test compares them).
- Collision tests: the player can't pass walls, including corners and at dodge speed.
- `shots/m0_room.png` shows the room and the player.

Playtest:

- Move and dodge for 2 minutes. Does movement feel responsive? Is the dodge too long, too short, too floaty?
- Adjust speed, acceleration and dodge in F2 and paste the JSON back.

## M1: Combat feel

Goal: hitting things feels good before any system depth goes on top.

Tasks:

1. Life and mana, damage events, death, respawn.
2. Two hardcoded spells: Fire Bolt and Strike, using the numbers in CONTENT §1.2. No terrain yet.
3. Hit feedback: hit flash, hitstop, knockback, damage numbers, screen shake rules (DESIGN §4), death particles.
4. Enemies: Tinderling, Shieldbearer, Ember Archer. AI is a state machine: idle, aggro, attack with telegraph, recover. Telegraphs follow DESIGN §14. The Tinderling's terrain behavior waits for M3; for now it only looks like it's burning.
5. Spatial hash. Projectiles collide with walls and entities.
6. Arena scene `?scene=arena` with waves spawned from the console.
7. Sound effects for cast, hit, kill and dodge with ZzFX.
8. Bench scene with 300 enemies and 2,000 projectiles.

Acceptance:

- Unit tests: damage formula (DESIGN §7), resistances, crits with a seeded RNG, i-frames preventing damage, the Shieldbearer's arc blocking projectiles from the front but not the back.
- Bench meets the DESIGN §12 budgets.
- Bot test: a scripted headless player (kite and shoot) clears a 20-enemy wave at default tuning without dying. Report time to clear and damage taken.
- Screenshots: a fight in progress with a visible telegraph and damage numbers.

Playtest:

- Does hitting feel good? Too much or too little hitstop, shake, knockback?
- Can you read every enemy attack before it lands?
- Which enemy is the most fun, and which is annoying?

## M2: The Loom

Goal: spell weaving works end to end, with the in-game DPS readout.

Tasks:

1. Rune types and data for everything marked M2 in CONTENT §1. Elements deal damage and apply ailments to entities only; terrain arrives in M3.
2. Weave notation parser and printer that round-trip (DESIGN §5.2).
3. Compiler: validation (forms, compatibility, depth, Capacity, once-per-spell modifiers), costs, precomputed stats, producing a `SpellProgram`.
4. Runtime: spell instances, branch dispatch, proc rules, internal cooldowns, spawn caps, deterministic ordering.
5. Ailments on entities: Ignite, Chill, Freeze, Shock.
6. Loom UI in Preact: rune pouch, 4 weave slots, tree editor (drag runes into slots, branches shown indented), validation messages, complexity and mana bars.
7. DPS readout: a Web Worker runs the real sim against the `dummy_pack` reference scene for 10 s.
8. CLI: `npm run sim -- --weave "<notation>" --scene dummy_pack --seconds 10 --runs 50` prints DPS, hits, and mana per second.
9. Console command `weave <slot> <notation>`.
10. Reference scenes `dummy_single`, `dummy_pack` and `dummy_grid` (DESIGN §5.5) and the dev-only `test_spindle` with a settable Capacity (CONTENT §2).
11. Sandbox loadout for the arena: Twig Spindle plus one of every M2 rune, dev builds only. The real new-game loadout comes in M4 (CONTENT §9.1).

Acceptance:

- Every reference weave and every must-fail case in CONTENT §2 has a passing test.
- Reference weave 14 on a 22-Capacity `test_spindle` in `dummy_grid` hits the 64-per-cast cap and reports dropped spawns. The bench with 4 copies of it firing stays within budget.
- With the same seeds and run count, the DPS readout and `npm run sim` give identical numbers. The readout's 10-run mean is within 5% of a 50-run CLI mean for every reference weave.
- A screenshot of the Loom showing a weave with one branch, its costs and its DPS.

Playtest:

- Build 5 weaves of your own. Is the editor clear? Could you predict what a weave would do before trying it?
- Which runes feel useless, and which feel mandatory?

## M3: Kindling, the chemistry grid

Goal: the world reacts to every element.

Tasks:

1. Grid storage as typed arrays (DESIGN §6.1), materials from data, an active-cell set, a 20 Hz tick.
2. Rules 1–20, 22, 23, 25 and 26 from DESIGN §6.3. Rules 21 and 24 wait for M8.
3. Spells write terrain effects through their footprints (CONTENT §1.2), including Saturate and Lingering.
4. Entities read the grid: Wet, Oiled, burning ground, charged water, slippery ice, slows.
5. Hazard ownership and team rules (DESIGN §6.3).
6. The Tinderling's terrain behavior and rule 22.
7. Grid rendering: data textures plus a material shader; animated fire, water, ice, charge, smoke and steam; interpolation between grid ticks.
8. F1 overlays: material, fire, charge, wet, owner.
9. Chemistry Lab scene `?scene=lab`: one labeled station per rule, with a key to reset each.

Acceptance:

- One unit test per implemented rule, named with its rule number. Fire spread tests are seeded and assert ranges, not exact counts.
- Grid bench: 256×256 with 20% active meets the Node budget in DESIGN §12 (≤ 2.0 ms per grid tick).
- Before and after screenshots of every lab station. The agent describes what each shows and confirms it reads as intended.
- The determinism test still passes with the grid active.
- Reference weaves 1, 2, 3, 5, 6, 7 and 9 have their terrain assertions from CONTENT §2.

Playtest:

- Spend 10 minutes in the lab and in an arena with grass and water.
- Is fire spread too fast or too slow? Can you always tell what's dangerous to you?
- Which interaction is the most satisfying? Which is confusing?

## M4: Vertical slice: Emberwood and the Sunken Kiln

Goal: about an hour of real game, from a new save to the Cinder Warden.

Tasks:

1. Room loader for the ASCII format (CONTENT §6), room transitions, Loom Stones, a region map screen.
2. Author all rooms in CONTENT §9.
3. Puzzle objects: brazier, crate, wooden barricade, oil barrel, push block, ice block, conduit switch, pressure plate, door, locked door, keys, timers.
4. Remaining enemies, the Brood Kiln, the Tar Matriarch and the Cinder Warden with all 3 phases and the boss chill rule (DESIGN §6.4).
5. Area level for rooms (`@level`) and item level for drops. Enemy life and damage scaling (DESIGN §7).
6. Monster rarity: Magic and Rare packs with the 3 M4 mods (CONTENT §5).
7. Loot: rune drops and guaranteed unlocks (CONTENT §9.1), spindle bases with Magic affixes, Fuse parts and the Fuse UI, Heart Seeds, Loom Shards, Thread Scrap (used for unfusing and respecs).
8. New-game loadout (CONTENT §9.1). XP and levels 1–12. Passive tree with about 90 nodes, the keystones and notables in CONTENT §7, rendered in SVG, with respec.
9. Inventory, equipment, tooltips. Save and load in IndexedDB, plus export and import. Title screen. Settings: volume, damage numbers, effect density.
10. Puzzle tests: every puzzle room has a scripted solution (a sequence of sim commands: move to, cast weave at, wait) that reaches its door-open or pickup state. Rooms in the Kiln's second half also have a test that they can't be solved without Frost.
11. Balance pass with the bot. Target: the bot with a reference build reaches about level 12 at the Warden and kills him in 90 to 150 s. Report what you achieved.

Acceptance:

- All puzzle solution tests pass.
- A combat sim for every encounter, at the expected player level, completes without the bot dying.
- Save and load round-trip: random game state, save, load, same state hash.
- Screenshots of every room on load, looked at.

Playtest:

- Play from a new game to the Cinder Warden. The target is 45 to 75 minutes.
- Where was pacing slow? Where did difficulty spike?
- Which puzzles were confusing or too easy?
- Favorite and least favorite weave you built?
- Did getting Frost feel like a Zelda dungeon-item moment?

## M5: Loot and crafting depth

Tasks:

- Rare items with affix tiers, the uniques in CONTENT §8, the remaining currencies (DESIGN §8.5) with a crafting bench UI.
- Rune leveling from XP while socketed, rune quality, Fuse part tiers.
- The remaining monster mods (CONTENT §5).
- A simple loot filter with a rules UI.
- Remaining M5 runes: Fork, Return, Infuse, Focus, Swift, and the Channel trigger. Heartwood and Loomsteel spindles.

Acceptance:

- Crafting probabilities checked with 100,000-roll statistical tests within tolerance.
- Affix groups can't roll together (tested).
- Every unique's rule change has a test.

Playtest:

- Is crafting interesting, or a chore? Is loot exciting, too frequent, too rare?

## M6: Rifts

Tasks:

- Room-chunk templates with sockets, and a seeded generator that builds a 6–10 room rift plus a boss room, with a connectivity validator.
- Rift Sigils with tiers 1–16 and the modifiers in CONTENT §10, including the chemistry-changing suffixes.
- Two rift bosses (variants are fine), completion rewards, the tier ladder.

Acceptance:

- 1,000 generated rifts per tier are all connected and completable by the solver.
- The generator is deterministic per seed.
- A bot clear-rate report per tier for each reference build.

Playtest:

- Do rifts feel varied? Which modifiers are fun, and which are just annoying?

## M7: The Hearth, the incremental meta layer

Tasks:

- Hearth hub, Embers, the 4 buildings with upgrade levels (DESIGN §11).
- Offline progress, capped at 8 hours. Offline time is computed from timestamps on load. This is the only place wall-clock time is allowed, and it stays outside `src/sim/`.
- Expeditions. Rekindle prestige. Ash and the Mutations in CONTENT §11.

Acceptance:

- Closed-form offline gains match a step-by-step simulation within 1%.
- Rekindle resets exactly what DESIGN §11 says, and nothing else (tested).
- A progression sim: a model player reaches the first Rekindle in 6 to 10 hours of play. Report the curve.

Playtest:

- Does the Hearth make you want one more rift? Do the numbers go up satisfyingly?

## M8: Expansion and polish

- Tide and Gale elements, rules 21 and 24, a wind field.
- Region 2, Glasswater Fen: rooms, a dungeon (the Drowned Foundry, dungeon item Tide) and a boss.
- Passive tree to about 300 nodes, about 45 runes, 8 more enemies.
- Rift atlas: a hex map with adjacent-node bonuses.
- Gamepad support, key rebinding, accessibility (element patterns, screen shake off, reduced flashing).
- Tauri desktop build.

---

## Playtest feedback template

Copy this, fill it in, and paste it back to the agent.

```
Milestone: M_
Commit or build:
Time played:

Best moment:
Worst moment:

Feel, 1 to 5:
  Movement:
  Hitting things:
  Casting:
  Reading the screen:

Tuning JSON from F2:

Bugs (attach F9 replay files where you can):

What I want changed:
```
