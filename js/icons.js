/* TT Kitchen: the food pictures, painted on canvases (emoji from the device's font, plus a few drawn by hand:
   buns, patties, pizza bases, noodles, dough balls, smoothie cups and the station badges). The same pictures are
   used on the order cards (as images) and in the kitchen (as textures). No image files. */
(function () {
  'use strict';
  const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  const S = 128;
  const cache = {}, urls = {}, texes = {};

  function canvas() {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return [c, c.getContext('2d')];
  }
  function emoji(g, e, x = 64, y = 64, size = 96, rot = 0) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.font = `${size}px ${EMOJI}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, 0, size * 0.06);
    g.restore();
  }
  function disc(g, x, y, rx, ry, fill, stroke) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    if (stroke) { g.lineWidth = 5; g.strokeStyle = stroke; g.stroke(); }
  }
  // the darkening for "oops, crispy" (and a paler wash for raw folded dumplings)
  function tint(g, color, alpha) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, S, S);
    g.restore();
  }
  const INK = '#3a2414';

  const DRAW = {
    bun(g) {
      disc(g, 64, 84, 50, 18, '#c97a2c', INK);
      g.beginPath();
      g.ellipse(64, 76, 52, 44, 0, Math.PI, 0);
      g.closePath();
      g.fillStyle = '#e9a24a';
      g.fill();
      g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
      g.fillStyle = '#ffe9b8';
      for (const [x, y] of [[44, 54], [64, 44], [84, 54], [54, 64], [76, 64]]) { g.beginPath(); g.ellipse(x, y, 4, 2.5, 0.4, 0, 7); g.fill(); }
    },
    patty(g, st) {
      const col = st === 'raw' ? '#e7798a' : '#7a4325';
      disc(g, 64, 66, 52, 34, col, INK);
      if (st === 'raw') {
        g.strokeStyle = '#ffd0d8'; g.lineWidth = 4;
        for (const [x, y] of [[44, 58], [70, 52], [60, 76], [84, 70]]) { g.beginPath(); g.arc(x, y, 7, 0, 2.5); g.stroke(); }
      } else {
        g.strokeStyle = '#4a2410'; g.lineWidth = 6;
        for (const x of [40, 60, 80]) { g.beginPath(); g.moveTo(x - 6, 46); g.lineTo(x + 10, 86); g.stroke(); }
      }
    },
    pizza(g, st) {
      disc(g, 64, 66, 54, 40, st === 'raw' ? '#f4e2bd' : '#d9963e', INK);
      disc(g, 64, 66, 42, 30, st === 'raw' ? '#fff3da' : '#f2c46b');
      if (st !== 'raw') { g.fillStyle = '#c47a2a'; for (const [x, y] of [[48, 60], [72, 56], [80, 74], [56, 78]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } }
    },
    noodles(g, st) {
      if (st === 'raw') {
        g.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          g.strokeStyle = i % 2 ? '#f4cf5a' : '#e8b93a';
          g.lineWidth = 7;
          g.beginPath(); g.moveTo(26 + i * 3, 40 + i * 5); g.lineTo(96 + i * 2, 30 + i * 5); g.stroke();
        }
        g.fillStyle = '#e04f3d'; g.fillRect(56, 34, 12, 54); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(56, 34, 12, 54);
      } else {
        disc(g, 64, 76, 50, 30, '#f7d76b', INK);
        g.lineCap = 'round'; g.lineWidth = 5; g.strokeStyle = '#e5b83c';
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(26, 62 + i * 5); g.bezierCurveTo(46, 50 + i * 6, 70, 86 + i * 2, 102, 62 + i * 5); g.stroke(); }
      }
    },
    dough(g) {
      disc(g, 64, 70, 44, 36, '#fbf4e6', INK);
      disc(g, 50, 56, 12, 8, '#ffffff');
      g.fillStyle = '#4caf50'; for (const [x, y] of [[60, 74], [76, 66], [70, 84]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    },
    cup(g, fill, top) {
      g.beginPath(); g.moveTo(36, 30); g.lineTo(92, 30); g.lineTo(84, 112); g.lineTo(44, 112); g.closePath();
      g.fillStyle = fill; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(44, 40, 8, 60);
      g.strokeStyle = '#ff4f8b'; g.lineWidth = 7; g.beginPath(); g.moveTo(70, 34); g.lineTo(84, 6); g.stroke();
      emoji(g, top, 64, 30, 34);
    },
    badge(g, kind) {
      disc(g, 64, 64, 58, 58, '#fff6e2', INK);
      g.lineWidth = 6; g.strokeStyle = INK; g.fillStyle = '#3b3f4a';
      if (kind === 'chop') emoji(g, '🔪', 64, 64, 74, -0.5);
      else if (kind === 'pan') {
        disc(g, 56, 66, 32, 26, '#3b3f4a', INK);
        g.fillStyle = '#5a3a22'; g.fillRect(86, 58, 30, 12); g.strokeRect(86, 58, 30, 12);
        disc(g, 52, 62, 10, 8, '#fff'); disc(g, 52, 62, 4, 4, '#ffc531');
      } else if (kind === 'pot') {
        g.fillRect(30, 52, 68, 44); g.strokeRect(30, 52, 68, 44);
        g.fillRect(20, 58, 12, 8); g.fillRect(96, 58, 12, 8);
        g.fillStyle = '#6b7080'; g.fillRect(26, 42, 76, 12); g.strokeRect(26, 42, 76, 12);
        g.strokeStyle = '#bcd4ff'; g.lineWidth = 4;
        for (const x of [48, 64, 80]) { g.beginPath(); g.moveTo(x, 36); g.bezierCurveTo(x - 6, 28, x + 6, 22, x, 14); g.stroke(); }
      } else if (kind === 'oven') {
        g.fillStyle = '#d24c3f'; g.fillRect(24, 26, 80, 76); g.strokeRect(24, 26, 80, 76);
        g.fillStyle = '#ffcf6a'; g.fillRect(34, 48, 60, 40); g.strokeRect(34, 48, 60, 40);
        g.fillStyle = INK; for (const x of [38, 54, 70]) { g.beginPath(); g.arc(x + 8, 36, 4, 0, 7); g.fill(); }
      } else if (kind === 'blend') {
        g.fillStyle = 'rgba(160, 220, 255, 0.85)';
        g.beginPath(); g.moveTo(40, 24); g.lineTo(88, 24); g.lineTo(80, 80); g.lineTo(48, 80); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ff7aa8'; g.fillRect(50, 56, 28, 22);
        g.fillStyle = '#3b3f4a'; g.fillRect(40, 82, 48, 24); g.strokeRect(40, 82, 48, 24);
        g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(52, 66); g.lineTo(76, 70); g.stroke();
      }
    },
  };

  // the picture for an ingredient in a state, a dish, a station badge or a crate
  function paint(key) {
    const [c, g] = canvas();
    const [a, b] = key.split(':');
    const crispy = b === 'crispy';
    const st = crispy ? 'cooked' : b;
    const chopped = (e) => { emoji(g, e, 40, 50, 54, -0.3); emoji(g, e, 86, 54, 50, 0.4); emoji(g, e, 62, 88, 56, 0.1); };
    switch (a) {
      case 'bun': DRAW.bun(g); break;
      case 'patty': DRAW.patty(g, st); break;
      case 'pizza': DRAW.pizza(g, st); break;
      case 'noodles': DRAW.noodles(g, st); break;
      case 'lettuce': if (st === 'raw') emoji(g, '🥬'); else chopped('🥬'); break;
      case 'tomato': if (st === 'raw') emoji(g, '🍅'); else chopped('🍅'); break;
      case 'cheese': if (st === 'raw') emoji(g, '🧀'); else chopped('🧀'); break;
      case 'banana': if (st === 'raw') emoji(g, '🍌'); else if (st === 'chopped') chopped('🍌'); else DRAW.cup(g, '#ffe066', '🍌'); break;
      case 'strawberry': if (st === 'raw') emoji(g, '🍓'); else if (st === 'chopped') chopped('🍓'); else DRAW.cup(g, '#ff8fb1', '🍓'); break;
      case 'icecream': emoji(g, '🍦'); break;
      case 'egg': emoji(g, st === 'raw' ? '🥚' : '🍳'); break;
      case 'dumpling':
        if (st === 'raw') DRAW.dough(g);
        else { emoji(g, '🥟', 64, 70, 92); if (st === 'folded') tint(g, '#fffaf0', 0.45); }
        break;
      case 'dish':
        if (b === 'burger') emoji(g, '🍔', 64, 64, 104);
        else if (b === 'sundae') emoji(g, '🍨', 64, 64, 104);
        else if (b === 'pizza') emoji(g, '🍕', 64, 64, 104);
        else if (b === 'noodles') emoji(g, '🍜', 64, 64, 104);
        else if (b === 'dumplings') { emoji(g, '🥟', 40, 56, 64, -0.2); emoji(g, '🥟', 88, 56, 64, 0.2); emoji(g, '🥟', 64, 90, 68); }
        else if (b === 'smoothieS') DRAW.cup(g, '#ff8fb1', '🍓');
        else if (b === 'smoothieB') DRAW.cup(g, '#ffe066', '🍌');
        break;
      case 'step': DRAW.badge(g, b); break;
      default: emoji(g, '❓'); break;
    }
    if (crispy) tint(g, '#1b120c', 0.72);
    return c;
  }

  const icons = {
    canvas(key) { return cache[key] || (cache[key] = paint(key)); },
    url(key) { return urls[key] || (urls[key] = icons.canvas(key).toDataURL('image/png')); },
    tex(key) {
      if (texes[key]) return texes[key];
      const t = new THREE.CanvasTexture(icons.canvas(key));
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      return (texes[key] = t);
    },
    // the crate shows what's inside, raw
    crate: (ing) => ing + ':raw',
  };
  window.TK.icons = icons;
})();
