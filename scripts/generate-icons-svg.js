/**
 * generate-icons-svg.js
 * Generates JaruJu TV PWA icons as PNGs using pure SVG + sharp.
 * Zero native canvas dependency — uses `sharp` which ships pre-built binaries.
 *
 * Usage: node scripts/generate-icons-svg.js
 * Requires: npm install sharp --save-dev
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * Build an SVG string matching the Logo.tsx brand mark,
 * sized at `size` with optional maskable `padding` (in px inside size).
 */
function buildSVG(size, padding = 0) {
  const inner  = size - padding * 2;
  const x      = padding;
  const y      = padding;
  const rx     = Math.round(inner * 0.25);

  // Play triangle vertices (relative to inner area)
  const triLeft   = x + inner * 0.35;
  const triTop    = y + inner * 0.25;
  const triBottom = y + inner * 0.75;
  const triRight  = x + inner * 0.80;
  const triMidY   = (triTop + triBottom) / 2;

  // Orange dot
  const dotR  = inner * 0.10;
  const dotCx = x + inner * 0.275;
  const dotCy = y + inner * 0.75;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- background -->
  <rect x="${x}" y="${y}" width="${inner}" height="${inner}" rx="${rx}" ry="${rx}" fill="#E53935"/>
  <!-- play triangle -->
  <polygon points="${triLeft},${triTop} ${triRight},${triMidY} ${triLeft},${triBottom}" fill="white" opacity="0.95"/>
  <!-- brand dot -->
  <circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="#FF8F00"/>
</svg>`;
}

async function generate(size, filename, padding = 0) {
  const svg     = Buffer.from(buildSVG(size, padding));
  const outPath = path.join(OUT_DIR, filename);
  await sharp(svg).png().toFile(outPath);
  console.log(`✓  ${path.relative(process.cwd(), outPath)}`);
}

async function generateFavicon(size, filename) {
  const svg     = Buffer.from(buildSVG(size));
  const outPath = path.join(__dirname, '..', 'public', filename);
  await sharp(svg).png().toFile(outPath);
  console.log(`✓  ${path.relative(process.cwd(), outPath)}`);
}

(async () => {
  console.log('Generating JaruJu TV PWA icons…\n');

  await generate(192, 'icon-192x192.png');
  await generate(512, 'icon-512x512.png');
  // Maskable: 10% padding on each side keeps brand mark inside the safe zone
  await generate(512, 'icon-maskable-512x512.png', Math.round(512 * 0.10));
  await generate(180, 'apple-touch-icon.png');
  await generateFavicon(32, 'favicon-32x32.png');

  console.log('\nDone. All icons written to public/icons/ and public/.');
})().catch((err) => {
  console.error('Error generating icons:', err.message);
  process.exit(1);
});

