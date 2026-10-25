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
| 2 | Glasswater Fen: marsh, metal ruins | Storm, conduction | The Drowned Foundry | Tide rune | M8 |
| 3 | Galeback Cliffs: wind, ledges | Gale, wind fields | TBD | Gale rune | Later |

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
| `air` | u8 | None, Smoke, Steam |
| `fire` | u8 | Burn intensity 0 to 255 |
| `fuel` | u16 | Remaining burn time in grid ticks |
| `charge` | u8 | Remaining electrified ticks |
| `airTimer` | u8 | Remaining smoke/steam ticks |
| `timer` | u16 | Material timer: thaw, crack, dry, temporary terrain |
| `wet` | u8 | Remaining ticks a non-water cell stays wet (Tide, Hydromancer). Wet cells can't ignite |
| `under` | u8 | Material the cell becomes when its current material burns away or its timer ends: pit under a wooden floor, deep water under a bridge, the original ground under temporary water or ice. Freezing or melting temporary terrain keeps `under` |
| `owner` | u8 | Team that created the current effect: world, player, enemy |

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
| Pit | no | no | no | Projectiles pass over |

Surface layer:

| Surface | Effect |
|---|---|
| Oil | 15% slow, applies Oiled. Flammable 0.70 per tick, burns 2.0 s at double terrain-fire damage, then gone. Floats on water and can burn there |

Air layer:

| Air | Effect |
|---|---|
| Smoke | From burning grass, bramble, wood. Lasts 4 s. Blocks enemy sight (Blind). Only lightly tints the player's view |
| Steam | From fire on water. Lasts 3 s. Same sight rules as smoke |

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
| 21 | Wind blows over fire (M8, Gale) | | Spread chance ×2 downwind, ×0.25 upwind. Smoke and steam drift with the wind |
| 22 | An Ignited entity moves over a flammable cell | | That cell ignites, owned by the team that ignited the entity. Entities that are always burning (Tinderlings) light enemy-owned cells |
| 23 | Fire burns on mud for 1 s | | Mud dries to dirt |
| 24 | Tide (M8) hits terrain | | Fire goes out, dirt becomes mud, stone becomes shallow water for 10 s, grass is unburnable for 10 s |
| 25 | An ice bridge breaks under an entity | | Entity falls: 10% max life damage, then returns to its last safe cell |
| 26 | Fire is placed on a walkable non-flammable cell (spell footprint, death burst, explosion, rule 18 trail) | Not water (rule 4), not ice (rule 5) | Placed fire at intensity 128 for 1.0 s (Lingering applies). It spreads into flammable neighbors by rule 2 and damages by rule 16, then goes out leaving the ground unchanged (except mud, rule 23) |

**Hazard ownership.** Every terrain effect records its owner team. Hazards damage the other team and never their owner team. World-owned hazards (ambient fires, a Tar Hulk explosion) hurt everyone. Fire that spreads keeps the owner of the cell it spread from. A new effect on a cell takes the new owner. Exception: fire on the Tar Matriarch's tar (CONTENT §5) is always world-owned, whoever lit it.

### 6.4 Ailments

| Ailment | Rule (starting values) |
|---|---|
| Ignite | Damage over time of 50% of the triggering fire hit per second for 3 s. A new ignite replaces the old one only if stronger. Terrain fire ignites at **terrain-fire DPS** = 10% of `refLife(area level)` per second (§7); above area level 10 it grows like monster damage (×1.09 a level) instead (M6.5) |
| Chill | Each frost hit adds (damage ÷ max life) × 200 chill. Slow = 0.3% per chill point, max 30%. Decays 25 chill/s |
| Freeze | At 100 chill: frozen for 1.2 s (can't act) |
| Boss chill | Bosses use their own rule: each Frost hit adds a flat 12 chill (×1.5 if Wet), whatever its damage. Chill decays 10/s, slow max 15%. Freeze lasts 0.8 s, then 6 s of freeze immunity |
| Shock | Increased damage taken = clamp(hit ÷ max life × 100, 5, 50)%, for 4 s. The strongest one applies |
| Wet | Rule 15. Extinguishes and prevents Ignite. Chill gain ×1.5. Makes the entity conductive (rule 19) |
| Oiled | Rules 17 and 18 |
| Blind | An enemy inside smoke or steam, or whose target is inside it, can't acquire targets beyond 4 cells |

The player suffers the same ailments from enemy and world hazards, with player-side limits: freeze at most 0.6 s, shock at most 30%.

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
- Exploration rewards: **Heart Seeds** (+8 max life each) and **Loom Shards** (+1 Capacity), hidden behind chemistry puzzles. Emberwood and the Kiln hold 4 Heart Seeds and 3 Loom Shards.

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
| Conduct | Storm through water and metal to a conduit switch (after the boss) |
| Time | Cross before the ice bridge breaks |

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
- MVP endgame is a tier ladder. A hex-map "atlas" with adjacent-node bonuses comes in M8.
- The ladder (M7): completing a rift's boss drops a sigil of its tier, or of the next tier with a chance that falls with the tier and grows with every completion of your best tier, so each rift brings the next tier closer. Below the highest tier you have ever completed (kept through Rekindles) the next tier comes fast, so a new cycle climbs back quickly and only new territory is slow. Higher tiers also give monsters more life and damage than their area level alone (CONTENT §10, Tiers).

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

- Status icons above enemies: Ignite, chill meter, Freeze, Shock %, Wet, Oiled.
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
