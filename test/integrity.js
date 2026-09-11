'use strict';
// Checks that no invalid value reaches the canvas.
// A NaN passed to fillRect or a color "hsl(NaN,...)" raises no error:
// the browser silently ignores the call. So these are bugs that stay invisible
// while playing, but that make elements disappear from the screen.
const { load, levelPilot } = require('./harness');

const file = process.argv[2] || 'src/index.html';
let calls = 0;
const bad = [];
const spy = (m, args) => {
  calls++;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (typeof a === 'number' && !isFinite(a) && bad.length < 10) bad.push(`${m} arg${i}=${a}`);
    if (typeof a === 'string' && /NaN|undefined|Infinity/.test(a) && bad.length < 10) bad.push(`${m} "${a}"`);
  }
};

const G = load(file, { spy, dpr: 2 });
G.spawn(4242); G.mode = 1;
G.play(3600, levelPilot, 4242);

console.log(`file             : ${file}`);
console.log(`frames played    : 3600`);
console.log(`canvas calls     : ${calls}`);
console.log(`invalid values   : ${bad.length}`);
if (bad.length) { bad.forEach(b => console.log('   ' + b)); process.exit(1); }
console.log('OK : no NaN or undefined passed to the canvas.');
