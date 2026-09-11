'use strict';
// Harnais partage : fait tourner le jeu sous node avec un canvas simule.
//
// Le jeu n'a aucune dependance a un navigateur reel : il lui faut un contexte 2d,
// requestAnimationFrame et un objet document. On les remplace par des doublures
// qui enregistrent ce qui se passe au lieu de dessiner. Cela permet de mesurer
// l'equilibrage, de detecter les NaN et de rejouer des scenarios de maniere
// deterministe, choses impossibles a faire a l'oeil dans un navigateur.

const fs = require('fs');
const vm = require('vm');

function Path2D() {}
['moveTo', 'lineTo', 'arc', 'bezierCurveTo', 'quadraticCurveTo', 'closePath', 'ellipse']
  .forEach(m => { Path2D.prototype[m] = function () {}; });

const DRAW = ['beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc',
  'ellipse', 'closePath', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'save',
  'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'fillText',
  'strokeText', 'clip', 'drawImage'];

const STYLES = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font',
  'globalCompositeOperation', 'lineCap', 'lineJoin', 'textAlign', 'textBaseline'];

// Cree un contexte 2d factice. `spy` recoit chaque appel : { m, args }.
function makeCtx(spy) {
  const ctx = {};
  for (const m of DRAW) ctx[m] = function (...a) { if (spy) spy(m, a); };
  ctx.createLinearGradient = ctx.createRadialGradient = function (...a) {
    if (spy) spy('gradient', a);
    return { addColorStop(o, c) { if (spy) spy('addColorStop', [o, c]); } };
  };
  ctx.measureText = () => ({ width: 10 });
  for (const p of STYLES) {
    let v;
    Object.defineProperty(ctx, p, {
      set(x) { if (spy) spy('set ' + p, [x]); v = x; },
      get() { return v; }
    });
  }
  return ctx;
}

// Charge un fichier de jeu et renvoie son contexte global, plus quelques aides.
// opts.spy      : fonction appelee a chaque operation canvas
// opts.width/height/dpr : geometrie simulee
function load(file, opts = {}) {
  const html = fs.readFileSync(file, 'utf8');
  const m = /<script>([\s\S]*)<\/script>/.exec(html);
  if (!m) throw new Error('Aucun bloc <script> dans ' + file);

  const canvas = { width: 0, height: 0, style: {}, addEventListener() {},
                   getContext: () => makeCtx(opts.spy) };
  const raf = [];
  const G = {
    document: { getElementById: () => canvas, createElement: () => canvas },
    window: {}, Math, console, Date, Path2D,
    devicePixelRatio: opts.dpr || 1,
    innerWidth: opts.width || 900,
    innerHeight: opts.height || 600,
    addEventListener() {},
    requestAnimationFrame(f) { raf.push(f); },
    setInterval() { return 0; }
  };
  G.window = G;
  G.self = G;                              // dans un navigateur self === window
  if (opts.wavedash) G.Wavedash = opts.wavedash;   // doublure de la plateforme, absente par defaut
  vm.createContext(G);
  vm.runInContext(m[1], G, { filename: file });

  let clock = 0;
  // Avance d'une frame a 60 Hz. `keys` est l'etat clavier pour cette frame.
  G.frame = (keys) => {
    G.keys = keys || {};
    clock += 1000 / 60;
    const f = raf.shift();
    if (!f) throw new Error('requestAnimationFrame epuise');
    f(clock);
  };
  // Joue n frames avec un pilote. Relance automatiquement apres la mort.
  G.play = (n, pilot, seed) => {
    for (let i = 0; i < n; i++) {
      G.frame(pilot ? pilot(G) : {});
      if (G.mode === 2 && G.deadT > 1.2) { G.spawn(seed); G.mode = 1; }
    }
  };
  return G;
}

// Pilote de reference : corrige l'assiette en vol, ne touche pas au tout schuss.
// Ne pas lui faire relacher le schuss rapidement, cela declencherait des sauts
// et fausserait toute mesure de trajectoire.
function levelPilot(G) {
  const k = {}, B = G.B;
  if (!B) return k;
  let a = B.a % 6.283;
  if (a > 3.1416) a -= 6.283;
  if (a < -3.1416) a += 6.283;
  if (G.air) {
    const e = a + B.om * 0.3;
    if (e > 0.25) k.arrowright = 1;
    else if (e < -0.25) k.arrowleft = 1;
  }
  return k;
}

module.exports = { load, makeCtx, levelPilot, Path2D };
