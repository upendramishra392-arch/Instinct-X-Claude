// Procedural textures (all seeded, generated once at load). Everything is original —
// value-noise fBm, ridged "crumple" shading, scratches, dust and specks.
(function () {
  const BM = window.BM;
  const W = BM.W, H = BM.H;
  const hash = BM.hash;

  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // Half-resolution fBm field (upsampled bilinearly when used at full res).
  function fbm(w, h, scale, oct, seed, ridged) {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let f = 0, a = 0.5, fr = 1 / scale, norm = 0;
        for (let o = 0; o < oct; o++) {
          let n = vnoise(x * fr + o * 17.3, y * fr - o * 9.1, seed + o * 101);
          if (ridged) n = 1 - Math.abs(2 * n - 1);
          f += a * n;
          norm += a;
          a *= 0.5;
          fr *= 2.03;
        }
        out[y * w + x] = f / norm;
      }
    }
    return out;
  }

  const FW = W >> 1, FH = H >> 1;
  // Bilinear sample of a half-res field at full-res pixel (x, y).
  function up(field, x, y) {
    const fx = Math.min(FW - 1.001, x * 0.5), fy = Math.min(FH - 1.001, y * 0.5);
    const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
    const i = y0 * FW + x0;
    const a = field[i], b = field[i + 1], c = field[i + FW], d = field[i + FW + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }

  // Luminance (0..1 floats) → grayscale canvas + Uint8 luminance array.
  function toCanvas(lum) {
    const c = BM.canvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    const L = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      const v = Math.max(0, Math.min(255, lum[i] * 255));
      L[i] = v;
      d[j] = d[j + 1] = d[j + 2] = v;
      d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { canvas: c, L };
  }
  function readLum(c) {
    const d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const L = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; i < W * H; i++, j += 4) L[i] = d[j];
    return L;
  }

  function creaseLines(rng, n) {
    const lines = [];
    for (let k = 0; k < n; k++) {
      const a = (rng() - 0.5) * 0.5 + (rng() > 0.5 ? 0 : Math.PI / 2);
      const nx = Math.cos(a), ny = Math.sin(a);
      const px = W * (0.2 + rng() * 0.6), py = H * (0.2 + rng() * 0.6);
      lines.push([nx, ny, nx * px + ny * py, 0.5 + rng() * 0.6]);
    }
    return lines;
  }

  // Coloured-stock paper: neutral mean ~0.5, blotches, fibres, folds.
  function paper(seed) {
    const rng = BM.rng(seed);
    const blot = fbm(FW, FH, 170, 4, seed);
    const mid = fbm(FW, FH, 22, 3, seed + 7);
    const folds = creaseLines(rng, 2);
    const lum = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = 0.5 + (up(blot, x, y) - 0.5) * 0.14 + (up(mid, x, y) - 0.5) * 0.1 + (rng() - 0.5) * 0.1;
        for (const [nx, ny, c, k] of folds) {
          const dd = nx * x + ny * y - c;
          if (dd > -50 && dd < 50) v += k * (0.12 * Math.sign(dd) * Math.exp(-Math.abs(dd) / 12) - 0.12 * Math.exp(-(dd * dd) / 5));
        }
        lum[y * W + x] = v;
      }
    }
    const t = toCanvas(lum);
    const g = t.canvas.getContext('2d');
    // fibres
    for (let i = 0; i < 1800; i++) {
      const x = rng() * W, y = rng() * H, a = rng() * Math.PI, l = 6 + rng() * 34;
      g.strokeStyle = rng() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)';
      g.lineWidth = 0.8 + rng() * 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rng() - 0.5) * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // specks
    for (let i = 0; i < 420; i++) {
      g.fillStyle = `rgba(0,0,0,${0.2 + rng() * 0.5})`;
      g.beginPath();
      g.arc(rng() * W, rng() * H, 0.6 + rng() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    return t.canvas;
  }

  // Crumpled white paper with dark grain, specks and stains (for Multiply).
  function crumple(seed, cluster) {
    const rng = BM.rng(seed);
    const h = fbm(FW, FH, 260, 5, seed, true);
    const blot = fbm(FW, FH, 140, 3, seed + 3);
    const clump = fbm(FW, FH, 5, 2, seed + 5);
    // Folds: finite straight creases; each tilts the paper one way on either side, so the
    // lit surface breaks into flat facets with crisp crease lines (plus a little ridged noise).
    const folds = [];
    for (let k = 0; k < 18; k++) {
      const a = rng() * Math.PI;
      folds.push({ nx: Math.cos(a), ny: Math.sin(a), px: (rng() * 1.2 - 0.1) * FW, py: (rng() * 1.2 - 0.1) * FH, amp: (0.4 + rng() * 0.8) * (rng() > 0.5 ? 1 : -1), len: 160 + rng() * 420 });
    }
    const shade = new Float32Array(FW * FH);
    for (let y = 1; y < FH - 1; y++) {
      for (let x = 1; x < FW - 1; x++) {
        const i = y * FW + x;
        let gx = (h[i + 1] - h[i - 1]) * 5, gy = (h[i + FW] - h[i - FW]) * 5, crease = 0;
        for (const f of folds) {
          const rx = x - f.px, ry = y - f.py;
          const d = rx * f.nx + ry * f.ny, along = -rx * f.ny + ry * f.nx;
          const w = Math.exp(-(along * along) / (f.len * f.len));
          if (w < 0.02) continue;
          const sgn = d > 0 ? 1 : -1;
          gx += f.amp * w * sgn * f.nx * 0.16;
          gy += f.amp * w * sgn * f.ny * 0.16;
          crease += w * Math.exp(-(d * d) / 1.2) * Math.abs(f.amp);
        }
        shade[i] = 0.5 + (gx * -0.62 + gy * -0.78) * 0.9 - crease * 0.06;
      }
    }
    const lum = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = 0.9 + (up(shade, x, y) - 0.5) * 0.4 + (up(blot, x, y) - 0.5) * 0.1 + (rng() - 0.5) * 0.06;
        const c = up(clump, x, y);
        if (c > 0.71) v *= 1 - Math.min(0.7, (c - 0.71) * 3.2);
        lum[y * W + x] = v;
      }
    }
    const t = toCanvas(lum);
    const g = t.canvas.getContext('2d');
    const dot = (x, y, r, a) => {
      g.fillStyle = `rgba(20,16,14,${a})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    for (let i = 0; i < 400; i++) dot(rng() * W, rng() * H, 0.5 + rng() * 1.6, 0.3 + rng() * 0.6);
    // stains
    for (let i = 0; i < 3; i++) {
      const x = rng() * W, y = rng() * H, r = 60 + rng() * 120;
      g.strokeStyle = `rgba(90,70,50,${0.1 + rng() * 0.08})`;
      g.lineWidth = 5 + rng() * 8;
      g.beginPath();
      g.arc(x, y, r, rng() * 6, rng() * 6 + 4.5);
      g.stroke();
    }
    // planted grain cluster (where the camera pushes in during the Multiply demo)
    if (cluster) {
      const [cx, cy] = cluster;
      for (let i = 0; i < 260; i++) {
        const a = rng() * Math.PI * 2, r = Math.abs(gauss(rng)) * 60;
        dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 0.8 + rng() * 3.2, 0.45 + rng() * 0.5);
      }
      for (let i = 0; i < 8; i++) {
        g.strokeStyle = `rgba(20,16,14,${0.4 + rng() * 0.4})`;
        g.lineWidth = 1 + rng() * 2;
        g.beginPath();
        const x = cx + (rng() - 0.5) * 120, y = cy + (rng() - 0.5) * 100;
        g.moveTo(x, y);
        g.bezierCurveTo(x + rng() * 40, y - 20, x + rng() * 60, y + 20, x + 30 + rng() * 50, y + (rng() - 0.5) * 40);
        g.stroke();
      }
    }
    return t.canvas;
  }

  function gauss(rng) {
    return Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());
  }

  // Black film/grunge: scratches, dust and hairs (for Screen).
  function grunge(seed, cluster) {
    const rng = BM.rng(seed);
    const haze = fbm(FW, FH, 200, 4, seed);
    const blotch = fbm(FW, FH, 30, 3, seed + 2);
    const lum = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = 0.035 + (up(haze, x, y) - 0.5) * 0.09 + rng() * 0.035;
        const b = up(blotch, x, y);
        if (b > 0.7) v += (b - 0.7) * 1.1;
        lum[y * W + x] = v;
      }
    }
    const t = toCanvas(lum);
    const g = t.canvas.getContext('2d');
    const scratch = (x, y0, y1, w, a) => {
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = w;
      g.beginPath();
      const ph = rng() * 6, amp = rng() * 5;
      for (let y = y0; y <= y1; y += 16) g.lineTo(x + Math.sin(y / 140 + ph) * amp + (rng() - 0.5) * 1.2, y);
      g.stroke();
    };
    for (let i = 0; i < 26; i++) {
      const y0 = rng() * H * 0.8;
      scratch(rng() * W, y0, y0 + 120 + rng() * H * 0.8, 0.8 + rng() * 2.4, 0.25 + rng() * 0.6);
    }
    const dust = (x, y, r, a) => {
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.5 + rng() * 0.8), rng() * 3, 0, Math.PI * 2);
      g.fill();
    };
    for (let i = 0; i < 700; i++) dust(rng() * W, rng() * H, 0.6 + rng() * 2.6, 0.35 + rng() * 0.65);
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.5 + rng() * 0.4})`;
      g.lineWidth = 1.2 + rng() * 1.5;
      const x = rng() * W, y = rng() * H;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + (rng() - 0.5) * 160, y + (rng() - 0.5) * 160, x + (rng() - 0.5) * 160, y + (rng() - 0.5) * 160, x + (rng() - 0.5) * 200, y + (rng() - 0.5) * 200);
      g.stroke();
    }
    if (cluster) {
      const [cx, cy] = cluster;
      scratch(cx - 50, cy - 460, cy + 420, 4.5, 1);
      scratch(cx + 20, cy - 300, cy + 330, 3, 0.95);
      scratch(cx + 70, cy - 160, cy + 560, 2.4, 0.9);
      scratch(cx - 100, cy - 90, cy + 240, 2, 0.85);
      for (let i = 0; i < 70; i++) {
        const a = rng() * Math.PI * 2, r = Math.abs(gauss(rng)) * 110;
        dust(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.6, 1.2 + rng() * 4, 0.6 + rng() * 0.4);
      }
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(cx - 140, cy + 60);
      g.bezierCurveTo(cx - 60, cy - 40, cx + 10, cy + 120, cx + 130, cy + 30);
      g.stroke();
    }
    return t.canvas;
  }

  // Mottled mid-tone texture for Overlay / Soft Light. Returned "raw" is deliberately
  // off-centre (mean 30%) — the Levels step later pulls its main tones to 50%.
  function mottled(seed, mean, sd) {
    const rng = BM.rng(seed);
    const b1 = fbm(FW, FH, 210, 4, seed);
    const b2 = fbm(FW, FH, 34, 3, seed + 1);
    const b3 = fbm(FW, FH, 7, 2, seed + 2);
    const raw = new Float32Array(W * H);
    let sum = 0, sum2 = 0;
    const k = (2 * Math.PI) / 9;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = up(b1, x, y);
        // 45° halftone screen, strength modulated by the large blotches
        const ht = Math.cos((x + y) * k * 0.7071) * Math.cos((x - y) * k * 0.7071);
        const v = (a - 0.5) * 0.5 + (up(b2, x, y) - 0.5) * 0.5 + (up(b3, x, y) - 0.5) * 0.5 + (rng() - 0.5) * 0.42 + ht * 0.05 * (0.5 + a);
        raw[y * W + x] = v;
        sum += v;
        sum2 += v * v;
      }
    }
    const n = W * H, m = sum / n, s = Math.sqrt(sum2 / n - m * m);
    for (let i = 0; i < n; i++) raw[i] = mean + ((raw[i] - m) / s) * sd;
    const t = toCanvas(raw);
    const g = t.canvas.getContext('2d');
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${0.2 + rng() * 0.3})` : `rgba(255,255,255,${0.12 + rng() * 0.2})`;
      g.beginPath();
      g.arc(rng() * W, rng() * H, 0.8 + rng() * 2.5, 0, Math.PI * 2);
      g.fill();
    }
    t.L = readLum(t.canvas);
    return t;
  }

  // Transparent canvas whose alpha holds specks/blotches — used to knock ink out of type.
  function speck(seed) {
    const rng = BM.rng(seed);
    const f = fbm(FW, FH, 9, 2, seed);
    const big = fbm(FW, FH, 90, 3, seed + 4);
    const c = BM.canvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 4;
        const v = up(f, x, y) + (up(big, x, y) - 0.5) * 0.5 + (rng() - 0.5) * 0.18;
        const a = v > 0.7 ? Math.min(1, (v - 0.7) * 5) : rng() < 0.012 ? 0.8 : 0;
        d[j + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // Map luminance through a gradient (dark → light colours).
  function gradientMap(L, dark, light) {
    const c = BM.canvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      const v = L[i] / 255;
      d[j] = dark[0] + (light[0] - dark[0]) * v;
      d[j + 1] = dark[1] + (light[1] - dark[1]) * v;
      d[j + 2] = dark[2] + (light[2] - dark[2]) * v;
      d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // Levels on a luminance array: input black/white (0..255), gamma, plus an optional offset.
  // Result canvases are cached by parameters (quantised), since sliders sweep smoothly.
  const levelCache = new Map();
  BM.levelsLUT = function (inB = 0, inW = 255, gamma = 1, offset = 0) {
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      let v = (i - inB) / Math.max(1, inW - inB);
      v = Math.max(0, Math.min(1, v));
      v = Math.pow(v, 1 / gamma);
      lut[i] = v * 255 + offset * 255;
    }
    return lut;
  };
  BM.levels = function (tex, inB = 0, inW = 255, gamma = 1, offset = 0) {
    inB = Math.round(inB);
    inW = Math.round(inW);
    gamma = Math.round(gamma * 100) / 100;
    const key = `${tex.id}|${inB}|${inW}|${gamma}|${offset}`;
    if (levelCache.has(key)) return levelCache.get(key);
    const lut = BM.levelsLUT(inB, inW, gamma, offset);
    const c = BM.canvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data, L = tex.L;
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      const v = lut[L[i]];
      d[j] = d[j + 1] = d[j + 2] = v;
      d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if (levelCache.size > 16) levelCache.delete(levelCache.keys().next().value);
    levelCache.set(key, c);
    return c;
  };
  // Histogram (256 bins, max-normalised, lightly smoothed) of a luminance array through a LUT.
  BM.histogram = function (L, lut) {
    const bins = new Float32Array(256);
    for (let i = 0; i < L.length; i += 7) bins[lut ? lut[L[i]] : L[i]]++;
    const sm = new Float32Array(256);
    let max = 0;
    for (let i = 0; i < 256; i++) {
      let s = 0, n = 0;
      for (let k = -2; k <= 2; k++) if (i + k >= 0 && i + k < 256) (s += bins[i + k]), n++;
      sm[i] = s / n;
      max = Math.max(max, sm[i]);
    }
    for (let i = 0; i < 256; i++) sm[i] /= max || 1;
    return sm;
  };
  BM.meanOf = function (L, lut) {
    let s = 0, n = 0;
    for (let i = 0; i < L.length; i += 13) (s += lut ? lut[L[i]] : L[i]), n++;
    return s / n / 255;
  };

  function grainFrames() {
    const frames = [];
    for (let f = 0; f < 5; f++) {
      const c = BM.canvas(540, 960);
      const g = c.getContext('2d');
      const img = g.createImageData(540, 960);
      const d = img.data;
      const rng = BM.rng(900 + f);
      for (let j = 0; j < d.length; j += 4) {
        const v = 128 + gauss(rng) * 46;
        d[j] = d[j + 1] = d[j + 2] = v;
        d[j + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      frames.push(c);
    }
    return frames;
  }

  // Generate everything; yields between steps so the loading screen can update.
  BM.buildTextures = async function (progress) {
    const T = (BM.tex = {});
    const steps = [
      ['paperA', () => paper(11)],
      ['paperB', () => paper(23)],
      ['paperC', () => paper(37)],
      ['crumple', () => crumple(41, BM.art.GRAIN_SPOT)],
      ['crumpleClean', () => crumple(41)], // same sheet without the planted grain cluster
      ['grunge', () => grunge(53, BM.art.SCRATCH_SPOT)],
      ['speck', () => speck(61)],
      ['mottled', () => mottled(71, 0.3, 0.105)],
      ['grain', () => grainFrames()],
    ];
    for (const [k, fn] of steps) {
      progress && progress(`texture: ${k}`);
      await new Promise((r) => setTimeout(r, 0));
      T[k] = fn();
    }
    const M = T.mottled;
    M.id = 'mottled';
    // Derived looks.
    T.raw = M.canvas; // off-centre, mean ≈ 30%
    T.bright = BM.levels(M, 0, 255, 1, 0.4); // mean ≈ 70% (too bright for Overlay)
    // Gamma that puts the texture's average exactly on 50% (bisection; mean rises with gamma).
    let lo = 1, hi = 4;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (BM.meanOf(M.L, BM.levelsLUT(0, 255, mid)) < 0.5) lo = mid;
      else hi = mid;
    }
    BM.GAMMA_N = Math.round(((lo + hi) / 2) * 100) / 100;
    T.neutral = BM.levels(M, 0, 255, BM.GAMMA_N); // main tones at 50%
    // The levelled texture as a source for the second Levels, so contrast is applied after the
    // gamma, in the order the panel shows (applying both in one LUT would pull the mean down).
    T.neutralSrc = { id: 'neutralSrc', L: mapL(M.L, BM.levelsLUT(0, 255, BM.GAMMA_N)) };
    // The hero texture: kraft-coloured grain with the paper's folds. It "looks perfect" on its
    // own (hook), turns the design to mud in Normal mode, and is the texture that later gets
    // desaturated and levelled — one texture all the way through.
    T.kraft = gradientMap(M.L, [66, 46, 30], [236, 208, 164]);
    T.muddy = BM.canvas(W, H);
    const km = T.muddy.getContext('2d');
    km.drawImage(T.kraft, 0, 0);
    km.globalCompositeOperation = 'multiply';
    km.globalAlpha = 0.5;
    km.drawImage(T.crumpleClean, 0, 0);
    // Colour-cast versions of the same texture: raw tones (what you start with before
    // desaturating) and centred tones (isolates the colour shift in the Overlay demo).
    T.tinted = T.kraft;
    T.tintedN = gradientMap(mapL(M.L, BM.levelsLUT(0, 255, BM.GAMMA_N)), [10, 90, 150], [110, 190, 255]); // cool teal cast, near-neutral luminance
    progress && progress('textures ready');
  };
  function mapL(L, lut) {
    const out = new Uint8ClampedArray(L.length);
    for (let i = 0; i < L.length; i++) out[i] = lut[L[i]];
    return out;
  }
})();
