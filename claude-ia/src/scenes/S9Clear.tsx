import {getLength, getPointAtLength} from '@remotion/paths';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_IN_OUT, pop, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C} from '../theme';

// Bloques de vidrio y una estela luminosa en "L" que guía hacia "Respuestas [claras]".
export const S9_DURATION = 108;

type Block = {x: number; y: number; w: number; h: number; kind: 'fill' | 'line' | 'grad'};
const BLOCKS: Block[] = [
  {x: 640, y: 410, w: 60, h: 120, kind: 'grad'},
  {x: 730, y: 410, w: 56, h: 56, kind: 'fill'},
  {x: 812, y: 410, w: 56, h: 56, kind: 'grad'},
  {x: 894, y: 410, w: 56, h: 56, kind: 'line'},
  {x: 980, y: 410, w: 300, h: 56, kind: 'grad'},
  {x: 1310, y: 410, w: 56, h: 56, kind: 'line'},
  {x: 1310, y: 500, w: 56, h: 56, kind: 'fill'},
  {x: 640, y: 600, w: 60, h: 56, kind: 'grad'},
  {x: 730, y: 600, w: 250, h: 56, kind: 'fill'},
  {x: 1010, y: 600, w: 56, h: 56, kind: 'line'},
  {x: 1100, y: 600, w: 56, h: 56, kind: 'fill'},
  {x: 1190, y: 600, w: 56, h: 56, kind: 'grad'},
  {x: 1310, y: 600, w: 56, h: 56, kind: 'line'},
];

const TRAIL = 'M 700 330 L 700 520 Q 700 628 808 628 L 1220 628';
const TL = getLength(TRAIL);

export const S9Clear: React.FC = () => {
  const f = useCurrentFrame();
  const draw = ramp(f, 14, 46, [0, 1], EASE_IN_OUT);
  const head = getPointAtLength(TRAIL, Math.max(1, draw * TL)) ?? {x: 700, y: 330};
  const out = ramp(f, 92, 106, [0, 1], EASE_IN);

  return (
    <DarkBackdrop
      orbs={[
        {x: 960, y: 1200, r: 760, color: 'rgba(217,119,87,0.6)', kind: 'ring', drift: 30},
        {x: 960, y: 560, r: 520, color: 'rgba(242,166,90,0.22)', drift: 30},
        {x: 300, y: 200, r: 400, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 - out * 0.3})`, opacity: 1 - out}}>
        {BLOCKS.map((b, i) => {
          const p = pop(f, i * 1.5, {damping: 14});
          const style: React.CSSProperties =
            b.kind === 'fill'
              ? {background: 'rgba(217,119,87,0.55)', border: '1.5px solid rgba(255,190,150,0.5)'}
              : b.kind === 'grad'
                ? {background: `linear-gradient(90deg, ${C.amber}, rgba(242,166,90,0.25))`, boxShadow: `0 0 18px ${C.coral}88`}
                : {border: '2.5px solid rgba(255,220,200,0.6)'};
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                borderRadius: 10,
                transform: `scale(${p})`,
                ...style,
              }}
            />
          );
        })}
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
          <defs>
            <linearGradient id="trail" gradientUnits="userSpaceOnUse" x1={700} y1={330} x2={1220} y2={628}>
              <stop offset={0} stopColor={C.amber} />
              <stop offset={1} stopColor={C.spark} />
            </linearGradient>
          </defs>
          <path
            d={TRAIL}
            fill="none"
            stroke="url(#trail)"
            strokeWidth={30}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${draw * TL} ${TL * 2}`}
            style={{filter: `drop-shadow(0 0 10px ${C.coral}) drop-shadow(0 0 30px ${C.coral})`}}
          />
        </svg>
        <div style={{position: 'absolute', left: head.x, top: head.y, transform: `translate(-50%,-50%) scale(${pop(f, 12)})`}}>
          <Spark size={56} rotate={f * 6} />
        </div>
        <div style={{position: 'absolute', left: 748, top: 490}}>
          <Line
            size={60}
            seed={13}
            segs={[
              {text: 'Respuestas ', at: 22, weight: 400, speed: 1.2},
              {text: 'claras', at: 36, weight: 800, color: C.glow, speed: 1.6},
            ]}
          />
        </div>
      </div>
    </DarkBackdrop>
  );
};
