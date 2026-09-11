'use strict';
// Wavedash integration: achievements and leaderboards, on the TERSER OUTPUT.
//
// Why the terser output and not the source: terser can rewrite a boolean
// literal into an integer, and the Wavedash SDK validates its types. The call
// is then rejected, the defensive guard swallows the exception, and nothing is
// sent, without a word in the console. This bug only exists in the build. So
// the stub below reproduces the real SDK validation and COUNTS the violations,
// instead of accepting everything: a permissive stub tests nothing.
//
//   node test/wavedash.js            # source + terser output
//   node test/wavedash.js --src-only
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load } = require('./harness');

let fail = 0;
const check = (ok, msg) => { console.log((ok ? '  OK   ' : '  FAIL ') + '  ' + msg); if (!ok) fail = 1; };

// --- the stub: same type checks as the SDK, and it counts everything ---
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
      if (known.size && !known.has(id)) { log.set.push('!' + id); return false; }  // missing from the portal
      log.set.push(id); unlocked.add(id); return true;
    },
    getOrCreateLeaderboard(name, sort, disp) {
      vStr(name, 'name'); vNum(sort, 'sortOrder'); vNum(disp, 'displayType');
      log.boards.push(name);
      if (opt.boardReject) return Promise.reject(new Error('boom'));
      if (opt.boardFail) return Promise.resolve({ success: false });
      // shape read from the server generated types: id, never _id
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

// Plays until an achievement is earned, then kills the unicorn to trigger the scores.
async function run(file, opt) {
  const { sdk, log } = makeSDK(opt);
  const G = load(file, opt.noSDK ? {} : { wavedash: sdk });
  await flush();
  G.spawn(4242); G.mode = 1;
  G.st5 = [20, 50, 140, 3000, 200];       // flips, combo, km/h, distance, coins
  G.chkAch();
  G.dist = 1234.7; G.score = 8888; G.die();
  await flush();
  return { G, log };
}

const IDS = ['RB_FIRST_FLIP', 'RB_5_FLIPS', 'RB_12_FLIPS', 'RB_COMBO_X25', 'RB_COMBO_X45',
  'RB_110_KM_H', 'RB_132_KM_H', 'RB_750_M', 'RB_1_5_KM', 'RB_2_5_KM', 'RB_60_COINS', 'RB_130_COINS'];

async function suite(file, label) {
  console.log('\n=== ' + label + ' (' + file + ') ===');

  console.log('1. platform present, everything responds');
  {
    const { log } = await run(file, {});
    check(log.init === 1, 'init() called once');
    check(log.stats === 1, 'requestStats() called: without it no achievement is sent');
    check(log.typeErr.length === 0, 'no type violation' + (log.typeErr.length ? ': ' + log.typeErr.join(', ') : ''));
    check(log.set.length === 12, '12 achievements sent (' + log.set.length + ')');
    check(JSON.stringify(log.set) === JSON.stringify(IDS), 'expected identifiers: ' + log.set.slice(0, 3).join(', ') + '...');
    check(log.boards.length === 2 && log.scores.length === 2, '2 leaderboards created, 2 scores sent');
    check(log.scores.some(s => s[0] === 'lb_distance-v1' && s[1] === 1234), 'distance read from data.id, rounded: ' + JSON.stringify(log.scores));
    check(log.scores.some(s => s[0] === 'lb_score-v1' && s[1] === 8888), 'score read from data.id');
  }

  console.log('2. achievement earned before the stats response');
  {
    const { sdk, log } = makeSDK({});
    let release;
    sdk.requestStats = () => { log.stats++; return new Promise(r => { release = () => r({ success: true, data: true }); }); };
    const G = load(file, { wavedash: sdk });
    G.spawn(4242); G.mode = 1;
    G.st5 = [20, 50, 140, 3000, 200]; G.chkAch();
    check(log.set.length === 0, 'nothing is sent while the stats have not responded');
    release(); await flush();
    check(log.set.length === 12, 'the 12 pending achievements are sent on the response (' + log.set.length + ')');
  }

  console.log('3. repeats: an already unlocked achievement is not sent again');
  {
    const { sdk, log } = makeSDK({});
    const G = load(file, { wavedash: sdk });
    await flush();
    G.spawn(4242); G.mode = 1;
    G.st5 = [20, 50, 140, 3000, 200]; G.chkAch();
    G.spawn(4242); G.mode = 1;                       // new run: the local achievements reset to zero
    G.st5 = [20, 50, 140, 3000, 200]; G.chkAch();
    check(log.set.length === 12, 'still 12 sends after two identical runs (' + log.set.length + ')');
    check(log.get >= 12, 'getAchievement filters duplicates (' + log.get + ' reads)');
  }

  console.log('4. zero score and zero distance');
  {
    const { sdk, log } = makeSDK({});
    const G = load(file, { wavedash: sdk });
    await flush();
    G.spawn(4242); G.mode = 1;
    G.best = -1; G.bestD = -1; G.dist = 0; G.score = 0; G.die();
    await flush();
    check(log.scores.length === 2 && log.scores.every(s => s[1] === 0), 'a zero is a valid score, it is sent');
  }

  console.log('5. platform side failures');
  for (const [name, opt] of [['stats rejected', { statsReject: 1 }], ['stats failed', { statsFail: 1 }],
                             ['leaderboard creation rejected', { boardReject: 1 }], ['leaderboard failed', { boardFail: 1 }],
                             ['upload rejected', { uploadReject: 1 }], ['missing methods', { missing: ['setAchievement', 'uploadLeaderboardScore', 'getAchievement'] }],
                             ['identifiers unknown to the portal', { known: ['RB_FIRST_FLIP'] }]]) {
    let err = null;
    try { const { G } = await run(file, opt); G.play(30, null, 4242); } catch (e) { err = e; }
    check(!err, name + ': the game continues without exception' + (err ? ' -- ' + err.message : ''));
  }

  console.log('6. off platform (js13kgames.com): no Wavedash global');
  {
    let err = null;
    try { const { G, log } = await run(file, { noSDK: 1 }); G.play(60, null, 4242); check(log.init === 0, 'no call issued'); }
    catch (e) { err = e; check(false, 'exception: ' + e.message); }
    check(!err, 'the game runs identically without the platform');
  }
}

// The SDK silently ignores any identifier missing from the Developer Portal. The
// import JSON is the only local reference: it must match the code, exactly.
function checkJSON() {
  console.log('\n=== IMPORT JSON (wavedash-achievements.json) ===');
  const j = JSON.parse(fs.readFileSync('wavedash-achievements.json', 'utf8'));
  const json = j.achievements.map(a => a.identifier);
  check(JSON.stringify(json) === JSON.stringify(IDS),
    'the ' + IDS.length + ' identifiers in the JSON are the ones the code derives from ACHT');
  const manquants = IDS.filter(i => !json.includes(i));
  const surplus = json.filter(i => !IDS.includes(i));
  check(!manquants.length, 'no game identifier missing from the JSON' + (manquants.length ? ': ' + manquants : ''));
  check(!surplus.length, 'no extra identifier in the JSON' + (surplus.length ? ': ' + surplus : ''));
  check(j.achievements.every(a => a.display_name && a.description && 'stat_requirement' in a),
    'each definition has display_name, description and stat_requirement');
}

(async () => {
  await suite(process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'src/index.html', 'SOURCE');

  if (!process.argv.includes('--src-only')) {
    // Real terser output, with the production options. Only the toplevel
    // mangle is removed: the test calls the game functions by their name,
    // and renaming local variables does not change what is checked here.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-'));
    const html = fs.readFileSync('src/index.html', 'utf8');
    const js = /<script>([\s\S]*)<\/script>/.exec(html)[1];
    fs.writeFileSync(path.join(tmp, 'in.js'), js);
    execFileSync('./node_modules/.bin/terser', [path.join(tmp, 'in.js'), '-c', 'passes=3,unsafe=true', '-o', path.join(tmp, 'out.js')]);
    const out = path.join(tmp, 'game.html');
    fs.writeFileSync(out, '<script>' + fs.readFileSync(path.join(tmp, 'out.js'), 'utf8') + '</script>');
    await suite(out, 'TERSER OUTPUT');
  }

  checkJSON();

  console.log(fail ? '\nFAIL' : '\nOK: the Wavedash integration holds, source and build.');
  process.exit(fail);
})();
