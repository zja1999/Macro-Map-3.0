/* Generates PWA icons (public/icon-*.png) from the MacroVerse SVG mark.
 * Run once: node scripts/gen-icons.mjs - outputs are committed. */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg");

for (const size of [192, 512]) {
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  writeFileSync(`public/icon-${size}.png`, png);
  console.log(`public/icon-${size}.png (${png.length} bytes)`);
}
