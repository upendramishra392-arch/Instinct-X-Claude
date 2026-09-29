// Hand-drawn annotations: wobbly SVG strokes that draw on over time (circle with overshoot,
// arrows, crosses, checks, brackets, underlines) and handwritten labels revealed per letter.
(function () {
  const BM = window.BM;
  const NS = 'http://www.w3.org/2000/svg';
  const ann = (BM.ann = {});

  ann.layer = function (parent) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'ann');
    s.setAttribute('viewBox', `0 0 ${BM.W} ${BM.H}`);
    parent.appendChild(s);
    return s;
  };

  const d = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const plen = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

  // A drawable made of one or more polylines, drawn sequentially by length.
  function drawable(svg, strokes, opt) {
    const color = opt.color || '#fff', width = opt.width || 7;
    const lens = strokes.map(plen);
    const total = lens.reduce((a, b) => a + b, 0);
    const paths = strokes.map((pts) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d(pts));
      p.setAttribute('pathLength', '1');
      p.style.stroke = color;
      p.style.strokeWidth = width;
      p.style.strokeDasharray = '1 1';
      svg.appendChild(p);
      return p;
    });
    const obj = {
      paths,
      set(pr) {
        let acc = 0;
        paths.forEach((p, i) => {
          const a = acc / total, b = (acc + lens[i]) / total;
          acc += lens[i];
          const q = BM.clamp((pr - a) / (b - a));
          p.style.visibility = q > 0 ? 'visible' : 'hidden';
          p.style.strokeDashoffset = 1 - q;
        });
      },
      color(c) {
        paths.forEach((p) => (p.style.stroke = c));
      },
      // draw between t0 and t0+dur (eased), hidden before t0
      at(t, t0, dur = 0.3) {
        obj.set(BM.ease.outCubic(BM.seg(t, t0, t0 + dur)));
      },
    };
    obj.set(0);
    return obj;
  }

  function wobble(seed) {
    const r = BM.rng(seed);
    const a = [r() * 6, r() * 6, r() * 6];
    return (u) => Math.sin(u * 7 + a[0]) * 0.5 + Math.sin(u * 13 + a[1]) * 0.3 + Math.sin(u * 23 + a[2]) * 0.2;
  }

  // Ellipse drawn like a quick marker loop: starts a little off, overshoots past the start.
  ann.circle = function (svg, cx, cy, rx, ry, opt = {}) {
    const wob = wobble(opt.seed || 1);
    const turns = opt.turns || 1.14, rot = opt.rot == null ? -0.08 : opt.rot;
    const a0 = opt.start == null ? -2.2 : opt.start;
    const pts = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = a0 + u * turns * Math.PI * 2;
      const grow = 1 + (u - 0.5) * 0.09 + wob(u) * 0.035;
      const x = Math.cos(a) * rx * grow, y = Math.sin(a) * ry * grow;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return drawable(svg, [pts], opt);
  };

  // Curved arrow from (x1,y1) to (x2,y2); bend is the perpendicular offset of the control point.
  ann.arrow = function (svg, x1, y1, x2, y2, opt = {}) {
    const bend = opt.bend == null ? 60 : opt.bend;
    const wob = wobble(opt.seed || 3);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
    const cx = mx + nx * bend, cy = my + ny * bend;
    const shaft = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const x = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2;
      const y = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2;
      shaft.push([x + nx * wob(u) * 3, y + ny * wob(u) * 3]);
    }
    // Head aligned with the curve's end tangent (control point → tip).
    const dx = x2 - cx, dy = y2 - cy, dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl, h = opt.head || 34;
    const left = [[x2 - ux * h - uy * h * 0.62, y2 - uy * h + ux * h * 0.62], [x2, y2]];
    const right = [[x2, y2], [x2 - ux * h + uy * h * 0.62, y2 - uy * h - ux * h * 0.62]];
    return drawable(svg, [shaft, left, right], opt);
  };

  ann.line = function (svg, pts, opt = {}) {
    const wob = wobble(opt.seed || 5);
    const out = [];
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1];
      const L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
      // wobble scales with the segment, so short strokes (checks) stay one clean flick
      const amp = Math.min(4, L * 0.02);
      for (let i = s ? 1 : 0; i <= 10; i++) {
        const u = i / 10;
        out.push([ax + (bx - ax) * u + nx * wob(u + s) * amp, ay + (by - ay) * u + ny * wob(u + s) * amp]);
      }
    }
    return drawable(svg, [out], opt);
  };

  ann.cross = function (svg, cx, cy, size, opt = {}) {
    const s = size / 2;
    const a = [[cx - s, cy - s * 0.9], [cx + s * 1.05, cy + s]];
    const b = [[cx + s * 0.95, cy - s], [cx - s, cy + s * 1.05]];
    const mk = (p, seed) => {
      const wob = wobble(seed), out = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        out.push([p[0][0] + (p[1][0] - p[0][0]) * u + wob(u) * 5, p[0][1] + (p[1][1] - p[0][1]) * u - wob(u) * 5]);
      }
      return out;
    };
    return drawable(svg, [mk(a, opt.seed || 8), mk(b, (opt.seed || 8) + 1)], opt);
  };

  ann.check = function (svg, cx, cy, size, opt = {}) {
    const s = size;
    return ann.line(svg, [[cx - s * 0.5, cy], [cx - s * 0.12, cy + s * 0.42], [cx + s * 0.62, cy - s * 0.55]], opt);
  };

  // Right-facing curly bracket spanning y1..y2 at x.
  ann.bracket = function (svg, x, y1, y2, opt = {}) {
    const w = opt.w || 34, m = (y1 + y2) / 2;
    const pts = [];
    const seg = (a, b, c, n = 16) => {
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        pts.push([(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * b[0] + u * u * c[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * b[1] + u * u * c[1]]);
      }
    };
    seg([x, y1], [x + w, y1], [x + w, y1 + (m - y1) * 0.4]);
    seg([x + w, y1 + (m - y1) * 0.4], [x + w, m], [x + w * 1.9, m]);
    seg([x + w * 1.9, m], [x + w, m], [x + w, m + (y2 - m) * 0.6]);
    seg([x + w, m + (y2 - m) * 0.6], [x + w, y2], [x, y2]);
    return drawable(svg, [pts], opt);
  };

  // Handwritten label, revealed letter by letter.
  ann.hand = function (parent, text, x, y, opt = {}) {
    const e = BM.el('div', 'hand abs', parent);
    e.style.fontSize = (opt.size || 64) + 'px';
    e.style.color = opt.color || '#fff';
    if (opt.font) e.style.fontFamily = opt.font;
    if (opt.halo) e.style.textShadow = '0 0 3px rgba(14,12,12,0.9), 0 0 10px rgba(14,12,12,0.55)';
    const spans = [...text].map((ch) => BM.el('span', '', e, ch === '\n' ? '<br>' : ch));
    BM.place(e, x, y, { ax: opt.ax == null ? 0.5 : opt.ax, ay: 0.5, r: opt.rot || 0 });
    const obj = {
      el: e,
      set(p) {
        const n = Math.ceil(p * spans.length - 1e-6);
        spans.forEach((s, i) => s.classList.toggle('on', i < n));
      },
      at(t, t0, dur) {
        obj.set(BM.seg(t, t0, t0 + (dur || spans.length * 0.035)));
      },
    };
    obj.set(0);
    return obj;
  };
})();
