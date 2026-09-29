// Core helpers: math, easing, seeded randomness, keyframes, voiceover cues, canvas utils.
// Everything that animates is a pure function of time t (seconds) so any frame can be
// rendered in isolation — the renderer seeks frame-by-frame at 18 fps.
(function () {
  const BM = (window.BM = window.BM || {});
  BM.W = 1080;
  BM.H = 1920;
  BM.FPS = 18;
  BM.DURATION = 48; // 864 frames; voiceover is 47.72s
  BM.FRAMES = Math.round(BM.DURATION * BM.FPS);

  const clamp = (BM.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)));
  BM.lerp = (a, b, t) => a + (b - a) * t;
  BM.seg = (t, a, b) => clamp((t - a) / (b - a));

  const E = (BM.ease = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outBack: (x) => {
      const c1 = 1.9, c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
  });

  // Piecewise keyframes: kf(t, [[t0, v0], [t1, v1, 'ease'], ...]); values may be numbers or arrays.
  BM.kf = function (t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) {
        const f = (E[e || 'inOutCubic'])(t1 === t0 ? 1 : (t - t0) / (t1 - t0));
        return Array.isArray(v0) ? v0.map((x, j) => x + (v1[j] - x) * f) : v0 + (v1 - v0) * f;
      }
    }
    return keys[keys.length - 1][1];
  };

  // Seeded PRNG (mulberry32) and integer hash.
  BM.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  BM.hash = function (a, b = 0, c = 0) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  // ---- Voiceover cues -------------------------------------------------------
  const WORDS = window.BM_WORDS.words;
  BM.words = WORDS;
  BM.T = (i) => WORDS[i].start; // word i onset
  BM.TE = (i) => WORDS[i].end; // word i end
  BM.frameOf = (t) => Math.round(t * BM.FPS);

  // Visual cuts lead the spoken onset by half a frame, so every cut and caption lands on
  // the frame nearest the onset (round(start * fps)) and is never late.
  BM.LEAD = 0.5 / BM.FPS;
  BM.cut = (i) => WORDS[i].start - BM.LEAD;

  // ---- Small animation helpers ---------------------------------------------
  // Pop-in: returns {s, o} scale/opacity for an element appearing at t0.
  BM.pop = function (t, t0, dur = 0.2, from = 0.82) {
    if (t < t0) return { s: from, o: 0, on: false };
    const p = clamp((t - t0) / dur);
    // full opacity from the first frame (a hard cut never shows a half-faded ghost); only the scale pops
    return { s: from + (1 - from) * E.outBack(p), o: 1, on: true };
  };
  // Deterministic shake offset that decays after t0.
  BM.shake = function (t, t0, dur = 0.25, amp = 14, seed = 7) {
    if (t < t0 || t > t0 + dur) return [0, 0];
    const f = Math.floor(t * BM.FPS);
    const k = 1 - (t - t0) / dur;
    return [(BM.hash(f, seed) - 0.5) * 2 * amp * k, (BM.hash(f, seed + 1) - 0.5) * 2 * amp * k];
  };
  // Stepped "boil" index — changes every n frames.
  BM.boil = (t, n = 2, salt = 0) => Math.floor((t * BM.FPS) / n) + salt * 1000;

  // ---- DOM helpers ----------------------------------------------------------
  BM.el = function (tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  // Position an absolutely-placed element; (x, y) is its anchor point, ax/ay in 0..1.
  BM.place = function (e, x, y, opt = {}) {
    const s = opt.s == null ? 1 : opt.s;
    const r = opt.r || 0;
    const ax = opt.ax == null ? 0.5 : opt.ax;
    const ay = opt.ay == null ? 0.5 : opt.ay;
    e.style.transformOrigin = `${ax * 100}% ${ay * 100}%`;
    e.style.transform = `translate(${x}px, ${y}px) translate(${-ax * 100}%, ${-ay * 100}%) rotate(${r}deg) scale(${s})`;
    e.style.opacity = opt.o == null ? 1 : opt.o;
    e.style.visibility = opt.o === 0 ? 'hidden' : 'visible';
  };
  BM.show = (e, on) => (e.style.visibility = on ? 'visible' : 'hidden');

  // ---- Canvas helpers -------------------------------------------------------
  BM.canvas = function (w = BM.W, h = BM.H) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  // Camera: draw `img` so that image point (cx, cy) lands at screen centre, scaled by s.
  BM.drawCam = function (g, img, cam = {}, op = 'source-over', alpha = 1) {
    const s = cam.s || 1, cx = cam.x == null ? BM.W / 2 : cam.x, cy = cam.y == null ? BM.H / 2 : cam.y;
    g.save();
    g.globalCompositeOperation = op;
    g.globalAlpha = alpha;
    g.setTransform(s, 0, 0, s, BM.W / 2 - cx * s + (cam.dx || 0), BM.H / 2 - cy * s + (cam.dy || 0));
    if (cam.r) {
      g.translate(cx, cy);
      g.rotate(cam.r);
      g.translate(-cx, -cy);
    }
    g.drawImage(img, 0, 0);
    g.restore();
  };

  // Draw a texture canvas with a per-"boil" jitter (film-gate style), slightly oversized.
  BM.drawTex = function (g, tex, t, opt = {}) {
    const n = opt.boil || 2;
    const k = BM.boil(t, n, opt.salt || 0);
    const j = opt.jitter == null ? 3 : opt.jitter;
    const dx = (BM.hash(k, 11) - 0.5) * 2 * j;
    const dy = (BM.hash(k, 12) - 0.5) * 2 * j;
    const flip = opt.flip ? BM.hash(k, 13) > 0.5 : false;
    const s = 1 + (j * 2.2) / BM.W;
    g.save();
    g.globalCompositeOperation = opt.op || 'source-over';
    g.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    if (opt.filter) g.filter = opt.filter;
    g.translate(BM.W / 2 + dx, BM.H / 2 + dy);
    g.scale(flip ? -s : s, s);
    g.drawImage(tex, -BM.W / 2, -BM.H / 2);
    g.restore();
  };

  // Solid colour + overlaid paper texture = printed coloured stock.
  BM.paper = function (g, color, tex, t, opt = {}) {
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = color;
    g.fillRect(0, 0, BM.W, BM.H);
    g.restore();
    BM.drawTex(g, tex, t, Object.assign({ op: opt.op || 'overlay', alpha: opt.alpha == null ? 1 : opt.alpha }, opt));
  };

  // "Printed ink" text: renders text into a scratch canvas, knocks speckles out of it with
  // a grunge mask so edges and fills look worn, then composites onto g.
  const inkScratch = document.createElement('canvas');
  BM.inkText = function (g, lines, x, y, opt = {}) {
    const W = BM.W, H = BM.H;
    inkScratch.width = W;
    inkScratch.height = H;
    const s = inkScratch.getContext('2d');
    const size = opt.size || 200;
    const lh = opt.lineHeight || size * 0.92;
    s.font = `${opt.weight || 800} ${size}px ${opt.family || "'Barlow Condensed'"}`;
    s.textAlign = opt.align || 'center';
    s.textBaseline = 'middle';
    s.fillStyle = opt.color || '#1d1a1b';
    if (opt.letterSpacing != null) s.letterSpacing = opt.letterSpacing + 'px';
    const arr = Array.isArray(lines) ? lines : [lines];
    const scale = opt.scale || 1;
    s.save();
    s.translate(x, y);
    s.scale(scale, scale);
    if (opt.rot) s.rotate(opt.rot);
    arr.forEach((ln, i) => s.fillText(ln, 0, (i - (arr.length - 1) / 2) * lh));
    s.restore();
    if (opt.rough !== false && BM.tex && BM.tex.speck) {
      s.globalCompositeOperation = 'destination-out';
      s.globalAlpha = opt.rough == null ? 0.9 : opt.rough;
      const k = opt.t == null ? 0 : BM.boil(opt.t, 3);
      const dx = (BM.hash(k, 21) - 0.5) * 60, dy = (BM.hash(k, 22) - 0.5) * 60;
      s.drawImage(BM.tex.speck, dx - 40, dy - 40, W + 80, H + 80);
    }
    g.save();
    g.globalCompositeOperation = opt.op || 'source-over';
    g.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    g.drawImage(inkScratch, 0, 0);
    g.restore();
  };

  // Rounded-rect path helper.
  BM.rr = function (g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  // Page-peel transition: `drawTop(g)` is the outgoing page; it curls away from the
  // bottom-right corner as p goes 0 → 1, revealing whatever is already on g.
  const peelScratch = document.createElement('canvas');
  BM.peel = function (g, drawTop, p) {
    if (p >= 1) return;
    const W = BM.W, H = BM.H;
    peelScratch.width = W;
    peelScratch.height = H;
    const s = peelScratch.getContext('2d');
    drawTop(s);
    const len = Math.hypot(W, H);
    const u = [-W / len, -H / len]; // from the corner inward
    const d = E.inOutSine(p) * len * 2.05;
    const C = [W, H];
    const M = [C[0] + (u[0] * d) / 2, C[1] + (u[1] * d) / 2];
    const side = (P) => (P[0] - M[0]) * u[0] + (P[1] - M[1]) * u[1];
    const rect = [[0, 0], [W, 0], [W, H], [0, H]];
    const clip = (poly, keepPositive) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length];
        const sa = side(A), sb = side(B);
        const inA = keepPositive ? sa >= 0 : sa < 0, inB = keepPositive ? sb >= 0 : sb < 0;
        if (inA) out.push(A);
        if (inA !== inB) {
          const k = sa / (sa - sb);
          out.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k]);
        }
      }
      return out;
    };
    const stay = clip(rect, true);
    const gone = clip(rect, false);
    const reflect = (P) => {
      const k = 2 * side(P);
      return [P[0] - k * u[0], P[1] - k * u[1]];
    };
    const path = (poly) => {
      g.beginPath();
      poly.forEach((P, i) => (i ? g.lineTo(P[0], P[1]) : g.moveTo(P[0], P[1])));
      g.closePath();
    };
    if (stay.length) {
      g.save();
      path(stay);
      g.clip();
      g.drawImage(peelScratch, 0, 0);
      g.restore();
    }
    if (gone.length) {
      const flap = gone.map(reflect);
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.45)';
      g.shadowBlur = 40;
      g.shadowOffsetX = -14;
      g.shadowOffsetY = -14;
      const gr = g.createLinearGradient(M[0], M[1], M[0] + u[0] * 420, M[1] + u[1] * 420);
      gr.addColorStop(0, '#cfc9c0');
      gr.addColorStop(0.35, '#f4f1ea');
      gr.addColorStop(1, '#e2ddd3');
      g.fillStyle = gr;
      path(flap);
      g.fill();
      g.restore();
    }
  };
})();
