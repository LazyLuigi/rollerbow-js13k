# ROLLERBOW

A ragdoll unicorn hurtles down a rainbow track.

Slide along curving rainbow tracks as a unicorn in this momentum-based arcade game. Dive down slopes to build up speed, time perfect landings, and collect glowing orbs as you race across stylized landscapes.

![ROLLERBOW gameplay](media/gameplay.gif)

## Ride the rainbow

Keep your momentum through an endless descent. Tuck to pick up speed, launch off the track, and adjust your angle in the air to stick the landing. Chain flips and pickups into combos, chase a new distance record, and see how long you can keep the run alive.

There are 12 achievements to earn, from your first flip to long-distance rides and high-speed runs. On WaveDash, compete on the distance and score leaderboards.

## Play

Open [src/index.html](src/index.html) in your browser, then tap or press a key to ride. Play with a keyboard or use the two halves of your touchscreen.

| Action | Keyboard | Touch |
|---|---|---|
| Lean back / backflip | ←, A or Q | Left half |
| Lean forward / frontflip | → or D | Right half |
| Jump | Tap both directions together | Tap both halves |
| Tuck | Hold both directions, or ↓ | Hold both halves |
| Toggle music | M | — |
| Toggle blood effects | G | — |

Lean forward to dive and gain speed; lean back to climb and slow down. You can save your jump for mid-air, but you need to touch the track before jumping again.

## About

Made for **js13kGames 2026**, with the theme **Unicorns and Rainbows**, and the **WaveDash challenge**. The whole game fits into a 13 KB download, including its landscapes, physics and music.

The riding feel is inspired by **Action SuperCross**, the predecessor of Elasto Mania. Its physics were reimplemented from scratch for ROLLERBOW; no original game code is included.

## Build locally

```sh
npm install
npm run build
```

This creates `rollerbow.zip` and browser-ready versions in `dist/js13k/` and `dist/wavedash/`. Run `npm test` for the automated checks.
