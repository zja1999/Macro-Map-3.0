/* Generates PWA icons (public/icon-*.png) from an inline SVG using sharp.
 * Run once: node scripts/gen-icons.mjs — outputs are committed. */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0a0e0d"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#1e2a26" stroke-width="40"/>
  <path d="M 256 106 A 150 150 0 1 1 122.6 335.4" fill="none" stroke="#a3e635"
        stroke-width="40" stroke-linecap="round"/>
  <text x="256" y="292" font-family="Arial, sans-serif" font-size="120" font-weight="800"
        text-anchor="middle" fill="#a3e635">M</text>
</svg>`;

for (const size of [192, 512]) {
  const png = await sharp(Buffer.from(svg(size))).resize(size, size).png().toBuffer();
  writeFileSync(`public/icon-${size}.png`, png);
  console.log(`public/icon-${size}.png (${png.length} bytes)`);
}
