import {HandShape, MouthShape, SheepPose} from '../src/character/Sheep';
import {C} from '../src/theme';
import {Comp, Item, Layer, Tr, V, Vec, hex, holds, rgba, sample} from './model';
import {parsePath} from './svgpath';

// Rebuilds src/character/Sheep.tsx as After Effects shape layers + parenting.
// Keep in sync with the SVG rig (same coordinates, joints and draw order).

const INK = rgba(C.ink);
const STROKE = 9;
const HEAD_SCALE = 122;
const SHOE_SCALE = 122;
const HAND_SCALE = 130;
const HIP_NEAR = [-34, -262];
const HIP_FAR = [42, -266];
const THIGH = 62;
const SHIN = 104;
const SHOULDER_NEAR = [-98, -476];
const SHOULDER_FAR = [112, -482];
const UPPER_ARM = 70;
const FOREARM = 64;
const NECK = [14, -512];
const HIP_PIVOT = [0, -262];

export const RIG_W = 880;
export const RIG_H = 1160;
export const RIG_GROUND: Vec = [440, 1110];

const capsule = (x: number, y: number, w: number, h: number) => {
  const r = w / 2;
  return `M ${x},${y + r} A ${r},${r} 0 0 1 ${x + w},${y + r} L ${x + w},${y + h - r} A ${r},${r} 0 0 1 ${x},${y + h - r} Z`;
};

// ---------- shape helpers (children are given in SVG order: back first) ----------

type Paint = {fill?: string; stroke?: string; sw?: number; lc?: 1 | 2 | 3; lj?: 1 | 2 | 3; fo?: number};

const paths = (d: string): Item[] => parsePath(d).map((p) => ({t: 'path', d: p}) as Item);

const paintItems = (p: Paint): Item[] => {
  const out: Item[] = [];
  if (p.stroke) out.push({t: 'stroke', c: rgba(p.stroke), w: p.sw ?? STROKE, lc: p.lc ?? 2, lj: p.lj ?? 2});
  if (p.fill) out.push({t: 'fill', c: rgba(p.fill), ...(p.fo !== undefined ? {o: p.fo} : {})});
  return out;
};

const shp = (n: string, d: string, p: Paint): Item => ({t: 'g', n, it: [...paths(d), ...paintItems(p)]});
const ell = (n: string, cx: number, cy: number, rx: number, ry: number, p: Paint): Item => ({
  t: 'g',
  n,
  it: [{t: 'ell', sz: [rx * 2, ry * 2], p: [cx, cy]}, ...paintItems(p)],
});
const rect = (n: string, x: number, y: number, w: number, h: number, p: Paint): Item => ({
  t: 'g',
  n,
  it: [{t: 'rect', sz: [w, h], p: [x + w / 2, y + h / 2]}, ...paintItems(p)],
});
/** A filled shape clipped by another path (Merge Paths: Intersect). */
const clipped = (n: string, clip: string, inner: Item[], fill: string): Item => ({
  t: 'g',
  n,
  it: [...inner, ...paths(clip), {t: 'merge', m: 4}, {t: 'fill', c: rgba(fill)}],
});
const G = (n: string, children: Item[], tr?: Tr): Item => ({t: 'g', n, it: children.slice().reverse(), ...(tr ? {tr} : {})});

const rectPath = (x: number, y: number, w: number, h: number): Item => ({t: 'rect', sz: [w, h], p: [x + w / 2, y + h / 2]});

// ---------- parts ----------

const handShapes = (shape: HandShape): Item[] => {
  const knuckle = '#3A3A3A';
  const out: Item[] = [];
  if (shape === 'point') out.push(shp('Indice', 'M 4,38 C 6,62 10,86 14,104 C 17,114 31,113 31,102 C 29,84 26,60 23,38 Z', {fill: C.ink}));
  if (shape === 'thumb') out.push(shp('Pulgar', 'M -18,20 C -34,12 -48,2 -54,-10 C -58,-20 -48,-28 -40,-22 C -30,-12 -18,-4 -6,2 Z', {fill: C.ink}));
  if (shape === 'open') {
    out.push(
      shp(
        'Mano abierta',
        'M -28,6 C -36,30 -34,58 -22,74 C -10,88 14,88 24,74 C 34,58 34,30 28,6 Z ' +
          capsule(-26, 52, 15, 52) +
          ' ' +
          capsule(-9, 58, 15, 56) +
          ' ' +
          capsule(8, 55, 15, 50) +
          ' M 24,26 C 40,18 56,20 58,32 C 60,42 46,48 26,48 Z',
        {fill: C.ink},
      ),
    );
    out.push(shp('Nudillo', 'M -12,40 C -8,50 0,54 10,52', {stroke: knuckle, sw: 3}));
  } else {
    out.push(shp('Puño', 'M -27,4 C -32,22 -31,46 -21,58 C -9,69 13,69 23,58 C 31,46 31,22 27,4 Z', {fill: C.ink}));
    out.push(shp('Nudillos', 'M -16,34 C -12,46 -4,50 4,48 M -8,22 C -4,30 2,33 8,32', {stroke: knuckle, sw: 3.5}));
  }
  return out;
};

const sleeve = (w: number, top: number, len: number, cuff: boolean): Item[] => {
  const x = -w / 2;
  const d = capsule(x, top, w, len - top);
  const inner: Item[] = [
    shp('Manga', d, {fill: C.white}),
    clipped('Sombra', d, [rectPath(x - 2, top - 2, w * 0.34, len - top + 4)], C.pink),
  ];
  if (cuff) {
    inner.push(clipped('Puño rojo', d, [rectPath(x - 2, len - 30, w + 4, 32)], C.red));
    inner.push(clipped('Raya 1', d, [rectPath(x - 2, len - 22, w + 4, 6)], C.white));
    inner.push(clipped('Raya 2', d, [rectPath(x - 2, len - 12, w + 4, 5)], C.white));
  }
  inner.push(shp('Contorno', d, {stroke: C.ink}));
  return inner;
};

const shoe = (): Item[] => [
  shp('Capellada', 'M -46,56 C -48,20 -46,-24 -32,-40 L 10,-40 C 18,-40 22,-34 24,-26 C 32,2 54,16 82,26 C 106,34 118,46 118,58 Z', {fill: C.red, stroke: C.ink}),
  shp('Talón', 'M -46,56 C -48,20 -46,-6 -40,-18 C -26,-14 -18,10 -16,56 Z', {fill: C.white, stroke: C.ink, sw: 6}),
  shp('Puntera', 'M 80,25 C 102,32 118,46 118,58 L 74,58 C 70,46 72,34 80,25 Z', {fill: C.white, stroke: C.ink, sw: 6}),
  shp('Borde', 'M -32,-40 L 10,-40', {stroke: C.ink, sw: 14}),
  shp('Cordones', 'M 14,-22 L 30,-14 M 22,-6 L 40,2 M 32,8 L 50,15', {stroke: C.white, sw: 6}),
  shp('Franja', 'M -30,30 C -4,14 30,14 58,26', {stroke: C.redDark, sw: 7}),
  shp('Suela', 'M -52,54 L 120,54 C 130,54 132,78 120,78 L -50,78 C -60,78 -62,54 -52,54 Z', {fill: C.white, stroke: C.ink}),
  shp('Línea suela', 'M -50,70 L 124,70', {stroke: C.redDark, sw: 5, lc: 1}),
];

const WOOL: [number, number, number][] = [
  [-108, -296, 72],
  [-36, -352, 82],
  [58, -360, 84],
  [142, -306, 70],
  [182, -236, 48],
  [-152, -222, 56],
  [-128, -160, 40],
  [0, -262, 84],
  [100, -250, 72],
  [62, -226, 40],
  [-24, -224, 42],
  [128, -218, 34],
];

const woolItems = (): Item[] => [
  {t: 'g', n: 'Contorno', it: [...WOOL.map(([x, y, r]) => ({t: 'ell', sz: [(r + STROKE / 2 + 1) * 2, (r + STROKE / 2 + 1) * 2], p: [x, y]}) as Item), {t: 'fill', c: INK}]},
  {t: 'g', n: 'Sombra rosa', it: [...WOOL.map(([x, y, r]) => ({t: 'ell', sz: [(r - 3) * 2, (r - 3) * 2], p: [x, y]}) as Item), {t: 'fill', c: rgba(C.pink)}]},
  {t: 'g', n: 'Lana', it: [...WOOL.map(([x, y, r]) => ({t: 'ell', sz: [r * 0.86 * 2, r * 0.86 * 2], p: [x + 4, y - 8]}) as Item), {t: 'fill', c: rgba(C.white)}]},
];

const FACE =
  'M -92,-150 C -96,-222 -30,-262 44,-262 C 124,-262 178,-214 178,-146 C 178,-92 150,-50 108,-36 C 72,-24 22,-26 -18,-42 C -62,-60 -90,-100 -92,-150 Z';

const JACKET =
  'M -106,-512 C -46,-540 78,-542 132,-512 C 152,-476 158,-392 146,-330 C 142,-310 136,-298 128,-286 L -106,-286 C -124,-318 -134,-392 -128,-452 C -126,-480 -118,-500 -106,-512 Z';
const COLLAR = 'M -66,-526 C -32,-490 22,-452 50,-432 C 74,-458 96,-492 112,-528';

const torsoItems = (): Item[] => [
  shp('Chaqueta', JACKET, {fill: C.red}),
  clipped('Sombra', JACKET, paths('M -150,-560 L -54,-560 C -82,-480 -92,-390 -70,-280 L -150,-280 Z'), C.redDark),
  clipped('Pretina', JACKET, [rectPath(-150, -324, 320, 40)], C.red),
  clipped('Raya pretina 1', JACKET, [rectPath(-150, -315, 320, 7)], C.white),
  clipped('Raya pretina 2', JACKET, [rectPath(-150, -302, 320, 7)], C.white),
  shp('Línea pretina', 'M -128,-324 L 146,-324', {stroke: C.ink, sw: 5, lc: 1}),
  shp('Brillo', 'M 110,-494 C 130,-454 134,-392 124,-344', {stroke: '#FF6B78', sw: 8}),
  shp('Contorno', JACKET, {stroke: C.ink}),
  shp('Camiseta', 'M -62,-524 C -30,-492 22,-456 50,-436 C 72,-460 94,-494 108,-526 Z', {fill: C.white, stroke: C.ink, sw: 6}),
  shp('Cuello negro', COLLAR, {stroke: C.ink, sw: 32}),
  shp('Cuello rojo', COLLAR, {stroke: C.red, sw: 22}),
  shp('Cuello blanco', COLLAR, {stroke: C.white, sw: 6}),
  shp('Tapeta', 'M 50,-422 L 60,-290', {stroke: C.ink, sw: 5, lc: 1}),
  ell('Broche 1', 53, -398, 9, 9, {fill: C.white, stroke: C.ink, sw: 5}),
  ell('Broche 2', 56, -364, 9, 9, {fill: C.white, stroke: C.ink, sw: 5}),
  ell('Broche 3', 58, -330, 9, 9, {fill: C.white, stroke: C.ink, sw: 5}),
  shp('Bolsillo', 'M -84,-404 L -62,-352', {stroke: C.ink, sw: 14}),
  shp('Bolsillo interior', 'M -84,-404 L -62,-352', {stroke: C.redDark, sw: 5}),
];

const talkMouthPath = (h: number) =>
  parsePath(`M 126,-78 C 136,-80 164,-82 172,-78 C 172,${-78 + h} 158,${-70 + h} 150,${-70 + h} C 140,${-70 + h} 126,${-78 + h} 126,-78 Z`)[0];

// ---------- rig builder ----------

export type RigOptions = {
  name: string;
  frames: number; // duration in frames
  pose: (frame: number) => SheepPose;
  flip?: boolean;
  shadow?: false | ((frame: number) => string); // rgba() css color per frame
  step?: number;
};

const cssRgba = (s: string): {c: Vec; a: number} => {
  if (s.startsWith('#')) return {c: hex(s, 1), a: 1};
  const m = s.match(/rgba?\(([^)]+)\)/);
  const parts = m![1].split(',').map((x) => parseFloat(x));
  return {c: [parts[0] / 255, parts[1] / 255, parts[2] / 255, 1].map((x) => Math.round(x * 1000) / 1000), a: parts[3] ?? 1};
};

export function buildRig(o: RigOptions): Comp {
  const N = o.frames;
  const step = o.step ?? 2;
  const P = (f: number) => o.pose(Math.min(f, N - 1));
  const S = <T extends number | Vec>(fn: (p: SheepPose, f: number) => T, tol = 0.08) => sample((f) => fn(P(f), f), 0, N - 1, {step, tol}) as V<T>;
  const layers: Layer[] = [];
  const add = (l: Layer) => layers.push(l);

  // --- control nulls ---
  add({t: 'null', name: 'CTRL Giro', tr: {p: RIG_GROUND, s: [o.flip ? -100 : 100, 100]}});
  add({
    t: 'null',
    name: 'CTRL Cuerpo',
    parent: 'CTRL Giro',
    tr: {p: S((p) => [p.x, p.y], 0.3), s: S((p) => [100 / Math.sqrt(p.squash), 100 * p.squash], 0.2)},
  });
  add({t: 'null', name: 'CTRL Inclinación', parent: 'CTRL Cuerpo', tr: {p: HIP_PIVOT, r: S((p) => p.lean)}});

  // --- shadow ---
  if (o.shadow) {
    const shadowFn = o.shadow;
    const colors = holds((f) => cssRgba(shadowFn(f)).c, 0, N - 1);
    const alpha = holds((f) => Math.round(cssRgba(shadowFn(f)).a * 100), 0, N - 1);
    add({
      t: 'shape',
      name: 'Sombra',
      parent: 'CTRL Giro',
      tr: {p: [0, 0]},
      items: [
        {
          t: 'g',
          n: 'Sombra',
          it: [
            {
              t: 'ell',
              sz: S((p) => {
                const ss = Math.max(0.55, 1 + Math.min(0, p.y) / 500);
                return [400 * ss, 48 * ss];
              }, 0.3),
              p: S((p) => [p.x + 10, 6], 0.3),
            },
            {t: 'fill', c: colors as V<Vec>, o: alpha as V<number>},
          ],
        },
      ],
    });
  }

  // --- arms ---
  const arm = (side: 'near' | 'far') => {
    const pre = side === 'near' ? 'Brazo cerca' : 'Brazo lejos';
    const sh = side === 'near' ? SHOULDER_NEAR : SHOULDER_FAR;
    const shoulder = (p: SheepPose) => (side === 'near' ? p.nearShoulder : p.farShoulder);
    const elbow = (p: SheepPose) => (side === 'near' ? p.nearElbow : p.farElbow);
    const hand = (p: SheepPose) => (side === 'near' ? p.nearHand : p.farHand);
    const handRot = (p: SheepPose) => (side === 'near' ? p.nearHandRot : p.farHandRot);
    add({
      t: 'shape',
      name: `${pre} · hombro`,
      parent: 'CTRL Inclinación',
      tr: {p: [sh[0] - HIP_PIVOT[0], sh[1] - HIP_PIVOT[1]], r: S((p) => -shoulder(p))},
      items: [G('Manga', sleeve(78, -44, UPPER_ARM + 22, false))],
    });
    add({
      t: 'shape',
      name: `${pre} · codo`,
      parent: `${pre} · hombro`,
      tr: {p: [0, UPPER_ARM], r: S((p) => -elbow(p))},
      items: [G('Antebrazo', sleeve(70, -34, FOREARM, true))],
    });
    const shapes: HandShape[] = ['fist', 'point', 'open', 'thumb'];
    const label: Record<HandShape, string> = {fist: 'Puño', point: 'Señalar', open: 'Abierta', thumb: 'Pulgar'};
    add({
      t: 'shape',
      name: `${pre} · mano`,
      parent: `${pre} · codo`,
      tr: {p: [0, FOREARM - 6], s: [HAND_SCALE, HAND_SCALE], r: S((p) => handRot(p))},
      items: shapes.map((hs) =>
        G(`Mano ${label[hs]}`, handShapes(hs), {o: holds((f) => (hand(P(f)) === hs ? 100 : 0), 0, N - 1) as V<number>}),
      ),
    });
  };

  // --- legs ---
  const leg = (side: 'near' | 'far') => {
    const pre = side === 'near' ? 'Pierna cerca' : 'Pierna lejos';
    const hip = side === 'near' ? HIP_NEAR : HIP_FAR;
    const hipA = (p: SheepPose) => (side === 'near' ? p.nearHip : p.farHip);
    const knee = (p: SheepPose) => (side === 'near' ? p.nearKnee : p.farKnee);
    const foot = (p: SheepPose) => (side === 'near' ? p.nearFoot : p.farFoot);
    add({t: 'shape', name: `${pre} · muslo`, parent: 'CTRL Cuerpo', tr: {p: hip, r: S((p) => -hipA(p))}, items: [shp('Muslo', capsule(-21, -10, 42, THIGH + 20), {fill: C.ink})]});
    add({
      t: 'shape',
      name: `${pre} · rodilla`,
      parent: `${pre} · muslo`,
      tr: {p: [0, THIGH], r: S((p) => knee(p))},
      items: [
        G('Pierna', [
          shp('Canilla', capsule(-19, -18, 38, SHIN + 10), {fill: C.ink}),
          shp('Media', capsule(-24, SHIN - 84, 48, 76), {fill: C.white, stroke: C.ink, sw: 7}),
          rect('Raya media 1', -22, SHIN - 74, 44, 7, {fill: C.red}),
          rect('Raya media 2', -22, SHIN - 62, 44, 7, {fill: C.red}),
        ]),
      ],
    });
    add({t: 'shape', name: `${pre} · tenis`, parent: `${pre} · rodilla`, tr: {p: [0, SHIN], s: [SHOE_SCALE, SHOE_SCALE], r: S((p) => -foot(p))}, items: [G('Tenis', shoe())]});
    add({
      t: 'shape',
      name: `${pre} · short`,
      parent: `${pre} · muslo`,
      tr: {p: [0, 0]},
      items: [
        G('Short', [
          shp('Pierna short', 'M -54,-30 L 54,-30 L 54,62 C 26,72 -26,72 -54,62 Z', {fill: '#1C1C1C', stroke: C.ink}),
          shp('Ribete', 'M -48,54 C -22,62 22,62 48,54', {stroke: '#EDEDED', sw: 5}),
          shp('Franja', 'M -44,-14 L -44,50', {stroke: '#EDEDED', sw: 7, lc: 1}),
        ]),
      ],
    });
  };

  // SVG draw order (back to front)
  arm('far');
  leg('far');
  leg('near');
  add({t: 'shape', name: 'Cadera', parent: 'CTRL Cuerpo', tr: {p: [0, 0]}, items: [shp('Cadera', 'M -112,-320 L 134,-320 L 130,-250 C 66,-230 -46,-230 -108,-250 Z', {fill: '#1C1C1C', stroke: C.ink})]});
  add({
    t: 'shape',
    name: 'Cola',
    parent: 'CTRL Inclinación',
    tr: {p: [-128 - HIP_PIVOT[0], -318 - HIP_PIVOT[1]], r: S((p) => p.tail)},
    items: [
      G('Cola', [
        {t: 'g', n: 'Contorno', it: [{t: 'ell', sz: [66, 66], p: [0, 0]}, {t: 'ell', sz: [54, 54], p: [-18, 20]}, {t: 'ell', sz: [50, 50], p: [10, 22]}, {t: 'fill', c: INK}]},
        {t: 'g', n: 'Lana', it: [{t: 'ell', sz: [56, 56], p: [0, 0]}, {t: 'ell', sz: [44, 44], p: [-18, 20]}, {t: 'ell', sz: [40, 40], p: [10, 22]}, {t: 'fill', c: rgba(C.white)}]},
      ]),
    ],
  });
  add({t: 'shape', name: 'Torso', parent: 'CTRL Inclinación', tr: {p: [-HIP_PIVOT[0], -HIP_PIVOT[1]]}, items: [G('Chaqueta varsity', torsoItems())]});

  // --- head ---
  add({t: 'null', name: 'CTRL Cabeza', parent: 'CTRL Inclinación', tr: {p: [NECK[0] - HIP_PIVOT[0], NECK[1] - HIP_PIVOT[1]], s: [HEAD_SCALE, HEAD_SCALE], r: S((p) => p.head)}});
  add({
    t: 'shape',
    name: 'Oreja lejos',
    parent: 'CTRL Cabeza',
    tr: {p: [168, -150], r: S((p) => 24 + p.ear)},
    items: [shp('Oreja', 'M 0,-18 C 30,-32 84,-28 100,-2 C 108,14 98,30 80,28 C 52,24 20,18 0,16 Z', {fill: C.white, stroke: C.ink})],
  });
  add({t: 'shape', name: 'Audífono lejos', parent: 'CTRL Cabeza', tr: {p: [0, 0]}, items: [ell('Copa', 182, -186, 22, 50, {fill: C.red, stroke: C.ink})]});
  add({
    t: 'shape',
    name: 'Cara',
    parent: 'CTRL Cabeza',
    tr: {p: [0, 0]},
    items: [
      G('Cara', [
        shp('Piel', FACE, {fill: C.white}),
        clipped('Sombra', FACE, paths('M -110,-150 C -90,-70 -20,-44 60,-40 L 60,0 L -120,0 Z'), C.pink),
        clipped('Hocico', FACE, [{t: 'ell', sz: [80, 48], p: [138, -92]}], C.cream),
        shp('Contorno', FACE, {stroke: C.ink}),
      ]),
    ],
  });
  const eye = (n: string, cx: number, cy: number, rx: number, ry: number): Item =>
    G(
      n,
      [
        ell('Pupila', 0, 0, rx, ry, {fill: C.ink}),
        G('Brillo', [ell('Brillo', -rx * 0.35, -ry * 0.45, rx * 0.28, ry * 0.2, {fill: C.white})], {o: holds((f) => (P(f).blink < 0.5 ? 100 : 0), 0, N - 1) as V<number>}),
      ],
      {p: [cx, cy], s: S((p) => [100, Math.max(0.08, 1 - p.blink) * 100], 0.5)},
    );
  add({
    t: 'shape',
    name: 'Ojos',
    parent: 'CTRL Cabeza',
    tr: {p: S((p) => [p.lookX, p.lookY], 0.2)},
    items: [G('Ojos', [eye('Ojo cerca', 10, -140, 21, 35), eye('Ojo lejos', 114, -134, 16, 30)])],
  });
  const mouthIs = (m: MouthShape[]) => holds((f) => (m.indexOf(P(f).mouth) >= 0 ? 100 : 0), 0, N - 1) as V<number>;
  const talkH = (p: SheepPose) => (p.mouth === 'grin' ? 26 : 6 + 26 * p.mouthOpen);
  add({
    t: 'shape',
    name: 'Nariz y boca',
    parent: 'CTRL Cabeza',
    tr: {p: [0, 0]},
    items: [
      G('Nariz y boca', [
        shp('Nariz', 'M 141,-106 C 148,-110 160,-109 164,-103 C 162,-95 155,-90 151,-90 C 145,-92 140,-99 141,-106 Z', {fill: C.ink}),
        G('Boca sonrisa', [shp('Sonrisa', 'M 128,-76 C 132,-64 144,-64 149,-74 C 154,-64 166,-64 170,-76', {stroke: C.ink, sw: 6})], {o: mouthIs(['smile'])}),
        G('Boca O', [ell('O', 150, -66, 11, 14, {fill: C.ink}), ell('Lengua', 150, -60, 6, 5, {fill: C.pinkDeep})], {o: mouthIs(['o'])}),
        G(
          'Boca hablando',
          [
            {
              t: 'g',
              n: 'Boca',
              it: [
                {t: 'path', d: sample((f) => talkH(P(f)), 0, N - 1, {step, tol: 0.5}) as never},
                {t: 'stroke', c: INK, w: 4, lj: 2},
                {t: 'fill', c: INK},
              ],
            },
          ],
          {o: mouthIs(['talk', 'grin'])},
        ),
      ]),
    ],
  });
  add({t: 'shape', name: 'Lana', parent: 'CTRL Cabeza', tr: {p: [0, 0]}, items: [G('Lana', woolItems())]});
  add({
    t: 'shape',
    name: 'Oreja cerca',
    parent: 'CTRL Cabeza',
    tr: {p: [-78, -150], r: S((p) => -22 - p.ear)},
    items: [
      G('Oreja', [
        shp('Oreja', 'M 0,-20 C -30,-36 -96,-32 -120,0 C -132,20 -120,40 -96,38 C -62,34 -24,24 0,20 Z', {fill: C.white, stroke: C.ink}),
        shp('Interior', 'M -12,-8 C -36,-18 -84,-16 -102,4 C -108,14 -100,24 -88,22 C -60,18 -32,12 -12,8 Z', {fill: C.pink}),
      ]),
    ],
  });
  const BAND = 'M -96,-222 C -118,-340 -44,-452 58,-452 C 156,-452 214,-370 196,-270';
  add({
    t: 'shape',
    name: 'Diadema audífonos',
    parent: 'CTRL Cabeza',
    tr: {p: [0, 0]},
    items: [G('Diadema', [shp('Contorno', BAND, {stroke: C.ink, sw: 34}), shp('Diadema', BAND, {stroke: C.red, sw: 18}), shp('Brillo', 'M -86,-300 C -80,-370 -30,-432 40,-440', {stroke: '#FF8A95', sw: 5})])],
  });
  add({
    t: 'shape',
    name: 'Audífono cerca',
    parent: 'CTRL Cabeza',
    tr: {p: [-102, -168], s: [122, 122]},
    items: [
      G('Copa', [
        ell('Almohadilla', 26, 0, 28, 58, {fill: C.ink}),
        ell('Carcasa', 0, 0, 52, 62, {fill: C.red, stroke: C.ink}),
        ell('Anillo', -2, 2, 38, 46, {fill: C.redDark}),
        ell('Tapa', -4, 2, 27, 34, {fill: C.red, stroke: C.ink, sw: 5}),
        shp('Reflejo', 'M -40,-22 C -34,-44 -14,-56 6,-56', {stroke: C.white, sw: 7}),
        ell('Punto', -12, -8, 7, 10, {fill: '#FF8A95'}),
      ]),
    ],
  });
  arm('near');

  // Fix the talking-mouth path keys (sampled heights -> path shapes).
  for (const l of layers) {
    if (l.name !== 'Nariz y boca') continue;
    const walk = (items: Item[]) => {
      for (const it of items) {
        if (it.t === 'g') walk(it.it);
        if (it.t === 'path' && typeof it.d === 'number') it.d = talkMouthPath(it.d as unknown as number);
        else if (it.t === 'path' && (it.d as {k?: unknown}).k && typeof ((it.d as {k: [number, unknown][]}).k[0][1]) === 'number') {
          const a = it.d as unknown as {k: [number, number][]};
          it.d = {k: a.k.map(([t, h]) => [t, talkMouthPath(h)])};
        }
      }
    };
    walk(l.items!);
  }

  return {name: o.name, folder: '02 Oveja (rig)', w: RIG_W, h: RIG_H, dur: N / 30, fps: 30, layers};
}
