// Automatic driver for record-gif.py. Called once per frame, BEFORE the game
// advances. It writes into `keys`, where the game reads its input: synthesising
// key events would go through the browser and break determinism.
//
//   python3 record-gif.py --driver tools/autopilot.js --start-js "start()"
//
// Two behaviours, like a decent player:
//   on the ground -> tuck, to build up speed
//   airborne      -> correct the pitch attitude to land flat, except during a
//                    flip window opened at regular intervals when the flight is
//                    long enough to complete it.
var __f = 0, __flipUntil = -1, __flipDir = 1;
window.__drive = function () {
  var B = window.B, k = window.keys;
  if (!B || !k) return;
  __f++;
  k.arrowleft = 0; k.arrowright = 0; k.arrowdown = 0;

  // Title screen, or once the death animation has played out: we restart.
  if (window.mode === 0 || (window.mode === 2 && window.deadT > 1.2)) {
    if (window.start) window.start();
    __flipUntil = -1;
    return;
  }
  if (window.mode !== 1) return;

  if (!window.air) { k.arrowdown = 1; __flipUntil = -1; return; }   // on the ground: tuck

  // Airborne: one flip every ~3 s of game time, if the flight has just started.
  if (__flipUntil < 0 && window.airT < .2 && __f % 180 < 60) {
    __flipUntil = __f + 26;
    __flipDir = -__flipDir;
  }
  if (__f < __flipUntil) { k[__flipDir > 0 ? 'arrowleft' : 'arrowright'] = 1; return; }

  var a = B.a % 6.283;                                             // otherwise: flat pitch attitude
  if (a > 3.1416) a -= 6.283;
  if (a < -3.1416) a += 6.283;
  var e = a + B.om * .3;
  if (e > .25) k.arrowright = 1;
  else if (e < -.25) k.arrowleft = 1;
};
