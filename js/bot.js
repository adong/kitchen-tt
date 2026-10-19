/* TT Kitchen: the autopilot. Two bot chefs who read the orders, fetch, chop, cook, plate, serve and wash, pass food
   over split counters, use the conveyor belt and throw across the river. It plays behind the title screen and in the
   headless soak (js/soak.js, tools/soak.js) that proves every level can be cleared. Plain JS, no Three.js. */
(function (root) {
  'use strict';
  const TK = root.TK;
  const { stepsTo, nextStep, keyOf, IDS, STATIONS, rng } = TK.simUtil;
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SPEED = 4.2;

  class Team {
    constructor(sim, o = {}) {
      this.sim = sim;
      this.o = o; // { sabotage: 'noserve' | 'lazy' }
      this.ids = IDS;
      this.jobs = {}; this.cool = {}; this.best = {};
      this.rand = rng(o.seed || 7);
      this.flows = new Map();
      this.home = {};
      for (const id of this.ids) {
        const c = sim.chefs[id];
        this.home[id] = { x: Math.floor(c.x), z: Math.floor(c.z), r: sim.regionAt(c.x, c.z) };
        this.cool[id] = id === 'tommy' ? 0.5 : 0.2;
      }
      this.lanes = sim.def.river ? this.findLanes() : [];
    }

    // ------------------------------------------------------------------ the map
    flow(cells) {
      const key = cells.map((c) => c.x + ',' + c.z).join(';');
      let f = this.flows.get(key);
      if (f) return f;
      const s = this.sim, W = s.W;
      f = new Int16Array(W * s.H).fill(-1);
      const q = [];
      for (const c of cells) if (f[c.z * W + c.x] < 0) { f[c.z * W + c.x] = 0; q.push(c); }
      for (let i = 0; i < q.length; i++) {
        const a = q[i];
        for (const [dx, dz] of D4) {
          const x = a.x + dx, z = a.z + dz, t = s.tile(x, z);
          if (!t || t.kind !== 'floor' || f[z * W + x] >= 0) continue;
          f[z * W + x] = f[a.z * W + a.x] + 1;
          q.push({ x, z });
        }
      }
      this.flows.set(key, f);
      return f;
    }
    // straight throws from a river bank, over the water, onto something on the other side
    findLanes() {
      const s = this.sim, lanes = [];
      for (const t of s.tiles) {
        if (t.kind !== 'floor') continue;
        const r = s.region[t.z * s.W + t.x];
        for (const [dx, dz] of D4) {
          let water = false;
          for (let k = 1; k <= 5; k++) {
            const u = s.tile(t.x + dx * k, t.z + dz * k);
            if (!u) break;
            if (u.kind === 'water') { water = true; continue; }
            if (water && u.act && u.regions.size && !u.regions.has(r)) lanes.push({ from: { x: t.x, z: t.z, r }, dx, dz, land: u, r });
            break;
          }
        }
      }
      return lanes;
    }
    beltEnd(t) {
      const s = this.sim;
      let cur = t;
      for (let i = 0; i < 40; i++) {
        const n = s.tile(cur.x + cur.dir[0], cur.z + cur.dir[1]);
        if (!n || n.kind !== 'belt') return n && n.kind === 'counter' ? n : cur;
        cur = n;
      }
      return cur;
    }
    // an item on a belt is only up for grabs once it has stopped at the end
    still(t) {
      if (t.kind !== 'belt') return true;
      const n = this.sim.tile(t.x + t.dir[0], t.z + t.dir[1]);
      return t.bp <= 0.5 && !(n && !n.item && (n.kind === 'belt' || n.kind === 'counter'));
    }
    reg(id) { const c = this.sim.chefs[id]; return this.sim.regionAt(c.x, c.z); }
    claimed(t, id) {
      for (const o of this.ids) if (o !== id && this.jobs[o] && this.jobs[o].tile === t) return true;
      return this.sim.helper.on && this.sim.helper.task && this.sim.helper.task.tile === t;
    }
    pickNear(id, r, list, filter) {
      const c = this.sim.chefs[id];
      let best = null, bd = 1e9;
      for (const t of list) {
        if (!t.regions.has(r) || this.claimed(t, id) || (filter && !filter(t))) continue;
        const d = Math.abs(t.x + 0.5 - c.x) + Math.abs(t.z + 0.5 - c.z);
        if (d < bd) { bd = d; best = t; }
      }
      return best;
    }
    go(t, r, kind, why, ok) { return { kind, tile: t, stand: t.access.filter((a) => a.r === r), why, ok }; }

    // ------------------------------------------------------------------ what the kitchen needs
    analyze() {
      const s = this.sim;
      const items = [], plates = [];
      const add = (it, w) => {
        if (!it) return;
        if (it.k === 'ing') items.push(Object.assign({ it }, w));
        else if (it.k === 'plate') plates.push(Object.assign({ it }, w));
      };
      for (const t of s.holders) add(t.item, { tile: t });
      for (const id of IDS) add(s.chefs[id].held, { chef: id });
      for (const f of s.flying) add(f.item, { fly: f });
      for (const l of s.loose) add(l.item, { loose: l });
      if (s.helper.carry) add(s.helper.carry, { helper: true });
      const orders = s.orders.slice().sort((a, b) => a.t - b.t);
      const needs = [], used = new Set();
      for (const o of orders) {
        const parts = TK.RECIPES[o.r].parts;
        let best = null, bs = -1;
        for (const p of plates) {
          if (used.has(p) || !p.it.parts.every((k) => parts.includes(k))) continue;
          if (p.it.parts.length > bs) { bs = p.it.parts.length; best = p; }
        }
        if (best) { used.add(best); best.need = null; }
        const n = { o, plate: best, missing: parts.filter((k) => !best || !best.it.parts.includes(k)) };
        if (best) best.need = n;
        needs.push(n);
      }
      const deficits = [];
      for (const n of needs) {
        for (const k of n.missing) {
          const [ing, st] = k.split(':');
          let best = null, bd = 1e9;
          for (const x of items) {
            if (x.for || x.it.ing !== ing || x.it.st === 'crispy') continue;
            const d = stepsTo(ing, x.it.st, st);
            if (d >= 0 && d < bd) { bd = d; best = x; }
          }
          if (best) best.for = { n, k, st };
          else deficits.push({ n, k, ing, st });
        }
      }
      return { items, plates, needs, deficits };
    }

    // where an item should go next: plates that want it, or free stations for its next step
    destOf(x, A) {
      const s = this.sim, a = x.for, it = x.it;
      if (!a) return [];
      if (it.st === a.st) {
        const ps = A.plates.filter((p) => p.tile && this.still(p.tile) && s.accepts(p.it, it) && (!p.need || p.need.missing.includes(a.k)));
        const mine = ps.filter((p) => p === a.n.plate);
        return (mine.length ? mine : ps).map((p) => p.tile);
      }
      const step = nextStep(it);
      if (!step) return [];
      const list = step[0] === 'chop' ? s.boards : s.stations.filter((t) => t.kind === step[0]);
      return list.filter((t) => !t.item && t !== x.tile);
    }

    // ------------------------------------------------------------------ decisions
    decide(id, A) {
      const s = this.sim, c = s.chefs[id], r = this.reg(id);
      if (r < 0) return null;
      return c.held ? this.decideHeld(id, A, r, c.held) : this.decideEmpty(id, A, r);
    }

    decideHeld(id, A, r, h) {
      const s = this.sim;
      if (h.k === 'dirty') {
        const sink = this.pickNear(id, r, s.sinks);
        return sink ? this.go(sink, r, 'grab', 'wash up') : this.park(id, r, h);
      }
      if (h.k === 'plate') {
        const dish = s.dishOf(h);
        if (dish && s.orders.some((o) => o.r === dish) && this.o.sabotage !== 'noserve') {
          const w = this.pickNear(id, r, s.windows);
          if (w) return this.go(w, r, 'grab', 'serve');
          return this.transfer(id, r, h, s.windows) || this.park(id, r, h, s.windows);
        }
        const p = A.plates.find((q) => q.it === h);
        if (p && !p.need && h.parts.length && !dish) { // nobody wants this plate's food any more
          const bin = this.pickNear(id, r, s.bins);
          if (bin) return this.go(bin, r, 'grab', 'clear plate');
        }
        // scoop up a ready thing that belongs on it
        let best = null, bd = 1e9;
        const c = s.chefs[id];
        for (const x of A.items) {
          if (!x.tile || !x.for || x.it.st !== x.for.st || !x.tile.regions.has(r) || !this.still(x.tile) || this.claimed(x.tile, id)) continue;
          if (!s.accepts(h, x.it) || (p && p.need && !p.need.missing.includes(x.for.k))) continue;
          const d = Math.abs(x.tile.x - c.x) + Math.abs(x.tile.z - c.z);
          if (d < bd) { bd = d; best = x.tile; }
        }
        if (best) return this.go(best, r, 'grab', 'scoop');
        return this.park(id, r, h, s.windows.filter((w) => w.regions.has(r)).length ? s.windows : s.racks);
      }
      // an ingredient
      if (h.st === 'crispy' || !s.useful(h)) {
        const bin = this.pickNear(id, r, s.bins);
        return bin ? this.go(bin, r, 'grab', 'bin') : this.park(id, r, h);
      }
      const x = A.items.find((q) => q.chef === id);
      const dest = this.destOf(x, A);
      if (x.for && h.st === x.for.st) {
        const mine = dest.filter((t) => t.regions.has(r) && !this.claimed(t, id));
        if (mine.length) return this.go(this.pickNear(id, r, mine) || mine[0], r, 'grab', 'onto plate');
        if (dest.length) return this.transfer(id, r, h, dest) || this.park(id, r, h);
        return this.park(id, r, h, s.windows.some((w) => w.regions.has(r)) ? s.windows : null);
      }
      const free = dest.length ? dest : (() => { // not wanted yet: cook it anyway if a station is free
        const st = nextStep(h);
        if (!st) return [];
        return (st[0] === 'chop' ? s.boards : s.stations.filter((t) => t.kind === st[0])).filter((t) => !t.item);
      })();
      const mine = this.pickNear(id, r, free);
      if (mine) return this.go(mine, r, 'grab', 'cook');
      if (free.length) return this.transfer(id, r, h, free) || this.park(id, r, h);
      return this.park(id, r, h);
    }

    decideEmpty(id, A, r) {
      const s = this.sim, c = s.chefs[id];
      const near = (t) => Math.abs(t.x + 0.5 - c.x) + Math.abs(t.z + 0.5 - c.z);
      const canServe = s.windows.some((w) => w.regions.has(r));
      // 1. a finished dish: take it to the window
      if (this.o.sabotage !== 'noserve') {
        let best = null;
        for (const p of A.plates) {
          if (!p.tile || !this.still(p.tile) || !p.tile.regions.has(r) || this.claimed(p.tile, id) || STATIONS.has(p.tile.kind)) continue;
          const dish = s.dishOf(p.it);
          if (!dish || !s.orders.some((o) => o.r === dish)) continue;
          if (!canServe && s.windows.some((w) => [...w.regions].some((q) => p.tile.regions.has(q)))) continue;
          if (!best || near(p.tile) < near(best)) best = p.tile;
        }
        if (best) {
          const item = best.item;
          return this.go(best, r, 'grab', 'take dish', () => best.item === item);
        }
      }
      // 2. take cooked (or crispy) food off the heat
      let hot = null;
      for (const t of s.stations) {
        const it = t.item;
        if (!it || !t.regions.has(r) || this.claimed(t, id)) continue;
        const step = nextStep(it);
        if (step && step[0] === t.kind) continue; // still cooking
        const x = A.items.find((q) => q.it === it);
        const wanted = it.st === 'crispy' || (x && this.destOf(x, A).length) || (s.D.burn && t.over > 2) || this.blocked(t, A);
        if (wanted && (!hot || t.over > hot.over)) hot = t;
      }
      if (hot) { const item = hot.item; return this.go(hot, r, 'grab', 'off the heat', () => hot.item === item); }
      // 3. chop what's waiting on a board
      for (const t of s.boards) {
        if (!t.item || !t.regions.has(r) || this.claimed(t, id)) continue;
        const st = nextStep(t.item);
        if (st && st[0] === 'chop') { const item = t.item; return this.go(t, r, 'work', 'chop', () => t.item === item && (nextStep(item) || [])[0] === 'chop'); }
      }
      // 4. move food along: to a plate, a station, or over to the other half
      let mv = null, md = 1e9;
      for (const x of A.items) {
        if (x.loose) {
          if (s.regionAt(x.loose.x, x.loose.z) !== r || !x.for) continue;
          const d = near({ x: x.loose.x - 0.5, z: x.loose.z - 0.5 });
          if (d < md) { md = d; mv = { loose: x.loose }; }
          continue;
        }
        if (!x.tile || STATIONS.has(x.tile.kind) || !x.tile.regions.has(r) || !this.still(x.tile) || this.claimed(x.tile, id)) continue;
        const st = nextStep(x.it);
        if (x.tile.kind === 'board' && st && st[0] === 'chop') continue;
        let dest = this.destOf(x, A);
        if (!dest.length && x.tile.kind === 'board' && x.for && x.it.st === x.for.st && this.boardsWanted(A)) dest = s.holders.filter((t) => t.kind === 'counter' && !t.item);
        if (!dest.length) continue;
        const reach = dest.some((t) => t.regions.has(r));
        const others = dest.some((t) => [...t.regions].some((q) => q !== r && x.tile.regions.has(q)));
        if (!reach && others) continue; // my brother can take it from here
        if (!reach && !this.canTransfer(r, dest)) continue;
        const d = near(x.tile);
        if (d < md) { md = d; mv = { tile: x.tile }; }
      }
      if (mv && mv.tile) { const t = mv.tile, item = t.item; return this.go(t, r, 'grab', 'move food', () => t.item === item); }
      if (mv && mv.loose) { const l = mv.loose; return { kind: 'loose', loose: l, stand: [{ x: Math.floor(l.x), z: Math.floor(l.z) }], why: 'pick up', ok: () => s.loose.includes(l) }; }
      // 5. a clean plate for an order that has none
      const rack = s.racks[0];
      const plateless = A.needs.filter((n) => !n.plate).length;
      const fetchingPlate = this.ids.some((o) => o !== id && this.jobs[o] && this.jobs[o].why === 'plate');
      if (plateless && !fetchingPlate && rack && rack.regions.has(r)) {
        if (rack.n > 0) return this.go(rack, r, 'grab', 'plate', () => rack.n > 0);
        // no clean plates: clear a plate nobody wants
        const spare = A.plates.find((p) => p.tile && !p.need && p.it.parts.length && p.tile.regions.has(r) && !STATIONS.has(p.tile.kind));
        if (spare && s.bins.some((b) => b.regions.has(r))) { const t = spare.tile, item = t.item; return this.go(t, r, 'grab', 'spare plate', () => t.item === item); }
      }
      // 6. washing up when clean plates run low
      const sink = s.sinks.find((t) => t.regions.has(r));
      if (sink && rack && rack.n <= 1) {
        if (sink.n > 0 && !this.claimed(sink, id)) return this.go(sink, r, 'work', 'wash', () => sink.n > 0);
        const ret = this.pickNear(id, r, s.returnsT, (t) => t.n > 0);
        if (ret) return this.go(ret, r, 'grab', 'dirty plates', () => ret.n > 0);
      }
      // 7. fetch what an order still needs
      const claims = {};
      for (const o of this.ids) if (o !== id && this.jobs[o] && this.jobs[o].fetch) claims[this.jobs[o].fetch] = (claims[this.jobs[o].fetch] || 0) + 1;
      for (const d of A.deficits) {
        if (claims[d.ing] > 0) { claims[d.ing]--; continue; }
        const crate = this.pickNear(id, r, s.crates, (t) => t.ing === d.ing);
        if (crate) { const j = this.go(crate, r, 'grab', 'fetch'); j.fetch = d.ing; return j; }
      }
      // 8. nothing urgent: wash up, then wait at home
      if (sink && sink.n > 0 && !this.claimed(sink, id)) return this.go(sink, r, 'work', 'wash', () => sink.n > 0);
      const ret = sink && this.pickNear(id, r, s.returnsT, (t) => t.n > 0);
      if (ret) return this.go(ret, r, 'grab', 'dirty plates', () => ret.n > 0);
      const hm = this.home[id];
      if (hm.r === r) return { kind: 'idle', stand: [{ x: hm.x, z: hm.z }], why: 'wait', ok: () => !A.deficits.length };
      return null;
    }
    // a station holding finished food that the next ingredient needs
    blocked(t, A) {
      return A.items.some((x) => x.chef && (nextStep(x.it) || [])[0] === t.kind);
    }
    boardsWanted(A) {
      return !this.sim.boards.some((b) => !b.item) && A.items.some((x) => (nextStep(x.it) || [])[0] === 'chop' && !(x.tile && x.tile.kind === 'board'));
    }

    // put it down on a free counter (near `prefer` if given)
    park(id, r, h, prefer) {
      const s = this.sim, c = s.chefs[id];
      let best = null, bd = 1e9;
      for (const t of s.holders) {
        if (t.kind !== 'counter' || t.item || !t.regions.has(r) || this.claimed(t, id)) continue;
        let d = Math.abs(t.x + 0.5 - c.x) + Math.abs(t.z + 0.5 - c.z);
        if (prefer && prefer.length) d = d * 0.3 + Math.min(...prefer.map((p) => Math.abs(p.x - t.x) + Math.abs(p.z - t.z)));
        if (d < bd) { bd = d; best = t; }
      }
      if (!best) return null;
      return this.go(best, r, 'grab', 'park', () => !best.item);
    }

    canTransfer(r, dest) {
      const s = this.sim, rs = new Set();
      for (const t of dest) for (const q of t.regions) if (q !== r) rs.add(q);
      if (s.holders.some((t) => t.kind === 'counter' && !t.item && t.regions.has(r) && [...t.regions].some((q) => rs.has(q)))) return true;
      if (s.belts.some((t) => !t.item && t.regions.has(r) && [...this.beltEnd(t).regions].some((q) => rs.has(q)))) return true;
      return this.lanes.some((l) => l.r === r && [...l.land.regions].some((q) => rs.has(q)));
    }
    // hand it over to the other half: a counter both can reach, the belt, or a throw over the river
    transfer(id, r, h, dest) {
      const s = this.sim, c = s.chefs[id], rs = new Set();
      for (const t of dest) for (const q of t.regions) if (q !== r) rs.add(q);
      const reach = (t) => [...t.regions].some((q) => rs.has(q));
      let best = null, bd = 1e9;
      const consider = (j, x, z) => { const d = Math.abs(x + 0.5 - c.x) + Math.abs(z + 0.5 - c.z); if (d < bd) { bd = d; best = j; } };
      for (const t of s.holders) {
        if (t.kind === 'counter' && !t.item && t.regions.has(r) && reach(t) && !this.claimed(t, id)) consider(this.go(t, r, 'grab', 'pass', () => !t.item), t.x, t.z);
        if (t.kind === 'belt' && !t.item && t.regions.has(r) && reach(this.beltEnd(t)) && !this.claimed(t, id)) consider(this.go(t, r, 'grab', 'belt', () => !t.item), t.x, t.z);
      }
      if (h.k === 'ing') {
        for (const l of this.lanes) {
          if (l.r !== r || !reach(l.land)) continue;
          const t = l.land;
          const ok = () => (!t.item && ['counter', 'board'].includes(t.kind)) || (t.item && s.accepts(t.item, h)) || (STATIONS.has(t.kind) && !t.item && (nextStep(h) || [])[0] === t.kind);
          if (!ok() || this.claimedLand(t, id)) continue;
          consider({ kind: 'throw', lane: l, land: t, stand: [l.from], why: 'throw', ok }, l.from.x, l.from.z);
        }
      }
      return best;
    }
    claimedLand(t, id) {
      for (const o of this.ids) if (o !== id && this.jobs[o] && (this.jobs[o].land === t || this.jobs[o].tile === t)) return true;
      return this.sim.flying.length > 0 && this.sim.flying.some((f) => Math.floor(f.x + f.dx * 3) === t.x && Math.floor(f.z + f.dz * 3) === t.z);
    }

    // ------------------------------------------------------------------ driving the chefs
    inputs(dt) {
      const A = this.analyze();
      const out = {};
      for (const id of this.ids) out[id] = this.drive(id, A, dt);
      return out;
    }
    brake(c) {
      const v = Math.hypot(c.vx, c.vz);
      return v > 0.3 && this.sim.def.ice ? { mx: -c.vx / v * 0.13, mz: -c.vz / v * 0.13 } : { mx: 0, mz: 0 };
    }
    steer(c, x, z, arrive) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz) || 1;
      const ice = this.sim.def.ice;
      let sp = ice ? 0.62 : 1;
      if (arrive) sp = Math.min(sp, d * (ice ? 1.6 : 3));
      let mx = (dx / d) * sp, mz = (dz / d) * sp;
      if (ice) { // steer the velocity, not just the direction
        mx += (mx * SPEED - c.vx) * 0.12;
        mz += (mz * SPEED - c.vz) * 0.12;
      }
      return { mx, mz };
    }
    done(id) { this.jobs[id] = null; this.cool[id] = 0.12; }
    drive(id, A, dt) {
      const s = this.sim, c = s.chefs[id];
      if (this.o.sabotage === 'lazy' && id === 'tommy') return { mx: 0, mz: 0 };
      if (this.cool[id] > 0) { this.cool[id] -= dt; return this.brake(c); }
      let j = this.jobs[id];
      if (j && j.ok && !j.ok()) j = this.jobs[id] = null;
      if (!j) {
        j = this.jobs[id] = this.decide(id, A);
        this.best[id] = { d: 1e9, t: 0 };
        if (!j) { this.cool[id] = 0.3; return this.brake(c); }
      }
      j.age = (j.age || 0) + dt;
      if (j.age > 15 && j.kind !== 'idle') { this.jobs[id] = null; return this.brake(c); }
      if (j.kind === 'idle' && j.age > 0.5) { this.jobs[id] = null; this.cool[id] = 0.2; }
      const W = s.W, cx = Math.floor(c.x), cz = Math.floor(c.z);
      if (!j.stand.length) { this.jobs[id] = null; return this.brake(c); }
      const f = this.flow(j.stand);
      const d = f[cz * W + cx];
      if (d < 0) { this.jobs[id] = null; this.cool[id] = 0.3; return this.brake(c); }
      const b = this.best[id];
      if (d < b.d) { b.d = d; b.t = 0; } else if ((b.t += dt) > 2.5) { // stuck behind my brother: try something else
        this.jobs[id] = null;
        this.cool[id] = 0.2 + this.rand() * 0.6;
        return this.brake(c);
      }
      if (d > 0) {
        let nx = cx, nz = cz;
        for (const [dx, dz] of D4) {
          const x = cx + dx, z = cz + dz;
          if (x >= 0 && z >= 0 && x < W && z < s.H && f[z * W + x] === d - 1) { nx = x; nz = z; break; }
        }
        return this.steer(c, nx + 0.5, nz + 0.5, false);
      }
      const tx = cx + 0.5, tz = cz + 0.5;
      if (j.kind === 'idle') return Math.hypot(tx - c.x, tz - c.z) > 0.3 ? this.steer(c, tx, tz, true) : this.brake(c);
      if (Math.hypot(tx - c.x, tz - c.z) > (j.kind === 'throw' ? 0.15 : 0.32) || Math.hypot(c.vx, c.vz) > 1.5) return this.steer(c, tx, tz, true);
      let fx, fz;
      if (j.kind === 'throw') { fx = j.lane.dx; fz = j.lane.dz; }
      else if (j.kind === 'loose') { fx = j.loose.x - c.x; fz = j.loose.z - c.z; }
      else { fx = j.tile.x + 0.5 - c.x; fz = j.tile.z + 0.5 - c.z; }
      const l = Math.hypot(fx, fz) || 1;
      fx /= l; fz /= l;
      const inp = { mx: fx * 0.2, mz: fz * 0.2 };
      if (j.kind === 'loose') { inp.grab = true; this.done(id); return inp; }
      if (c.fx * fx + c.fz * fz < 0.97) return inp;
      if (j.kind === 'throw') {
        if (Math.hypot(c.vx, c.vz) > 0.6) return this.brake(c);
        inp.mx = inp.mz = 0;
        inp.useEdge = true;
        this.done(id);
        return inp;
      }
      if (c.target !== j.tile) return inp;
      if (j.kind === 'work') { inp.use = true; return inp; }
      inp.grab = true;
      this.done(id);
      return inp;
    }
  }

  TK.Team = Team;
})(typeof window !== 'undefined' ? window : globalThis);
