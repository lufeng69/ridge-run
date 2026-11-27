# RIDGE RUN

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/lufeng69/ridge-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/lufeng69/ridge-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A bush-plane flight game, built for the make.fun best flight game bounty. Take off from Pinefield airfield, thread eight glowing rings down a mountain valley — over the river, the patchwork fields and the village — and put the old mail plane down gently on the Lakeside runway. Mind your speed: too slow and she stalls, too fast or too hard and the runway will not forgive you.

Play it: serve `game/` with any static server and open `game/index.html` in a desktop browser. Keyboard and mouse, no network, no install.

## How to play

1. **Take off** — hold `Shift` to spool the throttle up, steer down the runway with `A` / `D`, pull back with `W` once you have speed.
2. **Fly the rings** — follow the amber marker and the compass tape to the next glowing ring. Each ring is worth 100 points.
3. **Land** — drop the gear with `G`, flaps with `F`, keep it slow and level, and touch down on the centreline. A smooth, centred landing pays up to 500, plus a time bonus.

- `W` / `↑` climb, `S` / `↓` descend, `A` `D` / `←` `→` bank and turn.
- `Shift` throttle up, `Ctrl` throttle down. `F` flaps, `G` gear.
- `C` switches chase and cockpit camera. `R` resets the run. `P` pauses. `M` mutes.
- Three lives: crash and you restart just before your last ring.

## What is in here

- `game/` — the playable game: `index.html` plus ES modules under `game/src/` (flight rules, procedural valley, three.js rendering, lit instrument panel, synthesized sound, screenshot staging) and vendored three.js under `game/vendor/`. All art is built in code, all sound is synthesized with WebAudio.
- `screenshots/` — four real renders of the game: title, mid-flight, through a ring, and the final approach.
- `main.ts` — the hand-in program (Node 22, standard library only): copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

Built with Muse. Referral code: `kcn5v9j0`

---

<sub>Entered on [make.fun](https://make.fun/?ref=kcn5v9j0&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

## License

MIT — see `LICENSE`.
