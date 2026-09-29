// Boot: load fonts, generate textures + artwork, build scenes, then either play in the
// browser (synced to the voiceover) or wait for the renderer to seek frame by frame.
(function () {
  const BM = window.BM;
  const RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.body.classList.add('render');

  const stage = document.getElementById('stage');
  const main = document.getElementById('main');
  const g = main.getContext('2d');
  const scenesRoot = document.getElementById('scenes');
  const capEl = document.querySelector('#caption span');
  const grainCv = document.getElementById('grain');
  const gg = grainCv.getContext('2d');
  const loading = document.getElementById('loading');

  // ---- Captions: 1–3 word groups, timed from the word onsets ------------------
  const GROUPS = [
    'YOUR TEXTURE', 'CAN LOOK', 'PERFECT,', 'THEN RUIN', 'YOUR WHOLE', 'DESIGN', 'WHEN YOU', 'LAY IT', 'ON TOP.',
    'THE FIX', "ISN'T A", 'NEW TEXTURE,', "IT'S THE", 'RIGHT', 'BLEND MODE.',
    'GOT A', 'TEXTURE', 'ON WHITE?', 'TRY', 'MULTIPLY.', 'WHITE', 'DISAPPEARS', 'AND THE', 'DARK GRAIN', 'STAYS.',
    'ON BLACK?', 'TRY', 'SCREEN.', 'BLACK', 'DROPS OUT', 'AND THE', 'BRIGHT MARKS', 'SHOW THROUGH.',
    'OVERLAY', 'AND SOFT LIGHT', 'WORK', 'DIFFERENTLY.', 'THEIR', 'NEUTRAL POINT', 'IS MIDDLE GRAY.',
    'IF YOUR', 'TEXTURE', "ISN'T", 'CENTERED THERE,', 'IT CAN', 'BRIGHTEN', 'OR DARKEN', 'THE IMAGE', 'AND SHIFT', 'ITS COLORS.',
    'SO FIRST,', 'TAKE OUT', 'THE COLOR.', 'THEN USE', 'LEVELS', 'TO MOVE', "THE TEXTURE'S", 'MAIN TONES', 'TOWARD', 'MIDDLE GRAY.',
    'NOW THE', 'PATTERN', 'COMES THROUGH', 'WITHOUT', 'TAKING OVER', 'THE IMAGE.',
    'WANT MORE', 'PUNCH?', 'ADD A', 'FINAL', 'LEVELS', 'ADJUSTMENT', 'AND TUNE', 'THE CONTRAST', 'UNTIL IT', 'FEELS RIGHT.',
    'SAME', 'TEXTURE,', 'CLEANER', 'RESULT.',
  ];
  const norm = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
  function buildCaptions() {
    const W = BM.words;
    const caps = [];
    let wi = 0;
    for (const text of GROUPS) {
      const toks = text.split(' ');
      toks.forEach((tk, k) => {
        if (norm(tk) !== norm(W[wi + k].w)) console.warn('caption/word mismatch', tk, W[wi + k].w);
      });
      caps.push({ text, start: W[wi].start - BM.LEAD, lastEnd: W[wi + toks.length - 1].end });
      wi += toks.length;
    }
    if (wi !== W.length) console.warn('captions cover', wi, 'of', W.length, 'words');
    caps.forEach((c, i) => {
      const next = caps[i + 1];
      if (!next) c.end = BM.DURATION;
      else c.end = next.start - c.lastEnd < 0.7 ? next.start : c.lastEnd + 0.45;
    });
    return caps;
  }
  let CAPS = [];
  function captionAt(t) {
    for (const c of CAPS) if (t >= c.start && t < c.end) return c.text;
    return '';
  }

  // ---- Scenes ---------------------------------------------------------------
  let active = null;
  function buildScenes() {
    const S = BM.scenes;
    S.forEach((s, i) => {
      s.to = i + 1 < S.length ? S[i + 1].from : BM.DURATION;
      s.el = BM.el('div', 'scene', scenesRoot);
      s.el.dataset.id = s.id;
      if (s.build) s.build(s.el, s);
    });
    // Measure layout-dependent positions while each scene is (invisibly) displayed.
    S.forEach((s) => {
      if (!s.layout) return;
      s.el.classList.add('on');
      s.el.style.visibility = 'hidden';
      s.layout(s);
      s.el.style.visibility = '';
      s.el.classList.remove('on');
    });
  }

  function renderFrame(frame) {
    const t = frame / BM.FPS;
    const S = BM.scenes;
    let sc = S[S.length - 1];
    for (const s of S) if (t >= s.from && t < s.to) { sc = s; break; }
    if (sc !== active) {
      if (active) active.el.classList.remove('on');
      sc.el.classList.add('on');
      active = sc;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.filter = 'none';
    g.fillStyle = '#000';
    g.fillRect(0, 0, BM.W, BM.H);
    if (sc.draw) sc.draw(g, t, sc);
    if (sc.update) sc.update(t, sc);
    capEl.textContent = captionAt(t);
    gg.drawImage(BM.tex.grain[(frame * 3) % BM.tex.grain.length], 0, 0);
    BM.frame = frame;
  }

  // ---- Boot -------------------------------------------------------------------
  async function boot() {
    const fontSpecs = [
      "400 100px 'Alfa Slab One'", "600 100px 'Barlow Condensed'", "700 100px 'Barlow Condensed'", "800 100px 'Barlow Condensed'",
      "900 100px 'Archivo'", "400 100px 'Patrick Hand SC'",
      "italic 400 100px 'Instrument Serif'", "400 100px 'Inter'", "500 100px 'Inter'", "600 100px 'Inter'", "700 100px 'Inter'",
    ];
    await Promise.all(fontSpecs.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    await BM.buildTextures((m) => (loading.textContent = `Generating ${m}…`));
    BM.art.build();
    CAPS = buildCaptions();
    buildScenes();
    renderFrame(0);
    loading.classList.add('done');
    window.__ready = true;
    if (!RENDER) setupPreview();
  }

  // Renderer entry point.
  BM.seekFrame = (f) => {
    renderFrame(f);
    return f;
  };
  BM.captions = () => CAPS;

  // ---- Browser preview --------------------------------------------------------
  function setupPreview() {
    const audio = document.getElementById('vo');
    const play = document.getElementById('play');
    const scrub = document.getElementById('scrub');
    const clock = document.getElementById('clock');
    scrub.max = BM.FRAMES - 1;
    let last = -1;
    const fit = () => {
      const vw = window.innerWidth, vh = window.innerHeight - 56;
      const s = Math.min(vw / BM.W, vh / BM.H);
      stage.style.position = 'absolute';
      stage.style.transformOrigin = '0 0';
      stage.style.transform = `scale(${s})`;
      stage.style.left = (vw - BM.W * s) / 2 + 'px';
      stage.style.top = (vh - BM.H * s) / 2 + 'px';
    };
    fit();
    window.addEventListener('resize', fit);
    const show = (f) => {
      f = Math.max(0, Math.min(BM.FRAMES - 1, f));
      if (f !== last) renderFrame(f);
      last = f;
      scrub.value = f;
      clock.textContent = `${(f / BM.FPS).toFixed(2)}s · f${f}`;
    };
    const toggle = () => {
      if (audio.paused) {
        if (audio.currentTime >= BM.DURATION - 0.1) audio.currentTime = 0;
        audio.play();
        play.textContent = 'Pause';
      } else {
        audio.pause();
        play.textContent = 'Play';
      }
    };
    play.onclick = toggle;
    scrub.oninput = () => {
      audio.pause();
      play.textContent = 'Play';
      audio.currentTime = scrub.value / BM.FPS;
      show(+scrub.value);
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') (e.preventDefault(), toggle());
      if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        audio.pause();
        play.textContent = 'Play';
        show(last + (e.code === 'ArrowRight' ? 1 : -1));
        audio.currentTime = last / BM.FPS;
      }
    });
    audio.onended = () => (play.textContent = 'Play');
    const loop = () => {
      if (!audio.paused) show(Math.floor(audio.currentTime * BM.FPS));
      requestAnimationFrame(loop);
    };
    loop();
  }

  boot();
})();
