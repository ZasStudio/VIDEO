import metrics from './fontmetrics.json';

// Font metrics extracted from the bundled TTFs (ae/fontmetrics.json) so layouts
// (sticker boxes, bubbles, labels) match the Remotion render.

export const F = {
  display: 'Anton-Regular',
  block: 'ArchivoBlack-Regular',
  sign: 'Bungee-Regular',
  marker: 'PermanentMarker-Regular',
  black: 'SourceSans3-Black',
  xbold: 'SourceSans3-ExtraBold',
  bold: 'SourceSans3-Bold',
} as const;

type M = {upm: number; asc: number; desc: number; typoAsc: number; typoDesc: number; useTypo: boolean; adv: Record<string, number>};
const DB = metrics as unknown as Record<string, M>;

const m = (font: string) => {
  const x = DB[font];
  if (!x) throw new Error(`Unknown font ${font}`);
  return x;
};

/** Ascent / descent as a fraction of the em (what Chrome uses for line boxes). */
export const vm = (font: string) => {
  const x = m(font);
  const asc = (x.useTypo ? x.typoAsc : x.asc) / x.upm;
  const desc = (x.useTypo ? x.typoDesc : x.desc) / x.upm;
  return {asc, desc};
};

export const width = (font: string, size: number, s: string, letterSpacing = 0) => {
  const x = m(font);
  let w = 0;
  for (const ch of s) w += (x.adv[ch] ?? x.adv['n'] ?? x.upm * 0.5) / x.upm;
  return w * size + letterSpacing * [...s].length;
};

/** Baseline offset from the top of a line box of `lineHeight` (multiplier, or 'normal'). */
export const baseline = (font: string, size: number, lineHeight: number | 'normal' = 'normal') => {
  const {asc, desc} = vm(font);
  const lh = lineHeight === 'normal' ? asc + desc : lineHeight;
  return ((lh - (asc + desc)) / 2 + asc) * size;
};

export const lineBox = (font: string, size: number, lineHeight: number | 'normal' = 'normal') => {
  const {asc, desc} = vm(font);
  return (lineHeight === 'normal' ? asc + desc : lineHeight) * size;
};

/** Greedy word wrap to a max width. */
export const wrap = (font: string, size: number, s: string, maxWidth: number) => {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && width(font, size, next) > maxWidth) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
};

/** CSS letter-spacing (px) -> After Effects tracking (1/1000 em). */
export const tracking = (px: number, size: number) => Math.round((px / size) * 1000);
