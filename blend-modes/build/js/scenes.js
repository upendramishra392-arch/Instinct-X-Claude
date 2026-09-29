// The edit. Each scene starts on a spoken word (BM.cut(i) = onset of word i, see
// data/words.js) and every animation inside is keyed to word onsets, so picture and
// voice stay locked. Word indices are noted next to each cue.
(function () {
  const BM = window.BM;
  const { T, cut, seg, kf, ease, pop, place, ui, ann } = BM;
  const W = BM.W, H = BM.H;
  const S = (BM.scenes = []);
  const scene = (def) => S.push(def);

  const INK = '#1d1a1b', CREAM = '#f1e8d6', RED = '#c01f26', WHITE = '#fbfaf6';
  const FINAL_B = 24, FINAL_W = 230; // the final Levels 2 contrast (input black / white)
  const PX = 540 - BM.ui.PANEL_W / 2 + 3; // left inner edge of a centred editor panel (inside its 3 px border)
  const HW = BM.ui.PANEL_W - 68; // histogram width (panel minus its 34 px side margins)

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
    place(e, x, y + (1 - p) * 90, { s: o.s || 1, o: t < t0 ? 0 : 1, ax: 0.5, ay: 0 }); // opaque from its first frame; only the rise animates
  }
  function wipeLine(g, y) {
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, y - 14, W, 28);
    g.fillStyle = WHITE;
    g.fillRect(0, y - 4, W, 8);
    g.restore();
  }
  function divider(g, x, gap) {
    const spans = gap ? [[0, gap[0]], [gap[1], H]] : [[0, H]];
    g.save();
    spans.forEach(([a, b]) => {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x - 7, a, 14, b - a);
      g.fillStyle = WHITE;
      g.fillRect(x - 4, a, 8, b - a);
    });
    g.restore();
  }
  const ALL = ['Normal', 'Dissolve', '-', 'Darken', 'Multiply', 'Color Burn', 'Linear Burn', 'Darker Color', '-', 'Lighten', 'Screen', 'Color Dodge', 'Linear Dodge (Add)', 'Lighter Color', '-', 'Overlay', 'Soft Light', 'Hard Light', 'Vivid Light', 'Linear Light', 'Pin Light', 'Hard Mix', '-', 'Difference', 'Exclusion', 'Subtract', 'Divide'];
  const DARKEN = ['Darken', 'Multiply', 'Color Burn', 'Linear Burn', 'Darker Color'];
  const LIGHTEN = ['Lighten', 'Screen', 'Color Dodge', 'Linear Dodge (Add)', 'Lighter Color'];
  const CONTRAST = ['Overlay', 'Soft Light', 'Hard Light', 'Vivid Light', 'Linear Light', 'Pin Light', 'Hard Mix'];

  // =============================================================================
  // 1. "Your texture can look perfect,"  (0 → "then") — the texture on its own, as a print
  scene({
    id: 'hook',
    from: 0,
    build(el, s) {
      // The hero texture (kraft grain with folds) as a photo print. It's the same sheet that
      // later lands on the design in Normal mode.
      const cw = 820, ch = 1180;
      s.card = BM.canvas(cw, ch);
      const c = s.card.getContext('2d');
      c.fillStyle = '#f7f4ee';
      BM.rr(c, 0, 0, cw, ch, 16);
      c.fill();
      c.save();
      BM.rr(c, 20, 20, cw - 40, ch - 110, 8);
      c.clip();
      c.drawImage(tex().muddy, 130, 300, cw - 40, ch - 110, 20, 20, cw - 40, ch - 110);
      c.restore();
      c.font = "500 30px 'Inter'";
      c.fillStyle = '#3b3b3b';
      c.textAlign = 'center';
      c.fillText('kraft_grain_texture.jpg', cw / 2, ch - 38);
      s.svg = ann.layer(el);
      s.circle = ann.circle(s.svg, 540, 930, 250, 190, { seed: 4, width: 8, color: WHITE, rot: -0.05 });
      s.hand = ann.hand(el, 'LOOKS PERFECT', 520, 640, { size: 82, rot: -3 });
      s.check = ann.check(s.svg, 876, 626, 62, { seed: 9, width: 10, color: WHITE });
    },
    draw(g, t, s) {
      BM.paper(g, '#2a2628', tex().paperB, t, { boil: 4, jitter: 3 });
      g.save();
      if (t < cut(4)) {
        // the print sits on the desk, kicks on "texture" and drifts in
        const kick = t >= cut(1) ? 0.07 * (1 - ease.outCubic(seg(t, cut(1), cut(1) + 0.18))) : 0;
        const [dx, dy] = BM.shake(t, cut(1), 0.16, 8, 5);
        const sc = 1 + 0.05 * ease.inOutSine(seg(t, 0, cut(4))) + kick;
        g.translate(540 + dx, 900 + dy);
        g.rotate(-0.04);
        g.scale(sc, sc);
        g.shadowColor = 'rgba(0,0,0,0.55)';
        g.shadowBlur = 60;
        g.shadowOffsetY = 30;
      } else {
        // "perfect": punch in on the grain
        const z = 2.6 + 0.12 * seg(t, cut(4), cut(5));
        g.translate(540, 960);
        g.scale(z, z);
        g.rotate(-0.04);
        g.translate(0, 60);
      }
      g.drawImage(s.card, -s.card.width / 2, -s.card.height / 2);
      g.restore();
    },
    update(t, s) {
      s.circle.at(t, cut(4) + 0.03, 0.33); // "perfect"
      s.hand.at(t, cut(4) + 0.1, 0.4);
      s.check.at(t, cut(4) + 0.5, 0.18);
    },
  });

  // 2. "then ruin your whole design"  — on every word the design is buried under another
  //    texture in Normal mode; a rubber stamp lands on "ruin".
  const RUIN = [
    { tex: 'muddy', alpha: 0.86 }, // then
    { tex: 'violet', alpha: 0.8 }, // ruin
    { tex: 'crumpleClean', alpha: 0.8 }, // your
    { tex: 'raw', alpha: 0.86 }, // whole
    { tex: 'grunge', alpha: 0.8 }, // design
  ];
  scene({
    id: 'ruin',
    from: cut(5), // "then"
    build(el, s) {
      s.violet = BM.canvas();
      BM.paper(s.violet.getContext('2d'), '#9b53a7', tex().paperA, 0, { jitter: 0 });
      s.stamp = BM.canvas(900, 330);
      const c = s.stamp.getContext('2d');
      c.strokeStyle = c.fillStyle = '#d8322a';
      c.lineWidth = 16;
      BM.rr(c, 20, 20, 860, 290, 26);
      c.stroke();
      c.font = "900 190px 'Archivo'";
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.letterSpacing = '6px';
      c.fillText('RUINED', 450, 176);
      c.globalCompositeOperation = 'destination-out';
      c.globalAlpha = 0.9;
      c.drawImage(tex().speck, 60, 700, 900, 330, 0, 0, 900, 330);
      s.beats = [5, 6, 7, 8, 9].map(cut); // then / ruin / your / whole / design
    },
    draw(g, t, s) {
      const k = Math.max(0, s.beats.filter((b) => t >= b).length - 1);
      const look = RUIN[k];
      const [dx, dy] = BM.shake(t, s.beats[k], 0.12, 10, 20 + k);
      const c = Object.assign(cam(1.04 + 0.04 * seg(t, s.from, s.to)), { dx, dy });
      layer(g, label(), c);
      layer(g, look.tex === 'violet' ? s.violet : tex()[look.tex], c, 'source-over', look.alpha);
      if (t >= cut(6)) {
        const p = seg(t, cut(6), cut(6) + 0.14); // "ruin"
        const sc = 1 + 0.5 * (1 - ease.outCubic(p));
        g.save();
        g.translate(540, 960);
        g.rotate(-0.16);
        g.scale(sc, sc);
        g.globalAlpha = 0.95;
        g.drawImage(s.stamp, -450, -165);
        g.restore();
      }
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
      const t0 = T(11); // "you" — accelerates and lands on "top"
      if (t < t0) return;
      const p = ease.inQuad(seg(t, t0, s.land));
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
      BM.paper(g, '#ebe3d1', tex().paperB, t, { boil: 4, jitter: 3 });
      BM.drawTex(g, tex().crumpleClean, t, { op: 'multiply', alpha: 0.5, boil: 4, jitter: 3 });
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
      s.strike.at(t, cut(21), 0.2); // "texture"
      s.cross.at(t, T(21) + 0.1, 0.36);
    },
  });

  // 5. "it's the right blend mode."  — the full blend-mode list
  scene({
    id: 'menu-all',
    from: cut(22), // "it's"
    build(el, s) {
      s.menu = ui.menu(el, ALL.slice(0, 22), { font: 38, line: 50, width: 600, height: 1100 });
      s.title = ui.title(el, 'BLEND MODES', 122);
      s.cur = ui.cursor(el, 230);
      s.svg = ann.layer(el);
      s.top = 318;
      s.keys = [['Normal', s.from + 0.12], ['Multiply', T(24) - 0.04], ['Screen', T(25) + 0.04], ['Overlay', T(26) + 0.02]]; // right / blend / mode
      s.checks = s.keys.slice(1).map(([n], i) => ann.check(s.svg, 790, s.top + s.menu.rows[n].mid, 50, { color: RED, width: 9, seed: 30 + i }));
    },
    draw(g, t) {
      BM.paper(g, '#c9bde6', tex().paperC, t, { boil: 4, jitter: 3 });
    },
    update(t, s) {
      popIn(s.menu.el, t, s.from, 540, s.top, { ax: 0.5, ay: 0, from: 0.9, dur: 0.18 });
      popIn(s.title, t, cut(25), 540, 214);
      const y = (n) => s.top + s.menu.rows[n].mid + 8;
      const xy = ui.drive(s.cur, t, [[s.from, 960, 1500], [s.keys[0][1], 760, y('Normal')], ...s.keys.slice(1).map(([n, ta]) => [ta, 760, y(n), 'inOutSine'])]);
      // the highlight is whatever row the pointer is over, so the two never drift apart
      const ry = xy[1] - 8 - s.top, R = s.menu.rows;
      s.menu.hl(t < s.keys[0][1] - 0.04 ? null : Object.keys(R).find((n) => ry >= R[n].top && ry < R[n].top + 50) || null);
      s.checks.forEach((c, i) => c.at(t, s.keys[i + 1][1], 0.16));
      // clear the page before the next scene peels it away
      const out = 1 - seg(t, s.to - 0.15, s.to);
      if (out < 1) {
        s.menu.el.style.opacity = out;
        s.title.style.opacity = +s.title.style.opacity * out;
        s.cur.el.style.opacity = out;
      }
      s.svg.style.opacity = out;
    },
  });

  // Shared: a short blend-mode menu with a title, pointer walks to `pick` and clicks.
  function menuScene(def) {
    scene({
      id: def.id,
      from: def.from,
      build(el, s) {
        s.title = ui.title(el, def.title, 124, def.titleColor);
        s.menu = ui.menu(el, def.items, { font: 64, line: 96, width: 780, pad: 50 });
        s.cur = ui.cursor(el, 250);
      },
      draw: def.draw,
      update(t, s) {
        popIn(s.title, t, s.from, 540, 430);
        popIn(s.menu.el, t, s.from, 540, 520, { ax: 0.5, ay: 0, from: 0.9, dur: 0.18 });
        const y = (n) => 520 + s.menu.rows[n].mid + 8;
        const first = def.items[0];
        const blink = t >= def.click + 0.08 && t < def.click + 0.14;
        s.menu.hl(blink ? null : t >= def.pickAt ? def.pick : t >= s.from + 0.06 ? first : null);
        ui.drive(s.cur, t, [[s.from, 940, 1420], [s.from + 0.14, 780, y(first)], [def.pickAt, 780, y(def.pick), 'outCubic']], [[def.click - 0.02, def.click + 0.08]], [def.click]);
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
      BM.drawTex(g, tex().crumple, t, { boil: 4, jitter: 3 });
      const p = seg(t, s.from, s.from + 0.34);
      if (p < 1) BM.peel(g, (c) => BM.paper(c, '#c9bde6', tex().paperC, t, { boil: 4, jitter: 3 }), p);
    },
    update(t, s) {
      s.hand.at(t, T(29), 0.25); // "texture"
      s.arrow.at(t, T(29) + 0.1, 0.22);
      s.circle.at(t, T(29) + 0.22, 0.28);
      popIn(s.teal, t, cut(31), 540, 1200); // "white?"
    },
  });

  // 7. "Try multiply."
  menuScene({
    id: 'multiply-menu', from: cut(32), title: 'DARKEN MODES', items: DARKEN, pick: 'Multiply',
    pickAt: cut(33), click: T(33) + 0.14, // "multiply"
    draw(g, t) {
      BM.drawTex(g, tex().crumple, t, { boil: 4, jitter: 3 });
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
      s.circle.at(t, cut(39), 0.3); // "grain"
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
      BM.drawTex(g, tex().grunge, t, { boil: 4, jitter: 3 });
    },
    update(t, s) {
      popIn(s.teal, t, cut(42), 540, 960); // "black?"
    },
  });

  // 10. "Try screen."
  menuScene({
    id: 'screen-menu', from: cut(43), title: 'LIGHTEN MODES', titleColor: CREAM, items: LIGHTEN, pick: 'Screen',
    pickAt: cut(44), click: T(44) + 0.14, // "screen"
    draw(g, t) {
      BM.drawTex(g, tex().grunge, t, { boil: 4, jitter: 3 });
    },
  });

  // 11. "Black drops out and the bright marks show through."
  scene({
    id: 'screen-demo',
    from: cut(45), // "Black"
    build(el, s) {
      s.teal = ui.teal(el, 'Screen', 100);
      s.svg = ann.layer(el);
      const [sx, sy] = toScreen(s.cam(T(51)), ...BM.art.SCRATCH_SPOT);
      s.a2 = ann.circle(s.svg, sx + 10, sy, 170, 230, { width: 8, seed: 31 });
      s.a1 = ann.arrow(s.svg, 560, 1300, sx + 110, sy + 215, { bend: -40, width: 8, seed: 32 });
      s.hand = ann.hand(el, 'BRIGHT MARKS', 640, 1350, { size: 80, rot: -4, halo: true });
    },
    cam(t) {
      const z = ease.inOutCubic(seg(t, T(47), T(50) - 0.04)); // "out" → "bright"
      const [gx, gy] = BM.art.SCRATCH_SPOT;
      return cam(1 + 0.6 * z, BM.lerp(540, gx, z), BM.lerp(960, gy, z));
    },
    draw(g, t, s) {
      const c = s.cam(t);
      layer(g, label(), c);
      layer(g, tex().grunge, c, 'screen', 0.86 + 0.14 * BM.hash(BM.boil(t, 2), 7)); // film flicker
      const wp = ease.inOutCubic(seg(t, s.from + 0.04, T(47))); // "drops out"
      if (wp < 1) {
        const y = wp * H;
        clipRect(g, 0, y, W, H - y, () => layer(g, tex().grunge, c));
        if (wp > 0) wipeLine(g, y);
      }
    },
    update(t, s) {
      popIn(s.teal, t, s.from, 540, 430);
      s.a2.at(t, T(50), 0.26); // "bright"
      s.a1.at(t, T(51), 0.22); // "marks"
      s.hand.at(t, T(51), 0.3);
    },
  });

  // 12. "Overlay and soft light work differently."
  scene({
    id: 'contrast-menu',
    from: cut(54), // "Overlay"
    build(el, s) {
      s.title = ui.title(el, 'CONTRAST MODES', 124);
      s.menu = ui.menu(el, CONTRAST, { font: 62, line: 92, width: 640, pad: 40 });
      s.cur = ui.cursor(el, 250);
      s.svg = ann.layer(el);
      const r = s.menu.rows;
      const b0 = 520 + r['Overlay'].top + 6, b1 = 520 + r['Soft Light'].top + 86;
      s.bracket = ann.bracket(s.svg, 714, b0, b1, { color: RED, width: 9, w: 32 });
      s.hand = ann.hand(el, 'DIFFERENT\nRULES', 885, b1 + 150, { size: 66, color: RED, rot: -6 });
    },
    draw(g, t) {
      BM.paper(g, '#cfccc8', tex().paperA, t, { boil: 4, jitter: 3 });
    },
    update(t, s) {
      popIn(s.title, t, s.from, 540, 430);
      popIn(s.menu.el, t, s.from, 60, 520, { ax: 0, ay: 0, from: 0.9, dur: 0.18 });
      s.menu.hl(t >= cut(56) ? 'Soft Light' : 'Overlay'); // "soft"
      const y = (n) => 520 + s.menu.rows[n].mid + 8;
      ui.drive(s.cur, t, [[s.from, 560, y('Overlay') + 40], [s.from + 0.2, 560, y('Overlay')], [T(56) - 0.08, 560, y('Overlay')], [T(56) + 0.04, 560, y('Soft Light'), 'outCubic']]);
      s.bracket.at(t, cut(58), 0.24); // "work"
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
      s.circle = ann.circle(s.svg, 540, 905, 128, 180, { color: RED, width: 8, seed: 41 });
      s.v = (t) => kf(t, [[s.from + 0.1, 0.03], [T(63), 0.97, 'inOutSine'], [T(64), 0.97], [T(65), 0.5, 'outCubic']]); // sweep, then settle on "gray"
    },
    draw(g, t, s) {
      BM.paper(g, '#26262b', tex().paperB, t, { boil: 4, jitter: 3 });
      const x0 = 90, x1 = 990, y0 = 780, y1 = 980;
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, '#000');
      gr.addColorStop(1, '#fff');
      g.fillStyle = gr;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      clipRect(g, x0, y0, x1 - x0, y1 - y0, () => BM.drawTex(g, tex().paperC, t, { op: 'overlay', alpha: 0.35, boil: 4 }));
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
      const a = seg(t, T(65) + 0.05, T(65) + 0.2); // after the marker settles on "gray"
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
      s.panel = ui.panel(el, { tab: 'Histogram', name: 'Grain Texture', rows: [{ histo: [HW, 330], key: 'h' }, { levelsBar: true, key: 'bar' }, { label: 'Average luminance', val: '30%', key: 'avg' }] });
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
      const hx = PX + o.x, hy = s.top + 3 + o.y;
      const px = hx + (peak / 255) * HW;
      s.circle = ann.circle(s.svg, px, hy + 190, 120, 165, { color: RED, width: 8, seed: 51 });
      s.arrow = ann.arrow(s.svg, px + 20, hy + 120, hx + HW / 2 - 14, hy + 120, { bend: -14, head: 24, color: RED, width: 9, seed: 52 });
      s.hand = ann.hand(s.el, 'OFF-CENTER', px + 20, s.top - 96, { size: 72, color: RED, rot: -4, halo: true });
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
      return t < cut(76) ? 0 : t < cut(80) ? 1 : 2; // "darken" / "shift"
    },
    draw(g, t, s) {
      const ph = s.phase(t);
      const c = cam(1.1, 540, 1040);
      layer(g, label(), c);
      clipRect(g, W / 2, 0, W / 2, H, () => {
        layer(g, label(), c);
        if (ph === 0) layer(g, tex().bright, c, 'overlay');
        if (ph === 1) layer(g, tex().raw, c, 'overlay');
        if (ph === 2) layer(g, tex().tintedN, c, 'overlay', 1, `hue-rotate(${kf(t, [[cut(80), 0], [s.to, 60, 'inOutSine']]).toFixed(1)}deg)`); // "shift"
      });
      divider(g, W / 2);
    },
    update(t, s) {
      const ph = s.phase(t);
      place(s.before, 270, 345);
      place(s.after, 810, 345);
      // one label per phase, each popping on its word
      [[s.tb, T(74), 0], [s.td, T(76), 0], [s.tc, T(80), 0]].forEach(([e, t0, r], i) => {
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
        rows: [{ fx: 'Hue/Saturation', open: true, sel: true }, { label: 'Channel Control', val: 'Master' }, { label: 'Master Hue', val: '0x +0.0°' }, { label: 'Master Saturation', val: '0', key: 'sv' }, { slider: true, key: 'sl' }, { label: 'Master Lightness', val: '0' }],
      });
      s.cur = ui.cursor(el, 190);
      s.top = 720;
      s.sat = (t) => 1 - ease.inOutCubic(seg(t, T(85) + 0.04, T(88) + 0.14)); // "take" → "color"
    },
    layout(s) {
      const o = ui.offset(s.panel.refs.sl, s.panel.el);
      s.sx0 = PX + o.x;
      s.sw = o.w;
      s.sy = s.top + 3 + o.y + o.h / 2;
    },
    draw(g, t, s) {
      // colour laid over the raw texture's luminance, so saturation 0 is exactly the grey texture of the next steps
      BM.drawTex(g, tex().raw, t, { jitter: 0 });
      BM.drawTex(g, tex().tinted, t, { jitter: 0, op: 'color', alpha: s.sat(t) });
    },
    update(t, s) {
      const v = s.sat(t);
      popIn(s.teal, t, s.from, 540, 380);
      slideIn(s.panel.el, t, cut(84), 540, s.top); // "first"
      s.panel.refs.sv._val.textContent = Math.round((v - 1) * 100); // 0 → -100, like the real control
      ui.setSlider(s.panel.refs.sl, 0.5 * v);
      const kx = s.sx0 + 0.5 * v * s.sw;
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
        rows: [{ search: '', key: 'q' }, { label: 'Animation Presets', tw: '▸', key: 'a' }, { label: 'Color Correction', tw: '▾', key: 'adj' }, { label: 'Auto Levels', sub: true, icon: true, key: 'l0' }, { label: 'Levels', sub: true, icon: true, key: 'l1' }, { label: 'Levels (Individual Controls)', sub: true, icon: true, key: 'l2' }],
      });
      s.ghost = BM.el('div', 'layerchip abs', el, '<span class="icon" style="display:inline-block;width:30px;height:26px;border:3px solid #9a9a9a;border-radius:5px;margin-right:14px;vertical-align:middle"></span>Levels');
      s.plus = BM.el('div', 'plus-badge abs', el, '+');
      s.cur = ui.cursor(el, 190);
      s.top = 560;
      s.typeAt = s.from + 0.06;
    },
    layout(s) {
      const o = ui.offset(s.panel.refs.l1, s.panel.el);
      s.lx = PX + o.x + 330;
      s.ly = s.top + 3 + o.y + o.h / 2 + 6;
    },
    draw(g, t) {
      BM.drawTex(g, tex().raw, t, { jitter: 0 });
    },
    update(t, s) {
      popIn(s.teal, t, s.from, 540, 380);
      popIn(s.panel.el, t, s.from, 540, s.top, { ax: 0.5, ay: 0, from: 0.92, dur: 0.18 });
      const n = Math.max(0, Math.min(6, Math.floor((t - s.typeAt) / 0.055) + 1));
      const r = s.panel.refs;
      r.q._txt.textContent = 'levels'.slice(0, n);
      r.q._caret.style.visibility = Math.floor(t * 4) % 2 === 0 ? 'visible' : 'hidden';
      ['a', 'adj', 'l0', 'l1', 'l2'].forEach((k) => (r[k].style.visibility = n >= 3 ? 'visible' : 'hidden'));
      const tClick = T(91) + 0.08; // "levels"
      r.l1.classList.toggle('hot', t >= T(91) - 0.04);
      const drop = [560, 900]; // onto the effect controls that open next
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
      s.count = ui.teal(el, 'avg 30%', 116);
      s.panel = ui.panel(el, {
        name: 'Grain Texture',
        rows: [{ fx: 'Hue/Saturation' }, { fx: 'Levels', open: true, sel: true }, { label: 'Channel', val: 'RGB' }, { histo: [HW, 280], key: 'h' }, { levelsBar: true, key: 'bar' }, { label: 'Input Black', val: '0.0' }, { label: 'Input White', val: '255.0' }, { label: 'Gamma', val: '1.00', key: 'gam' }],
      });
      s.cur = ui.cursor(el, 190);
      s.svg = ann.layer(el);
      s.underline = ann.line(s.svg, [[330, 492], [750, 484]], { width: 8, seed: 61 });
      s.top = 560;
      s.t0 = cut(93); // "move"
      s.t1 = T(100) - 0.06; // "gray"
      s.gamma = (t) => kf(t, [[s.t0, 1], [s.t1, BM.GAMMA_N, 'outQuad']]);
    },
    layout(s) {
      const M = tex().mottled;
      const bins = BM.histogram(M.L);
      ui.drawHisto(s.panel.refs.h, bins);
      const o = ui.offset(s.panel.refs.h, s.panel.el);
      const hx = PX + o.x, hy = s.top + 3 + o.y;
      let peak = 0;
      for (let i = 1; i < 256; i++) if (bins[i] > bins[peak]) peak = i;
      s.circle = ann.circle(s.svg, hx + (peak / 255) * HW, hy + 170, 118, 140, { color: RED, width: 9, seed: 62 });
      // the triangles' own track (inside the bar's side margins), not the bar container
      const tr = ui.offset(s.panel.refs.bar._b.parentNode, s.panel.el);
      s.bx = PX + tr.x;
      s.bw = tr.w;
      s.by = s.top + 3 + tr.y + 24;
      const gx = s.bx + Math.pow(0.5, BM.GAMMA_N) * s.bw;
      s.midArrow = ann.arrow(s.svg, gx + 190, s.by + 150, gx + 12, s.by + 22, { bend: 30, color: RED, width: 9, head: 28, seed: 63 });
      s.midLabel = ann.hand(s.el, 'MIDDLE GRAY', gx + 330, s.by + 175, { size: 64, color: RED, rot: -4, halo: true });
    },
    draw(g, t, s) {
      BM.drawTex(g, BM.levels(tex().mottled, 0, 255, s.gamma(t)), t, { jitter: 0 });
    },
    update(t, s) {
      const gm = s.gamma(t);
      const lut = BM.levelsLUT(0, 255, gm);
      const pct = Math.round(BM.meanOf(tex().mottled.L, lut) * 100);
      s.count.textContent = 'avg ' + pct + '%';
      const bounce = t >= s.t1 ? pop(t, s.t1, 0.22, 1.3).s : 1;
      popIn(s.count, t, s.from, 540, 380, { s: bounce });
      popIn(s.panel.el, t, s.from, 540, s.top, { ax: 0.5, ay: 0, from: 0.92, dur: 0.18 });
      s.panel.refs.gam._val.textContent = gm.toFixed(2);
      const gpos = Math.pow(0.5, gm);
      ui.setTris(s.panel.refs.bar, 0, gpos, 1);
      const tx = s.bx + gpos * s.bw;
      let xy;
      if (t < s.t0) xy = BM.kf(t, [[s.from, [560, 900]], [s.t0 - 0.03, [tx, s.by], 'outCubic']]); // picks up from the Levels drop point
      else if (t < s.t1 + 0.12) xy = [tx, s.by];
      else xy = BM.kf(t, [[s.t1 + 0.12, [tx, s.by]], [s.t1 + 0.45, [tx + 150, s.by + 140]]]);
      s.cur.set(xy[0], xy[1], t >= s.from ? 1 : 0, t >= s.t0 - 0.03 && t < s.t1 + 0.12 ? 1 : 0);
      s.circle.at(t, cut(96), 0.3); // "main tones"
      s.underline.at(t, s.t1 + 0.08, 0.22);
      s.midArrow.at(t, T(99), 0.22); // "middle"
      s.midLabel.at(t, T(99) + 0.06, 0.3);
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
      s.check = ann.check(s.svg, 520, 590, 64, { width: 10, seed: 72 });
      s.left = ui.chip(el, 'Normal');
      s.right = ui.chip(el, 'Overlay');
      s.split = cut(106); // "without"
    },
    draw(g, t, s) {
      const z = t < s.split ? seg(t, s.from, s.split) : 1 - ease.inOutCubic(seg(t, s.split, T(108)));
      const c = cam(1 + 0.07 * z, 540, BM.lerp(960, 900, z));
      layer(g, label(), c);
      layer(g, tex().neutral, c, 'overlay');
      if (t < s.split) return;
      const sx = kf(t, [[s.split, 0], [T(108), W / 2, 'outCubic']]); // Normal wipes in from the left → "over"
      clipRect(g, 0, 0, sx, H, () => layer(g, tex().muddy, c, 'source-over', 0.86));
      if (sx > 0) divider(g, sx);
    },
    update(t, s) {
      const a = t < s.split;
      popIn(s.teal, t, s.from, 540, 430, { until: s.split });
      s.circle.at(t, cut(103), 0.3); // "pattern"
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
      const cols = ['#f0539c', '#2f3fd0', '#ee6a2c'];
      const k = t < cut(112) ? 0 : t < cut(113) ? 1 : 2; // "more" / "punch"
      const [dx, dy] = BM.shake(t, T(113), 0.3, 18, 9);
      g.save();
      g.translate(dx, dy);
      BM.paper(g, cols[k % cols.length], tex().paperA, t, { boil: 4, jitter: 3 });
      const slam = (t0) => (t < t0 ? 0 : 1 + 0.55 * (1 - ease.outCubic(seg(t, t0, t0 + 0.14))));
      const m = slam(cut(112)), p = slam(cut(113)); // "more" / "punch"
      if (m) BM.inkText(g, 'MORE', 540, 800, { size: 330, color: '#141217', op: 'multiply', scale: m, t, rough: 0.3 });
      if (p) BM.inkText(g, 'PUNCH?', 540, 1090, { size: 330, color: '#141217', op: 'multiply', scale: p, t, rough: 0.3 });
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
        rows: [{ fx: 'Hue/Saturation' }, { fx: 'Levels' }, { fx: 'Levels 2', open: true, sel: true, key: 'l2' }, { histo: [HW, 240], key: 'h' }, { levelsBar: true, key: 'bar' }, { label: 'Input Black', val: '0.0', key: 'ib' }, { label: 'Input White', val: '255.0', key: 'iw' }],
      });
      s.cur = ui.cursor(el, 190);
      s.svg = ann.layer(el);
      s.check = ann.check(s.svg, 930, 960, 96, { color: RED, width: 12, seed: 81 });
      s.more = ann.hand(el, 'MORE CONTRAST', 540, 900, { size: 78, rot: -3, halo: true });
      s.S = 0.9;
      s.top = 96;
      s.inB = (t) => kf(t, [[T(120), 0], [T(122) + 0.1, FINAL_B, 'inOutCubic']]); // "tune" → "contrast"
      s.inW = (t) => kf(t, [[T(122) + 0.3, 255], [T(124), FINAL_W, 'inOutCubic']]); // → "it"
    },
    layout(s) {
      const M = tex().mottled;
      ui.drawHisto(s.panel.refs.h, BM.histogram(tex().neutralSrc.L));
      const tr = ui.offset(s.panel.refs.bar._b.parentNode, s.panel.el);
      const l2 = ui.offset(s.panel.refs.l2, s.panel.el);
      s.full = s.panel.el.offsetHeight;
      s.clipped = s.full - l2.y; // hide from "Levels 2" down until it's added
      const X = (lx) => 540 + (lx + 3 - BM.ui.PANEL_W / 2) * s.S, Y = (ly) => s.top + (ly + 3) * s.S;
      s.bx = X(tr.x);
      s.bw = tr.w * s.S;
      s.by = Y(tr.y + 24);
    },
    draw(g, t, s) {
      const c = cam(1 + 0.08 * seg(t, s.from, s.to), 540, 1080);
      layer(g, label(), c);
      layer(g, BM.levels(tex().neutralSrc, s.inB(t), s.inW(t), 1), c, 'overlay');
    },
    update(t, s) {
      const ib = s.inB(t), iw = s.inW(t);
      const r = s.panel.refs;
      slideIn(s.panel.el, t, s.from, 540, s.top, { s: s.S });
      const reveal = ease.outCubic(seg(t, cut(116), T(116) + 0.26)); // "final"
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
      s.cur.set(xy[0], xy[1], t < T(118) ? 0 : 1 - seg(t, T(125), T(125) + 0.2), press); // leaves once it feels right
      s.more.at(t, T(122), 0.35); // "contrast"
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
      s.hand = ann.hand(el, 'SAME TEXTURE', 540, 770, { size: 74, rot: -3, halo: true });
      s.a1 = ann.arrow(s.svg, 440, 1060, 250, 1220, { bend: -30, width: 8, seed: 91 });
      s.a2 = ann.arrow(s.svg, 640, 1060, 830, 1220, { bend: 30, width: 8, seed: 92 });
    },
    draw(g, t) {
      layer(g, label(), cam());
      layer(g, tex().muddy, cam(), 'source-over', 0.86);
      clipRect(g, W / 2, 0, W / 2, H, () => {
        layer(g, label(), cam());
        layer(g, BM.levels(tex().neutralSrc, FINAL_B, FINAL_W, 1), cam(), 'overlay');
      });
      divider(g, W / 2, [700, 840]); // gap for the label
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
      g.drawImage(tex().muddy, 300, 700, 480, 520, 428, 848, 224, 224);
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
      s.teal = ui.teal(el, 'Cleaner result.', 104);
      s.svg = ann.layer(el);
      s.under = ann.line(s.svg, [[110, 1430], [700, 1418]], { width: 9, seed: 99 });
      s.chip = ui.chip(el, 'Overlay');
    },
    draw(g, t, s) {
      // same framing as the comparison, then the Normal half wipes off and the result settles in
      const c = cam(1 + 0.05 * ease.inOutSine(seg(t, T(130), BM.DURATION)), 540, 960);
      layer(g, label(), c);
      layer(g, BM.levels(tex().neutralSrc, FINAL_B, FINAL_W, 1), c, 'overlay');
      const wx = kf(t, [[s.from, W / 2], [T(130) - 0.04, 0, 'inOutCubic']]); // → "result"
      if (wx > 1) {
        clipRect(g, 0, 0, wx, H, () => layer(g, tex().muddy, c, 'source-over', 0.86));
        divider(g, wx);
      }
    },
    update(t, s) {
      place(s.chip, 810, 112, { o: t < T(130) - 0.04 ? 1 : 0 });
      popIn(s.teal, t, T(130) - 0.04, 400, 1340); // "result"
      s.under.at(t, T(130) + 0.12, 0.26);
    },
  });
})();
