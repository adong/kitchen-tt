/* TT Kitchen: the rules. The kitchen grid, the two chefs, food, plates, orders, coins and tips, the companion and
   the silly kitchens (split counters, conveyor belt, truck, ice, river). No Three.js here: view.js draws it,
   game.js drives it, and tools/soak.js runs it headlessly in node with two bots (bot.js). */
(function (root) {
  'use strict';
  const TK = root.TK;
  const { ING, RECIPES, TIMES, DIFF, CRATES } = TK;

  const KIND = {
    '#': 'wall', '~': 'water', '.': 'floor', '1': 'floor', '2': 'floor', ' ': 'floor',
    C: 'counter', B: 'board', P: 'pan', O: 'pot', V: 'oven', X: 'blend', S: 'sink', L: 'rack', R: 'return', W: 'window', T: 'bin',
    '>': 'belt', '<': 'belt', '^': 'belt', v: 'belt',
  };
  const BELT = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };
  const STATIONS = new Set(['pan', 'pot', 'oven', 'blend']);
  const HOLDERS = new Set(['counter', 'board', 'belt', 'pan', 'pot', 'oven', 'blend']);
  const IDS = ['teddy', 'tommy'];
  const RADIUS = 0.3, SPEED = 4.2, BELT_SPEED = 1.1, THROW_SPEED = 9, THROW_RANGE = 5.5;
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const NONE = { mx: 0, mz: 0 };

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  let uid = 1;
  const ingItem = (ing, st = 'raw') => ({ k: 'ing', ing, st, id: uid++, work: 0 });
  const plateItem = () => ({ k: 'plate', parts: [], id: uid++ });
  const dirtyItem = (n) => ({ k: 'dirty', n, id: uid++ });
  const keyOf = (it) => it.ing + ':' + it.st;
  const nextStep = (it) => (it && it.k === 'ing' && it.st !== 'crispy' ? ING[it.ing].steps[it.st] || null : null);
  // how many steps from state `from` to state `to` (-1 if it can't get there)
  function stepsTo(ing, from, to) {
    let s = from, n = 0;
    while (s !== to) {
      const st = ING[ing].steps[s];
      if (!st) return -1;
      s = st[1];
      n++;
    }
    return n;
  }
  const other = (id) => (id === 'teddy' ? 'tommy' : 'teddy');

  class Sim {
    constructor(levelIndex, o = {}) {
      this.li = levelIndex;
      this.def = TK.LEVELS[levelIndex];
      this.diff = o.diff === 'normal' ? 'normal' : 'easy';
      this.D = DIFF[this.diff];
      this.mode = o.mode === '1p' ? '1p' : '2p';
      this.buddyFor = o.buddyFor || other;
      this.rand = rng(o.seed != null ? o.seed : levelIndex * 7919 + (this.diff === 'normal' ? 101 : 13));
      this.duration = o.duration || TIMES.levelTime;
      this.time = 0;
      this.over = false;
      this.coins = 0; this.tips = 0; this.served = 0; this.missed = 0; this.saves = 0;
      this.orders = [];
      this.orderClock = 1.2;
      this.lastOrder = null;
      this.events = [];
      this.flying = [];
      this.loose = [];
      this.returns = [];
      this.active = 'teddy';
      this.bumpT = 8;
      this.bumpWarned = false;
      this.fiveCool = 0;
      this.parse();
      this.helper = { on: false, who: null, x: 0, z: 0, phase: '', t: 0, tasks: 0, task: null, carry: null, fx: 0, fz: -1, moving: false };
    }

    // ------------------------------------------------------------------ the map
    parse() {
      const rows = this.def.map;
      this.H = rows.length;
      this.W = rows[0].length;
      this.tiles = [];
      this.holders = []; this.stations = []; this.boards = []; this.belts = []; this.crates = [];
      this.racks = []; this.sinks = []; this.returnsT = []; this.windows = []; this.bins = [];
      const spawn = {};
      for (let z = 0; z < this.H; z++) {
        for (let x = 0; x < this.W; x++) {
          const ch = rows[z][x] || '#';
          const kind = CRATES[ch] ? 'crate' : KIND[ch] || 'wall';
          const t = { x, z, ch, kind, item: null, n: 0, work: 0, t: 0, over: 0, bp: 0.5, regions: new Set(), access: [] };
          t.act = !['floor', 'wall', 'water'].includes(kind);
          if (kind === 'crate') { t.ing = CRATES[ch]; this.crates.push(t); }
          if (kind === 'belt') { t.dir = BELT[ch]; this.belts.push(t); }
          if (HOLDERS.has(kind)) this.holders.push(t);
          if (STATIONS.has(kind)) this.stations.push(t);
          if (kind === 'board') this.boards.push(t);
          if (kind === 'rack') this.racks.push(t);
          if (kind === 'sink') this.sinks.push(t);
          if (kind === 'return') this.returnsT.push(t);
          if (kind === 'window') this.windows.push(t);
          if (kind === 'bin') this.bins.push(t);
          if (ch === '1') spawn.teddy = [x + 0.5, z + 0.5];
          if (ch === '2') spawn.tommy = [x + 0.5, z + 0.5];
          this.tiles.push(t);
        }
      }
      const plates = this.def.plates + (this.diff === 'easy' ? 1 : 0);
      if (this.racks[0]) this.racks[0].n = plates;
      // floor regions (the halves of a split kitchen), and which floor cells reach each counter
      this.region = new Int16Array(this.W * this.H).fill(-1);
      let rid = 0;
      for (const t of this.tiles) {
        if (t.kind !== 'floor' || this.region[t.z * this.W + t.x] >= 0) continue;
        const q = [t];
        this.region[t.z * this.W + t.x] = rid;
        while (q.length) {
          const a = q.pop();
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const b = this.tile(a.x + dx, a.z + dz);
            if (b && b.kind === 'floor' && this.region[b.z * this.W + b.x] < 0) { this.region[b.z * this.W + b.x] = rid; q.push(b); }
          }
        }
        rid++;
      }
      this.regionCount = rid;
      for (const t of this.tiles) {
        if (!t.act) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const b = this.tile(t.x + dx, t.z + dz);
          if (b && b.kind === 'floor') {
            const r = this.region[b.z * this.W + b.x];
            t.access.push({ x: b.x, z: b.z, r });
            t.regions.add(r);
          }
        }
      }
      const mk = (id) => {
        const [x, z] = spawn[id] || [this.W / 2, this.H / 2];
        return { id, x, z, vx: 0, vz: 0, fx: 0, fz: -1, held: null, target: null, working: null, autoWork: false, boost: 0, push: null, chopTick: 0, act: 0 };
      };
      this.chefs = { teddy: mk('teddy'), tommy: mk('tommy') };
    }

    tile(x, z) { return x >= 0 && z >= 0 && x < this.W && z < this.H ? this.tiles[z * this.W + x] : null; }
    tileAt(x, z) { return this.tile(Math.floor(x), Math.floor(z)); }
    solid(x, z) { const t = this.tile(x, z); return !t || t.kind !== 'floor'; }
    regionAt(x, z) { const t = this.tileAt(x, z); return t && t.kind === 'floor' ? this.region[t.z * this.W + t.x] : -1; }
    emit(type, data) { this.events.push(Object.assign({ type }, data)); }

    // ------------------------------------------------------------------ recipes and plates
    dishOf(plate) {
      if (!plate || plate.k !== 'plate' || !plate.parts.length) return null;
      for (const r of this.def.menu) {
        const p = RECIPES[r].parts;
        if (p.length === plate.parts.length && p.every((k) => plate.parts.includes(k))) return r;
      }
      return null;
    }
    accepts(plate, it) {
      if (!plate || plate.k !== 'plate' || !it || it.k !== 'ing' || it.st === 'crispy') return false;
      const k = keyOf(it);
      if (plate.parts.includes(k)) return false;
      const want = plate.parts.concat(k);
      return this.def.menu.some((r) => want.every((w) => RECIPES[r].parts.includes(w)));
    }
    // is this ingredient (in this state) part of any recipe on the menu, or on its way to one?
    useful(it) {
      if (!it || it.k !== 'ing' || it.st === 'crispy') return false;
      return this.def.menu.some((r) => RECIPES[r].parts.some((k) => { const [ing, st] = k.split(':'); return ing === it.ing && stepsTo(ing, it.st, st) >= 0; }));
    }

    // ------------------------------------------------------------------ the tick
    step(dt, inp = {}) {
      if (this.over) return;
      this.time += dt;
      this.updateOrders(dt);
      for (const id of IDS) {
        const c = this.chefs[id];
        let i = inp[id] || NONE;
        if (this.mode === '1p' && id !== this.active) i = NONE;
        this.updateChef(c, i, dt);
      }
      this.collideChefs();
      this.updateStations(dt);
      this.updateBelts(dt);
      this.updateFlying(dt);
      this.updateReturns(dt);
      this.updateHelper(dt);
      if (this.def.truck) this.updateTruck(dt);
      if (this.fiveCool > 0) this.fiveCool -= dt;
      if (this.time >= this.duration) {
        this.over = true;
        this.emit('timeup');
      }
    }

    // ------------------------------------------------------------------ orders
    updateOrders(dt) {
      for (let i = this.orders.length - 1; i >= 0; i--) {
        const o = this.orders[i];
        o.t -= dt;
        o.age += dt;
        if (o.t <= 0) {
          this.orders.splice(i, 1);
          this.missed++;
          this.emit('expire', { r: o.r });
        }
      }
      if (this.time > this.duration - 6) return; // no new orders in the last few seconds
      this.orderClock -= dt;
      if (this.orders.length < this.D.keep && this.orderClock > (this.orders.length ? 5 : 2)) this.orderClock = this.orders.length ? 5 : 2;
      if (this.orderClock <= 0 && this.orders.length < this.D.maxOrders) {
        this.spawnOrder();
        this.orderClock = this.D.every;
      }
    }
    spawnOrder() {
      const menu = this.def.menu;
      let r = menu[Math.floor(this.rand() * menu.length)];
      if (menu.length > 1 && r === this.lastOrder && this.rand() < 0.6) r = menu[(menu.indexOf(r) + 1) % menu.length];
      this.lastOrder = r;
      const max = TK.orderTime(r) * this.D.orderTime;
      const o = { id: uid++, r, t: max, max, age: 0 };
      this.orders.push(o);
      this.emit('order', { r });
      return o;
    }
    serve(plate, x, z, by) {
      const dish = this.dishOf(plate);
      if (!dish) { this.emit('no', { why: 'notdone', x, z, by }); return false; }
      let o = null;
      for (const q of this.orders) if (q.r === dish && (!o || q.t < o.t)) o = q;
      if (!o) { this.emit('no', { why: 'notordered', x, z, by }); return false; }
      const value = RECIPES[dish].value;
      const tip = Math.round(value * 0.5 * Math.max(0, Math.min(1, o.t / o.max)));
      this.coins += value + tip;
      this.tips += tip;
      this.served++;
      this.orders.splice(this.orders.indexOf(o), 1);
      this.returns.push({ t: TIMES.plateBack });
      this.emit('serve', { r: dish, value, tip, x, z, by });
      if (!this.orders.length) this.orderClock = Math.min(this.orderClock, 2.5);
      return true;
    }
    updateReturns(dt) {
      for (let i = this.returns.length - 1; i >= 0; i--) {
        const r = this.returns[i];
        r.t -= dt;
        if (r.t > 0) continue;
        this.returns.splice(i, 1);
        const t = this.returnsT[0] || this.sinks[0];
        if (t) { t.n++; this.emit('plateback', { x: t.x + 0.5, z: t.z + 0.5 }); } else if (this.racks[0]) this.racks[0].n++;
      }
    }
    stars() {
      const s = this.starLine();
      return s.filter((v) => this.coins >= v).length;
    }
    starLine() { return this.def.stars.map((v) => Math.round(v * this.D.starScale / 5) * 5); }

    // ------------------------------------------------------------------ chefs
    updateChef(c, i, dt) {
      let mx = i.mx || 0, mz = i.mz || 0;
      const m = Math.hypot(mx, mz);
      if (m > 1) { mx /= m; mz /= m; }
      if (m > 0.12) { c.fx = mx / m; c.fz = mz / m; }
      if (c.boost > 0) c.boost -= dt;
      const sp = SPEED * (c.boost > 0 ? 1.4 : 1);
      const ice = !!this.def.ice;
      const acc = ice ? (m > 0.12 ? 7 : 2.2) : 40;
      let dx = mx * sp - c.vx, dz = mz * sp - c.vz;
      const dl = Math.hypot(dx, dz), a = acc * dt;
      if (dl > a) { dx *= a / dl; dz *= a / dl; }
      c.vx += dx;
      c.vz += dz;
      let px = 0, pz = 0;
      if (c.push) {
        px = c.push.vx; pz = c.push.vz;
        c.push.t -= dt;
        if (c.push.t <= 0) c.push = null;
      }
      c.x += (c.vx + px) * dt;
      c.z += (c.vz + pz) * dt;
      this.collide(c);
      c.target = this.findTarget(c);
      if (c.act > 0) c.act -= dt;
      if (i.grab) this.interact(c);
      if (i.useEdge && c.held) this.tryThrow(c);
      c.working = null;
      const use = i.use || c.autoWork;
      if (use && !c.held) this.work(c, dt);
      if (c.autoWork && !c.working) c.autoWork = false;
    }

    collide(c) {
      for (let pass = 0; pass < 2; pass++) {
        const cx = Math.floor(c.x), cz = Math.floor(c.z);
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const bx = cx + dx, bz = cz + dz;
            if (!this.solid(bx, bz)) continue;
            const qx = Math.max(bx, Math.min(bx + 1, c.x)), qz = Math.max(bz, Math.min(bz + 1, c.z));
            let nx = c.x - qx, nz = c.z - qz;
            const d = Math.hypot(nx, nz);
            if (d >= RADIUS) continue;
            if (d < 1e-6) { // the centre got inside: push out the short way
              const opts = [[c.x - bx, -1, 0], [bx + 1 - c.x, 1, 0], [c.z - bz, 0, -1], [bz + 1 - c.z, 0, 1]].sort((p, q) => p[0] - q[0]);
              nx = opts[0][1]; nz = opts[0][2];
              c.x += nx * (opts[0][0] + RADIUS);
              c.z += nz * (opts[0][0] + RADIUS);
            } else {
              nx /= d; nz /= d;
              c.x += nx * (RADIUS - d);
              c.z += nz * (RADIUS - d);
            }
            const vn = c.vx * nx + c.vz * nz;
            if (vn < 0) { c.vx -= vn * nx; c.vz -= vn * nz; }
          }
        }
      }
    }

    collideChefs() {
      const a = this.chefs.teddy, b = this.chefs.tommy;
      let dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d >= RADIUS * 2 || d < 1e-6) return;
      dx /= d; dz /= d;
      const p = (RADIUS * 2 - d) / 2;
      a.x -= dx * p; a.z -= dz * p;
      b.x += dx * p; b.z += dz * p;
      this.collide(a);
      this.collide(b);
    }

    // the counter (or station, crate...) the chef is facing
    findTarget(c) {
      const cx = Math.floor(c.x), cz = Math.floor(c.z);
      const px = c.x + c.fx * 0.62, pz = c.z + c.fz * 0.62;
      let best = null, bd = 0.95;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const t = this.tile(cx + dx, cz + dz);
          if (!t || !t.act) continue;
          const d = Math.hypot(t.x + 0.5 - px, t.z + 0.5 - pz);
          if (d < bd) { bd = d; best = t; }
        }
      }
      return best;
    }

    nearLoose(c) {
      const px = c.x + c.fx * 0.3, pz = c.z + c.fz * 0.3;
      let best = null, bd = 0.75;
      for (const l of this.loose) {
        const d = Math.hypot(l.x - px, l.z - pz);
        if (d < bd) { bd = d; best = l; }
      }
      return best;
    }

    interact(c) {
      const t = c.target, h = c.held;
      const ok = (type = 'place') => { c.act = 0.25; this.emit(type, { x: t ? t.x + 0.5 : c.x, z: t ? t.z + 0.5 : c.z, by: c.id }); };
      const no = () => this.emit('no', { x: c.x, z: c.z, by: c.id });
      if (!h) {
        const l = this.nearLoose(c);
        if (l) { this.loose.splice(this.loose.indexOf(l), 1); c.held = l.item; ok('grab'); return; }
      }
      if (!t) {
        if (h) { // drop it on the floor in front
          const x = c.x + c.fx * 0.45, z = c.z + c.fz * 0.45;
          const ft = this.tileAt(x, z);
          if (ft && ft.kind === 'floor') { this.loose.push({ item: h, x, z }); c.held = null; ok('place'); }
        }
        return;
      }
      switch (t.kind) {
        case 'crate':
          if (!h) { c.held = ingItem(t.ing); ok('grab'); }
          else if (h.k === 'ing' && h.ing === t.ing && h.st === 'raw') { c.held = null; ok('place'); }
          else if (h.k === 'plate' && this.accepts(h, ingItem(t.ing))) { h.parts.push(t.ing + ':raw'); ok('plate'); }
          else no();
          break;
        case 'counter': case 'board': case 'belt':
          if (!h) {
            if (t.item) { c.held = t.item; t.item = null; if (c.held.k === 'ing') c.held.work = c.held.work || 0; ok('grab'); }
          } else if (!t.item) { t.item = h; c.held = null; t.bp = 0.5; ok('place'); }
          else if (t.item.k === 'plate' && this.accepts(t.item, h)) { t.item.parts.push(keyOf(h)); c.held = null; ok('plate'); }
          else if (h.k === 'plate' && this.accepts(h, t.item)) { h.parts.push(keyOf(t.item)); t.item = null; ok('plate'); }
          else no();
          break;
        case 'pan': case 'pot': case 'oven': case 'blend':
          if (!h) {
            if (t.item) { c.held = t.item; t.item = null; t.t = 0; t.over = 0; ok('grab'); }
          } else if (!t.item && h.k === 'ing' && (nextStep(h) || [])[0] === t.kind) { t.item = h; c.held = null; t.t = 0; t.over = 0; ok('place'); }
          else if (t.item && h.k === 'plate' && this.accepts(h, t.item)) { h.parts.push(keyOf(t.item)); t.item = null; t.t = 0; t.over = 0; ok('plate'); }
          else no();
          break;
        case 'rack':
          if (!h && t.n > 0) { t.n--; c.held = plateItem(); ok('grab'); }
          else if (h && h.k === 'plate' && !h.parts.length) { t.n++; c.held = null; ok('place'); }
          else no();
          break;
        case 'return':
          if (!h && t.n > 0) { c.held = dirtyItem(t.n); t.n = 0; ok('grab'); }
          else if (h && h.k === 'dirty') { t.n += h.n; c.held = null; ok('place'); }
          else no();
          break;
        case 'sink':
          if (h && h.k === 'dirty') { t.n += h.n; c.held = null; ok('place'); }
          else no();
          break;
        case 'window':
          if (h && h.k === 'plate') { if (this.serve(h, t.x + 0.5, t.z + 0.5, c.id)) c.held = null; }
          else no();
          break;
        case 'bin':
          if (h && h.k === 'ing') { c.held = null; ok('bin'); }
          else if (h && h.k === 'plate' && h.parts.length) { h.parts = []; ok('bin'); }
          else no();
          break;
        default: break;
      }
    }

    // hold the chop button: chop at a board, wash at a sink
    work(c, dt) {
      const t = c.target;
      if (!t) return;
      if (t.kind === 'board' && t.item && t.item.k === 'ing') {
        const s = nextStep(t.item);
        if (!s || s[0] !== 'chop') return;
        c.working = 'chop';
        t.item.work += dt / (TIMES.chop * this.D.chop);
        c.chopTick -= dt;
        if (c.chopTick <= 0) { c.chopTick = 0.22; this.emit('chop', { x: t.x + 0.5, z: t.z + 0.5, by: c.id }); }
        if (t.item.work >= 1) {
          t.item.st = s[1];
          t.item.work = 0;
          this.emit('chopped', { x: t.x + 0.5, z: t.z + 0.5, by: c.id });
        }
      } else if (t.kind === 'sink' && t.n > 0) {
        c.working = 'wash';
        t.work += dt / TIMES.wash;
        c.chopTick -= dt;
        if (c.chopTick <= 0) { c.chopTick = 0.3; this.emit('scrub', { x: t.x + 0.5, z: t.z + 0.5, by: c.id }); }
        if (t.work >= 1) this.washOne(t);
      }
    }
    washOne(t) {
      t.work = 0;
      t.n--;
      const r = this.racks[0];
      if (r) r.n++;
      this.emit('washed', { x: t.x + 0.5, z: t.z + 0.5 });
    }

    // ------------------------------------------------------------------ throwing (river kitchens)
    tryThrow(c) {
      const h = c.held;
      if (!this.def.river || !h || h.k !== 'ing') return;
      c.held = null;
      this.flying.push({ item: h, x: c.x + c.fx * 0.3, z: c.z + c.fz * 0.3, dx: c.fx, dz: c.fz, d: 0, by: c.id, last: null });
      this.emit('throw', { x: c.x, z: c.z, by: c.id });
    }
    updateFlying(dt) {
      for (let i = this.flying.length - 1; i >= 0; i--) {
        const f = this.flying[i];
        let left = THROW_SPEED * dt, done = false;
        while (left > 0 && !done) {
          const s = Math.min(0.2, left);
          left -= s;
          f.x += f.dx * s;
          f.z += f.dz * s;
          f.d += s;
          const t = this.tileAt(f.x, f.z);
          if (!t) { done = this.landLoose(f); continue; }
          if (t.kind === 'floor') {
            f.last = { x: f.x, z: f.z };
            for (const id of IDS) { // a brother with free hands catches it
              const c = this.chefs[id];
              if (id !== f.by && !c.held && Math.hypot(c.x - f.x, c.z - f.z) < 0.55) {
                c.held = f.item;
                this.emit('catch', { x: c.x, z: c.z, by: id });
                done = true;
                break;
              }
            }
            if (!done && f.d >= THROW_RANGE) done = this.landLoose(f);
          } else if (t.kind === 'water') {
            if (f.d >= THROW_RANGE) { this.emit('splash', { x: f.x, z: f.z }); done = true; }
          } else {
            done = this.landOn(t, f) || this.landLoose(f);
          }
        }
        if (done) this.flying.splice(i, 1);
      }
    }
    landOn(t, f) {
      const it = f.item;
      const at = { x: t.x + 0.5, z: t.z + 0.5, by: f.by };
      if ((t.kind === 'counter' || t.kind === 'board' || t.kind === 'belt') && !t.item) { t.item = it; t.bp = 0.5; this.emit('land', at); return true; }
      if ((t.kind === 'counter' || t.kind === 'board') && t.item && this.accepts(t.item, it)) { t.item.parts.push(keyOf(it)); this.emit('land', at); return true; }
      if (STATIONS.has(t.kind) && !t.item && (nextStep(it) || [])[0] === t.kind) { t.item = it; t.t = 0; t.over = 0; this.emit('land', at); return true; }
      if (t.kind === 'bin' || (t.kind === 'crate' && t.ing === it.ing && it.st === 'raw')) { this.emit('land', at); return true; }
      return false;
    }
    landLoose(f) {
      if (f.last) { this.loose.push({ item: f.item, x: f.last.x, z: f.last.z }); this.emit('land', { x: f.last.x, z: f.last.z }); }
      else this.emit('splash', { x: f.x, z: f.z });
      return true;
    }

    // ------------------------------------------------------------------ stations and belts
    updateStations(dt) {
      for (const t of this.stations) {
        const it = t.item;
        if (!it) continue;
        const s = nextStep(it);
        if (s && s[0] === t.kind) {
          t.t += dt;
          if (t.t >= TIMES[t.kind]) {
            it.st = s[1];
            t.t = 0;
            t.over = 0;
            this.emit('done', { x: t.x + 0.5, z: t.z + 0.5, kind: t.kind });
          }
        } else if (this.D.burn && t.kind !== 'blend' && it.st !== 'crispy') {
          t.over += dt;
          if (t.over >= TIMES.over) {
            it.st = 'crispy';
            this.emit('crispy', { x: t.x + 0.5, z: t.z + 0.5 });
          }
        }
      }
    }
    updateBelts(dt) {
      const moved = new Set();
      for (const t of this.belts) {
        const it = t.item;
        if (!it || moved.has(it)) continue;
        const n = this.tile(t.x + t.dir[0], t.z + t.dir[1]);
        const can = n && !n.item && (n.kind === 'belt' || n.kind === 'counter');
        t.bp += dt * BELT_SPEED;
        if (!can) { if (t.bp > 0.5) t.bp = 0.5; continue; }
        if (t.bp >= 1) {
          n.item = it;
          n.bp = n.kind === 'belt' ? 0 : 0.5;
          t.item = null;
          t.bp = 0.5;
          moved.add(it);
        }
      }
    }

    // ------------------------------------------------------------------ the food truck
    updateTruck(dt) {
      this.bumpT -= dt;
      if (!this.bumpWarned && this.bumpT < 1.4) { this.bumpWarned = true; this.emit('bumpwarn'); }
      if (this.bumpT <= 0) {
        const dir = this.rand() < 0.5 ? -1 : 1;
        for (const id of IDS) this.chefs[id].push = { vx: dir * 4.5, vz: 0, t: 0.35 };
        this.emit('bump', { dir });
        this.bumpT = 9 + this.rand() * 5;
        this.bumpWarned = false;
      }
    }

    // ------------------------------------------------------------------ 1 player: swap chefs
    swap() {
      if (this.mode !== '1p' || this.over) return;
      const prev = this.chefs[this.active];
      prev.autoWork = !!prev.working; // a chef who was chopping keeps chopping
      this.active = other(this.active);
      this.chefs[this.active].autoWork = false;
      this.emit('swap', { to: this.active });
    }

    // ------------------------------------------------------------------ the companion
    // 1 player: your brother (Kit.roster.buddyFor) runs in, finishes a job, does his move, tosses a treat and saves
    // the order that's about to run out. Unlimited calls. 2 players: a high five and a short speed boost.
    call() {
      if (this.over) return;
      if (this.mode === '2p') {
        if (this.fiveCool > 0) return;
        this.fiveCool = 0.8;
        for (const id of IDS) this.chefs[id].boost = 5;
        this.emit('highfive', { x: (this.chefs.teddy.x + this.chefs.tommy.x) / 2, z: (this.chefs.teddy.z + this.chefs.tommy.z) / 2 });
        return;
      }
      const h = this.helper;
      const who = h.on ? h.who : this.buddyFor(this.active);
      let urgent = null;
      for (const o of this.orders) if (!urgent || o.t / o.max < urgent.t / urgent.max) urgent = o;
      if (urgent && urgent.t / urgent.max < 0.6) {
        urgent.t = urgent.max;
        this.saves++;
        this.emit('saved', { who, r: urgent.r });
      }
      if (!h.on) {
        Object.assign(h, { on: true, who, x: this.W / 2, z: this.H + 0.8, phase: 'in', t: 0, tasks: 1, task: null, carry: null });
        this.pickTask();
        this.emit('helperIn', { who });
      } else h.tasks++;
      this.emit('call', { who });
    }
    pickTask() {
      const h = this.helper;
      let task = null;
      for (const t of this.holders) {
        const d = t.item && t.item.k === 'plate' && this.dishOf(t.item);
        if (d && this.orders.some((o) => o.r === d) && !STATIONS.has(t.kind)) { task = { kind: 'serve', tile: t }; break; }
      }
      if (!task) for (const t of this.boards) if (t.item && (nextStep(t.item) || [])[0] === 'chop') { task = { kind: 'chop', tile: t }; break; }
      if (!task) for (const t of this.sinks) if (t.n > 0) { task = { kind: 'wash', tile: t }; break; }
      if (!task) for (const t of this.returnsT) if (t.n > 0) { task = { kind: 'wash', tile: t }; break; }
      if (!task) task = { kind: 'cheer', tile: null };
      h.task = task;
      h.goal = task.tile ? this.standPoint(task.tile, h) : this.cheerPoint();
      h.phase = 'go';
      h.t = 0;
    }
    standPoint(t, from) {
      let best = null, bd = 1e9;
      for (const a of t.access) {
        const d = Math.hypot(a.x + 0.5 - from.x, a.z + 0.5 - from.z);
        if (d < bd) { bd = d; best = a; }
      }
      return best ? { x: best.x + 0.5, z: best.z + 0.5, fx: t.x - best.x, fz: t.z - best.z } : { x: t.x + 0.5, z: t.z + 1.5, fx: 0, fz: -1 };
    }
    cheerPoint() {
      const c = this.chefs[this.active];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const t = this.tileAt(c.x + dx, c.z + dz);
        if (t && t.kind === 'floor') return { x: t.x + 0.5, z: t.z + 0.5, fx: -dx, fz: -dz };
      }
      return { x: c.x + 0.6, z: c.z + 0.6, fx: -1, fz: 0 };
    }
    updateHelper(dt) {
      const h = this.helper;
      if (!h.on) return;
      h.t += dt;
      const run = (g, speed) => {
        const dx = g.x - h.x, dz = g.z - h.z, d = Math.hypot(dx, dz);
        h.moving = d > 0.05;
        if (d < 0.05) return true;
        const s = Math.min(d, speed * dt);
        h.x += (dx / d) * s;
        h.z += (dz / d) * s;
        h.fx = dx / d; h.fz = dz / d;
        return false;
      };
      const tk = h.task;
      switch (h.phase) {
        case 'go': // run (hopping over counters) to the job
          if (tk && tk.kind === 'serve' && !(tk.tile.item && tk.tile.item.k === 'plate' && this.dishOf(tk.tile.item))) { this.pickTask(); break; }
          if (run(h.goal, 6.5)) {
            h.fx = h.goal.fx; h.fz = h.goal.fz;
            h.phase = 'do';
            h.t = 0;
          }
          break;
        case 'do':
          h.moving = false;
          if (tk.kind === 'chop') {
            const it = tk.tile.item;
            if (h.t > 0.12 && Math.floor(h.t / 0.15) !== Math.floor((h.t - dt) / 0.15)) this.emit('chop', { x: tk.tile.x + 0.5, z: tk.tile.z + 0.5, by: 'helper' });
            if (!it || (nextStep(it) || [])[0] !== 'chop') { this.startSig(); break; }
            if (h.t >= 1.1) {
              it.st = nextStep(it)[1];
              it.work = 0;
              this.emit('chopped', { x: tk.tile.x + 0.5, z: tk.tile.z + 0.5, by: 'helper' });
              this.startSig();
            }
          } else if (tk.kind === 'wash') {
            if (Math.floor(h.t / 0.3) !== Math.floor((h.t - dt) / 0.3)) this.emit('scrub', { x: tk.tile.x + 0.5, z: tk.tile.z + 0.5, by: 'helper' });
            if (h.t >= 0.35) {
              const t = tk.tile;
              if (t.n > 0) {
                h.t = 0;
                if (t.kind === 'sink') this.washOne(t);
                else { t.n--; if (this.racks[0]) this.racks[0].n++; this.emit('washed', { x: t.x + 0.5, z: t.z + 0.5 }); }
              } else this.startSig();
            }
          } else if (tk.kind === 'serve') {
            const it = tk.tile.item;
            if (!(it && it.k === 'plate' && this.dishOf(it))) { this.startSig(); break; }
            if (h.t >= 0.3) {
              h.carry = it;
              tk.tile.item = null;
              const w = this.windows[0];
              h.goal = w ? this.standPoint(w, h) : h.goal;
              h.phase = 'carry';
              this.emit('grab', { x: h.x, z: h.z, by: 'helper' });
            }
          } else this.startSig();
          break;
        case 'carry':
          if (run(h.goal, 6)) {
            const w = this.windows[0];
            if (!this.serve(h.carry, w.x + 0.5, w.z + 0.5, 'helper')) {
              // nobody wants it any more: leave it on the nearest free counter
              const free = this.holders.find((t) => t.kind === 'counter' && !t.item);
              if (free) free.item = h.carry;
            }
            h.carry = null;
            this.startSig();
          }
          break;
        case 'sig': // the signature move and the treat
          h.moving = false;
          if (h.t >= 1.7) {
            h.tasks--;
            if (h.tasks > 0) this.pickTask();
            else { h.phase = 'out'; h.goal = { x: this.W / 2, z: this.H + 0.8 }; }
          }
          break;
        case 'out':
          if (run(h.goal, 6.5)) { h.on = false; h.phase = ''; this.emit('helperOut', { who: h.who }); }
          break;
        default: break;
      }
    }
    startSig() {
      const h = this.helper;
      h.phase = 'sig';
      h.t = 0;
      const c = this.chefs[this.mode === '1p' ? this.active : 'teddy'];
      const [emoji, name] = TREATS[Math.floor(this.rand() * TREATS.length)];
      c.boost = Math.max(c.boost, 4);
      this.emit('treat', { who: h.who, to: c.id, emoji, name, x: h.x, z: h.z });
      this.emit('sig', { who: h.who });
    }
  }

  TK.Sim = Sim;
  TK.simUtil = { stepsTo, nextStep, keyOf, IDS, STATIONS, TREATS, rng };
})(typeof window !== 'undefined' ? window : globalThis);
