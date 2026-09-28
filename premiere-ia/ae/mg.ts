import {EASE_IN_OUT, EASE_OUT, pop, ramp, rand} from '../src/anim';
import {C} from '../src/theme';
import {Item, Layer, V, Vec, hex, holds, keys, rgba, sample} from './model';
import {parsePath} from './svgpath';
import {F, baseline, lineBox, tracking, width, wrap} from './text';

// Motion-graphics builders that mirror src/mg/*.tsx as native AE layers.
// All positions are screen coordinates of a 1920x1080 scene comp; `ctx.off` is
// subtracted when the layers are parented to a camera null.

export type Ctx = {parent?: string; off: Vec; N: number /* scene frames */};

const at = (ctx: Ctx, x: number, y: number): Vec => [x - ctx.off[0], y - ctx.off[1]];
const sec = (f: number) => Math.round((f / 30) * 10000) / 10000;
const clampOut = (ctx: Ctx, f: number) => Math.min(ctx.N, f);

const rectItem = (w: number, h: number, cx: number, cy: number, fill: Vec, r = 0, fo?: number): Item => ({
  t: 'g',
  it: [{t: 'rect', sz: [w, h], p: [cx, cy], r}, {t: 'fill', c: fill, ...(fo !== undefined ? {o: fo} : {})}],
});

/** Text layer helper. (x, y) = baseline start (left) or baseline center (center). */
export const text = (
  name: string,
  parent: string | undefined,
  s: string,
  font: string,
  size: number,
  x: number,
  y: number,
  o: {fill?: string; stroke?: string; sw?: number; just?: 'l' | 'c' | 'r'; ls?: number; lead?: number} = {},
): Layer => ({
  t: 'text',
  name,
  ...(parent ? {parent} : {}),
  tr: {p: [x, y]},
  txt: {
    s,
    font,
    size,
    ...(o.fill !== undefined ? {fill: rgba(o.fill)} : {fill: rgba(C.white)}),
    ...(o.stroke ? {stroke: rgba(o.stroke), sw: o.sw ?? 4} : {}),
    just: o.just ?? 'l',
    ...(o.ls ? {track: tracking(o.ls, size)} : {}),
    ...(o.lead ? {lead: o.lead} : {}),
  },
});

// ---------- background ----------

export const bgImage = (ctx: Ctx, name: string, src: string): Layer => ({
  t: 'footage',
  name,
  src,
  ...(ctx.parent ? {parent: ctx.parent} : {}),
  tr: {p: at(ctx, 960, 540)},
});

export const driftWord = (ctx: Ctx, name: string, word: string, color: string, xAt: (f: number) => number): Layer => {
  const l = text(name, ctx.parent, `${word} ${word}`, F.display, 620, 0, 0, {fill: undefined, stroke: color, sw: 4, just: 'c', ls: 20});
  l.txt!.fill = undefined;
  delete l.txt!.fill;
  l.tr = {p: sample((f) => at(ctx, xAt(f), 760), 0, ctx.N, {tol: 0.5}) as V<Vec>, o: 55};
  return l;
};

// ---------- ticker tape ----------

export const ticker = (
  ctx: Ctx,
  id: string,
  o: {text: string; y: number; rotate: number; speed: number; enter: number; height: number; bg?: string; color?: string; accent?: string},
): Layer[] => {
  const bg = o.bg ?? C.ink;
  const color = o.color ?? C.white;
  const accent = o.accent ?? C.red;
  const h = o.height + 8;
  const size = o.height * 0.56;
  const unit = `${o.text}    —    `;
  const unitW = width(F.display, size, unit, 2);
  const need = 2520 + Math.abs(o.speed) * ctx.N + 1600;
  const reps = Math.ceil(need / unitW) + 1;
  const x0 = o.speed < 0 ? -1260 - 1400 : -1260;
  const nul = `${id} · control`;
  return [
    {
      t: 'null',
      name: nul,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      tr: {
        p: sample((f) => at(ctx, 960 + ramp(f, o.enter, o.enter + 14, [-2600, 0], EASE_OUT), o.y), 0, ctx.N, {tol: 0.5}) as V<Vec>,
        r: o.rotate,
      },
    },
    {
      t: 'shape',
      name: `${id} · cinta`,
      parent: nul,
      tr: {p: [0, 0]},
      items: [
        rectItem(2520, 4, 0, h / 2 - 2, rgba(accent)),
        rectItem(2520, 4, 0, -h / 2 + 2, rgba(accent)),
        rectItem(2520, h, 0, 0, rgba(bg)),
        rectItem(2520, h, 0, 10, hex('#000000', 1), 0, 25),
      ],
    },
    {
      ...text(`${id} · texto`, nul, unit.repeat(reps), F.display, size, 0, 0, {fill: color, ls: 2}),
      tr: {p: keys([[0, [x0, baseline(F.display, size) - lineBox(F.display, size) / 2]], [ctx.N, [x0 - o.speed * ctx.N, baseline(F.display, size) - lineBox(F.display, size) / 2]]])},
    },
  ];
};

// ---------- sticker ----------

type Run = {s: string; color?: string; stroke?: string; sw?: number};

export const sticker = (
  ctx: Ctx,
  id: string,
  o: {start: number; exit?: number; x: number; y: number; rotate?: number; bg?: string; color?: string; font?: string; size?: number; runs: Run[]; pad?: [number, number]; anchor?: 'center' | 'left'; pos?: (f: number) => Vec; textAt?: (f: number) => string; end?: number},
): Layer[] => {
  const S = o.size ?? 64;
  const font = o.font ?? F.display;
  const rot = o.rotate ?? -6;
  const [py, px] = (o.pad ?? [0.12, 0.4]).map((e) => e * S);
  const b = Math.max(4, S * 0.08);
  const k = Math.max(3, S * 0.05);
  const R = S * 0.16;
  const tw = o.runs.reduce((a, r) => a + width(font, S, r.s, 1), 0);
  const W = tw + 2 * px + 2 * b;
  const H = 1.05 * S + 2 * py + 2 * b;
  const cx = o.anchor === 'left' ? W / 2 : 0;
  const nul = `${id} · control`;
  const scale = (f: number) => pop(f, o.start, {damping: 9, stiffness: 190}) * (o.exit !== undefined ? ramp(f, o.exit, o.exit + 8, [1, 0], EASE_IN_OUT) : 1);
  const layers: Layer[] = [
    {
      t: 'null',
      name: nul,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      in: sec(o.start),
      ...(o.exit !== undefined ? {out: sec(clampOut(ctx, o.exit + 9))} : o.end !== undefined ? {out: sec(o.end)} : {}),
      tr: {
        p: o.pos
          ? (sample((f) => {
              const q = o.pos!(f);
              return at(ctx, q[0], q[1]);
            }, o.start, clampOut(ctx, o.exit !== undefined ? o.exit + 9 : (o.end ?? ctx.N)), {step: 2, tol: 0.5}) as V<Vec>)
          : at(ctx, o.x, o.y),
        r: sample((f) => rot + (1 - pop(f, o.start, {damping: 9, stiffness: 190})) * 18, o.start, Math.min(ctx.N, o.start + 30), {tol: 0.2}) as V<number>,
        s: sample((f) => [scale(f) * 100, scale(f) * 100], o.start, clampOut(ctx, o.exit !== undefined ? o.exit + 9 : o.start + 30), {tol: 0.5}) as V<Vec>,
      },
    },
    {
      t: 'shape',
      name: `${id} · caja`,
      parent: nul,
      tr: {p: [0, 0]},
      items: [
        rectItem(W - 2 * b, H - 2 * b, cx, 0, rgba(o.bg ?? C.yellow), R - b),
        rectItem(W, H, cx, 0, rgba(C.white), R),
        rectItem(W + 2 * k, H + 2 * k, cx, 0, rgba(C.ink), R + k),
        rectItem(W + 2 * k, H + 2 * k, cx + S * 0.12, S * 0.14, hex('#000000', 1), R + k, 35),
      ],
    },
  ];
  let x = cx - W / 2 + b + px;
  const y = -H / 2 + b + py + baseline(font, S, 1.05);
  o.runs.forEach((r, i) => {
    const l = text(`${id} · texto${o.runs.length > 1 ? ` ${i + 1}` : ''}`, nul, r.s, font, S, x, y, {fill: r.color ?? o.color ?? C.ink, stroke: r.stroke, sw: r.sw, ls: 1});
    if (o.textAt) {
      const k: [number, string][] = [];
      let last = '';
      for (let f = o.start; f <= clampOut(ctx, o.end ?? ctx.N); f++) {
        const v = o.textAt(f);
        if (v !== last) k.push([sec(f), v]);
        last = v;
      }
      l.txt!.keys = k;
    }
    layers.push(l);
    x += width(font, S, r.s, 1);
  });
  return layers;
};

// ---------- kinetic block title ----------

export const blockTitle = (
  ctx: Ctx,
  id: string,
  o: {start: number; text: string; x: number; y: number; size: number; color?: string; stroke?: string; shadow?: string | null; align?: 'l' | 'c' | 'r'; stagger?: number; rotate?: number; exit?: number; font?: string; opacity?: V<number>; offset?: V<Vec>; blend?: 'screen'},
): Layer[] => {
  const S = o.size;
  const font = o.font ?? F.display;
  const n = [...o.text].length;
  const stagger = o.stagger ?? 2;
  const y = o.y + baseline(font, S, 1);
  const sw = Math.max(3, S * 0.05);
  const reveal = {
    name: 'Entrada letra a letra',
    o: 0,
    s: 40,
    p: [0, Math.round(S * 0.6)],
    start: keys([
      [o.start, 0],
      [o.start + n * stagger, 100],
    ]),
  };
  const exitKeys = (f: number) => (o.exit !== undefined ? ramp(f, o.exit, o.exit + 10 + n, [0, 1], EASE_IN_OUT) : 0);
  const mk = (name: string, dx: number, dy: number, fill: string, stroke: string): Layer => {
    const l = text(name, ctx.parent, o.text, font, S, 0, 0, {fill, stroke, sw, just: o.align ?? 'l', ls: S * 0.01});
    l.in = sec(o.start);
    if (o.exit !== undefined) l.out = sec(clampOut(ctx, o.exit + 11 + n));
    const base = at(ctx, o.x + dx, y + dy);
    l.tr = {
      p:
        o.offset ??
        (o.exit !== undefined
          ? (sample((f) => [base[0], base[1] - exitKeys(f) * S * 0.4], o.exit, clampOut(ctx, o.exit + 11 + n), {tol: 0.5}) as V<Vec>)
          : base),
      o: o.opacity ?? (o.exit !== undefined ? (sample((f) => 100 * (1 - exitKeys(f)), o.exit, clampOut(ctx, o.exit + 11 + n), {tol: 0.5}) as V<number>) : 100),
      ...(o.rotate ? {r: o.rotate} : {}),
    };
    l.anim = [reveal];
    if (o.blend) l.blend = o.blend;
    return l;
  };
  const out: Layer[] = [];
  if (o.shadow !== null) out.push(mk(`${id} · sombra`, S * 0.06, S * 0.07, o.shadow ?? C.ink, o.shadow ?? C.ink));
  out.push(mk(id, 0, 0, o.color ?? C.white, o.stroke ?? C.ink));
  return out;
};

// ---------- scene tag ----------

export const sceneTag = (ctx: Ctx, id: string, o: {start: number; exit?: number; num: string; label: string}): Layer[] => {
  const S = 58;
  const lb = lineBox(F.display, S);
  const H = lb + 8 + 10;
  const W1 = width(F.display, S, o.num) + 44 + 10;
  const W2 = width(F.display, S, o.label, 2) + 56 + 10;
  const nul = `${id} · control`;
  const xAt = (f: number) => {
    const s = ramp(f, o.start, o.start + 12, [0, 1]);
    const out = o.exit !== undefined ? ramp(f, o.exit, o.exit + 10, [0, 1], EASE_IN_OUT) : 0;
    return -1400 + 1480 * s - 1600 * out;
  };
  const end = o.exit !== undefined ? o.exit + 10 : ctx.N;
  const bl = 5 + 4 + baseline(F.display, S);
  return [
    {
      t: 'null',
      name: nul,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      in: sec(o.start),
      out: sec(clampOut(ctx, end)),
      tr: {p: sample((f) => at(ctx, xAt(f), 64), o.start, clampOut(ctx, end), {tol: 0.5}) as V<Vec>, r: -2},
    },
    {
      t: 'shape',
      name: `${id} · cajas`,
      parent: nul,
      tr: {p: [0, 0]},
      items: [
        rectItem(W2 - 10, H - 10, W1 + W2 / 2, H / 2, rgba(C.ink)),
        rectItem(W2, H, W1 + W2 / 2, H / 2, rgba(C.ink)),
        rectItem(W1 - 10, H - 10, W1 / 2, H / 2, rgba(C.yellow)),
        rectItem(W1, H, W1 / 2, H / 2, rgba(C.ink)),
        rectItem(W1 + W2, H, (W1 + W2) / 2 + 8, H / 2 + 10, hex('#000000', 1), 0, 35),
      ],
    },
    text(`${id} · número`, nul, o.num, F.display, S, 5 + 22, bl, {fill: C.ink}),
    text(`${id} · título`, nul, o.label, F.display, S, W1 + 5 + 28, bl, {fill: C.white, ls: 2}),
  ];
};

// ---------- speech bubble ----------

export const speechBubble = (ctx: Ctx, id: string, o: {start: number; exit?: number; x: number; y: number; side?: 'left' | 'right'; text: string; size?: number; maxWidth?: number}): Layer[] => {
  const S = o.size ?? 40;
  const maxW = o.maxWidth ?? 620;
  const lines = wrap(F.black, S, o.text, maxW);
  const contentW = Math.min(maxW, Math.max(...lines.map((l) => width(F.black, S, l))));
  const W = contentW + 2 * 0.55 * S + 14;
  const H = lines.length * 1.12 * S + 2 * 0.35 * S + 14;
  const left = o.side === 'right';
  const bx = left ? 26 : -26 - W;
  const by = -40 - H;
  const nul = `${id} · control`;
  const scale = (f: number) => pop(f, o.start, {damping: 11, stiffness: 220}) * (o.exit !== undefined ? ramp(f, o.exit, o.exit + 7, [1, 0], EASE_IN_OUT) : 1);
  const end = o.exit !== undefined ? o.exit + 8 : o.start + 30;
  const tail = left ? 'M 0,0 L 70,-36 L 30,-58 Z' : 'M 0,0 L -70,-36 L -30,-58 Z';
  const cover = left ? 'M 8,-8 L 58,-40 L 30,-54 Z' : 'M -8,-8 L -58,-40 L -30,-54 Z';
  const len = o.text.length;
  const typed = (f: number) => (ramp(f, o.start + 2, o.start + 2 + Math.max(6, len * 0.55), [0, len]) / len) * 100;
  const tx = bx + 7 + 0.55 * S;
  const ty = by + 7 + 0.35 * S + baseline(F.black, S, 1.12);
  return [
    {
      t: 'null',
      name: nul,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      in: sec(o.start),
      ...(o.exit !== undefined ? {out: sec(clampOut(ctx, end))} : {}),
      tr: {p: at(ctx, o.x, o.y), s: sample((f) => [scale(f) * 100, scale(f) * 100], o.start, clampOut(ctx, end), {tol: 0.5}) as V<Vec>},
    },
    {
      t: 'shape',
      name: `${id} · globo`,
      parent: nul,
      tr: {p: [0, 0]},
      items: [
        {t: 'g', n: 'Tapa cola', it: [...parsePath(cover).map((d) => ({t: 'path', d}) as Item), {t: 'fill', c: rgba(C.white)}]},
        rectItem(W - 14, H - 14, bx + W / 2, by + H / 2, rgba(C.white), S * 0.6 - 7),
        rectItem(W, H, bx + W / 2, by + H / 2, rgba(C.ink), S * 0.6),
        {t: 'g', n: 'Cola', it: [...parsePath(tail).map((d) => ({t: 'path', d}) as Item), {t: 'stroke', c: rgba(C.ink), w: 7, lj: 2}, {t: 'fill', c: rgba(C.white)}]},
        rectItem(W, H, bx + W / 2 + 10, by + H / 2 + 12, hex('#000000', 1), S * 0.6, 30),
      ],
    },
    {
      ...text(`${id} · texto`, nul, lines.join('\r'), F.black, S, tx, ty, {fill: C.ink, lead: 1.12 * S}),
      anim: [{name: 'Escritura', o: 0, start: sample(typed, o.start, o.start + 4 + Math.ceil(Math.max(6, len * 0.55)), {tol: 1}) as V<number>}],
    },
  ];
};

// ---------- keycap ----------

export const keyCap = (ctx: Ctx, id: string, o: {start: number; exit?: number; x: number; y: number; label: string; sub?: string; press?: number; size?: number}): Layer[] => {
  const S = o.size ?? 110;
  const W = Math.max(S, o.label.length * S * 0.42 + S * 0.4);
  const nul = `${id} · control`;
  const keyNul = `${id} · tecla`;
  const scale = (f: number) => pop(f, o.start, {damping: 9, stiffness: 200}) * (o.exit !== undefined ? ramp(f, o.exit, o.exit + 8, [1, 0]) : 1);
  const end = o.exit !== undefined ? o.exit + 9 : o.start + 30;
  const bw = S * 0.05;
  const r = S * 0.18;
  const labelSize = S * 0.42;
  const subSize = S * 0.14;
  const lh1 = lineBox(F.block, labelSize);
  const lh2 = o.sub ? lineBox(F.xbold, subSize) : 0;
  const total = lh1 + (o.sub ? lh2 - S * 0.02 : 0);
  const top = -total / 2;
  const down = (f: number) => (o.press !== undefined && f >= o.press && f < o.press + 5 ? 1 : 0);
  const layers: Layer[] = [
    {
      t: 'null',
      name: nul,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      in: sec(o.start),
      ...(o.exit !== undefined ? {out: sec(clampOut(ctx, end))} : {}),
      tr: {p: at(ctx, o.x, o.y), s: sample((f) => [scale(f) * 100, scale(f) * 100], o.start, clampOut(ctx, end), {tol: 0.5}) as V<Vec>},
    },
    {t: 'shape', name: `${id} · base`, parent: nul, tr: {p: [0, 0]}, items: [rectItem(W, S, 0, S * 0.12, rgba(C.ink), r)]},
    {t: 'null', name: keyNul, parent: nul, tr: {p: o.press !== undefined ? (holds((f) => [0, down(f) * S * 0.08], o.start, clampOut(ctx, end)) as V<Vec>) : [0, 0]}},
    {t: 'shape', name: `${id} · cara`, parent: keyNul, tr: {p: [0, 0]}, items: [rectItem(W - 2 * bw, S - 2 * bw, 0, 0, rgba('#F4F4F4'), r - bw), rectItem(W, S, 0, 0, rgba(C.ink), r)]},
    text(`${id} · letra`, keyNul, o.label, F.block, labelSize, 0, top + baseline(F.block, labelSize), {fill: C.ink, just: 'c'}),
  ];
  if (o.sub) layers.push(text(`${id} · texto`, keyNul, o.sub, F.xbold, subSize, 0, top + lh1 - S * 0.02 + baseline(F.xbold, subSize), {fill: '#555555', just: 'c'}));
  return layers;
};

// ---------- callout (dim + animated highlight) ----------

export const callout = (ctx: Ctx, id: string, o: {start: number; end: number; rect: (f: number) => {x: number; y: number; w: number; h: number}; dim?: number}): Layer[] => {
  const dim = o.dim ?? 0.55;
  const pad = 8;
  const f0 = o.start - 2;
  const f1 = clampOut(ctx, o.end + 8);
  const inP = (f: number) => ramp(f, o.start, o.start + 10);
  const outP = (f: number) => ramp(f, o.end, o.end + 8);
  const size = sample((f) => {
    const r = o.rect(f);
    return [r.w + pad * 2, r.h + pad * 2];
  }, f0, f1, {step: 2, tol: 0.5}) as V<Vec>;
  const center = sample((f) => {
    const r = o.rect(f);
    return at(ctx, r.x + r.w / 2, r.y + r.h / 2);
  }, f0, f1, {step: 2, tol: 0.5}) as V<Vec>;
  return [
    {
      t: 'shape',
      name: `${id} · oscurecer`,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      in: sec(f0),
      out: sec(f1),
      tr: {p: [0, 0], o: sample((f) => dim * inP(f) * (1 - outP(f)) * 100, f0, f1, {tol: 0.5}) as V<number>},
      items: [
        {
          t: 'g',
          n: 'Máscara',
          it: [{t: 'rect', sz: size, p: center, r: 12}, {t: 'rect', sz: [4000, 3000], p: at(ctx, 960, 540)}, {t: 'merge', m: 3}, {t: 'fill', c: hex('#000000', 1)}],
        },
      ],
    },
    {
      t: 'shape',
      name: `${id} · marco`,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      in: sec(f0),
      out: sec(f1),
      tr: {p: [0, 0], o: sample((f) => 100 * (1 - outP(f)), f0, f1, {tol: 0.5}) as V<number>},
      items: [
        {
          t: 'g',
          n: 'Marco',
          it: [
            {t: 'rect', sz: size, p: center, r: 12},
            {t: 'trim', s: 0, e: sample((f) => inP(f) * 100, f0, f1, {tol: 0.3}) as V<number>},
            {t: 'stroke', c: rgba(C.yellow), w: 7, lj: 2},
            {t: 'stroke', c: rgba(C.ink), w: 14, lj: 2},
          ],
        },
      ],
    },
  ];
};

export const calloutLabel = (ctx: Ctx, id: string, o: {start: number; end: number; pos: (f: number) => Vec; title: string; desc: string}): Layer[] => {
  const nul = `${id} · control`;
  const T = 56;
  const D = 30;
  const W1 = width(F.display, T, o.title) + 36 + 10;
  const H1 = 1.05 * T + 8 + 10;
  const W2 = width(F.xbold, D, o.desc) + 36 + 10;
  const H2 = lineBox(F.xbold, D) + 12 + 10;
  const top1 = -(H2 - 5) - H1;
  const scale = (f: number) => pop(f, o.start, {damping: 11, stiffness: 200}) * ramp(f, o.end, o.end + 8, [1, 0]);
  const f1 = clampOut(ctx, o.end + 9);
  return [
    {
      t: 'null',
      name: nul,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      in: sec(o.start),
      out: sec(f1),
      tr: {
        p: sample((f) => {
          const p = o.pos(f);
          return at(ctx, p[0], p[1]);
        }, o.start, f1, {step: 2, tol: 0.5}) as V<Vec>,
        r: -2,
        s: sample((f) => [scale(f) * 100, scale(f) * 100], o.start, f1, {tol: 0.5}) as V<Vec>,
      },
    },
    {
      t: 'shape',
      name: `${id} · cajas`,
      parent: nul,
      tr: {p: [0, 0]},
      items: [
        rectItem(W2 - 10, H2 - 10, 14 + W2 / 2, -H2 / 2, rgba(C.ink)),
        rectItem(W2, H2, 14 + W2 / 2, -H2 / 2, rgba(C.ink)),
        rectItem(W1 - 10, H1 - 10, W1 / 2, top1 + H1 / 2, rgba(C.yellow)),
        rectItem(W1, H1, W1 / 2, top1 + H1 / 2, rgba(C.ink)),
        rectItem(W2, H2, 14 + W2 / 2 + 8, -H2 / 2 + 10, hex('#000000', 1), 0, 35),
        rectItem(W1, H1, W1 / 2 + 8, top1 + H1 / 2 + 10, hex('#000000', 1), 0, 35),
      ],
    },
    text(`${id} · título`, nul, o.title, F.display, T, 5 + 18, top1 + 5 + 4 + baseline(F.display, T, 1.05), {fill: C.ink}),
    text(`${id} · texto`, nul, o.desc, F.xbold, D, 14 + 5 + 18, -H2 + 5 + 6 + baseline(F.xbold, D), {fill: C.white}),
  ];
};

// ---------- sparkle / burst / corner marks ----------

const STAR = 'M0,-50 C6,-10 10,-6 50,0 C10,6 6,10 0,50 C-6,10 -10,6 -50,0 C-10,-6 -6,-10 0,-50 Z';

export const sparkle = (ctx: Ctx, id: string, o: {x: number; y: number; size: number; start: number; color?: string; spin?: number; end?: number}): Layer => {
  const end = o.end ?? ctx.N;
  const sc = (f: number) => pop(f, o.start, {damping: 8}) * (0.85 + 0.15 * Math.sin((f - o.start) * 0.4));
  return {
    t: 'shape',
    name: id,
    ...(ctx.parent ? {parent: ctx.parent} : {}),
    in: sec(o.start),
    out: sec(end),
    tr: {
      p: at(ctx, o.x, o.y),
      s: sample((f) => [sc(f) * o.size, sc(f) * o.size], o.start, end, {step: 2, tol: 1}) as V<Vec>,
      r: keys([
        [o.start, 0],
        [end, (end - o.start) * 2 * (o.spin ?? 1)],
      ]),
    },
    items: [{t: 'g', n: 'Estrella', it: [...parsePath(STAR).map((d) => ({t: 'path', d}) as Item), {t: 'stroke', c: rgba(C.ink), w: 6, lj: 2}, {t: 'fill', c: rgba(o.color ?? C.white)}]}],
  };
};

export const burst = (ctx: Ctx, id: string, o: {x: number; y: number; start: number; color?: string; radius?: number; count?: number}): Layer => {
  const R = o.radius ?? 220;
  const n = o.count ?? 14;
  const p = (f: number) => ramp(f, o.start, o.start + 12);
  const fade = (f: number) => 1 - ramp(f, o.start + 8, o.start + 16);
  const lines: Item[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(i) * 0.2;
    const shape = (f: number) => {
      const r0 = R * (0.45 + 0.5 * p(f));
      const r1 = r0 + R * 0.35 * (1 - p(f) * 0.6);
      return {v: [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: 0 as const};
    };
    const k: [number, ReturnType<typeof shape>][] = [];
    for (let f = o.start; f <= o.start + 16; f += 2) k.push([Math.round(((f - o.start) / 30 + o.start / 30) * 10000) / 10000, shape(f)]);
    lines.push({t: 'path', d: {k}});
  }
  lines.push({t: 'stroke', c: rgba(o.color ?? C.white), w: sample((f) => 10 * fade(f), o.start, o.start + 16, {tol: 0.2}) as V<number>, lc: 2});
  return {
    t: 'shape',
    name: id,
    ...(ctx.parent ? {parent: ctx.parent} : {}),
    in: sec(o.start),
    out: sec(clampOut(ctx, o.start + 17)),
    tr: {p: at(ctx, o.x, o.y)},
    items: [{t: 'g', n: 'Líneas', it: lines}],
  };
};

export const cornerMarks = (ctx: Ctx, id: string, o: {start: number; color?: string; alpha?: number; end?: number}): Layer => {
  const inset = 70;
  const pts = [
    [inset, inset],
    [1920 - inset, inset],
    [inset, 1080 - inset],
    [1920 - inset, 1080 - inset],
  ];
  const len = (f: number) => 34 * ramp(f, o.start, o.start + 14);
  const seg = (x0: number, y0: number, x1: number, y1: number): Item => ({t: 'path', d: {v: [at(ctx, x0, y0), at(ctx, x1, y1)], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: 0}});
  const items: Item[] = [];
  for (const [x, y] of pts) {
    items.push(seg(x - 34, y, x + 34, y));
    items.push(seg(x, y - 34, x, y + 34));
  }
  items.push({t: 'trim', s: sample((f) => 50 - (len(f) / 34) * 50, o.start, o.start + 14, {tol: 0.3}) as V<number>, e: sample((f) => 50 + (len(f) / 34) * 50, o.start, o.start + 14, {tol: 0.3}) as V<number>});
  items.push({t: 'stroke', c: rgba(o.color ?? C.white), w: 2.5, o: Math.round((o.alpha ?? 0.85) * 100)});
  return {t: 'shape', name: id, ...(ctx.parent ? {parent: ctx.parent} : {}), in: sec(o.start), ...(o.end ? {out: sec(o.end)} : {}), tr: {p: [0, 0]}, items: [{t: 'g', n: 'Cruces', it: items}]};
};

// ---------- transitions ----------

export const slashWipe = (id: string, at0: number, colors: string[] = [C.ink, C.white, C.red], dur = 12): Layer[] =>
  colors.map((col, i) => {
    const delay = i * 2;
    const w = 2600 - i * 180;
    const left = (f: number) => {
      const pIn = ramp(f, at0 - dur + delay, at0 - 1 + delay * 0.3, [0, 1], EASE_IN_OUT);
      const pOut = ramp(f, at0 + delay * 0.5, at0 + dur, [0, 1], EASE_IN_OUT);
      return -2800 + pIn * 2600 + pOut * 2600;
    };
    return {
      t: 'shape',
      name: `${id} · banda ${i + 1}`,
      in: sec(at0 - dur),
      out: sec(at0 + dur + 1),
      tr: {p: sample((f) => [left(f) + w / 2, 540], at0 - dur, at0 + dur, {tol: 1}) as V<Vec>, r: 14},
      items: [rectItem(w, 1880, 0, 0, rgba(col))],
    } as Layer;
  });

export const flash = (id: string, at0: number, color: string, dur: number): Layer => ({
  t: 'solid',
  name: id,
  color: hex(color),
  in: sec(at0 - 1),
  out: sec(at0 + dur + 1),
  tr: {o: keys([
    [at0 - 1, 0],
    [at0, 90],
    [at0 + dur, 0],
  ])},
});

export const grain = (id: string, amount = 5): Layer => ({
  t: 'adjust',
  name: id,
  fx: [{m: 'ADBE Noise', p: {1: amount}}],
});

// ---------- facecam instance (the comp itself is built in scenes.ts) ----------

export const faceCamInstance = (ctx: Ctx, id: string, o: {start: number; exit?: number; x: number; y: number; d: number; sceneStart: number}): Layer[] => {
  const nul = `${id} · control`;
  const k = o.d / 300;
  const s = (f: number) => pop(f, o.start, {damping: 10, stiffness: 160}) * (o.exit !== undefined ? ramp(f, o.exit, o.exit + 10, [1, 0], EASE_IN_OUT) : 1);
  const end = o.exit !== undefined ? o.exit + 10 : ctx.N;
  return [
    {
      t: 'null',
      name: nul,
      ...(ctx.parent ? {parent: ctx.parent} : {}),
      in: sec(o.start),
      tr: {
        p: at(ctx, o.x, o.y),
        s: sample((f) => [s(f) * k * 100, s(f) * k * 100], o.start, Math.min(end, o.start + 30), {tol: 0.3}) as V<Vec>,
        r: sample((f) => (1 - pop(f, o.start, {damping: 10, stiffness: 160})) * -20, o.start, Math.min(end, o.start + 30), {tol: 0.2}) as V<number>,
      },
    },
    {t: 'comp', name: `${id} · Facecam`, src: 'Facecam (oveja en vivo)', parent: nul, start: -o.sceneStart / 30, in: sec(o.start), tr: {a: [180, 180], p: [0, 0]}},
  ];
};

export const EASES = {EASE_OUT, EASE_IN_OUT};
