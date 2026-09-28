import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_OUT, ramp} from '../anim';
import {FaceCam, SpeechBubble} from '../mg/Avatar';
import {Callout, CalloutLabel} from '../mg/Pointer';
import {CornerMarks, Grain, SceneTag, UrbanBackground} from '../mg/Urban';
import {Cam, CameraView, PremiereUI, camPath, drift, toScreen} from '../ui/PremiereUI';
import {DEFAULT_CLIPS} from '../ui/clips';
import {L, Rect} from '../ui/layout';

const START: Cam = {fx: 960, fy: 600, z: 0.45, rx: 30, ry: -26, rz: 8};

export const INTERFACE_STEPS: {rect: Rect; title: string; desc: string; from: number; to: number; cam: Cam; labelSide?: 'top' | 'right'}[] = [
  {rect: L.project, title: 'PROYECTO', desc: 'Importa y organiza tus clips', from: 30, to: 64, cam: {fx: 820, fy: 660, z: 0.86}},
  {rect: L.source, title: 'MONITOR DE ORIGEN', desc: 'Revisa y marca cada clip', from: 66, to: 100, cam: {fx: 760, fy: 440, z: 0.86}},
  {rect: L.program, title: 'MONITOR DE PROGRAMA', desc: 'Así se ve tu video final', from: 102, to: 136, cam: {fx: 1080, fy: 440, z: 0.88}},
  {rect: L.timeline, title: 'LÍNEA DE TIEMPO', desc: 'Aquí armas tu historia', from: 138, to: 172, cam: {fx: 1180, fy: 720, z: 0.86}},
  {rect: L.tools, title: 'HERRAMIENTAS', desc: 'Selección (V) · Cuchilla (C)', from: 174, to: 206, cam: {fx: 820, fy: 760, z: 0.95}, labelSide: 'right'},
];

/** Camera over the interface for a given frame (shared with the After Effects export). */
export const interfaceCam = (frame: number): Cam =>
  drift(
    camPath(frame, START, [
      {at: 0, dur: 26, cam: {fx: 960, fy: 560, z: 0.8}, easing: EASE_OUT},
      ...INTERFACE_STEPS.map((s) => ({at: s.from - 4, dur: 16, cam: s.cam})),
      {at: 206, dur: 19, cam: {fx: 1150, fy: 800, z: 1.15}},
    ]),
    frame,
  );

export const InterfaceScene: React.FC<{plate?: boolean}> = ({plate}) => {
  const frame = useCurrentFrame();
  const cam = interfaceCam(frame);
  const active = INTERFACE_STEPS.find((s) => frame >= s.from && frame < s.to + 2);
  const playhead = 1.2 + frame / 30;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <UrbanBackground frame={frame + 150} word="PANELES" />
      <CameraView cam={cam}>
        <PremiereUI
          state={{
            frame: frame + 150,
            playhead,
            clips: DEFAULT_CLIPS,
            program: {kind: 'vlog', t: frame + 150, talking: true},
            focus: active ? (active.rect === L.project ? 'project' : active.rect === L.source ? 'source' : active.rect === L.program ? 'program' : active.rect === L.timeline ? 'timeline' : 'tools') : undefined,
          }}
        />
      </CameraView>
      {plate ? null : (
        <>
      {INTERFACE_STEPS.map((s) => {
        const r = toScreen(s.rect, cam);
        const lx = s.labelSide === 'right' ? r.x + r.w + 26 : r.x + 10;
        const ly = s.labelSide === 'right' ? r.y + 160 : r.y - 14;
        return (
          <React.Fragment key={s.title}>
            <Callout frame={frame} start={s.from} end={s.to} rect={r} />
            <CalloutLabel frame={frame} start={s.from + 3} end={s.to} x={lx} y={ly} title={s.title} desc={s.desc} />
          </React.Fragment>
        );
      })}
      <SceneTag frame={frame} start={4} num="01" label="LA INTERFAZ" exit={60} />
      <FaceCam frame={frame} start={14} x={1740} y={900} d={250} talking={(frame > 24 && frame < 62) || (frame > 140 && frame < 176)} />
      <SpeechBubble frame={frame} start={24} exit={62} x={1610} y={800} text="¡Así se ve Premiere Pro!" size={40} />
      <SpeechBubble frame={frame} start={140} exit={176} x={1610} y={800} text="¡Todo pasa en la línea de tiempo!" size={36} maxWidth={520} />
      <CornerMarks frame={frame} start={0} />
      <Grain frame={frame} />
      <div style={{position: 'absolute', inset: 0, background: '#000', opacity: ramp(frame, 0, 1, [0, 0])}} />
        </>
      )}
    </AbsoluteFill>
  );
};
