# Runeloom: MVP Content

All numbers are starting values. They live in `data/` and get tuned with the balance sim. Section references like "DESIGN §6.3" point into `docs/DESIGN.md`.

"Ships" says which milestone first needs the entry. Anything marked M5 or later can be left out of earlier milestones.

---

## 1. Runes

Notation names are the Name column with spaces removed. "cx" is complexity cost.

### 1.1 Triggers

The first rune of every weave. Exactly one per weave.

| Name | cx | Mana × | ICD | Behavior | Ships |
|---|---|---|---|---|---|
| Cast | 0 | 1.0 | — | Fires when the slot's button is pressed. Uses the form's cast time | M2 |
| Pulse | 2 | 1.0 | — | Fires every 2.0 s (−0.05 s per rune level, min 1.0 s) at the nearest visible enemy within 40 cells. Skips if there is none | M2 |
| On Dodge | 2 | 0.7 | 0.5 s | Fires at dodge start from the player, aimed along the dodge direction | M2 |
| Harvest | 2 | 0.5 | 0.25 s | Fires from any enemy you kill, aimed away from you | M2 |
| On Crit | 2 | 0.6 | 0.3 s | Fires from the target you crit, aimed along the hit direction | M2 |
| On Hurt | 2 | 0 | 1.0 s | Fires at your position when one hit deals at least 5% of your max life | M2 |
| Channel | 1 | 0.3 per fire | — | While held, fires every 0.2 s. Ignores cast time. Movement −40% | M5 |
| Shatter | 2 | 0.6 | 0.3 s | Fires from an enemy you shatter (rule 20), aimed away from you. Unlocked by a Mutation (§11) | M7 |

### 1.2 Forms

Base damage is at rune level 1. Terrain footprint is where the form applies its elements' terrain effects (DESIGN §6.3).

| Name | cx | Base mana | Cast time | Base dmg | Crit | Behavior | Terrain footprint | Ships |
|---|---|---|---|---|---|---|---|---|
| Bolt | 1 | 6 | 0.45 s | 12 | 6% | Projectile, 70 cells/s, 0.9 s life, radius 1 cell. Stops on first hit. Knockback 1 cell | 2-cell radius at impact or expiry | M1 hardcoded, M2 rune |
| Nova | 2 | 10 | 0.60 s | 14 | 5% | Ring expands from origin to 10 cells over 0.2 s. Hits each target once. Knockback 2 cells outward | The full disc | M2 |
| Beam | 2 | 8 | 0.35 s | 9 | 5% | Instant line up to 45 cells, width 1.5. Hits the first target only. Walls stop it | The line, 1 cell wide | M2 |
| Lob | 1 | 7 | 0.55 s | 15 | 5% | Arcs to the aim point (max 40 cells) over 0.5 s, passing over enemies and walls. 5-cell burst on landing | The burst | M2 |
| Orb | 2 | 9 | 0.50 s | 6 | 5% | Orbits the caster at 6 cells, 1 revolution per second, for 3 s. Radius 1.5. Hits each target at most every 0.5 s | 1-cell radius under the orb every 0.25 s | M2 |
| Strike | 1 | 4 | 0.40 s | 16 + spindle bonus | 7% | Melee arc 120°, 5 cells reach. Knockback 3 cells. Physical unless it has an element | The arc | M1 hardcoded, M2 rune |
| Swath | 1 | 8 | 0.40 s | 4 | 0% | Paints a 14×3-cell strip from the caster toward the aim. Hits each entity in the strip once | The strip | M2 |
| Sigil | 2 | 12 | 0.50 s | 0 | — | Places a sigil at the aim point (max 30 cells) for 4 s. Deals no damage itself and needs an Emit branch | None | M2 |

Mana on hit (DESIGN §2.1, "Closer pays more"): Strike restores 2 mana and Nova restores 1 mana for each enemy it hits within 8 cells of the player, up to 6 mana per spell instance. This applies however the spell was cast (a trigger or a branch), as long as the enemy is close to the player when hit. All three numbers are tunable.

Validation:

- Every form except Strike needs at least one element, unless it is a branch spell inheriting one.
- Sigil needs at least one Emit branch.

### 1.3 Elements

| Name | cx | Mana × | Effect | Ships |
|---|---|---|---|---|
| Fire | 1 | 1.10 | Fire damage, Ignite. Terrain rules 1–6 and 26 | M2 (terrain in M3) |
| Frost | 1 | 1.10 | Frost damage, Chill and Freeze. Terrain rules 7–10 | M2 (terrain in M3) |
| Storm | 1 | 1.15 | Storm damage, Shock, +2% crit. Terrain rules 11–14 | M2 (terrain in M3) |
| Tide | 1 | 1.00 | Physical damage, applies Wet for 3 s. Terrain rule 24 | M8 |
| Gale | 1 | 1.00 | Physical damage, knockback ×2, a 2 s wind gust in a cone (rule 21) | M8 |

### 1.4 Modifiers

Each modifier can appear at most once per spell. "Damaging forms" means every form except Sigil.

| Name | cx | Mana × | Applies to | Effect | Ships |
|---|---|---|---|---|---|
| Split | 2 | 1.40 | Bolt, Lob | +2 instances in a 30° fan. 25% less damage | M2 |
| Chain | 2 | 1.30 | Bolt, Beam | After a hit, chains to up to 2 more targets within 12 cells. 15% less damage per chain | M2 |
| Pierce | 1 | 1.15 | Bolt, Beam | Passes through up to 3 more targets | M2 |
| Wide | 1 | 1.20 | Nova, Lob, Strike, Swath, Orb | +40% area | M2 |
| Echo | 3 | 1.50 | Bolt, Nova, Beam, Lob, Strike, Swath | Repeats the spell once, 0.35 s later, from the same origin and aim. The repeat deals 20% less damage | M2 |
| Seeker | 2 | 1.25 | Bolt | Turns toward the nearest enemy at 180°/s | M2 |
| Heavy | 1 | 1.20 | Damaging forms | 30% more damage. 15% slower cast | M2 |
| Keen | 1 | 1.10 | Damaging forms | +5% base crit chance, +30% crit multiplier | M2 |
| Lingering | 1 | 1.20 | Any | Terrain effects last 50% longer. Ailment durations +30%. Orb and Sigil last 50% longer | M2 |
| Saturate | 2 | 1.30 | Any spell with an element | Terrain footprint area ×2. 20% less hit damage | M2 |
| Fork | 2 | 1.30 | Bolt | On first hit, splits into 2 bolts at ±40° with 0.5 s life | M5 |
| Return | 1 | 1.15 | Bolt | At end of life, flies back to the caster and can hit again | M5 |
| Infuse | 1 | 1.15 | Any | `inherit`: this spell's elements are added to every branch spell below it | M5 |
| Focus | 1 | 1.20 | Nova, Lob, Swath | 30% less area, 40% more damage | M5 |
| Swift | 1 | 1.10 | Bolt, Lob | +50% projectile speed. Lob flight time −30% | M5 |

### 1.5 Branches

Branch cost is the base cx at depth 1, +1 at depth 2, +2 at depth 3 (DESIGN §5.4).

| Name | Base cx | Parent forms | Child origin and aim | Damage | Proc rule | Ships |
|---|---|---|---|---|---|---|
| On Hit | 2 | Bolt, Beam, Lob, Strike, Orb, Nova | From the hit target, aimed along the parent's direction | 35% less | Once per parent instance. Up to 3 times per instance if the parent has Pierce or Chain. Area forms fire it on the first target hit only | M2 |
| On Expire | 2 | Bolt, Beam, Lob, Nova, Orb, Swath, Sigil | From where the instance ends, aimed along its last direction | No penalty | Once per instance, whenever the instance ends: life runs out, it stops on an enemy, or it hits a wall | M2 |
| On Kill | 2 | Damaging forms | From the killed target, aimed away from the caster | No penalty | Once per kill | M2 |
| Emit | 2 | Orb, Sigil | From the instance, aimed at the nearest enemy within 30 cells | 50% less | Every 0.5 s while the instance lives. Skips if no enemy is in range | M2 |

Aim notes: Nova ignores aim. A Lob branch spell lands on a random point within 10 cells of its origin, chosen with the sim RNG.

---

## 2. Reference weaves

These are test fixtures and statements of design intent. Every one must parse, round-trip through the printer, and compile, or fail with the stated error. Each gets a behavior test in M2, extended with terrain assertions in M3.

Tests compile weaves against a dev-only `test_spindle` whose Capacity the test sets. It never drops. The "Fits" column lists the spindle bases (CONTENT §3) whose base Capacity is enough; each Loom Shard adds +1, so smaller spindles also fit once the player has Shards.

| # | Name | Notation | cx | Fits | Behavior to test |
|---|---|---|---|---|---|
| 1 | Starter Spark | `Cast > Bolt[Fire]` | 2 | All | Hit enemy is Ignited. Impact on grass ignites it (M3) |
| 2 | Fireline | `Cast > Swath[Fire, Lingering]` | 3 | All | Strip of grass ignites. Terrain fire from it lasts 50% longer |
| 3 | Wildfire Seed | `Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]` | 8 | All | On a grass field, fire spreads past the nova's radius within 3 s |
| 4 | Scatter Spark | `Cast > Bolt[Fire, Split, Pierce]` | 5 | All | 3 bolts in a fan, each passing through up to 4 targets total |
| 5 | Glacier Step | `OnDodge > Nova[Frost, Saturate]` | 7 | All | Dodging at deep water freezes the water around the dodge start into ice bridge, covering the 12-cell dodge path (M3) |
| 6 | Shatter Lance | `Cast > Beam[Frost, Pierce] > OnKill > Nova[Frost, Wide]` | 10 | Ashwood, Ironbark, Heartwood, Loomsteel | Killing Frozen enemies shatters them. The nova freezes nearby water (M3) |
| 7 | Conductor | `Cast > Bolt[Storm, Chain]` | 4 | All | Bolt into water electrifies the connected body. Wet enemies arc (rule 19) |
| 8 | Stormfront | `Pulse > Lob[Storm, Saturate]` | 6 | All | Fires only when a visible enemy is within 40 cells |
| 9 | Steam Veil | `OnHurt > Nova[Fire, Saturate]` | 7 | All | Getting hurt while standing in water makes steam. Enemies inside it are Blind |
| 10 | Ember Orbit | `Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]` | 12 | Heartwood, Loomsteel | Orb emits homing bolts every 0.5 s while alive |
| 11 | Thunder Sigil | `Cast > Sigil[Storm] > Emit > Beam[Chain]` | 9 | Rimeglass, Ashwood, Ironbark, Heartwood, Loomsteel | Emitted beams deal Storm damage (inherited element) |
| 12 | Echo Strike | `Cast > Strike[Storm, Echo, Keen]` | 6 | All | Second strike 0.35 s later with 20% less damage |
| 13 | Twin Fates | `Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }` | 11 | Heartwood, Loomsteel | Both branches fire, On Hit first (the bolt stops on the enemy, which ends it) |
| 14 | Recursion Stress | `Cast > Bolt[Storm, Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split]` | 22 | None | Fails validation: "Needs 22 Capacity". With a 22-Capacity `test_spindle` in `dummy_grid`, it can spawn up to 120 instances, so it hits the 64-per-cast cap and the debug counter shows the dropped spawns |

Weaves that must fail validation, with their messages:

| Notation | Message |
|---|---|
| `Cast > Nova[Fire, Pierce]` | "Nova can't take Pierce" |
| `Cast > Sigil[Fire]` | "Sigil needs an Emit branch" |
| `Cast > Bolt[]` | "Bolt needs an element" |
| `Cast > Bolt[Fire, Split, Split]` | "Split can only be used once per spell" |
| #14 with a fourth `> OnHit > Bolt[Split]` | "Branches can nest at most 3 deep" (structure errors come before Capacity, DESIGN §5.3) |

---

## 3. Spindles

| Base | Item level | Capacity | Cast speed | Implicit | Fuse sockets | Ships |
|---|---|---|---|---|---|---|
| Twig Spindle | 1 | 8 | 1.00 | — | 1 | M2 (starter) |
| Ashwood Spindle | 4 | 10 | 1.00 | 10% increased Fire damage | 1 | M4 |
| Ironbark Spindle | 6 | 10 | 0.92 | Strike base damage +12 | 1 | M4 |
| Rimeglass Spindle | 8 | 9 | 1.05 | 20% increased chill build-up | 1 | M4 |
| Heartwood Spindle | 18 | 13 | 1.00 | — | 2 | M5 |
| Loomsteel Spindle | 30 | 15 | 1.00 | +1 to all rune levels | 2 | M5 |

Affix pools (M4 ships Magic items; Rare tiers in M5):

| Slot | Prefixes | Suffixes |
|---|---|---|
| Spindle | % increased Fire / Frost / Storm damage, % increased damage with branch spells, +flat Strike damage | % increased cast speed, +% crit chance, % reduced mana cost, % increased terrain effect duration, +1 Capacity (item level 15+, rare weight) |
| Cloak | + max life, % increased life | + Fire / Frost / Storm resistance, + mana regen |
| Hood | + max mana, % increased ailment duration, % increased life (M6.5) | + resistances, % increased chill / shock / ignite effect |
| Boots | % increased move speed, % increased life (M6.5) | + resistances, % faster dodge recharge |
| Charm | % increased elemental damage, + life | + resistances, % increased spread chance for fire you create, % increased conduction range |

Tiers (M6.5): every affix but +1 Capacity has six. Tiers 4–6 roll from item levels 1, about 5 and about 9 (the region); tiers 3, 2 and 1 from item levels 16, 24 and 32 (rifts), at about 1.4×, 1.85× and 2.35× the tier 4 range (data/affixes.ts).

---

## 4. Fuse parts

Tier II and III multiply numeric values by 1.5 and 2. Parts without a number instead gain 10% / 20% increased damage of their element at higher tiers.

| Part | Drops from | Effect | Ships |
|---|---|---|---|
| Tinder Tooth | Tinderling | The first Fire rune in each weave costs 0 complexity | M4 |
| Bog Gill | Bog Lurker | Storm arcs between Wet enemies (rule 19) reach 50% farther and hit 2 more targets | M4 |
| Tar Gland | Tar Hulk | Your Fire hits leave a 2-cell oil patch, which they then ignite | M4 |
| Rime Mote | Frost Wisp | Freeze lasts 40% longer | M4 |
| Shield Plate | Shieldbearer | Take 20% less damage from projectiles | M4 |
| Storm Antler | Stormcaller | Charge you create on water and metal lasts 0.5 s longer | M4 |
| Ember Feather | Ember Archer | Bolt and Lob projectiles are 25% faster | M4 |
| Kiln Chitin | Kiln Mite | Dodge recharges 15% faster | M4 |
| Matriarch's Sac | Tar Matriarch | Your hits apply Oiled for 2 s | M4 |
| Cinder Heart | Cinder Warden | Grants `Harvest > Nova[Fire]` as an extra weave that uses no slot and no Capacity | M4 |

---

## 5. Enemies

Life is at area level 1 and scales per DESIGN §7. Speed is in cells per second. Resist is Fire / Frost / Storm in %.

| Id | Name | Life | Speed | Resist | Behavior | Chemistry | Ships |
|---|---|---|---|---|---|---|---|
| `tinderling` | Tinderling | 14 | 22 | 75 / −25 / 0 | Swarms in packs of 6–10. Melee nip for 4 after a 0.3 s windup | Always burning and immune to Ignite. Ignites flammable cells it crosses (rule 22). On death leaves 3×3 enemy-owned fire. If Wet, it goes out: stunned for 2 s and takes 50% more damage | M1 |
| `shieldbearer` | Shieldbearer | 90 | 15 | 25 / 25 / 25 | Wooden shield blocks projectiles and beams in a 100° front arc. Shield bash for 12 after a 0.5 s windup | The shield is wood: 4 s of total burning destroys it | M1 |
| `ember_archer` | Ember Archer | 40 | 16 | 50 / 0 / 0 | Kites at 20–30 cells. Fire arrow for 10 every 1.4 s after a 0.4 s draw | Missed arrows ignite flammable cells where they land | M1 |
| `bog_lurker` | Bog Lurker | 60 | 14, lunge 32 | 0 / 0 / −30 | Lurks submerged. Lunges at the player within 10 cells after a 1.2 s ripple telegraph. Bite for 14 | Always Wet. Can't leave water. Freezing its water traps it until the ice thaws | M4 |
| `tar_hulk` | Tar Hulk | 160 | 9 | −30 / 0 / 0 | Slow bruiser. Ground slam for 22 in a 5-cell radius after a 0.9 s telegraph | Leaves an oil trail. Ignited while Oiled: explodes after 1.5 s in a 6-cell world-owned fire burst for 40, which hurts everyone | M4 |
| `frost_wisp` | Frost Wisp | 35 | 18, floats | 0 / 75 / 0 | Frost bolt for 8 every 1.6 s. Every 6 s draws a 16-cell frost line | Floats over water and pits. Its frost line freezes water, sometimes opening a path for the player | M4 |
| `stormcaller` | Stormcaller | 50 | 14 | 0 / 0 / 50 | Keeps 15–25 cells away. Lightning strike for 18 with a 1.0 s circle telegraph | Prefers to target water or metal within 8 cells of the player, electrifying it | M4 |
| `kiln_mite` | Kiln Mite | 10 | 26 | 0 / 0 / 0 | Tiny swarmer. Nip for 3 | Spawned by Brood Kilns: objects with 200 life that spawn 3 mites every 5 s. A Frozen kiln stops spawning | M4 |

Objects and bosses. Bosses and the Brood Kiln are placed with `@spawn <digit> enemy:<id>`. Boss numbers are absolute, at their area level.

| Id | Name | Area level | Life | Resist | Notes |
|---|---|---|---|---|---|
| `brood_kiln` | Brood Kiln | Room level | 200 | 50 / 0 / 0 | Stationary object. Spawns 3 Kiln Mites every 5 s. Stops while Frozen. Legend character `&` (§6.1) |
| `tar_matriarch` | Tar Matriarch (mini-boss) | 8 | 5,000 | −30 / 0 / 0 | Tar Hulk elite. Her globs and her rush leave **tar**: oil whose fire is world-owned whoever lights it, so it hurts everyone (other oil keeps DESIGN §6.3 ownership). Lit while Oiled she **flares** after the Hulk's 1.5 s fuse: a 6-cell world-owned fire burst that hits everyone else and burns her too, then can't flare again for 10 s (getting Wet puts the fuse out). At 50% life she calls her **tar crew**, 2 Tar Hulks beside her and 4 Tinderlings on her tar (which they light), and phase 2 begins: she walks 35% faster, her cooldowns are 25% shorter and she adds the tar rush. Teaches oil plus fire, and the explosion risk |
| `cinder_warden` | Cinder Warden | 10 | 5,000 | 75 / −25 / 25 | Three phases, DESIGN §10.3. Uses the boss chill rule (DESIGN §6.4) |

Boss attacks:

| Boss | Attack | Damage | Telegraph | Effect |
|---|---|---|---|---|
| Tar Matriarch | Slam | 30 | 1.0 s, 6-cell circle | Knockback 4 cells |
| Tar Matriarch | Tar glob | 15 | 0.8 s landing marker | Leaves a 4-cell splat of tar |
| Tar Matriarch | Tar rush (phase 2) | 25 on contact | 0.9 s line | At a player at least 9 cells away: a run 6 cells past where they stood (at most 32 cells, 40 cells/s, stopping at walls), knockback 4 cells. Smears tar 2.4 cells around her path |
| Tar Matriarch | Flare | 35 Fire to everyone else in it, 250 to herself | 1.5 s fuse, 6-cell circle | When she is lit while Oiled. World-owned: lights the tar and oil in it, and Oiled Tar Hulks it hits start their own fuses. 10 s cooldown. Dying with the fuse lit flares at once |
| Cinder Warden | Charge | 30 on contact | 1.0 s line | Leaves a trail of placed fire (rule 26) that ignites grass |
| Cinder Warden | Fire slam | 40 | 0.8 s, 6-cell circle | Placed fire in the circle |
| Cinder Warden | Fire breath (phases 2–3) | 18 + Ignite | 0.6 s, 12-cell cone | Makes steam on water |
| Cinder Warden | Brazier storm (phase 3) | 35 Storm | Braziers glow 1.2 s | Electrifies connected water and metal (rules 11–13) every 5 s |

Pack tables:

| Pack id | Contents |
|---|---|
| `tinderling_swarm` | 6–10 Tinderlings |
| `archer_line` | 3 Ember Archers and 1 Shieldbearer |
| `tar_crew` | 1 Tar Hulk and 4 Tinderlings |
| `bog_nest` | 2–3 Bog Lurkers (spawn markers in water only) |
| `wisp_flight` | 2 Frost Wisps and 3 Kiln Mites |
| `caller_guard` | 1 Stormcaller and 2 Shieldbearers |

Monster rarity: Magic packs (blue) have 1–2 mods and ×1.7 life. Rares (yellow) have 2–4 mods, ×4 life and 2 minions. Mods ship in M5; M4 needs only Hasted, Incendiary and Thick-skinned for the first Rares. Rooms request rarity on the `@spawn` line (§6.2). Pack leaders and minion kinds: tinderling_swarm tinderling / tinderling, archer_line shieldbearer / ember_archer, tar_crew tar_hulk / tinderling, bog_nest bog_lurker / bog_lurker, wisp_flight frost_wisp / kiln_mite, caller_guard stormcaller / shieldbearer.

| Mod | Effect |
|---|---|
| Hasted | +30% move and attack speed |
| Incendiary | On death, 5×5 enemy-owned fire |
| Waterlogged | Always Wet: immune to Ignite, conductive |
| Frostbound | Can't be chilled or frozen |
| Grounded | Immune to Shock and arcs |
| Volatile | Explodes 1 s after death in a 4-cell radius for 3× its attack damage as Fire. Blasts on top of each other (within 2 cells and 0.5 s) hit once (M6.5) |
| Swarming | Brings 2 extra minions of a weaker type |
| Thick-skinned | +40% life |

---

## 6. Room format

Rooms are text files in `data/rooms/<region>/<room>.txt`. Lines starting with `@` are headers. The rest is the grid. Each character is one tile of 4×4 cells, so a 64×36-character map is 256×144 cells. All rows must have the same width. Use ASCII only.

### 6.1 Legend

| Char | Tile |
|---|---|
| `#` | Wall |
| `.` | Stone |
| `,` | Dirt |
| `"` | Grass |
| `*` | Bramble |
| `=` | Wooden bridge over deep water |
| `+` | Wooden floor over a pit |
| `~` | Shallow water |
| `w` | Deep water |
| `_` | Pit |
| `m` | Metal floor |
| `M` | Metal pylon |
| `o` | Oil on stone |
| `O` | Oil on shallow water |
| `i` | Ice. Authored ice never thaws on its own; fire still melts it |
| `:` | Mud |
| `B` | Brazier: metal, lit by Fire, conducts |
| `c` | Crate |
| `\|` | Wooden barricade: blocks, burns away to stone |
| `b` | Oil barrel: blocks, explodes when ignited |
| `&` | Brood Kiln |
| `P` | Pushable stone block |
| `I` | Pushable ice block: slides on ice until blocked; Fire melts it into shallow water |
| `S` | Conduit switch |
| `T` | Pressure plate |
| `D` | Door, opened by its `@link` condition |
| `K` | Locked door, needs a small key |
| `k` | Chest with a small key |
| `G` | Big-key door |
| `g` | Chest with the big key |
| `R` | Rune shrine: an altar holding the room's dungeon item. Touching it pays the room's guaranteed runes (§9.1); it pays once and stays empty |
| `H` | Heart Seed |
| `L` | Loom Shard |
| `x` | Loom Stone: waypoint and respawn point |
| `s` `r` `C` | Hearth NPCs (M7, hub only): the Spindlewright, the Runekeeper, the Cartographer |
| `F` | The Hearth fire (M7, hub only): decorative, never burns anything |
| `p` `y` `E` `V` | Hearth building plots (M7, hub only): Kindling Pit, Rune Garden, Expedition Board, Salvage Loom |
| `1`–`9` | Spawn markers |
| `<` `>` `^` `v` | Exits on the west, east, north and south edges, placed in the edge column or row |

Hearth stations are solid and inert, and Interact (F) beside one opens its screen. A station that covers several tiles repeats its character in one rectangle (the hub draws 3×2 buildings and a 3×3 Hearth fire).

A marker or object tile (digits, `B`, `H`, `L`, `k`, `g`, `R`, `S`, `T`, `x`, `c`, `\|`, `b`, `&`, `P`) sits on the most common ground among its 4 neighbors. Ties go to stone. This is how the Heart Seed in the example below ends up floating on deep water.

### 6.2 Headers

```
@id <region>/<room>
@name <display name>
@level <area level>
@exit <w|e|n|s> <room id>
@spawn <digit> enemy:<id> [count] [magic|rare]
@spawn <digit> pack:<pack id> [magic|rare]
@link <door char> <condition>
@note <object char> <text>
@clear exit <w|e|n|s>
```

Link conditions: `braziers:all`, `switch:S`, `plates:all`, `cleared` (all enemies dead), `timer:<seconds>:braziers:all` (all braziers lit within the time), `sealed` (never opens: a door that stays shut on purpose, like the K10 storm door). Several `@link` lines for one door must all hold.

Rarity (M4): a trailing `magic` makes every spawned enemy Magic with the same 1–2 mods. A trailing `rare` makes a pack's leader Rare with 2 normal minions of the pack's minion kind, or makes each enemy of an `enemy:` line Rare with 2 minions of its own kind. Bosses ignore rarity.

`@clear exit <edge>` (M4): the room's first-clear rewards are also paid when the player leaves through that edge, even with enemies left. E3 uses it, because burning the bridge strands part of the chasing pack.

`@note` (M4): when the object with that character activates (a switch is powered, a door opens, a chest opens, a pickup is taken), the game shows the text. The K10 storm door uses it: `@note S The Fen isn't woven yet.`

### 6.3 Example: Sunken Kiln, room K7

The player arrives from the west with the Frost rune and freezes the deep water to cross. The Heart Seed floats on deep water, so it can only be reached with an ice bridge. Lighting both braziers on the far side opens the east door.

```
@id kiln/k7_ice_crossing
@name Ice Crossing
@level 9
@exit w kiln/k6_frost_shrine
@exit e kiln/k8_slide_room
@spawn 1 enemy:frost_wisp 2
@spawn 2 enemy:bog_lurker
@link D braziers:all
##########################
#....~~~wwwwwwww~~~....B.#
#....~~~wwwwwwww~~~......#
<....~2~www1wwww~~~.....D>
#....~~~wwwwwwww~~~......#
#....~~~wwwHwwww~~~....B.#
##########################
```

---

## 7. Passive tree: keystones and notables

Keystones:

| Name | Area | Effect |
|---|---|---|
| Wildheart | Ember | Terrain fire you create scales with your Fire damage modifiers and spreads 50% faster. Your Fire hits deal 30% less damage |
| Pyre Walker | Ember | You're immune to all terrain fire, whoever owns it. While standing on burning ground, you deal 20% more damage |
| Hydromancer | Rime | You're always Wet. Dodging leaves shallow water along your path for 6 s |
| Stormglass | Tempest | Ice and ice bridges conduct Storm like water. Enemies that are Shocked and Frozen take 40% more Storm damage |
| Living Loom | Weaver | Weaves with automatic triggers cost no mana. All automatic triggers share a 0.4 s global cooldown |
| Single Thread | Weaver | Weaves with no modifiers deal 70% more damage. −3 Capacity |

Notables:

| Name | Area | Effect |
|---|---|---|
| Kindler | Ember | Fire you create spreads 30% faster. +10% Fire damage |
| Slow Burn | Ember | Ignite lasts 50% longer |
| Oilcraft | Ember | Oiled enemies take 25% more Fire damage |
| Deep Freeze | Rime | Freeze lasts 0.4 s longer. +15% chill build-up |
| Brittle | Rime | Chilled and Frozen enemies take 25% more Strike damage |
| Long Winter | Rime | Ice and ice bridges you create last 50% longer |
| Conduit | Tempest | Water you electrify conducts 15 cells farther, with a cell cap 200 higher |
| Overcharge | Tempest | Charge you create lasts 0.5 s longer. +10% Storm damage |
| Rainshadow | Tempest | Wet enemies take 15% more Storm damage |
| Spellwright | Weaver | +1 Capacity |
| Echoing Thread | Weaver | Echo's repeat deals full damage |
| Quick Hands | Warden | +10% cast speed. Dodge recharges 15% faster |
| Second Wind | Warden | +1 dodge charge |

Small nodes: +8% of one damage type, +5 life, +3% cast speed, +6% ailment effect, +4% terrain effect duration, and similar. Generate the rest of the roughly 90 MVP nodes from these patterns.

---

## 8. Uniques (M5)

| Name | Slot | Effect |
|---|---|---|
| The First Thread | Spindle (Twig base) | Capacity 6. Branch runes cost 0 complexity. Branches can nest at most 2 deep |
| Kiln-Heart Cloak | Cloak | +30 life. Immune to Ignite. Standing on burning ground heals 2% of life per second |
| Rimewalkers | Boots | Dodging leaves a 3-cell-wide ice trail for 4 s. Over deep water it makes ice bridge |
| Stormglass Charm | Charm | Grants the Stormglass keystone |
| Pyre Hood | Hood | +1 to Fire rune levels. Fire you create spreads 30% faster. You take 10% more Fire damage |
| The Unraveling | Charm | Branches can nest 4 deep. Spawn cap per cast is 96. Spells cost 40% more mana |

---

## 9. Emberwood and the Sunken Kiln (M4)

Overworld:

| Room | Area level | Content | Enemies |
|---|---|---|---|
| E1 Loomstone Glade | 1 | Start and Loom Stone. Tutorial: move, dodge, `Cast > Bolt[Fire]`, burn a bramble wall | `tinderling_swarm` |
| E2 Thicket | 2 | Bramble maze. Fire spreads, so burning the maze chases you through it. Hidden Loom Shard | Tinderlings, Ember Archers |
| E3 Riverbend | 3 | River with a wooden bridge. Burning the bridge cuts off a chasing pack | `bog_nest`, Tinderlings |
| E4 Old Mill | 4 | Oil barrels (`b`) and Tar Hulks. Explosion tutorial. Heart Seed behind crates | `tar_crew` |
| E5 Archer Ridge | 4 | A big grass field with archers on stone ledges. The wildfire fight | `archer_line` ×2 |
| E6 Shield Road | 5 | Shieldbearer patrols, teaches burning shields. First Rare pack. Heart Seed | Shieldbearers, Ember Archers |
| E7 Hollow Oak (side) | 5 | Light 3 braziers within 10 s. Loom Shard | Tinderling waves |
| E8 Kiln Approach | 6 | Loom Stone, mixed packs, dungeon entrance | Mixed, 1 Rare |

Sunken Kiln:

| Room | Area level | Content | Enemies |
|---|---|---|---|
| K1 Kiln Gate | 7 | Light 2 braziers to open the door | Kiln Mites, a Brood Kiln (`&`) |
| K2 Brazier Hall | 7 | Braziers behind low walls: Lob over them | Ember Archers |
| K3 Bramble Vault | 7 | Burn a path through bramble to a small-key chest. Locked door to K4 | Tinderlings |
| K4 Oil Works | 8 | Oil channels. Ignite the oil to burn away a wooden barricade (`\|`). Heart Seed | `tar_crew`, Kiln Mites |
| K5 Matriarch's Pit | 8 | Mini-boss: `tar_matriarch`. Arena oil and barrels to light her with; four shallow pools put a burning player out | — |
| K6 Frost Shrine | 8 | Dungeon item: the Frost rune, on a rune shrine (`R`) on the altar. Touching it opens the "new element" panel. Short tutorial: freeze a pool to reach the exit | — |
| K7 Ice Crossing | 9 | Example room in §6.3. Heart Seed | 2 Frost Wisps, 1 Bog Lurker |
| K8 Slide Room | 9 | Freeze a pool, then slide ice blocks onto 2 pressure plates. Loom Shard | Frost Wisps |
| K9 Thaw Lock | 10 | The big-key chest is encased in ice blocks. Melt them with fire, then freeze the meltwater to cross a gap | `caller_guard` (previews Storm) |
| K10 Warden's Hearth | 10 | Boss: `cinder_warden`. A Loom Stone by the entrance sleeps until he dies, then wakes (respawn point; open rifts there) | — |

Totals: 4 Heart Seeds (E4, E6, K4, K7) and 3 Loom Shards (E2, E7, K8).

### 9.1 New game loadout and rune unlocks

A new save starts with the Twig Spindle and the runes Cast, Bolt, Strike and Fire, with `Cast > Bolt[Fire]` in LMB and `Cast > Strike[]` in RMB.

Each room below guarantees its runes on first clear. A room with a rune shrine (`R`, K6) pays them when the player touches the shrine instead, not on entry or clear. After that, random rune drops come only from runes the player has already unlocked, so duplicates are common. That's useful, since each rune item sits in one place at a time.

| Room | Guaranteed runes |
|---|---|
| E1 | Swath |
| E2 | Split |
| E3 | Lob, On Expire |
| E4 | Wide, Heavy |
| E5 | Nova, Pierce |
| E6 | Pulse, Keen |
| E7 | Lingering |
| E8 | On Dodge, On Hit |
| K2 | Echo |
| K3 | Saturate |
| K4 | Beam |
| K5 (Tar Matriarch) | On Kill, Harvest |
| K6 | Frost (dungeon item) |
| K8 | Seeker, Orb |
| K9 | On Hurt, Emit |
| K10 (Cinder Warden) | Storm, Chain, Sigil, On Crit |

The first unlock of an element rune in a save is a dungeon-item moment (DESIGN §10.2): a centered "item get" panel pauses the game, names the rune, says what it does in the world and suggests a weave, while the hero holds the rune overhead. Frost gets it at the K6 shrine; Storm about 2 s after the Cinder Warden dies, so his death plays first. Other guaranteed runes show a "New rune" toast.

Spindles drop by item level (area level). Ashwood can drop from E4 on, Ironbark from E8, Rimeglass from K4.

After the boss, a sealed door with a storm mark leads toward Glasswater Fen. Hitting its metal pylon with Storm powers it and shows "The Fen isn't woven yet." Region 2 arrives in M8.

---

## 10. Rift modifiers (M6)

Prefixes make the rift harder:

| Prefix | Effect | Bonus |
|---|---|---|
| Brutal | Monsters deal 25% more damage | +15% item quantity |
| Teeming | +40% pack size | +20% item quantity |
| Hardened | Monsters have 40% more life | +15% item rarity |
| Resolute | Monsters have +20% to all resistances | +15% item rarity |
| Hasty | Monsters are 20% faster | +15% item quantity |

Suffixes change the chemistry:

| Suffix | Effect | Bonus |
|---|---|---|
| of Drought | No water spawns. Fire spreads twice as fast | +20% item rarity |
| of the Floodplain | 40% of floor tiles become shallow water | +15% item quantity |
| of Live Wires | Extra metal pylons. All pylons pulse charge every 4 s | +20% item rarity |
| of Permafrost | Water starts frozen. Ice from any source lasts twice as long | +15% item quantity |
| of the Tinderbox | Floors become grass. All monsters are Oiled | +25% item rarity |
| of Choking Smoke | Smoke lasts twice as long. Monsters aren't Blinded by smoke | +20% item quantity |
| of the Gale (M8) | Constant wind from the west | +15% item quantity |

### Tiers (M7 balance)

Source: `data/rift.ts` (`riftTierScaling`, `riftDrops`); tuned by the M7 progression sim.

- **Difficulty**: besides the area level (10 + round(1.25 × tier)), rift monsters have life × 1.06^(tier − 1) and their hits deal × 1.04^(tier − 1) (tier 10: ×1.69 life, ×1.42 damage; tier 16: ×2.40, ×1.80), on top of the prefixes. Kill XP and Embers follow the area level only. World hazards don't scale with it.
- **Rift Sigil supply**: completing a rift, its boss drops a sigil of the next tier with chance max(0.01, 0.10 − 0.012 × (tier − 1)) + 0.009 × (earlier completions of the best tier), else one of its own tier (never above the Rekindle cap). The extra chance counts only when the rift is your best tier completed, starts again at 0 on a new best, and survives failed rifts. Tier 1: 10%, tier 5: 5.2%, tier 8: 1.6%, tier 9 and up: 1%, each plus 0.9% a completion. An Expedition (§12) of the best tier rolls the same way and counts as a completion.
- **Re-climb**: below the highest tier ever completed (`hearth.bestEverTier`, every cycle; Rekindle keeps it), a boss's or an expedition's next-tier chance is a flat 75% (`riftDrops.reclimbTierUp`) instead. At or above it the formula above applies.
- **Kill sigils**: a drop roll in a rift gives a sigil with 0.6% (× item quantity), of the rift's tier, or the next with 5%.

---

## 11. Mutations (M7)

Bought with Ash after a Rekindle. Permanent.

| Name | Ash | Effect |
|---|---|---|
| Deeper Weave | 3 | Branches can nest 4 deep |
| Shatterpoint | 2 | Unlocks the Shatter trigger rune in drops: fires when you shatter an enemy |
| Stormglass Memory | 3 | Ice conducts Storm, as the Stormglass keystone |
| Bright Hearth | 1, buyable 10 times | +10% Hearth production per purchase |
| Sigil Cache | 1 | Start each Rekindle with five tier 3 Rift Sigils |
| Twin Threads | 4 | A fifth weave slot, bound to R |
| Kindred Flame | 2 | Fire you create also spreads to adjacent Oiled or Ignited enemies |
| Swift Expeditions | 2 | Expeditions return 50% faster |

## 12. The Hearth (M7)

Tuned by the M7 progression sim (`npm run sim -- --progression`: the first Rekindle after 6 to 10 hours of play; notes/m7-balance-decisions.md). Source: `data/hearth.ts`; formulas in `src/sim/meta/view.ts`.

### Embers

The Cinder Warden's first death lights the Hearth and gives **500 Embers**: enough for any one first level (350 to 500), not two. From then on, in adventure mode only:

| Source | Embers |
|---|---|
| Kill, Normal / Magic / Rare | 1 / 3 / 8 × 1.1^(area level − 1), rounded, at least 1 |
| Kill, boss (region or rift) | 60 × 1.1^(area level − 1) |
| Chest opening | 10 |
| Completed rift | 30 × its tier |
| Expedition | 15 × its tier |

Spawned Kiln Mites pay nothing (as for XP). Embers are a floor drop the loot filter never hides.

### Buildings

Upgrading from level L to L + 1 costs round(base × growth^L) Embers. Production is per real second of play (one Hearth second per 60 ticks outside hitstop) and per offline second.

| Building | Max level | Cost base, growth | First levels cost | Effect at level L ≥ 1 |
|---|---|---|---|---|
| Kindling Pit | 25 | 400, ×1.22 | 400, 488, 595, 726, 886 | 0.5 × 1.25^(L − 1) Thread Scrap a minute (L5 1.2, L10 3.7, L15 11.4, L20 34.7, L25 106) |
| Rune Garden | 20 | 450, ×1.25 | 450, 563, 703, 879, 1099 | min(6, 1 + floor(L / 4)) plots; each planted rune gains 150 × 1.25^(L − 1) XP a minute (L5 366, L10 1,118, L15 3,411, L20 10,408) |
| Expedition Board | 15 | 500, ×1.25 | 500, 625, 781, 977, 1221 | min(3, 1 + floor((L − 1) / 4)) Weavers: 1 at L1, 2 at L5, 3 at L9 |
| Salvage Loom | 10 | 350, ×1.3 | 350, 455, 592, 769, 1000 | Salvages Normal gear from L1, Magic from L4, Rare from L8; Thread Scrap × (1 + 0.1 L) |

In the progression sim this is about one upgrade per rift over the first dozen rifts, then one every rift or two; the model player has the four buildings at about 11–14 / 9–11 / 9–11 / 8–9 at its first Rekindle.

- **Kindling Pit**: fractional Thread Scrap carries over between seconds (and offline spans), so production is exact over time.
- **Rune Garden**: a planted rune stays in the pouch but can't be socketed; only unsocketed runes below level 20 can be planted. Rune quality adds XP as it does for socketed runes (1% per point). XP stops at level 20.
- **Expedition Board**: an expedition runs a tier from 1 up to the best tier completed this cycle (at least 1) and takes 360 + 75 × tier seconds (tier 1: 7.25 min, tier 8: 16 min). Rewards are rolled on collect with the loot RNG: 1 + floor(tier / 4) Fuse parts (any non-boss part, tier by the rift tier's area level), 1 + floor(tier / 3) crafting currencies (by drop weight), one Rift Sigil, 15 × tier Embers. The sigil is rolled like a rift boss's (§10, Rift Sigil supply): its tier, or the next with the boss's chance; an expedition of the best tier counts as a completion of it, so Weavers bring the next tier closer. An expedition sent before the last Rekindle still returns with everything else, but brings no sigil and counts no completion (each expedition records the cycle it was sent in).
- **Salvage Loom**: gear (spindles included) picked up, or brought back by an expedition, at or below the setting and the level's cap turns into round(salvage value × (1 + 0.1 L)) Thread Scrap (salvage values: Normal 1, Magic 2, Rare 4). Never uniques.

### The Spindlewright's prices (Thread Scrap, one currency each)

| Weaver's Knot | Spool of Change | Loom Shuttle | Chaos Skein | Golden Needle | Unpick | Rune Polish |
|---|---|---|---|---|---|---|
| 4 | 6 | 10 | 25 | 40 | 30 | 20 |

### Offline progress

The app sends the wall-clock gap since the save as one recorded edit: ignored under 60 s, capped at 8 hours. It advances the Kindling Pit, the Rune Garden and expedition timers by the closed form; the result matches second-by-second play within 1%.

### Rekindle and Ash

- Unlocks once a tier 8 rift was completed this cycle, at the Hearth, with no rift open.
- Ash = (best tier this cycle − 7) + floor(√(Embers spent on buildings this cycle ÷ 2000)). Tier 8 with 8,000 Embers spent gives 3; the progression sim's first Rekindle (tier 10, 47,000 to 80,000 spent) gives 7 to 9.
- Rifts open up to tier 10 before the first Rekindle; each Rekindle adds 2 (12, 14, 16).
- Resets Embers, Embers spent, building levels and the Kindling Pit's carry, the Rune Garden (runes back in the pouch with their levels), the Salvage Loom setting, the rift tier ladder (with its best-tier completion count) and Rift Sigils. Everything else stays: the highest tier ever completed, and expeditions already out (which then bring no sigil).
- Saves from before M7 (version 2) that climbed past tier 10 get the Rekindles their ladder and sigils need for the cap to cover them (no Ash), and their best tier as the highest ever.
- Sigil Cache: after each Rekindle, five plain tier 3 sigils, and the ladder starts as if tier 2 were completed so they open.
- Mutation effects: Bright Hearth +10% Kindling Pit Scrap and Rune Garden XP per purchase; Swift Expeditions ÷ 1.5 duration for expeditions sent after buying it; Deeper Weave depth 4 (The First Thread still caps at 2); Stormglass Memory: ice conducts your Storm like water (not the keystone's extra damage); Shatterpoint: the Shatter trigger joins rune discovery (Rares and bosses) at any area level.
