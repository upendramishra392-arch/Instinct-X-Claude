// The edit. Each scene starts on a spoken word (BM.cut(i) = onset of word i, see
// data/words.js) and every animation inside is keyed to word onsets, so picture and
// voice stay locked. Word indices are noted next to each cue.
(function () {
  const BM = window.BM;
  const { T, cut, seg, kf, ease, pop, place, ui, ann } = BM;
  const W = BM.W, H = BM.H;
  const S = (BM.scenes = []);
  const scene = (def) => S.push(def);

  const INK = '#1d1a1b', CREAM = '#f1e8d6', RED = '#e3372f', WHITE = '#fbfaf6';
  const FINAL_B = 24, FINAL_W = 230; // the final Levels 2 contrast (input black / white)

  // ---- helpers ----------------------------------------------------------------
  const tex = () => BM.tex;
  const label = () => BM.art.label;
  function cam(s = 1, x = W / 2, y = H / 2) {
    const hx = W / 2 / s, hy = H / 2 / s;
    return { s, x: Math.min(W - hx, Math.max(hx, x)), y: Math.min(H - hy, Math.max(hy, y)) };
  }
  const toScreen = (c, px, py) => [W / 2 + (px - c.x) * c.s, H / 2 + (py - c.y) * c.s];
  function layer(g, img, c, op = 'source-over', alpha = 1, filter) {
    g.save();
    if (filter) g.filter = filter;
    BM.drawCam(g, img, c, op, alpha);
    g.restore();
  }
  function clipRect(g, x, y, w, h, fn) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    fn();
    g.restore();
  }
  function popIn(e, t, t0, x, y, o = {}) {
    const p = pop(t, t0, o.dur || 0.2, o.from || 0.8);
    place(e, x, y, { s: p.s * (o.s || 1), o: o.until != null && t >= o.until ? 0 : p.o, ax: o.ax, ay: o.ay, r: o.r });
  }
  function slideIn(e, t, t0, x, y, o = {}) {
    const p = ease.outCubic(seg(t, t0, t0 + (o.dur || 0.24)));
    place(e, x, y + (1 - p) * 90, { s: o.s || 1, o: t < t0 ? 0 : Math.min(1, p * 1.5), ax: 0.5, ay: 0 });
  }
  function wipeLine(g, y) {
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, y - 14, W, 28);
    g.fillStyle = WHITE;
    g.fillRect(0, y - 4, W, 8);
    g.restore();
  }
  function divider(g, x) {
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x - 7, 0, 14, H);
    g.fillStyle = WHITE;
    g.fillRect(x - 4, 0, 8, H);
    g.restore();
  }
  // Menu highlight walk: keys [[name, tArrive], ...]; between keys it steps item-by-item.
  function walk(items, keys, t) {
    const names = items.filter((x) => x !== '-');
    if (t < keys[0][1]) return null;
    for (let i = keys.length - 1; i >= 0; i--) {
      const [name, ta] = keys[i];
      if (t >= ta) return name;
      const [pname, pta] = keys[i - 1] || [];
      if (i > 0 && t >= pta) {
        // stepping from pname to name, arriving at ta; leave after a short hold
        const a = names.indexOf(pname), b = names.indexOf(name);
        const leave = Math.max(pta, ta - (b - a) * 0.056);
        if (t < leave) return pname;
        return names[Math.min(b, a + 1 + Math.floor((t - leave) / 0.056))];
      }
    }
    return keys[0][0];
  }

  const ALL = ['Normal', 'Dissolve', '-', 'Darken', 'Multiply', 'Color Burn', 'Linear Burn', 'Darker Color', '-', 'Lighten', 'Screen', 'Color Dodge', 'Linear Dodge (Add)', 'Lighter Color', '-', 'Overlay', 'Soft Light', 'Hard Light', 'Vivid Light', 'Linear Light', 'Pin Light', 'Hard Mix', '-', 'Difference', 'Exclusion', 'Subtract', 'Divide'];
  const DARKEN = ['Darken', 'Multiply', 'Color Burn', 'Linear Burn', 'Darker Color'];
  const LIGHTEN = ['Lighten', 'Screen', 'Color Dodge', 'Linear Dodge (Add)', 'Lighter Color'];
  const CONTRAST = ['Overlay', 'Soft Light', 'Hard Light', 'Vivid Light', 'Linear Light', 'Pin Light', 'Hard Mix'];

  // =============================================================================
  // 1. "Your texture can look perfect,"  (0 → "then")
  scene({
    id: 'hook',
    from: 0,
    build(el, s) {
      s.svg = ann.layer(el);
      s.circle = ann.circle(s.svg, 420, 688, 196, 108, { seed: 4, width: 7, color: WHITE, rot: -0.05 });
      s.hand = ann.hand(el, 'LOOKS PERFECT', 560, 512, { size: 66, rot: -3 });
      s.check = ann.check(s.svg, 858, 500, 50, { seed: 9, width: 8, color: WHITE });
    },
    draw(g, t) {
      BM.paper(g, '#9b53a7', tex().paperA, t, { boil: 3, jitter: 10 });
      g.font = "800 250px 'Barlow Condensed'";
      const w = g.measureText('TEXTURE').width;
      if (t < cut(4)) {
        const sc = 1 + 0.07 * ease.outCubic(seg(t, 0, 1.5));
        BM.inkText(g, 'TEXTURE', 540, 960, { size: 250, color: '#2a2226', op: 'multiply', scale: sc, t, rough: 0.75 });
      } else {
        // punch in on the "T": its top-left corner lands at (390, 615)
        const z = 4.3 + 0.18 * seg(t, cut(4), cut(5));
        BM.inkText(g, 'TEXTURE', 390 + (w / 2) * z, 615 + 90 * z, { size: 250, color: '#2a2226', op: 'multiply', scale: z, t, rough: 0.6 });
      }
    },
    update(t, s) {
      s.circle.at(t, cut(4) + 0.03, 0.33); // "perfect"
      s.hand.at(t, cut(4) + 0.12, 0.4);
      s.check.at(t, cut(4) + 0.5, 0.18);
    },
  });

  // 2. "then ruin your whole design"  — flashing textures, gritty type
  const FLASH = [
    { bg: '#1c2a6e', tex: 'grunge', op: 'screen', ink: '#0c0c14', iop: 'multiply', mark: CREAM },
    { bg: '#6a1d3b', tex: 'paperB', op: 'overlay', ink: '#46a894', iop: 'source-over', mark: CREAM },
    { bg: '#f3a9d6', tex: 'crumple', op: 'multiply', ink: '#d63c34', iop: 'multiply', mark: INK },
    { bg: '#3f9d95', tex: 'paperC', op: 'overlay', ink: '#10393a', iop: 'multiply', mark: CREAM },
    { bg: '#2b39cf', tex: 'grunge', op: 'screen', ink: '#0a0a0a', iop: 'multiply', mark: CREAM },
    { bg: '#d6cbef', tex: 'crumple', op: 'multiply', ink: '#2f8c78', iop: 'multiply', mark: INK },
    { bg: '#e9622c', tex: 'paperA', op: 'overlay', ink: '#1d1a1b', iop: 'multiply', mark: INK },
    { bg: '#121214', tex: 'grunge', op: 'screen', ink: '#e9e2d3', iop: 'source-over', mark: CREAM },
  ];
  scene({
    id: 'ruin',
    from: cut(5), // "then"
    build(el, s) {
      s.svg = ann.layer(el);
      s.arrow = ann.arrow(s.svg, 640, 560, 575, 800, { bend: -70, seed: 12, width: 7, head: 36 });
    },
    draw(g, t, s) {
      const f = FLASH[Math.floor(((t - s.from) * BM.FPS) / 3) % FLASH.length];
      s.f = f;
      g.fillStyle = f.bg;
      g.fillRect(0, 0, W, H);
      BM.drawTex(g, tex()[f.tex], t, { op: f.op, boil: 3, jitter: 22, flip: true });
      g.font = "900 200px 'Archivo'";
      const size = Math.min(230, (200 * 940) / g.measureText('RUINED.').width);
      BM.inkText(g, 'RUINED.', 540, 990, { family: "'Archivo'", weight: 900, size, color: f.ink, op: f.iop, t, rough: 0.95, letterSpacing: -4 });
      BM.drawTex(g, tex().paperB, t, { op: 'overlay', alpha: 0.4, boil: 3 });
    },
    update(t, s) {
      s.arrow.color(s.f ? s.f.mark : CREAM);
      s.arrow.at(t, s.from + 0.06, 0.3);
    },
  });

  // 3. "when you lay it on top."  — the design, then a texture slapped on in Normal mode
  scene({
    id: 'layer',
    from: cut(10), // "when"
    build(el, s) {
      s.chip = BM.el('div', 'layerchip abs', el, 'Blend Mode<b>Normal</b><i>▾</i>');
      s.svg = ann.layer(el);
      s.hand = ann.hand(el, 'MUDDY.', 800, 1110, { size: 84, rot: -8 });
      s.arrow = ann.arrow(s.svg, 720, 1070, 610, 930, { bend: 40, seed: 5, width: 7 });
      s.land = T(15) - 0.03; // "top"
    },
    draw(g, t, s) {
      const push = 1 + 0.03 * seg(t, s.from, s.to);
      layer(g, label(), cam(push));
      const t0 = T(12) - 0.06; // "lay"
      if (t < t0) return;
      const p = ease.outCubic(seg(t, t0, s.land));
      const [sx, sy] = BM.shake(t, s.land, 0.22, 12, 3);
      g.save();
      g.globalAlpha = 0.86;
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 60;
      g.shadowOffsetY = 34;
      g.translate(W / 2 + sx, H / 2 - (1 - p) * H * 1.05 + sy);
      g.rotate(-(1 - p) * 0.07);
      g.drawImage(tex().muddy, -W / 2, -H / 2);
      g.restore();
    },
    update(t, s) {
      popIn(s.chip, t, s.land, 540, 214);
      s.hand.at(t, s.land + 0.12, 0.25);
      s.arrow.at(t, s.land + 0.22, 0.2);
    },
  });

  // 4. "The fix isn't a new texture,"  — texture files shuffling, crossed out
  const CARDS = [
    { tex: 'grunge', name: 'dust_scratches_04.png', r: -0.09 },
    { tex: 'crumple', name: 'crumpled_paper.jpg', r: 0.07 },
    { tex: 'paperA', name: 'riso_violet.jpg', r: -0.035, tint: '#9b53a7' },
    { tex: 'raw', name: 'concrete_grain_07.jpg', r: 0.1 },
  ];
  scene({
    id: 'not-new',
    from: cut(16), // "The"
    build(el, s) {
      s.cards = CARDS.map((c) => {
        const cv = BM.canvas(640, 820);
        const g = cv.getContext('2d');
        g.fillStyle = '#f7f4ee';
        g.fillRect(0, 0, 640, 820);
        g.save();
        g.beginPath();
        g.rect(22, 22, 596, 690);
        g.clip();
        if (c.tint) {
          g.fillStyle = c.tint;
          g.fillRect(0, 0, 640, 820);
          g.globalCompositeOperation = 'overlay';
        }
        g.drawImage(tex()[c.tex], 240, 420, 596, 690, 22, 22, 596, 690);
        g.restore();
        g.font = "500 30px 'Inter'";
        g.fillStyle = '#3b3b3b';
        g.textAlign = 'center';
        g.fillText(c.name, 320, 772);
        return cv;
      });
      s.times = [cut(16), cut(17) + 0.2, cut(18) + 0.1, cut(19) + 0.12]; // The / fix / isn't / a
      s.title = ui.title(el, 'A NEW TEXTURE?', 128);
      s.svg = ann.layer(el);
      s.strike = ann.line(s.svg, [[150, 322], [935, 304]], { color: RED, width: 11, seed: 2 });
      s.cross = ann.cross(s.svg, 540, 990, 600, { color: RED, width: 17, seed: 21 });
    },
    draw(g, t, s) {
      BM.paper(g, '#ebe3d1', tex().paperB, t, { boil: 3, jitter: 8 });
      BM.drawTex(g, tex().crumple, t, { op: 'multiply', alpha: 0.5, boil: 3, jitter: 8 });
      s.cards.forEach((cv, i) => {
        const t0 = s.times[i];
        if (t < t0) return;
        const p = ease.outCubic(seg(t, t0, t0 + 0.2));
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.35)';
        g.shadowBlur = 40;
        g.shadowOffsetY = 18;
        g.translate(540 + (1 - p) * 900 + (i - 1.5) * 14, 1000 + (i - 1.5) * 10);
        g.rotate(CARDS[i].r * p + (1 - p) * 0.35);
        g.drawImage(cv, -320, -410);
        g.restore();
      });
    },
    update(t, s) {
      popIn(s.title, t, cut(19), 540, 312); // "a"
      s.strike.at(t, T(21) - 0.02, 0.2); // "texture"
      s.cross.at(t, T(21) + 0.1, 0.36);
    },
  });

  // 5. "it's the right blend mode."  — the full blend-mode list
  scene({
    id: 'menu-all',
    from: cut(22), // "it's"
    build(el, s) {
      s.menu = ui.menu(el, ALL.slice(0, 24), { font: 38, line: 50, width: 600, height: 1170 });
      s.title = ui.title(el, 'BLEND MODES', 122);
      s.cur = ui.cursor(el);
      s.svg = ann.layer(el);
      s.top = 318;
      s.keys = [['Normal', s.from + 0.12], ['Multiply', T(24) - 0.04], ['Screen', T(25) + 0.04], ['Overlay', T(26) + 0.02]]; // right / blend / mode
      s.checks = s.keys.slice(1).map(([n], i) => ann.check(s.svg, 900, s.top + s.menu.rows[n].mid, 40, { color: RED, width: 8, seed: 30 + i }));
    },
    draw(g, t) {
      BM.paper(g, '#c9bde6', tex().paperC, t, { boil: 3, jitter: 8 });
    },
    update(t, s) {
      popIn(s.menu.el, t, s.from, 540, s.top, { ax: 0.5, ay: 0, from: 0.9, dur: 0.18 });
      popIn(s.title, t, T(25) - 0.02, 540, 214);
      const name = walk(ALL, s.keys, t);
      s.menu.hl(name);
      const y = (n) => s.top + s.menu.rows[n].mid + 8;
      ui.drive(s.cur, t, [[s.from, 960, 1500], [s.keys[0][1], 760, y('Normal')], ...s.keys.slice(1).map(([n, ta]) => [ta, 760, y(n), 'inOutSine'])]);
      s.checks.forEach((c, i) => c.at(t, s.keys[i + 1][1], 0.16));
    },
  });

  // Shared: a short blend-mode menu with a title, pointer walks to `pick` and clicks.
  function menuScene(def) {
    scene({
      id: def.id,
      from: def.from,
      build(el, s) {
        s.title = ui.title(el, def.title, 124, def.titleColor);
        s.menu = ui.menu(el, def.items, { font: 54, line: 76, width: 600 });
        s.cur = ui.cursor(el);
      },
      draw: def.draw,
      update(t, s) {
        popIn(s.title, t, s.from, 540, 540);
        popIn(s.menu.el, t, s.from, 540, 610, { ax: 0.5, ay: 0, from: 0.9, dur: 0.18 });
        const y = (n) => 610 + s.menu.rows[n].mid + 8;
        const first = def.items[0];
        const blink = t >= def.click + 0.08 && t < def.click + 0.14;
        s.menu.hl(blink ? null : t >= def.pickAt ? def.pick : t >= s.from + 0.06 ? first : null);
        ui.drive(s.cur, t, [[s.from, 930, 1420], [s.from + 0.14, 720, y(first)], [def.pickAt, 720, y(def.pick), 'outCubic']], [[def.click - 0.02, def.click + 0.08]], [def.click]);
      },
    });
  }

  // 6. "Got a texture on white?"  — page peels off to crumpled white paper
  scene({
    id: 'on-white',
    from: cut(27), // "Got"
    build(el, s) {
      s.svg = ann.layer(el);
      s.hand = ann.hand(el, 'TEXTURE', 300, 560, { size: 76, color: INK, rot: -6 });
      s.arrow = ann.arrow(s.svg, 360, 610, 505, 720, { bend: -40, color: INK, width: 7, seed: 14 });
      s.circle = ann.circle(s.svg, 600, 762, 128, 104, { color: INK, width: 7, seed: 15 });
      s.teal = ui.teal(el, 'on white', 128);
    },
    draw(g, t, s) {
      BM.drawTex(g, tex().crumple, t, { boil: 3, jitter: 4 });
      const p = seg(t, s.from, s.from + 0.34);
      if (p < 1) BM.peel(g, (c) => BM.paper(c, '#c9bde6', tex().paperC, t, { boil: 3, jitter: 8 }), p);
    },
    update(t, s) {
      s.hand.at(t, T(29), 0.25); // "texture"
      s.arrow.at(t, T(29) + 0.1, 0.22);
      s.circle.at(t, T(29) + 0.22, 0.28);
      popIn(s.teal, t, T(31) - 0.02, 540, 1200, { r: -2 }); // "white?"
    },
  });

  // 7. "Try multiply."
  menuScene({
    id: 'multiply-menu', from: cut(32), title: 'DARKEN MODES', items: DARKEN, pick: 'Multiply',
    pickAt: T(33) - 0.02, click: T(33) + 0.14, // "multiply"
    draw(g, t) {
      BM.drawTex(g, tex().crumple, t, { boil: 3, jitter: 4 });
    },
  });

  // 8. "White disappears and the dark grain stays."
  scene({
    id: 'multiply-demo',
    from: cut(34), // "White"
    build(el, s) {
      s.teal = ui.teal(el, 'Multiply', 100);
      s.svg = ann.layer(el);
      s.circle = ann.circle(s.svg, 540, 962, 210, 170, { color: WHITE, width: 8, seed: 18 });
      s.hand = ann.hand(el, 'DARK GRAIN STAYS', 540, 720, { size: 74, rot: -3 });
    },
    cam(t) {
      const z = ease.inOutCubic(seg(t, T(36), T(38) + 0.5)); // "and" → "dark"
      const [gx, gy] = BM.art.GRAIN_SPOT;
      return cam(1 + 0.85 * z, BM.lerp(540, gx, z), BM.lerp(960, gy, z));
    },
    draw(g, t, s) {
      const c = s.cam(t);
      layer(g, label(), c);
      layer(g, tex().crumple, c, 'multiply');
      const wp = ease.inOutCubic(seg(t, s.from + 0.04, T(35) + 0.52)); // over "disappears"
      if (wp < 1) {
        const y = wp * H;
        clipRect(g, 0, y, W, H - y, () => layer(g, tex().crumple, c));
        if (wp > 0) wipeLine(g, y);
      }
    },
    update(t, s) {
      popIn(s.teal, t, s.from, 540, 430);
      s.circle.at(t, T(39) - 0.02, 0.3); // "grain"
      s.hand.at(t, T(40), 0.4); // "stays"
    },
  });

  // 9. "On black?"
  scene({
    id: 'on-black',
    from: cut(41), // "On"
    build(el, s) {
      s.teal = ui.teal(el, 'on black', 128);
    },
    draw(g, t) {
      BM.drawTex(g, tex().grunge, t, { boil: 2, jitter: 16, flip: true });
    },
    update(t, s) {
      popIn(s.teal, t, T(42) - 0.02, 540, 960, { r: 2 }); // "black?"
    },
  });

  // 10. "Try screen."
  menuScene({
    id: 'screen-menu', from: cut(43), title: 'LIGHTEN MODES', titleColor: CREAM, items: LIGHTEN, pick: 'Screen',
    pickAt: T(44) - 0.02, click: T(44) + 0.14, // "screen"
    draw(g, t) {
      BM.drawTex(g, tex().grunge, t, { boil: 2, jitter: 16, flip: true });
    },
  });

  // 11. "Black drops out and the bright marks show through."
  scene({
    id: 'screen-demo',
    from: cut(45), // "Black"
    build(el, s) {
      s.teal = ui.teal(el, 'Screen', 100);
      s.svg = ann.layer(el);
      s.a1 = ann.arrow(s.svg, 700, 690, 320, 872, { bend: 60, width: 8, seed: 31 });
      s.a2 = ann.arrow(s.svg, 690, 1230, 310, 1050, { bend: -60, width: 8, seed: 32 });
      s.hand = ann.hand(el, 'BRIGHT\nMARKS', 800, 960, { size: 80, rot: -4 });
    },
    cam(t) {
      const z = ease.inOutCubic(seg(t, T(48), T(51))); // "and" → "marks"
      const [gx, gy] = BM.art.SCRATCH_SPOT;
      return cam(1 + 0.6 * z, BM.lerp(540, gx, z), BM.lerp(960, gy, z));
    },
    draw(g, t, s) {
      const c = s.cam(t);
      layer(g, label(), c);
      layer(g, tex().grunge, c, 'screen');
      const wp = ease.inOutCubic(seg(t, s.from + 0.04, T(47))); // "drops out"
      if (wp < 1) {
        const y = wp * H;
        clipRect(g, 0, y, W, H - y, () => layer(g, tex().grunge, c));
        if (wp > 0) wipeLine(g, y);
      }
    },
    update(t, s) {
      popIn(s.teal, t, s.from, 540, 430);
      s.a1.at(t, T(50), 0.26); // "bright"
      s.a2.at(t, T(50) + 0.14, 0.26);
      s.hand.at(t, T(51), 0.3); // "marks"
    },
  });

  // 12. "Overlay and soft light work differently."
  scene({
    id: 'contrast-menu',
    from: cut(54), // "Overlay"
    build(el, s) {
      s.title = ui.title(el, 'CONTRAST MODES', 124);
      s.menu = ui.menu(el, CONTRAST, { font: 52, line: 74, width: 540 });
      s.cur = ui.cursor(el);
      s.svg = ann.layer(el);
      const r = s.menu.rows;
      s.bracket = ann.bracket(s.svg, 700, 610 + r['Overlay'].top + 4, 610 + r['Soft Light'].top + 70, { color: RED, width: 8, w: 30 });
      s.hand = ann.hand(el, 'DIFFERENT\nRULES', 880, 682, { size: 62, color: RED, rot: -6 });
    },
    draw(g, t) {
      BM.paper(g, '#a3a19c', tex().paperA, t, { boil: 3, jitter: 8 });
    },
    update(t, s) {
      popIn(s.title, t, s.from, 540, 520);
      popIn(s.menu.el, t, s.from, 140, 610, { ax: 0, ay: 0, from: 0.9, dur: 0.18 });
      s.menu.hl(t >= T(56) - 0.02 ? 'Soft Light' : 'Overlay'); // "soft"
      const y = (n) => 610 + s.menu.rows[n].mid + 8;
      ui.drive(s.cur, t, [[s.from, 560, y('Overlay') + 40], [s.from + 0.2, 560, y('Overlay')], [T(56) - 0.08, 560, y('Overlay')], [T(56) + 0.04, 560, y('Soft Light'), 'outCubic']]);
      s.bracket.at(t, T(58) - 0.02, 0.24); // "work"
      s.hand.at(t, T(59), 0.34); // "differently"
    },
  });

  // 13. "Their neutral point is middle gray."
  scene({
    id: 'neutral',
    from: cut(60), // "Their"
    build(el, s) {
      s.title = ui.title(el, 'OVERLAY  ·  SOFT LIGHT', 70, CREAM);
      s.hand = ann.hand(el, 'NEUTRAL POINT', 540, 430, { size: 72, color: CREAM, rot: -2 });
      s.count = ui.teal(el, '0%', 92);
      s.svg = ann.layer(el);
      s.circle = ann.circle(s.svg, 540, 880, 128, 170, { color: RED, width: 8, seed: 41 });
      s.v = (t) => kf(t, [[s.from + 0.1, 0.03], [T(63), 0.97, 'inOutSine'], [T(64), 0.97], [T(65), 0.5, 'outBack']]); // sweep, then settle on "gray"
    },
    draw(g, t, s) {
      BM.paper(g, '#26262b', tex().paperB, t, { boil: 3, jitter: 8 });
      const x0 = 90, x1 = 990, y0 = 780, y1 = 980;
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, '#000');
      gr.addColorStop(1, '#fff');
      g.fillStyle = gr;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      clipRect(g, x0, y0, x1 - x0, y1 - y0, () => BM.drawTex(g, tex().paperC, t, { op: 'overlay', alpha: 0.35, boil: 3 }));
      g.lineWidth = 5;
      g.strokeStyle = CREAM;
      g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      g.font = "600 40px 'Barlow Condensed'";
      g.fillStyle = CREAM;
      g.textAlign = 'center';
      [0, 25, 50, 75, 100].forEach((p) => {
        const x = x0 + ((x1 - x0) * p) / 100;
        g.fillRect(x - 2, y1 + 6, 4, 18);
        g.fillText(p + '%', x, y1 + 64);
      });
      // marker
      const v = s.v(t);
      const mx = x0 + (x1 - x0) * v;
      g.fillStyle = CREAM;
      g.fillRect(mx - 3, 736, 6, 262);
      g.beginPath();
      g.moveTo(mx - 20, 720);
      g.lineTo(mx + 20, 720);
      g.lineTo(mx, 748);
      g.closePath();
      g.fill();
      // Overlay demo: colour + 50% gray = colour (real canvas compositing)
      const a = seg(t, T(64), T(64) + 0.15); // "middle"
      if (a > 0) {
        g.save();
        g.globalAlpha = a;
        const sq = (x, fill) => {
          g.fillStyle = fill;
          g.fillRect(x, 1170, 170, 170);
        };
        sq(175, '#e8732a');
        sq(455, '#808080');
        sq(735, '#e8732a');
        g.globalCompositeOperation = 'overlay';
        sq(735, '#808080');
        g.globalCompositeOperation = 'source-over';
        g.lineWidth = 4;
        g.strokeStyle = CREAM;
        [175, 455, 735].forEach((x) => g.strokeRect(x, 1170, 170, 170));
        g.font = "700 80px 'Barlow Condensed'";
        g.fillStyle = CREAM;
        g.fillText('+', 400, 1282);
        g.fillText('=', 680, 1282);
        g.font = "600 34px 'Barlow Condensed'";
        g.fillText('COLOR', 260, 1390);
        g.fillText('50% GRAY', 540, 1390);
        g.fillText('NO CHANGE', 820, 1390);
        g.restore();
      }
    },
    update(t, s) {
      popIn(s.title, t, s.from, 540, 270);
      s.hand.at(t, T(61), 0.35); // "neutral"
      const v = s.v(t);
      s.count.textContent = Math.round(v * 100) + '%';
      const settle = t >= T(65) ? pop(t, T(65) + 0.12, 0.2, 1.25).s : 1;
      popIn(s.count, t, s.from + 0.06, Math.min(900, Math.max(180, 90 + 900 * v)), 640, { s: settle });
      s.circle.at(t, T(65) + 0.1, 0.3);
    },
  });

  // 14. "If your texture isn't centered there,"  — histogram sits off-centre
  scene({
    id: 'not-centered',
    from: cut(66), // "If"
    build(el, s) {
      s.panel = ui.panel(el, { tab: 'Histogram', name: 'Grain Texture', rows: [{ histo: [832, 330], key: 'h' }, { levelsBar: true, key: 'bar' }, { label: 'Average', val: '30%', key: 'avg' }] });
      s.svg = ann.layer(el);
      s.top = 540;
    },
    layout(s) {
      const M = tex().mottled;
      const bins = BM.histogram(M.L);
      ui.drawHisto(s.panel.refs.h, bins, { mark: 0.5, markLabel: '50%' });
      ui.setTris(s.panel.refs.bar, 0, 0.5, 1);
      let peak = 0;
      for (let i = 1; i < 256; i++) if (bins[i] > bins[peak]) peak = i;
      const o = ui.offset(s.panel.refs.h, s.panel.el);
      const hx = 540 - 450 + o.x, hy = s.top + o.y;
      const px = hx + (peak / 255) * 832;
      s.circle = ann.circle(s.svg, px, hy + 190, 120, 165, { color: RED, width: 8, seed: 51 });
      s.arrow = ann.arrow(s.svg, px + 90, hy + 70, hx + 416 - 16, hy + 70, { bend: -50, color: RED, width: 8, seed: 52 });
      s.hand = ann.hand(s.el, 'OFF-CENTER', px + 20, s.top - 96, { size: 72, color: RED, rot: -4 });
    },
    draw(g, t) {
      BM.drawTex(g, tex().raw, t, { jitter: 0 });
    },
    update(t, s) {
      popIn(s.panel.el, t, s.from, 540, s.top, { ax: 0.5, ay: 0, from: 0.92, dur: 0.18 });
      s.circle.at(t, T(69), 0.3); // "isn't"
      s.hand.at(t, T(69) + 0.08, 0.3);
      s.arrow.at(t, T(70), 0.3); // "centered"
    },
  });

  // 15. "it can brighten or darken the image and shift its colors."  — before | after split
  scene({
    id: 'side-effects',
    from: cut(72), // "it"
    build(el, s) {
      s.before = ui.chip(el, 'Before');
      s.after = ui.chip(el, 'Overlay');
      s.tb = ui.teal(el, 'too bright', 76);
      s.td = ui.teal(el, 'too dark', 76);
      s.tc = ui.teal(el, 'color shift', 76);
    },
    phase(t) {
      return t < cut(75) ? 0 : t < cut(79) ? 1 : 2; // "or" / "and"
    },
    draw(g, t, s) {
      const ph = s.phase(t);
      const c = [cam(1), cam(1.22, 540, 900), cam(1.1, 540, 1040)][ph];
      layer(g, label(), c);
      clipRect(g, W / 2, 0, W / 2, H, () => {
        layer(g, label(), c);
        if (ph === 0) layer(g, tex().bright, c, 'overlay');
        if (ph === 1) layer(g, tex().raw, c, 'overlay');
        if (ph === 2) layer(g, tex().tintedN, c, 'overlay', 1, `hue-rotate(${kf(t, [[T(80), 0], [s.to, 150, 'inOutSine']]).toFixed(1)}deg)`); // "shift"
      });
      divider(g, W / 2);
    },
    update(t, s) {
      const ph = s.phase(t);
      place(s.before, 270, 112);
      place(s.after, 810, 112);
      // one label per phase, each popping on its word
      [[s.tb, T(74), -2], [s.td, T(76), 2], [s.tc, T(80), -2]].forEach(([e, t0, r], i) => {
        popIn(e, t, t0, 810, 1290, { r }); // "brighten" / "darken" / "shift"
        if (i !== ph) BM.show(e, false);
      });
    },
  });

  // 16. "So first, take out the color."  — Hue/Saturation, saturation dragged to 0
  scene({
    id: 'desaturate',
    from: cut(83), // "So"
    build(el, s) {
      s.teal = ui.teal(el, 'Step 1 · Desaturate', 90);
      s.panel = ui.panel(el, {
        name: 'Grain Texture',
        rows: [{ fx: 'Hue/Saturation', open: true, sel: true }, { label: 'Channel Control', val: 'Master' }, { label: 'Master Hue', val: '0x +0.0°' }, { label: 'Master Saturation', val: '100', key: 'sv' }, { slider: true, key: 'sl' }, { label: 'Master Lightness', val: '0' }],
      });
      s.cur = ui.cursor(el);
      s.top = 720;
      s.sat = (t) => 1 - ease.inOutCubic(seg(t, T(85) + 0.04, T(88) + 0.14)); // "take" → "color"
    },
    layout(s) {
      const o = ui.offset(s.panel.refs.sl, s.panel.el);
      s.sx0 = 540 - 450 + o.x;
      s.sw = o.w;
      s.sy = s.top + o.y + o.h / 2;
    },
    draw(g, t, s) {
      BM.drawTex(g, tex().tinted, t, { jitter: 0, filter: `saturate(${s.sat(t).toFixed(3)})` });
    },
    update(t, s) {
      const v = s.sat(t);
      popIn(s.teal, t, s.from, 540, 380, { r: -2 });
      slideIn(s.panel.el, t, T(84) - 0.02, 540, s.top); // "first"
      s.panel.refs.sv._val.textContent = Math.round(v * 100);
      ui.setSlider(s.panel.refs.sl, v);
      const kx = s.sx0 + v * s.sw;
      const t0 = T(85) + 0.04, t1 = T(88) + 0.14;
      let x, y;
      if (t < t0) [x, y] = BM.kf(t, [[T(84) + 0.2, [940, 1600]], [t0 - 0.02, [kx, s.sy], 'outCubic']]);
      else if (t < t1 + 0.1) [x, y] = [kx, s.sy];
      else [x, y] = BM.kf(t, [[t1 + 0.1, [kx, s.sy]], [t1 + 0.4, [kx + 120, s.sy + 110]]]);
      s.cur.set(x, y, t >= T(84) + 0.2 ? 1 : 0, t >= t0 - 0.02 && t < t1 + 0.1 ? 1 : 0);
    },
  });

  // 17. "Then use Levels"  — search the effects panel, grab Levels
  scene({
    id: 'search',
    from: cut(89), // "Then"
    build(el, s) {
      s.teal = ui.teal(el, 'Step 2 · Levels', 90);
      s.panel = ui.panel(el, {
        tab: 'Effects & Presets',
        rows: [{ search: '', key: 'q' }, { label: 'Animation Presets', tw: '▸', key: 'a' }, { label: 'Adjust', tw: '▾', key: 'adj' }, { label: 'Auto Levels', sub: true, icon: true, key: 'l0' }, { label: 'Levels', sub: true, icon: true, key: 'l1' }, { label: 'Levels (Per Channel)', sub: true, icon: true, key: 'l2' }],
      });
      s.ghost = BM.el('div', 'layerchip abs', el, '<span class="icon" style="display:inline-block;width:30px;height:26px;border:3px solid #9a9a9a;border-radius:5px;margin-right:14px;vertical-align:middle"></span>Levels');
      s.plus = BM.el('div', 'plus-badge abs', el, '+');
      s.cur = ui.cursor(el);
      s.top = 560;
      s.typeAt = s.from + 0.06;
    },
    layout(s) {
      const o = ui.offset(s.panel.refs.l1, s.panel.el);
      s.lx = 540 - 450 + o.x + 330;
      s.ly = s.top + o.y + o.h / 2 + 6;
    },
    draw(g, t) {
      BM.drawTex(g, tex().raw, t, { jitter: 0 });
    },
    update(t, s) {
      popIn(s.teal, t, s.from, 540, 380, { r: 2 });
      popIn(s.panel.el, t, s.from, 540, s.top, { ax: 0.5, ay: 0, from: 0.92, dur: 0.18 });
      const n = Math.max(0, Math.min(6, Math.floor((t - s.typeAt) / 0.055) + 1));
      const r = s.panel.refs;
      r.q._txt.textContent = 'levels'.slice(0, n);
      r.q._caret.style.visibility = Math.floor(t * 4) % 2 === 0 ? 'visible' : 'hidden';
      ['a', 'adj', 'l0', 'l1', 'l2'].forEach((k) => (r[k].style.visibility = n >= 3 ? 'visible' : 'hidden'));
      const tClick = T(91) + 0.08; // "levels"
      r.l1.classList.toggle('hot', t >= T(91) - 0.04);
      const drop = [560, 1280];
      const xy = ui.drive(s.cur, t, [[s.from + 0.1, 960, 1560], [T(91) - 0.04, s.lx, s.ly, 'outCubic'], [tClick + 0.06, s.lx, s.ly], [s.to - 0.02, drop[0], drop[1], 'inOutSine']], [[tClick - 0.02, s.to]], [tClick]);
      const dragging = t >= tClick + 0.06;
      place(s.ghost, xy[0] - 40, xy[1] - 20, { ax: 0, ay: 0.5, o: dragging ? 0.92 : 0 });
      place(s.plus, xy[0] + 70, xy[1] + 70, { o: t >= tClick + 0.2 ? 1 : 0 });
    },
  });

  // 18. "to move the texture's main tones toward middle gray."  — Levels gamma
  scene({
    id: 'gamma',
    from: cut(92), // "to"
    build(el, s) {
      s.count = ui.teal(el, '30%', 124);
      s.panel = ui.panel(el, {
        name: 'Grain Texture',
        rows: [{ fx: 'Hue/Saturation' }, { fx: 'Levels', open: true, sel: true }, { label: 'Channel', val: 'RGB' }, { histo: [832, 280], key: 'h' }, { levelsBar: true, key: 'bar' }, { label: 'Input Black', val: '0.0' }, { label: 'Input White', val: '255.0' }, { label: 'Gamma', val: '1.00', key: 'gam' }],
      });
      s.cur = ui.cursor(el);
      s.svg = ann.layer(el);
      s.underline = ann.line(s.svg, [[420, 425], [665, 418]], { width: 8, seed: 61 });
      s.top = 560;
      s.t0 = T(93) + 0.12; // "move"
      s.t1 = T(100) - 0.06; // "gray"
      s.gamma = (t) => kf(t, [[s.t0, 1], [s.t1, BM.GAMMA_N, 'inOutCubic']]);
    },
    layout(s) {
      const M = tex().mottled;
      const bins = BM.histogram(M.L);
      ui.drawHisto(s.panel.refs.h, bins);
      const o = ui.offset(s.panel.refs.h, s.panel.el);
      const hx = 540 - 450 + o.x, hy = s.top + o.y;
      let peak = 0;
      for (let i = 1; i < 256; i++) if (bins[i] > bins[peak]) peak = i;
      s.circle = ann.circle(s.svg, hx + (peak / 255) * 832, hy + 170, 118, 140, { color: RED, width: 8, seed: 62 });
      const b = ui.offset(s.panel.refs.bar, s.panel.el);
      s.bx = 540 - 450 + b.x;
      s.bw = b.w;
      s.by = s.top + b.y + 62;
    },
    draw(g, t, s) {
      BM.drawTex(g, BM.levels(tex().mottled, 0, 255, s.gamma(t)), t, { jitter: 0 });
    },
    update(t, s) {
      const gm = s.gamma(t);
      const lut = BM.levelsLUT(0, 255, gm);
      const pct = Math.round(BM.meanOf(tex().mottled.L, lut) * 100);
      s.count.textContent = pct + '%';
      const bounce = t >= s.t1 ? pop(t, s.t1, 0.22, 1.3).s : 1;
      popIn(s.count, t, s.from, 540, 380, { s: bounce, r: -2 });
      popIn(s.panel.el, t, s.from, 540, s.top, { ax: 0.5, ay: 0, from: 0.92, dur: 0.18 });
      s.panel.refs.gam._val.textContent = gm.toFixed(2);
      const gpos = Math.pow(0.5, gm);
      ui.setTris(s.panel.refs.bar, 0, gpos, 1);
      const tx = s.bx + gpos * s.bw;
      let xy;
      if (t < s.t0) xy = BM.kf(t, [[s.from + 0.1, [960, 1600]], [s.t0 - 0.04, [tx, s.by], 'outCubic']]);
      else if (t < s.t1 + 0.12) xy = [tx, s.by];
      else xy = BM.kf(t, [[s.t1 + 0.12, [tx, s.by]], [s.t1 + 0.45, [tx + 150, s.by + 140]]]);
      s.cur.set(xy[0], xy[1], t >= s.from + 0.1 ? 1 : 0, t >= s.t0 - 0.03 && t < s.t1 + 0.12 ? 1 : 0);
      s.circle.at(t, T(96) - 0.02, 0.3); // "main tones"
      s.underline.at(t, s.t1 + 0.08, 0.22);
    },
  });

  // 19. "Now the pattern comes through without taking over the image."
  scene({
    id: 'result',
    from: cut(101), // "Now"
    build(el, s) {
      s.teal = ui.teal(el, 'Overlay', 100);
      s.svg = ann.layer(el);
      s.circle = ann.circle(s.svg, 450, 830, 200, 160, { width: 8, seed: 71 });
      s.hand = ann.hand(el, 'PATTERN', 300, 606, { size: 74, rot: -5 });
      s.check = ann.check(s.svg, 492, 598, 48, { width: 8, seed: 72 });
      s.left = ui.chip(el, 'Overlay');
      s.right = ui.chip(el, 'Normal');
      s.split = cut(106); // "without"
    },
    draw(g, t, s) {
      if (t < s.split) {
        const c = cam(1 + 0.07 * seg(t, s.from, s.split), 540, 900);
        layer(g, label(), c);
        layer(g, tex().neutral, c, 'overlay');
        return;
      }
      const sx = kf(t, [[s.split, W], [T(108), W / 2, 'outCubic']]); // → "over"
      layer(g, label(), cam());
      layer(g, tex().neutral, cam(), 'overlay');
      clipRect(g, sx, 0, W - sx, H, () => layer(g, tex().muddy, cam(), 'source-over', 0.86));
      if (sx < W) divider(g, sx);
    },
    update(t, s) {
      const a = t < s.split;
      popIn(s.teal, t, s.from, 540, 430, { until: s.split });
      s.circle.at(t, T(103) - 0.02, 0.3); // "pattern"
      s.hand.at(t, T(103) + 0.1, 0.3);
      s.check.at(t, T(104), 0.16);
      [s.circle, s.check].forEach((d) => d.paths.forEach((p) => (p.style.display = a ? '' : 'none')));
      s.hand.el.style.display = a ? '' : 'none';
      popIn(s.left, t, T(108), 270, 112, { from: 0.9 });
      popIn(s.right, t, T(108), 810, 112, { from: 0.9 });
    },
  });

  // 20. "Want more punch?"
  scene({
    id: 'punch',
    from: cut(111), // "Want"
    draw(g, t, s) {
      const cols = ['#f0539c', '#2f3fd0', '#ee6a2c', '#f0539c', '#3f9d95'];
      const k = Math.floor(((t - s.from) * BM.FPS) / 3);
      const [dx, dy] = BM.shake(t, T(113), 0.3, 18, 9);
      g.save();
      g.translate(dx, dy);
      BM.paper(g, cols[k % cols.length], tex().paperA, t, { boil: 3, jitter: 20 });
      const slam = (t0) => (t < t0 ? 0 : 1 + 0.55 * (1 - ease.outCubic(seg(t, t0, t0 + 0.14))));
      const m = slam(T(112) - 0.02), p = slam(T(113) - 0.02); // "more" / "punch"
      if (m) BM.inkText(g, 'MORE', 540, 800, { size: 330, color: '#141217', op: 'multiply', scale: m, t, rough: 0.8 });
      if (p) BM.inkText(g, 'PUNCH?', 540, 1090, { size: 330, color: '#141217', op: 'multiply', scale: p, t, rough: 0.8 });
      g.restore();
    },
  });

  // 21. "Add a final Levels adjustment and tune the contrast until it feels right."
  scene({
    id: 'final-levels',
    from: cut(114), // "Add"
    build(el, s) {
      s.panel = ui.panel(el, {
        name: 'Grain Texture',
        rows: [{ fx: 'Hue/Saturation' }, { fx: 'Levels' }, { fx: 'Levels 2', open: true, sel: true, key: 'l2' }, { histo: [832, 240], key: 'h' }, { levelsBar: true, key: 'bar' }, { label: 'Input Black', val: '0.0', key: 'ib' }, { label: 'Input White', val: '255.0', key: 'iw' }],
      });
      s.cur = ui.cursor(el);
      s.svg = ann.layer(el);
      s.check = ann.check(s.svg, 930, 900, 76, { width: 10, seed: 81 });
      s.S = 0.86;
      s.top = 96;
      s.inB = (t) => kf(t, [[T(120), 0], [T(122) + 0.1, FINAL_B, 'inOutCubic']]); // "tune" → "contrast"
      s.inW = (t) => kf(t, [[T(122) + 0.3, 255], [T(124), FINAL_W, 'inOutCubic']]); // → "it"
    },
    layout(s) {
      const M = tex().mottled;
      ui.drawHisto(s.panel.refs.h, BM.histogram(M.L, BM.levelsLUT(0, 255, BM.GAMMA_N)));
      const b = ui.offset(s.panel.refs.bar, s.panel.el);
      const l2 = ui.offset(s.panel.refs.l2, s.panel.el);
      s.full = s.panel.el.offsetHeight;
      s.clipped = s.full - l2.y; // hide from "Levels 2" down until it's added
      const X = (lx) => 540 + (lx - 450) * s.S, Y = (ly) => s.top + ly * s.S;
      s.bx = X(b.x);
      s.bw = b.w * s.S;
      s.by = Y(b.y + 62);
    },
    draw(g, t, s) {
      const c = cam(1 + 0.08 * seg(t, s.from, s.to), 540, 1080);
      layer(g, label(), c);
      layer(g, BM.levels(tex().mottled, s.inB(t), s.inW(t), BM.GAMMA_N), c, 'overlay');
    },
    update(t, s) {
      const ib = s.inB(t), iw = s.inW(t);
      const r = s.panel.refs;
      slideIn(s.panel.el, t, s.from, 540, s.top, { s: s.S });
      const reveal = ease.outCubic(seg(t, T(116) - 0.02, T(116) + 0.26)); // "final"
      s.panel.el.style.clipPath = `inset(0 0 ${((1 - reveal) * s.clipped).toFixed(1)}px 0 round 26px)`;
      r.l2.classList.toggle('sel', Math.floor((t - T(116)) * 6) % 2 === 0 || t > T(117));
      r.ib._val.textContent = ib.toFixed(1);
      r.iw._val.textContent = iw.toFixed(1);
      const gp = (ib + (iw - ib) * 0.5) / 255;
      ui.setTris(r.bar, ib / 255, gp, iw / 255);
      const xb = s.bx + (ib / 255) * s.bw, xw = s.bx + (iw / 255) * s.bw;
      const tb0 = T(120), tb1 = T(122) + 0.1, tw0 = T(122) + 0.3, tw1 = T(124);
      let xy;
      if (t < tb0) xy = BM.kf(t, [[T(118), [960, 1500]], [tb0 - 0.04, [xb, s.by], 'outCubic']]);
      else if (t < tb1 + 0.04) xy = [xb, s.by];
      else if (t < tw0) xy = BM.kf(t, [[tb1 + 0.04, [xb, s.by]], [tw0 - 0.03, [xw, s.by]]]);
      else if (t < tw1 + 0.08) xy = [xw, s.by];
      else xy = BM.kf(t, [[tw1 + 0.08, [xw, s.by]], [tw1 + 0.4, [xw - 60, s.by + 170]]]);
      const press = (t >= tb0 - 0.03 && t < tb1 + 0.04) || (t >= tw0 - 0.02 && t < tw1 + 0.08) ? 1 : 0;
      s.cur.set(xy[0], xy[1], t >= T(118) ? 1 : 0, press);
      s.check.at(t, T(125), 0.2); // "feels"
    },
  });

  // 22. "Same texture,"  — Normal vs Overlay, one texture
  scene({
    id: 'same',
    from: cut(127), // "Same"
    build(el, s) {
      s.left = ui.chip(el, 'Normal');
      s.right = ui.chip(el, 'Overlay');
      s.svg = ann.layer(el);
      s.hand = ann.hand(el, 'SAME TEXTURE', 540, 770, { size: 74, rot: -3 });
      s.a1 = ann.arrow(s.svg, 440, 1060, 250, 1220, { bend: -30, width: 8, seed: 91 });
      s.a2 = ann.arrow(s.svg, 640, 1060, 830, 1220, { bend: 30, width: 8, seed: 92 });
    },
    draw(g, t) {
      layer(g, label(), cam());
      layer(g, tex().muddy, cam(), 'source-over', 0.86);
      clipRect(g, W / 2, 0, W / 2, H, () => {
        layer(g, label(), cam());
        layer(g, BM.levels(tex().mottled, FINAL_B, FINAL_W, BM.GAMMA_N), cam(), 'overlay');
      });
      divider(g, W / 2);
      // the one texture, as a swatch
      g.save();
      g.beginPath();
      g.arc(540, 960, 124, 0, Math.PI * 2);
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 30;
      g.fillStyle = WHITE;
      g.fill();
      g.restore();
      g.save();
      g.beginPath();
      g.arc(540, 960, 112, 0, Math.PI * 2);
      g.clip();
      g.drawImage(tex().raw, 300, 700, 480, 520, 428, 848, 224, 224);
      g.restore();
    },
    update(t, s) {
      place(s.left, 270, 112);
      place(s.right, 810, 112);
      s.hand.at(t, s.from + 0.04, 0.3);
      s.a1.at(t, T(128), 0.22); // "texture"
      s.a2.at(t, T(128) + 0.1, 0.22);
    },
  });

  // 23. "cleaner result."
  scene({
    id: 'cleaner',
    from: cut(129), // "cleaner"
    build(el, s) {
      s.teal = ui.teal(el, 'Cleaner result.', 108);
      s.svg = ann.layer(el);
      s.under = ann.line(s.svg, [[300, 1330], [790, 1318]], { width: 9, seed: 99 });
    },
    draw(g, t, s) {
      const c = cam(1.03 + 0.05 * seg(t, s.from, BM.DURATION), 540, 960);
      layer(g, label(), c);
      layer(g, BM.levels(tex().mottled, FINAL_B, FINAL_W, BM.GAMMA_N), c, 'overlay');
    },
    update(t, s) {
      popIn(s.teal, t, T(130) - 0.04, 540, 1240, { r: -2 }); // "result"
      s.under.at(t, T(130) + 0.12, 0.26);
    },
  });
})();
