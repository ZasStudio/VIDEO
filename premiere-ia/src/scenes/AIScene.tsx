import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, pop, ramp, rand} from '../anim';
import {FaceCam, SpeechBubble} from '../mg/Avatar';
import {Cursor, KeyCap} from '../mg/Pointer';
import {CornerMarks, Grain, SceneTag, Sparkle, Sticker, UrbanBackground} from '../mg/Urban';
import {C, FONT} from '../theme';
import {ToolId} from '../ui/Panels';
import {Cam, CameraView, PremiereUI, camPath, drift, toScreen} from '../ui/PremiereUI';
import {CaptionsPanel, ReframePanel, SoundPanel, TranscriptPanel} from '../ui/RightPanels';
import {TLClip} from '../ui/Timeline';
import {DEFAULT_CLIPS} from '../ui/clips';
import {L, TL, monitorFrame, trackY} from '../ui/layout';

export const SEG = 105; // frames per feature (3.5 s)

const uiX = (t: number) => L.timeline.x + TL.headerW + t * TL.pxPerSec;
const v1Y = L.timeline.y + trackY('V1') + 23;

// Timeline after the filler words were removed (used from feature 2 on).
const AFTER: TLClip[] = [
  {id: 'v1a', track: 'V1', start: 0, end: 2.5, name: 'entrevista.mp4', kind: 'video', thumb: 'vlog'},
  {id: 'v1a2', track: 'V1', start: 2.5, end: 10.5, name: 'entrevista.mp4', kind: 'video', thumb: 'vlog'},
  {id: 'v1b', track: 'V1', start: 10.5, end: 16.5, name: 'calle_noche.mp4', kind: 'video', thumb: 'city', color: C.clipVideo2},
  {id: 'v1c', track: 'V1', start: 16.5, end: 22.5, name: 'graffiti.mp4', kind: 'video', thumb: 'graffiti'},
  {id: 'v2a', track: 'V2', start: 1, end: 5, name: 'titulo.mogrt', kind: 'graphic'},
  {id: 'a1a', track: 'A1', start: 0, end: 2.5, name: 'entrevista.mp4', kind: 'audio', wave: {type: 'speech', seed: 3}},
  {id: 'a1a2', track: 'A1', start: 2.5, end: 10.5, name: 'entrevista.mp4', kind: 'audio', wave: {type: 'speech', seed: 3}},
  {id: 'a2a', track: 'A2', start: 0, end: 30, name: 'beat_urbano.wav', kind: 'audio', wave: {type: 'music', seed: 5}},
];

const CAPTION_CLIPS: [number, number, string][] = [
  [0.3, 2.1, 'Hola, hoy te enseño…'],
  [2.1, 4.4, 'en Premiere Pro…'],
  [4.4, 6.7, 'Importa tus clips…'],
  [6.7, 8.6, 'La IA hace el resto.'],
];

const f1Clips = (lf: number): TLClip[] => {
  if (lf < 48) return DEFAULT_CLIPS;
  const shift = interpolate(lf, [70, 80], [0, 1.5], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT});
  const fillerOpacity = 1 - ramp(lf, 64, 70);
  const selected = lf < 66;
  const out: TLClip[] = [];
  for (const kind of ['video', 'audio'] as const) {
    const track = kind === 'video' ? 'V1' : 'A1';
    const extra = kind === 'video' ? {thumb: 'vlog' as const} : {wave: {type: 'speech' as const, seed: 3}};
    out.push({id: `${track}-a`, track, start: 0, end: 2.5, name: 'entrevista.mp4', kind, ...extra});
    if (lf < 70) {
      out.push({id: `${track}-f`, track, start: 2.5, end: 4, name: 'eh… mmm…', kind, color: kind === 'video' ? '#E0679A' : undefined, selected, opacity: fillerOpacity, ...extra});
    }
    out.push({id: `${track}-b`, track, start: 4 - shift, end: 12 - shift, name: 'entrevista.mp4', kind, ...extra});
  }
  out.push({id: 'v1b', track: 'V1', start: 12 - shift, end: 18 - shift, name: 'calle_noche.mp4', kind: 'video', thumb: 'city', color: C.clipVideo2});
  out.push({id: 'v1c', track: 'V1', start: 18 - shift, end: 24 - shift, name: 'graffiti.mp4', kind: 'video', thumb: 'graffiti'});
  out.push({id: 'v2a', track: 'V2', start: 1, end: 5, name: 'titulo.mogrt', kind: 'graphic'});
  out.push({id: 'a2a', track: 'A2', start: 0, end: 30, name: 'beat_urbano.wav', kind: 'audio', wave: {type: 'music', seed: 5}});
  return out;
};

const withCaptions = (clips: TLClip[], appear: (i: number) => number): TLClip[] => [
  ...clips,
  ...CAPTION_CLIPS.map(([a, b, text], i) => {
    const s = appear(i);
    return {id: `cap${i}`, track: 'V3' as const, start: a, end: a + (b - a) * s, name: text, kind: 'graphic' as const, color: '#B9B9B9', opacity: s > 0 ? 1 : 0};
  }),
];

// ---------- Program monitor overlays ----------

const CaptionOverlay: React.FC<{lf: number; w: number; h: number}> = ({lf, w, h}) => {
  const es = ['Hola, hoy te enseño a editar', 'en Premiere Pro con IA.'];
  const en = ["Hi! Today I'll teach you to edit", 'in Premiere Pro with AI.'];
  const english = lf >= 62;
  const lines = english ? en : es;
  const local = english ? lf - 62 : lf - 12;
  if (local < 0) return null;
  const idx = local < 28 ? 0 : 1;
  const words = lines[idx].split(' ');
  const wordAt = Math.floor(((local % 28) / 26) * words.length);
  const s = pop(lf, english ? 62 : 12, {damping: 14});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: h * 0.07, display: 'flex', justifyContent: 'center', scale: `${s}`}}>
      <div
        style={{
          background: 'rgba(0,0,0,0.78)',
          borderRadius: 8,
          padding: `${h * 0.015}px ${h * 0.04}px`,
          fontFamily: FONT.ui,
          fontWeight: 800,
          fontSize: h * 0.075,
          color: 'white',
          display: 'flex',
          gap: h * 0.018,
        }}
      >
        {words.map((wd, i) => (
          <span key={i} style={{color: i === wordAt ? C.yellow : 'white'}}>
            {wd}
          </span>
        ))}
      </div>
      {english ? (
        <div style={{position: 'absolute', right: w * 0.03, top: -h * 0.72, background: C.ai, color: C.ink, fontFamily: FONT.block, fontSize: h * 0.05, padding: '2px 10px', borderRadius: 6}}>
          EN
        </div>
      ) : null}
    </div>
  );
};

const ReframeOverlay: React.FC<{lf: number; w: number; h: number}> = ({lf, w, h}) => {
  const analyze = ramp(lf, 16, 44);
  const crop = ramp(lf, 44, 64, [0, 1], EASE_IN_OUT);
  const cw = w + (h * (9 / 16) - w) * crop;
  const track = Math.sin(lf * 0.15) * 6 * (1 - crop);
  const cx = w / 2 + track;
  const left = cx - cw / 2;
  const box = {x: w * 0.36, y: h * 0.09, w: w * 0.25, h: h * 0.52};
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: 0, width: Math.max(0, left), height: h, background: 'rgba(8,8,8,0.82)'}} />
      <div style={{position: 'absolute', left: left + cw, top: 0, right: 0, height: h, background: 'rgba(8,8,8,0.82)'}} />
      {crop > 0 ? (
        <div style={{position: 'absolute', left, top: 0, width: cw, height: h, boxShadow: 'inset 0 0 0 3px white'}}>
          <div style={{position: 'absolute', left: 6, top: 6, background: 'white', color: C.ink, fontFamily: FONT.block, fontSize: h * 0.05, padding: '1px 8px', borderRadius: 4}}>9:16</div>
        </div>
      ) : null}
      {analyze > 0 && crop < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: box.x + track,
            top: box.y,
            width: box.w,
            height: box.h,
            border: `3px dashed ${C.ai}`,
            borderRadius: 8,
            opacity: (analyze < 1 ? 0.6 + 0.4 * Math.sin(lf) : 1) * Math.max(0, 1 - crop * 2.5),
          }}
        >
          <div style={{position: 'absolute', left: -3, bottom: -h * 0.075, background: C.ai, color: C.ink, fontFamily: FONT.ui, fontWeight: 800, fontSize: h * 0.045, padding: '1px 8px', borderRadius: 4, whiteSpace: 'nowrap'}}>
            Sujeto detectado
          </div>
        </div>
      ) : null}
    </>
  );
};

// ---------- Scene ----------

export const FEATURES = [
  {num: 'IA 1', label: 'TRANSCRIPCIÓN', caption: 'Borras el texto… ¡y el video se corta solo!', bubble: '¡Edita borrando texto!'},
  {num: 'IA 2', label: 'SUBTÍTULOS AUTOMÁTICOS', caption: 'Se generan y se traducen en segundos', bubble: '¡Y en otros idiomas!'},
  {num: 'IA 3', label: 'MEJORAR VOZ', caption: 'Quita el ruido: voz clara, como de estudio', bubble: '¡Adiós ruido!'},
  {num: 'IA 4', label: 'REENCUADRE AUTOMÁTICO', caption: 'De horizontal a vertical siguiendo al sujeto', bubble: '¡Listo para vertical!'},
  {num: 'IA 5', label: 'EXTENSIÓN GENERATIVA', caption: 'La IA crea frames nuevos para alargar tu clip', bubble: '¡Frames hechos por IA!'},
];

/** Camera over the interface for a given frame (shared with the After Effects export). */
export const aiCam = (frame: number): Cam =>
  drift(
    camPath(frame, {fx: 960, fy: 545, z: 0.9}, [
      {at: 0, dur: 16, cam: {fx: 1250, fy: 520, z: 1.18}, easing: EASE_OUT},
      {at: 100, dur: 14, cam: {fx: 1235, fy: 380, z: 1.32}},
      {at: 205, dur: 14, cam: {fx: 1250, fy: 600, z: 1.05}},
      {at: 310, dur: 14, cam: {fx: 1235, fy: 345, z: 1.25}},
      {at: 415, dur: 12, cam: {fx: 1000, fy: 780, z: 1.0}},
      {at: 438, dur: 14, cam: {fx: 1470, fy: 800, z: 1.6}},
      {at: 506, dur: 19, cam: {fx: 1250, fy: 700, z: 1.2}},
    ]),
    frame,
    0.5,
  );

export const AIScene: React.FC<{plate?: boolean}> = ({plate}) => {
  const frame = useCurrentFrame();
  const g = frame + 675;
  const fi = Math.min(4, Math.floor(frame / SEG));
  const lf = frame - fi * SEG;

  const cam: Cam = aiCam(frame);

  // --- per-feature UI state ---
  let clips: TLClip[] = AFTER;
  let right: React.ReactNode = null;
  let programOverlay: React.ReactNode = null;
  let programKind: 'vlog' | 'graffiti' = 'vlog';
  let tool: ToolId = 'select';
  let playhead = 1 + frame * 0.012;
  let cursor: {x: number; y: number; clicks: number[]; kind: 'arrow' | 'ai'} | null = null;
  const pf = monitorFrame(L.program);

  if (fi === 0) {
    clips = f1Clips(lf);
    right = <TranscriptPanel r={L.right} focused state={{typed: ramp(lf, 6, 40, [0, 1], (t) => t), select: ramp(lf, 48, 60, [0, 1], (t) => t), deleted: ramp(lf, 64, 72)}} />;
    const t = ramp(lf, 48, 60, [0, 1], EASE_IN_OUT);
    cursor = {x: 1812 + (1512 - 1812) * t, y: 262 + 30 * t, clicks: [48], kind: 'arrow'};
  } else if (fi === 1) {
    clips = withCaptions(AFTER, (i) => pop(lf, 6 + i * 4, {damping: 14}));
    right = <CaptionsPanel r={L.right} focused lang={lf >= 60 ? 'en' : 'es'} translating={ramp(lf, 44, 60, [0, 1], (t) => t)} />;
    programOverlay = <CaptionOverlay lf={lf} w={pf.w} h={pf.h} />;
    const t = ramp(lf, 26, 40, [0, 1], EASE_IN_OUT);
    cursor = {x: 1500 + (1808 - 1500) * t, y: 420 + (181 - 420) * t, clicks: [42], kind: 'arrow'};
  } else if (fi === 2) {
    const enhance = ramp(lf, 30, 62, [0, 1], EASE_IN_OUT);
    clips = withCaptions(
      AFTER.map((c) => (c.track === 'A1' ? {...c, wave: {type: 'speech', seed: 3, noise: 1 - enhance}, selected: lf > 20} : c)),
      () => 1,
    );
    right = <SoundPanel r={L.right} focused enhance={enhance} />;
    const t = ramp(lf, 8, 24, [0, 1], EASE_IN_OUT);
    cursor = {x: 1300 + (1456 - 1300) * t, y: 700 + (272 - 700) * t, clicks: [27], kind: 'arrow'};
  } else if (fi === 3) {
    clips = withCaptions(AFTER, () => 1);
    right = <ReframePanel r={L.right} focused progress={ramp(lf, 16, 44, [0, 1], (t) => t)} />;
    programOverlay = <ReframeOverlay lf={lf} w={pf.w} h={pf.h} />;
  } else {
    programKind = 'graffiti';
    playhead = 19 + lf * 0.02;
    const drag = ramp(lf, 34, 48, [0, 1], EASE_IN_OUT);
    const generating = ramp(lf, 48, 82, [0, 1], (t) => t);
    const done = lf >= 84;
    tool = lf >= 12 ? 'genext' : 'select';
    clips = withCaptions(AFTER, () => 1).map((c) =>
      c.id === 'v1c' && !done ? {...c, genExt: {from: 22.5, to: 25.5, progress: lf >= 34 ? Math.max(drag, 0.02) : 0}, selected: lf >= 30} : c,
    );
    if (done) {
      clips = [
        ...clips,
        {id: 'gen', track: 'V1', start: 22.5, end: 25.5, name: '✦ Extensión IA', kind: 'video', color: C.ai, selected: lf < 96},
      ];
    }
    const p0 = {x: 700, y: 900};
    const pTool = {x: 534, y: 988};
    const pEnd = {x: uiX(22.5), y: v1Y};
    const pDrop = {x: uiX(25.5), y: v1Y};
    const a = ramp(lf, 0, 10, [0, 1], EASE_IN_OUT);
    const b = ramp(lf, 16, 30, [0, 1], EASE_IN_OUT);
    let x = p0.x + (pTool.x - p0.x) * a;
    let y = p0.y + (pTool.y - p0.y) * a;
    x += (pEnd.x - pTool.x) * b;
    y += (pEnd.y - pTool.y) * b;
    x += (pDrop.x - pEnd.x) * drag;
    cursor = {x, y, clicks: [11, 33], kind: lf >= 12 ? 'ai' : 'arrow'};
    programOverlay =
      generating > 0 && !done ? (
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent ${generating * 100 - 20}%, rgba(185,140,255,0.45) ${generating * 100}%, transparent ${generating * 100 + 20}%)`}} />
      ) : null;
  }

  const feature = FEATURES[fi];
  const f5gen = fi === 4 ? ramp(lf, 48, 82, [0, 1], (t) => t) : 0;
  const genLabelRect = toScreen({x: uiX(22.5), y: L.timeline.y + trackY('V1') - 10, w: 3 * TL.pxPerSec, h: 10}, cam);
  const a1Rect = toScreen({x: uiX(2.5), y: L.timeline.y + trackY('A1'), w: 8 * TL.pxPerSec, h: 46}, cam);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <UrbanBackground frame={g} word="IA" dark />
      <CameraView cam={cam}>
        <PremiereUI
          state={{
            frame: g,
            tool,
            playhead,
            clips,
            right,
            focus: 'right',
            program: {kind: programKind, t: g, talking: true, overlay: programOverlay},
            overlay: cursor ? <Cursor x={cursor.x} y={cursor.y} frame={lf} clicks={cursor.clicks} kind={cursor.kind} scale={1.2} /> : null,
          }}
        />
      </CameraView>
      {plate ? null : (
        <>

      {/* AI glow frame */}
      <div style={{position: 'absolute', inset: 0, boxShadow: `inset 0 0 140px ${C.ai}55`, pointerEvents: 'none'}} />

      {/* feature-specific screen overlays */}
      {fi === 0 ? <KeyCap frame={lf} start={58} exit={80} x={330} y={900} label="Supr" sub="Borrar texto" press={64} size={104} /> : null}
      {fi === 2 ? (
        <>
          <Sticker frame={lf} start={4} exit={40} x={a1Rect.x + a1Rect.w / 2} y={a1Rect.y - 36} rotate={-4} size={44} bg={C.red} color={C.white}>
            RUIDO ✕
          </Sticker>
          <Sticker frame={lf} start={62} exit={100} x={a1Rect.x + a1Rect.w / 2} y={a1Rect.y - 36} rotate={3} size={44} bg="#2FBF4F" color={C.ink}>
            VOZ LIMPIA ✓
          </Sticker>
        </>
      ) : null}
      {fi === 4 && f5gen > 0 && lf < 84 ? (
        <Sticker frame={lf} start={48} x={genLabelRect.x + genLabelRect.w / 2} y={genLabelRect.y - 30} rotate={-3} size={38} bg={C.ai} color={C.ink}>
          Generando… {Math.round(f5gen * 100)} %
        </Sticker>
      ) : null}
      {fi === 4 && lf >= 84 ? (
        <>
          <Sparkle x={genLabelRect.x + genLabelRect.w / 2} y={genLabelRect.y + 40} size={90} frame={lf} start={84} color={C.yellow} />
          <Sticker frame={lf} start={86} x={genLabelRect.x + genLabelRect.w / 2} y={genLabelRect.y - 34} rotate={-3} size={40} bg={C.yellow} color={C.ink}>
            +3 s con IA
          </Sticker>
        </>
      ) : null}

      {/* feature title + caption */}
      {FEATURES.map((f, i) => (
        <React.Fragment key={f.num}>
          <SceneTag frame={frame} start={i * SEG + 2} num={f.num} label={f.label} exit={i * SEG + SEG - 12} />
          <Sticker frame={frame} start={i * SEG + 14} exit={i * SEG + SEG - 8} x={100} y={968} anchor="left" rotate={-1.5} size={46} bg={C.white} color={C.ink} font={FONT.ui} padding="0.25em 0.6em">
            <span style={{fontWeight: 900}}>{f.caption}</span>
          </Sticker>
          <Sparkle x={70 + (i % 2) * 20} y={120} size={60} frame={frame} start={i * SEG + 6} color={C.ai} />
        </React.Fragment>
      ))}

      <FaceCam frame={frame} start={0} x={1740} y={900} d={250} talking={lf > 16 && lf < 50} label="EN VIVO" />
      <SpeechBubble frame={lf} start={16} exit={50} x={1610} y={800} text={feature.bubble} size={38} maxWidth={520} key={fi} />
      {/* floating AI particles */}
      {[...Array(10)].map((_, i) => {
        const x = (rand(i) * 1920 + frame * (0.6 + rand(i + 3))) % 1920;
        const y = 1080 - ((frame * (1.2 + rand(i + 7)) + rand(i + 1) * 1080) % 1200);
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: 8, height: 8, borderRadius: 4, background: C.ai, opacity: 0.5, boxShadow: `0 0 12px ${C.ai}`}} />;
      })}
      <CornerMarks frame={frame} start={0} color="rgba(185,140,255,0.8)" />
      <Grain frame={g} />
        </>
      )}
    </AbsoluteFill>
  );
};
