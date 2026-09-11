# Tests

The game runs under node with a simulated canvas (`harness.js`). No browser required.

| file | what it proves |
|---|---|
| `harness.js` | canvas and DOM doubles, reference driver. Not a test. |
| `integrity.js` | no NaN or undefined reaches the canvas |
| `controls.js` | asymmetric flips, jump on tap, tuck on hold |
| `hud.js` | center texts never overlap, never out of frame |
| `balance.js` | deaths, distance and speed over 8 tracks |
| `build-smoke.js` | the **compressed** artifact starts and simulates |

## Pitfalls encountered

**The test driver skews the measurements.** A driver that holds then releases
the tuck very quickly triggers a jump every time, by the tap rule. It then flies
above the coins and drops the pickup rate from 99% to 47%.
`levelPilot` never touches the tuck for that reason.

**A test that tests nothing.** An A/B comparison whose disable pattern no longer
matches the code returns two identical results, which looks like
"the feature is useless". Make the test fail when the pattern is not
found, never ignore it silently.

**Measuring the wrong variable.** Total speed at landing is dominated by the
horizontal one and does not move when vertical lift is added. It is the vertical
component that had to be tracked.
