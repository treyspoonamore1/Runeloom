# M8 phase 1: chemistry decisions

Ambiguities the chemistry agent resolved (grid foundations, Tide, wind). Same columns as `docs/DECISIONS.md`.

| Date | Question | Decision | Reason |
|---|---|---|---|
| 2026-10-25 | How do fog cells remember that they were cleared? | Fog is `air = fog` with `airTimer` 0. A cleared fog cell has `air = none` and `airTimer` counting the seconds until it rolls back; any cell whose smoke, steam or clear timer ends gets `restingAir` (fog where `fogMask` is set, else none). Walls inside a `@fog` rectangle get the mask bit but never fog | Reuses the one air timer and the active set, so fog costs nothing while quiet and needs no new per-cell field. Smoke over fog then returns to fog when it ends ("replace it while they last") |
| 2026-10-25 | Is a lit furnace vent a burning grid cell? | No. It is a material (`vent_lit`, solid, not shot-blocking) that ignites entities touching it (rule 30). It doesn't spread fire to its neighbors, light oil, or clear fog | DESIGN §6.2 gives it no spread chance and rule 30 lists only entity ignition. A vent that lit the grass around it would make every vent room burn down on load |
| 2026-10-25 | Do pre-M8 rooms get the new header keys? | No: `fog`, `wind` and `pulse` exist on the parsed header only when the file has those lines | "Room files from before M8 load unchanged": their parsed headers are identical objects, so nothing that compares or serializes headers moves |
| 2026-10-25 | Do pre-M8 states keep their hashes? | Yes. `wet` (now u16) hashes as its low bytes, plus its high bytes only when some cell exceeds 255 ticks; `borrowed`, the gust fields, `wind`, `fogMask` and the gust list are hashed only when any is set | Every scenario hashes identically before and after the M8 grid fields, which is a strong check that the new code is neutral where it isn't used |
| 2026-10-25 | Do `@pulse` pylons and Live Wires glow first? | Both send `pylonGlow` `tuning.world.pulseGlowSeconds` (0.8 s) before each pulse; Live Wires' pulse timing is unchanged | CONTENT §6.2 says `@pulse` works "as Live Wires does" and adds the glow; one telegraph for one mechanic. Events aren't hashed, so rifts replay as before |
| 2026-10-25 | How is a direction quantized to the 8 winds? | Sector test with tan 22.5° (no `atan2`) | Bit-identical in every engine; the sim never depends on trig rounding |
