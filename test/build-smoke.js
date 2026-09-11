'use strict';
// Runs the compressed BUILD, not the source.
// terser and roadroller can break perfectly valid code: this test is
// the only one that checks what we actually submit to the contest.
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
for (let i = 0; i < 1800; i++) G.frame({});   // names are mangled: no piloting

const span = Math.max(...cams) - Math.min(...cams);
console.log('file               :', file);
console.log('frames played      : 1800');
console.log('canvas calls       :', calls);
console.log('invalid values     :', bad);
console.log('camera movement    :', (span / 1000).toFixed(1), 'k pixels over 30 s');
const ok = bad === 0 && span > 5000;
console.log(ok ? 'OK : the compressed build starts, simulates and draws.' : 'FAIL');
process.exit(ok ? 0 : 1);
