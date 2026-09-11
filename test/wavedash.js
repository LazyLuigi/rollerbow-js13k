'use strict';
// Integration Wavedash : trophees et classements, sur la SORTIE TERSER.
//
// Pourquoi la sortie terser et pas la source : terser peut reecrire un litteral
// booleen en entier, et le SDK Wavedash valide ses types. L'appel est alors
// rejete, la garde defensive avale l'exception, et rien ne part -- sans un mot
// dans la console. Ce bug n'existe que dans le build. Le stub ci-dessous
// reproduit donc la validation du vrai SDK et COMPTE les violations, au lieu
// de tout accepter : une doublure permissive ne teste rien.
//
//   node test/wavedash.js            # source + sortie terser
//   node test/wavedash.js --src-only
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load } = require('./harness');

let fail = 0;
const check = (ok, msg) => { console.log((ok ? '  OK   ' : '  ECHEC') + '  ' + msg); if (!ok) fail = 1; };

// --- la doublure : memes verifications de type que le SDK, et elle compte tout ---
function makeSDK(opt) {
  opt = opt || {};
  const log = { init: 0, stats: 0, set: [], get: 0, boards: [], scores: [], typeErr: [] };
  const vBool = (v, p) => { if (typeof v !== 'boolean') { log.typeErr.push(p + '=' + JSON.stringify(v)); throw new Error(p + ': expected boolean'); } };
  const vStr = (v, p) => { if (typeof v !== 'string') { log.typeErr.push(p + '=' + JSON.stringify(v)); throw new Error(p + ': expected string'); } };
  const vNum = (v, p) => { if (typeof v !== 'number' || v !== v) { log.typeErr.push(p + '=' + JSON.stringify(v)); throw new Error(p + ': expected number'); } };
  const known = new Set(opt.known || []);
  const unlocked = new Set();
  const sdk = {
    init() { log.init++; return true; },
    requestStats() {
      log.stats++;
      if (opt.statsReject) return Promise.reject(new Error('boom'));
      if (opt.statsFail) return Promise.resolve({ success: false });
      return Promise.resolve({ success: true, data: true });
    },
    getAchievement(id) { vStr(id, 'identifier'); log.get++; return unlocked.has(id); },
    setAchievement(id, storeNow) {
      vStr(id, 'identifier'); vBool(storeNow, 'storeNow');
      if (known.size && !known.has(id)) { log.set.push('!' + id); return false; }  // absent du portail
      log.set.push(id); unlocked.add(id); return true;
    },
    getOrCreateLeaderboard(name, sort, disp) {
      vStr(name, 'name'); vNum(sort, 'sortOrder'); vNum(disp, 'displayType');
      log.boards.push(name);
      if (opt.boardReject) return Promise.reject(new Error('boom'));
      if (opt.boardFail) return Promise.resolve({ success: false });
      // forme lue dans les types generes du serveur : id, jamais _id
      return Promise.resolve({ success: true, data: { id: 'lb_' + name, name: name, totalEntries: 0, created: true } });
    },
    uploadLeaderboardScore(id, score, keepBest) {
      vStr(id, 'leaderboardId'); vNum(score, 'score'); vBool(keepBest, 'keepBest');
      log.scores.push([id, score]);
      if (opt.uploadReject) return Promise.reject(new Error('boom'));
      return Promise.resolve({ success: true });
    }
  };
  for (const m of opt.missing || []) delete sdk[m];
  return { sdk, log };
}

const flush = () => new Promise(r => setImmediate(() => setImmediate(() => setImmediate(r))));

// Joue jusqu'a decrocher un trophee, puis tue la licorne pour declencher les scores.
async function run(file, opt) {
  const { sdk, log } = makeSDK(opt);
  const G = load(file, opt.noSDK ? {} : { wavedash: sdk });
  await flush();
  G.spawn(4242); G.mode = 1;
  G.st5 = [20, 50, 140, 3000, 200];       // tours, combo, km/h, distance, pieces
  G.chkAch();
  G.dist = 1234.7; G.score = 8888; G.die();
  await flush();
  return { G, log };
}

const IDS = ['RB_FIRST_FLIP', 'RB_5_FLIPS', 'RB_12_FLIPS', 'RB_COMBO_X25', 'RB_COMBO_X45',
  'RB_110_KM_H', 'RB_132_KM_H', 'RB_750_M', 'RB_1_5_KM', 'RB_2_5_KM', 'RB_60_COINS', 'RB_130_COINS'];

async function suite(file, label) {
  console.log('\n=== ' + label + ' (' + file + ') ===');

  console.log('1. plateforme presente, tout repond');
  {
    const { log } = await run(file, {});
    check(log.init === 1, 'init() appele une fois');
    check(log.stats === 1, 'requestStats() appele : sans lui aucun trophee ne part');
    check(log.typeErr.length === 0, 'aucune violation de type' + (log.typeErr.length ? ' : ' + log.typeErr.join(', ') : ''));
    check(log.set.length === 12, '12 trophees envoyes (' + log.set.length + ')');
    check(JSON.stringify(log.set) === JSON.stringify(IDS), 'identifiants attendus : ' + log.set.slice(0, 3).join(', ') + '...');
    check(log.boards.length === 2 && log.scores.length === 2, '2 classements crees, 2 scores envoyes');
    check(log.scores.some(s => s[0] === 'lb_distance-v1' && s[1] === 1234), 'distance lue depuis data.id, arrondie : ' + JSON.stringify(log.scores));
    check(log.scores.some(s => s[0] === 'lb_score-v1' && s[1] === 8888), 'score lu depuis data.id');
  }

  console.log('2. trophee gagne avant la reponse des stats');
  {
    const { sdk, log } = makeSDK({});
    let release;
    sdk.requestStats = () => { log.stats++; return new Promise(r => { release = () => r({ success: true, data: true }); }); };
    const G = load(file, { wavedash: sdk });
    G.spawn(4242); G.mode = 1;
    G.st5 = [20, 50, 140, 3000, 200]; G.chkAch();
    check(log.set.length === 0, 'rien n\'est envoye tant que les stats ne repondent pas');
    release(); await flush();
    check(log.set.length === 12, 'les 12 trophees en attente partent a la reponse (' + log.set.length + ')');
  }

  console.log('3. repetitions : un trophee deja debloque ne repart pas');
  {
    const { sdk, log } = makeSDK({});
    const G = load(file, { wavedash: sdk });
    await flush();
    G.spawn(4242); G.mode = 1;
    G.st5 = [20, 50, 140, 3000, 200]; G.chkAch();
    G.spawn(4242); G.mode = 1;                       // nouvelle course : les succes locaux repartent a zero
    G.st5 = [20, 50, 140, 3000, 200]; G.chkAch();
    check(log.set.length === 12, 'toujours 12 envois apres deux courses identiques (' + log.set.length + ')');
    check(log.get >= 12, 'getAchievement filtre les doublons (' + log.get + ' lectures)');
  }

  console.log('4. score nul et distance nulle');
  {
    const { sdk, log } = makeSDK({});
    const G = load(file, { wavedash: sdk });
    await flush();
    G.spawn(4242); G.mode = 1;
    G.best = -1; G.bestD = -1; G.dist = 0; G.score = 0; G.die();
    await flush();
    check(log.scores.length === 2 && log.scores.every(s => s[1] === 0), 'un zero est un score valide, il est envoye');
  }

  console.log('5. echecs cotes plateforme');
  for (const [name, opt] of [['stats rejetees', { statsReject: 1 }], ['stats en echec', { statsFail: 1 }],
                             ['creation de classement rejetee', { boardReject: 1 }], ['classement en echec', { boardFail: 1 }],
                             ['upload rejete', { uploadReject: 1 }], ['methodes absentes', { missing: ['setAchievement', 'uploadLeaderboardScore', 'getAchievement'] }],
                             ['identifiants inconnus du portail', { known: ['RB_FIRST_FLIP'] }]]) {
    let err = null;
    try { const { G } = await run(file, opt); G.play(30, null, 4242); } catch (e) { err = e; }
    check(!err, name + ' : le jeu continue sans exception' + (err ? ' -- ' + err.message : ''));
  }

  console.log('6. hors plateforme (js13kgames.com) : aucun global Wavedash');
  {
    let err = null;
    try { const { G, log } = await run(file, { noSDK: 1 }); G.play(60, null, 4242); check(log.init === 0, 'aucun appel emis'); }
    catch (e) { err = e; check(false, 'exception : ' + e.message); }
    check(!err, 'le jeu tourne identiquement sans la plateforme');
  }
}

// Le SDK ignore en silence tout identifiant absent du Developer Portal. Le JSON
// d'import est la seule reference locale : il doit coller au code, exactement.
function checkJSON() {
  console.log('\n=== JSON D\'IMPORT (wavedash-achievements.json) ===');
  const j = JSON.parse(fs.readFileSync('wavedash-achievements.json', 'utf8'));
  const json = j.achievements.map(a => a.identifier);
  check(JSON.stringify(json) === JSON.stringify(IDS),
    'les ' + IDS.length + ' identifiants du JSON sont ceux que le code derive de ACHT');
  const manquants = IDS.filter(i => !json.includes(i));
  const surplus = json.filter(i => !IDS.includes(i));
  check(!manquants.length, 'aucun identifiant du jeu absent du JSON' + (manquants.length ? ' : ' + manquants : ''));
  check(!surplus.length, 'aucun identifiant en trop dans le JSON' + (surplus.length ? ' : ' + surplus : ''));
  check(j.achievements.every(a => a.display_name && a.description && 'stat_requirement' in a),
    'chaque definition a display_name, description et stat_requirement');
}

(async () => {
  await suite(process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'src/index.html', 'SOURCE');

  if (!process.argv.includes('--src-only')) {
    // Sortie terser reelle, avec les options de production. Seul le mangle
    // toplevel est retire : le test appelle les fonctions du jeu par leur nom,
    // et renommer des variables locales ne change pas ce qu'on verifie ici.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-'));
    const html = fs.readFileSync('src/index.html', 'utf8');
    const js = /<script>([\s\S]*)<\/script>/.exec(html)[1];
    fs.writeFileSync(path.join(tmp, 'in.js'), js);
    execFileSync('./node_modules/.bin/terser', [path.join(tmp, 'in.js'), '-c', 'passes=3,unsafe=true', '-o', path.join(tmp, 'out.js')]);
    const out = path.join(tmp, 'game.html');
    fs.writeFileSync(out, '<script>' + fs.readFileSync(path.join(tmp, 'out.js'), 'utf8') + '</script>');
    await suite(out, 'SORTIE TERSER');
  }

  checkJSON();

  console.log(fail ? '\nECHEC' : '\nOK : l\'integration Wavedash tient, source et build.');
  process.exit(fail);
})();
