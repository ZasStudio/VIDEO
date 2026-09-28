import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, pop, ramp} from '../anim';
import {FaceCam, SpeechBubble} from '../mg/Avatar';
import {Cursor, KeyCap} from '../mg/Pointer';
import {CornerMarks, Grain, SceneTag, Sticker, UrbanBackground} from '../mg/Urban';
import {C, FONT} from '../theme';
import {Footage, FootageKind} from '../ui/Footage';
import {ToolId} from '../ui/Panels';
import {Cam, CameraView, PremiereUI, camPath, drift} from '../ui/PremiereUI';
import {TLClip, TLTransition} from '../ui/Timeline';
import {L, TL, trackY} from '../ui/layout';

// UI-space helpers
const itemPos = (col: number, row: number) => ({x: 93 + col * 162.7, y: 756 + row * 118.7});
const v1Y = L.timeline.y + trackY('V1') + 23;
const tX = (t: number) => L.timeline.x + TL.headerW + t * TL.pxPerSec;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Waypoint = {f: number; x: number; y: number};

const path = (frame: number, pts: Waypoint[]) => {
  if (frame <= pts[0].f) return pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (frame <= b.f) {
      const t = EASE_IN_OUT((frame - a.f) / (b.f - a.f));
      return {f: frame, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)};
    }
  }
  return pts[pts.length - 1];
};

const CURSOR: Waypoint[] = [
  {f: 0, x: 380, y: 1000},
  {f: 8, ...itemPos(0, 0)},
  {f: 11, ...itemPos(0, 0)},
  {f: 24, x: tX(2.5), y: v1Y},
  {f: 26, x: tX(2.5), y: v1Y},
  {f: 32, ...itemPos(1, 0)},
  {f: 34, ...itemPos(1, 0)},
  {f: 42, x: tX(14), y: v1Y},
  {f: 44, x: tX(14), y: v1Y},
  {f: 48, ...itemPos(2, 0)},
  {f: 50, ...itemPos(2, 0)},
  {f: 56, x: tX(20), y: v1Y},
  // razor cuts
  {f: 66, x: tX(3), y: v1Y + 40},
  {f: 76, x: tX(4), y: v1Y},
  {f: 80, x: tX(4), y: v1Y},
  {f: 90, x: tX(7), y: v1Y},
  {f: 96, x: tX(7), y: v1Y},
  // select middle segment
  {f: 118, x: tX(5.5), y: v1Y},
  {f: 158, x: tX(5.5), y: v1Y},
  // export tab
  {f: 176, x: 254, y: 53},
  {f: 200, x: 254, y: 53},
  {f: 225, x: 700, y: 400},
];

const DRAGS: {from: number; to: number; kind: FootageKind; name: string}[] = [
  {from: 11, to: 24, kind: 'vlog', name: 'entrevista.mp4'},
  {from: 34, to: 42, kind: 'city', name: 'calle_noche.mp4'},
  {from: 50, to: 56, kind: 'graffiti', name: 'graffiti.mp4'},
];

const clipsAt = (frame: number): TLClip[] => {
  const clips: TLClip[] = [];
  const grow = (start: number) => pop(frame, start, {damping: 14, stiffness: 220});
  const ripple = interpolate(frame, [136, 146], [0, 3], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT});
  const deleted = frame >= 132;
  const gone = ramp(frame, 132, 136);
  const cut1 = frame >= 80;
  const cut2 = frame >= 94;
  const selected = frame >= 122 && frame < 136;
  if (frame >= 24) {
    const s = grow(24);
    const segs: [number, number, string][] = !cut1
      ? [[0, 12, 'a']]
      : !cut2
        ? [
            [0, 4, 'a'],
            [4, 12, 'b'],
          ]
        : [
            [0, 4, 'a'],
            [4, 7, 'b'],
            [7, 12, 'c'],
          ];
    for (const [a, b, id] of segs) {
      const isMid = id === 'b' && cut2;
      if (isMid && deleted && gone >= 1) continue;
      const shift = id === 'c' ? ripple : 0;
      const base = {
        start: a - shift,
        end: a - shift + (b - a) * (a === 0 ? s : 1),
        opacity: isMid && deleted ? 1 - gone : 1,
        selected: isMid && selected,
      };
      clips.push({id: `v-${id}`, track: 'V1', name: 'entrevista.mp4', kind: 'video', thumb: 'vlog', ...base});
      clips.push({id: `a-${id}`, track: 'A1', name: 'entrevista.mp4', kind: 'audio', wave: {type: 'speech', seed: 3}, ...base});
    }
  }
  if (frame >= 42) {
    const s = grow(42);
    clips.push({id: 'v-city', track: 'V1', start: 12 - ripple, end: 12 - ripple + 6 * s, name: 'calle_noche.mp4', kind: 'video', thumb: 'city', color: C.clipVideo2});
  }
  if (frame >= 56) {
    const s = grow(56);
    clips.push({id: 'v-graf', track: 'V1', start: 18 - ripple, end: 18 - ripple + 6 * s, name: 'graffiti.mp4', kind: 'video', thumb: 'graffiti'});
    clips.push({id: 'a-music', track: 'A2', start: 0, end: 24 * s - ripple * s, name: 'beat_urbano.wav', kind: 'audio', wave: {type: 'music', seed: 5}});
  }
  return clips;
};

const ExportDialog: React.FC<{frame: number}> = ({frame}) => {
  if (frame < 182) return null;
  const s = pop(frame, 182, {damping: 14});
  const prog = ramp(frame, 188, 212, [0, 1], EASE_IN_OUT);
  const done = frame >= 213;
  return (
    <div
      style={{
        position: 'absolute',
        left: 960 - 330,
        top: 360,
        width: 660,
        scale: `${s}`,
        background: C.ui2,
        borderRadius: 12,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px #444',
        fontFamily: FONT.ui,
        color: C.uiText,
        padding: 28,
      }}
    >
      <div style={{fontSize: 26, fontWeight: 800, color: 'white'}}>Exportar</div>
      <div style={{marginTop: 14, fontSize: 18, color: '#BDBDBD', lineHeight: 1.6}}>
        Tutorial_IA.mp4 · H.264 · 1920 × 1080 · 30 fps
      </div>
      <div style={{marginTop: 20, height: 12, borderRadius: 6, background: '#3A3A3A', overflow: 'hidden'}}>
        <div style={{height: 12, width: `${prog * 100}%`, background: done ? '#2FBF4F' : C.uiBlue}} />
      </div>
      <div style={{marginTop: 12, display: 'flex', fontSize: 18, fontWeight: 700}}>
        <span style={{color: done ? '#5BE37A' : '#E0E0E0'}}>{done ? '✓ Exportación completa' : 'Exportando…'}</span>
        <div style={{flex: 1}} />
        <span style={{fontVariantNumeric: 'tabular-nums'}}>{Math.round(prog * 100)} %</span>
      </div>
    </div>
  );
};

export const EDIT_STEPS = [
  {from: 2, to: 56, n: '1', label: 'IMPORTA'},
  {from: 58, to: 106, n: '2', label: 'CORTA'},
  {from: 110, to: 158, n: '3', label: 'AJUSTA'},
  {from: 162, to: 222, n: '4', label: 'EXPORTA'},
];

/** Camera over the interface for a given frame (shared with the After Effects export). */
export const editingCam = (frame: number): Cam =>
  drift(
    camPath(frame, {fx: 1150, fy: 800, z: 1.15}, [
      {at: 0, dur: 10, cam: {fx: 780, fy: 800, z: 1.2}},
      {at: 58, dur: 14, cam: {fx: 1000, fy: 800, z: 1.45}},
      {at: 158, dur: 18, cam: {fx: 960, fy: 545, z: 0.84}},
    ]),
    frame,
    0.6,
  );

export const EditingScene: React.FC<{plate?: boolean}> = ({plate}) => {
  const frame = useCurrentFrame();
  const g = frame + 375; // global frame for continuous motion
  const cam: Cam = editingCam(frame);
  const tool: ToolId = frame >= 64 && frame < 114 ? 'razor' : 'select';
  const cur = path(frame, CURSOR);
  const dragging = DRAGS.find((d) => frame >= d.from && frame < d.to);
  const clicks = [10, 33, 49, 80, 94, 122, 178];
  const playhead = frame < 160 ? 1 + frame * 0.02 : 1 + (frame - 160) * 0.25;
  const transitions: TLTransition[] = frame >= 148 ? [{track: 'V1', at: 4, progress: ramp(frame, 148, 154)}] : [];

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <UrbanBackground frame={g} word="EDITA" />
      <CameraView cam={cam}>
        <PremiereUI
          state={{
            frame: g,
            header: frame >= 178 ? 'Exportar' : 'Editar',
            tool,
            playhead,
            clips: clipsAt(frame),
            transitions,
            program: {kind: frame > 150 && frame % 60 > 38 ? 'city' : 'vlog', t: g, talking: true},
            project: {selected: dragging?.name, hidden: dragging ? [dragging.name] : []},
            focus: frame < 58 ? 'project' : frame < 160 ? 'timeline' : undefined,
            overlay: (
              <>
                {dragging ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: cur.x - 70,
                      top: cur.y - 44,
                      width: 150,
                      opacity: 0.9,
                      rotate: '-4deg',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                      border: `3px solid ${C.uiBlue}`,
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: C.ui2,
                    }}
                  >
                    <Footage kind={dragging.kind} t={g} w={150} h={84} talking={false} />
                    <div style={{fontFamily: FONT.ui, fontSize: 13, color: '#EEE', padding: '2px 6px'}}>{dragging.name}</div>
                  </div>
                ) : null}
                <ExportDialog frame={frame} />
                <Cursor x={cur.x} y={cur.y} frame={frame} clicks={clicks} kind={tool === 'razor' ? 'razor' : 'arrow'} scale={1.3} />
              </>
            ),
          }}
        />
      </CameraView>
      {plate ? null : (
        <>

      {EDIT_STEPS.map((s) => (
        <Sticker key={s.n} frame={frame} start={s.from} exit={s.to} x={1440} y={170} rotate={-5} size={96} bg={C.yellow}>
          <span style={{color: C.red, WebkitTextStroke: `3px ${C.ink}`}}>{s.n}</span> · {s.label}
        </Sticker>
      ))}
      <KeyCap frame={frame} start={60} exit={104} x={250} y={900} label="C" sub="Cuchilla" press={64} />
      <KeyCap frame={frame} start={110} exit={124} x={250} y={900} label="V" sub="Selección" press={114} />
      <KeyCap frame={frame} start={126} exit={144} x={330} y={900} label="Shift + Supr" sub="Eliminar y cerrar hueco" press={132} size={100} />
      <KeyCap frame={frame} start={144} exit={160} x={300} y={900} label="Ctrl + D" sub="Transición" press={148} size={100} />
      <KeyCap frame={frame} start={166} exit={186} x={300} y={900} label="Ctrl + M" sub="Exportar" press={172} size={100} />

      <SceneTag frame={frame} start={0} num="02" label="EDITA EN 4 PASOS" exit={156} />
      <FaceCam frame={frame} start={0} x={1740} y={900} d={250} talking={(frame > 18 && frame < 50) || (frame > 66 && frame < 100) || (frame > 130 && frame < 156) || (frame > 196 && frame < 222)} />
      <SpeechBubble frame={frame} start={18} exit={50} x={1610} y={800} text="Arrastra tus clips a la línea de tiempo" size={34} maxWidth={500} />
      <SpeechBubble frame={frame} start={66} exit={100} x={1610} y={800} text="¡La C es la cuchilla!" size={40} />
      <SpeechBubble frame={frame} start={130} exit={156} x={1610} y={800} text="¡Adiós huecos!" size={42} />
      <SpeechBubble frame={frame} start={196} exit={222} x={1610} y={800} text="¡Video listo!" size={42} />
      <CornerMarks frame={frame} start={0} />
      <Grain frame={g} />
        </>
      )}
    </AbsoluteFill>
  );
};
