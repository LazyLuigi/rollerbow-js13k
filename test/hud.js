'use strict';
// Verifie que les textes centraux ne se superposent jamais et ne sortent pas
// du cadre, sur plusieurs formats d'ecran.
const { load } = require('./harness');
const file = process.argv[2] || 'src/index.html';
const KEY = /BACKFLIP|FRONTFLIP|PERFECT|AIRTIME|BOING|BOOST|TRICK LOST|^x\d/;

function pilot(G) {
  const k = {}, B = G.B;
  let a = B.a % 6.283;
  if (a > 3.1416) a -= 6.283; if (a < -3.1416) a += 6.283;
  if (G.air) {
    if (G.airT > 0.9 && G.airT < 1.7) k.arrowleft = 1;
    else { const e = a + B.om * 0.3; if (e > 0.3) k.arrowright = 1; else if (e < -0.3) k.arrowleft = 1; }
  }
  return k;
}

let frame = [], font = 20, overl = 0, seen = 0, maxSimul = 0, minGap = 1e9;
const ys = [];
const spy = (m, a) => {
  if (m === 'set font') font = parseInt(String(a[0]).match(/(\d+)px/)?.[1] || 20);
  if (m === 'fillText' && KEY.test(a[0])) { frame.push({ y: a[2], h: font }); ys.push(a[2]); }
};

const G = load(file, { spy, dpr: 2 });
G.spawn(4242); G.mode = 1;
for (let i = 0; i < 7200; i++) {
  frame = [];
  G.frame(pilot(G));
  if (frame.length > 1) {
    seen++;
    if (frame.length > maxSimul) maxSimul = frame.length;
    frame.sort((a, b) => a.y - b.y);
    for (let j = 1; j < frame.length; j++) {
      const gap = frame[j].y - frame[j - 1].y;
      const need = (frame[j].h + frame[j - 1].h) / 2 * 0.75;
      if (gap < minGap) minGap = gap;
      if (gap < need) { overl++; break; }
    }
  }
  if (G.mode === 2 && G.deadT > 1.2) { G.spawn(4242); G.mode = 1; }
}
ys.sort((a, b) => a - b);
console.log('frames avec plusieurs textes :', seen);
console.log('maximum simultane            :', maxSimul);
console.log('ecart vertical minimal       :', minGap < 1e9 ? minGap.toFixed(0) + ' px' : '-');
console.log('frames en superposition      :', overl);
console.log('position verticale           :', ys[0].toFixed(0) + ' a ' + ys[ys.length - 1].toFixed(0) + ' px sur ' + G.H);
const ok = overl === 0 && ys[0] > 0 && ys[ys.length - 1] < G.H;
console.log(ok ? 'OK : aucune superposition, rien hors cadre.' : 'ECHEC');
process.exit(ok ? 0 : 1);
