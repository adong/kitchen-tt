/* TT Kitchen: drawing the kitchen with Three.js. Counters, stations and crates are boxes; food is the canvas icons
   (icons.js) on sprites; Teddy and Tommy are the kit's people in chef hats and aprons. The view only reads the sim. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx;
  const CHEF = 0.7; // the kit's 2 m people, shrunk to kitchen size
  const TOP = 0.56; // counter height
  const COLORS = { teddy: '#4a9dff', tommy: '#ffb02e' };
  const THEMES = {
    bistro: { floor: ['#f7e9cc', '#dfbb86'], counter: '#b8743f', top: '#8fd3c6', wall: '#a8643f', ground: '#86b86f', back: '#f2c879' },
    diner: { floor: ['#fbfbfb', '#3a3d4c'], counter: '#4fb3bf', top: '#ff8a8a', wall: '#d64545', ground: '#9fc5e8', back: '#ffd9d0' },
    teahouse: { floor: ['#ecd9b3', '#cfae79'], counter: '#9c4a34', top: '#f0c27a', wall: '#64301f', ground: '#6aa56b', back: '#f7e6c4' },
    pizzeria: { floor: ['#f7f1e3', '#d9705f'], counter: '#5f8d4e', top: '#ffe08a', wall: '#a43d33', ground: '#d8b26e', back: '#fff4dc' },
    cafe: { floor: ['#efe6fa', '#c9b6ec'], counter: '#ff7fa6', top: '#9ee6d0', wall: '#7a5ca8', ground: '#bfe3c0', back: '#ffe9f2' },
    truck: { floor: ['#c4ccd6', '#9ea8b4'], counter: '#ffb02e', top: '#ffe7a8', wall: '#e04a3a', ground: '#4f5964', back: '#e04a3a', road: true },
    ice: { floor: ['#e8f8ff', '#c3e8fb'], counter: '#4f8fd0', top: '#ffd1e8', wall: '#3f6fa0', ground: '#f4fbff', back: '#d4ecff', ice: true },
    river: { floor: ['#ecf3db', '#c9dca8'], counter: '#a0703f', top: '#ffcf7a', wall: '#6b4a2a', ground: '#77b255', back: '#d9f0c8' },
    party: { floor: ['#fff0a0', '#ff9fd0'], counter: '#9b6bff', top: '#8ff2cf', wall: '#2a7bd6', ground: '#4f5964', back: '#2a7bd6', road: true, ice: true },
  };

  function checker(a, b, ice) {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = a; g.fillRect(0, 0, 128, 128);
    g.fillStyle = b; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
    if (ice) {
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
      for (let i = 0; i < 9; i++) { g.beginPath(); const x = (i * 37) % 128, y = (i * 53) % 128; g.moveTo(x, y); g.lineTo(x + 30, y + 12); g.stroke(); }
    } else {
      g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64); g.strokeRect(64, 64, 64, 64);
    }
    return G.toTexture(c, true);
  }
  function stripes(dark, light) { // belt surface and the road
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = dark; g.fillRect(0, 0, 64, 64);
    g.fillStyle = light;
    g.beginPath(); g.moveTo(10, 8); g.lineTo(34, 32); g.lineTo(10, 56); g.lineTo(22, 56); g.lineTo(46, 32); g.lineTo(22, 8); g.fill();
    return G.toTexture(c, true);
  }
  function road() {
    const [c, g] = G.makeCanvas(256, 256);
    g.fillStyle = '#4f5964'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#f4f1e6'; for (let x = 0; x < 256; x += 64) g.fillRect(x, 120, 36, 10);
    g.fillStyle = 'rgba(0,0,0,0.1)'; for (let i = 0; i < 60; i++) g.fillRect((i * 97) % 256, (i * 61) % 256, 3, 3);
    return G.toTexture(c, true);
  }
  function water() {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#3aa7e0'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4;
    for (let y = 16; y < 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(32, y - 10, 64, y + 10, 128, y); g.stroke(); }
    return G.toTexture(c, true);
  }

  class View {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
      this.renderer.outputEncoding = T.sRGBEncoding;
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(34, 16 / 9, 0.5, 200);
      this.size = [0, 0];
      this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
      this.scene.add(new T.HemisphereLight('#ffffff', '#b9a48a', 0.75));
      const sun = new T.DirectionalLight('#fff4e0', 0.85);
      sun.position.set(-6, 14, 8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 40 });
      sun.shadow.bias = -0.0008;
      this.scene.add(sun);
      this.sun = sun;
      this.dot = G.dotTexture();
      this.time = 0;
      this.shake = 0;
      this.textCache = {};
      this.particles = [];
      this.flyers = [];
      this.chefMeshes = {};
      this.minis = {};
      this.portraitsFor = null;
      Kit.lang.onChange(() => { this.textCache = {}; });
    }

    resize(w, h) {
      this.size = [w, h];
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.fit();
    }

    // ------------------------------------------------------------------ building a level
    load(sim) {
      if (this.level) { this.scene.remove(this.level); this.dispose(this.level); }
      if (this.outside) { this.scene.remove(this.outside); this.dispose(this.outside); }
      this.sim = sim;
      const th = this.th = THEMES[sim.def.theme] || THEMES.bistro;
      this.scene.background = new T.Color(th.ground).lerp(new T.Color('#ffffff'), 0.25);
      this.level = new T.Group();
      this.kitchen = new T.Group(); // tilts when the truck goes over a bump
      this.level.add(this.kitchen);
      this.scene.add(this.level);
      this.outside = new T.Group();
      this.scene.add(this.outside);
      const W = sim.W, H = sim.H;
      this.ox = -W / 2; this.oz = -H / 2;
      const K = this.kitchen;
      const mat = (c, o) => G.std(c, Object.assign({ roughness: 0.75 }, o));
      const box = (w, h, d, m, x, y, z, parent = K, shadow = true) => {
        const me = G.mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent, shadow);
        me.receiveShadow = true;
        return me;
      };
      const cyl = (rt, rb, h, m, x, y, z, parent = K, seg = 20) => G.mesh(new T.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent);

      // ground, floor and the back wall
      const groundTex = th.road ? road() : null;
      if (groundTex) { groundTex.repeat.set(10, 10); }
      const ground = new T.Mesh(new T.PlaneGeometry(90, 90), mat(groundTex ? '#ffffff' : th.ground, { map: groundTex }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = th.road ? -0.75 : -0.02;
      ground.receiveShadow = true;
      this.outside.add(ground);
      this.groundTex = groundTex;
      const floorTex = checker(th.floor[0], th.floor[1], th.ice);
      floorTex.repeat.set(W / 2, H / 2);
      const floor = new T.Mesh(new T.PlaneGeometry(W, H), mat('#ffffff', { map: floorTex, roughness: th.ice ? 0.25 : 0.8, metalness: th.ice ? 0.05 : 0 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.005;
      floor.receiveShadow = true;
      K.add(floor);
      const back = box(W + 0.6, 2.2, 0.3, mat(th.back), 0, 1.1, this.oz - 0.18);
      back.castShadow = false;
      for (let i = 0; i < Math.floor(W / 3); i++) { // shelves with jars on the back wall
        const x = this.ox + 1.5 + i * 3;
        box(1.6, 0.06, 0.26, mat(th.counter), x, 1.45, this.oz - 0.06);
        for (let j = 0; j < 3; j++) cyl(0.09, 0.09, 0.22, mat(['#ff7aa8', '#7ed957', '#ffd23f'][(i + j) % 3]), x - 0.5 + j * 0.5, 1.59, this.oz - 0.06);
      }
      if (th.road) this.buildTruck(W, H, mat, box, cyl);
      else this.buildYard(W, H, mat, box, cyl);

      // tiles
      const counterMat = mat(th.counter), topMat = mat(th.top, { roughness: 0.55 }), wallMat = mat(th.wall);
      const steel = mat('#c9ced6', { metalness: 0.6, roughness: 0.35 }), dark = mat('#2c2f38', { roughness: 0.5 });
      const wood = mat('#d8a56a'), white = mat('#ffffff');
      this.tileFx = [];
      this.waterTex = null;
      this.beltTexes = [];
      for (const t of sim.tiles) {
        const x = this.ox + t.x + 0.5, z = this.oz + t.z + 0.5;
        const fx = { t, x, z };
        if (t.kind === 'floor') continue;
        if (t.kind === 'wall') { box(1, 0.8, 1, wallMat, x, 0.4, z); continue; }
        if (t.kind === 'water') {
          if (!this.waterTex) { this.waterTex = water(); this.waterMat = mat('#ffffff', { map: this.waterTex, roughness: 0.2, metalness: 0.1 }); }
          const w = new T.Mesh(new T.PlaneGeometry(1, 1), this.waterMat);
          w.rotation.x = -Math.PI / 2;
          w.position.set(x, 0.03, z);
          w.receiveShadow = true;
          K.add(w);
          continue;
        }
        const face = t.access[0] ? [t.access[0].x - t.x, t.access[0].z - t.z] : [0, 1];
        fx.face = face;
        if (t.kind === 'belt') {
          box(1, TOP - 0.06, 1, dark, x, (TOP - 0.06) / 2, z);
          const tex = stripes('#3b3f4a', '#ffd23f');
          tex.center.set(0.5, 0.5);
          tex.rotation = Math.atan2(-t.dir[1], t.dir[0]);
          const belt = new T.Mesh(new T.PlaneGeometry(0.96, 0.96), mat('#ffffff', { map: tex, roughness: 0.6 }));
          belt.rotation.x = -Math.PI / 2;
          belt.position.set(x, TOP - 0.05, z);
          K.add(belt);
          this.beltTexes.push(tex);
          fx.y = TOP - 0.05;
          this.tileFx.push(fx);
          continue;
        }
        box(0.98, TOP - 0.06, 0.98, counterMat, x, (TOP - 0.06) / 2, z);
        box(1, 0.06, 1, t.kind === 'pan' || t.kind === 'pot' ? dark : topMat, x, TOP - 0.03, z);
        fx.y = TOP;
        switch (t.kind) {
          case 'board':
            box(0.72, 0.05, 0.56, wood, x, TOP + 0.025, z);
            box(0.06, 0.02, 0.34, steel, x + 0.42, TOP + 0.02, z);
            fx.y = TOP + 0.05;
            break;
          case 'crate': {
            box(0.78, 0.26, 0.78, mat('#c58a4a'), x, TOP + 0.13, z);
            box(0.82, 0.05, 0.1, mat('#9b6332'), x, TOP + 0.22, z - 0.3);
            box(0.82, 0.05, 0.1, mat('#9b6332'), x, TOP + 0.22, z + 0.3);
            const icon = new T.Mesh(new T.PlaneGeometry(0.62, 0.62), new T.MeshBasicMaterial({ map: TK.icons.tex(TK.icons.crate(t.ing)), transparent: true }));
            icon.rotation.x = -Math.PI / 2 + 0.5;
            icon.position.set(x, TOP + 0.42, z);
            K.add(icon);
            break;
          }
          case 'pan':
            cyl(0.18, 0.18, 0.02, mat('#ff5a3c', { emissive: '#ff3c1e', emissiveIntensity: 0.3 }), x, TOP + 0.01, z);
            cyl(0.34, 0.3, 0.07, dark, x, TOP + 0.05, z);
            box(0.36, 0.04, 0.07, mat('#5a3a22'), x + 0.48, TOP + 0.07, z);
            fx.y = TOP + 0.08;
            break;
          case 'pot': {
            const pot = cyl(0.33, 0.3, 0.34, steel, x, TOP + 0.17, z);
            pot.castShadow = true;
            cyl(0.3, 0.3, 0.02, mat('#8fd3ff', { roughness: 0.2 }), x, TOP + 0.3, z);
            box(0.12, 0.05, 0.05, dark, x - 0.38, TOP + 0.28, z);
            box(0.12, 0.05, 0.05, dark, x + 0.38, TOP + 0.28, z);
            fx.y = TOP + 0.34;
            break;
          }
          case 'oven': {
            box(0.96, 0.5, 0.96, mat('#d24c3f'), x, TOP + 0.25, z);
            const glow = box(0.6, 0.3, 0.02, mat('#ffcf6a', { emissive: '#ff9a2a', emissiveIntensity: 0.2 }), x + face[0] * 0.49, TOP + 0.22, z + face[1] * 0.49);
            glow.rotation.y = Math.atan2(face[0], face[1]);
            fx.glow = glow;
            box(1, 0.06, 1, topMat, x, TOP + 0.53, z);
            fx.y = TOP + 0.56;
            break;
          }
          case 'blend':
            box(0.36, 0.14, 0.36, dark, x, TOP + 0.07, z);
            cyl(0.18, 0.14, 0.4, new T.MeshStandardMaterial({ color: '#cdeeff', transparent: true, opacity: 0.45, roughness: 0.1 }), x, TOP + 0.34, z);
            fx.y = TOP + 0.55;
            fx.jar = true;
            break;
          case 'sink':
            box(0.7, 0.04, 0.6, mat('#5aa9e6', { roughness: 0.2 }), x, TOP + 0.005, z);
            box(0.06, 0.32, 0.06, steel, x - face[0] * 0.38, TOP + 0.16, z - face[1] * 0.38);
            fx.y = TOP + 0.02;
            break;
          case 'rack':
            box(0.08, 0.3, 0.6, wood, x - 0.36, TOP + 0.15, z);
            box(0.08, 0.3, 0.6, wood, x + 0.36, TOP + 0.15, z);
            break;
          case 'return': {
            box(0.8, 0.4, 0.3, mat('#6b7080'), x - face[0] * 0.32, TOP + 0.2, z - face[1] * 0.32);
            const s = this.sprite(G.emojiTexture('🍽️'), 0.42);
            s.position.set(x - face[0] * 0.32, TOP + 0.62, z - face[1] * 0.32);
            K.add(s);
            break;
          }
          case 'window': {
            const post = mat('#ffffff');
            box(0.08, 1.5, 0.08, post, x - face[0] * 0.45 + face[1] * 0.46, TOP + 0.75, z - face[1] * 0.45 + face[0] * 0.46);
            box(0.08, 1.5, 0.08, post, x - face[0] * 0.45 - face[1] * 0.46, TOP + 0.75, z - face[1] * 0.45 - face[0] * 0.46);
            const aw = box(Math.abs(face[1]) ? 1.02 : 0.5, 0.08, Math.abs(face[0]) ? 1.02 : 0.5, mat('#e94b3c'), x - face[0] * 0.3, TOP + 1.5, z - face[1] * 0.3);
            aw.castShadow = false;
            const bell = this.sprite(G.emojiTexture('🛎️'), 0.36);
            bell.position.set(x, TOP + 0.2, z);
            K.add(bell);
            break;
          }
          case 'bin':
            cyl(0.3, 0.26, 0.5, mat('#4caf50'), x, TOP + 0.25, z);
            cyl(0.33, 0.33, 0.05, mat('#357a38'), x, TOP + 0.52, z);
            fx.y = TOP + 0.55;
            break;
          default: break;
        }
        this.tileFx.push(fx);
      }

      // food on tiles, plates, progress bars (built on demand in sync)
      this.itemSprites = new Map();
      this.plateMeshes = new Map();
      this.stacks = new Map();
      this.bars = new Map();
      this.marks = new Map();
      this.plateGeo = this.plateGeo || new T.CylinderGeometry(0.3, 0.24, 0.05, 22);
      this.plateMat = this.plateMat || G.std('#ffffff', { roughness: 0.3 });
      this.dirtyMat = this.dirtyMat || G.std('#c7b48f', { roughness: 0.9 });
      this.items = new T.Group();
      this.level.add(this.items);
      this.fxGroup = new T.Group();
      this.level.add(this.fxGroup);
      this.duck = null;
      if (sim.def.river) {
        const water = sim.tiles.filter((t) => t.kind === 'water');
        if (water.length) {
          this.duck = this.sprite(G.emojiTexture('🦆'), 0.55);
          this.duckPath = water;
          K.add(this.duck);
        }
      }
      this.buildChefs(sim);
      this.fit();
    }

    buildYard(W, H, mat, box, cyl) {
      // low walls round the yard, and a few trees and pots of herbs
      const O = this.outside;
      const leaf = mat(this.th.ice ? '#e8f4ff' : '#4f9d4a'), trunk = mat('#8a5a33');
      for (let i = 0; i < 6; i++) {
        const x = (i % 2 ? 1 : -1) * (W / 2 + 1.6 + (i % 3) * 1.1), z = -H / 2 + 1 + (i * 2.3) % (H + 1);
        cyl(0.12, 0.15, 0.8, trunk, x, 0.4, z, O);
        const cone = G.mesh(new T.ConeGeometry(0.75, 1.6, 10), leaf, x, 1.5, z, O);
        cone.castShadow = true;
      }
      if (this.th.ice) { // snowballs and a snowman
        G.mesh(new T.SphereGeometry(0.45, 14, 10), mat('#ffffff'), W / 2 + 1.2, 0.4, H / 2 - 0.5, O);
        G.mesh(new T.SphereGeometry(0.32, 14, 10), mat('#ffffff'), W / 2 + 1.2, 1.0, H / 2 - 0.5, O);
      }
    }

    buildTruck(W, H, mat, box, cyl) {
      const K = this.kitchen, O = this.outside;
      box(W + 0.4, 0.7, H + 0.4, mat(this.th.wall), 0, -0.36, 0, K);
      const tire = mat('#1f2128'), hub = mat('#d9dde3');
      this.wheels = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const w = cyl(0.55, 0.55, 0.4, tire, sx * (W / 2 - 1.6), -0.6, sz * (H / 2 + 0.1), K, 18);
          w.rotation.x = Math.PI / 2;
          const h = cyl(0.25, 0.25, 0.42, hub, 0, 0, 0, w, 12);
          h.position.set(0, 0, 0);
          this.wheels.push(w);
        }
      }
      // the cab, in front
      box(2.2, 1.6, H * 0.8, mat(this.th.wall), W / 2 + 1.3, 0.2, 0, K);
      const glass = box(0.06, 0.7, H * 0.6, mat('#9fd8ff', { roughness: 0.1 }), W / 2 + 2.42, 0.55, 0, K);
      glass.castShadow = false;
      if (this.sim.def.theme === 'party') {
        const cols = ['#ff3d7f', '#ffd23f', '#18d4ff', '#7ed957', '#9b6bff'];
        for (let i = 0; i < 8; i++) {
          const b = G.mesh(new T.SphereGeometry(0.28, 12, 10), mat(cols[i % 5], { roughness: 0.3 }), -W / 2 + 0.4 + (i * W) / 8, 2.6 + (i % 2) * 0.3, this.oz - 0.1, K);
          b.scale.y = 1.2;
          box(0.01, 0.9, 0.01, mat('#ffffff'), b.position.x, b.position.y - 0.75, b.position.z, K, false);
        }
      }
      // lamp posts and trees go by
      this.scenery = [];
      for (let i = 0; i < 10; i++) {
        const g = new T.Group();
        const side = i % 2 ? 1 : -1;
        if (i % 3) {
          G.mesh(new T.CylinderGeometry(0.12, 0.15, 0.9, 8), mat('#8a5a33'), 0, -0.3, 0, g);
          G.mesh(new T.ConeGeometry(0.8, 1.6, 10), mat('#4f9d4a'), 0, 0.9, 0, g);
        } else {
          G.mesh(new T.CylinderGeometry(0.06, 0.06, 2.8, 8), mat('#9aa3ad'), 0, 0.6, 0, g);
          G.mesh(new T.SphereGeometry(0.2, 10, 8), mat('#fff3b0', { emissive: '#ffe680', emissiveIntensity: 0.6 }), 0, 2, 0, g);
        }
        g.position.set(-30 + i * 6.5, 0, side * (H / 2 + 3.2));
        O.add(g);
        this.scenery.push(g);
      }
    }

    buildChefs(sim) {
      for (const id of ['teddy', 'tommy']) {
        if (!this.chefMeshes[id]) this.chefMeshes[id] = this.makeChef(id, CHEF, true);
        const m = this.chefMeshes[id];
        this.level.add(m.root);
        m.root.position.set(this.wx(sim.chefs[id].x), 0, this.wz(sim.chefs[id].z));
      }
      for (const id of ['teddy', 'tommy']) {
        if (!this.minis[id]) {
          const e = Kit.roster.get(id);
          this.minis[id] = this.makeChef(id, CHEF * (e.buddyScale || 0.8), false);
          const tag = G.nameTag(e.name, e.tag || '#ffd23f');
          tag.position.y = 2.45;
          tag.scale.multiplyScalar(1 / ((e.buddyScale || 0.8) * 0.9));
          this.minis[id].root.add(tag);
        }
        this.level.add(this.minis[id].root);
        this.minis[id].root.visible = false;
      }
      // the highlight on the counter each chef is facing, and the "you" marker in 1 player
      this.hl = {};
      for (const id of ['teddy', 'tommy']) {
        const ring = new T.Mesh(new T.RingGeometry(0.42, 0.5, 4, 1), new T.MeshBasicMaterial({ color: COLORS[id], transparent: true, opacity: 0.9, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.rotation.z = Math.PI / 4;
        this.level.add(ring);
        this.hl[id] = ring;
      }
      if (!this.youMark) {
        this.youMark = this.sprite(this.textTex('▼', '#ffd23f', 120), 0.5);
      }
      this.level.add(this.youMark);
    }

    makeChef(id, scale, chef) {
      const e = Kit.roster.get(id);
      const p = Kit.people.build(e.look);
      p.root.scale.setScalar(scale);
      p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      if (chef) {
        const white = G.std('#ffffff', { roughness: 0.6 });
        G.mesh(new T.CylinderGeometry(0.27, 0.27, 0.16, 18), white, 0, 0.3, 0, p.head);
        const puff = G.mesh(new T.SphereGeometry(0.34, 18, 12), white, 0, 0.52, 0, p.head);
        puff.scale.y = 0.62;
        G.mesh(new T.BoxGeometry(0.5, 0.48, 0.03), white, 0, 0.26, -0.195, p.hips);
        G.mesh(new T.BoxGeometry(0.58, 0.32, 0.03), white, 0, -0.14, -0.2, p.hips);
        const ring = new T.Mesh(new T.RingGeometry(0.42, 0.56, 28), new T.MeshBasicMaterial({ color: COLORS[id], transparent: true, opacity: 0.75, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        p.root.add(ring);
      }
      return { p, root: p.root, phase: 0, chopT: 0 };
    }

    wx(x) { return this.ox + x; }
    wz(z) { return this.oz + z; }

    sprite(tex, s) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.scale.set(s, s, 1);
      return sp;
    }
    textTex(text, color = '#ffd23f', size = 72) {
      const key = text + '|' + color + '|' + size;
      if (this.textCache[key]) return this.textCache[key];
      const [c, g] = G.makeCanvas(512, 160);
      g.font = `${size}px ${G.FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = size / 6;
      g.strokeStyle = '#14121f';
      g.lineJoin = 'round';
      let s = size;
      while (g.measureText(text).width > 490 && s > 20) { s -= 4; g.font = `${s}px ${G.FONT}`; }
      g.strokeText(text, 256, 84);
      g.fillStyle = color;
      g.fillText(text, 256, 84);
      return (this.textCache[key] = G.toTexture(c));
    }

    // ------------------------------------------------------------------ camera
    fit() {
      const sim = this.sim;
      if (!sim || !this.size[0]) return;
      const cam = this.camera, [w, h] = this.size, I = this.insets;
      const W = sim.W + (this.th && this.th.road ? 1.5 : 0.6), H = sim.H + 0.6;
      const tilt = w / h < 1.6 ? 1.1 : 0.98; // radians above the horizon: steeper on squarer screens
      const cx = this.th && this.th.road ? 0.5 : 0, cz = 0.35;
      const pts = [];
      for (const x of [-W / 2 + cx, W / 2 + cx]) for (const z of [-H / 2, H / 2 + 0.3]) for (const y of [0, 1.4]) pts.push(new T.Vector3(x, y, z));
      const left = -1 + (2 * I.left) / w, right = 1 - (2 * I.right) / w, bottom = -1 + (2 * I.bottom) / h, top = 1 - (2 * I.top) / h;
      const midX = (left + right) / 2, midY = (top + bottom) / 2;
      let lo = 4, hi = 80;
      for (let i = 0; i < 24; i++) {
        const d = (lo + hi) / 2;
        cam.position.set(cx, Math.sin(tilt) * d, cz + Math.cos(tilt) * d);
        cam.lookAt(cx, 0, cz);
        cam.updateMatrixWorld();
        cam.setViewOffset(w, h, -midX * w / 2, midY * h / 2, w, h);
        cam.updateProjectionMatrix();
        let ok = true;
        for (const p of pts) {
          const v = p.clone().project(cam);
          if (v.x < left || v.x > right || v.y < bottom || v.y > top) { ok = false; break; }
        }
        if (ok) hi = d; else lo = d;
      }
      cam.position.set(cx, Math.sin(tilt) * hi, cz + Math.cos(tilt) * hi);
      cam.lookAt(cx, 0, cz);
      this.camBase = cam.position.clone();
    }

    // ------------------------------------------------------------------ every frame
    sync(sim, dt, o = {}) {
      this.time += dt;
      const t = this.time;
      if (this.waterTex) this.waterTex.offset.x = (t * 0.15) % 1;
      for (const tex of this.beltTexes) tex.offset.x = (-t * 1.1) % 1;
      if (this.groundTex) this.groundTex.offset.x = (t * 1.6) % 1;
      if (this.wheels) for (const w of this.wheels) w.rotation.y = -t * 6;
      if (this.scenery) for (const g of this.scenery) { g.position.x -= dt * 16; if (g.position.x < -34) g.position.x += 65; }
      if (this.duck) {
        const p = this.duckPath, k = (t * 0.25) % 1, i = Math.floor(k * p.length);
        const a = p[i];
        this.duck.position.set(this.wx(a.x + 0.5), 0.25 + Math.sin(t * 3) * 0.03, this.wz(a.z + 0.5 + ((k * p.length) % 1) - 0.5));
      }
      // the kitchen settles after a bump
      this.kitchen.rotation.z *= Math.exp(-5 * dt);
      this.kitchen.position.y *= Math.exp(-6 * dt);
      if (this.camBase) {
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const s = this.shake * 0.25;
        this.camera.position.set(this.camBase.x + Math.sin(t * 47) * s, this.camBase.y + Math.sin(t * 39) * s, this.camBase.z);
      }
      this.syncChefs(sim, dt, o);
      this.syncItems(sim, dt);
      this.syncFx(sim, dt);
    }

    syncChefs(sim, dt, o) {
      const k = 1 - Math.exp(-18 * dt);
      for (const id of ['teddy', 'tommy']) {
        const c = sim.chefs[id], m = this.chefMeshes[id], p = m.p;
        m.root.position.set(this.wx(c.x), 0, this.wz(c.z));
        const want = Math.atan2(-c.fx, -c.fz);
        let d = want - m.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        m.root.rotation.y += d * Math.min(1, dt * 16);
        const sp = Math.hypot(c.vx, c.vz);
        m.phase += dt * (4 + sp * 3.2);
        const five = m.fiveT > 0 ? (m.fiveT -= dt) : 0;
        let mode = sp > 0.5 ? 'run' : 'stand';
        if (five > 0) mode = Kit.roster.signature(Kit.roster.get(id), 'hello');
        if (mode === 'boxing' || mode === 'jumpshot') mode = five > 0.6 ? 'boxing' : 'jumpshot';
        Kit.people.pose(p, mode === 'boxing' ? this.time * 7 : m.phase, mode, k);
        if (this.sim.def.ice && sp > 0.5 && mode === 'run') { p.legL.rotation.x *= 0.4; p.legR.rotation.x *= 0.4; } // gliding
        if (c.held && five <= 0) { p.armL.rotation.x = p.armR.rotation.x = 1.35; p.armL.rotation.z = -0.12; p.armR.rotation.z = 0.12; }
        if (c.working === 'chop') { p.armR.rotation.x = 1.0 + Math.abs(Math.sin(this.time * 14)) * 1.1; p.armL.rotation.x = 1.1; }
        if (c.working === 'wash') { p.armL.rotation.x = p.armR.rotation.x = 1.2; p.armL.rotation.z = -0.2 + Math.sin(this.time * 12) * 0.25; p.armR.rotation.z = 0.2 - Math.sin(this.time * 12) * 0.25; }
        if (m.throwT > 0) { m.throwT -= dt; p.armR.rotation.x = 2.6 - (0.35 - m.throwT) * 6; }
        p.rig.position.y = 0.55 + (five > 0.6 && mode === 'jumpshot' ? Math.sin((1 - five) * 6) * 0.3 : 0);
        if (c.boost > 0) this.emitTrail(m.root.position, id);
        // the highlight on the target
        const hl = this.hl[id];
        const show = !!c.target && (sim.mode === '2p' || sim.active === id) && !o.demo;
        hl.visible = show;
        if (show) hl.position.set(this.wx(c.target.x + 0.5), this.topOf(c.target) + 0.02, this.wz(c.target.z + 0.5));
      }
      const you = sim.chefs[sim.active];
      this.youMark.visible = sim.mode === '1p' && !o.demo;
      this.youMark.position.set(this.wx(you.x), 1.75 + Math.sin(this.time * 5) * 0.08, this.wz(you.z));
      // the companion
      const h = sim.helper;
      for (const id of ['teddy', 'tommy']) {
        const mm = this.minis[id];
        mm.root.visible = h.on && h.who === id;
        if (!mm.root.visible) continue;
        const p = mm.p;
        const ground = sim.tileAt(h.x, h.z);
        const hop = h.moving ? Math.abs(Math.sin(this.time * 9)) * (ground && ground.kind === 'floor' ? 0.12 : 0.7) : 0;
        mm.root.position.set(this.wx(h.x), hop, this.wz(h.z));
        mm.root.rotation.y = Math.atan2(-h.fx, -h.fz);
        mm.phase += dt * 12;
        let mode = h.moving ? 'run' : 'stand';
        if (h.phase === 'sig') {
          const sig = Kit.roster.get(id).signature || ['wave'];
          mode = sig.length > 1 ? (h.t < 0.9 ? sig[0] : sig[sig.length - 1]) : sig[0];
          if (mode === 'jumpshot') mm.root.position.y = Math.max(0, Math.sin((h.t - 0.9) * 4)) * 0.5;
          if (h.who === 'tommy' || mode === 'peace') mm.root.rotation.y = Math.atan2(this.camera.position.x - mm.root.position.x, this.camera.position.z - mm.root.position.z);
        }
        Kit.people.pose(p, mode === 'boxing' ? this.time * 7 : mm.phase, mode, k);
        if (h.phase === 'do' && h.task) {
          if (h.task.kind === 'chop') { p.armR.rotation.x = 1.0 + Math.abs(Math.sin(this.time * 18)) * 1.2; p.armL.rotation.x = 1.1; }
          else if (h.task.kind === 'wash') { p.armL.rotation.x = p.armR.rotation.x = 1.2; p.armL.rotation.z = Math.sin(this.time * 14) * 0.3; }
        }
        if (h.carry) { p.armL.rotation.x = p.armR.rotation.x = 1.4; }
      }
    }

    topOf(t) {
      const fx = this.tileFx.find((f) => f.t === t);
      return fx ? fx.y : TOP;
    }

    // ------------------------------------------------------------------ food, plates, bars
    syncItems(sim, dt) {
      const seen = new Set();
      const put = (it, x, y, z, scale = 1) => {
        if (!it) return;
        seen.add(it.id);
        if (it.k === 'ing') {
          const key = it.ing + ':' + it.st;
          let s = this.itemSprites.get(it.id);
          if (!s) { s = this.sprite(TK.icons.tex(key), 0.62); s.userData.key = key; this.items.add(s); this.itemSprites.set(it.id, s); }
          if (s.userData.key !== key) { s.material.map = TK.icons.tex(key); s.material.needsUpdate = true; s.userData.key = key; s.userData.pop = 0.25; }
          const pop = s.userData.pop > 0 ? (s.userData.pop -= dt) * 1.6 : 0;
          s.scale.setScalar(0.62 * scale * (1 + pop));
          s.position.set(x, y + 0.26 * scale, z);
          s.visible = true;
        } else if (it.k === 'plate' || it.k === 'dirty') {
          let pm = this.plateMeshes.get(it.id);
          if (!pm) {
            pm = { g: new T.Group(), discs: [], icons: [] };
            this.items.add(pm.g);
            this.plateMeshes.set(it.id, pm);
          }
          const n = it.k === 'dirty' ? Math.min(it.n, 5) : 1;
          while (pm.discs.length < n) { const d = new T.Mesh(this.plateGeo, this.plateMat); d.castShadow = true; d.position.y = pm.discs.length * 0.06 + 0.025; pm.g.add(d); pm.discs.push(d); }
          pm.discs.forEach((d, i) => { d.visible = i < n; d.material = it.k === 'dirty' ? this.dirtyMat : this.plateMat; });
          pm.g.position.set(x, y, z);
          pm.g.scale.setScalar(scale);
          pm.g.visible = true;
          // what's on it: the dish when it's done, else each part
          const dish = it.k === 'plate' && sim.dishOf(it);
          const keys = it.k !== 'plate' ? [] : dish ? [TK.RECIPES[dish].icon] : it.parts;
          const sig = keys.join(',');
          if (pm.sig !== sig) {
            for (const s of pm.icons) pm.g.remove(s);
            pm.icons = keys.map((k, i) => {
              const s = this.sprite(TK.icons.tex(k), dish ? 0.72 : 0.46);
              const a = keys.length > 1 ? (i / keys.length) * Math.PI * 2 : 0;
              s.position.set(keys.length > 1 ? Math.cos(a) * 0.15 : 0, dish ? 0.36 : 0.24, keys.length > 1 ? Math.sin(a) * 0.12 : 0);
              pm.g.add(s);
              return s;
            });
            if (pm.sig !== undefined && keys.length) pm.pop = 0.3;
            pm.sig = sig;
          }
          if (pm.pop > 0) { pm.pop -= dt; pm.g.scale.setScalar(scale * (1 + pm.pop)); }
        }
      };
      for (const f of this.tileFx) {
        const t = f.t;
        let x = f.x, z = f.z;
        if (t.kind === 'belt' && t.item) { x += t.dir[0] * (t.bp - 0.5); z += t.dir[1] * (t.bp - 0.5); }
        if (t.item) put(t.item, x, f.y, z, STATIONS_SET.has(t.kind) && t.kind !== 'pan' ? 0.85 : 1);
        // racks and returns: stacks of plates
        if (t.kind === 'rack' || t.kind === 'return' || t.kind === 'sink') {
          let st = this.stacks.get(t);
          if (!st) { st = []; this.stacks.set(t, st); }
          const n = Math.min(t.n, 8);
          while (st.length < n) {
            const d = new T.Mesh(this.plateGeo, t.kind === 'rack' ? this.plateMat : this.dirtyMat);
            d.castShadow = true;
            this.kitchen.add(d);
            st.push(d);
          }
          st.forEach((d, i) => { d.visible = i < n; d.position.set(f.x, f.y + 0.03 + i * 0.06, f.z); });
        }
        // progress bars: cooking, chopping, washing
        let prog = -1, warn = false, color = '#7ed957';
        if (STATIONS_SET.has(t.kind) && t.item) {
          const s = TK.simUtil.nextStep(t.item);
          if (s && s[0] === t.kind) { prog = t.t / TK.TIMES[t.kind]; color = '#ffd23f'; }
          else if (sim.D.burn && t.kind !== 'blend' && t.item.st !== 'crispy' && t.over > TK.TIMES.warn) { prog = 1 - (t.over - TK.TIMES.warn) / (TK.TIMES.over - TK.TIMES.warn); warn = true; color = '#ff5a3c'; }
        }
        if (t.kind === 'board' && t.item && t.item.work > 0) prog = t.item.work;
        if (t.kind === 'sink' && t.work > 0) { prog = t.work; color = '#5ac8ff'; }
        this.bar(t, f, prog, color, warn);
        if (f.glow) f.glow.material.emissiveIntensity = t.item && prog >= 0 ? 0.9 + Math.sin(this.time * 6) * 0.2 : 0.2;
      }
      for (const id of ['teddy', 'tommy']) {
        const c = sim.chefs[id];
        if (c.held) put(c.held, this.wx(c.x + c.fx * 0.45), 0.78, this.wz(c.z + c.fz * 0.45), 0.9);
      }
      const h = sim.helper;
      if (h.on && h.carry) put(h.carry, this.wx(h.x + h.fx * 0.3), 0.5, this.wz(h.z + h.fz * 0.3), 0.8);
      for (const f of sim.flying) {
        const arc = Math.sin(Math.min(1, f.d / 3.5) * Math.PI) * 0.9;
        put(f.item, this.wx(f.x), 0.7 + arc, this.wz(f.z), 0.9);
      }
      for (const l of sim.loose) put(l.item, this.wx(l.x), 0.02, this.wz(l.z), 0.85);
      // hide (and forget) what's gone
      for (const [id, s] of this.itemSprites) if (!seen.has(id)) { this.items.remove(s); s.material.dispose(); this.itemSprites.delete(id); }
      for (const [id, pm] of this.plateMeshes) if (!seen.has(id)) { this.items.remove(pm.g); this.plateMeshes.delete(id); }
    }

    bar(t, f, prog, color, warn) {
      let b = this.bars.get(t);
      if (prog < 0 || prog >= 1) { if (b) b.g.visible = false; return; }
      if (!b) {
        const g = new T.Group();
        const bg = new T.Mesh(new T.PlaneGeometry(0.78, 0.16), new T.MeshBasicMaterial({ color: '#14121f', transparent: true, opacity: 0.8, depthTest: false }));
        const fill = new T.Mesh(new T.PlaneGeometry(0.7, 0.09), new T.MeshBasicMaterial({ color, depthTest: false }));
        fill.position.z = 0.001;
        bg.renderOrder = 10; fill.renderOrder = 11;
        g.add(bg, fill);
        this.fxGroup.add(g);
        b = { g, fill };
        this.bars.set(t, b);
      }
      b.g.visible = !warn || Math.sin(this.time * 14) > -0.3;
      b.g.position.set(f.x, f.y + 0.95, f.z + 0.2);
      b.g.quaternion.copy(this.camera.quaternion);
      b.fill.scale.x = Math.max(0.001, prog);
      b.fill.position.x = -0.35 * (1 - prog);
      b.fill.material.color.set(color);
    }

    // ------------------------------------------------------------------ effects
    puff(x, y, z, color, n, o = {}) {
      for (let i = 0; i < n; i++) {
        let p = this.particles.find((q) => !q.on);
        if (!p) {
          if (this.particles.length > 220) return;
          const s = new T.Sprite(new T.SpriteMaterial({ map: this.dot, transparent: true, depthWrite: false }));
          this.fxGroup.add(s);
          p = { s };
          this.particles.push(p);
        }
        const a = Math.random() * Math.PI * 2, sp = (o.speed || 1.5) * (0.4 + Math.random() * 0.6);
        Object.assign(p, {
          on: true, life: 0, max: (o.life || 0.8) * (0.7 + Math.random() * 0.5),
          vx: Math.cos(a) * sp * (o.spread ?? 1), vz: Math.sin(a) * sp * (o.spread ?? 1), vy: (o.up || 1.5) * (0.5 + Math.random() * 0.7),
          g: o.gravity ?? 4, size: (o.size || 0.18) * (0.7 + Math.random() * 0.6), grow: o.grow || 0,
        });
        p.s.material.color.set(Array.isArray(color) ? color[i % color.length] : color);
        p.s.position.set(x + (Math.random() - 0.5) * (o.jitter || 0.2), y, z + (Math.random() - 0.5) * (o.jitter || 0.2));
        p.s.visible = true;
      }
    }
    emitTrail(pos, id) {
      if (Math.random() < 0.5) this.puff(pos.x, 0.15, pos.z, id === 'teddy' ? '#9fd0ff' : '#ffd38a', 1, { up: 0.6, speed: 0.4, life: 0.5, gravity: 0, size: 0.16 });
    }
    float(text, x, y, z, color = '#ffd23f', o = {}) {
      const s = this.sprite(this.textTex(text, color), 1);
      s.scale.set(o.w || 1.8, (o.w || 1.8) * 0.3125, 1);
      s.position.set(x, y, z);
      s.renderOrder = 12;
      s.material.depthTest = false;
      this.fxGroup.add(s);
      this.flyers.push({ s, life: 0, max: o.life || 1.3, vy: o.vy ?? 0.9, text: true });
    }
    toss(emoji, from, to) { // a treat arcs from the companion to the chef
      const s = this.sprite(G.emojiTexture(emoji), 0.55);
      this.fxGroup.add(s);
      this.flyers.push({ s, life: 0, max: 0.8, from, to, treat: true });
    }
    syncFx(sim, dt) {
      for (const p of this.particles) {
        if (!p.on) continue;
        p.life += dt;
        if (p.life >= p.max) { p.on = false; p.s.visible = false; continue; }
        p.vy -= p.g * dt;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        const k = p.life / p.max;
        p.s.scale.setScalar(p.size * (1 + p.grow * k));
        p.s.material.opacity = 1 - k * k;
      }
      for (let i = this.flyers.length - 1; i >= 0; i--) {
        const f = this.flyers[i];
        f.life += dt;
        const k = f.life / f.max;
        if (k >= 1) { this.fxGroup.remove(f.s); f.s.material.dispose(); this.flyers.splice(i, 1); continue; }
        if (f.treat) {
          const to = this.chefMeshes[f.to] ? this.chefMeshes[f.to].root.position : f.from;
          f.s.position.set(f.from.x + (to.x - f.from.x) * k, 0.9 + Math.sin(k * Math.PI) * 1.6, f.from.z + (to.z - f.from.z) * k);
        } else {
          f.s.position.y += f.vy * dt;
          f.s.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
          if (f.life < 0.15) f.s.scale.multiplyScalar(1.02);
        }
      }
      // smoke from crispy food, steam from pots, sizzle in pans, bubbles in the sink
      this.fxT = (this.fxT || 0) + dt;
      if (this.fxT > 0.12) {
        this.fxT = 0;
        for (const f of this.tileFx) {
          const t = f.t, it = t.item;
          if (it && it.st === 'crispy') this.puff(f.x, f.y + 0.3, f.z, ['#6b6b6b', '#8a8a8a', '#4f4f4f'], 1, { up: 1.1, speed: 0.15, gravity: -0.4, life: 1.4, size: 0.3, grow: 1.6 });
          else if (it && t.kind === 'pot') this.puff(f.x, f.y + 0.1, f.z, '#ffffff', 1, { up: 0.9, speed: 0.12, gravity: -0.2, life: 1, size: 0.18, grow: 1.2 });
          else if (it && t.kind === 'pan' && TK.simUtil.nextStep(it)) this.puff(f.x, f.y + 0.1, f.z, '#fff3c0', 1, { up: 1.4, speed: 0.6, life: 0.4, size: 0.07 });
          if (t.kind === 'sink' && t.work > 0) this.puff(f.x, f.y + 0.15, f.z, ['#dff4ff', '#ffffff', '#bfe8ff'], 1, { up: 0.8, speed: 0.3, gravity: -0.2, life: 0.9, size: 0.12 });
        }
      }
    }

    // a sim event happened: show it
    event(e) {
      const x = e.x != null ? this.wx(e.x) : 0, z = e.z != null ? this.wz(e.z) : 0;
      const L = Kit.lang.t;
      switch (e.type) {
        case 'chop': this.puff(x, TOP + 0.2, z, ['#7ed957', '#ffffff', '#ffd23f'], 2, { up: 1.6, speed: 1, life: 0.4, size: 0.07 }); break;
        case 'chopped': case 'done': this.puff(x, TOP + 0.4, z, ['#ffd23f', '#ffffff', '#7ed957'], 10, { up: 2, speed: 1.2, life: 0.6, size: 0.1 }); break;
        case 'crispy':
          this.puff(x, TOP + 0.4, z, ['#5a5a5a', '#7a7a7a'], 14, { up: 1.5, speed: 0.6, gravity: -0.5, life: 1.6, size: 0.35, grow: 1.5 });
          this.float(L('OOPS, CRISPY!'), x, 1.9, z, '#ffb3a0');
          break;
        case 'serve':
          this.puff(x, 1, z, ['#ffd23f', '#ffffff', '#ff8a1f'], 26, { up: 3, speed: 2, life: 0.9, size: 0.12 });
          this.float(`+${e.value + e.tip}`, x, 2, z, '#ffd23f', { w: 1.3 });
          break;
        case 'no': this.float('✋', x, 1.6, z, '#ffffff', { w: 0.9, life: 0.7 }); break;
        case 'plate': case 'land': this.puff(x, TOP + 0.3, z, '#ffffff', 5, { up: 1.2, speed: 0.8, life: 0.35, size: 0.08 }); break;
        case 'splash': this.puff(x, 0, z, ['#7fd3ff', '#ffffff'], 16, { up: 3, speed: 1.4, life: 0.7, size: 0.12 }); this.float(L('SPLOSH!'), x, 1.4, z, '#7fd3ff', { w: 1.4 }); break;
        case 'washed': this.puff(x, TOP + 0.4, z, ['#dff4ff', '#ffffff'], 8, { up: 1.5, speed: 0.6, life: 0.7, size: 0.13 }); break;
        case 'bump':
          this.shake = 1;
          this.kitchen.rotation.z = (e.dir || 1) * 0.035;
          this.kitchen.position.y = 0.12;
          this.float(L('BUMP!'), 0, 2.6, 0, '#ffd23f', { w: 2.4 });
          break;
        case 'throw': { const m = this.chefMeshes[e.by]; if (m) m.throwT = 0.35; break; }
        case 'highfive': {
          for (const id of ['teddy', 'tommy']) this.chefMeshes[id].fiveT = 1.4;
          this.float('✋', x, 2, z, '#ffffff', { w: 1.2, vy: 0.6 });
          this.puff(x, 1.6, z, ['#ffd23f', '#4a9dff', '#ffb02e'], 24, { up: 2.4, speed: 2.4, life: 0.8, size: 0.12 });
          break;
        }
        case 'treat': this.toss(e.emoji, new T.Vector3(x, 1, z), e.to); break;
        case 'helperIn': case 'helperOut': {
          const h = this.sim.helper;
          this.puff(this.wx(h.x), 0.4, this.wz(h.z), ['#ffffff', '#ffd23f'], 10, { up: 1.5, speed: 1, life: 0.6, size: 0.15 });
          break;
        }
        default: break;
      }
    }

    render() { this.renderer.render(this.scene, this.camera); }

    dispose(g) {
      // the chefs and minis are reused: take them out before anything is thrown away
      for (const id of ['teddy', 'tommy']) {
        if (this.chefMeshes[id]) this.chefMeshes[id].root.removeFromParent();
        if (this.minis[id]) this.minis[id].root.removeFromParent();
      }
      if (this.youMark) this.youMark.removeFromParent();
      g.traverse((o) => {
        if (o.geometry && o.geometry !== this.plateGeo) o.geometry.dispose();
        if (o.material && !o.isSprite && o.material !== this.plateMat && o.material !== this.dirtyMat) {
          o.material.dispose(); // icon textures are cached and shared, so only the material goes
        }
      });
      this.particles = [];
      this.flyers = [];
    }
  }
  const STATIONS_SET = new Set(['pan', 'pot', 'oven', 'blend']);
  TK.View = View;
})();
