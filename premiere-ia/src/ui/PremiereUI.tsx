import React from 'react';
import {EASE_IN_OUT, clamp01} from '../anim';
import {C} from '../theme';
import {FootageKind} from './Footage';
import {HeaderBar, Meters, MonitorPanel, PROJECT_ITEMS, ProjectItem, ProjectPanel, TitleBar, ToolId, ToolsPanel} from './Panels';
import {PropertiesPanel} from './RightPanels';
import {TLClip, TLTransition, TimelinePanel} from './Timeline';
import {L, Rect, UI_H, UI_W} from './layout';

export type PanelId = 'source' | 'program' | 'right' | 'project' | 'tools' | 'timeline';

export type UIState = {
  frame: number;
  header?: 'Importar' | 'Editar' | 'Exportar';
  tool?: ToolId;
  focus?: PanelId;
  playhead: number;
  clips: TLClip[];
  transitions?: TLTransition[];
  program: {kind: FootageKind; t: number; talking?: boolean; overlay?: React.ReactNode; frameOverride?: React.ReactNode};
  source?: {kind: FootageKind; t: number; title?: string};
  right?: React.ReactNode;
  project?: {search?: string; filter?: (i: ProjectItem) => boolean; selected?: string; hidden?: string[]};
  meter?: number;
  overlay?: React.ReactNode; // absolute children in UI coordinates
};

export const PremiereUI: React.FC<{state: UIState}> = ({state}) => {
  const {frame} = state;
  const src = state.source ?? {kind: 'city' as FootageKind, t: frame, title: 'calle_noche.mp4'};
  return (
    <div style={{position: 'relative', width: UI_W, height: UI_H, background: C.ui0, overflow: 'hidden'}}>
      <TitleBar r={L.titleBar} />
      <HeaderBar r={L.header} active={state.header ?? 'Editar'} />
      <MonitorPanel
        r={L.source}
        title={`Origen: ${src.title ?? 'calle_noche.mp4'}`}
        tabs={[`Origen: ${src.title ?? 'calle_noche.mp4'}`, 'Controles de efectos', 'Mezclador de audio']}
        kind={src.kind}
        t={src.t}
        seconds={3.4}
        duration={6}
        focused={state.focus === 'source'}
        talking={false}
      />
      <MonitorPanel
        r={L.program}
        title="Programa: Secuencia 01"
        kind={state.program.kind}
        t={state.program.t}
        seconds={state.playhead}
        duration={30}
        focused={state.focus === 'program'}
        talking={state.program.talking}
        overlay={state.program.overlay}
        frameOverride={state.program.frameOverride}
        showFit
      />
      {state.right ?? <PropertiesPanel r={L.right} focused={state.focus === 'right'} />}
      <ProjectPanel
        r={L.project}
        t={frame}
        focused={state.focus === 'project'}
        search={state.project?.search}
        filter={state.project?.filter}
        selected={state.project?.selected}
        hidden={state.project?.hidden}
      />
      <ToolsPanel r={L.tools} active={state.tool ?? 'select'} focused={state.focus === 'tools'} />
      <TimelinePanel
        r={L.timeline}
        clips={state.clips}
        playhead={state.playhead}
        frame={frame}
        focused={state.focus === 'timeline'}
        transitions={state.transitions}
      />
      <Meters r={L.meters} level={state.meter ?? 0.55 + 0.25 * Math.abs(Math.sin(frame * 0.35)) * Math.abs(Math.sin(frame * 0.13))} />
      {state.overlay}
    </div>
  );
};

export {PROJECT_ITEMS};

// ---------- Camera ----------

export type Cam = {fx: number; fy: number; z: number; rx?: number; ry?: number; rz?: number};

/** Screen placement for a camera that shows UI point (fx, fy) at the frame center with zoom z. */
export const camTransform = (cam: Cam, screenW = 1920, screenH = 1080) => {
  const tx = screenW / 2 - cam.fx * cam.z;
  const ty = screenH / 2 - cam.fy * cam.z;
  return {tx, ty};
};

export const mixCam = (a: Cam, b: Cam, t: number): Cam => ({
  fx: a.fx + (b.fx - a.fx) * t,
  fy: a.fy + (b.fy - a.fy) * t,
  z: a.z * Math.pow(b.z / a.z, t),
  rx: (a.rx ?? 0) + ((b.rx ?? 0) - (a.rx ?? 0)) * t,
  ry: (a.ry ?? 0) + ((b.ry ?? 0) - (a.ry ?? 0)) * t,
  rz: (a.rz ?? 0) + ((b.rz ?? 0) - (a.rz ?? 0)) * t,
});

/** Convert a UI-space rect to screen space for a given camera (ignores 3D tilt). */
export const toScreen = (r: Rect, cam: Cam): Rect => {
  const {tx, ty} = camTransform(cam);
  return {x: tx + r.x * cam.z, y: ty + r.y * cam.z, w: r.w * cam.z, h: r.h * cam.z};
};

export const CameraView: React.FC<{cam: Cam; children: React.ReactNode; window?: boolean}> = ({cam, children, window = true}) => {
  const {tx, ty} = camTransform(cam);
  const tilt = (cam.rx ?? 0) !== 0 || (cam.ry ?? 0) !== 0 || (cam.rz ?? 0) !== 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: UI_W,
        height: UI_H,
        transformOrigin: '0 0',
        transform: `translate(${tx}px, ${ty}px) scale(${cam.z})`,
      }}
    >
      <div
        style={{
          width: UI_W,
          height: UI_H,
          transformOrigin: '50% 50%',
          transform: tilt ? `perspective(2400px) rotateX(${cam.rx ?? 0}deg) rotateY(${cam.ry ?? 0}deg) rotateZ(${cam.rz ?? 0}deg)` : undefined,
          borderRadius: window ? 14 : 0,
          overflow: 'hidden',
          boxShadow: window ? '0 40px 120px rgba(0,0,0,0.55), 0 0 0 3px #0A0A0A' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export type CamKey = {at: number; dur: number; cam: Cam; easing?: (t: number) => number};

/** Camera path: starts at `start`, then eases to each key's camera during [at, at + dur]. */
export const camPath = (frame: number, start: Cam, keys: CamKey[]): Cam => {
  let cur = start;
  for (const k of keys) {
    const t = clamp01((frame - k.at) / k.dur);
    if (t <= 0) break;
    cur = mixCam(cur, k.cam, (k.easing ?? EASE_IN_OUT)(t));
  }
  return cur;
};

/** Subtle handheld drift so the interface never feels frozen. */
export const drift = (cam: Cam, frame: number, amount = 1): Cam => ({
  ...cam,
  fx: cam.fx + Math.sin(frame * 0.045) * 6 * amount,
  fy: cam.fy + Math.cos(frame * 0.037) * 4 * amount,
});
