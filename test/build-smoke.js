'use strict';
// Fait tourner le BUILD compresse, pas la source.
// terser et roadroller peuvent casser du code parfaitement valide : ce test est
// le seul qui verifie ce qu'on soumet reellement au concours.
const { load } = require('./harness');
const file = process.argv[2] || 'dist/index.html';

let calls = 0, bad = 0;
const cams = [];
const spy = (m, a) => {
  calls++;
  for (const x of a) if (typeof x === 'number' && !isFinite(x)) bad++;
  if (m === 'setTransform' && a.length === 6 && a[0] !== 1) cams.push(a[4]);
};

const G = load(file, { spy, dpr: 2 });
for (let i = 0; i < 1800; i++) G.frame({});   // les noms sont mangles : on ne pilote pas

const span = Math.max(...cams) - Math.min(...cams);
console.log('fichier            :', file);
console.log('frames jouees      : 1800');
console.log('appels canvas      :', calls);
console.log('valeurs invalides  :', bad);
console.log('deplacement camera :', (span / 1000).toFixed(1), 'k pixels sur 30 s');
const ok = bad === 0 && span > 5000;
console.log(ok ? 'OK : le build compresse demarre, simule et dessine.' : 'ECHEC');
process.exit(ok ? 0 : 1);
