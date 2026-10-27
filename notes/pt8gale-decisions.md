# Playtest 8: Lob[Gale] visual decisions

| Date | Question | Decision | Reason |
|---|---|---|---|
| 2026-10-27 | How to shoot one weave at fixed moments after its cast? | New `--set spells` in `npm run shots` (tools/lib/spellShots.ts): a sandbox game in test/fen_render, the weave in slot 1, cast once, shot at ticks 15, 30, 34, 38, 45 and 90 after the cast (or `--ticks N`) | No lab station or scenario casts one spell and stops at chosen moments; sandbox mode needs no rune items |
