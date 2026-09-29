// Vendors the handful of woff2 files the build uses so build/ is fully self-contained.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build/fonts');
mkdirSync(out, { recursive: true });

const fonts = [
  ['barlow-condensed', ['600-normal', '700-normal', '800-normal']],
  ['archivo', ['900-normal']],
  ['patrick-hand-sc', ['400-normal']],
  ['instrument-serif', ['400-italic']],
  ['inter', ['400-normal', '500-normal', '600-normal', '700-normal']],
  ['alfa-slab-one', ['400-normal']],
];

for (const [pkg, variants] of fonts) {
  for (const v of variants) {
    const file = `${pkg}-latin-${v}.woff2`;
    copyFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file), join(out, file));
    console.log('copied', file);
  }
}
