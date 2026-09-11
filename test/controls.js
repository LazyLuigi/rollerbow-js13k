'use strict';
// Checks the three v2 verbs, one by one and in isolation.
const { load } = require('./harness');
const file = process.argv[2] || 'src/index.html';
let fail = 0;
const check = (ok, msg) => { console.log((ok ? '  OK   ' : '  FAIL ') + '  ' + msg); if (!ok) fail = 1; };

// --- 1. asymmetric flips: same jump, compare right and left ---
console.log('1. asymmetric flips');
const res = {};
for (const key of ['arrowright', 'arrowleft']) {
  const G = load(file);
  G.spawn(4242); G.mode = 1;
  G.play(120, null, 4242);
  G.B.y += 8; G.F.y += 8; G.R.y += 8;
  G.B.vy = G.F.vy = G.R.vy = 6;
  G.B.vx = G.F.vx = G.R.vx = 16;
  const k = {}; k[key] = 1;
  let peak = G.B.y;
  const y0 = G.B.y;
  for (let i = 0; i < 60; i++) { G.frame(k); if (G.B.y > peak) peak = G.B.y; }
  res[key] = { vx: G.B.vx, h: peak - y0 };
}
console.log('  front flip : ' + (res.arrowright.vx * 3.6).toFixed(0) + ' km/h, +' + res.arrowright.h.toFixed(2) + ' m');
console.log('  back flip  : ' + (res.arrowleft.vx * 3.6).toFixed(0) + ' km/h, +' + res.arrowleft.h.toFixed(2) + ' m');
check(res.arrowright.vx > res.arrowleft.vx, 'the front flip is faster');
check(res.arrowleft.h > res.arrowright.h, 'the back flip goes higher');

// --- 2. jump: simultaneous tap, rearms only on the ground ---
console.log('2. jump on simultaneous tap');
{
  const G = load(file);
  G.spawn(4242); G.mode = 1;
  G.play(150, null, 4242);
  const v0 = G.B.vy;
  for (let i = 0; i < 6; i++) G.frame({ arrowleft: 1, arrowright: 1 });
  for (let i = 0; i < 3; i++) G.frame({});
  const v1 = G.B.vy;
  check(v1 > v0 + 6, 'the tap triggers the jump (' + v0.toFixed(1) + ' -> ' + v1.toFixed(1) + ' m/s)');
  check(G.jmp === 0, 'the jump is consumed');
  for (let i = 0; i < 6; i++) G.frame({ arrowleft: 1, arrowright: 1 });
  for (let i = 0; i < 3; i++) G.frame({});
  check(G.B.vy < v1, 'the second tap in the air is refused');
  let landed = 0;
  for (let i = 0; i < 400 && !landed; i++) { G.frame({}); if (!G.air) landed = 1; }
  check(landed && G.jmp === 1, 'the jump rearms on ground contact');
}

// --- 3. hold = tuck, never a stray jump ---
console.log('3. tuck on hold');
{
  const G = load(file);
  G.spawn(4242); G.mode = 1;
  G.play(150, null, 4242);
  let consumed = 0;
  for (let i = 0; i < 90; i++) { G.frame({ arrowleft: 1, arrowright: 1 }); if (G.jmp === 0) consumed = 1; }
  check(!consumed, 'holding never consumes the jump');
  check(G.tuckV > 0.9, 'the tuck is engaged (tuckV=' + G.tuckV.toFixed(2) + ')');
}

process.exit(fail);
