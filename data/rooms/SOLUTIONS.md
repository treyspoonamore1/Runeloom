# Region room solutions (M4)

Intended solutions for the Emberwood and Sunken Kiln puzzle rooms. They become scripted solution
tests (BUILD_PLAN M4 task 10) once the world agent's driver lands. K5 and K10 (boss rooms) are not
covered here.

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
  already tested in `tests/sim/world/regionRooms.test.ts`.

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

## E4 Old Mill: barrels, and a Heart Seed behind crates

Weave: LMB `Cast > Bolt[Fire]` (cx 2).

Heart Seed (8, 29) in the crate-sealed storeroom:

1. Walk to the dirt lane at (14, 28), east of the crate wall (x 11–12, y 26–29).
2. Cast `Bolt[Fire]` at (12, 28). The bolt stops on the crate and lights it; fire spreads
   crate to crate.
3. Step back to (18, 28). The crates reach the oil barrel at (10, 27), which explodes 1 s after
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
   then east to (52, 17). The locked door K (53, 17–18) opens with the key. Exit east at (57, 17).

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

## K6 Frost Shrine: freeze the pool

Weave: Q `Cast > Lob[Frost]` (cx 2; Frost is the room's reward), or `Cast > Nova[Frost]`
(cx 3).

The pool is 4 tiles of deep water (x 31–34, cells 124–139) wall to wall, between shallow
fringes at x 30 and 35.

1. Walk from the west exit past the altar to (29, 13).
2. Cast `Lob[Frost]` at cell (126, 54), then at cell (136, 54). Two 5-cell bursts make an ice
   bridge across cells 121–141 (rule 8; lasts 8 s).
3. Walk east across to (37, 13), then to the exit (49, 13).

With Nova instead: stand at (30, 13), cast `Nova[Frost]`, step to (32, 13), cast again, walk
across. Pass: the east exit is reached. Without Frost: unreachable (tested).

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
| A    | (16, 7)  | (41, 7)  | 6–8       | (92, 30), (100, 30), (108, 30), (115, 30) |
| B    | (16, 24) | (41, 24) | 23–25     | (92, 98), (100, 98), (108, 98), (115, 98) |

For each lane:

1. Stand on the lane ice west of the block, at (14, 7) (lane B: (14, 24)).
2. Cast the four `Lob[Frost]` aims (each burst freezes about 10 cells; the pool is 32). The pool
   part of the lane becomes ice bridge.
3. Push the block east (walk into it). It slides across the ice and the bridge and stops on the
   plate against the wall. Do this within 8 s of the first lob.

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
