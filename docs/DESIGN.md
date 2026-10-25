# Runeloom: Game Design

Status: v0.1, pre-production. "Runeloom" is a working title.

Companion files: `docs/CONTENT.md` (data tables), `docs/BUILD_PLAN.md` (milestones), `CLAUDE.md` (agent rules). Section references like "§6.3" point into this file.

---

## 1. Pitch

A top-down action RPG. You build your own spells from runes: a trigger, a form, an element, modifiers, and branches that cast more spells. Every element you cast changes a simulated world. Fire spreads through grass, frost freezes rivers into bridges, lightning races through water and metal. The best builds combine both: spells that create the terrain they then exploit.

Influences:

| Source | What we take |
|---|---|
| Path of Exile | Support links, triggers, passive tree, item affixes, currency crafting, maps with modifiers |
| Noita | Spells built from parts, with a capacity budget |
| Breath of the Wild / Tears of the Kingdom | Chemistry engine, Fuse (monster parts on weapons) |
| Zelda dungeons | Item-gated dungeons, a mid-dungeon item that unlocks the second half, a boss that tests it |
| Incremental games | Meta layer that keeps producing, prestige resets with permanent upgrades |

## 2. Pillars

Use these to settle any design question the docs don't answer.

1. **Your spells are yours.** Nearly every skill is player-built. The fun is theorycrafting, then watching it work.
2. **The world is a reagent.** Elements change terrain, terrain changes combat. Fights and puzzles run on the same rules.
3. **Readable chaos.** However wild a build gets, the player can always read threats. Enemy attacks and hazards that can hurt the player stay visible above the player's own effects.
4. **Numbers climb.** An ARPG power curve plus an incremental meta layer. Something is always getting bigger.
5. **Everything is testable.** Every rule is deterministic and runs headless. If a rule can't be tested, redesign it.

### 2.1 Guidelines

Guidelines steer balance. Unlike pillars, they can bend when a build needs them to.

- **Closer pays more.** Anything that puts the player within reach of enemies pays back, in damage, mana or defense. The axis is distance, not melee versus magic: a close-range Nova caster is rewarded the same way as a Strike build. Ranged play stays fully viable, but it reaches the same efficiency through investment (passive tree, gear, keystones like Living Loom) rather than by default. The default character therefore plays hybrid, and specializing away from that is a build choice. First lever, tested in M2: close-range forms restore mana on hit (CONTENT §1.2).

## 3. Setting and tone

The world was woven on a great Loom. The Loom snapped (the Unraveling), and raw elements now spill through the tears as wild fire, frost and storm. You are a Loomwright apprentice who pulls runes out of the frayed lands and weaves them into spells.

Tone: bright, warm, a little whimsical. Closer to Wind Waker than to grimdark. Story stays light: short NPC lines at the Hearth, environmental storytelling, boss intro cards.

Regions:

| # | Region | Teaches | Dungeon | Dungeon item | Status |
|---|---|---|---|---|---|
| 1 | Emberwood: grassy forest, rivers, wooden bridges | Fire, water, oil | The Sunken Kiln | Frost rune | MVP (M4) |
| 2 | Glasswater Fen: marsh, metal ruins, glassy water, rusted pylons, fog and fireflies | Storm, conduction | The Drowned Foundry | Tide rune | M8 phase 1 (CONTENT §13) |
| 3 | Galeback Cliffs: wind, ledges | Gale, wind fields | TBD | TBD | Later |

Each region's boss gives the element the next region teaches: the Cinder Warden drops Storm (the Fen), the Glasswater Coil drops Gale (the Cliffs). The dungeon item is the region's own new element.

The Fen comes after the first rifts: it is reached through K10's storm door, sits at area levels 18–24, and its boss gates rift tiers above 8 (§10.4).

## 4. Camera, controls, feel

- Top-down orthographic 2D. The camera follows the player with look-ahead toward the cursor (up to 15% of screen size, smoothed).
- 1 cell = 8 px at the reference resolution 1280×720, so the default view is about 160×90 cells. The view scales with resolution.
- Keyboard and mouse: WASD move, mouse aims, LMB / RMB / Q / E cast the 4 weave slots (R casts a fifth with the Twin Threads mutation, §11), Space dodges, Tab opens the Loom, I inventory, P passive tree, F interact. Gamepad arrives in M8.
- Casting while moving is allowed. Beam and Channel slow movement by 40% while active.

Feel defaults. All live in `data/tuning.ts` and are exposed in the F2 tuning panel.

| Value | Default |
|---|---|
| Move speed | 26 cells/s |
| Acceleration / deceleration time | 0.06 s / 0.05 s |
| Dodge | 12 cells over 0.18 s, i-frames 0.15 s, 2 charges, 1.4 s recharge per charge |
| Hitstop | 0.03 s on crit, 0.06 s on a Strike kill, 0.08 s on Shatter, none on damage over time |
| Enemy hit flash | 0.08 s |
| Screen shake | Shatter and explosions only, max 3 px, never from damage over time |
| Damage numbers | On by default, crits larger, toggle in settings |

## 5. The Loom: spell weaving

### 5.1 Concepts

- **Rune**: an item that is one node of a spell. Kinds: trigger, form, element, modifier, branch. Runes drop as loot, level 1 to 20 from XP earned while socketed, and have quality 0 to 20%. Each rune item sits in one place at a time; duplicates drop.
- **Weave**: a tree of runes that makes one spell. The player has 4 weave slots, bound to LMB, RMB, Q, E; the Twin Threads mutation (§11, CONTENT §11) adds a fifth on R. A weave with an automatic trigger (Pulse, On Dodge, ...) still uses a slot; its button does nothing.
- **Spindle**: the weapon. It provides Capacity (the complexity budget per weave), cast speed, an implicit modifier, and 1 or 2 Fuse sockets.

### 5.2 Structure

```
weave  = trigger, spell
spell  = form, elements (0+), modifiers (0+), branches (0+)
branch = branch rune, spell
```

- A Strike with no element deals physical damage. Every other form needs at least one element; a form with none fails validation.
- Branch depth: the root spell is depth 0. Each branch adds 1. Maximum depth is 3.
- A spell can have more than one branch (for example On Hit and On Expire both).

**Text notation.** Used in docs, tests, the dev console and the sim CLI. Build a parser and a printer that round-trip.

```
weave    := TRIGGER " > " spell
spell    := FORM "[" items? "]" branches?
items    := item (", " item)*            elements and modifiers, in slot order; may be empty
branches := " > " BRANCH " > " spell                       one branch
          | " { " BRANCH " > " spell ("; " BRANCH " > " spell)* " }"   several
```

Rune names in notation are the `name` column of CONTENT §1 with spaces removed (`OnHit`, `OnExpire`). Matching is case-insensitive.

Examples:

```
Cast > Bolt[Fire]
Cast > Strike[]
Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]
Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }
```

### 5.3 Evaluation rules

- The compiler turns a weave tree into a `SpellProgram`: validated, with precomputed stats per node (damage, instance count, speed, area, costs). Validation errors are written for the player, for example "Nova can't take Pierce" or "Needs 12 Capacity; this spindle has 10".
- Validation stops at the first error, checked in this order: unknown rune, structure (missing trigger or form, missing element, Sigil without Emit, depth over 3), rune not allowed on that form or parent, duplicate modifier, Capacity.
- Each modifier lists the forms it applies to (CONTENT §1.4).
- Modifiers apply only to the spell they're attached to, not its branches. Exception: modifiers tagged `inherit` (Infuse) also apply down the tree.
- A branch spell with no element inherits its parent's elements. (Validation allows this case.)
- Branch runes carry a damage penalty and proc rules (CONTENT §1.5). Penalties multiply down the tree.
- Bolt, Beam and Orb branch spells can't hit the entity they spawned from. Nova, Lob, Strike and Swath branch spells can.
- Several elements on one spell split base damage evenly. Each element still applies its full terrain effect and ailment build-up from its share. Terrain effects apply in slot order, so `[Fire, Frost]` on water makes steam and then frost does nothing to steam, while `[Frost, Fire]` freezes then melts. This is intentional, odd and deterministic.
- **Spawn caps.** One cast can create at most 64 spell instances across its whole tree. Extra spawns are dropped and counted in debug stats. Globally, at most 2,000 player spell instances are live; past that, the oldest expire.
- **Internal cooldowns.** Automatic triggers have an internal cooldown (ICD) per rune, listed in CONTENT §1.1.
- **Determinism.** Instances spawn in tree order, then by index. Branch aim randomness uses the sim RNG.

### 5.4 Costs

- **Complexity** = sum of rune complexity costs. Branch runes cost their base plus 1 for each depth level beyond 1 (depth 1: base, depth 2: base+1, depth 3: base+2). Total must be ≤ spindle Capacity.
- **Mana** is computed recursively. `spellMana = form base mana × product of the spell's element and modifier mana multipliers + 0.5 × sum of spellMana for each branch spell`, so a depth-2 spell costs 25% of its own mana. `weaveMana = trigger mana multiplier × spellMana(root)`. Branch runes have no mana multiplier. The whole tree is paid when the root fires. Automatic triggers pay when they fire; with too little mana, they don't fire.
- **Cast time** = form cast time ÷ cast speed. Automatic triggers ignore cast time and don't interrupt movement.

### 5.5 In-loom DPS readout

The Loom editor shows, live while editing: mana cost, complexity used / Capacity, cast time, damage per hit by element, and estimated DPS against a single target and against an 8-enemy pack, ailments included.

These numbers come from running the real sim headlessly in a Web Worker: 10 seeded runs of 10 seconds each, showing the mean. There is no separate damage formula, so the readout can't drift from the game. Show values with "≈" and a small spinner while computing.

Reference scenes (also used by tests and the sim CLI):

| Scene | Layout |
|---|---|
| `dummy_single` | 1 dummy, 20 cells from the player, on stone |
| `dummy_pack` | 8 dummies in a 3×3 grid without its center, 3 cells apart, grid center 20 cells from the player, on stone |
| `dummy_grid` | 100 dummies in a 10×10 grid, 3 cells apart, for stress tests |

Dummies have 500 max life and 0 resistances, never move or attack, and can't die: at 0 life they reset to full without counting as a kill.

Readout assumptions, shown as a note under the numbers:

- Harvest and On Kill can't fire against dummies, so their damage isn't included.
- On Dodge, On Hurt and On Crit weaves assume their event happens once per second, limited by the trigger's ICD.

## 6. Kindling: the elemental world

### 6.1 Grid

- The play space is a grid of cells. Rooms are authored in tiles of 4×4 cells (CONTENT §6) and can be up to 256×256 cells.
- Cell state is stored as typed arrays, one per field:

| Field | Type | Meaning |
|---|---|---|
| `ground` | u8 | Material enum (§6.2) |
| `surface` | u8 | None or Oil |
| `air` | u8 | None, Smoke, Steam, Fog (M8) |
| `fire` | u8 | Burn intensity 0 to 255 |
| `fuel` | u16 | Remaining burn time in grid ticks |
| `charge` | u8 | Remaining electrified ticks |
| `airTimer` | u8 | Remaining smoke/steam ticks |
| `timer` | u16 | Material timer: thaw, crack, dry, temporary terrain |
| `wet` | u16 (M8; u8 before) | Remaining ticks a non-water cell stays wet (Tide, Hydromancer). Wet cells can't ignite. Widened so a Lingering Tide's 15 s fits |
| `under` | u8 | Material the cell becomes when its current material burns away or its timer ends: pit under a wooden floor, deep water under a bridge, the original ground under temporary water or ice. Freezing or melting temporary terrain keeps `under` |
| `borrowed` | u8 (M8) | 1 while the cell's terrain is temporary: Tide or Hydromancer water, a Tide-filled pit, ice or an ice bridge frozen from them, a doused furnace vent. When its `timer` ends it returns to `under` (rule 27) |
| `gustDir` | u8 (M8) | Gust direction: 0 none, 1–8 the way it blows (E, NE, N, NW, W, SW, S, SE) |
| `gustTimer` | u8 (M8) | Remaining gust grid ticks |
| `owner` | u8 | Team that created the current effect: world, player, enemy |

Room-wide (M8): `wind`, 0 or a direction 1–8, from the `@wind` header or the rift suffix "of the Gale" (§6.6); and `fogMask`, one bit per cell, from `@fog` headers (CONTENT §6.2).

- The grid updates at 20 Hz (every 3rd 60 Hz sim tick). Only cells in an active set update, so quiet terrain costs nothing.
- Entities read the cell under their center.

### 6.2 Materials

| Material | Walk | Flammable (spread chance per grid tick, burn time) | Conducts | Notes |
|---|---|---|---|---|
| Stone | yes | no | no | Default floor |
| Dirt | yes | no | no | |
| Grass | yes | 0.20, 2.0 s → Ash | no | Light smoke while burning |
| Bramble | no | 0.45, 1.0 s → Ash | no | Blocks movement, not projectiles. Dense smoke |
| Wood (floor, bridge) | yes | 0.08, 6.0 s → `under` (Pit or Deep water) | no | Burning a bridge drops it |
| Crate | no | 0.10, 3.0 s → Ash | no | Object; may drop loot |
| Wooden barricade | no | 0.10, 4.0 s → Stone | no | Object. Blocks movement and projectiles |
| Oil barrel | no | 0.30, then explodes 1.0 s after igniting | no | Object. The explosion is a 4-cell world-owned fire burst for 30 Fire damage (scaled like enemy damage, §7) and spills oil in a 3-cell radius |
| Shallow water | yes, 20% slow | no | yes, with falloff | Wets entities |
| Deep water | no | no | yes, with falloff | Projectiles pass over |
| Ice | yes, slippery | no | no (yes with Stormglass) | Thaws to shallow water after 15 s |
| Ice bridge | yes, slippery | no | no | Frozen deep water. Lasts 8 s, then 1.5 s visible cracking, then breaks |
| Mud | yes, 40% slow | no | no | |
| Metal floor | yes | no | yes, no falloff | |
| Metal pylon | no | no | yes, no falloff | |
| Ash | yes | no | no | Inert |
| Wall | no | no | no | Blocks everything |
| Pit | no | no | no | Projectiles pass over. Tide fills it with deep water for 10 s (M8) |
| Furnace vent, lit (M8) | no | no (it is fire) | no | Solid flame on a metal grate: blocks movement, not projectiles. Ignites entities touching it. Tide douses it (rule 30) |
| Furnace vent, doused (M8) | yes | no | yes, no falloff | The bare grate, for 10 s; conducts like metal floor. Then it relights |

Surface layer:

| Surface | Effect |
|---|---|
| Oil | 15% slow, applies Oiled. Flammable 0.70 per tick, burns 2.0 s at double terrain-fire damage, then gone. Floats on water and can burn there |

Air layer:

| Air | Effect |
|---|---|
| Smoke | From burning grass, bramble, wood. Lasts 4 s. Blocks enemy sight (Blind). Only lightly tints the player's view |
| Steam | From fire on water. Lasts 3 s. Same sight rules as smoke |
| Fog (M8) | Placed by a room's `@fog` headers; permanent. Hides the ground from the player beyond a 10-cell lantern radius (render only). Doesn't Blind enemies. Fire burns it off for 8 s, a gust for 10 s, then it rolls back in (rule 29). Smoke and steam replace it while they last. Never drifts |

### 6.3 The chemistry table

Each row is one rule and gets one unit test named after its number (`rule 07: frost on shallow water makes ice`). "Fire", "Frost", "Storm" mean a spell hit or terrain effect of that element.

| # | When | Condition | Result |
|---|---|---|---|
| 1 | Fire hits a flammable cell | Cell not wet | Cell ignites with the material's fuel |
| 2 | Each grid tick, a burning cell | Has flammable 4-neighbors | Ignites each with p = spread chance × wind factor (1 without wind) |
| 3 | A burning cell's fuel runs out | | Cell becomes its burnt material (table above) |
| 4 | Fire hits shallow or deep water | No oil on the cell (otherwise rule 6 applies) | No fire. Steam in a 3×3 cell area (scaled by spell area) for 3 s |
| 5 | Fire hits ice or an ice bridge | | Becomes shallow / deep water in the hit area |
| 6 | Fire hits oil | | Oil ignites at high intensity |
| 7 | Frost hits shallow water | | Becomes ice (thaws in 15 s) |
| 8 | Frost hits deep water | | Becomes ice bridge (8 s, then 1.5 s cracking, then deep water) |
| 9 | Frost hits a burning cell | | Fire goes out. Remaining fuel is kept, so it can reignite |
| 10 | Frost hits mud | | Becomes dirt |
| 11 | Storm hits water | | Electrify the connected water body: flood fill from the hit cell, max 600 cells or 40 cells distance. Charge lasts 1.0 s. Each entity is hit once per electrify event, when the charge lands or when it first enters a charged cell before the charge ends: the triggering hit's Storm damage × falloff (1 − d/40, minimum 0.25), plus Shock |
| 12 | Storm hits metal | | Electrify the whole connected metal network (no falloff, cap 2,000 cells). Charge lasts 1.5 s. Powers any conduit switch touching the network. Entities on charged metal floor are hit once per event for 60% of the triggering hit's Storm damage, plus Shock |
| 13 | Charged water touches metal, or charged metal touches water | | Charge propagates across (with each medium's rules) |
| 14 | Storm hits a dry flammable cell | 15% chance per hit (seeded) | Cell ignites |
| 15 | Entity in shallow water | | Wet, refreshed to 3 s after leaving |
| 16 | Entity in a burning cell | Not Wet; hazard owned by another team or world | Ignited at terrain-fire DPS (§6.4), doubled on burning oil. Refreshed while standing in it |
| 17 | Entity on oil | | Oiled for 5 s |
| 18 | Oiled entity is ignited | | Ignite damage ×2 and the entity leaves burning cells behind it while ignited |
| 19 | Shock lands on a Wet entity | | Arcs to up to 5 other Wet entities within 6 cells, applying the same Shock and 30% of the hit's damage. One generation of arcs only |
| 20 | A Frozen enemy is killed | | Shatter: no corpse, frost burst in a 4-cell radius that applies rules 7 and 8, no damage |
| 21 | Wind blows over a burning cell (M8: Gale gusts, Bellows Toad croaks, `@wind` rooms, the rift suffix "of the Gale") | | Rule 2's wind factor toward each 4-neighbor: ×2 downwind, ×0.25 upwind, ×1 across (§6.6). Smoke and steam drift downwind: 5 cells/s in a gust, 2.5 cells/s in room wind. Wind has no owner: fire keeps its own |
| 22 | An Ignited entity moves over a flammable cell | | That cell ignites, owned by the team that ignited the entity. Entities that are always burning (Tinderlings) light enemy-owned cells |
| 23 | Fire burns on mud for 1 s | | Mud dries to dirt |
| 24 | Tide (M8) hits terrain | | Per cell, by material (full table §6.5): fire goes out (fuel kept) and the cell is wet for 10 s; stone and ash become borrowed shallow water for 10 s; a pit becomes borrowed deep water for 10 s; dirt becomes mud (permanent); grass, bramble, wood, crates and barricades are wet for 10 s (unburnable); a lit furnace vent is doused (rule 30); borrowed water's timer goes back to 10 s. Other water, ice, mud and metal don't change |
| 25 | The ground under an entity stops being walkable (an ice bridge breaks, a bridge burns, a Tide-filled pit drains, M8) | Not a swimmer (rule 31) | Entity falls: 10% max life damage, then returns to its last safe cell |
| 26 | Fire is placed on a walkable non-flammable cell (spell footprint, death burst, explosion, rule 18 trail) | Not water (rule 4), not ice (rule 5) | Placed fire at intensity 128 for 1.0 s (Lingering applies). It spreads into flammable neighbors by rule 2 and damages by rule 16, then goes out leaving the ground unchanged (except mud, rule 23) |
| 27 | A borrowed cell's timer ends (M8) | | It returns to `under` and stops being borrowed, whatever it became meanwhile: Tide water, a filled pit, ice or an ice bridge frozen from them, a doused vent. Charge on it ends if `under` doesn't conduct. Fire on borrowed ice returns the cell to `under` at once, with steam (rule 4) |
| 28 | A Tide footprint covers a push block or ice block (M8) | The tile beyond is free | Washed one tile, like a push (CONTENT §6.1): along the spell's direction, or for Nova, Lob and Orb away from the footprint's center. An ice block that lands on ice or an ice bridge slides on. Once per block per spell instance |
| 29 | A gust or Fire reaches fog (M8) | | Fog in those cells clears for 10 s (gust) or 8 s (Fire), then rolls back in. Lingering doesn't lengthen it |
| 30 | A lit furnace vent (M8) | | Entities touching it (within 0.5 cells of its tile) are Ignited as by rule 16 (world-owned; Wet protects). Tide douses it: a borrowed, walkable grate for 10 s that conducts like metal floor, then it relights (rule 27). Collision pushes anyone standing on it off as it relights; they aren't ignited by the relight. Fire on a doused vent relights it at once. Frost and Storm don't change a lit vent |
| 31 | A swimmer's cell stops being water (M8; Bog Lurker, Glasspike, Glasswater Coil) | Not ice (ice traps it, CONTENT §5) | Stranded: it can't attack (the Coil can thrash) and takes 50% more damage. After 2 s (the Coil: 5 s) it crawls at 4 cells/s toward the nearest water within 16 cells and ends Stranded on reaching it. With no water in reach it dries out, losing 5% of max life per second (never bosses) |
| 32 | Tide hits an entity (M8) | | Wet for 3 s (Lingering +30%), the same Wet as rule 15: it puts out Ignite and lit fuses (Tar Hulk, Tar Matriarch) and quenches Hot enemies (CONTENT §5 Slagshell). Tide never Wets its caster |

**Hazard ownership.** Every terrain effect records its owner team. Hazards damage the other team and never their owner team. World-owned hazards (ambient fires, a Tar Hulk explosion) hurt everyone. Fire that spreads keeps the owner of the cell it spread from. A new effect on a cell takes the new owner. Exception: fire on the Tar Matriarch's tar (CONTENT §5) is always world-owned, whoever lit it.

### 6.4 Ailments

| Ailment | Rule (starting values) |
|---|---|
| Ignite | Damage over time of 50% of the triggering fire hit per second for 3 s. A new ignite replaces the old one only if stronger. Terrain fire ignites at **terrain-fire DPS** = 10% of `refLife(area level)` per second (§7); above area level 10 it grows like monster damage (×1.09 a level) instead (M6.5) |
| Chill | Each frost hit adds (damage ÷ max life) × 200 chill. Slow = 0.3% per chill point, max 30%. Decays 25 chill/s |
| Freeze | At 100 chill: frozen for 1.2 s (can't act) |
| Boss chill | Bosses use their own rule: each Frost hit adds a flat 12 chill (×1.5 if Wet), whatever its damage. Chill decays 10/s, slow max 15%. Freeze lasts 0.8 s, then 6 s of freeze immunity |
| Shock | Increased damage taken = clamp(hit ÷ max life × 100, 5, 50)%, for 4 s. The strongest one applies |
| Wet | Rules 15 and 32 (Tide hits). Extinguishes and prevents Ignite. Chill gain ×1.5. Makes the entity conductive (rule 19) |
| Stranded (M8) | Rule 31. Swimmers only. Can't attack, 50% more damage taken |
| Oiled | Rules 17 and 18 |
| Blind | An enemy inside smoke or steam, or whose target is inside it, can't acquire targets beyond 4 cells |

The player suffers the same ailments from enemy and world hazards, with player-side limits: freeze at most 0.6 s, shock at most 30%.

### 6.5 Tide (M8)

Tide is the Drowned Foundry's dungeon item. It lends the world water for a while: everything it makes that isn't mud is **borrowed** and goes back (rule 27). It deals Physical damage and Wets what it hits (rule 32). Code: `tideCell` in `src/sim/grid/elements.ts`, called from `paintElement` (`src/sim/grid/paint.ts`); borrowed water generalizes `src/sim/grid/tempWater.ts`. Numbers in `data/tuning.ts` `tide`.

Rule 24 per cell. A burning cell (any material, oil too) first goes out: fuel is kept, as rule 9, but the cell is wet for 10 s, so it can't relight until then. Then its material decides:

| Cell | Result | Borrowed |
|---|---|---|
| Stone, ash | Shallow water for 10 s | yes, `under` = the ground |
| Pit | Deep water for 10 s. Frost on it makes an ice bridge, so Tide then Frost crosses a gap | yes, `under` = pit |
| Dirt | Mud. Permanent: it dries by rule 23 and Frost turns it to dirt (rule 10) | no |
| Grass, bramble, wood, crate, barricade, oil barrel | Wet for 10 s (can't ignite, rule 1) | no |
| Lit furnace vent | Doused for 10 s (rule 30) | yes, `under` = lit vent |
| Borrowed water | Its timer goes back to 10 s | stays |
| A lit brazier | Goes out, unless its group already opened its door (those stay lit, CONTENT §6.2) | — |
| Shallow or deep water, ice, ice bridge, mud, rime, metal floor, pylons, walls, other objects | No change | — |

- **Durations.** 10 s (`tide.floodSeconds`, `tide.wetSeconds`, `tide.ventSeconds`), × Lingering (15 s) and × "terrain effect duration" stats like any terrain effect. The last 1.5 s of borrowed terrain flickers, so the player can read when it will go.
- **Oil.** Oil floats on borrowed water and stays on the ground when the water goes. Burning oil goes out and stays unlit while wet.
- **Charge.** Borrowed water conducts like any shallow water (rule 11). Charge already on the grid doesn't spread into water made after its event; the next Storm hit covers it. When borrowed water returns to stone, its charge ends (`setGround` clears charge on non-conductors).
- **Ice.** Frost on borrowed water makes ice (15 s) or an ice bridge (8 s plus 1.5 s cracking) that stays borrowed: when it thaws or breaks the cell returns to `under`, not to water. Tide then Frost on stone is a 15 s ice path that ice blocks slide on. Fire on borrowed ice returns the cell to `under` at once.
- **Entities on it.** Walkers on borrowed water are Wet (rule 15) and slowed 20%. A Tide-filled pit that drains under an entity drops it (rule 25). Swimmers follow borrowed water like any water and strand when it goes (rule 31): this is how the Glasswater Coil is beaten (§10.5).
- **Slot order** (§5.3) holds: `[Tide, Fire]` on stone makes water, then steam; `[Fire, Tide]` places fire and puts it out; `[Tide, Frost]` makes the ice path.
- **Owners.** Water is not a hazard, so borrowed terrain has no owner. Charge on it takes the owner of the Storm that charged it.
- **Hydromancer** water (CONTENT §7) and enemy puddles (Spark Heron, Glasswater Coil) are borrowed too. This fixes `tempWater.ts`'s known limit (water that froze and thawed stayed for good).

### 6.6 Wind (M8)

Wind changes rule 2 and moves smoke, steam and fog. It comes from Gale gusts (the player's, CONTENT §1.3), Bellows Toad croaks (enemy gusts, same rule) and room wind (`@wind`, the rift suffix "of the Gale"). Code: a new `src/sim/grid/wind.ts`; the hot loop in `src/sim/grid/tick.ts` replaces its constant `windFactor` read. Numbers in `data/tuning.ts` `wind`.

**Representation: one room wind direction plus transient gust cells.** The grid stores the room's `wind` (0 or one of 8 directions) and two per-cell fields, `gustDir` and `gustTimer` (§6.1). A cell's wind is its gust while `gustTimer` > 0, else the room wind. Why this and not a per-cell or per-tile vector field:

- Rule 21 needs only a direction per spread roll, and rule 2 spreads to 4 neighbors. With 8 directions the factor is a fixed table `WIND[dir][neighbor]` built at load, so the hot loop reads one more byte per burning cell and one table entry per roll. No trig, no floats.
- A gust is written like any terrain footprint (`rasterize`, an `arc` shape), and its cells join the active set while their timer runs, like charge. Quiet terrain still costs nothing.
- A vector field needs decay or advection over every windy cell each grid tick and a lookup with interpolation; nothing in phase 1 needs varying strength or curl. Galeback Cliffs can add a coarse field on top if updrafts need one.
- Cost: 2 bytes per cell (128 KB at 256×256) and at most `wind.maxGusts` = 8 live gusts per team (the oldest ends early).

Wind factor (rule 21): for a 4-neighbor step `s` and wind direction `w`, with d = s · w (unit vectors): d > 0.5 gives ×2 (`wind.downwindMult`), d < −0.5 gives ×0.25 (`wind.upwindMult`), otherwise ×1. A diagonal wind has two downwind and two upwind neighbors. The factor multiplies the existing spread terms (Drought, Kindler, Wildheart).

Gust shapes, written when a Gale spell paints its footprint:

| Form | Gust cells | Direction |
|---|---|---|
| Bolt | 60° cone, radius 12, from the impact or expiry point | The bolt's direction |
| Beam, Strike, Swath | 60° cone, radius 12, from the caster | The aim |
| Nova, Lob, Orb | The footprint | Away from its center, quantized to 8 directions |

- A gust lasts 2 s (`wind.gustSeconds`) × Lingering. Saturate doubles its area. A new gust overwrites an older one cell by cell.
- **Drift.** A smoke or steam cell under wind moves one cell downwind every 4 grid ticks in a gust (5 cells/s) or every 8 in room wind (2.5 cells/s). Diagonal winds alternate x and y steps. Moves are collected during the visit and applied after it, all sources cleared first, so nothing moves twice in a tick and order doesn't matter. Shot-blocking cells stop drift. A drifting cloud carries its Blind (§6.4) with it: blow smoke onto archers.
- **Fog.** Gusts clear it (rule 29); room wind doesn't move it.
- **Wind vanes** (`Y`, CONTENT §6.1) spin while wind touches their tile.
- **Not affected** in phase 1: projectiles, entities, oil, water, charge, ice. Gale's own hits knock back ×2; that is the rune, not the wind.
- **Readability.** Gusts draw as `#E8F4F0` streaks along their direction; room wind as faint drifting streaks. F1 gets a wind overlay.

Budget: the grid bench (§12) runs with room wind on, 8 live gusts and smoke on 30% of the active cells, and must stay within the Node budget.

## 7. Combat formulas

- Damage types: Physical, Fire, Frost, Storm. Tide and Gale (M8) deal Physical plus their effects.
- Hit damage = base(form, rune level) × element share × (1 + sum of increased) × product of (1 + more) × (crit ? crit multiplier : 1) × (1 − resistance) × (1 + shock).
- Crit chance = form base crit + modifiers. Base crit multiplier 150%.
- Rune base damage at level L = level-1 base × 1.11^(L−1).
- Enemy resistances range from −50% to 75%. Player resistances cap at 75%.
- Player life = 80 + 12 × (level − 1), so 80 at level 1. Mana = 50 + 4 × (level − 1). Mana regen = 8% of max per second (raised from 3% after the M1 bot test; see DECISIONS).
- Enemy life = base life × 1.12^(area level − 1). Magic ×1.7, Rare ×4.
- Enemy damage = base damage × 1.09^(area level − 1). Boss numbers in CONTENT §5 are absolute.
- `refLife(L) = 50 × 1.12^(L − 1)`: the life of a reference enemy at area level L. Terrain hazards scale from it.
- XP to next level = round(68 × L^1.6) up to level 12 (tuned by the M4 balance sim from the starting point round(30 × L^2.2)), then × 1.2 per level above 12 (M6.5, rifts). Kills in an area more than 3 levels below the character pay × 0.75 per extra level, at least 5%. Kill XP = the enemy's base life × 1.2^(area level − 1) × rarity (Magic ×1.7, Rare ×4); bosses have fixed values. Target: about level 12 when the player reaches the Cinder Warden, after 45 to 75 minutes. The campaign bot (`npm run sim -- --campaign`) reaches the Warden at level 12.

## 8. Items

### 8.1 Slots

Spindle, Cloak, Hood, Boots, Charm ×2. Runes live separately in the rune pouch and the weave slots.

### 8.2 Rarity

| Rarity | Affixes |
|---|---|
| Normal | None |
| Magic | Up to 1 prefix and 1 suffix |
| Rare | Up to 3 prefixes and 3 suffixes |
| Unique | Fixed, often rule-bending (CONTENT §8) |

Affixes have tiers gated by item level. Each slot has its own affix pool. Affixes in the same group can't both roll.

### 8.3 Spindles

Spindle bases are in CONTENT §3. Capacity is the main progression stat for weaving: better spindles allow branches. Loom Shards (exploration rewards) add +1 Capacity to every spindle permanently.

### 8.4 Fuse

Monsters drop Parts. Each spindle has 1 or 2 Fuse sockets. Fusing a part adds its effect. Unfusing destroys the part unless you spend 5 Thread Scrap. Parts come in tiers I to III by area level. Parts are in CONTENT §4.

### 8.5 Currency (M5)

| Currency | Effect | PoE analogue |
|---|---|---|
| Thread Scrap | Basic currency; unfuse cost, respec cost | Scrap/wisdom |
| Weaver's Knot | Normal → Magic | Transmutation |
| Spool of Change | Reroll a Magic item's affixes | Alteration |
| Loom Shuttle | Normal → Rare | Alchemy |
| Chaos Skein | Reroll a Rare item's affixes | Chaos |
| Golden Needle | Add one random affix to a Rare | Exalted |
| Unpick | Remove one random affix | Annulment |
| Rune Polish | +1% quality to a rune | Gemcutter's |

## 9. Passive tree: the Pattern

- MVP: about 90 nodes. Full game: 300+.
- One point per level, plus Pattern Seeds from bosses and side puzzles.
- Areas: **Ember** (fire, ignite, terrain fire), **Rime** (frost, freeze, ice), **Tempest** (storm, shock, conduction), **Weaver** at the center (capacity, branches, triggers, mana), **Warden** on the outer ring (life, dodge, defense).
- Node types: small (+% stat), notable (named, larger effect), keystone (changes a rule). MVP keystones and notables are in CONTENT §7.
- Respec is free until level 10, then costs 1 Thread Scrap per point.
- Rendered as SVG with pan and zoom. Node positions come from data.

## 10. World structure

### 10.1 Regions and rooms

- A region is a hand-authored graph of rooms written in the ASCII room format (CONTENT §6). Rooms connect at edge exits and doors, like Zelda screens, but rooms can be larger than one screen and the camera scrolls.
- Loom Stones are waypoints and respawn points.
- Enemy packs come from spawn markers that reference pack tables.
- Exploration rewards: **Heart Seeds** (+8 max life each) and **Loom Shards** (+1 Capacity), hidden behind chemistry puzzles. Emberwood and the Kiln hold 4 Heart Seeds and 3 Loom Shards; so do Glasswater Fen and the Drowned Foundry (CONTENT §13).

### 10.2 Dungeons

Every dungeon follows the Zelda shape:

1. Entrance and first half, solved with abilities the player already has.
2. Mini-boss.
3. Dungeon item: a new element rune.
4. Second half, which needs the new item.
5. Big key, then a boss that tests the item.

Puzzle verbs for the MVP:

| Verb | Example |
|---|---|
| Burn | Bramble walls, wooden barricades, wooden bridges, oil barrels |
| Light | Braziers; a door opens when all braziers in a group are lit |
| Freeze | Water into walkable ice, deep water into a timed ice bridge |
| Melt | Ice blocks into water, revealing what's under them |
| Extinguish | Wet a burning path to walk it |
| Push | Stone blocks onto pressure plates; ice blocks slide on ice until they hit something |
| Conduct | Storm through water and metal to a conduit switch. The Fen's verb: hand-offs between water and metal (rule 13), sealed switches that only charge reaches (`Q`), timed switches (`timer:N:switch:S`), charge glowing through fog to show which pool reaches which pylon |
| Isolate | Stand on ice or stone while the water around you is charged (ice doesn't conduct) |
| Time | Cross before the ice bridge breaks |

Verbs added in M8:

| Verb | Element | Example |
|---|---|---|
| Flood | Tide | Paint a 10 s water path over stone to a sealed switch, then Storm it. Fill a pit for 10 s and freeze it into a bridge. Tide then Frost on stone makes an ice path for ice blocks |
| Douse | Tide | Furnace vents and fire walls go out for 10 s (rule 30); burning ground stays unburnable for 10 s |
| Wash | Tide | Push a block or ice block one tile from range (rule 28) |
| Mire | Tide | Dirt into mud: chargers bog down in it (CONTENT §5 Mirebull) |
| Strand | Tide | Lure a swimmer into borrowed water, then let it go (rule 31) |
| Blow | Gale (after the Fen's boss; optional in the Fen, for Galeback later) | Spin wind vanes, clear fog, push smoke onto enemies, fan fire downwind |

Rust is not a verb: it would make Tide undo Storm on the very metal the Fen teaches (DECISIONS 2026-10-25).

### 10.3 Boss: the Cinder Warden

Arena: 120×80 cells. A grass ring, stone center, two water channels, four metal braziers.

| Phase | Life | What happens | What it teaches |
|---|---|---|---|
| 1 | 100–66% | Charges in straight lines leaving fire trails that ignite the grass ring; fire slam with a ground telegraph | Fire hazards; stepping in water makes you Wet and immune to Ignite |
| 2 | 66–33% | Floods the arena: the channels overflow and about half the floor becomes shallow water. His fire attacks now make steam. He becomes Superheated: 70% less damage taken. He can only build chill while standing in water. Freezing him breaks Superheat for 4 s | Use Frost, the dungeon item: freeze him in the water, then burst him down |
| 3 | 33–0% | Calls lightning onto the metal braziers, which electrify the water every 5 s (braziers glow for 1.2 s first) | Freeze the water around you (ice doesn't conduct) or stand on stone |

Reward: the Storm rune, a Pattern Seed, a Cinder Heart part, and loot.

### 10.4 Rifts (endgame, M6)

- Procedural regions assembled from room-chunk templates with sockets: 6 to 10 rooms plus a rift boss.
- Opened with Rift Sigils: items with tier 1 to 16 and 0 to 4 modifiers. Each modifier adds item quantity and rarity.
- Many modifiers change chemistry. Examples in CONTENT §10.
- MVP endgame is a tier ladder. A hex-map "atlas" with adjacent-node bonuses comes in M8 phase 2.
- **The deep rifts (M8).** Tiers above 8 open only once the Glasswater Coil is dead (`WorldState.bossesDefeated` includes `glasswater_coil`; Rekindle never resets it). The cap becomes min(the Rekindle cap, 8 until the Coil dies). Sigils of tier 9 and up still drop and stack as before; they just can't be opened yet.
  - The Cartographer's list and the map's sigil list show those sigils greyed, with an eel-coil lock badge and the line: "The deep rifts are flooded. Calm the Glasswater Coil in the Drowned Foundry to open tier 9 and above." Pressing Open on one shows the same line; the sim refuses with reason `coil` (`src/sim/world/rift/run.ts`).
  - The first time a tier 8 rift is completed (and on loading a save already past it), a one-time toast: "The storm door in Warden's Hearth hums. Something stirs in the Fen."
  - When the Coil dies: the Gale "item get" panel (CONTENT §9.1), then the toast "The deep rifts drain. Tiers 9 and up are open."
  - Saves already past tier 8 keep their ladder and sigils; their tier 9+ sigils wait for the Coil like anyone's (DECISIONS 2026-10-25).
- **Fen content in rifts (M8).** From tier 9, Fen chunks, packs and two Fen rift bosses join the pools (CONTENT §10.1), and the suffix "of the Gale" can roll.
- The ladder (M7): completing a rift's boss drops a sigil of its tier, or of the next tier with a chance that falls with the tier and grows with every completion of your best tier, so each rift brings the next tier closer. Below the highest tier you have ever completed (kept through Rekindles) the next tier comes fast, so a new cycle climbs back quickly and only new territory is slow. Higher tiers also give monsters more life and damage than their area level alone (CONTENT §10, Tiers).

### 10.5 Boss: the Glasswater Coil (M8)

A huge electric eel, glass-clear except for the lightning that runs down its spine. It lives in the Glass Eye, the Foundry's flooded casting pool. It is safe in deep water and electrifies it; the fight is about bringing it out. Tide is the star, as Frost was for the Warden: Tide lends it water to chase you through, then takes the water away.

Arena (F10, map in CONTENT §13.3): 128×96 cells.

| Feature | Cells | Notes |
|---|---|---|
| The Eye | Deep water 48×40 in the middle, with a 4-cell shallow rim | The Coil's home |
| Two sluice channels | Deep water, 8 cells wide, from the Eye's west and east sides to 12 cells short of the walls | They reach toward the sides; the stone ring stays connected around their ends |
| Stone ring | Everything else, 16–24 cells wide | The player's ground and Tide's canvas |
| Four pylons | A metal pylon on a 12×12 metal pad at each corner of the Eye, the pad touching the rim | Phase 3's pylon storm |
| Four glass flats | Shallow pools 24×8, two north and two south, not connected to the Eye | Isolated, so the Eye's pulses don't reach them, unless Tide joins them to it |
| Loom Stone | By the south entrance | Sleeps until the Coil dies (respawn point; rifts open there) |
| North door | Sealed, with a wind vane | After the fight a Gale gust spins the vane: "The wind tugs north. The Cliffs aren't woven yet." |

Its states (`src/sim/ai/bosses/coil.ts`, flags on `BossState`):

| State | When | Damage taken |
|---|---|---|
| Submerged | Center on deep water and not attacking | 75% less in phase 1, 90% less in phases 2–3 (`bosses.coilSubmergedTaken`) |
| Surfaced | Winding up, attacking or recovering in deep water | Normal |
| Exposed | Center on shallow water (any: rim, flats, borrowed) | Normal. It can't dive |
| Stranded | Rule 31: its water went away under it | 50% more. Only Tail thrash. After 5 s it crawls back to water at 6 cells/s |
| Iced | The cell under its center froze | Normal. Can't move or attack. After 2.5 s it breaks out: ice within 6 cells of it returns to water. Then 10 s in which freezing doesn't hold it (ice it touches breaks) |
| Overloaded | Phase 3: player charge reached its water during a Body pulse windup | Normal. Pulse cancelled, stunned 2 s, then 6 s before the next Body pulse |

It is always Wet and uses the boss chill rule (§6.4). It swims any water: shallow, deep, rim, flats, borrowed. Its hits use its head circle (radius 5); its trailing body is drawn, not hit.

| Phase | Life | What happens | What it teaches |
|---|---|---|---|
| 1 | 100–66% | It circles the Eye and the channels, Submerged. It surfaces to Lunge at a player within reach of its water and to Spit at one farther off. The Eye pulse electrifies all of its water every 7 s, after a 1.2 s glow | Deep water is its home and a conductor; stand on stone. Hit it while it surfaces. Its Spit puddles Wet you |
| 2 | 66–33% | Dives deeper: Submerged now takes 90% less. It lunges only at a player within 8 cells of its water, spits in volleys of 3, and the Eye pulse comes every 5 s. It chases the player through any water it can reach, so borrowed water lures it out: Exposed in the shallows, Stranded when Tide's 10 s run out. Frost is the backup: freeze the water under it for a short Iced window | Use Tide, the dungeon item: paint a water path from the Eye toward you, step back onto stone, wait for it to follow, and burst it while Stranded |
| 3 | 33–0% | Calls the pylons. Every 6 s they glow 1.2 s, then electrify their pads and the rim (rules 12–13). The Eye pulse stops; instead a Body pulse every 4 s electrifies the water within 20 cells of it, after a 1.0 s glow. Your lure water now carries its pulses: don't stand in it or on anything joined to it | Combine everything: Tide to strand, Frost to cut a lure off from you (ice doesn't conduct), Storm to Overload it. Its own element can't hurt it much (75% Storm resistance), but your charge in its water during the glow chokes the pulse |

Pacing target: the campaign bot's tier-8 reference build kills it in 120 to 180 s.

Reward: the Gale rune (an "item get" panel about 2 s after it dies, as the Warden's Storm), a Pattern Seed, the Coil Dynamo part (CONTENT §4), loot, and on the first kill a tier 9 Rift Sigil and the opening of tiers 9 and up (§10.4).

## 11. Meta progression: the Hearth (M7)

The Hearth is the hub. NPCs: the Spindlewright (crafting bench), the Runekeeper (rune storage and leveling), the Cartographer (rifts).

**Embers** drop from everything and pay for Hearth buildings. Each building levels up and produces passively:

| Building | Produces |
|---|---|
| Kindling Pit | Thread Scrap per minute |
| Rune Garden | XP for runes stored in it |
| Expedition Board | Send hired Weavers on timed rifts for parts, currency and Rift Sigils; one of your best tier counts toward the next tier like a completion |
| Salvage Loom | Auto-salvages loot below a filter into Thread Scrap |

Offline progress is capped at 8 hours.

**Rekindle** (prestige) unlocks after clearing a tier 8 rift. It resets rift progress and Hearth buildings, never the character or items (nor the record of the highest tier ever completed), and grants Ash based on highest tier cleared and Embers spent. Ash buys permanent Mutations (CONTENT §11). Each Rekindle raises the maximum rift tier by 2.

## 12. Technology and performance

- Web stack: TypeScript, Vite, PixiJS v8, Preact for the DOM overlay UI, Vitest, Playwright, ZzFX, lil-gui. A Tauri desktop build arrives in M8.
- The sim is separate from rendering and deterministic (rules in `CLAUDE.md`).
- Entities are plain data in struct-of-arrays or a small hand-rolled ECS. No class inheritance trees.
- Collision uses a spatial hash with buckets of 8×8 cells.
- Grid rendering: grid fields are uploaded as data textures each grid tick. One fragment shader draws materials, animated fire (noise), water ripples, ice sheen, charge crackle, smoke and steam, interpolating between grid ticks. Bloom on fire and storm via `pixi-filters`.
- Saves: versioned JSON in IndexedDB with migrations, plus export and import to a file. Autosave on room change.
- Replays: seed plus input log. A replay file reproduces a bug headlessly.

Performance budgets. Reference machine: a mid-range laptop with integrated graphics, 1080p, Chrome.

| Budget | Target |
|---|---|
| Frame rate | 60 fps with 300 enemies, 2,000 spell instances, 4,000 particles, 256×256 grid with 20% active |
| Entity sim step | ≤ 4 ms average |
| Grid tick | ≤ 3 ms at 256×256 with 20% active |
| Node benchmark | Entity step ≤ 2.7 ms and grid tick ≤ 2.0 ms on the dev machine: the budgets above ÷ 1.5, leaving headroom for slower machines |
| Wind (M8) | The same grid tick budget with room wind on, 8 live gusts and smoke on 30% of the active cells (§6.6) |

## 13. Audio

- Sound effects are ZzFX presets defined in data: per element, per form, hits, kills, UI.
- Voice limit: 24 simultaneous sounds, minimum 30 ms between repeats of the same sound.
- Ambient loops (fire crackle, water, wind) from filtered WebAudio noise.
- Music: a slot for user-supplied tracks. None required.

## 14. Readability rules

- Any enemy attack that deals 15% or more of the player's life has a ground telegraph of at least 0.4 s and a red-magenta edge.
- Player effects fade toward lower opacity when density is high. Settings: effect density 100 / 60 / 30%.
- Hazards that can hurt the player (enemy- or world-owned) get a pulsing edge. Player-owned hazards don't.
- Each element owns a color. Enemies never use these as full-saturation body colors.

| Element | Color |
|---|---|
| Fire | `#FF7A2F` |
| Frost | `#8FE3FF` |
| Storm | `#F5E04A` core with `#9B7BFF` glow |
| Tide | `#2F7BFF` |
| Gale | `#E8F4F0` streaks |
| Oil | `#3A2A4A` with a sheen |

- Status icons above enemies: Ignite, chill meter, Freeze, Shock %, Wet, Oiled; in M8 also Stranded, Charged (Copperback), Hot or Cracked (Slagshell) and Rung (Bellshell, Bellwether).
- Fog (M8) never hides threats: telegraphs, hazard edges, enemy outlines, charge, fire and lit braziers draw above it. Fireflies (render only) drift over water and gather around metal in fog, a gentle hint where pylons are.
- Borrowed terrain (M8) flickers in its last 1.5 s.
- Accessibility (M8): each element also gets a pattern (fire flicker, frost crystal, storm zigzag), screen shake off, reduced flashing.

## 15. Art direction

- Flat vector shapes with thick dark outlines and a bright palette per region. Cel-shaded feel in 2D.
- Characters and enemies are layered shapes drawn in code with procedural animation: bob, lean into movement, squash and stretch on hits and casts, a short anticipation pose before attacks. Sprites can replace them later without touching the sim.
- The grid shader carries most of the visual identity: fire, water and ice should look good, because the player looks at them constantly.

## 16. Out of scope for now

Multiplayer, trading, procedural quests, voiced dialogue, 3D, mobile, a modding API. Keep the data format clean enough that modding is possible later.

## 17. Open questions for the designer

Defaults are chosen so work can start. Revisit after playtests.

| Question | Current default |
|---|---|
| Should your own terrain hazards hurt you? | No |
| Damage numbers on by default? | Yes |
| Can a rune be used in more than one weave at once? | No, one place at a time |
| Should Ash regrow into grass over time? | No |
