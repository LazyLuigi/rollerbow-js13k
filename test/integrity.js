'use strict';
// Verifie qu'aucune valeur invalide n'atteint le canvas.
// Un NaN passe a fillRect ou une couleur "hsl(NaN,...)" ne leve aucune erreur :
// le navigateur ignore silencieusement l'appel. Ce sont donc des bugs invisibles
// en jouant, mais qui font disparaitre des elements a l'ecran.
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

console.log(`fichier          : ${file}`);
console.log(`frames jouees    : 3600`);
console.log(`appels canvas    : ${calls}`);
console.log(`valeurs invalides: ${bad.length}`);
if (bad.length) { bad.forEach(b => console.log('   ' + b)); process.exit(1); }
console.log('OK : aucun NaN ni undefined passe au canvas.');
