'use strict';
// Mesure l'equilibrage sur plusieurs pistes : morts, distance, sauts.
// Sert de garde-fou : un changement de physique qui double ou divise par deux
// ces chiffres se voit immediatement, alors qu'il passerait inapercu en jouant.
const { load, levelPilot } = require('./harness');

const file = process.argv[2] || 'src/index.html';
const SEEDS = [4242, 777, 99, 2026, 13, 555, 808, 31];

function run(label, pilot) {
  let deaths = 0, jumps = 0, spd = 0, n = 0;
  const dists = [];
  for (const sd of SEEDS) {
    const G = load(file);
    G.spawn(sd); G.mode = 1;
    let best = 0, wasAir = 0;
    for (let i = 0; i < 3600; i++) {
      G.frame(pilot ? pilot(G) : {});
      if (G.mode === 1) {
        spd += Math.hypot(G.B.vx, G.B.vy); n++;
        if (G.dist > best) best = G.dist;
        if (!wasAir && G.air) jumps++;
        wasAir = G.air;
      }
      if (G.mode === 2 && G.deadT > 1.2) { dists.push(G.dist); deaths++; G.spawn(sd); G.mode = 1; wasAir = 0; }
    }
    dists.push(best);
  }
  dists.sort((a, b) => a - b);
  console.log(label.padEnd(22),
    'morts=' + String(deaths).padStart(3),
    ' distance mediane=' + dists[dists.length >> 1].toFixed(0) + 'm',
    ' max=' + dists[dists.length - 1].toFixed(0) + 'm',
    ' vitesse moy=' + (spd / n * 3.6).toFixed(0) + 'km/h');
}

console.log(file + '  (8 pistes, 60 s chacune)');
run('pilote qui corrige', levelPilot);
run('aucune entree', null);
