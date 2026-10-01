import type {Caption} from '@remotion/captions';
import raw from '../public/captions.json';
import {mapSnap} from './edit';

// Palabras del guion en la línea de tiempo EDITADA.
// whisper.cpp entrega sub-palabras ("esfuer" + "zo") y la puntuación aparte: se unen en palabras.

export type Word = {text: string; startMs: number; endMs: number; key: boolean};

// Correcciones de la transcripción automática.
const FIXES: [RegExp, string][] = [
  [/angelaba/g, 'anhelaba'],
  [/Macbook/g, 'MacBook'],
];

// Palabras clave del mensaje: se destacan en los subtítulos.
const KEYWORDS = new Set([
  'barcelona',
  'apple',
  'store',
  'sueño',
  'macbook',
  'esfuerzo',
  'sacrificio',
  'constancia',
  'españa',
  'sueños',
  'miedo',
  'constante',
  'perseverante',
  'cree',
  'puedes',
  'lograrlo',
  'logra',
  'encuentra',
]);

const merged: {text: string; startMs: number; endMs: number}[] = [];
for (const c of raw as Caption[]) {
  const t = c.text;
  if (merged.length > 0 && !t.startsWith(' ')) {
    const last = merged[merged.length - 1];
    last.text += t;
    last.endMs = Math.max(last.endMs, c.endMs);
  } else {
    merged.push({text: t, startMs: c.startMs, endMs: c.endMs});
  }
}

export const WORDS: Word[] = merged
  .map((w) => {
    const startMs = mapSnap(w.startMs + 30, 'start');
    const endRaw = mapSnap(Math.max(w.startMs + 30, w.endMs - 30), 'end');
    if (startMs === null || endRaw === null) return null;
    // Las palabras dentro de la frase eliminada (15,05–16,8 s) no deben reaparecer.
    if (w.startMs >= 15000 && w.startMs < 16900) return null;
    const endMs = Math.max(endRaw, startMs);
    let text = w.text.trim();
    for (const [re, rep] of FIXES) text = text.replace(re, rep);
    const bare = text.toLowerCase().replace(/[^a-záéíóúñü]/g, '');
    return {text, startMs, endMs: Math.max(endMs, startMs + 80), key: KEYWORDS.has(bare)};
  })
  .filter((w): w is Word => w !== null && w.text.length > 0);

/** Agrupa palabras en "páginas" cortas (máx. 3 palabras, corta en puntuación y en pausas). */
export type Page = {words: Word[]; startMs: number; endMs: number};
export const PAGES: Page[] = (() => {
  const pages: Page[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) pages.push({words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs});
    cur = [];
  };
  WORDS.forEach((w, i) => {
    const prev = WORDS[i - 1];
    if (cur.length && prev && w.startMs - prev.endMs > 350) flush();
    cur.push(w);
    const chars = cur.reduce((a, x) => a + x.text.length, 0);
    if (/[.,?!]$/.test(w.text) || cur.length >= 3 || chars > 16) flush();
  });
  flush();
  return pages;
})();
