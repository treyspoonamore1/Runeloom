# Region room solutions (M4)

Intended solutions for the Emberwood and Sunken Kiln puzzle rooms. Each one is a scripted
solution test (BUILD_PLAN M4 task 10) in `tests/sim/world/emberwoodSolutions.test.ts` and
`tests/sim/world/kilnSolutions.test.ts`; keep them in step. K5 and K10 (boss rooms) are not covered
here.

Conventions:

- Positions are **tiles** `(x, y)` from the room file's top-left grid character (headers don't
  count). A tile's center in cells is `(4x + 2, 4y + 2)`. Where a cast needs cell precision, the
  aim is given in **cells** and marked as such.
- "Cast `W` at P" means: stand still, aim at P, press the slot holding weave `W`.
- Weaves are listed with their complexity (cx). Every weave fits the Twig Spindle (8 Capacity)
  and uses only runes the player has by that room (CONTENT §9.1). Notes say when a weave needs a
  second copy of a rune (for example a second Fire rune for Swath while Bolt keeps one).
- Enemies are not part of the puzzle steps. Tests can clear them first (`killall`) or run with
  `cheats.noAI`, unless the step says the enemies matter.
- Static gating (exits, pickups and chests reachable only with the verb the room teaches) is
  also tested in `tests/sim/world/regionRooms.test.ts`.

## E1 Loomstone Glade: burn a bramble wall

Weave: LMB `Cast > Bolt[Fire]` (cx 2, the new-game weave).

1. Start at the Loom Stone (7, 11).
2. Walk east into the mouth of the walled funnel, to (40, 13).
3. Cast `Bolt[Fire]` at (47, 12). The bolt flies over the bramble block (x 43–46, y 10–16) and
   ends on the east wall/exit, so its 2-cell fire lands in the last bramble column. Bramble
   spreads fast; the block burns out in about 2–3 s.
4. Wait until no cell in x 43–46, y 10–16 is burning (about 4 s), then walk east to the exit
   (47, 12).

Why a Bolt works here: projectiles pass over bramble and only paint fire where they end, so the
funnel is walled on three sides to stop the bolt inside the hedge. Pass: the player reaches the
east exit.

## E2 Thicket: the bramble maze

Weaves: LMB `Cast > Bolt[Fire]`, Q `Cast > Swath[Fire]` (cx 2, needs a second Fire rune, or
re-weave LMB).

The maze is walkable without fire (140 tiles). Turning points from the west exit:
(1, 15) → (9, 15) → (9, 17) → (12, 17) → (12, 23) → (18, 23) → (18, 21) → (21, 21) → (21, 23) →
(23, 23) → (23, 18) → (14, 18) → (14, 15) → (11, 15) → (11, 9) → (9, 9) → (9, 6) → (18, 6) →
(18, 3) → (21, 3) → (21, 5) → (24, 5) → (24, 3) → (36, 3) → (36, 5) → (39, 5) → (39, 3) →
(45, 3) → (45, 14) → (60, 14) → east exit (61, 15).

The chase: Tinderlings (spawns 2 and 3) light the grass corridors they run through, and the
archers' missed arrows (spawn 1, east clearing) light whatever they land on. Burning bramble walls
with Swath cuts the route short but spreads fire into the grass corridors behind you. The stream
(x 26–27) is the Wet refuge halfway.

Hidden Loom Shard (3, 27), in a sealed pocket in the south-west corner:

1. Walk to (3, 21) in the west clearing, facing south toward the bramble plug (x 2–4, y 23–24).
2. Cast `Swath[Fire]` at (3, 26). The strip starts at the caster and covers the plug.
3. Wait about 2 s for the plug to burn out, then walk to (3, 27).

Pass: the Loom Shard is taken. (A Bolt aimed straight south flies over the plug and ends on dirt,
so it doesn't work here; Swath, the E1 reward, is the tool.)

## E3 Riverbend: burn the bridge behind you

Weave: Q `Cast > Swath[Fire]` (cx 2).

1. From the west exit (0, 6), follow the dirt path to the bridge (x 21–33, y 12–13). The
   Tinderling hollow (spawn 2, x 10–18, y 15–20) is beside the approach, so the pack aggros
   and chases.
2. Cross to the east end, (34, 12).
3. Face west and cast `Swath[Fire]` at (28, 12), then at (28, 13) (one strip per plank row).
4. Walk on to (37, 12). About 6 s after a wood cell lights, it drops into deep water (rule 3,
   `under`), cutting the bridge. The Tinderlings can't cross deep water.
5. Exit south at (46, 33).

Pass: at least one full column of bridge tiles (both rows) is deep water while the player is on
the east bank, and no Tinderling is east of x = 34. Note: Tinderlings that run onto the bridge
light it themselves (rule 22), which also counts.

Measured (tests/sim/world/emberwoodSolutions.test.ts, AI on): the wood's 6 s burn lets the front
of a pack that is right behind the player across before the bridge drops; in the test 4 of the 8
Tinderlings cross and 4 are cut off on the west bank.

## E4 Old Mill: barrels, and a Heart Seed behind crates

Weave: LMB `Cast > Bolt[Fire]` (cx 2).

Heart Seed (8, 29) in the crate-sealed storeroom:

1. Walk to the dirt lane at (14, 29), east of the crate wall (x 11–12, y 26–29).
2. Cast `Bolt[Fire]` at (12, 29). The bolt stops on the crate and lights it; fire spreads
   crate to crate.
3. Step back to (19, 29). The crates reach the oil barrel at (10, 27), which explodes 1 s after
   it lights (4-cell world fire, hurts the player).
4. When the crates are ash (about 6 s), walk in to (8, 29).

Explosion lesson (combat, not tested as a puzzle): when the `tar_crew` (spawn 1, (26, 20)) is
near a yard barrel ((20, 13), (33, 13), (24, 17) or (30, 23)), cast `Bolt[Fire]` at the barrel.
The Tar Hulk picks up Oil from the slicks at (16–18, 13–15) and (30–32, 22–24); an Oiled Hulk
that is ignited explodes 1.5 s later.

Pass: the Heart Seed is taken.

## E5 Archer Ridge: the wildfire fight (combat)

No puzzle. Notes for the combat sim: archers stand on the north (y 1–7) and south (y 32–38)
stone ledges behind 2-tile pit drops, reachable by the dirt ramps at x 8–10 and x 61–63. The
grass field burns from missed arrows; the stream (around x 33–37) keeps the player Wet. Burning
the bramble lips (x 16–21 and 44–49 at y 8; x 24–29 and 52–57 at y 31) makes dense smoke that
blinds the archers on that ledge.

## E6 Shield Road: burning shields, and the first Rare

Weave: LMB `Cast > Bolt[Fire]`, Q `Cast > Swath[Fire]`.

Shield lesson (combat): lure Shieldbearers (spawn 1) onto the grass verges (y 5–13, 20–29) or the
oil spills at (21–25, 15–17) and (44–46, 16–17), then light the ground under them. Their shields
burn after 4 s in player-owned fire.

Heart Seed (59, 25) in the walled garden:

1. Kill every enemy, including the Rare `archer_line` at the toll gate (spawn 3, (69, 16)).
2. The garden door D (56–58, 21) opens (`@link D cleared`).
3. Walk from (57, 20) through the door to (59, 25).

Pass: the door opens only after the last enemy dies, and the Heart Seed is taken.

## E7 Hollow Oak: three braziers in 10 seconds

Weaves: LMB `Cast > Bolt[Fire]`, Q `Cast > Lob[Fire]` (cx 2).

Braziers: NW (4, 5) in a niche that opens south, NE (41, 5) in a niche that opens south, S
(22, 25) in a root chamber that opens south. No floor tile has a bolt line to two of them (tested).

Fastest route (all three within 10 s; computed on the tile grid):

1. Stand at (10, 19). Cast `Bolt[Fire]` at (4, 5). The timer starts.
2. Run to (13, 22) (6 tiles). Cast `Lob[Fire]` at (22, 25) (over the chamber wall, 9.5 tiles).
3. Run east along the south floor and up the east corridor to (35, 19) (25 tiles). Cast
   `Bolt[Fire]` at (41, 5).
4. The door D (21–24, 19) opens (`@link D timer:10:braziers:all`). Walk the stone causeway
   (21–24, 20–21) to the Loom Shard (22, 16).

Travel: 31 tiles with Lob, about 4.8 s at run speed; bolt only (S lit from (20, 29)): 45 tiles,
about 6.9 s. Hazard: Tinderlings (spawn 1, 2) burn the plank walkway (y 10–11) over the pit; the
stone causeway to the door can't burn.

Pass: the door opens and the Shard is taken. Fail case to test: lighting the third brazier more
than 10 s after the first leaves the door shut.

## E8 Kiln Approach (combat)

No puzzle. Loom Stone (5, 31). The dungeon entrance is the north passage (33–36, 0). Rare
`tar_crew` at the oil camp (spawn 3, (42, 34)) next to barrels at (44, 32) and (44, 34).

## K1 Kiln Gate: light two braziers

Weave: LMB `Cast > Bolt[Fire]`.

1. From the south exit, walk to (20, 12). Cast `Bolt[Fire]` at (20, 7).
2. Walk to the metal apron at (46, 16). Cast `Bolt[Fire]` at (46, 10) (the north-east alcove
   opens to the south).
3. The gate D (24–27, 5) opens (`@link D braziers:all`). Exit north at (25, 0).

The Brood Kiln `&` (41, 18) spawns mites until it dies or is frozen; ignoring it is fine.
Pass: the gate opens.

## K2 Brazier Hall: Lob over low walls

Weave: Q `Cast > Lob[Fire]` (cx 2).

Every brazier sits inside a solid wall ring: no bolt or beam can reach it (tested), and each has
floor within Lob range (10 tiles, tested).

1. Brazier A (18, 28) in the kiln box: from (24, 28), cast `Lob[Fire]` at (18, 28).
2. Brazier C (9, 4) in the sealed north gallery: from (9, 10), cast `Lob[Fire]` at (9, 4).
3. Brazier B (47, 27) on a pillar in the pit: from the north rim (47, 19), cast `Lob[Fire]` at
   (47, 27).
4. The east door D (60, 8–10) opens. Exit east at (61, 9).

Pass: the door opens. Fail case: `Cast > Bolt[Fire]` at each brazier from the same spots never
lights one.

## K3 Bramble Vault: burn a path to the small key

Weave: Q `Cast > Lob[Fire]` (or `Cast > Swath[Fire]` from the step positions).

The vault (walls x 16–42, y 6–29, entrance on the west at x 16, y 16–19) has three bramble
layers split by stone firebreaks, so each must be lit separately.

1. From the courtyard at (11, 17), cast `Lob[Fire]` at (18, 17). Layer 1 (x 17–20) burns; the
   oil barrels in it at (18, 10) and (18, 25) explode. Stay at x ≤ 12 until they have.
   Tinderlings in firebreak 1 (spawn 1, (21, 12)) come out; a Tinderling dying next to bramble
   also lights it.
2. Walk to (22, 17). Cast `Lob[Fire]` at (25, 17). Layer 2 (x 24–27) burns.
3. Walk to (29, 17), then into the baffle gap (30, 17). Cast `Lob[Fire]` at (33, 17). The inner
   bramble (x 31–41) burns around the stone dais.
4. Walk to (35, 17) and open the chest `k` (36, 17): +1 Kiln small key.
5. Leave by the vault entrance, go round by the north courtyard (y 11) to the east lane (43, 17),
   then east to (52, 17). The one-tile locked door K (53, 17) opens with the key. Exit east at (57, 17).

Pass: key taken, K opened, east exit reached.

## K4 Oil Works: light the oil, not yourself

Weave: Q `Cast > Lob[Fire]` (or LMB `Cast > Bolt[Fire]`).

Both barricades sit at the ends of 1-tile oil ducts, out of sight and more than 10 tiles from
any floor you can reach without walking the ducts. Standing in a duct and shooting the barricade
lights the oil under your feet.

1. Deal with the `tar_crew` (spawn 1, (8, 18)) near the entrance. Keep fire away from the
   gutters (x 26, y 6–31; y 6 and 31, x 14–26).
2. Stand on stone at (24, 18), west of the sump. Cast `Lob[Fire]` at (32, 18) (the oil sump,
   x 29–36, y 14–21). The barrels at (33, 13), (37, 15) and (37, 20) explode; you are more than
   9 tiles away.
3. Fire runs through duct A ((37–48, 17–18) → (49, 9–18) → (49–58, 9)) to the exit barricade
   (59–60, 8–10), and through duct B ((33, 22–24) → (33–52, 24) → (52, 24–30)) to the closet
   barricade (51–53, 31). Each barricade burns for 4 s, then turns to stone.
4. Wait until no duct cell is burning (about 15 s). Walk duct B to the Heart Seed (52, 34).
5. Walk back and along duct A to the east exit (67, 9).

Pass: Heart Seed taken, east exit reached. Fail case to test: from (49, 9), inside duct A,
`Bolt[Fire]` at (59, 9) lights the barricade and the duct oil beside it, and the fire runs back
along the duct to the player (Oiled, then Ignited at double terrain-fire damage).

## K6 Frost Shrine: take Frost from the shrine, then freeze the pool

Weave: Q `Cast > Lob[Frost]` (cx 2; Frost is the room's reward), or `Cast > Nova[Frost]`
(cx 3).

The Frost rune sits on the rune shrine (`R`) at (16, 13), the heart of the metal altar between
the four pylons. It isn't paid on entry: the player has to touch the shrine. The pool is 4 tiles
of deep water (x 31–34, cells 124–139) wall to wall, between shallow fringes at x 30 and 35.

1. Walk from the west exit to (15, 13) and step east into the shrine. Frost goes into the pouch
   and the "new element" panel opens; weave `Cast > Lob[Frost]` into Q (a third Cast rune from
   a drop, or swap Frost into an existing weave).
2. Walk to (29, 13).
3. Cast `Lob[Frost]` at cell (126, 54), then at cell (136, 54). Two 5-cell bursts make an ice
   bridge across cells 121–141 (rule 8; lasts 8 s).
4. Walk east across to (37, 13), then to the exit (49, 13).

With Nova instead: stand at (30, 13), cast `Nova[Frost]`, step to (32, 13), cast again, walk
across. Pass: Frost isn't owned before the shrine is touched, and the east exit is reached.
Without Frost: unreachable (tested).

## K7 Ice Crossing: the CONTENT §6.3 example, enlarged

Weaves: Q `Cast > Lob[Frost]`, LMB `Cast > Bolt[Fire]`.

The channel is deep from wall to wall (x 13–32), with a stone islet (20–24, 10–15) in the middle.
The braziers are on the far bank, more than a bolt's range (63 cells) from the west bank and the
islet, so you have to cross first.

1. From the west exit, walk to the fringe (12, 12).
2. Cast `Lob[Frost]` at cells (56, 50), (66, 50), (76, 50). Walk to the islet (21, 12).
3. Cast `Lob[Frost]` at cells (108, 50), (118, 50), (128, 50). Walk to the east bank (37, 12).
   (Each ice bridge lasts 8 s plus 1.5 s cracking; Fire nearby melts it.)
4. From (45, 8), cast `Bolt[Fire]` at (45, 4). From (45, 17), cast `Bolt[Fire]` at (45, 21).
5. The east door D (48, 11–14) opens. Exit east at (49, 12).

Heart Seed (17, 20), floating on deep water:

1. From the west bank fringe at (12, 20), cast `Lob[Frost]` at cells (57, 82) and (66, 82)
   (deep water starts at cell 52, right after the fringe).
2. Walk to (17, 20), take it, and walk back to (11, 20) before the ice breaks.

Pass: Heart Seed taken, east exit reached. Without Frost: neither is reachable (tested). Frost
Wisps' frost lines can also open a path; that is allowed (CONTENT §5).

## K8 Slide Room: freeze the pool, slide the ice blocks

Weave: Q `Cast > Lob[Frost]`.

Two lanes cross the deep pool (x 22–29, cells 88–119). Each lane is 3 tiles tall, walled above
and below, with never-melting ice on both sides of the pool and a pressure plate against the
lane's east wall:

| Lane | Block    | Plate    | Lane rows | Lob[Frost] aims (cells)                   |
| ---- | -------- | -------- | --------- | ----------------------------------------- |
| A    | (16, 7)  | (41, 7)  | 6–8       | (92, 30), (100, 30), (108, 30), (116, 30) |
| B    | (16, 24) | (41, 24) | 23–25     | (92, 98), (100, 98), (108, 98), (116, 98) |

For each lane:

1. Stand at the east end of the lane's west runway, (20, 7) (lane B: (20, 24)). Lob reaches
   40 cells, so the far aims are out of range from further back.
2. Cast the four `Lob[Frost]` aims (each burst freezes about 10 cells; the pool is 32). The pool
   part of the lane becomes ice bridge.
3. Walk back to the stone at (12, 7) (lane B: (12, 24)), stop on the lane's center line (ice is
   slippery: an off-center push slides past the block), and walk east into the block. It slides
   across the ice and the bridge and stops on the plate against the wall. Do this within 8 s of
   the first lob.

Then:

4. With both plates pressed, the door D (43, 15–16) opens (`@link D plates:all`).
5. Freeze a crossing at rows 15–16: from (20, 15), cast `Lob[Frost]` at cells (92, 64),
   (100, 64), (108, 64), (115, 64). Walk to the landing (35, 15), through the door, to the
   Loom Shard (52, 13), and on to the east exit (57, 15).

Pass: both plates pressed, the Shard taken, the exit reached. Fail case to test: without Frost, a
pushed block stops at the pool edge (21, 7) and the plates stay up.

## K9 Thaw Lock: melt the ice blocks, freeze the moat

Weaves: LMB `Cast > Bolt[Fire]`, Q `Cast > Lob[Frost]`.

The big-key chest `g` (50, 19) stands on a stone island (46–54, 13–25) inside a ring of eight
ice blocks (49–51, 18–20). The ring can't be pushed open from outside (every push is blocked by
the chest or another block). A deep moat (x 38–44 on the near side, shallow fringe at x 37)
surrounds the island.

1. Fight the `caller_guard` (spawn 1, (26, 18)). The Stormcaller targets puddles and metal near
   you; freezing the puddle under you (ice doesn't conduct) is the Warden preview.
2. Melt first, from the shore, so no fire lands near your bridge: from (36, 19), cast
   `Bolt[Fire]` at (49, 19). The bolt flies over the moat and stops on the west block, which melts
   into shallow water (meltwater). One block opens the chest's west side; melting more is
   optional.
3. Freeze the moat: from (36, 19), cast `Lob[Frost]` at cells (157, 78), (167, 78), (176, 78).
   Walk across to (46, 19), then onto the meltwater at (49, 19).
4. Open the chest `g`: Kiln big key.
5. Freeze the moat again if the bridge has broken, walk back, and go north to the big-key door G
   (28–31, 5). It opens with the big key. Exit north at (29, 0) into K10.

Pass: big key taken, G opened, north exit reached. Without Frost: the chest can't be reached
(tested). Fail case to test: casting `Bolt[Fire]` while standing on the ice bridge next to it
melts the bridge.

# Glasswater Fen and the Drowned Foundry (M8)

Intended solutions for the Fen and Foundry puzzle rooms (CONTENT §13). Each one is a scripted
solution test in `tests/sim/world/fenSolutions.test.ts` (G1–G8) or
`tests/sim/world/foundrySolutions.test.ts` (F1–F9 and G7's Windward Cache), with an attempt
without the first element of the room's "Needs" column that must fail. Static gating is in
`tests/sim/world/fenRooms.test.ts`. Same conventions as above (tiles `(x, y)`, cells marked).

The player is a tier 8 character: every M2–M7 rune (CONTENT §13), Tide from F6 on, Gale only after
the Coil. Weaves fit the Twig Spindle; the tests cast with infinite mana (the puzzles aren't about
mana) and frozen enemies. Slots in the tests: LMB `Cast > Bolt[Fire]`, RMB `Cast > Strike[]`,
Q `Cast > Lob[Storm]`, E `Cast > Lob[Fire]` or `Cast > Lob[Frost]` unless a room says otherwise.

Conduction numbers that shape these rooms (data/tuning.ts `grid`): a water charge event covers at
most 600 cells and 40 flood-fill steps from where it starts; metal has no reach limit (2,000 cells);
a chain hands off water ↔ metal up to 4 times (rule 13). Sealed switches (`Q`) wake only from
charge on a cell touching them, never from a spell hit.

## G1 Storm Landing: Storm the glass pond

1. Arrive from K10's storm door at the south exit (24–25, 27). The Loom Stone is at (25, 24).
2. Walk the boardwalk north to (25, 13). The glass pond (27–33, 11–15, 544 cells) is ringed by
   reeds, so it is its own body; its switch `S` stands on a post at (31, 13), out in deep water.
3. Cast `Lob[Storm]` anywhere in the pond, e.g. at (28, 15), its far corner from the switch. The
   whole pond charges and the switch wakes; the east gate D (50, 6–7) opens (`switch:S`).
4. Walk the north-shore path east and out (51, 6–7) to G2.

Without Storm: Fire and Frost on the pond and the post do nothing; the gate stays shut (tested).
The big lake around the pond is a separate body: Storming it charges only the lake.

## G3 Pylon Field: hand-offs, and a melted plug

Walkway A (6–20, 17–18, Q1 on its spur at (12, 10)) and walkway B (28–45, 17–18, Q2 on its spur at
(36, 21)) both dip into the joint pool (21–27, 13–17). The third switch Q3 (41, 26) sits in a dry
sump whose only opening is the ice-block plug (41, 25) at the bottom of the sluice pool
(38–44, 19–24), which touches walkway B.

1. From the stone causeway (24, 18), cast `Lob[Storm]` at the joint pool (24, 15). The pool's
   charge hands off to both walkways (rule 13): Q1 and Q2 wake.
2. Walk to the sluice pool's shallow edge (39, 23). Cast `Lob[Fire]` at the plug (41, 25): it melts
   into shallow water that touches Q3.
3. Cast `Lob[Storm]` at the sluice pool (41, 21). The charge floods down the meltwater to Q3. (After
   the melt one hit in the joint pool also reaches it: pool → B → sluice → meltwater.)
4. The vault door D (46, 17–18) opens on the Loom Shard (50, 17). The north exit (27–30, 0) to G4
   was always open.

Without Storm: the plug melts, but no switch wakes; the vault stays shut (tested). Q3 has no metal
of its own: nothing but the plug's meltwater ever touches it, so Lob[Storm] over the sump wall can't
skip the Fire step (notes/m8-rooms-decisions.md).

## G4 Heron Lake: the soft gate

The lake (4–54, 4–19) is deep glass. Its two pylons (14, 22) and (1, 3) pulse world charge every
2 s (`@pulse 2`), glowing 0.8 s first. They stand in the old heron canal, a walled shallow sluice
round the west of the lake: south leg (6–23, 21), south-west walkway (2–5, 21; 2, 12–20), west and
north-west legs (2, 3–11; 2–10, 2), north walkway (11–23, 2) onto the north shore. The water legs
take the pylons' charge (hop 1), the rusted walkways pass it on (hop 2), and the north walkway also
charges the lake beside it (hop 3, 3–5 rows of the north end of the lake).

Frost path (no pulse damage, tested): from the landing at (25, 20), cast `Lob[Frost]` at cells
(102, 76), (102, 68), (102, 60), (102, 52), (102, 44); walk north on the ice bridge to (25, 12);
cast at (102, 40) … (102, 8); walk to the north shore (25, 2) and exit north (30–33, 0). The north
end of the crossing passes the lake water the north walkway charges; ice doesn't conduct.

Wading: walking the canal from the landing to the north shore takes about 14 s and the player is
hit by at least 5 pulses (6 in the test).

Heart Seed (47, 11) on the islet (45–49, 8–14) ringed by deep water: from the landing at (47, 20),
`Lob[Frost]` at cells (190, 76), (190, 68), (190, 60), walk to the seed and back. Without Frost the
seed is out of reach (tested).

## G5 Fogbank: three pools in the fog, 12 seconds

Fog covers tiles (1, 1)–(54, 31). Three deep channel systems each run from the room's wall to a
pylon islet with a sealed switch beside the pylon: A from the west wall to (14–15, 14), B from the
north wall to (32, 6–7), C from the east wall to (42–43, 25). Each Q touches only its own pool.
Decoy pools (3–6, 3–7), (30–34, 13–16), (47–52, 4–7), (19–22, 28–30) and a dead channel (33,
25–32) reach no switch. The east door D (54, 16–17) wants all three within 12 s.

1. From the causeway at (39, 21), cast `Lob[Storm]` at (42, 24) (pool C). The 12 s start.
2. Run to the inner spur (19, 15) and cast at (16, 12) (pool A).
3. Run to (30, 10) and cast at (31, 7) (pool B). About 7 s in all; the door opens.
4. Exit east (55, 16–17) to G6. The north exit (10–11, 0) to G7 is open.

Fire clears fog for 8 s, so Storming a pool and watching its charge glow up to the pylon it reaches
is how the player finds which pool is which. Fail case (tested): waking C, waiting 12.5 s, then A and
B leaves the door shut (C has slept again).

Loom Shard (3, 15) in a walled alcove behind bramble (6–8, 14–16): from (11, 15) cast `Lob[Fire]`
at (7, 15); when the bramble is ash, walk in. Without Storm the east door stays shut (tested).

## G6 Drowned Causeway (combat)

No puzzle. The sunken stone road (y 18–21) crosses three marsh rivers at three fords (x 13–22,
32–41, 51–60). Herons perch on the islets in the shallows, the Mirebull herd (the Fen's first Rare)
charges down the road and bogs in its mud patches (26–28, 19–20) and (45–47, 19–20); Bellshells
amble in the middle and east fords.

## G7 Lantern Grotto: four braziers in 15 seconds, and the Windward Cache

Braziers: west niche (2, 19) open to the east, east niche (45, 19) open to the west, and two on
islets out in the black pool, (18, 16) and (33, 16). `timer:15:braziers:all` on D (22–25, 7).

1. From (6, 19), `Bolt[Fire]` at (2, 19).
2. From (10, 16), `Bolt[Fire]` east at the west islet (18, 16): bolts fly over deep water.
3. Round the south of the pool to (41, 16), `Bolt[Fire]` west at the east islet (33, 16).
4. From (41, 19), `Bolt[Fire]` east at (45, 19). About 7 s from first to last.
5. The vault D opens on the Heart Seed (23, 4).

Without Fire: Storm, Frost and Strike light no brazier (tested).

Windward Cache (after the Coil): the wind-vane door `d` (39–40, 7) has `vanes:all`; its vane `Y`
stands at (41, 7). From (41, 10) cast `Cast > Strike[Gale]` north (a 60° cone gust from the caster):
the vane spins after 0.5 s of wind, `d` opens, and the chest `$` (40, 3) gives a Pattern Seed.
Without Gale nothing spins it (tested; the Gale solution waits for the chemistry merge).

## G8 Foundry Steps: the broken sluice bridge

The chasm (37–45, all rows) is pit. The sluice bridge crosses it on two rusted spans, west
(36–40, 16–17) and east (43–47, 16–17); the middle span fell into the shallow pool (41–42, 15–18) on
the chasm floor. The gate's switches sit at the bridge ends: (36, 15) on the west span, (46, 18) on
the east span.

1. From (33, 16), cast `Lob[Storm]` at the west span (37, 17): metal → the pool in the gap → the
   east span (rules 12, 13). Both switches wake.
2. The sluice gate D (57, 16–17) opens; exit east (59, 16–17) to F1. Loom Stone at (8, 17).

Without Storm: the gate stays shut (tested).

## F1 Sluice Gate: the moat carries it across

The moat (1–42, 6–7) is deep; a sealed switch stands on each bank touching it, (21, 8) and
(21, 5). The far bank is out of reach.

1. From (21, 10), cast `Lob[Storm]` into the moat at (18, 7). Both switches wake.
2. The east door D (43, 15–16) opens on the stair passage; walk north and exit (45–46, 0) to F2.

Without Storm the door stays shut (tested). The furnace alcove (45–49, 22–27) behind the vent wall
(43–44, 22–27) holds a chest: come back with Tide, douse the vents (`Lob[Tide]` at the wall from
(41, 24)) and walk through; the chest gives a Fuse part and 3 currency (test waits for Tide).

## F2 Pump Hall: three pumps in 3 seconds

Networks: the main pump C on the north wall (17–30, 2–5, switch (23, 6)), and two pump housings A
(15–18, 22–28, switch (16, 21)) and B (29–32, 22–28, switch (31, 21)) with the sump (19–28, 24–26)
between them, touching both. `timer:3:switch:S`.

Weaves: Q `Cast > Lob[Storm]`, RMB `Cast > Bolt[Storm]`.

1. From (22, 18), cast `Lob[Storm]` at the sump (23, 25): A and B wake.
2. At once cast `Bolt[Storm]` north at (22, 2): the bolt stops on the wall by the pump and its
   impact charges C. All three within 3 s; the door D (40–41, 1) opens. Exit north to F3.

Split or chained Storm bolts, Echo, a Storm Sigil or Saturate do it too. Fail case (tested): the
second hit 3.5 s after the first leaves the door shut. Without Storm nothing wakes (tested).

## F3 Cooling Pools: freeze, slide, plates

Two lanes cross the deep cooling pool at rows 8 and 22 (as K8): a stone runway (5–12) with an ice
block at (8, y), the lane's deep water (13–20), old ice (21–32) and a plate (32, y) against the
wall. The vault D (40, 15) opens on `plates:all`; the small key `k` (44, 15).

For each lane:

1. Walk to (12, y) at the runway's end and cast `Lob[Frost]` at cells (56, y), (64, y), (72, y),
   (80, y) (y = 34 or 90). The lane becomes ice bridge.
2. Walk back round the block to (7, y) on the lane's center line and push east: the block slides
   over the bridge and the old ice onto the plate.

Then cross the cart bridge (13–22, 15), open the vault, take the key, exit east to F4. Without Frost
a pushed block stops at (12, y), the pool edge (tested). Bellshells wade in the shallow margins:
electrify their pool to ring them.

## F4 Slag Run: the oil channel

The oil channel starts on this side of the slag pit at (34, 12), runs north (34, 6–12) and east
along a stone lip across the pit (35–49, 6) to the wooden barricade (50, 6) of the Heart Seed vault.

1. From (29, 15), cast `Lob[Fire]` at (34, 12). The fire runs up and across the channel and the
   barricade burns away (about 6 s).
2. When the channel is out, walk it to the Heart Seed (54, 6).
3. With F3's small key, walk east through the locked door K (55, 21) to F5.

Without Fire (and without Storm, whose rule 14 spark can also light oil) the barricade holds
(tested). Two quench pools, (14–17, 20–23) and (32–35, 21–24), crack Slagshells lured into them.

## F5 Bellwether's Belfry (mini-boss)

The Belfry is CONTENT §13.2's arena: the stone mount (9–16, 6–13), the metal ring round it, four
shallow pools at its corners, two pylons (12, 4) and (13, 15), stone islands outside cut apart by
pits. The east door D (24, 9–10) opens when the boss falls (`cleared`; tested with a stand-in).

## F6 Tide Shrine

1. Touch the shrine `R` (16, 12) on the cistern altar: Tide (level 10), the item get. Loom Stone
   (5, 12).
2. In the furnace corridor, cast `Lob[Tide]` at the 2-tile vent wall (39–40, 12–13): it is a
   walkable grate for 10 s. Walk east through and out (47, 12–13) to F7.

Without Tide the vents hold (tested); the shrine is reachable without it.

## F7 Furnace Row

Three walls of lit vents cross the hall at x 24, 29 and 34. For each: cast `Lob[Tide]` at the wall
(on its center row), walk through the doused gap before it relights, go on. Slagshells patrol
between them; Tide (or the quench troughs in the side alcoves) cracks them. Without Tide the first
wall holds (tested).

## F8 Dry Conduit: Floodline, and the vent row

East door D (56, 14–16), `switch:S`: its sealed switch (47, 15) stands on a stone dais 28 cells
across bare stone from the conduit pool (34–39, 13–17).

1. Standing in the pool's shallow rim (39, 15), cast `Cast > Swath[Tide, Lingering]` east at
   (47, 15): a strip of borrowed water (3 cells wide, from the caster) for 15 s. Walk along it and
   cast twice more, from cells x 170 and x 178, so each strip starts inside the last: the water now
   touches the dais's switch. (A strip that starts a cell short of the water before it leaves a dry
   gap, and the charge stops there.)
2. From (39, 18), cast `Lob[Storm]` at the rim (39, 15): within 40 cells of the switch, the charge
   runs along the borrowed water to it. D opens; exit east to F9.

Side vault (south), door `d` (26–27, 27), `switch:S`: its sealed switch (20, 27) is at the end of a
row of lit vents (13–19, 27) whose only other neighbors are walls.

1. From (11, 27), cast `Lob[Tide]` along the row at cells x 54, 60, 66, 72, 78 (y 110): every
   grate doused, none skipped (a dry gap between bursts breaks the conductor). Doused grates
   conduct like metal floor.
2. Cast `Lob[Storm]` at the near end (13, 27): the charge runs down the grates to the switch; `d`
   opens on the Loom Shard (27, 30).

Each door counts only the switch nearer to it (CONTENT §6.2). Without Tide neither switch can be
reached by charge (tested). The big-key door G (28–31, 5) leads north to F10 with F9's big key.

## F9 Flood Lock

The chasm (26–28, all rows) is 12 cells of pit. Big key `g` (51, 13) on the far dirt ledge.

1. From (25, 13), cast `Lob[Tide]` on the chasm at cells (106, 54) and (114, 54): a stretch of
   borrowed deep water for 10 s, all 12 cells across. Cast `Lob[Frost]` at the same points: an ice
   bridge (8 s plus 1.5 s cracking). Cross and take the key. (`Cast > Swath[Tide, Frost]` does both
   in one cast, 3 cells wide.)

Heart Seed vault D (19, 25), `plates:all`: the lane (5–10, 27) runs 24 cells from the ice block
(4, 27), which has the pit (3, 27) behind it, to the plate (11, 27). The lane is walled in, so no
one walks it or stands on the plate; Tide and Frost go over its wall.

1. From (7, 24), Glaze the lane: `Lob[Tide]` at cells x 21.5, 28.5, 35.5, 41.5 (y 110), then
   `Lob[Frost]` at the same points: borrowed ice for 15 s on every cell of tiles 5–10. (An ice block
   slides only onto a tile that is ice in all 16 cells; a 3-cell Swath strip can't cover a 4-cell
   lane, so Lob bursts it is.) Bursts east of the block wash it west, into the pit: it can't move.
2. `Lob[Tide]` on the pit behind the block (3, 27): the burst washes it east (away from its center,
   rule 28) and it slides along the glaze onto the plate, the first tile that isn't ice.
3. The vault opens on the Heart Seed (20, 28).

Without Tide the chasm stays a pit (Frost doesn't change pits) and the block can't be moved east
(tested). Without Frost, Tide alone can wash the block one tile per cast (seven casts).

## F10 The Glass Eye (boss)

CONTENT §13.3's map exactly. The Loom Stone (11, 22) sleeps until the Coil dies; the north door
(15, 0) stays sealed, its wind vane (14, 0) only says "The Cliffs aren't woven yet."
