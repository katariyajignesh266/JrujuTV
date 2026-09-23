/**
 * generate-icons.js
 * Node.js script to generate branded PWA icons using the Canvas API (via canvas npm package).
 * Run once: node scripts/generate-icons.js
 *
 * Produces:
 *   public/icons/icon-192x192.png
 *   public/icons/icon-512x512.png
 *   public/icons/icon-maskable-512x512.png
 *   public/icons/apple-touch-icon.png  (180x180)
 *   public/favicon.ico  (generated separately via sharp or manual)
 *
 * The icon design mirrors the inline SVG brand mark in Logo.tsx:
 *   - Red rounded-rect background (#E53935)
 *   - White play triangle
 *   - Orange dot (#FF8F00) — bottom-left
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const BRAND_RED    = '#E53935';
const BRAND_ORANGE = '#FF8F00';
const WHITE        = '#FFFFFF';

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * Draw the JaruJu TV brand mark onto a canvas at the given size.
 * @param {number} size        - Canvas width/height in px
 * @param {number} padding     - Inner padding (0 for regular, ~20% for maskable)
 */
function drawIcon(size, padding = 0) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const inner  = size - padding * 2;      // drawable area inside padding
  const x      = padding;
  const y      = padding;
  const radius = inner * 0.25;            // rounded corner radius

  // ── Background rounded rect ──────────────────────────────────────────────
  ctx.fillStyle = BRAND_RED;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + inner - radius, y);
  ctx.quadraticCurveTo(x + inner, y, x + inner, y + radius);
  ctx.lineTo(x + inner, y + inner - radius);
  ctx.quadraticCurveTo(x + inner, y + inner, x + inner - radius, y + inner);
  ctx.lineTo(x + radius, y + inner);
  ctx.quadraticCurveTo(x, y + inner, x, y + inner - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();

  // ── Play triangle (scaled to inner area) ─────────────────────────────────
  const triLeft   = x + inner * 0.35;
  const triTop    = y + inner * 0.25;
  const triBottom = y + inner * 0.75;
  const triRight  = x + inner * 0.80;
  const triMidY   = (triTop + triBottom) / 2;

  ctx.fillStyle = WHITE;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(triLeft, triTop);
  ctx.lineTo(triRight, triMidY);
  ctx.lineTo(triLeft, triBottom);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Brand dot (orange) ───────────────────────────────────────────────────
  const dotRadius = inner * 0.10;
  const dotCx     = x + inner * 0.275;
  const dotCy     = y + inner * 0.75;

  ctx.fillStyle = BRAND_ORANGE;
  ctx.beginPath();
  ctx.arc(dotCx, dotCy, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

/**
 * Save a canvas as PNG to the given file path.
 */
function savePNG(canvas, filePath) {
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buf);
  console.log(`✓  Wrote ${path.relative(process.cwd(), filePath)}  (${canvas.width}x${canvas.height})`);
}

// ── Generate icons ───────────────────────────────────────────────────────────

// 192x192 — standard manifest icon
savePNG(drawIcon(192), path.join(OUT_DIR, 'icon-192x192.png'));

// 512x512 — large manifest icon / splash
savePNG(drawIcon(512), path.join(OUT_DIR, 'icon-512x512.png'));

// 512x512 maskable — safe zone is inner 80%, so padding = 10% on each side
const MASKABLE_PADDING = Math.round(512 * 0.10);
savePNG(drawIcon(512, MASKABLE_PADDING), path.join(OUT_DIR, 'icon-maskable-512x512.png'));

// apple-touch-icon — 180x180
savePNG(drawIcon(180), path.join(OUT_DIR, 'apple-touch-icon.png'));

// favicon.ico — create a 32x32 PNG first, then embed as ICO
// (For a proper .ico with multiple sizes, use the `sharp` or `to-ico` package.
//  Here we write a 32x32 PNG named favicon.ico — all modern browsers accept PNG favicons
//  if <link rel="icon"> is also set. A proper ICO is added in the next step.)
savePNG(drawIcon(32), path.join(__dirname, '..', 'public', 'favicon-32x32.png'));

console.log('\nAll icons generated. Next: run `node scripts/generate-favicon-ico.js` for a proper .ico file,');
console.log('or use the PNG favicon via <link rel="icon" type="image/png" href="/favicon-32x32.png">.');

