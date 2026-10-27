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
| Tide | 1 | 1.00 | Physical damage, applies Wet for 3 s (rule 32). Terrain rules 24, 27, 28 and 30 (DESIGN §6.5): borrowed water for 10 s, mud, doused vents, washed blocks | M8 phase 1 (F6 shrine) |
| Gale | 1 | 1.00 | Physical damage, knockback ×2. Its footprint makes a 2 s gust (rule 21, DESIGN §6.6): fans fire downwind, drifts smoke and steam, clears fog (rule 29), spins wind vanes | M8 phase 1 (the Glasswater Coil) |

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
| 15 | Floodline (M8) | `Cast > Swath[Tide, Lingering]` | 3 | All | On stone, the 14×3 strip becomes borrowed shallow water for 15 s, then stone again (rules 24, 27). A Storm hit on one end charges the whole strip |
| 16 | Glaze (M8) | `Cast > Swath[Tide, Frost]` | 3 | All | On stone, the strip becomes water and then ice (slot order); the ice lasts 15 s and returns to stone, not water (rule 27). An ice block washed onto it slides |
| 17 | Fan the Flames (M8) | `Cast > Strike[Fire, Gale]` | 3 | All | On a grass field, fire downwind of the gust cone covers about twice the cells in 2 s that the same strike without Gale does (seeded, ranges). Knockback 6 cells |
| 18 | Downpour (M8) | `Pulse > Lob[Tide, Saturate]` | 6 | All | Burning grass in the burst goes out and doesn't relight for 10 s (rule 24); enemies hit are Wet; a burning Tar Hulk's fuse goes out (rule 32) |

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
| Pike Scale | Glasspike | You aren't slowed by shallow water or mud | M8 |
| Copper Carapace | Copperback | Take 30% less damage from charged water and metal | M8 |
| Heron Plume | Spark Heron | 25% more damage with charge you create (rules 11–12) | M8 |
| Slag Core | Slagshell | Your Fire hits on Wet enemies deal 30% more damage | M8 |
| Sparkfly Lantern | Sparkfly | Enemies you kill while they stand in water release your charge into it (rule 11, 50% of the killing hit) | M8 |
| Mire Horn | Mirebull | Enemies on mud or in shallow water take 15% more damage from you | M8 |
| Toad Bellows | Bellows Toad | Your gusts last 1 s longer and cover 30% more area | M8 |
| Bell Bronze | Bellshell | Shocked enemies take 15% more Physical damage (Tide and Gale hits) | M8 |
| Bellwether's Clapper | Old Bellwether | Charge you create reaches 30% farther (water distance and both cell caps) | M8 |
| Coil Dynamo | Glasswater Coil | When charge you created on water or metal ends, it pulses once more for 50% of its damage (each entity can be hit again) | M8 |

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

Glasswater Fen enemies (M8). Fen and Foundry rooms also apply the tier 8 rift scaling to their monsters (life ×1.50, hit damage ×1.32, CONTENT §10 Tiers; `data/progression.ts` `regionDifficulty`), so the Fen starts about as hard as a tier 8 rift and ends about as hard as tier 10. The "Extends" note says which existing code each one builds on.

| Id | Name | Life | Speed | Resist | Behavior | Chemistry | Ships |
|---|---|---|---|---|---|---|---|
| `glasspike` | Glasspike | 45 | 18 swim | 0 / 0 / −30 | Hides under glassy water; a faint glint is its only sign. When the player is within 16 cells of its water and in sight, it flashes for 0.8 s and a 3-cell landing circle appears, then it leaps in a 0.5 s arc to the circle: the water cell nearest the player within 4 cells, else the player's spot. Bite 16 on landing. Back in water it submerges | Always Wet. Landing on dry ground or ice strands it (rule 31). Freezing its water traps it like a Bog Lurker. Borrowed water lets it go farther and strands it when it ends. Extends `ai/lurker.ts` (new behavior `leaper`) | M8 |
| `copperback` | Copperback | 110 | 12 | 0 / −25 / 75 | A rusty copper crab that sidles at the player in groups. Pinch for 12 after a 0.5 s claw raise, 3-cell reach | Its shell conducts. Charge of any team that hits it (rules 11–12) makes it **Charged** for 3 s, its antenna sparking: its pinch adds 12 Storm, and once a second it re-electrifies the water or metal under it as enemy charge (12 Storm). Freezing it ends the charge. Teaches: charge walks. Extends `swarm`; new chemistry `conductorBody` | M8 |
| `spark_heron` | Spark Heron | 55 | 15, wades | 0 / 0 / 50 | A tall heron of rusted pylon metal. Kites at 18–28 cells. Lightning beak for 18 Storm after 1.0 s (beak glow and a ring on the target water). Every 5 s, a puddle spit for 6, lobbed, with a 0.8 s landing marker | Strikes the water nearest the player within 10 cells (the Stormcaller's rule), electrifying the connected body. Its spit leaves borrowed water of radius 3 for 6 s on dry ground, so a player who stays dry gets a puddle to be struck through. Shallow water doesn't slow it. Extends `kite` plus a new attack terrain `water` | M8 |
| `slagshell` | Slagshell | 180 | 9 | 75 / −25 / 0 | A Foundry bruiser in a glowing slag crust. Slag slam for 24 Fire in a 5-cell circle after a 0.9 s telegraph, leaving placed fire (rule 26) | **Hot**: takes 70% less damage and can't be chilled. Getting Wet (Tide, or standing in water) quenches it in a puff of steam: **Cracked** for 6 s, no reduction, 25% more damage taken, 30% slower, chill works. Dry, it heats again after 6 s. Avoids water while Hot. Extends `swarm`; new chemistry `hotShell` (the Warden's Superheat, generalized) | M8 |
| `sparkfly` | Sparkfly | 8 | 24, floats | −25 / 0 / 75 | Firefly-bright swarmers in clouds of 8–12. Zap for 3 Storm on contact after a 0.25 s flicker | Drawn to light: a lit brazier or burning cell within 12 cells pulls it to circle there for 3 s instead of the player. Dying over water it pops: enemy charge in its water within 8 cells for 0.5 s (6 Storm), so one Storm hit pops a cloud over water in a chain. Extends `swarm` and `float`; new chemistry `deathCharge`, `lightLure` (`ai/target.ts`) | M8 |
| `mire_bull` | Mirebull | 140 | 11, charge 38 | 0 / 0 / 0 | A shaggy marsh ox. Charges a player 10–36 cells away: 0.9 s line telegraph, a run of up to 36 cells, 22 on contact, knockback 5. Gores for 14 after 0.5 s up close | Hitting a wall stuns it 1.5 s. Entering mud ends its charge: **bogged** for 2.5 s, 50% more damage taken. On ice its charge runs 50% farther. Tide turns dirt to mud ahead of it. New behavior `charger` (`ai/charger.ts`, the Warden's `planDash`) | M8 |
| `bellows_toad` | Bellows Toad | 70 | 10 | −25 / 0 / 0 | Keeps 10–16 cells away. Inflates for 1.0 s, visibly swelling, with a 14-cell 60° cone telegraph, then croaks for 10 and knockback 6 | The croak is a 2 s enemy gust (rule 21): it blows smoke, steam and fog away and fans fire downwind, toward you. Hit with Fire while inflating, its marsh gas lights: a 4-cell world-owned fire puff for 20 that hurts everyone, the toad loses 15% of its max life and is stunned 1.5 s. Wet, its gas won't light. Extends `kite`; new attack terrain `gust`, chemistry `gasbag` | M8 |
| `bellshell` | Bellshell | 150 | 8 | 25 / 25 / 50 | A brass-shelled turtle ambling through fords. **Shelled**: 90% less damage taken. Opens to bite for 16 after 0.7 s | **Rings**: charge of another team or the world (rules 11–12) hitting it stuns it 2.5 s and opens its shell for 5 s (25% more damage taken), then it can't ring for 6 s. Direct Storm hits don't ring it: hit the water or metal it stands in. Teaches conduction as a key. Extends `swarm`; new chemistry `bell` (shared with the Bellwether) | M8 |

Objects and bosses. Bosses and the Brood Kiln are placed with `@spawn <digit> enemy:<id>`. Boss numbers are absolute, at their area level.

| Id | Name | Area level | Life | Resist | Notes |
|---|---|---|---|---|---|
| `brood_kiln` | Brood Kiln | Room level | 200 | 50 / 0 / 0 | Stationary object. Spawns 3 Kiln Mites every 5 s. Stops while Frozen. Legend character `&` (§6.1) |
| `tar_matriarch` | Tar Matriarch (mini-boss) | 8 | 5,000 | −30 / 0 / 0 | Tar Hulk elite. Her globs and her rush leave **tar**: oil whose fire is world-owned whoever lights it, so it hurts everyone (other oil keeps DESIGN §6.3 ownership). Lit while Oiled she **flares** after the Hulk's 1.5 s fuse: a 6-cell world-owned fire burst that hits everyone else and burns her too, then can't flare again for 10 s (getting Wet puts the fuse out). At 50% life she calls her **tar crew**, 2 Tar Hulks beside her and 4 Tinderlings on her tar (which they light), and phase 2 begins: she walks 35% faster, her cooldowns are 25% shorter and she adds the tar rush. Teaches oil plus fire, and the explosion risk |
| `cinder_warden` | Cinder Warden | 10 | 5,000 | 75 / −25 / 25 | Three phases, DESIGN §10.3. Uses the boss chill rule (DESIGN §6.4) |
| `bellwether` | Old Bellwether (mini-boss, M8) | 22 | 20,000 | 25 / 25 / 50 | The Foundry's old shift bell, grown into a colossal brass turtle. **Shelled**: 80% less damage. Charge of another team or the world (rules 11–12) **rings** it: stunned 1.5 s, then open for 5 s (25% more damage taken), then 8 s before it can ring again; its own charge never rings it. It can't be rung while rolling. At 50% life it **tolls the Foundry** (phase 2): every 7 s it rings itself and sends enemy charge into the water and metal under it, and it calls one `sparkfly_cloud`. Uses the boss chill rule. Teaches: conduction opens it; read whose charge is in the water. `src/sim/ai/bosses/bellwether.ts` |
| `glasswater_coil` | Glasswater Coil (M8) | 24 | 32,000 | 0 / 0 / 75 | Three phases, DESIGN §10.5. Swims any water. Always Wet. Uses the boss chill rule. `src/sim/ai/bosses/coil.ts` |

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
| Old Bellwether | Snap | 110 | 0.8 s, 9-cell 70° cone | Knockback 3 |
| Old Bellwether | Toll ring | 90 | 1.2 s: shell glows, ring marker out to 18 cells | A ring wave that expands from it to 18 cells over 0.4 s. Dodge through it or stand outside |
| Old Bellwether | Shell roll | 120 on contact | 0.9 s line | At a player at least 10 cells away: tucks in and rolls at 40 cells/s up to 36 cells, stopping at walls (stunned 1 s if it hits one). Knockback 5. On ice the roll runs 50% farther |
| Old Bellwether | Self-toll (phase 2) | 90 Storm | 1.2 s, shell glows violet | Enemy charge in the water and metal under it (rules 11–13), every 7 s. It doesn't ring itself open |
| Glasswater Coil | Lunge | 150 on contact | 1.0 s ripple line | From water, at a player within 14 cells of its water (phases 2–3: 8 cells): a dash at 44 cells/s, up to 22 cells, stopping at the water's edge. Knockback 4 |
| Glasswater Coil | Glass spit | 70 Storm | 0.6 s: mouth glow and aim line | Projectile, 50 cells/s, at a player more than 14 cells from its water. Where it lands, borrowed water of radius 2 for 6 s. Phases 2–3: volleys of 3, 0.3 s apart |
| Glasswater Coil | Eye pulse (phases 1–2) | 120 Storm | 1.2 s: all its water brightens | Electrifies the water body it is in (rule 11 with reach 80 and up to 4,000 cells, `bosses.coilPulse`). Every 7 s in phase 1, 5 s in phase 2 |
| Glasswater Coil | Tail thrash (Stranded) | 100 | 0.7 s, 7-cell circle | Its only attack while Stranded. Knockback 5 |
| Glasswater Coil | Pylon storm (phase 3) | 90 Storm | Pylons glow 1.2 s | Electrifies the pylons' pads and the water touching them (rules 12–13) every 6 s |
| Glasswater Coil | Body pulse (phase 3) | 110 Storm | 1.0 s: its body glows, ring on its water out to 20 cells | Electrifies its water within 20 cells (rule 11 reach 20). Every 4 s while it is in water. Player charge reaching its water during the glow Overloads it (DESIGN §10.5) |

Pack tables:

| Pack id | Contents |
|---|---|
| `tinderling_swarm` | 6–10 Tinderlings |
| `archer_line` | 3 Ember Archers and 1 Shieldbearer |
| `tar_crew` | 1 Tar Hulk and 4 Tinderlings |
| `bog_nest` | 2–3 Bog Lurkers (spawn markers in water only) |
| `wisp_flight` | 2 Frost Wisps and 3 Kiln Mites |
| `caller_guard` | 1 Stormcaller and 2 Shieldbearers |
| `pike_shoal` (M8) | 2–3 Glasspikes (spawn markers in water only) |
| `crab_cast` (M8) | 3 Copperbacks and 1 Spark Heron |
| `heron_wade` (M8) | 2 Spark Herons and 1 Bellshell |
| `sparkfly_cloud` (M8) | 8–12 Sparkflies |
| `mire_herd` (M8) | 2 Mirebulls and 2 Bellows Toads |
| `foundry_crew` (M8) | 1 Slagshell, 2 Copperbacks and 4 Sparkflies |
| `toad_chorus` (M8) | 3 Bellows Toads and 6 Sparkflies |

Monster rarity: Magic packs (blue) have 1–2 mods and ×1.7 life. Rares (yellow) have 2–4 mods, ×4 life and 2 minions. Mods ship in M5; M4 needs only Hasted, Incendiary and Thick-skinned for the first Rares. Rooms request rarity on the `@spawn` line (§6.2). Pack leaders and minion kinds: tinderling_swarm tinderling / tinderling, archer_line shieldbearer / ember_archer, tar_crew tar_hulk / tinderling, bog_nest bog_lurker / bog_lurker, wisp_flight frost_wisp / kiln_mite, caller_guard stormcaller / shieldbearer; M8: pike_shoal glasspike / glasspike, crab_cast spark_heron / copperback, heron_wade bellshell / spark_heron, sparkfly_cloud sparkfly / sparkfly, mire_herd mire_bull / bellows_toad, foundry_crew slagshell / copperback, toad_chorus bellows_toad / sparkfly. M8 adds no monster mods: Waterlogged and Grounded already bend the Fen's chemistry.

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
| `Q` | Sealed conduit switch (M8): in a glass case, so spell hits never power it, only charge on a cell touching its tile (water or metal). Counts for `switch:S` with the `S` switches |
| `f` | Furnace vent, lit (M8): solid flame over a metal grate; Tide douses it for 10 s (DESIGN rule 30). Its `under` is itself |
| `Y` | Wind vane (M8): solid. Spins while wind (a gust or room wind) covers a cell touching its tile for 0.5 s, then stays spun (latched, like a switch). Counts for `vanes:all` |
| `T` | Pressure plate |
| `D` | Door, opened by its `@link` condition |
| `d` | Second door (M8): a door with its own `@link` lines, for a room with two doors on different conditions (G7's brazier vault and wind-vane cache, F8's two switch doors) |
| `K` | Locked door, needs a small key |
| `k` | Chest with a small key |
| `G` | Big-key door |
| `g` | Chest with the big key |
| `R` | Rune shrine: an altar holding the room's dungeon item. Touching it pays the room's guaranteed runes (§9.1); it pays once and stays empty |
| `$` | Chest (M8): opens on touch and pays the room's `data/progression.ts` `roomChests` contents once per save (a Pattern Seed, a Fuse part, currency): G7's Windward Cache, F1's furnace alcove |
| `H` | Heart Seed |
| `L` | Loom Shard |
| `x` | Loom Stone: waypoint and respawn point |
| `s` `r` `C` | Hearth NPCs (M7, hub only): the Spindlewright, the Runekeeper, the Cartographer |
| `F` | The Hearth fire (M7, hub only): decorative, never burns anything |
| `p` `y` `E` `V` | Hearth building plots (M7, hub only): Kindling Pit, Rune Garden, Expedition Board, Salvage Loom |
| `1`–`9` | Spawn markers |
| `<` `>` `^` `v` | Exits on the west, east, north and south edges, placed in the edge column or row |

Hearth stations are solid and inert, and Interact (F) beside one opens its screen. A station that covers several tiles repeats its character in one rectangle (the hub draws 3×2 buildings and a 3×3 Hearth fire).

A marker or object tile (digits, `B`, `H`, `L`, `k`, `g`, `R`, `$`, `S`, `Q`, `Y`, `T`, `x`, `c`, `\|`, `b`, `&`, `P`) sits on the most common ground among its 4 neighbors. Ties go to stone. This is how the Heart Seed in the example below ends up floating on deep water.

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
@fog <tx0> <ty0> <tx1> <ty1>
@wind <n|ne|e|se|s|sw|w|nw>
@pulse <seconds>
@look <fen|foundry>
```

Link conditions: `braziers:all`, `switch:S`, `plates:all`, `cleared` (all enemies dead), `timer:<seconds>:braziers:all` (all braziers lit within the time), `sealed` (never opens: a door that stays shut on purpose, like the K10 storm door). Several `@link` lines for one door must all hold. M8 adds:

- `timer:<seconds>:switch:S`: every switch (`S` and `Q`) powered within the time. Each one unlatches that many seconds after it was powered unless the group completes first, as timed braziers go out (`src/sim/world/objectLinks.ts`).
- `vanes:all`: every wind vane spun.
- Two doors (M8): `D` and `d` take their own `@link` lines. A brazier, switch, plate or vane counts for the door whose links watch its kind; when both doors watch the same kind (F8: two `switch:S` doors), each object counts for the nearer door (tile distance; ties to the first `@link` in the file). Rooms with one linked door are unchanged.
- `rifttier:N`: the best rift tier ever (`hero.hearth.bestEverTier`, kept through Rekindle) is at least N, and every `@exit` of the room leads to a room that exists, so a door to a region not built yet stays shut (`src/sim/world/riftTierLink.ts`). K10's storm door uses `rifttier:6`.
- Conditional notes: a `@note` whose text starts with `?rifttier:N ` shows only when that condition holds when the object activates; `!rifttier:N ` only when it doesn't. K10's switch says "The Fen isn't woven yet." before tier 6 and "The storm door hums open." after.

M8 headers (`src/sim/world/room.ts`):

- `@fog`: fog over a rectangle of tiles, corners inclusive. Several lines add up. Fog is the air layer's Fog (DESIGN §6.2).
- `@wind`: room wind, the way it blows (`@wind e` blows from the west toward the east). Fen rooms have none; it exists for the rift suffix and Galeback later.
- `@pulse`: every metal pylon (`M`) in the room pulses world-owned charge every that many seconds, as the rift suffix of Live Wires does (`src/sim/world/rift/pulse.ts`, now also outside rifts). Pylons glow for `tuning.world.pulseGlowSeconds` = 0.8 s first.
- `@look`: the region look the renderer draws the room in when its id doesn't say it (`fen/` and `foundry/` rooms need none). The Fen rift chunks and the Fen bosses' rift arenas carry it, and the rift generator copies it into the room it builds. Purely visual.

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

M8: the storm door opens. K10 has `@exit n fen/g1_storm_landing` and `@link D cleared`, `@link D switch:S`, `@link D rifttier:6`, with two conditional notes: `@note S !rifttier:6 The Fen isn't woven yet.` and `@note S ?rifttier:6 The storm door hums open. Glasswater Fen lies beyond.` It opens when the player powers it after the Warden's death once a tier 6 rift has been completed (best tier ever ≥ 6, so a Rekindle never closes it again); before that, powering it shows `The Fen isn't woven yet.` as today (designer, DECISIONS 2026-10-25). The storm door stands in the arena's north-west corner, the north exit behind it, its switch and pylon in the wall beside (the M4 Warden fight's arena is otherwise unchanged). The region map shows the Fen's area levels, and G1's intro card reads "Glasswater Fen. Area level 18 to 24."

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
| of the Gale (M8) | Constant wind from the west: room wind blowing east in every rift room (DESIGN §6.6). Fire spreads ×2 eastward and ×0.25 westward; smoke and steam drift east at 2.5 cells/s. Rolls from tier 9 | +15% item quantity |

### Tiers (M7 balance)

Source: `data/rift.ts` (`riftTierScaling`, `riftDrops`); tuned by the M7 progression sim.

- **Difficulty**: besides the area level (10 + round(1.25 × tier)), rift monsters have life × 1.06^(tier − 1) and their hits deal × 1.04^(tier − 1) (tier 10: ×1.69 life, ×1.42 damage; tier 16: ×2.40, ×1.80), on top of the prefixes. Kill XP and Embers follow the area level only. World hazards don't scale with it.
- **Rift Sigil supply**: completing a rift, its boss drops a sigil of the next tier with chance max(0.01, 0.10 − 0.012 × (tier − 1)) + 0.009 × (earlier completions of the best tier), else one of its own tier (never above the Rekindle cap). The extra chance counts only when the rift is your best tier completed, starts again at 0 on a new best, and survives failed rifts. Tier 1: 10%, tier 5: 5.2%, tier 8: 1.6%, tier 9 and up: 1%, each plus 0.9% a completion. An Expedition (§12) of the best tier rolls the same way and counts as a completion.
- **Re-climb**: below the highest tier ever completed (`hearth.bestEverTier`, every cycle; Rekindle keeps it), a boss's or an expedition's next-tier chance is a flat 75% (`riftDrops.reclimbTierUp`) instead. At or above it the formula above applies.
- **Kill sigils**: a drop roll in a rift gives a sigil with 0.6% (× item quantity), of the rift's tier, or the next with 5%.
- **The deep rifts (M8)**: tiers 9 and up need the Glasswater Coil dead (DESIGN §10.4). Sigil drops don't change; a tier 9+ sigil waits, locked, until then.

### 10.1 The Fen in rifts (M8)

From tier 9, so only after the Coil (`data/rift.ts`; the generator in `src/sim/world/rift/generate.ts` already filters spawns by `fromTier`; chunks, bosses and modifiers gain the same field).

Chunks (`data/rooms/rift/chunks/<id>.txt`, sockets on every edge, no puzzles, no fog):

| Chunk | From tier | Layout |
|---|---|---|
| `reedmarsh` | 9 | Reeds (grass), shallow pools joined by channels, dirt and mud islands, one deep pool |
| `pylon_flats` | 9 | Broken metal walkways and 4 pylons over a shallow lake, stone causeways |
| `sluiceworks` | 9 | Metal floor halls, a deep sluice, furnace vents only in side alcoves (never on a socket path: the connectivity validator treats lit vents as walls) |

Spawns (`riftSpawns`), all `fromTier: 9`:

| Entry | Weight | Not in |
|---|---|---|
| `pike_shoal` | 50 | Chunks without water markers (water-only, as `bog_nest`) |
| `crab_cast` | 60 | |
| `heron_wade` | 60 | |
| `sparkfly_cloud` | 70 | `oilworks`, `thicket` (they swarm fire) |
| `mire_herd` | 50 | |
| `foundry_crew` | 50 | `oilworks`, `thicket` |
| `toad_chorus` | 40 | |
| 2 `slagshell` | 30 (from tier 10) | |
| 2 `bellshell` | 30 | |

Bosses (`riftBosses` gains `fromTier`): `rift_bellwether` in the arena `belfry` and `rift_coil` in the arena `glass_eye`, both from tier 9, both `lookAs` their region originals (as `rift_warden` does) and separate kinds, so a rift kill never counts as the region's boss kill. They scale with `riftBossScale` from their own levels (22 and 24). At tier 9 and up the four rift bosses are equally likely.

Runes: Tide and Gale join random rune drops once unlocked, like every rune (§9.1). The Fen adds no rune discovery entries.

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
| Twin Threads | 4 | An extra weave slot bound to R, live on both weave bars (DESIGN §5.1) |
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

---

## 13. Glasswater Fen and the Drowned Foundry (M8)

A drowned marsh of glassy water, rusted pylons, fog and fireflies, reached through K10's storm door (§9.1). It teaches Storm and conduction; its dungeon item is Tide; its boss drops Gale. About an hour of play for a character that has just reached rift tier 8 (level about 30). Rooms live in `data/rooms/fen/` (G1–G8) and `data/rooms/foundry/` (F1–F10), listed in `data/progression.ts` `regionRooms`; `regionBossKinds` gains `bellwether` and `glasswater_coil`. The renderer draws Fen grass as reeds, metal as rusted teal and water as glass, by region.

What the player has: Fire, Frost, Storm and every M2–M5 rune (a tier 8 character has them all). Puzzles use only those until F6 gives Tide. Gale comes from the Coil, so in the Fen it opens only the optional Windward Cache in G7.

"Needs" lists the elements a room's puzzle requires. A test proves the room can't be solved without the first one listed (BUILD_PLAN M8 phase 1). "—" is a fight room with no gate.

### Overworld

| Room | Area level | Content and puzzle | Needs | Enemies |
|---|---|---|---|---|
| G1 Storm Landing | 18 | Arrival from K10's storm door, and a Loom Stone. A boardwalk over glassy shallows. A conduit switch stands on a post 20 cells out in the water: Storm the water anywhere and the charge reaches it, opening the east door (`switch:S`). A fog bank lies over the north reeds, a first look at fog | Storm | `sparkfly_cloud` |
| G2 Glass Reeds | 18 | Reed beds, shallow pools, dirt and mud islands. Glasspikes leap at you from the pools: stand well back from the water and they strand themselves on the bank. Mirebulls charge along the dirt and bog in the natural mud. Burning the reeds doesn't touch the pikes, and can catch you | — | `pike_shoal` ×2, `mire_herd` |
| G3 Pylon Field | 19 | Rusted walkways and pylons in a lake. Three sealed switches (`Q`) sit on three metal networks joined by water; the door wants all three (`switch:S`). One Storm hit in the right pool reaches two of them through water↔metal hand-offs (rule 13). The third network's pool is cut off by an ice-block plug in a channel: melt it with Fire and the meltwater joins the pools. The door opens a vault with a Loom Shard | Storm, Fire | `crab_cast` |
| G4 Heron Lake | 19 | A wide glassy lake with two world pylons that pulse every 2 s (`@pulse 2`, glowing 0.8 s first). The way north crosses 60 cells of it: freeze a path and walk on ice, which doesn't conduct. Wading through costs about 6 pulses. A Heart Seed sits on an islet ringed by deep water: ice bridge to it | Frost | `heron_wade` |
| G5 Fogbank | 20 | Fog over a maze of deep channels (`@fog` over most of the room). Three sealed switches stand on pylon islets, each touching its own pool, and the east door wants all three within 12 s (`timer:12:switch:S`). Storm a pool and its charge glows through the fog up to the pylon it reaches; fireflies gather at the pylons; Fire burns the fog away for 8 s. Bellows Toads' croaks blow the fog off in cones, a friendly tell. A Loom Shard waits in a fog-hidden alcove behind bramble: burn it. North exit to G7 | Storm, Fire | `toad_chorus`, `sparkfly_cloud` |
| G6 Drowned Causeway | 20 | The big fight, as E5 was: a sunken stone road with three fords. Bellshells amble in the fords (ring them through the water), Spark Herons kite from the islets, Mirebulls charge down the dirt road. The Fen's first Rare | — | `heron_wade` ×2, `mire_herd` rare, 2 `bellshell` |
| G7 Lantern Grotto (side) | 20 | A dark grotto under fog, north of G5. Light 4 braziers within 15 s (`timer:15:braziers:all`); two stand on islets across deep water (Lob over, or ice bridges). Sparkflies swarm to every lit brazier, which helps and hurts. The door opens on a Heart Seed. After the Coil: a wind-vane door at the back (`Y`, `vanes:all`) opens on the Windward Cache, a chest with a Pattern Seed | Fire (the cache: Gale) | `sparkfly_cloud` ×2 |
| G8 Foundry Steps | 21 | Loom Stone, mixed packs and the Foundry's sluice gate. The gate's two switches sit at the ends of a metal bridge whose middle span has fallen into shallow water; charge crosses the gap through the water (rule 13) | Storm | Mixed, 1 Rare |

### The Drowned Foundry

| Room | Area level | Content and puzzle | Needs | Enemies |
|---|---|---|---|---|
| F1 Sluice Gate | 21 | A metal hall over a deep moat. A switch on each bank touches the moat: one Storm hit in it powers both and opens the door. A wall of lit furnace vents (`f`) seals an east alcove with a chest (a Fuse part and currency): come back with Tide | Storm (the alcove: Tide) | `crab_cast`, `sparkfly_cloud` |
| F2 Pump Hall | 21 | Three sealed switches on three separate metal networks around the hall; the door wants all three within 3 s (`timer:3:switch:S`). Build a weave that reaches them: split or chained Storm bolts, Echo, a Storm Sigil, or Saturate on the pool that touches two | Storm | `heron_wade` |
| F3 Cooling Pools | 22 | Freeze a cooling pool and slide 2 ice blocks onto 2 plates (`plates:all`) to reach the small-key chest. Bellshells wade in the pools: electrify the pool to ring them | Frost | 2 `bellshell`, `sparkfly_cloud` |
| F4 Slag Run | 22 | An oil channel runs from this side of a pit to a wooden barricade on the far side. Lob Fire onto the channel: the fire runs along it and burns the barricade, opening the Heart Seed vault. Slagshells guard the hall; two quench pools crack them if you lure them in, Tide's lesson ahead of time. The locked door (F3's key) leads to F5 | Fire, small key | `foundry_crew` |
| F5 Bellwether's Belfry | 22 | Mini-boss: `bellwether` (§13.2) | Storm (to fight it well) | — |
| F6 Tide Shrine | 22 | Dungeon item: Tide, on a rune shrine (`R`). Touching it opens the "new element" panel. Short tutorial: a 2-tile wall of vents blocks the exit; douse it with Tide and walk through before it relights. Loom Stone | Tide | — |
| F7 Furnace Row | 23 | A long hall crossed by three fire walls of furnace vents, 20 cells apart. Douse each with Tide and go before it relights. Slagshells patrol between them, and Tide cracks them too | Tide | `foundry_crew`, 2 `slagshell` |
| F8 Dry Conduit | 23 | The Foundry's hub: F7 to the west, F9 to the east, the big-key door to F10 to the north. The east door wants a sealed switch on a metal plinth 28 cells across bare stone from the nearest pool: paint a Tide path from the pool to the plinth and Storm the pool within 10 s (Floodline, §2 #15). A side vault holds a Loom Shard behind a second sealed switch at the end of a row of lit vents: douse the row and the grates conduct like metal, then Storm one end | Tide, Storm | `crab_cast`, `sparkfly_cloud` |
| F9 Flood Lock | 24 | A pit chasm 12 cells wide splits the room; the big-key chest is beyond it. Tide fills a stretch of pit with deep water for 10 s and Frost turns it into an ice bridge (8 s plus 1.5 s cracking): cross. Mirebulls charge along the far dirt ledge, and Tide's mud bogs them. Heart Seed vault (`plates:all`): the plate lies 24 cells down a stone lane. Glaze the lane (§2 #16), wash the ice block onto it with Tide (rule 28), and it slides onto the plate | Tide, Frost | `mire_herd` ×2 |
| F10 The Glass Eye | 24 | Boss: `glasswater_coil` (DESIGN §10.5, map in §13.3). A Loom Stone by the entrance sleeps until it dies, then wakes (respawn point; open rifts there) | Tide (to fight it well) | — |

Totals: 4 Heart Seeds (G4, G7, F4, F9) and 3 Loom Shards (G3, G5, F8). Loom Stones in G1, G8, F6 and F10 (asleep until the Coil dies). The Windward Cache's Pattern Seed (G7, after the Coil) is a bonus on top.

Paths:

- Overworld: K10 → G1 → G2 → G3 → G4 → G5 → G6 → G8, with G7 north of G5.
- First half: G8 → F1 → F2 → F3 (small key) → F4 (locked door) → F5 → F6.
- Second half: F6 → F7 → F8 → F9 (big key) → back to F8 → big-key door → F10.

Pacing: about 25 minutes in the overworld and 35 in the Foundry, the Bellwether in 60–100 s, the Coil in 120–180 s.

### 13.1 Guaranteed runes (as §9.1)

A tier 8 character already owns every rune the Fen could teach, so the Fen pays **copies** of the runes its puzzles and fights reward putting in a second weave, each at rune level 10 (`data/progression.ts` `fenRuneLevel`), on first clear (the shrine on touch, bosses on death). Tide and Gale also arrive at level 10. No new runes in phase 1 besides Tide and Gale (about 45 runes is M8 phase 2).

| Room | Guaranteed runes |
|---|---|
| G1 | Storm |
| G3 | Chain |
| G4 | Frost |
| G5 | Sigil |
| G6 | Saturate |
| G7 | Lingering |
| G8 | Pulse |
| F2 | Split |
| F4 | Fire |
| F5 (Old Bellwether) | On Hit, Infuse |
| F6 | Tide (dungeon item) |
| F7 | Swath |
| F8 | Tide (a second copy, for two Tide weaves) |
| F9 | Lob |
| F10 (Glasswater Coil) | Gale, Nova |

The first Tide is an "item get" moment at the F6 shrine, like Frost at K6; the first Gale comes about 2 s after the Coil dies, so its death plays first.

### 13.2 The Old Bellwether (F5)

The Belfry: 104×80 cells. A stone center 32 cells across (the bell's old mount), a metal-floor ring 12 cells wide around it, four shallow pools on the ring at the diagonals, stone islands outside the ring, two pylons on the ring. On the stone center it can't be rung; it walks back onto the ring to roll and toll.

| Phase | Life | What happens | What it teaches |
|---|---|---|---|
| 1 | 100–50% | Shelled, it Snaps up close, Tolls a ring wave and Rolls at a far player. Storm the ring or a pool while it stands on them: rung, stunned, open for 5 s | Conduction is the key: hit what it stands on, not the shell |
| 2 | 50–0% | It tolls the Foundry: every 7 s it rings itself and its own charge floods the ring and pools under it. It calls one `sparkfly_cloud` (they pop over the pools). Its own charge never opens it | Isolation: stand on stone between its tolls, ring it with yours in the gaps |

Reward: On Hit, Infuse, the Bellwether's Clapper part (§4) and loot.

### 13.3 Example: the Glass Eye, room F10

The Eye in the middle (deep water with a shallow rim), its two sluice channels, four pylons on metal pads at its corners, four isolated glass flats, the Loom Stone by the south door and the sealed north door with its wind vane.

```
@id foundry/f10_glass_eye
@name The Glass Eye
@level 24
@exit s foundry/f8_dry_conduit
@spawn 1 enemy:glasswater_coil
@note x The Eye goes still. The Loom Stone wakes.
@note Y The wind tugs north. The Cliffs aren't woven yet.
@link D sealed
##############YD################
#..............................#
#...~~~~~~............~~~~~~...#
#...~~~~~~............~~~~~~...#
#..............................#
#.....mmm..............mmm.....#
#.....mMm~~~~~~~~~~~~~~mMm.....#
#.....mmm~wwwwwwwwwwww~mmm.....#
#........~wwwwwwwwwwww~........#
#........~wwwwwwwwwwww~........#
#........~wwwwwwwwwwww~........#
#...wwwwwwwwwww1wwwwwwwwwwww...#
#...wwwwwwwwwwwwwwwwwwwwwwww...#
#........~wwwwwwwwwwww~........#
#........~wwwwwwwwwwww~........#
#........~wwwwwwwwwwww~........#
#.....mmm~wwwwwwwwwwww~mmm.....#
#.....mMm~~~~~~~~~~~~~~mMm.....#
#.....mmm..............mmm.....#
#..............................#
#...~~~~~~............~~~~~~...#
#...~~~~~~............~~~~~~...#
#..........x...................#
###############v################
```

A typical Stranding: the player stands on the north stone at row 2, paints `Swath[Tide, Lingering]` south toward the rim, and steps back east onto dry stone. The Coil follows the new water toward them and is Exposed in it; when the water returns to stone it is Stranded for 5 s at 50% more damage taken. In phase 3, the same strip carries its Body pulse, so the player must not stand in it.
