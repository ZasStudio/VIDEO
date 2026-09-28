import {EASE_IN_OUT, pop, ramp, rand} from '../src/anim';
import {faceCamPose} from '../src/mg/Avatar';
import {CARD_SHEEP_H, cardChoreo} from '../src/scenes/AICardScene';
import {FEATURES, SEG, aiCam} from '../src/scenes/AIScene';
import {EDIT_STEPS, editingCam} from '../src/scenes/EditingScene';
import {INTERFACE_STEPS, interfaceCam} from '../src/scenes/InterfaceScene';
import {INTRO_GROUND, INTRO_SHEEP_H, introChoreo} from '../src/scenes/IntroScene';
import {HIT, outroChoreo} from '../src/scenes/OutroScene';
import {CUES} from '../src/cues';
import {C} from '../src/theme';
import {toScreen} from '../src/ui/PremiereUI';
import {L as UIL, TL, trackY} from '../src/ui/layout';
import {
  Ctx,
  blockTitle,
  bgImage,
  burst,
  callout,
  calloutLabel,
  cornerMarks,
  driftWord,
  faceCamInstance,
  flash,
  grain,
  keyCap,
  sceneTag,
  slashWipe,
  sparkle,
  speechBubble,
  sticker,
  text,
  ticker,
} from './mg';
import {Comp, Layer, V, Vec, hex, holds, keys, rgba, round, sample} from './model';
import {RIG_GROUND, RIG_H, RIG_W, buildRig} from './rig';
import {F, baseline, lineBox, width} from './text';

const W = 1920;
const H = 1080;
const sec = (f: number) => round(f / 30, 4);
const scene = (name: string, frames: number, layers: Layer[], bg = hex(C.red)): Comp => ({name, folder: '01 Escenas', w: W, h: H, dur: frames / 30, fps: 30, bg, layers});

/** Precomp layer of a sheep rig placed by its ground point. */
const sheepLayer = (name: string, src: string, parent: string | undefined, pos: V<Vec>, heightPx: V<number> | number, extra: Partial<Layer> = {}): Layer => ({
  t: 'comp',
  name,
  src,
  ...(parent ? {parent} : {}),
  tr: {
    a: RIG_GROUND,
    p: pos,
    s: typeof heightPx === 'number' ? [(heightPx / RIG_H) * 100, (heightPx / RIG_H) * 100] : (heightPx as never),
  },
  ...extra,
});

const camNull = (name: string, scale: V<Vec> | Vec, pos: V<Vec> | Vec = [960, 540]): Layer => ({t: 'null', name, tr: {p: pos, s: scale}});

// ---------------------------------------------------------------- Intro (0-150)
function intro(): Comp {
  const N = 150;
  const ctx: Ctx = {parent: 'CÁMARA', off: [960, 540], N};
  const layers: Layer[] = [
    camNull('CÁMARA', sample((f) => {
      const z = introChoreo(f).zoom * 100;
      return [z, z];
    }, 0, N, {tol: 0.05}) as V<Vec>),
    bgImage(ctx, 'Fondo rojo', 'fondo_rojo'),
    driftWord(ctx, 'Palabra de fondo', 'EDIT', '#FF4A5A', (f) => 960 - ((f * 1.2) % 400)),
    ...ticker(ctx, 'Cinta superior', {text: 'PREMIERE PRO • EDICIÓN • IA', y: 96, rotate: -3, speed: 5, enter: 2, height: 70}),
    ...ticker(ctx, 'Cinta inferior', {text: 'TUTORIAL EXPRÉS • 45 SEGUNDOS', y: 1012, rotate: 2, speed: -4, enter: 8, height: 60, bg: C.yellow, color: C.ink, accent: C.ink}),
    sheepLayer(
      'Oveja',
      'Oveja · Intro',
      'CÁMARA',
      sample((f) => [introChoreo(f).walkX - 960, INTRO_GROUND - 540], 0, N, {tol: 0.5}) as V<Vec>,
      INTRO_SHEEP_H,
    ),
    ...speechBubble(ctx, 'Globo Hola', {start: 70, exit: 104, x: 560, y: 330, side: 'right', text: '¡Hola!', size: 52}),
    ...blockTitle(ctx, 'Título CÓMO EDITAR', {start: 26, text: 'CÓMO EDITAR', x: 930, y: 250, size: 156, exit: 140}),
    ...blockTitle(ctx, 'Título EN PREMIERE PRO', {start: 40, text: 'EN PREMIERE PRO', x: 930, y: 420, size: 118, exit: 142}),
    {
      ...text('Subtítulo', 'CÁMARA', '…y cómo la IA te ahorra horas', F.black, 44, 0, 0),
      in: sec(60),
      out: sec(147),
      tr: {
        p: sample((f) => [936 - 960 + (1 - ramp(f, 60, 72)) * -40, 578 - 540 + baseline(F.black, 44)], 60, 72, {tol: 0.3}) as V<Vec>,
        o: sample((f) => ramp(f, 60, 70) * (1 - ramp(f, 138, 146)) * 100, 60, 146, {tol: 0.5}) as V<number>,
      },
    },
    ...sticker(ctx, 'Sticker + IA', {start: 76, exit: 140, x: 1650, y: 740, rotate: -9, size: 150, runs: [{s: '+ IA'}]}),
    sparkle(ctx, 'Destello 1', {x: 1500, y: 660, size: 70, start: 82}),
    sparkle(ctx, 'Destello 2', {x: 1815, y: 640, size: 48, start: 86, spin: -1}),
    sparkle(ctx, 'Destello 3', {x: 1790, y: 860, size: 56, start: 90}),
    cornerMarks(ctx, 'Cruces', {start: 4}),
  ];
  return scene('01 Intro', N, layers);
}

// ---------------------------------------------------------------- Interface (150-375)
function interfaz(): Comp {
  const N = 225;
  const ctx: Ctx = {off: [0, 0], N};
  const layers: Layer[] = [{t: 'footage', name: 'Plate · interfaz de Premiere', src: 'plate_interfaz', tr: {p: [960, 540]}}];
  INTERFACE_STEPS.forEach((s, i) => {
    const r = (f: number) => toScreen(s.rect, interfaceCam(f));
    layers.push(...callout(ctx, `Resalte ${i + 1} ${s.title}`, {start: s.from, end: s.to, rect: r}));
  });
  INTERFACE_STEPS.forEach((s, i) => {
    const pos = (f: number): Vec => {
      const r = toScreen(s.rect, interfaceCam(f));
      return s.labelSide === 'right' ? [r.x + r.w + 26, r.y + 160] : [r.x + 10, r.y - 14];
    };
    layers.push(...calloutLabel(ctx, `Etiqueta ${i + 1} ${s.title}`, {start: s.from + 3, end: s.to, pos, title: s.title, desc: s.desc}));
  });
  layers.push(
    ...sceneTag(ctx, 'Etiqueta de escena', {start: 4, exit: 60, num: '01', label: 'LA INTERFAZ'}),
    ...faceCamInstance(ctx, 'Oveja en vivo', {start: 14, x: 1740, y: 900, d: 250, sceneStart: 150}),
    ...speechBubble(ctx, 'Globo 1', {start: 24, exit: 62, x: 1610, y: 800, text: '¡Así se ve Premiere Pro!', size: 40}),
    ...speechBubble(ctx, 'Globo 2', {start: 140, exit: 176, x: 1610, y: 800, text: '¡Todo pasa en la línea de tiempo!', size: 36, maxWidth: 520}),
    cornerMarks(ctx, 'Cruces', {start: 0}),
  );
  return scene('02 La interfaz', N, layers);
}

// ---------------------------------------------------------------- Editing (375-600)
function edicion(): Comp {
  const N = 225;
  const ctx: Ctx = {off: [0, 0], N};
  const layers: Layer[] = [{t: 'footage', name: 'Plate · edición en Premiere', src: 'plate_edicion', tr: {p: [960, 540]}}];
  EDIT_STEPS.forEach((s) => {
    layers.push(
      ...sticker(ctx, `Paso ${s.n} ${s.label}`, {
        start: s.from,
        exit: s.to,
        x: 1440,
        y: 170,
        rotate: -5,
        size: 96,
        runs: [{s: s.n, color: C.red, stroke: C.ink, sw: 3}, {s: ` · ${s.label}`}],
      }),
    );
  });
  layers.push(
    ...keyCap(ctx, 'Tecla C', {start: 60, exit: 104, x: 250, y: 900, label: 'C', sub: 'Cuchilla', press: 64}),
    ...keyCap(ctx, 'Tecla V', {start: 110, exit: 124, x: 250, y: 900, label: 'V', sub: 'Selección', press: 114}),
    ...keyCap(ctx, 'Tecla Shift Supr', {start: 126, exit: 144, x: 330, y: 900, label: 'Shift + Supr', sub: 'Eliminar y cerrar hueco', press: 132, size: 100}),
    ...keyCap(ctx, 'Tecla Ctrl D', {start: 144, exit: 160, x: 300, y: 900, label: 'Ctrl + D', sub: 'Transición', press: 148, size: 100}),
    ...keyCap(ctx, 'Tecla Ctrl M', {start: 166, exit: 186, x: 300, y: 900, label: 'Ctrl + M', sub: 'Exportar', press: 172, size: 100}),
    ...sceneTag(ctx, 'Etiqueta de escena', {start: 0, exit: 156, num: '02', label: 'EDITA EN 4 PASOS'}),
    ...faceCamInstance(ctx, 'Oveja en vivo', {start: 0, x: 1740, y: 900, d: 250, sceneStart: 375}),
    ...speechBubble(ctx, 'Globo 1', {start: 18, exit: 50, x: 1610, y: 800, text: 'Arrastra tus clips a la línea de tiempo', size: 34, maxWidth: 500}),
    ...speechBubble(ctx, 'Globo 2', {start: 66, exit: 100, x: 1610, y: 800, text: '¡La C es la cuchilla!', size: 40}),
    ...speechBubble(ctx, 'Globo 3', {start: 130, exit: 156, x: 1610, y: 800, text: '¡Adiós huecos!', size: 42}),
    ...speechBubble(ctx, 'Globo 4', {start: 196, exit: 222, x: 1610, y: 800, text: '¡Video listo!', size: 42}),
    cornerMarks(ctx, 'Cruces', {start: 0}),
  );
  void editingCam;
  return scene('03 Edita en 4 pasos', N, layers);
}

// ---------------------------------------------------------------- Break (600-675)
function iaCard(): Comp {
  const N = 75;
  const ctx: Ctx = {parent: 'CÁMARA', off: [960, 540], N};
  const glitchPos = (sign: number) =>
    holds((f) => {
      const c = cardChoreo(f);
      return [sign * c.gx, sign * c.gy];
    }, 0, N);
  const glitchVis = holds((f) => (cardChoreo(f).glitch ? 70 : 0), 0, N) as V<number>;
  const titleBase: Vec = [120 - 960, 330 + baseline(F.display, 300, 1) - 540];
  const withOffset = (o: V<Vec>): V<Vec> => {
    if (Array.isArray(o)) return [titleBase[0] + o[0], titleBase[1] + o[1]];
    return {...o, k: o.k.map(([t, v]) => [t, [titleBase[0] + v[0], titleBase[1] + v[1]]] as [number, Vec])};
  };
  const layers: Layer[] = [
    camNull(
      'CÁMARA',
      sample((f) => [cardChoreo(f).zoom * 100, cardChoreo(f).zoom * 100], 0, N, {tol: 0.05}) as V<Vec>,
      sample((f) => {
        const c = cardChoreo(f);
        return [960 + c.shake, 540 + c.shake * 0.4];
      }, 0, N, {tol: 0.3}) as V<Vec>,
    ),
    bgImage(ctx, 'Fondo oscuro', 'fondo_oscuro'),
    driftWord(ctx, 'Palabra de fondo', 'IA', '#2A0E14', (f) => 960 - (((f + 600) * 1.2) % 400)),
    ...blockTitle(ctx, 'Glitch cian', {start: 6, text: '¿Y LA IA?', x: 120, y: 330, size: 300, color: '#00E5FF', stroke: '#00E5FF', shadow: null, blend: 'screen', opacity: glitchVis, offset: withOffset(glitchPos(1) as V<Vec>)}),
    ...blockTitle(ctx, 'Glitch rojo', {start: 6, text: '¿Y LA IA?', x: 120, y: 330, size: 300, color: '#FF2A3D', stroke: '#FF2A3D', shadow: null, blend: 'screen', opacity: glitchVis, offset: withOffset(glitchPos(-1) as V<Vec>)}),
    ...blockTitle(ctx, 'Título ¿Y LA IA?', {start: 6, text: '¿Y LA IA?', x: 120, y: 330, size: 300}),
    ...sticker(ctx, 'Sticker 5 funciones', {start: 34, x: 600, y: 740, rotate: -6, size: 88, bg: C.ai, runs: [{s: '5 FUNCIONES CON IA'}]}),
    sparkle(ctx, 'Destello 1', {x: 130, y: 300, size: 80, start: 28, color: C.ai}),
    sparkle(ctx, 'Destello 2', {x: 1080, y: 260, size: 60, start: 32, spin: -1}),
    sparkle(ctx, 'Destello 3', {x: 1040, y: 660, size: 46, start: 38, color: C.yellow}),
    burst(ctx, 'Líneas de impacto', {x: 1500, y: 960, start: 12, radius: 330}),
    sheepLayer('Oveja', 'Oveja · ¿Y la IA?', 'CÁMARA', sample((f) => [1500 - 960, 990 + cardChoreo(f).y - 540], 0, N, {tol: 0.5}) as V<Vec>, CARD_SHEEP_H),
    cornerMarks(ctx, 'Cruces', {start: 0}),
  ];
  return scene('04 ¿Y la IA?', N, layers, hex('#150A0D'));
}

// ---------------------------------------------------------------- AI features (675-1200)
function ia(): Comp {
  const N = 525;
  const ctx: Ctx = {off: [0, 0], N};
  const uiX = (t: number) => UIL.timeline.x + TL.headerW + t * TL.pxPerSec;
  const a1 = (f: number) => toScreen({x: uiX(2.5), y: UIL.timeline.y + trackY('A1'), w: 8 * TL.pxPerSec, h: 46}, aiCam(f));
  const gen = (f: number) => toScreen({x: uiX(22.5), y: UIL.timeline.y + trackY('V1') - 10, w: 3 * TL.pxPerSec, h: 10}, aiCam(f));
  const layers: Layer[] = [
    {t: 'footage', name: 'Plate · funciones con IA', src: 'plate_ia', tr: {p: [960, 540]}},
    {t: 'footage', name: 'Brillo morado', src: 'brillo_ia', tr: {p: [960, 540]}},
    ...keyCap(ctx, 'Tecla Supr', {start: 58, exit: 80, x: 330, y: 900, label: 'Supr', sub: 'Borrar texto', press: 64, size: 104}),
    ...sticker(ctx, 'Sticker RUIDO', {start: 210 + 4, exit: 210 + 40, x: 0, y: 0, pos: (f) => [a1(f).x + a1(f).w / 2, a1(f).y - 36], rotate: -4, size: 44, bg: C.red, color: C.white, runs: [{s: 'RUIDO'}]}),
    ...sticker(ctx, 'Sticker VOZ LIMPIA', {start: 210 + 62, exit: 210 + 100, x: 0, y: 0, pos: (f) => [a1(f).x + a1(f).w / 2, a1(f).y - 36], rotate: 3, size: 44, bg: '#2FBF4F', color: C.ink, runs: [{s: 'VOZ LIMPIA'}]}),
    ...sticker(ctx, 'Sticker Generando', {
      start: 420 + 48,
      end: 420 + 84,
      x: 0,
      y: 0,
      pos: (f) => [gen(f).x + gen(f).w / 2, gen(f).y - 30],
      rotate: -3,
      size: 38,
      bg: C.ai,
      color: C.ink,
      runs: [{s: 'Generando… 100 %'}],
      textAt: (f) => `Generando… ${Math.round(ramp(f, 420 + 48, 420 + 82, [0, 1], (t) => t) * 100)} %`,
    }),
    sparkle(ctx, 'Destello extensión', {x: 0, y: 0, size: 90, start: 420 + 84, color: C.yellow}),
    ...sticker(ctx, 'Sticker +3 s', {start: 420 + 86, x: 0, y: 0, pos: (f) => [gen(f).x + gen(f).w / 2, gen(f).y - 34], rotate: -3, size: 40, bg: C.yellow, color: C.ink, runs: [{s: '+3 s con IA'}]}),
  ];
  // the extension sparkle follows the clip too
  const sp = layers.find((l) => l.name === 'Destello extensión')!;
  sp.tr!.p = sample((f) => [gen(f).x + gen(f).w / 2, gen(f).y + 40], 420 + 84, N, {step: 2, tol: 0.5}) as V<Vec>;

  FEATURES.forEach((ft, i) => {
    layers.push(
      ...sceneTag(ctx, `Función ${i + 1}`, {start: i * SEG + 2, exit: i * SEG + SEG - 12, num: ft.num, label: ft.label}),
      ...sticker(ctx, `Explicación ${i + 1}`, {start: i * SEG + 14, exit: i * SEG + SEG - 8, x: 100, y: 968, anchor: 'left', rotate: -1.5, size: 46, bg: C.white, color: C.ink, font: F.black, pad: [0.25, 0.6], runs: [{s: ft.caption}]}),
      sparkle(ctx, `Destello función ${i + 1}`, {x: 70 + (i % 2) * 20, y: 120, size: 60, start: i * SEG + 6, color: C.ai, end: i * SEG + SEG}),
      ...speechBubble(ctx, `Globo función ${i + 1}`, {start: i * SEG + 16, exit: i * SEG + 50, x: 1610, y: 800, text: ft.bubble, size: 38, maxWidth: 520}),
    );
  });
  layers.push(...faceCamInstance(ctx, 'Oveja en vivo', {start: 0, x: 1740, y: 900, d: 250, sceneStart: 675}));
  for (let i = 0; i < 10; i++) {
    const A = round(rand(i) * 1920);
    const B = round(0.6 + rand(i + 3), 4);
    const Cc = round(1.2 + rand(i + 7), 4);
    const D = round(rand(i + 1) * 1080);
    layers.push({
      t: 'shape',
      name: `Partícula ${i + 1}`,
      tr: {p: [0, 0], o: 50},
      expr: {p: `var f = timeToFrames(time); [(${A} + f * ${B}) % 1920, 1080 - ((f * ${Cc} + ${D}) % 1200)]`},
      items: [{t: 'g', it: [{t: 'ell', sz: [8, 8], p: [4, 4]}, {t: 'fill', c: rgba(C.ai)}]}],
    });
  }
  layers.push(cornerMarks(ctx, 'Cruces', {start: 0, color: C.ai, alpha: 0.8}));
  return scene('05 Funciones con IA', N, layers, hex('#150A0D'));
}

// ---------------------------------------------------------------- Outro (1200-1350)
function cierre(): Comp {
  const N = 150;
  const ctx: Ctx = {off: [0, 0], N};
  const pre: Ctx = {off: [0, 0], N: HIT};
  const layers: Layer[] = [
    {...bgImage(ctx, 'Fondo rojo', 'fondo_rojo'), out: sec(HIT)},
    {...bgImage(ctx, 'Fondo póster', 'fondo_poster'), in: sec(HIT)},
    {...driftWord(pre, 'Palabra de fondo', 'IA', '#FF4A5A', (f) => 960 - (((f + 1200) * 1.2) % 400)), out: sec(HIT)},
    ...ticker(pre, 'Cinta', {text: 'EDITA MÁS RÁPIDO • CREA MÁS • IA', y: 96, rotate: -3, speed: 6, enter: 0, height: 70}).map((l) => ({...l, out: sec(HIT)})),
    ...blockTitle(ctx, 'Título EDITA MÁS', {start: 4, text: 'EDITA MÁS', x: 1010, y: 250, size: 150, exit: 66}),
    ...blockTitle(ctx, 'Título RÁPIDO', {start: 12, text: 'RÁPIDO', x: 1010, y: 410, size: 150, exit: 67}),
    ...blockTitle(ctx, 'Título CREA MÁS', {start: 22, text: 'CREA MÁS', x: 1010, y: 570, size: 170, color: C.yellow, exit: 68}),
    ...sticker(ctx, 'Sticker Premiere + IA', {start: 34, exit: 66, x: 1320, y: 850, rotate: -6, size: 70, bg: C.white, runs: [{s: 'PREMIERE PRO '}, {s: '+ IA', color: C.red}]}),
    {...sparkle(ctx, 'Destello', {x: 1760, y: 560, size: 70, start: 40, color: C.yellow}), out: sec(HIT)},
  ];
  // poster
  const letter = (t: string, x: number, y: number, d: number): Layer => {
    const s = (f: number) => pop(f, HIT + d, {damping: 10, stiffness: 200}) * 100;
    const w = width(F.block, 300, t);
    return {
      ...text(`Letra ${t}`, undefined, t, F.block, 300, 0, 0, {just: 'c'}),
      in: sec(HIT + d),
      tr: {a: [0, -baseline(F.block, 300, 1) + 150], p: [x + w / 2, y + 150], s: sample((f) => [s(f), s(f)], HIT + d, HIT + d + 30, {tol: 0.5}) as V<Vec>},
    };
  };
  layers.push(
    letter('I', 250, 150, 0),
    letter('A', 1540, 150, 3),
    sparkle(ctx, 'Destello grande', {x: 1640, y: 820, size: 230, start: HIT + 6, color: C.white, spin: 0.3}),
    {
      ...text('Marca superior', undefined, 'PREMIERE PRO + IA', F.sign, 40, 960, 60 + baseline(F.sign, 40), {just: 'c'}),
      in: sec(HIT),
      tr: {p: [960, 60 + baseline(F.sign, 40)], o: sample((f) => ramp(f, HIT + 4, HIT + 12) * 100, HIT, HIT + 12, {tol: 0.5}) as V<number>},
    },
    {
      ...text('Texto inferior', undefined, 'Tutorial exprés: cómo editar en Premiere Pro\ry usar la IA para trabajar más rápido', F.bold, 28, 960, 0, {just: 'c', lead: 28 * 1.35}),
      in: sec(HIT),
      tr: {
        p: [960, 1080 - 58 - 2 * 28 * 1.35 + baseline(F.bold, 28, 1.35)],
        o: sample((f) => ramp(f, HIT + 10, HIT + 20) * 100, HIT, HIT + 20, {tol: 0.5}) as V<number>,
      },
    },
    burst(ctx, 'Líneas de impacto', {x: 960, y: 560, start: HIT, radius: 520, count: 18}),
  );
  // sheep: dance (x 560, 720 px, ground 1000) then poster (x 960, 770 px, ground 872, slam)
  layers.push(
    sheepLayer(
      'Oveja',
      'Oveja · Cierre',
      undefined,
      holds((f) => (f >= HIT ? [960, 872] : [560, 1000]), 0, N) as V<Vec>,
      0,
      {},
    ),
  );
  const sl = layers[layers.length - 1];
  sl.tr!.s = sample((f) => {
    const c = outroChoreo(f);
    const k = (c.sheepH / RIG_H) * 100 * c.slam;
    return [k, k];
  }, 0, N, {tol: 0.2}) as V<Vec>;
  layers.push(
    {...cornerMarks(ctx, 'Cruces', {start: 0}), out: sec(HIT)},
    cornerMarks(ctx, 'Cruces póster', {start: HIT}),
    {t: 'solid', name: 'Fundido a negro', color: [0, 0, 0], tr: {o: sample((f) => ramp(f, 138, 150, [0, 1], EASE_IN_OUT) * 100, 136, 150, {tol: 0.5}) as V<number>}},
  );
  return scene('06 Cierre', N, layers);
}

// ---------------------------------------------------------------- Facecam (global 0-1350)
function facecamPoseAt(G: number) {
  let l = G;
  let talking = false;
  if (G >= 150 && G < 375) {
    l = G - 150;
    talking = (l > 24 && l < 62) || (l > 140 && l < 176);
  } else if (G >= 375 && G < 600) {
    l = G - 375;
    talking = (l > 18 && l < 50) || (l > 66 && l < 100) || (l > 130 && l < 156) || (l > 196 && l < 222);
  } else if (G >= 675 && G < 1200) {
    l = G - 675;
    const lf = l - Math.min(4, Math.floor(l / SEG)) * SEG;
    talking = lf > 16 && lf < 50;
  }
  return faceCamPose(l, talking);
}

function facecam(): Comp {
  const d = 300;
  const c = 180;
  const Hs = d * 1.45;
  const Ws = (Hs * RIG_W) / RIG_H;
  const disk = (w: number, x: number, y: number, col: Vec, o?: number) => ({t: 'g' as const, it: [{t: 'ell' as const, sz: [w, w], p: [x, y]}, {t: 'fill' as const, c: col, ...(o !== undefined ? {o} : {})}]});
  const badgeS = d * 0.085;
  const tw = width(F.block, badgeS, 'EN VIVO');
  const bw = d * 0.05 * 2 + d * 0.045 + d * 0.025 + tw + 2 * d * 0.014;
  const bh = lineBox(F.block, badgeS) + 2 * d * 0.012 + 2 * d * 0.014;
  const by = c - d / 2 - d * 0.02;
  const bx0 = c - bw / 2;
  const layers: Layer[] = [
    {
      t: 'shape',
      name: 'Aro y fondo',
      tr: {p: [0, 0]},
      items: [
        {t: 'g', n: 'Brillo', it: [{t: 'ell', sz: [d * 0.8, d * 0.8], p: [c, c - d * 0.1]}, {t: 'fill', c: rgba(C.redHot), o: 45}]},
        disk(d, c, c, rgba(C.red)),
        disk(d * 1.08, c, c, rgba(C.white)),
        disk(d * 1.13, c, c, rgba(C.ink)),
        disk(d * 1.13, c + d * 0.05, c + d * 0.06, hex('#000000', 1), 35),
      ],
    },
    {t: 'comp', name: 'Oveja', src: 'Oveja · En vivo', tr: {a: [0, 0], p: [c - Ws * 0.54, c - d / 2 + d * 0.47 - Hs * 0.262 + d / 2 - d / 2], s: [(Hs / RIG_H) * 100, (Hs / RIG_H) * 100]}},
    {t: 'shape', name: 'Máscara círculo', matte: 1, tr: {p: [0, 0]}, items: [disk(d, c, c, rgba(C.white))]},
    {
      t: 'shape',
      name: 'Etiqueta EN VIVO',
      tr: {p: [0, 0]},
      items: [
        {t: 'g', n: 'Punto', it: [{t: 'ell', sz: [d * 0.045, d * 0.045], p: [bx0 + d * 0.014 + d * 0.05 + d * 0.0225, by]}, {t: 'fill', c: rgba(C.white), o: holds((f) => (Math.floor(f / 15) % 2 === 0 ? 100 : 0), 0, 1349) as V<number>}]},
        {t: 'g', n: 'Punto apagado', it: [{t: 'ell', sz: [d * 0.045, d * 0.045], p: [bx0 + d * 0.014 + d * 0.05 + d * 0.0225, by]}, {t: 'fill', c: rgba('#FF9AA4')}]},
        {t: 'g', n: 'Pastilla', it: [{t: 'rect', sz: [bw - 2 * d * 0.014, bh - 2 * d * 0.014], p: [c, by], r: bh}, {t: 'fill', c: rgba(C.red)}]},
        {t: 'g', n: 'Borde', it: [{t: 'rect', sz: [bw, bh], p: [c, by], r: bh}, {t: 'fill', c: rgba(C.white)}]},
        {t: 'g', n: 'Contorno', it: [{t: 'rect', sz: [bw + 2 * d * 0.01, bh + 2 * d * 0.01], p: [c, by], r: bh}, {t: 'fill', c: rgba(C.ink)}]},
      ],
    },
    text('Texto EN VIVO', undefined, 'EN VIVO', F.block, badgeS, bx0 + d * 0.014 + d * 0.05 + d * 0.045 + d * 0.025, by - lineBox(F.block, badgeS) / 2 + baseline(F.block, badgeS), {fill: C.white}),
  ];
  return {name: 'Facecam (oveja en vivo)', folder: '03 Piezas', w: 360, h: 360, dur: 45, fps: 30, bg: hex(C.red), layers};
}

// ---------------------------------------------------------------- Main
function main(): Comp {
  const scenes: [string, number][] = [
    ['01 Intro', 0],
    ['02 La interfaz', 150],
    ['03 Edita en 4 pasos', 375],
    ['04 ¿Y la IA?', 600],
    ['05 Funciones con IA', 675],
    ['06 Cierre', 1200],
  ];
  const lens = [150, 225, 225, 75, 525, 150];
  const layers: Layer[] = scenes.map(([name, from], i) => ({t: 'comp', name, src: name, start: sec(from), in: sec(from), out: sec(from + lens[i]), tr: {p: [960, 540]}}) as Layer);
  layers.push(
    ...slashWipe('Transición 1', 150),
    ...slashWipe('Transición 2', 375, [C.yellow, C.ink], 9),
    flash('Destello blanco', 600, C.white, 6),
    flash('Destello morado', 675, C.ai, 10),
    ...slashWipe('Transición 3', 1200),
    grain('Grano de película', 5),
  );
  // audio
  const db = (v: number) => round(20 * Math.log10(Math.max(v, 0.0001)), 2);
  layers.push({
    t: 'footage',
    name: 'Música (beat urbano)',
    src: 'music',
    audio: keys([
      [0, [-48, -48]],
      [6, [db(0.8), db(0.8)]],
      [1338, [db(0.8), db(0.8)]],
      [1350, [-48, -48]],
    ]),
  });
  CUES.forEach(([from, sfx, vol], i) => {
    layers.push({t: 'footage', name: `SFX ${String(i + 1).padStart(2, '0')} · ${sfx}`, src: `sfx_${sfx}`, start: sec(from), audio: [db(vol), db(vol)]});
  });
  return {name: 'PremiereIA · PRINCIPAL', folder: '00 Principal', w: W, h: H, dur: 45, fps: 30, bg: hex('#000000'), layers};
}

export function buildProject() {
  const rigs: Comp[] = [
    buildRig({name: 'Oveja · Intro', frames: 150, pose: (f) => introChoreo(f).pose, shadow: () => 'rgba(60,0,10,0.45)'}),
    buildRig({name: 'Oveja · ¿Y la IA?', frames: 75, pose: (f) => cardChoreo(f).p, flip: true, shadow: () => 'rgba(0,0,0,0.5)'}),
    buildRig({name: 'Oveja · Cierre', frames: 150, pose: (f) => outroChoreo(f).p, shadow: (f) => (f >= HIT ? 'rgba(20,20,20,0.9)' : 'rgba(60,0,10,0.45)')}),
    buildRig({name: 'Oveja · En vivo', frames: 1350, pose: facecamPoseAt, shadow: false}),
  ];
  const comps = [...rigs, facecam(), intro(), interfaz(), edicion(), iaCard(), ia(), cierre(), main()];
  // Children of a control null inherit its in/out points (AE does not hide children with the parent).
  for (const c of comps) {
    const byName = new Map(c.layers.map((l) => [l.name, l]));
    for (const l of c.layers) {
      if (!l.parent) continue;
      const p = byName.get(l.parent);
      if (!p || p.t !== 'null') continue;
      if (l.in === undefined && p.in !== undefined) l.in = p.in;
      if (l.out === undefined && p.out !== undefined) l.out = p.out;
    }
  }
  const sfxNames = Array.from(new Set(CUES.map((c) => c[1])));
  const footage: Record<string, {file: string; folder: string}> = {
    plate_interfaz: {file: 'footage/plate_interfaz.mp4', folder: '04 Footage'},
    plate_edicion: {file: 'footage/plate_edicion.mp4', folder: '04 Footage'},
    plate_ia: {file: 'footage/plate_ia.mp4', folder: '04 Footage'},
    fondo_rojo: {file: 'footage/fondo_rojo.png', folder: '04 Footage'},
    fondo_oscuro: {file: 'footage/fondo_oscuro.png', folder: '04 Footage'},
    fondo_poster: {file: 'footage/fondo_poster.png', folder: '04 Footage'},
    brillo_ia: {file: 'footage/brillo_ia.png', folder: '04 Footage'},
    music: {file: 'audio/music.wav', folder: '05 Audio'},
  };
  for (const s of sfxNames) footage[`sfx_${s}`] = {file: `audio/${s}.wav`, folder: '05 Audio'};
  return {
    name: 'Premiere Pro + IA (editable)',
    folders: ['00 Principal', '01 Escenas', '02 Oveja (rig)', '03 Piezas', '04 Footage', '05 Audio'],
    footage,
    comps,
    main: 'PremiereIA · PRINCIPAL',
  };
}
