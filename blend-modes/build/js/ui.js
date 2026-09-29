// DOM building blocks that look like screen-recorded editor UI: the blend-mode dropdown,
// a big pointer, effect-control panels with sliders / Levels histograms, an effects search
// panel, teal serif label boxes and condensed titles. Layout is measured once (see
// BM.measure) so annotations and the pointer can target real element positions.
(function () {
  const BM = window.BM;
  const el = BM.el;
  const ui = (BM.ui = {});
  ui.PANEL_W = 960; // editor panels are centred on x = 540; the 3 px border is added in layout maths

  ui.title = function (parent, text, size, color) {
    const e = el('div', 'title abs', parent, text);
    e.style.fontSize = size + 'px';
    if (color) e.style.color = color;
    return e;
  };
  ui.teal = function (parent, html, size) {
    const e = el('div', 'tealbox abs', parent, html);
    e.style.fontSize = size + 'px';
    return e;
  };
  ui.chip = (parent, text) => el('div', 'chip abs', parent, text);

  // ---- Blend-mode dropdown ----------------------------------------------------
  ui.menu = function (parent, items, opt = {}) {
    const font = opt.font || 48, line = opt.line || 66, pad = opt.pad || 22;
    const m = el('div', 'menu abs', parent);
    m.style.fontSize = font + 'px';
    m.style.padding = pad + 'px 0';
    m.style.lineHeight = line + 'px';
    if (opt.width) m.style.width = opt.width + 'px';
    if (opt.height) m.style.height = opt.height + 'px';
    const hl = el('div', 'hl', m);
    hl.style.height = line + 'px';
    const rows = {};
    let y = pad; // menu padding-top
    items.forEach((it) => {
      if (it === '-') {
        el('div', 'sep', m);
        y += 21;
      } else {
        el('div', 'item', m, it);
        rows[it] = { top: y, mid: y + line / 2 };
        y += line;
      }
    });
    return {
      el: m, rows,
      // name (or null) — highlight jumps like a real menu
      hl(name) {
        if (!name || !rows[name]) return (hl.style.display = 'none');
        hl.style.display = 'block';
        hl.style.top = rows[name].top + 'px';
      },
    };
  };

  // ---- Pointer + click ring ----------------------------------------------------
  // The arrow's tip is at (3, 2) in its 24-unit viewBox; the margins put that tip exactly on
  // the (x, y) passed to set(), whatever the size.
  const ARROW = (size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M3 2 L3 19.6 L7.6 15.4 L10.9 22.4 L14 21 L10.8 14.2 L17.2 14.2 Z" fill="#050505" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  ui.cursor = function (parent, size = 180) {
    const c = el('div', 'cursor abs', parent, ARROW(size));
    const tx = (size * 3) / 24, ty = (size * 2) / 24;
    c.style.width = c.style.height = size + 'px';
    c.style.margin = `${-ty}px 0 0 ${-tx}px`;
    c.style.transformOrigin = `${tx}px ${ty}px`;
    const ring = el('div', 'click-ring abs', parent);
    ring.style.visibility = 'hidden';
    c.style.visibility = 'hidden';
    return {
      el: c,
      // x, y = arrow tip; press 0..1 squashes the pointer
      set(x, y, o = 1, press = 0) {
        c.style.transform = `translate(${x}px, ${y}px) scale(${1 - 0.12 * press})`;
        c.style.opacity = o;
        c.style.visibility = o > 0 ? 'visible' : 'hidden';
      },
      ring(x, y, p) {
        if (p <= 0 || p >= 1) return (ring.style.visibility = 'hidden');
        ring.style.visibility = 'visible';
        ring.style.transform = `translate(${x}px, ${y}px) scale(${0.35 + p * 1.1})`;
        ring.style.opacity = 1 - p;
      },
    };
  };
  // Pointer path helper: keys = [[t, x, y], ...] (eased between), press windows = [[t0, t1], ...]
  ui.drive = function (cur, t, keys, presses = [], clicks = []) {
    const xy = BM.kf(t, keys.map(([tt, x, y, e]) => [tt, [x, y], e || 'inOutCubic']));
    let press = 0;
    presses.forEach(([a, b]) => {
      if (t >= a && t < b) press = 1;
    });
    cur.set(xy[0], xy[1], t >= keys[0][0] ? 1 : 0, press);
    let rp = 0;
    clicks.forEach((c) => {
      if (t >= c && t < c + 0.34) rp = (t - c) / 0.34;
    });
    cur.ring(xy[0], xy[1], rp);
    return xy;
  };

  // ---- Editor panel ---------------------------------------------------------------
  // spec rows: {fx:'Levels', open:true, sel:true} | {label, val, sub} | {slider:true} |
  //            {histo:[w,h]} | {levelsBar:true} | {search:'levels'}
  ui.panel = function (parent, spec) {
    const p = el('div', 'panel abs', parent);
    p.style.width = (spec.width || ui.PANEL_W) + 'px';
    const tabs = el('div', 'tabs', p);
    el('span', 'x', tabs, '×');
    el('span', 'lock', tabs);
    el('span', '', tabs, spec.tab || 'Effect Controls');
    if (spec.name) el('span', 'name', tabs, spec.name);
    el('span', 'menuicon', tabs, '≡');
    const body = el('div', 'body', p);
    const refs = {};
    (spec.rows || []).forEach((r, i) => {
      let e;
      if (r.fx) {
        e = el('div', 'row fx' + (r.sel ? ' sel' : ''), body);
        el('span', 'tw', e, r.open ? '▾' : '▸');
        el('span', 'lbl', e, r.fx);
        el('span', 'reset', e, 'Reset');
      } else if (r.slider) {
        e = el('div', 'slider', body);
        e.innerHTML = '<div class="fill"></div><div class="knob"></div>';
      } else if (r.histo) {
        e = el('canvas', 'histo', body);
        e.width = r.histo[0];
        e.height = r.histo[1];
        e.style.width = r.histo[0] + 'px';
        e.style.height = r.histo[1] + 'px';
      } else if (r.levelsBar) {
        e = el('div', '', body);
        el('div', 'gradbar', e);
        const tris = el('div', 'tris', e);
        e._b = el('div', 'tri b', tris);
        e._g = el('div', 'tri g', tris);
        e._w = el('div', 'tri', tris);
      } else if (r.search != null) {
        e = el('div', 'search', body);
        el('span', 'mag', e);
        e._txt = el('span', '', e, '');
        e._caret = el('span', 'caret', e);
      } else {
        e = el('div', 'row' + (r.sub ? ' sub' : ''), body);
        el('span', 'tw', e, r.tw || '');
        if (r.icon) el('span', 'icon', e);
        el('span', 'lbl', e, r.label);
        if (r.val != null) e._val = el('span', 'val', e, r.val);
      }
      refs[r.key || 'r' + i] = e;
    });
    return { el: p, refs, body };
  };
  ui.setSlider = function (sl, v) {
    sl.querySelector('.fill').style.width = v * 100 + '%';
    sl.querySelector('.knob').style.left = v * 100 + '%';
  };
  ui.setTris = function (bar, b, g, w) {
    bar._b.style.left = b * 100 + '%';
    bar._g.style.left = g * 100 + '%';
    bar._w.style.left = w * 100 + '%';
  };

  // Histogram into a canvas; optional dashed marker at x (0..1) with a label.
  ui.drawHisto = function (cv, bins, opt = {}) {
    const g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#111';
    g.fillRect(0, 0, w, h);
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i < 256; i++) g.lineTo((i / 255) * w, h - 8 - bins[i] * (h - 30));
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = opt.fill || '#c9c9c9';
    g.fill();
    if (opt.mark != null) {
      const x = opt.mark * w;
      g.setLineDash([12, 10]);
      g.lineWidth = 4;
      g.strokeStyle = opt.markColor || '#f5e27a';
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x, 34);
      g.stroke();
      g.setLineDash([]);
      g.font = "600 28px 'Inter'";
      g.textAlign = 'center';
      g.fillStyle = opt.markColor || '#f5e27a';
      g.fillText(opt.markLabel || '50%', x, 26);
    }
  };

  // Position of element e relative to an ancestor `root` in layout px (ignores transforms).
  ui.offset = function (e, root) {
    let x = 0, y = 0, n = e;
    while (n && n !== root) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { x, y, w: e.offsetWidth, h: e.offsetHeight };
  };
})();
