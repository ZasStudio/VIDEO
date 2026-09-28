import React from 'react';
import {Sheep, SheepPose} from '../character/Sheep';
import {blinkAt, idlePose, talkAt} from '../character/poses';
import {EASE_IN_OUT, pop, ramp} from '../anim';
import {C, FONT} from '../theme';

// Streamer-style facecam with the sheep avatar + comic speech bubbles.

/** Pose of the sheep inside the facecam (shared with the After Effects export). */
export const faceCamPose = (frame: number, talking: boolean, poseOverride?: Partial<SheepPose>) =>
  idlePose(frame, 1, {
    blink: blinkAt(frame, 7),
    mouth: talking ? 'talk' : 'smile',
    mouthOpen: talking ? talkAt(frame) : 0,
    ...poseOverride,
  });

export const FaceCam: React.FC<{
  frame: number;
  start: number;
  exit?: number;
  x: number; // center
  y: number;
  d: number; // diameter
  talking?: boolean;
  poseOverride?: Partial<SheepPose>;
  label?: string;
}> = ({frame, start, exit, x, y, d, talking, poseOverride, label = 'EN VIVO'}) => {
  if (frame < start) return null;
  const s = pop(frame, start, {damping: 10, stiffness: 160});
  const out = exit !== undefined ? ramp(frame, exit, exit + 10, [1, 0], EASE_IN_OUT) : 1;
  if (out <= 0) return null;
  const pose = faceCamPose(frame, !!talking, poseOverride);
  const H = d * 1.45;
  const W = (H * 880) / 1160;
  const dot = Math.floor(frame / 15) % 2 === 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        scale: `${s * out}`,
        rotate: `${(1 - s) * -20}deg`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          background: `radial-gradient(circle at 50% 40%, ${C.redHot} 0%, ${C.red} 55%, ${C.redDark} 100%)`,
          boxShadow: `0 0 0 ${d * 0.04}px ${C.white}, 0 0 0 ${d * 0.065}px ${C.ink}, ${d * 0.05}px ${d * 0.06}px 0 ${d * 0.065}px rgba(0,0,0,0.35)`,
        }}
      >
        <svg width={d} height={d} style={{position: 'absolute', inset: 0}}>
          <defs>
            <pattern id="fc-dots" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
              <circle cx="8" cy="8" r="3" fill="#C8102A" />
            </pattern>
          </defs>
          <rect width={d} height={d} fill="url(#fc-dots)" opacity={0.7} />
        </svg>
        <div style={{position: 'absolute', left: d * 0.5 - W * 0.54, top: d * 0.47 - H * 0.262}}>
          <Sheep pose={pose} height={H} shadow={false} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -d * 0.02,
          translate: '-50% -50%',
          background: C.red,
          color: C.white,
          fontFamily: FONT.block,
          fontSize: d * 0.085,
          padding: `${d * 0.012}px ${d * 0.05}px`,
          borderRadius: d,
          border: `${d * 0.014}px solid ${C.white}`,
          boxShadow: `0 0 0 ${d * 0.01}px ${C.ink}`,
          display: 'flex',
          alignItems: 'center',
          gap: d * 0.025,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{width: d * 0.045, height: d * 0.045, borderRadius: '50%', background: dot ? C.white : '#FF9AA4'}} />
        {label}
      </div>
    </div>
  );
};

export const SpeechBubble: React.FC<{
  frame: number;
  start: number;
  exit?: number;
  x: number; // tail tip (screen)
  y: number;
  side?: 'left' | 'right'; // which side of the tail the bubble sits
  text: string;
  size?: number;
  maxWidth?: number;
  bg?: string;
  color?: string;
}> = ({frame, start, exit, x, y, side = 'left', text, size = 40, maxWidth = 620, bg = C.white, color = C.ink}) => {
  if (frame < start) return null;
  const s = pop(frame, start, {damping: 11, stiffness: 220});
  const out = exit !== undefined ? ramp(frame, exit, exit + 7, [1, 0], EASE_IN_OUT) : 1;
  if (out <= 0) return null;
  const chars = Math.round(ramp(frame, start + 2, start + 2 + Math.max(6, text.length * 0.55), [0, text.length]));
  const shown = text.slice(0, chars);
  const tail = side === 'left' ? 'M 0,0 L -70,-36 L -30,-58 Z' : 'M 0,0 L 70,-36 L 30,-58 Z';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        scale: `${s * out}`,
        transformOrigin: '0 0',
      }}
    >
      <svg width="2" height="2" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <path d={tail} fill={bg} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: 'absolute',
          ...(side === 'left' ? {right: 26} : {left: 26}),
          bottom: 40,
          maxWidth,
          width: 'max-content',
          background: bg,
          color,
          fontFamily: FONT.ui,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.12,
          padding: `${size * 0.35}px ${size * 0.55}px`,
          borderRadius: size * 0.6,
          border: `7px solid ${C.ink}`,
          boxShadow: `10px 12px 0 rgba(0,0,0,0.3)`,
        }}
      >
        <span>{shown}</span>
        <span style={{opacity: 0}}>{text.slice(chars)}</span>
      </div>
      <svg width="2" height="2" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <path d={side === 'left' ? 'M -8,-8 L -58,-40 L -30,-54' : 'M 8,-8 L 58,-40 L 30,-54'} fill={bg} stroke="none" />
      </svg>
    </div>
  );
};
