# pt8boss decisions

Playtest 8 boss notes (the Glasswater Coil's head, boss state readability). Rows: date, question, decision, reason.

| Date | Question | Decision | Reason |
|---|---|---|---|
| 2026-10-27 | Where did the Coil's head go ("detached from the body and moved off the screen")? | Render only. `CoilRig.head` pulled the head back through each Lunge windup with `lift.position.x -= …` every frame, and `EnemyView` reset only `lift.position.y`, so the x offset summed over every windup frame (about 18 art units × the facing's x, 36 cells for a Lunge straight east or west) and never came back. Fixed in `EnemyView`: the lift's base position is set on both axes every frame (and in the death topple), so rig offsets are relative to it. | A headless probe of the sim head (boss bot with and without Tide, F10 and the test arena, seeds 1–3, plus scripted Frost and stone-standing fights) logged every tick: the sim head never entered a wall or left the grid, and never moved more than 0.73 cells a tick (the Lunge's 44 cells/s). The render test reproduces 35 cells of drift from one westward Lunge before the fix. |
