# M8 phase 1: rooms decisions (after the bosses merge)

Same columns as `docs/DECISIONS.md`; earlier rows were moved there.

| Date | Question | Decision | Reason |
|---|---|---|---|
| 2026-10-26 | F5's outer stone: pits or water? | F5 now uses the bosses work's test arena (`data/rooms/test/boss_bellwether.txt`) cell for cell, plus the west exit and the `cleared` east door: shallow channels from the corner pools to the side walls split the outer stone into four islands, and the pylons stand on the ring's west and east sides | The Bellwether's AI and tuning were built and balanced on that arena; one layout for the region fight and the test arena keeps the bot's kill time meaningful. The ring stays under the 2,000-cell metal cap (1,824 cells), so one Storm hit charges all of it |
| 2026-10-26 | F10 against the Coil's arena | F10 is `boss_coil.txt` plus the south exit; the Coil spawns on the `1` in the Eye's deep water. No change to the map | It was already CONTENT §13.3's map exactly |
