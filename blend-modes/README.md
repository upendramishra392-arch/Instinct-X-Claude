# Blend Modes — texture reel

A 48-second vertical explainer (1080×1920, 9:16, **18 fps**) about applying textures with the
right blend mode. It follows the look of a reference reel — grainy printed stock, condensed
display type, hand-drawn marker annotations, screen-recorded UI menus with a big pointer, teal
serif labels and word-by-word caption pills — but everything on screen is original and built
in HTML/CSS/JavaScript. It's cut to a supplied voiceover.

**Output:** `output/blend-modes-1080x1920-18fps.mp4` (H.264 High, yuv420p, AAC 48 kHz),
written locally by the renderer and never committed.

## Local media

This repository holds code only. The reference video, the voiceover and every rendered file
stay out of git — `.gitignore` blocks `source/`, `build/audio/`, `output/` and all
audio/video extensions. To preview or render, put the two files in place locally:

```
source/reference.mp4   style reference (only needed for review)
source/voiceover.mp3   soundtrack — read by the preview player and the renderer
```

## What's in here

```
source/            local only, not in git: reference.mp4, voiceover.mp3
build/             the video itself: a single page that renders any frame on demand
  index.html
  css/style.css    captions, menus, editor panels, teal labels, grain/vignette layers
  js/core.js       easing, keyframes, seeded RNG, voiceover cues, canvas helpers, page peel
  js/textures.js   procedural textures: paper stock, folded/crumpled paper, black film
                   grunge, mottled grain, Levels + histogram math
  js/art.js        the "design" used in every demo — an original fruit-crate label drawn
                   with canvas paths
  js/ui.js         blend-mode dropdown, pointer, effect-control/search panels
  js/annotate.js   hand-drawn strokes (circles, arrows, crosses, checks, brackets) + handwriting
  js/scenes.js     the edit: 23 scenes, each starting on a spoken word
  js/main.js       boot, captions, frame renderer, in-browser preview player
  data/words.js    word-level timings for the voiceover (131 words)
  fonts/           vendored woff2 files (see render/copy-fonts.mjs)
render/render.mjs  headless-Chromium frame renderer → ffmpeg
tools/align/       the scripts that produced the word timings
output/            local only, not in git: rendered video and review stills
```

No images, video clips or stock assets are used: the textures come from seeded value noise,
ridged noise and fold-line shading; the label illustration is vector canvas drawing; the UI
is DOM/CSS. The blend demos are real compositing — canvas `multiply`, `screen` and `overlay`
— and the Levels step applies actual input-black/white + gamma math to the texture, with the
histogram and the "average" readout computed from its pixels (the gamma that centres the
average on 50% is solved at load time).

## Preview

```bash
npm install          # playwright + @fontsource packages
npm run fonts        # copies the woff2 files into build/fonts (already committed)
npm run preview      # serves the project, opens http://localhost:8080/build/
                     # (or open build/index.html straight from disk)
```

The page plays the voiceover and renders the frame for the current audio time (quantised to
18 fps). Space toggles play, ←/→ step one frame, the slider scrubs.

## Render

Needs `ffmpeg` on `PATH` (or `FFMPEG=/path/to/ffmpeg`) and Playwright's Chromium.

```bash
npm run render                              # full video → output/blend-modes-1080x1920-18fps.mp4
node render/render.mjs --master output/master.mp4   # also keep an uncapped CRF 16 copy
node render/render.mjs --sheet 12           # contact sheets of every 12th frame → output/stills/
node render/render.mjs --stills 0,180,432   # specific frames as PNG
```

The renderer loads `build/index.html?render`, calls `BM.seekFrame(n)` for n = 0…863,
screenshots the stage and streams PNGs to ffmpeg in order (several pages render in parallel).
Every animation is a pure function of time, so any frame can be rendered on its own.

Encoding details: frames are converted from RGB with the BT.709 matrix (matching the bt709
tags — ffmpeg would otherwise use BT.601), the delivery file is CRF 20 capped at 8 Mbit/s,
and the voiceover is loudness-normalised to −14 LUFS / −1.5 dBTP in two passes
(`--no-loudnorm` keeps the original level). Output is written to a `.part.mp4` and renamed
only when ffmpeg succeeds.

## Sync

Word timings in `build/data/words.js` were measured on the voiceover decoded to PCM — the
same decode the renderer muxes, so sample 0 is t = 0:

1. two independent ASR passes with token timestamps (icefall zipformer and NeMo Parakeet
   TDT, both via sherpa-onnx): identical transcripts,
2. per-word average of both, then the first word after each pause snapped to the acoustic
   onset (pre-emphasised energy, 5 ms hop) — ASR tends to emit post-pause words ~0.15 s early.

Scene cuts land on word onsets (`BM.cut(i)`, 20 ms early so a cut is never late) and every
pop, pointer click, slider drag and annotation inside a scene is keyed to a word index.
Captions are 1–3 word groups shown from their first word's onset.

## Script

> Your texture can look perfect, then ruin your whole design when you lay it on top. The fix
> isn't a new texture — it's the right blend mode. Got a texture on white? Try Multiply. White
> disappears and the dark grain stays. On black? Try Screen. Black drops out and the bright
> marks show through. Overlay and Soft Light work differently: their neutral point is middle
> gray. If your texture isn't centered there, it can brighten or darken the image and shift
> its colors. So first, take out the color. Then use Levels to move the texture's main tones
> toward middle gray. Now the pattern comes through without taking over the image. Want more
> punch? Add a final Levels adjustment and tune the contrast until it feels right. Same
> texture, cleaner result.
