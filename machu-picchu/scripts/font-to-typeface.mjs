// Converts a WOFF/TTF font into the typeface JSON that three.js FontLoader reads,
// so titles can be extruded as real 3D geometry (same logic as three's TTFLoader).
// Usage: node scripts/font-to-typeface.mjs <in.woff> <out.json>
import fs from 'node:fs';
import opentype from 'opentype.js';

const [input, output] = process.argv.slice(2);
const buf = fs.readFileSync(input);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

// Only the characters the video needs (Spanish uppercase/lowercase, digits, punctuation).
const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  'ÁÉÍÓÚÜÑáéíóúüñ¡!¿?#%.,:;\'"-+()/&$@*’ ';

const round = Math.round;
const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
const glyphs = {};
const missing = [];

for (const ch of CHARSET) {
  const glyph = font.charToGlyph(ch);
  if (!glyph || glyph.index === 0) {
    missing.push(ch);
    continue;
  }
  const token = {
    ha: round(glyph.advanceWidth * scale),
    x_min: round((glyph.xMin ?? 0) * scale),
    x_max: round((glyph.xMax ?? 0) * scale),
    o: '',
  };
  for (const c of glyph.path.commands) {
    const type = c.type.toLowerCase() === 'c' ? 'b' : c.type.toLowerCase();
    token.o += type + ' ';
    if (c.x !== undefined && c.y !== undefined) token.o += round(c.x * scale) + ' ' + round(c.y * scale) + ' ';
    if (c.x1 !== undefined && c.y1 !== undefined) token.o += round(c.x1 * scale) + ' ' + round(c.y1 * scale) + ' ';
    if (c.x2 !== undefined && c.y2 !== undefined) token.o += round(c.x2 * scale) + ' ' + round(c.y2 * scale) + ' ';
  }
  glyphs[ch] = token;
}

const json = {
  glyphs,
  familyName: font.getEnglishName('fullName'),
  ascender: round(font.ascender * scale),
  descender: round(font.descender * scale),
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: {
    xMin: font.tables.head.xMin,
    xMax: font.tables.head.xMax,
    yMin: font.tables.head.yMin,
    yMax: font.tables.head.yMax,
  },
  resolution: 1000,
};

fs.writeFileSync(output, JSON.stringify(json));
console.log(`${output}: ${Object.keys(glyphs).length} glyphs, missing: ${JSON.stringify(missing.join(''))}`);
