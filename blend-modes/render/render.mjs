// Frame-accurate renderer: opens build/index.html?render in headless Chromium, seeks every
// frame (18 fps), screenshots the 1080x1920 stage and pipes PNGs into ffmpeg together with
// the voiceover. Several pages render in parallel; frames are written strictly in order.
//
//   node render/render.mjs                      full video → output/blend-modes-1080x1920-18fps.mp4
//   node render/render.mjs --stills 0,40,200    selected frames → output/stills/f0000.png …
//   node render/render.mjs --sheet 9            every 9th frame → contact sheets in output/stills/
//   options: --workers N  --from F --to F  --out path  --crf N --maxrate 8M --bufsize 16M
//            --master path   (also write an uncapped CRF 16 copy)
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};

const FPS = 18;
const FRAMES = 864; // 48 s
const W = 1080, H = 1920;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const workers = +arg('workers', 4);
const pageUrl = pathToFileURL(join(root, 'build/index.html')).href + '?render=1';

let frames;
const stills = arg('stills');
const sheetEvery = arg('sheet');
if (stills) frames = stills.split(',').map(Number);
else if (sheetEvery) frames = Array.from({ length: Math.ceil(FRAMES / +sheetEvery) }, (_, i) => i * +sheetEvery);
else frames = Array.from({ length: +arg('to', FRAMES) - +arg('from', 0) }, (_, i) => i + +arg('from', 0));

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') console.log('[page]', m.type(), m.text());
  });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  await page.goto(pageUrl);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  return page;
}

async function shoot(page, f) {
  await page.evaluate((i) => window.BM.seekFrame(i), f);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H }, animations: 'disabled' });
}

const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-gpu-vsync', '--force-color-profile=srgb'] });
const t0 = Date.now();
const pages = await Promise.all(Array.from({ length: Math.min(workers, frames.length) }, () => openPage(browser)));
console.log(`${pages.length} page(s) ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (stills || sheetEvery) {
  const dir = join(root, 'output/stills');
  mkdirSync(dir, { recursive: true });
  let next = 0;
  await Promise.all(
    pages.map(async (page) => {
      while (next < frames.length) {
        const f = frames[next++];
        await writeFile(join(dir, `f${String(f).padStart(4, '0')}.png`), await shoot(page, f));
      }
    }),
  );
  if (sheetEvery) {
    // Contact sheets, 6x3 tiles of 270x480, labelled by frame order.
    const list = frames.map((f) => join(dir, `f${String(f).padStart(4, '0')}.png`));
    const per = 18;
    for (let s = 0; s * per < list.length; s++) {
      const chunk = list.slice(s * per, (s + 1) * per);
      const inputs = chunk.flatMap((p) => ['-i', p]);
      const filt = chunk.map((_, i) => `[${i}]scale=270:480[s${i}]`).join(';') + ';' + chunk.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${chunk.length}:layout=${chunk.map((_, i) => `${(i % 6) * 270}_${Math.floor(i / 6) * 480}`).join('|')}:fill=white[o]`;
      const out = join(dir, `sheet_${String(s + 1).padStart(2, '0')}.jpg`);
      const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filt, '-map', '[o]', '-q:v', '3', out]);
      if (r.status !== 0) console.log(r.stderr.toString());
      else console.log('sheet', out, `frames ${frames[s * per]}–${frames[Math.min(list.length, (s + 1) * per) - 1]}`);
    }
  }
  console.log(`${frames.length} still(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${dir}`);
  await browser.close();
  process.exit(0);
}

// ---- Full render -------------------------------------------------------------
const out = arg('out', join(root, 'output/blend-modes-1080x1920-18fps.mp4'));
mkdirSync(dirname(out), { recursive: true });
const wav = join(root, 'output/.voiceover.wav');
// Decode once to PCM so sample 0 of the soundtrack is exactly t = 0 of the timeline
// (the word timings in build/data were measured on this same decode).
spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', join(root, 'source/voiceover.mp3'), '-ar', '48000', '-ac', '2', wav], { stdio: 'inherit' });

// Per-frame film grain is expensive to encode, so the delivery file is quality-targeted
// (CRF) but capped at 8 Mbit/s (~48 MB for 48 s). --master PATH also writes an uncapped
// high-quality copy from the same frames.
const outputArgs = (file, rate) => [
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-tune', 'grain', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2),
  ...rate,
  '-profile:v', 'high', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-t', String(frames.length / FPS),
  '-movflags', '+faststart', file,
];
const master = arg('master');
if (master) mkdirSync(dirname(master), { recursive: true });
const enc = spawn(ffmpeg, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-i', wav,
  ...outputArgs(out, ['-crf', arg('crf', '20'), '-maxrate', arg('maxrate', '8M'), '-bufsize', arg('bufsize', '16M')]),
  ...(master ? outputArgs(master, ['-crf', '16']) : []),
], { stdio: ['pipe', 'inherit', 'inherit'] });
const encDone = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));

const ready = new Map();
let nextWrite = 0, nextTake = 0, done = 0;
const write = async () => {
  while (ready.has(frames[nextWrite])) {
    const buf = ready.get(frames[nextWrite]);
    ready.delete(frames[nextWrite]);
    nextWrite++;
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
  }
};
let writing = Promise.resolve();
await Promise.all(
  pages.map(async (page) => {
    while (nextTake < frames.length) {
      const f = frames[nextTake++];
      // keep the reorder buffer bounded
      while (f - frames[nextWrite] > workers * 6) await new Promise((r) => setTimeout(r, 20));
      ready.set(f, await shoot(page, f));
      writing = writing.then(write);
      if (++done % 36 === 0) console.log(`frame ${done}/${frames.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }),
);
await writing;
enc.stdin.end();
await encDone;
await browser.close();
if (existsSync(wav)) rmSync(wav);
console.log(`rendered ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${out}`);
