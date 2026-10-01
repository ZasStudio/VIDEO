import {getLength, getPointAtLength} from '@remotion/paths';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, appear, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C} from '../theme';

// Bloques de vidrio y una estela luminosa en "L" que guía hacia "Respuestas / [claras]".
export const S9_DURATION = 108;

type Block = {x: number; y: number; w: number; h: number; kind: 'fill' | 'line' | 'grad'};
const BLOCKS: Block[] = [
  {x: 270, y: 620, w: 70, h: 70, kind: 'fill'},
  {x: 360, y: 620, w: 70, h: 70, kind: 'grad'},
  {x: 450, y: 620, w: 70, h: 70, kind: 'line'},
  {x: 540, y: 620, w: 260, h: 70, kind: 'grad'},
  {x: 820, y: 620, w: 70, h: 70, kind: 'line'},
  {x: 120, y: 720, w: 50, h: 160, kind: 'grad'},
  {x: 120, y: 900, w: 50, h: 70, kind: 'line'},
  {x: 120, y: 990, w: 50, h: 120, kind: 'fill'},
  {x: 900, y: 720, w: 70, h: 70, kind: 'fill'},
  {x: 900, y: 810, w: 70, h: 200, kind: 'line'},
  {x: 900, y: 1030, w: 70, h: 70, kind: 'grad'},
  {x: 270, y: 1330, w: 300, h: 70, kind: 'fill'},
  {x: 590, y: 1330, w: 70, h: 70, kind: 'line'},
  {x: 680, y: 1330, w: 70, h: 70, kind: 'fill'},
  {x: 770, y: 1330, w: 120, h: 70, kind: 'grad'},
];

const TRAIL = 'M 220 560 L 220 1150 Q 220 1270 340 1270 L 900 1270';
const TL = getLength(TRAIL);

export const S9Clear: React.FC = () => {
  const f = useCurrentFrame();
  const draw = ramp(f, 14, 46, [0, 1], EASE_IN_OUT);
  const head = getPointAtLength(TRAIL, Math.max(1, draw * TL)) ?? {x: 220, y: 560};
  const out = ramp(f, 92, 106, [0, 1], EASE_IN_OUT);

  return (
    <DarkBackdrop
      orbs={[
        {x: 540, y: 2050, r: 860, color: 'rgba(217,119,87,0.6)', kind: 'ring', drift: 30},
        {x: 540, y: 960, r: 560, color: 'rgba(242,166,90,0.22)', drift: 30},
        {x: 200, y: 300, r: 420, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      <div style={{position: 'absolute', inset: 0, scale: String(1 - out * 0.25), opacity: 1 - out}}>
        {BLOCKS.map((b, i) => {
          const a = appear(f, i * 1.5, 0.6);
          const style: React.CSSProperties =
            b.kind === 'fill'
              ? {background: 'rgba(217,119,87,0.55)', border: '1.5px solid rgba(255,190,150,0.5)'}
              : b.kind === 'grad'
                ? {background: `linear-gradient(90deg, ${C.amber}, rgba(242,166,90,0.25))`, boxShadow: `0 0 18px ${C.coral}88`}
                : {border: '3px solid rgba(255,220,200,0.6)'};
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                borderRadius: 12,
                opacity: a.opacity,
                scale: a.scale,
                ...style,
              }}
            />
          );
        })}
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
          <defs>
            <linearGradient id="trail" gradientUnits="userSpaceOnUse" x1={220} y1={560} x2={900} y2={1270}>
              <stop offset={0} stopColor={C.amber} />
              <stop offset={1} stopColor={C.spark} />
            </linearGradient>
          </defs>
          <path
            d={TRAIL}
            fill="none"
            stroke="url(#trail)"
            strokeWidth={36}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${draw * TL} ${TL * 2}`}
            style={{filter: `drop-shadow(0 0 10px ${C.coral}) drop-shadow(0 0 30px ${C.coral})`}}
          />
        </svg>
        <div style={{position: 'absolute', left: head.x, top: head.y, translate: '-50% -50%', ...appear(f, 12)}}>
          <Spark size={72} rotate={f * 6} />
        </div>
        <div style={{position: 'absolute', left: 290, top: 820}}>
          <Line size={104} seed={15} segs={[{text: 'Respuestas', at: 22, weight: 400, speed: 1.2}]} />
          <Line size={132} seed={16} style={{marginTop: 4}} segs={[{text: 'claras', at: 36, weight: 800, color: C.glow, speed: 1.6}]} />
        </div>
      </div>
    </DarkBackdrop>
  );
};
