/* TT Kitchen: the game shell. Screens, input (two chefs on one keyboard, touch sticks and buttons, 1 player with swap),
   the order cards, the companion button, toasts, stars and saving, the title-screen autopilot and the test hooks
   (window.game). The rules live in sim.js and the drawing in view.js. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const LEVELS = TK.LEVELS;
  const NAME = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const cls = (id) => (id === 'teddy' ? 't' : id === 'tommy' ? 'm' : '');
  const sfx = (name, ...a) => { try { TK.sfx[name](...a); } catch (e) { /* sound is optional */ } };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const LEVEL_EMOJI = ['🍔', '🍨', '🥟', '🍕', '🥤', '🚚', '⛸️', '🏞️', '🧊', '🎉'];
  const buddyOf = (id) => { const b = Kit.roster.buddyFor(id); return (b && b.id) || b || (id === 'teddy' ? 'tommy' : 'teddy'); };

  // ---------------------------------------------------------------- saved progress
  // best[diff][i] = { stars, coins }. Kept per browser (index.html and the single page each have their own).
  const SAVE_KEY = 'ttKitchen.v1';
  const save = { best: { easy: {}, normal: {} }, unlockAll: false, mode: '2p', diff: 'easy' };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  save.best.easy = save.best.easy || {};
  save.best.normal = save.best.normal || {};
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } };
  const starsOf = (i, diff) => ((save.best[diff] || {})[i] || {}).stars || 0;
  const unlocked = (i) => save.unlockAll || i <= 1 || starsOf(i - 1, 'easy') > 0 || starsOf(i - 1, 'normal') > 0;

  const G = {
    state: 'title', mode: save.mode === '1p' ? '1p' : '2p', diff: save.diff === 'normal' ? 'normal' : 'easy',
    level: 0, sim: null, team: null, auto: false, attract: false, attractLevel: 0, hold: false, autoPause: true,
    bannerT: 0, touch: false, overT: 0, shown: false, noT: 0,
  };
  let view, faces;

  // ---------------------------------------------------------------- boot
  function boot() {
    document.title = `${TK.TITLE} · Teddy & Tommy`;
    // the display font is all capitals, so the double Ts get the brothers' colours to keep the pun
    $('logo').innerHTML = TK.TITLE.replace(/[&<>]/g, '').replace(/TT/, '<em class="a">T</em><em class="b">T</em>');
    view = new TK.View($('game'));
    faces = Kit.portraits([Kit.roster.get('teddy'), Kit.roster.get('tommy')], { size: 152 });
    $('heroT').src = $('swapT').src = faces.teddy;
    $('heroM').src = $('swapM').src = faces.tommy;
    const q = new URLSearchParams(location.search);
    G.touch = q.get('touch') === '1' || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    resize();
    window.addEventListener('resize', resize);
    bindUi();
    bindKeys();
    bindPads();
    updateMute();
    updateSegs();
    if (q.has('level')) {
      G.mode = q.get('mode') === '1p' ? '1p' : '2p';
      G.diff = q.get('diff') === 'normal' ? 'normal' : 'easy';
      startLevel(Math.max(0, Math.min(LEVELS.length - 1, (+q.get('level') || 1) - 1)));
    } else startAttract();
    requestAnimationFrame(frame);
  }

  function checkSize() {
    if (window.innerWidth && (window.innerWidth !== view.size[0] || window.innerHeight !== view.size[1])) resize();
  }
  function resize() {
    const w = window.innerWidth || document.documentElement.clientWidth || 1024;
    const h = window.innerHeight || document.documentElement.clientHeight || 768;
    layoutInsets(w, h);
    view.resize(w, h);
  }
  // how much of the screen the HUD and buttons cover, so the camera frames the kitchen in the rest
  function layoutInsets(w = view.size[0], h = view.size[1]) {
    const playing = G.state !== 'title' && G.state !== 'select' && !G.attract;
    const small = h <= 520;
    const pads = playing && G.touch && !G.auto;
    view.insets = playing
      ? (pads && !small && w / h < 1.6 // iPad: the pads sit below the kitchen, so it can use the whole width
        ? { top: 128, bottom: 150, left: 10, right: 10 }
        : { top: small ? (h <= 420 ? 70 : 92) : 128, bottom: small ? 46 : pads ? 96 : 60, left: pads ? (small ? 50 : 90) : 10, right: pads ? (small ? 50 : 90) : 10 })
      : { top: 0, bottom: 0, left: 0, right: 0 };
    if (view.sim) view.fit();
  }

  // ---------------------------------------------------------------- levels
  function newSim(i, o = {}) {
    return new TK.Sim(i, { diff: o.diff || G.diff, mode: o.mode || G.mode, buddyFor: buddyOf, seed: o.seed != null ? o.seed : (Math.random() * 1e9) | 0 });
  }
  function startLevel(i, o = {}) {
    G.level = i;
    G.sim = newSim(i, o);
    G.auto = !!o.auto;
    G.team = G.auto ? new TK.Team(G.sim) : null;
    G.attract = false;
    G.state = 'play';
    G.overT = 0;
    G.shown = false;
    showScreen(null);
    $('hud').classList.remove('hidden');
    $('demoBadge').classList.toggle('hidden', !G.auto);
    $('toasts').innerHTML = '';
    clearOrders();
    setupPads();
    layoutInsets();
    view.load(G.sim);
    updateDock();
    hudCache = {};
    if (o.banner !== false && !G.auto) showBanner(i); else hideBanner();
    Kit.sound.music('play');
  }
  function restart() { if (G.sim && !G.attract) startLevel(G.level, { auto: G.auto }); }

  function startAttract() {
    G.attract = true;
    G.state = 'title';
    const i = G.attractLevel % 3;
    G.sim = newSim(i, { diff: 'easy', mode: '2p' });
    G.team = new TK.Team(G.sim);
    G.auto = true;
    $('hud').classList.add('hidden');
    $('pads').classList.add('hidden');
    $('demoBadge').classList.add('hidden');
    $('toasts').innerHTML = '';
    clearOrders();
    hideBanner();
    layoutInsets();
    view.load(G.sim);
    showScreen('title');
    Kit.sound.music('title');
  }
  function showScreen(id) {
    for (const s of ['title', 'select', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id);
  }
  function showSelect() {
    if (!G.attract) startAttractQuiet();
    G.state = 'select';
    hideBanner();
    buildGrid();
    updateSegs();
    showScreen('select');
    layoutInsets();
    Kit.sound.music('title');
  }
  // the kitchen behind the menus keeps cooking by itself
  function startAttractQuiet() { startAttract(); }
  function goTitle() {
    if (!G.attract) startAttract();
    G.state = 'title';
    updateSegs();
    showScreen('title');
  }

  function buildGrid() {
    const grid = $('grid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const open = unlocked(i);
      const st = starsOf(i, G.diff);
      const b = document.createElement('button');
      b.className = 'card' + (open ? '' : ' locked') + (open && !st && (i === 0 || starsOf(i - 1, G.diff) || starsOf(i - 1, 'easy')) ? ' next' : '');
      b.innerHTML = `<span class="n">${i + 1}</span><span class="ic">${LEVEL_EMOJI[i]}</span><span class="nm">${lv.name}</span>` +
        `<span class="st">${[0, 1, 2].map((k) => `<i class="${k < st ? 'on' : ''}">⭐</i>`).join('')}</span>${open ? '' : '<span class="lock">🔒</span>'}`;
      b.addEventListener('click', () => {
        Kit.sound.init();
        if (!open) { sfx('no'); return; }
        sfx('click');
        startLevel(i);
      });
      grid.appendChild(b);
    });
  }
  function updateSegs() {
    for (const b of $('modeSeg').children) b.classList.toggle('on', b.dataset.mode === G.mode);
    for (const seg of ['diffSeg', 'diffSeg2']) for (const b of $(seg).children) b.classList.toggle('on', b.dataset.diff === G.diff);
    $('diffHelp').textContent = G.diff === 'easy' ? 'Easy: nothing gets crispy, and the orders wait longer.' : 'Normal: more orders, and food left on the heat goes crispy!';
  }

  // ---------------------------------------------------------------- banner and toasts
  function keysLine() {
    if (G.touch) return G.mode === '2p' ? 'Teddy: the stick and buttons on the left · Tommy: on the right' : 'The stick walks · ✋ grabs and puts down · 🔪 chops (hold it)';
    return G.mode === '2p' ? 'Teddy: W A S D, F grab, G chop  ·  Tommy: arrows, K grab, L chop' : 'Walk: W A S D or arrows · F grab · G chop · Tab swaps';
  }
  function showBanner(i) {
    const lv = LEVELS[i];
    $('bannerNum').textContent = `KITCHEN ${i + 1}`;
    $('bannerName').textContent = lv.name;
    $('bannerTip').textContent = lv.tip;
    $('bannerMenu').innerHTML = lv.menu.map((r) => `<img src="${TK.icons.url(TK.RECIPES[r].icon)}" alt="">`).join('');
    $('bannerKeys').textContent = keysLine();
    $('banner').classList.remove('hidden');
    G.bannerT = 6;
  }
  function hideBanner() { $('banner').classList.add('hidden'); G.bannerT = 0; }

  function toast(text, c, big) {
    const box = $('toasts');
    while (box.children.length > 2) box.removeChild(box.firstChild);
    const el = document.createElement('div');
    el.className = 'toast' + (c ? ' ' + c : '') + (big ? ' big' : '');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }

  // ---------------------------------------------------------------- the order cards
  let cards = new Map();
  function clearOrders() { $('orders').innerHTML = ''; cards = new Map(); }
  function orderCard(o) {
    const r = TK.RECIPES[o.r];
    const el = document.createElement('div');
    el.className = 'order';
    const parts = r.parts.map((k) => {
      const [ing, st] = k.split(':');
      const steps = [];
      let s = 'raw';
      while (s !== st && TK.ING[ing].steps[s]) { steps.push(TK.ING[ing].steps[s][0]); s = TK.ING[ing].steps[s][1]; }
      return `<span class="part"><img src="${TK.icons.url(ing + ':raw')}" alt=""><b class="steps">${steps.map((x) => `<img src="${TK.icons.url('step:' + x)}" alt="">`).join('')}</b></span>`;
    }).join('');
    el.innerHTML = `<div class="tbar"><i></i></div><img class="dish" src="${TK.icons.url(r.icon)}" alt=""><div class="parts">${parts}</div>`;
    el.title = r.name;
    return el;
  }
  function syncOrders() {
    const sim = G.sim, box = $('orders');
    const live = new Set();
    for (const o of sim.orders) {
      live.add(o.id);
      let c = cards.get(o.id);
      if (!c) { c = { el: orderCard(o), bar: null, cls: '' }; c.bar = c.el.querySelector('.tbar i'); box.appendChild(c.el); cards.set(o.id, c); }
      const k = Math.max(0, o.t / o.max);
      c.bar.style.transform = `scaleX(${k.toFixed(3)})`;
      const want = k < 0.25 ? 'hurry' : k < 0.5 ? 'warn' : '';
      if (want !== c.cls) {
        c.el.classList.remove('hurry', 'warn');
        if (want) c.el.classList.add(want);
        c.cls = want;
      }
    }
    for (const [id, c] of cards) {
      if (live.has(id)) continue;
      cards.delete(id);
      c.el.classList.add('gone');
      setTimeout(() => c.el.remove(), 380);
    }
  }

  // ---------------------------------------------------------------- the loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    checkSize();
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!G.hold) tick(dt, true);
  }
  function tick(dt, render) {
    const sim = G.sim;
    if (!sim) return;
    const running = G.state === 'play' || G.state === 'over' || G.attract;
    if (G.bannerT > 0 && G.state === 'play') {
      G.bannerT -= dt;
      if (G.bannerT <= 0) hideBanner();
    }
    const cooking = running && !sim.over && !(G.bannerT > 0 && G.state === 'play');
    if (cooking) {
      const inp = G.team ? G.team.inputs(dt) : readInput();
      clearEdges();
      sim.step(dt, inp);
      handleEvents();
      if (G.attract && (sim.time > 75 || sim.over)) { G.attractLevel++; startAttract(); return; }
    }
    if (sim.over && G.state === 'play') {
      handleEvents();
      G.state = 'over';
      G.overT = 0;
      toast("TIME'S UP!", '', true);
      sfx('timeup');
      Kit.sound.music('over');
    }
    if (G.state === 'over') {
      G.overT += dt;
      if (G.overT > 1.8 && !G.shown) showResults();
    }
    if (G.noT > 0) G.noT -= dt;
    view.sync(sim, running ? dt : 0, { demo: G.attract || G.auto });
    if (render) view.render();
    if (!G.attract) { updateHud(); syncOrders(); }
  }

  function handleEvents() {
    const sim = G.sim;
    for (const e of sim.events) {
      view.event(e);
      if (G.attract) continue;
      const human = !G.auto && e.by && e.by !== 'helper';
      switch (e.type) {
        case 'chop': sfx('chop'); break;
        case 'chopped': sfx('chopped'); break;
        case 'grab': sfx('grab'); break;
        case 'place': sfx('place'); break;
        case 'plate': sfx('plate'); break;
        case 'bin': sfx('bin'); break;
        case 'done': sfx('done'); break;
        case 'crispy': sfx('crispy'); break;
        case 'serve': sfx('serve', e.tip); popPill(); break;
        case 'order': sfx('order'); break;
        case 'expire': sfx('expire'); break;
        case 'scrub': sfx('scrub'); break;
        case 'washed': sfx('washed'); break;
        case 'plateback': sfx('plateback'); break;
        case 'throw': sfx('throw'); break;
        case 'land': sfx('land'); break;
        case 'catch': sfx('catch'); toast('NICE CATCH!', cls(e.by)); break;
        case 'splash': sfx('splash'); break;
        case 'swap': sfx('swap'); updateDock(); break;
        case 'bumpwarn': sfx('bumpwarn'); toast('🚧 BUMP AHEAD! 🚧'); break;
        case 'bump': sfx('bump'); break;
        case 'no':
          sfx('no');
          if (human && G.noT <= 0 && e.why) { toast(e.why === 'notdone' ? 'NOT FINISHED YET!' : 'NOBODY ORDERED THAT!'); G.noT = 2; }
          break;
        case 'helperIn': sfx('helper'); updateDock(); break;
        case 'helperOut': updateDock(); break;
        case 'saved': sfx('saved'); toast(`${NAME[e.who]} SAVED THE ORDER!`, cls(e.who), true); flashSaved(); break;
        case 'treat': sfx('treat'); toast(`${e.emoji} ${e.name} FROM ${NAME[e.who]}!`, cls(e.who)); break;
        case 'highfive': sfx('highfive'); toast('✋ HIGH FIVE! SPEED BOOST!', 'g'); break;
        default: break;
      }
    }
    sim.events.length = 0;
  }
  function flashSaved() {
    setTimeout(() => {
      for (const c of cards.values()) { c.el.classList.remove('saved'); void c.el.offsetWidth; c.el.classList.add('saved'); }
    }, 0);
  }
  function popPill() {
    const p = $('coinPill');
    p.classList.remove('pop');
    void p.offsetWidth;
    p.classList.add('pop');
  }

  // ---------------------------------------------------------------- results
  function showResults() {
    G.shown = true;
    const sim = G.sim, line = sim.starLine(), stars = sim.stars();
    const b = save.best[sim.diff][G.level] || { stars: 0, coins: 0 };
    if (!G.auto && (stars > b.stars || sim.coins > b.coins)) {
      save.best[sim.diff][G.level] = { stars: Math.max(stars, b.stars), coins: Math.max(sim.coins, b.coins) };
      persist();
    }
    $('resTitle').textContent = ['TIME\'S UP!', 'YOU DID IT!', 'GREAT COOKING!', 'AMAZING CHEFS!'][stars];
    for (let k = 0; k < 3; k++) {
      $('star' + k).classList.remove('on');
      $('star' + k + 't').textContent = `🪙 ${line[k]}`;
      if (k < stars) setTimeout(() => { $('star' + k).classList.add('on'); sfx('star', k); }, 350 + k * 380);
    }
    $('resCoins').textContent = `🪙 ${sim.coins} coins`;
    $('resServed').textContent = `${sim.served} ${sim.served === 1 ? 'dish' : 'dishes'} served`;
    $('resTips').textContent = `${sim.tips} in tips`;
    const hasNext = G.level < LEVELS.length - 1;
    $('rNext').textContent = stars > 0 && hasNext ? 'NEXT ▶' : stars > 0 ? '☰ KITCHENS' : '↻ TRY AGAIN';
    showScreen('results');
    G.state = 'results';
    $('hud').classList.add('hidden');
    $('pads').classList.add('hidden');
    $('demoBadge').classList.add('hidden');
  }
  function resultsNext() {
    sfx('click');
    const stars = G.sim.stars();
    if (stars > 0 && G.level < LEVELS.length - 1) startLevel(G.level + 1);
    else if (stars > 0) showSelect();
    else startLevel(G.level);
  }

  function pause() {
    if (G.state !== 'play') return;
    G.state = 'paused';
    showScreen('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = 'play';
    showScreen(null);
    Kit.sound.music('play');
  }

  // ---------------------------------------------------------------- HUD
  let hudCache = {};
  const setText = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
  function updateHud() {
    const sim = G.sim;
    const left = Math.max(0, sim.duration - sim.time);
    setText('timer', fmt(Math.ceil(left)));
    const low = left < 20 && !sim.over;
    if (hudCache.low !== low) { hudCache.low = low; $('timePill').classList.toggle('low', low); }
    setText('coins', String(sim.coins));
    const busy = sim.helper.on;
    if (hudCache.busy !== busy) { hudCache.busy = busy; $('buddyBtn').classList.toggle('busy', busy); }
  }
  function updateDock() {
    const sim = G.sim;
    if (!sim) return;
    const two = sim.mode === '2p';
    $('swapBtn').style.display = two ? 'none' : '';
    $('swapT').classList.toggle('on', sim.active === 'teddy');
    $('swapM').classList.toggle('on', sim.active === 'tommy');
    const b = $('buddyBtn');
    if (two) {
      b.className = 'buddybtn both';
      $('buddyFaces').innerHTML = `<img src="${faces.teddy}" alt=""><img src="${faces.tommy}" alt="">`;
      $('buddyLabel').textContent = 'HIGH FIVE!';
      b.title = 'High five: a speed boost for both (T)';
    } else {
      const who = sim.helper.on ? sim.helper.who : buddyOf(sim.active);
      b.className = 'buddybtn ' + cls(who) + (sim.helper.on ? ' busy' : '');
      $('buddyFaces').innerHTML = `<img src="${faces[who]}" alt="">`;
      $('buddyLabel').textContent = `CALL ${NAME[who]}`;
      b.title = 'Call your brother (T)';
    }
    hudCache.busy = undefined;
  }

  // ---------------------------------------------------------------- input
  const keys = new Set();
  const touch = new Set();
  const sticks = { t: { x: 0, z: 0 }, m: { x: 0, z: 0 }, p: { x: 0, z: 0 } };
  const edges = { teddy: { grab: false, use: false }, tommy: { grab: false, use: false } };
  const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyK', 'KeyL']);
  const GRAB1 = ['KeyF', 'KeyK', 'Space', 'KeyE'], USE1 = ['KeyG', 'KeyL', 'KeyJ', 'KeyQ'];
  const has = (c) => keys.has(c);
  const axis = (n, p) => (has(n) ? -1 : 0) + (has(p) ? 1 : 0);
  function clearEdges() { for (const id in edges) edges[id].grab = edges[id].use = false; }
  function readInput() {
    const sim = G.sim;
    if (sim.mode === '2p') {
      return {
        teddy: { mx: axis('KeyA', 'KeyD') + sticks.t.x, mz: axis('KeyW', 'KeyS') + sticks.t.z, grab: edges.teddy.grab, useEdge: edges.teddy.use, use: has('KeyG') || touch.has('t-use') },
        tommy: { mx: axis('ArrowLeft', 'ArrowRight') + sticks.m.x, mz: axis('ArrowUp', 'ArrowDown') + sticks.m.z, grab: edges.tommy.grab, useEdge: edges.tommy.use, use: has('KeyL') || touch.has('m-use') },
      };
    }
    const id = sim.active;
    return {
      [id]: {
        mx: Math.max(-1, Math.min(1, axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight'))) + sticks.p.x,
        mz: Math.max(-1, Math.min(1, axis('KeyW', 'KeyS') + axis('ArrowUp', 'ArrowDown'))) + sticks.p.z,
        grab: edges[id].grab, useEdge: edges[id].use, use: USE1.some(has) || touch.has('p-use'),
      },
    };
  }
  function moving() {
    for (const c of ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) if (keys.has(c)) return true;
    return false;
  }
  function edge(code) {
    const sim = G.sim;
    if (!sim || G.state !== 'play') return;
    if (sim.mode === '2p') {
      if (code === 'KeyF') edges.teddy.grab = true;
      if (code === 'KeyG') edges.teddy.use = true;
      if (code === 'KeyK') edges.tommy.grab = true;
      if (code === 'KeyL') edges.tommy.use = true;
    } else {
      if (GRAB1.includes(code)) edges[sim.active].grab = true;
      if (USE1.includes(code)) edges[sim.active].use = true;
    }
  }
  function bindKeys() {
    window.addEventListener('keydown', (e) => {
      Kit.sound.init();
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      keys.add(e.code);
      if (e.repeat) return;
      if (G.state === 'play' && G.auto && !['KeyP', 'Escape', 'KeyM'].includes(e.code)) { stopAuto(); return; }
      if (G.state === 'play' && G.bannerT > 0 && (moving() || GRAB1.includes(e.code) || USE1.includes(e.code))) G.bannerT = Math.min(G.bannerT, 0.3);
      edge(e.code);
      switch (e.code) {
        case 'Tab': if (G.state === 'play' && G.sim) G.sim.swap(); break;
        case 'KeyT': if (G.state === 'play') callCompanion(); break;
        case 'KeyP': case 'Escape':
          if (G.state === 'play') pause();
          else if (G.state === 'paused') resume();
          else if (G.state === 'select') goTitle();
          break;
        case 'KeyR': if (G.state === 'play' || G.state === 'over' || G.state === 'results') restart(); break;
        case 'KeyM': toggleMute(); break;
        case 'Enter': case 'Space':
          if (G.state === 'title') { sfx('click'); showSelect(); }
          else if (G.state === 'paused') resume();
          else if (G.state === 'results') resultsNext();
          break;
        default: break;
      }
    });
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => { keys.clear(); touch.clear(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        keys.clear();
        if (G.autoPause && G.state === 'play' && !G.auto) pause();
        Kit.sound.suspend();
      } else Kit.sound.resume();
    });
  }
  function callCompanion() {
    if (!G.sim || G.state !== 'play') return;
    Kit.sound.init();
    G.sim.call();
    handleEvents();
    updateDock();
  }
  function stopAuto() {
    G.auto = false;
    G.team = null;
    $('demoBadge').classList.add('hidden');
    setupPads();
    layoutInsets();
  }

  // Touch: each chef gets a stick (walk) and two buttons (✋ grab / put down, 🔪 chop, wash or throw).
  function setupPads() {
    const two = G.sim && G.sim.mode === '2p';
    const stick = (who) => `<div class="stick ${who}" data-stick="${who}"><i></i></div>`;
    const btns = (who) => `<div class="tbtns"><button class="tbtn ${who}" data-ctl="${who}-grab">✋</button><button class="tbtn ${who}" data-ctl="${who}-use">🔪</button></div>`;
    if (two) {
      $('padL').innerHTML = `<div class="padlabel">TEDDY</div>${stick('t')}${btns('t')}`;
      $('padR').innerHTML = `<div class="padlabel" style="left:auto;right:0">TOMMY</div>${btns('m')}${stick('m')}`;
    } else {
      $('padL').innerHTML = stick('p');
      $('padR').innerHTML = btns('p');
    }
    $('pads').classList.toggle('hidden', !(G.touch && !G.auto && G.state === 'play'));
    touch.clear();
    for (const k in sticks) sticks[k].x = sticks[k].z = 0;
    pointers.clear();
  }
  const pointers = new Map();
  function bindPads() {
    const chefOf = (who) => (who === 't' ? 'teddy' : who === 'm' ? 'tommy' : G.sim.active);
    const moveStick = (p, e) => {
      const r = p.el.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), z = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(x, z);
      if (l > 1) { x /= l; z /= l; }
      const dead = Math.hypot(x, z) < 0.18;
      sticks[p.who].x = dead ? 0 : x;
      sticks[p.who].z = dead ? 0 : z;
      p.el.firstChild.style.transform = `translate(${x * r.width * 0.3}px, ${z * r.height * 0.3}px)`;
      if (!dead && G.bannerT > 0) G.bannerT = Math.min(G.bannerT, 0.3);
    };
    $('pads').addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      const el = e.target.closest && e.target.closest('[data-stick],[data-ctl]');
      if (!el || G.state !== 'play') return;
      e.preventDefault();
      if (el.dataset.stick) {
        const p = { el, who: el.dataset.stick, stick: true };
        pointers.set(e.pointerId, p);
        moveStick(p, e);
        return;
      }
      const ctl = el.dataset.ctl, [who, act] = ctl.split('-');
      pointers.set(e.pointerId, { el, ctl });
      touch.add(ctl);
      el.classList.add('down');
      const id = chefOf(who);
      if (act === 'grab') edges[id].grab = true; else edges[id].use = true;
      if (G.bannerT > 0) G.bannerT = Math.min(G.bannerT, 0.3);
    });
    window.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (p && p.stick) moveStick(p, e);
    });
    const up = (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      if (p.stick) { sticks[p.who].x = sticks[p.who].z = 0; p.el.firstChild.style.transform = ''; }
      else { touch.delete(p.ctl); p.el.classList.remove('down'); }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    // the first touch anywhere shows the pads on devices that didn't say they had touch
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !G.touch) {
        G.touch = true;
        if (G.state === 'play') { setupPads(); layoutInsets(); }
      }
    }, true);
  }

  // ---------------------------------------------------------------- buttons
  function tap(id, fn) {
    $(id).addEventListener('click', (e) => { e.preventDefault(); Kit.sound.init(); fn(e); $(id).blur(); });
  }
  function fastTap(id, fn) { // in-game buttons react on press, not release
    $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Kit.sound.init(); fn(e); });
  }
  function bindUi() {
    const setMode = (m) => { G.mode = m; save.mode = m; persist(); sfx('click'); updateSegs(); };
    const setDiff = (d) => { G.diff = d; save.diff = d; persist(); sfx('click'); updateSegs(); if (G.state === 'select') buildGrid(); };
    tap('play1', () => { setMode('1p'); showSelect(); });
    tap('play2', () => { setMode('2p'); showSelect(); });
    for (const b of $('modeSeg').children) b.addEventListener('click', () => { Kit.sound.init(); setMode(b.dataset.mode); });
    for (const seg of ['diffSeg', 'diffSeg2']) for (const b of $(seg).children) b.addEventListener('click', () => { Kit.sound.init(); setDiff(b.dataset.diff); });
    tap('backTitle', () => { sfx('click'); goTitle(); });
    tap('unlockAll', () => { save.unlockAll = !save.unlockAll; persist(); sfx('click'); buildGrid(); });
    fastTap('buddyBtn', callCompanion);
    fastTap('swapBtn', () => { if (G.sim && G.state === 'play') G.sim.swap(); handleEvents(); });
    fastTap('pauseBtn', () => (G.state === 'play' ? pause() : resume()));
    fastTap('restartBtn', () => { sfx('click'); restart(); });
    fastTap('muteBtn', toggleMute);
    tap('muteBtn2', toggleMute);
    tap('muteBtn3', toggleMute);
    tap('resume', resume);
    tap('pRestart', () => { sfx('click'); startLevel(G.level); });
    tap('pLevels', () => { sfx('click'); showSelect(); });
    tap('pTitle', () => { sfx('click'); goTitle(); });
    tap('rNext', resultsNext);
    tap('rAgain', () => { sfx('click'); startLevel(G.level); });
    tap('rLevels', () => { sfx('click'); showSelect(); });
    $('game').addEventListener('pointerdown', () => { Kit.sound.init(); if (G.auto && G.state === 'play') stopAuto(); });
  }
  function toggleMute() {
    Kit.sound.init();
    Kit.sound.toggleMute();
    updateMute();
  }
  function updateMute() {
    const m = Kit.sound.isMuted() ? '🔇' : '🔊';
    for (const id of ['muteBtn', 'muteBtn2', 'muteBtn3']) $(id).textContent = m;
  }

  // ---------------------------------------------------------------- test hooks
  // The Browser pane throttles requestAnimationFrame when it's hidden, so tests drive the game with step().
  window.game = {
    G, LEVELS,
    get sim() { return G.sim; },
    get view() { return view; },
    // start(level 1-10, { mode: '1p' | '2p', diff: 'easy' | 'normal', auto: true for the bots, banner: false })
    start(i = 1, o = {}) {
      if (o.mode) G.mode = o.mode;
      if (o.diff) G.diff = o.diff;
      startLevel(i - 1, o);
      return this.state();
    },
    step(seconds = 1 / 60, opts = {}) {
      checkSize();
      const n = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < n; i++) tick(1 / 60, opts.render !== false && i === n - 1);
      return this.state();
    },
    // the headless soak: two bots on every level, EASY and NORMAL (see js/soak.js)
    soak: (o) => TK.soak(o),
    autopilot(on = true) { if (on) { G.auto = true; G.team = new TK.Team(G.sim); $('demoBadge').classList.remove('hidden'); setupPads(); } else stopAuto(); },
    finish() { if (G.sim) { G.sim.time = G.sim.duration; } return this.step(1 / 60); },
    hold(on = true) { G.hold = on; return G.hold; },
    keepAwake() { G.autoPause = false; },
    press(code, down = true) { if (down) { keys.add(code); edge(code); } else keys.delete(code); },
    touch(ctl, down = true) { if (down) touch.add(ctl); else touch.delete(ctl); },
    call: () => callCompanion(),
    swap: () => { G.sim.swap(); handleEvents(); },
    pause, resume, restart, title: goTitle, select: showSelect, results: showResults,
    state() {
      const s = G.sim;
      if (!s) return { state: G.state };
      const c = (id) => ({ x: +s.chefs[id].x.toFixed(2), z: +s.chefs[id].z.toFixed(2), held: s.chefs[id].held ? (s.chefs[id].held.ing || s.chefs[id].held.k) + ':' + (s.chefs[id].held.st || s.chefs[id].held.parts || s.chefs[id].held.n) : null });
      return {
        state: G.state, level: G.level + 1, name: s.def.name, mode: s.mode, diff: s.diff, active: s.active, time: +s.time.toFixed(1),
        over: s.over, coins: s.coins, tips: s.tips, served: s.served, missed: s.missed, stars: s.stars(), orders: s.orders.map((o) => o.r + ' ' + Math.ceil(o.t) + 's'),
        teddy: c('teddy'), tommy: c('tommy'), helper: s.helper.on ? { who: s.helper.who, phase: s.helper.phase, task: s.helper.task && s.helper.task.kind } : null,
        attract: G.attract, auto: G.auto, banner: G.bannerT > 0,
      };
    },
    save,
  };

  boot();
})();
