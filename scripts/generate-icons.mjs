// Rasterizes public/logo-mark.svg into all PWA icon sizes.
// Run with: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public', 'logo-mark.svg');
const outDir = join(root, 'public', 'icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const out = join(outDir, `icon-${size}x${size}.png`);
  await sharp(src, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`✓ icon-${size}x${size}.png`);
}

// A 192px apple-touch / favicon-friendly copy already exists via icons set.
console.log('Done.');
