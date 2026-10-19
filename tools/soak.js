#!/usr/bin/env node
/* Headless soak: two bot chefs play every TT Kitchen level on EASY and NORMAL with the game's own rules.
     node tools/soak.js                      every level, both difficulties, 3 seeds each
     node tools/soak.js --seeds 10           more seeds
     node tools/soak.js --level 8            one level
     node tools/soak.js --sabotage noserve   the bots never serve: every run must fail (proves the check can fail)
     node tools/soak.js --sabotage lazy      Tommy stands still all game
   Exit code 0 only when every run earns at least one star (or, with --sabotage, when the check catches it). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, Set, Map, Object, Array, JSON, Int16Array, Number, String };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/sim.js', 'js/bot.js', 'js/soak.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const TK = ctx.TK;

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const seeds = +arg('seeds', 3);
const level = arg('level', null);
const sabotage = arg('sabotage', null);
const levels = level ? [+level - 1] : undefined;

const t0 = Date.now();
const res = TK.soak({ seeds, seed: 1, levels, sabotage });
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('#', 3) + pad('level', 17) + pad('diff', 7) + pad('coins', 7) + pad('tips', 6) + pad('served', 7) + pad('missed', 7) + pad('stars', 6) + pad('line', 15) + 'crispy throws bumps');
for (const r of res.runs) {
  console.log(pad(r.level, 3) + pad(r.name, 17) + pad(r.diff, 7) + pad(r.coins, 7) + pad(r.tips, 6) + pad(r.served, 7) + pad(r.missed, 7) +
    pad('⭐'.repeat(r.stars) || '-', 6) + pad(r.line.join('/'), 15) + `${r.crispy} ${r.throws} ${r.bumps}`);
}
const fails = res.runs.filter((r) => r.stars < 1);
console.log(`\n${res.runs.length} runs in ${((Date.now() - t0) / 1000).toFixed(1)} s. ${fails.length} without a star.`);
if (sabotage) {
  const caught = fails.length === res.runs.length;
  console.log(caught ? `Sabotage "${sabotage}": the check failed every run, as it should.` : `Sabotage "${sabotage}": ${res.runs.length - fails.length} runs still passed!`);
  process.exit(caught ? 0 : 1);
}
console.log(res.ok ? 'PASS: every level cleared with at least one star on EASY and NORMAL.' : 'FAIL');
process.exit(res.ok ? 0 : 1);
