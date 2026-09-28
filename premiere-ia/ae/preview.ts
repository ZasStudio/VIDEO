import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {buildProject} from './scenes';
import {Anim, Comp, Item, Layer, PathVal, Tr, V, Vec} from './model';

// Approximate renderer of the After Effects project description, used only to
// check (without After Effects) that the generated project matches the video.
//   npx tsx ae/preview.ts <comp name> <frame> [<frame>...]

const AE_DIR = resolve(__dirname, '..', '..', 'after-effects');
const OUT = resolve(process.env.PREVIEW_OUT ?? '/tmp/ae-preview');
mkdirSync(OUT, {recursive: true});
const project = buildProject();
const comps = new Map(project.comps.map((c) => [c.name, c]));

const isAnim = (v: unknown): v is Anim<unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && 'k' in (v as object);

function valAt<T>(v: V<T> | undefined, t: number, def: T): T {
  if (v === undefined) return def;
  if (!isAnim(v)) return v as T;
  const k = v.k;
  if (t <= k[0][0]) return k[0][1];
  if (t >= k[k.length - 1][0]) return k[k.length - 1][1];
  let i = 0;
  while (k[i + 1][0] < t) i++;
  const [t0, a] = k[i];
  const [t1, b] = k[i + 1];
  if (v.h) return a;
  const u = (t - t0) / (t1 - t0);
  const lerp = (x: unknown, y: unknown): unknown => {
    if (typeof x === 'number') return x + ((y as number) - x) * u;
    if (Array.isArray(x)) return x.map((e, j) => lerp(e, (y as unknown[])[j]));
    if (x && typeof x === 'object') {
      const o: Record<string, unknown> = {};
      for (const key of Object.keys(x)) o[key] = lerp((x as Record<string, unknown>)[key], (y as Record<string, unknown>)[key]);
      return o;
    }
    return x;
  };
  return lerp(a, b) as T;
}

const col = (c: Vec) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
const f = (n: number) => (Math.round(n * 100) / 100).toString();

const trMatrix = (tr: Tr | undefined, t: number, defPos: Vec = [0, 0]) => {
  const a = valAt(tr?.a, t, [0, 0]);
  const p = valAt(tr?.p, t, defPos);
  const s = valAt(tr?.s, t, [100, 100]);
  const r = valAt(tr?.r, t, 0);
  return `translate(${f(p[0])},${f(p[1])}) rotate(${f(r)}) scale(${f(s[0] / 100)},${f(s[1] / 100)}) translate(${f(-a[0])},${f(-a[1])})`;
};

const pathD = (p: PathVal) => {
  const n = p.v.length;
  let d = `M${f(p.v[0][0])},${f(p.v[0][1])}`;
  const segs = p.c ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = p.v[i];
    const b = p.v[(i + 1) % n];
    const c1 = [a[0] + p.o[i][0], a[1] + p.o[i][1]];
    const c2 = [b[0] + p.i[(i + 1) % n][0], b[1] + p.i[(i + 1) % n][1]];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(b[0])},${f(b[1])}`;
  }
  return d + (p.c ? 'Z' : '');
};

let uid = 0;

function geomD(it: Item, t: number): string | null {
  if (it.t === 'path') return pathD(valAt(it.d, t, null as unknown as PathVal));
  if (it.t === 'rect') {
    const [w, h] = valAt(it.sz, t, [0, 0]);
    const [cx, cy] = valAt(it.p, t, [0, 0]);
    const r = Math.min(valAt(it.r, t, 0), w / 2, h / 2);
    const x = cx - w / 2;
    const y = cy - h / 2;
    return `M${f(x + r)},${f(y)}H${f(x + w - r)}A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)}V${f(y + h - r)}A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)}H${f(x + r)}A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)}V${f(y + r)}A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)}Z`;
  }
  if (it.t === 'ell') {
    const [w, h] = valAt(it.sz, t, [0, 0]);
    const [cx, cy] = valAt(it.p, t, [0, 0]);
    return `M${f(cx - w / 2)},${f(cy)}A${f(w / 2)},${f(h / 2)} 0 1 0 ${f(cx + w / 2)},${f(cy)}A${f(w / 2)},${f(h / 2)} 0 1 0 ${f(cx - w / 2)},${f(cy)}Z`;
  }
  return null;
}

/** Render a contents list (front-first, AE order). */
function renderItems(items: Item[], t: number, defs: string[]): string {
  // Walk back-to-front: paint items apply to the geometry listed above them.
  const out: string[] = [];
  const geoms: string[] = []; // path data of geometry above current position (front items)
  // In AE, a paint applies to all paths ABOVE it (earlier in the list) in the same group.
  let clipMode: number | null = null;
  const bucket: {d: string[]; groups: string[]} = {d: [], groups: []};
  for (const it of items) {
    if (it.t === 'g') {
      const tr = it.tr;
      const o = valAt(tr?.o, t, 100);
      bucket.groups.push(`<g transform="${trMatrix(tr, t)}" opacity="${f(o / 100)}">${renderItems(it.it, t, defs)}</g>`);
      continue;
    }
    const d = geomD(it, t);
    if (d) {
      geoms.push(d);
      continue;
    }
    if (it.t === 'merge') {
      clipMode = it.m;
      continue;
    }
    if (it.t === 'trim') continue;
    if (it.t === 'fill' || it.t === 'stroke') {
      const c = valAt(it.c, t, [0, 0, 0, 1]);
      const o = valAt(it.o, t, 100) / 100;
      let paint = '';
      if (clipMode === 4 && geoms.length >= 2) {
        // intersect: last geometry is the clip, the rest is content
        const id = `c${uid++}`;
        defs.push(`<clipPath id="${id}"><path d="${geoms[geoms.length - 1]}"/></clipPath>`);
        paint = `<path d="${geoms.slice(0, -1).join(' ')}" clip-path="url(#${id})"`;
      } else if (clipMode === 3) {
        paint = `<path d="${geoms.slice().reverse().join(' ')}" fill-rule="evenodd"`;
      } else {
        paint = `<path d="${geoms.join(' ')}"`;
      }
      if (it.t === 'fill') out.unshift(`${paint} fill="${col(c)}" fill-opacity="${f(o * (c[3] ?? 1))}" stroke="none"/>`);
      else {
        const w = valAt(it.w, t, 1);
        const trim = items.find((x) => x.t === 'trim') as Extract<Item, {t: 'trim'}> | undefined;
        let dash = '';
        if (trim) {
          const s = valAt(trim.s, t, 0);
          const e = valAt(trim.e, t, 100);
          dash = ` pathLength="100" stroke-dasharray="${f(Math.max(0, e - s))} 100" stroke-dashoffset="${f(-s)}"`;
        }
        out.unshift(`${paint} fill="none" stroke="${col(c)}" stroke-opacity="${f(o)}" stroke-width="${f(w)}" stroke-linecap="${it.lc === 2 ? 'round' : it.lc === 3 ? 'square' : 'butt'}" stroke-linejoin="${it.lj === 2 ? 'round' : it.lj === 3 ? 'bevel' : 'miter'}"${dash}/>`);
      }
    }
  }
  // groups listed first are in front -> reverse so SVG draws back first
  return [...bucket.groups.slice().reverse(), ...out].join('');
}

const FONT_FAMILY: Record<string, string> = {
  'Anton-Regular': 'Anton',
  'ArchivoBlack-Regular': 'Archivo Black',
  'Bungee-Regular': 'Bungee',
  'PermanentMarker-Regular': 'Permanent Marker',
  'SourceSans3-Black': 'SS3 Black',
  'SourceSans3-ExtraBold': 'SS3 ExtraBold',
  'SourceSans3-Bold': 'SS3 Bold',
};

function renderText(l: Layer, t: number): string {
  const st = l.txt!;
  let s = st.s;
  if (st.keys) for (const [kt, v] of st.keys) if (t >= kt) s = v;
  const anchor = st.just === 'c' ? 'middle' : st.just === 'r' ? 'end' : 'start';
  const ls = ((st.track ?? 0) / 1000) * st.size;
  const lines = s.split('\r');
  const lead = st.lead ?? st.size * 1.2;
  // reveal animators: selector start %
  let visibleUpTo = Infinity;
  for (const a of l.anim ?? []) {
    const startPct = valAt(a.start, t, 0);
    if (a.o === 0) visibleUpTo = Math.min(visibleUpTo, Math.round(([...s.replace(/\r/g, '')].length * startPct) / 100));
  }
  let idx = 0;
  const tspans = lines
    .map((line, li) => {
      const chars = [...line]
        .map((ch) => {
          const vis = idx++ < visibleUpTo;
          return `<tspan fill-opacity="${vis ? 1 : 0}" stroke-opacity="${vis ? 1 : 0}">${ch.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</tspan>`;
        })
        .join('');
      return `<tspan x="0" y="${f(li * lead)}">${chars}</tspan>`;
    })
    .join('');
  const fill = st.fill ? col(st.fill) : 'none';
  const stroke = st.stroke ? `stroke="${col(st.stroke)}" stroke-width="${f(st.sw ?? 1)}" paint-order="stroke" stroke-linejoin="round"` : '';
  return `<text font-family="${FONT_FAMILY[st.font] ?? st.font}" font-size="${f(st.size)}" text-anchor="${anchor}" letter-spacing="${f(ls)}" fill="${fill}" ${stroke}>${tspans}</text>`;
}

function frameOfVideo(file: string, t: number): string {
  const png = join(OUT, `plate-${file.replace(/\W/g, '_')}-${Math.round(t * 30)}.png`);
  if (!existsSync(png)) {
    execFileSync('npx', ['remotion', 'ffmpeg', '-loglevel', 'error', '-y', '-ss', t.toFixed(3), '-i', join(AE_DIR, file), '-frames:v', '1', png], {cwd: resolve(__dirname, '..')});
  }
  return png;
}

function renderComp(c: Comp, t: number, defs: string[]): string {
  const byName = new Map<string, Layer>();
  for (const l of c.layers) byName.set(l.name, l);
  const chain = (l: Layer): string => {
    const own = trMatrix(l.tr, t, l.t === 'null' || l.t === 'shape' ? [c.w / 2, c.h / 2] : [c.w / 2, c.h / 2]);
    return l.parent ? `${chain(byName.get(l.parent)!)} ${own}` : own;
  };
  const parts: string[] = [];
  c.layers.forEach((l, i) => {
    const lt = t - (l.start ?? 0);
    if (l.in !== undefined && t < l.in - 1e-6) return;
    if (l.out !== undefined && t >= l.out - 1e-6) return;
    if (l.t === 'null' || l.t === 'adjust') return;
    // own opacity (parents' opacity does not propagate in AE)
    const op = valAt(l.tr?.o, t, 100) / 100;
    let body = '';
    if (l.t === 'shape') body = renderItems(l.items ?? [], t, defs);
    else if (l.t === 'text') body = renderText(l, t);
    else if (l.t === 'solid') {
      body = `<rect x="0" y="0" width="${l.w ?? c.w}" height="${l.h ?? c.h}" fill="${col(l.color ?? [0, 0, 0])}"/>`;
      if (!l.tr?.a) l.tr = {...(l.tr ?? {}), a: [(l.w ?? c.w) / 2, (l.h ?? c.h) / 2]};
    }
    else if (l.t === 'footage') {
      const src = project.footage[l.src!];
      if (!src || src.file.endsWith('.wav')) return;
      const file = src.file.endsWith('.mp4') ? frameOfVideo(src.file, lt) : join(AE_DIR, src.file);
      body = `<image href="file://${file}" x="0" y="0" width="1920" height="1080"/>`;
      // footage layers: default anchor = center of the footage
      if (!l.tr?.a) {
        l.tr = {...(l.tr ?? {}), a: [960, 540]};
      }
    } else if (l.t === 'comp') {
      const src = comps.get(l.src!)!;
      const id = `cc${uid++}`;
      defs.push(`<clipPath id="${id}"><rect x="0" y="0" width="${src.w}" height="${src.h}"/></clipPath>`);
      body = `<g clip-path="url(#${id})">${renderComp(src, lt, defs)}</g>`;
      if (!l.tr?.a) l.tr = {...(l.tr ?? {}), a: [src.w / 2, src.h / 2]};
    }
    const expr = l.expr?.p;
    let transform = chain(l);
    if (expr) {
      const fr = Math.round(t * 30);
      // eslint-disable-next-line no-new-func
      const p = new Function('time', 'timeToFrames', `${expr.replace(/;\s*\[/, '; return [')}`)(t, (x: number) => x * 30) as Vec;
      transform = `translate(${f(p[0])},${f(p[1])})`;
      void fr;
    }
    const blend = l.blend ? ` style="mix-blend-mode:${l.blend}"` : '';
    const g = `<g transform="${transform}" opacity="${f(op)}"${blend}>${body}</g>`;
    if (l.matte) {
      // this layer is the alpha matte of the layer drawn right before it
      const id = `m${uid++}`;
      defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000">${g.replace(/fill="rgb\([^)]*\)"/g, 'fill="white"')}</mask>`);
      const prev = parts.pop()!;
      parts.push(`<g mask="url(#${id})">${prev}</g>`);
      return;
    }
    parts.push(g);
    void i;
  });
  return parts.join('\n');
}

const fontFace = (fam: string, file: string) => `@font-face{font-family:'${fam}';src:url('file://${join(AE_DIR, 'fuentes', file)}');}`;

export function renderFrame(compName: string, frame: number): string {
  const c = comps.get(compName);
  if (!c) throw new Error(`No comp ${compName}. Available: ${[...comps.keys()].join(', ')}`);
  const defs: string[] = [];
  const body = renderComp(c, frame / 30, defs);
  const css = [
    fontFace('Anton', 'Anton-Regular.ttf'),
    fontFace('Archivo Black', 'ArchivoBlack-Regular.ttf'),
    fontFace('Bungee', 'Bungee-Regular.ttf'),
    fontFace('Permanent Marker', 'PermanentMarker-Regular.ttf'),
    fontFace('SS3 Black', 'SourceSans3-Black.ttf'),
    fontFace('SS3 ExtraBold', 'SourceSans3-ExtraBold.ttf'),
    fontFace('SS3 Bold', 'SourceSans3-Bold.ttf'),
  ].join('');
  const html = `<!doctype html><html><head><style>${css} html,body{margin:0;background:${c.bg ? col(c.bg) : '#000'}}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${c.w}" height="${c.h}" viewBox="0 0 ${c.w} ${c.h}" style="display:block;overflow:hidden"><defs>${defs.join('')}</defs>${body}</svg></body></html>`;
  const htmlPath = join(OUT, `${compName.replace(/\W/g, '_')}-${frame}.html`);
  writeFileSync(htmlPath, html);
  const png = htmlPath.replace(/\.html$/, '.png');
  execFileSync('/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${c.w},${c.h}`, `--screenshot=${png}`, '--virtual-time-budget=3000', `file://${htmlPath}`], {stdio: 'ignore'});
  return png;
}

if (require.main === module) {
  const [comp, ...frames] = process.argv.slice(2);
  for (const fr of frames) console.log(renderFrame(comp, Number(fr)));
}
