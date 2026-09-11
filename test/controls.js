'use strict';
// Verifie les trois verbes de la v2, un par un et en isolation.
const { load } = require('./harness');
const file = process.argv[2] || 'src/index.html';
let fail = 0;
const check = (ok, msg) => { console.log((ok ? '  OK   ' : '  ECHEC') + '  ' + msg); if (!ok) fail = 1; };

// --- 1. flips asymetriques : meme saut, on compare droite et gauche ---
console.log('1. flips asymetriques');
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
console.log('  perilleux avant : ' + (res.arrowright.vx * 3.6).toFixed(0) + ' km/h, +' + res.arrowright.h.toFixed(2) + ' m');
console.log('  salto arriere   : ' + (res.arrowleft.vx * 3.6).toFixed(0) + ' km/h, +' + res.arrowleft.h.toFixed(2) + ' m');
check(res.arrowright.vx > res.arrowleft.vx, 'le perilleux avant est plus rapide');
check(res.arrowleft.h > res.arrowright.h, 'le salto arriere monte plus haut');

// --- 2. saut : tap simultane, rearme uniquement au sol ---
console.log('2. saut au tap simultane');
{
  const G = load(file);
  G.spawn(4242); G.mode = 1;
  G.play(150, null, 4242);
  const v0 = G.B.vy;
  for (let i = 0; i < 6; i++) G.frame({ arrowleft: 1, arrowright: 1 });
  for (let i = 0; i < 3; i++) G.frame({});
  const v1 = G.B.vy;
  check(v1 > v0 + 6, 'le tap declenche le saut (' + v0.toFixed(1) + ' -> ' + v1.toFixed(1) + ' m/s)');
  check(G.jmp === 0, 'le saut est consomme');
  for (let i = 0; i < 6; i++) G.frame({ arrowleft: 1, arrowright: 1 });
  for (let i = 0; i < 3; i++) G.frame({});
  check(G.B.vy < v1, 'le second tap en l air est refuse');
  let landed = 0;
  for (let i = 0; i < 400 && !landed; i++) { G.frame({}); if (!G.air) landed = 1; }
  check(landed && G.jmp === 1, 'le saut se rearme au contact du sol');
}

// --- 3. maintien = tout schuss, jamais de saut parasite ---
console.log('3. tout schuss au maintien');
{
  const G = load(file);
  G.spawn(4242); G.mode = 1;
  G.play(150, null, 4242);
  let consumed = 0;
  for (let i = 0; i < 90; i++) { G.frame({ arrowleft: 1, arrowright: 1 }); if (G.jmp === 0) consumed = 1; }
  check(!consumed, 'le maintien ne consomme jamais le saut');
  check(G.tuckV > 0.9, 'le tout schuss est engage (tuckV=' + G.tuckV.toFixed(2) + ')');
}

process.exit(fail);
