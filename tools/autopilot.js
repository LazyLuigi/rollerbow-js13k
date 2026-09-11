// Pilote automatique pour record-gif.py. Appele une fois par image, AVANT que
// le jeu n'avance. Il ecrit dans `keys`, la ou le jeu lit ses entrees : simuler
// des evenements clavier passerait par le navigateur et casserait le determinisme.
//
//   python3 record-gif.py --driver tools/autopilot.js --start-js "start()"
//
// Deux comportements, comme un joueur correct :
//   au sol  -> tout schuss, pour prendre de la vitesse
//   en l'air -> corriger l'assiette pour se poser a plat, sauf pendant une
//               fenetre de salto ouverte a intervalle regulier quand le vol est
//               assez long pour la boucler.
var __f = 0, __flipUntil = -1, __flipDir = 1;
window.__drive = function () {
  var B = window.B, k = window.keys;
  if (!B || !k) return;
  __f++;
  k.arrowleft = 0; k.arrowright = 0; k.arrowdown = 0;

  // Ecran titre, ou mort digeree : on relance.
  if (window.mode === 0 || (window.mode === 2 && window.deadT > 1.2)) {
    if (window.start) window.start();
    __flipUntil = -1;
    return;
  }
  if (window.mode !== 1) return;

  if (!window.air) { k.arrowdown = 1; __flipUntil = -1; return; }   // au sol : tout schuss

  // En l'air : un salto toutes les ~3 s de jeu, si le vol vient de commencer.
  if (__flipUntil < 0 && window.airT < .2 && __f % 180 < 60) {
    __flipUntil = __f + 26;
    __flipDir = -__flipDir;
  }
  if (__f < __flipUntil) { k[__flipDir > 0 ? 'arrowleft' : 'arrowright'] = 1; return; }

  var a = B.a % 6.283;                                             // sinon : assiette a plat
  if (a > 3.1416) a -= 6.283;
  if (a < -3.1416) a += 6.283;
  var e = a + B.om * .3;
  if (e > .25) k.arrowright = 1;
  else if (e < -.25) k.arrowleft = 1;
};
