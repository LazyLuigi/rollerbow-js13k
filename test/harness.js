'use strict';
// Shared harness: runs the game under node with a simulated canvas.
//
// The game has no dependency on a real browser: it needs a 2d context,
// requestAnimationFrame and a document object. We replace them with stubs
// that record what happens instead of drawing. This makes it possible to measure
// balancing, to detect NaN and to replay scenarios in a deterministic way,
// things that cannot be done by eye in a browser.

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

// Creates a fake 2d context. `spy` receives every call: { m, args }.
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

// Loads a game file and returns its global context, plus a few helpers.
// opts.spy      : function called on every canvas operation
// opts.width/height/dpr : simulated geometry
function load(file, opts = {}) {
  const html = fs.readFileSync(file, 'utf8');
  const m = /<script>([\s\S]*)<\/script>/.exec(html);
  if (!m) throw new Error('No <script> block in ' + file);

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
  G.self = G;                              // in a browser self === window
  if (opts.wavedash) G.Wavedash = opts.wavedash;   // platform stub, absent by default
  vm.createContext(G);
  vm.runInContext(m[1], G, { filename: file });

  let clock = 0;
  // Advances one frame at 60 Hz. `keys` is the keyboard state for this frame.
  G.frame = (keys) => {
    G.keys = keys || {};
    clock += 1000 / 60;
    const f = raf.shift();
    if (!f) throw new Error('requestAnimationFrame epuise');
    f(clock);
  };
  // Plays n frames with a driver. Restarts automatically after death.
  G.play = (n, pilot, seed) => {
    for (let i = 0; i < n; i++) {
      G.frame(pilot ? pilot(G) : {});
      if (G.mode === 2 && G.deadT > 1.2) { G.spawn(seed); G.mode = 1; }
    }
  };
  return G;
}

// Reference driver: corrects pitch attitude in the air, does not touch the tuck.
// Do not make it release the tuck quickly, that would trigger jumps
// and skew every trajectory measurement.
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
