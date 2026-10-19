/* TT Kitchen: the headless soak. Two bot chefs play every level on EASY and NORMAL with the real rules, no drawing,
   and the check says whether each one earned at least one star. Used by tools/soak.js (node) and game.soak() in the
   browser. A sabotaged run ('noserve': the bots never use the window, 'lazy': Tommy just stands there) shows the
   check can fail. */
(function (root) {
  'use strict';
  const TK = root.TK;

  TK.runLevel = function (li, o = {}) {
    const sim = new TK.Sim(li, { diff: o.diff || 'easy', mode: '2p', seed: o.seed });
    const team = new TK.Team(sim, { sabotage: o.sabotage, seed: (o.seed || 1) + 3 });
    const dt = 1 / 30;
    let crispy = 0, throws = 0, bumps = 0, helps = 0;
    let callAt = o.callEvery || 0;
    while (!sim.over) {
      sim.step(dt, team.inputs(dt));
      if (o.callEvery && sim.time >= callAt) { sim.call(); callAt += o.callEvery; }
      for (const e of sim.events) {
        if (e.type === 'crispy') crispy++;
        if (e.type === 'throw') throws++;
        if (e.type === 'bump') bumps++;
        if (e.type === 'saved') helps++;
      }
      sim.events.length = 0;
    }
    return {
      level: li + 1, name: TK.LEVELS[li].name, diff: sim.diff, coins: sim.coins, tips: sim.tips, served: sim.served,
      missed: sim.missed, stars: sim.stars(), line: sim.starLine(), crispy, throws, bumps, helps,
    };
  };

  // every level x both difficulties; ok = every run earned at least one star
  TK.soak = function (o = {}) {
    const runs = [];
    const levels = o.levels || TK.LEVELS.map((_, i) => i);
    for (const li of levels) {
      for (const diff of o.diffs || ['easy', 'normal']) {
        for (let k = 0; k < (o.seeds || 1); k++) runs.push(TK.runLevel(li, { diff, seed: o.seed != null ? o.seed + k : undefined, sabotage: o.sabotage }));
      }
    }
    return { ok: runs.every((r) => r.stars >= 1), runs };
  };
})(typeof window !== 'undefined' ? window : globalThis);
