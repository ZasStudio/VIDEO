import React from 'react';
import {rand} from '../anim';
import {C} from '../theme';
import {Footage, FootageKind} from './Footage';
import {IconCaptions, IconEye, IconLink, IconLock, IconMagnet, IconMarker, IconMic, IconSparkle, IconWrench} from './Icons';
import {Panel} from './Panels';
import {Rect, TAB_H, TL, TRACKS, TrackId, secToX, timecode, trackY} from './layout';

export type TLClip = {
  id: string;
  track: TrackId;
  start: number; // seconds
  end: number;
  name: string;
  kind: 'video' | 'audio' | 'graphic';
  color?: string;
  thumb?: FootageKind;
  selected?: boolean;
  opacity?: number;
  dy?: number; // vertical offset in px (drag & drop)
  dx?: number;
  wave?: {type: 'speech' | 'music'; noise?: number; seed?: number; gaps?: [number, number][]};
  genExt?: {from: number; to: number; progress: number};
  fx?: boolean;
};

export type TLTransition = {track: TrackId; at: number; progress: number};

const waveAmp = (type: 'speech' | 'music', t: number, seed: number) => {
  if (type === 'music') {
    const beat = Math.pow(Math.abs(Math.sin(t * Math.PI * 1.6)), 6);
    return 0.35 + 0.25 * beat + 0.15 * rand(Math.floor(t * 12) + seed);
  }
  // speech: syllable bursts with short pauses
  const word = Math.floor(t * 2.3 + seed);
  const inWord = (t * 2.3 + seed) % 1;
  const pause = rand(word * 3.1) < 0.18;
  const env = pause ? 0.05 : Math.sin(inWord * Math.PI) * (0.45 + 0.5 * rand(word));
  return env * (0.7 + 0.3 * rand(Math.floor(t * 40) + seed * 7));
};

const Waveform: React.FC<{
  w: number;
  h: number;
  start: number;
  type: 'speech' | 'music';
  noise: number;
  seed: number;
  color: string;
}> = ({w, h, start, type, noise, seed, color}) => {
  const step = 3;
  const cy = h / 2;
  let d = '';
  for (let x = 0; x < w; x += step) {
    const t = start + x / TL.pxPerSec;
    const base = waveAmp(type, t, seed);
    const n = noise * (0.3 + 0.35 * rand(x * 0.37 + seed));
    const a = Math.min(1, base + n) * (h * 0.46);
    d += `M${x.toFixed(1)},${(cy - a).toFixed(1)}L${x.toFixed(1)},${(cy + a).toFixed(1)}`;
  }
  return (
    <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}>
      <path d={d} stroke={color} strokeWidth={2} />
    </svg>
  );
};

const ClipView: React.FC<{clip: TLClip; offset: number; frame: number}> = ({clip, offset, frame}) => {
  const x = secToX(clip.start, offset) + (clip.dx ?? 0);
  const w = Math.max(2, (clip.end - clip.start) * TL.pxPerSec);
  const top = trackY(clip.track) + 3 + (clip.dy ?? 0);
  const h = TL.trackH - 6;
  const color = clip.color ?? (clip.kind === 'audio' ? C.clipAudio : clip.kind === 'graphic' ? C.clipGraphic : C.clipVideo);
  const isAudio = clip.kind === 'audio';
  const ext = clip.genExt;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x,
          top,
          width: w,
          height: h,
          borderRadius: 4,
          background: isAudio ? '#16624F' : color,
          overflow: 'hidden',
          opacity: clip.opacity ?? 1,
          boxShadow: clip.selected ? '0 0 0 2px #FFFFFF' : `inset 0 0 0 1px ${isAudio ? '#0B3A2E' : '#00000055'}`,
        }}
      >
        {!isAudio && clip.thumb ? (
          <div style={{position: 'absolute', left: 0, top: 14, width: Math.min(w, 56), height: h - 14, overflow: 'hidden', opacity: 0.95}}>
            <Footage kind={clip.thumb} t={frame} w={56} h={h - 14} talking={false} />
          </div>
        ) : null}
        {isAudio && clip.wave ? (
          <Waveform
            w={w}
            h={h}
            start={clip.start}
            type={clip.wave.type}
            noise={clip.wave.noise ?? 0}
            seed={clip.wave.seed ?? 1}
            color={color}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: 15,
            background: isAudio ? 'transparent' : '#0000001F',
            fontSize: 11.5,
            fontWeight: 600,
            color: isAudio ? '#DFF7F0' : '#161616',
            padding: '0 6px',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {clip.fx ? (
            <span style={{background: '#FFE14D', color: '#161616', borderRadius: 2, padding: '0 3px', fontSize: 10, fontWeight: 800}}>fx</span>
          ) : null}
          {clip.name}
        </div>
      </div>
      {ext ? (
        <div
          style={{
            position: 'absolute',
            left: secToX(ext.from, offset),
            top,
            width: Math.max(0, (ext.to - ext.from) * TL.pxPerSec * ext.progress),
            height: h,
            borderRadius: 4,
            overflow: 'hidden',
            background: `repeating-linear-gradient(135deg, ${C.ai} 0 8px, #7B4FD6 8px 16px)`,
            backgroundPosition: `${frame * 1.5}px 0`,
            boxShadow: '0 0 0 2px #FFFFFF, 0 0 18px #B98CFFAA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconSparkle size={18} color="#FFFFFF" filled />
        </div>
      ) : null}
    </>
  );
};

export const TimelinePanel: React.FC<{
  r: Rect;
  clips: TLClip[];
  playhead: number;
  frame: number;
  offset?: number;
  focused?: boolean;
  transitions?: TLTransition[];
  targetTracks?: TrackId[];
}> = ({r, clips, playhead, frame, offset = 0, focused, transitions = [], targetTracks = ['V1', 'A1']}) => {
  const rulerTop = TAB_H + TL.topRow - 30;
  const tracksBottom = trackY('A3') + TL.trackH;
  const phX = secToX(playhead, offset);
  const visibleSec = (r.w - TL.headerW) / TL.pxPerSec;
  return (
    <Panel r={r} tabs={['Secuencia 01']} focused={focused}>
      <div style={{position: 'absolute', inset: 0, top: -TAB_H}}>
        {/* timecode + toolbar */}
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: TAB_H + 6,
            fontSize: 24,
            fontWeight: 600,
            color: C.uiBlue,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 0.5,
          }}
        >
          {timecode(playhead)}
        </div>
        <div style={{position: 'absolute', left: 14, top: TAB_H + 40, display: 'flex', gap: 10}}>
          <IconMagnet size={15} color={C.uiBlue} />
          <IconLink size={15} color={C.uiBlue} />
          <IconMarker size={15} />
          <IconWrench size={15} />
          <IconCaptions size={15} />
        </div>
        {/* ruler */}
        <div style={{position: 'absolute', left: TL.headerW, right: 0, top: rulerTop, height: 30, borderBottom: `1px solid ${C.uiLine}`}}>
          {[...Array(Math.ceil(visibleSec) + 2)].map((_, i) => {
            const s = Math.floor(offset) + i;
            const x = (s - offset) * TL.pxPerSec;
            const major = s % 5 === 0;
            return (
              <React.Fragment key={s}>
                <div style={{position: 'absolute', left: x, bottom: 0, width: 1, height: major ? 12 : 6, background: '#6A6A6A'}} />
                {major ? (
                  <div style={{position: 'absolute', left: x + 4, top: 1, fontSize: 11, color: '#9A9A9A', fontVariantNumeric: 'tabular-nums'}}>
                    {timecode(s)}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
        {/* track headers */}
        {TRACKS.map((tr) => {
          const y = trackY(tr);
          const isV = tr.startsWith('V');
          const targeted = targetTracks.includes(tr);
          return (
            <div
              key={tr}
              style={{
                position: 'absolute',
                left: 0,
                top: y,
                width: TL.headerW,
                height: TL.trackH,
                borderBottom: `1px solid ${C.ui0}`,
                background: '#262626',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 8px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 22,
                  borderRadius: 3,
                  background: targeted ? '#1F4F7E' : '#333',
                  color: '#EEE',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tr}
              </div>
              <IconLock size={14} color="#8C8C8C" />
              {isV ? (
                <IconEye size={15} color="#8C8C8C" />
              ) : (
                <>
                  <span style={{fontSize: 11, fontWeight: 700, color: '#9A9A9A', border: '1px solid #555', borderRadius: 3, padding: '0 4px'}}>M</span>
                  <span style={{fontSize: 11, fontWeight: 700, color: '#9A9A9A', border: '1px solid #555', borderRadius: 3, padding: '0 4px'}}>S</span>
                  <IconMic size={14} color="#8C8C8C" />
                </>
              )}
            </div>
          );
        })}
        {/* track lanes */}
        <div style={{position: 'absolute', left: TL.headerW, right: 0, top: TAB_H + TL.topRow, height: tracksBottom - (TAB_H + TL.topRow), overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: -TL.headerW, top: -(TAB_H + TL.topRow), width: r.w, height: r.h}}>
            {TRACKS.map((tr) => (
              <div
                key={tr}
                style={{position: 'absolute', left: TL.headerW, right: 0, top: trackY(tr), height: TL.trackH, borderBottom: `1px solid #1A1A1A`, background: '#212121'}}
              />
            ))}
            {clips
              .filter((c) => !c.dy)
              .map((c) => (
                <ClipView key={c.id} clip={c} offset={offset} frame={frame} />
              ))}
            {transitions.map((tn, i) => {
              const w = 44 * tn.progress;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: secToX(tn.at, offset) - w / 2,
                    top: trackY(tn.track) + 3,
                    width: w,
                    height: TL.trackH - 6,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #D8D8D8 0 49%, #8A8A8A 51% 100%)',
                    boxShadow: '0 0 0 1px #000',
                    opacity: tn.progress,
                  }}
                />
              );
            })}
          </div>
        </div>
        {/* dragged clips float above lanes */}
        {clips
          .filter((c) => c.dy)
          .map((c) => (
            <ClipView key={c.id} clip={c} offset={offset} frame={frame} />
          ))}
        {/* playhead */}
        {phX >= TL.headerW ? (
          <>
            <div style={{position: 'absolute', left: phX - 1, top: rulerTop + 4, width: 2, height: tracksBottom - rulerTop - 4 + 60, background: C.uiBlue}} />
            <div
              style={{
                position: 'absolute',
                left: phX - 8,
                top: rulerTop + 2,
                width: 16,
                height: 18,
                background: C.uiBlue,
                clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)',
              }}
            />
          </>
        ) : null}
      </div>
    </Panel>
  );
};

export const clipRect = (panel: Rect, clip: TLClip, offset = 0): Rect => ({
  x: panel.x + secToX(clip.start, offset),
  y: panel.y + trackY(clip.track) + 3,
  w: (clip.end - clip.start) * TL.pxPerSec,
  h: TL.trackH - 6,
});
