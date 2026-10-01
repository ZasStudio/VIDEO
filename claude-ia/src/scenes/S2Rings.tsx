import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_IN_OUT, keyframes, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {GlowBlob, Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C} from '../theme';

// "Idea" -> una mancha de luz barre la palabra -> "Prompt", que gira siguiendo los arcos.
export const S2_DURATION = 108;

const CIRCLES = [
  {cx: 470, cy: 90, r: 600},
  {cx: 1450, cy: 90, r: 600},
  {cx: 470, cy: 990, r: 600},
  {cx: 1450, cy: 990, r: 600},
];

export const S2Rings: React.FC = () => {
  const f = useCurrentFrame();
  const enter = keyframes(f, [0, 18], [1.45, 1]);
  const enterO = ramp(f, 0, 10);

  const bx = keyframes(f, [26, 46], [1180, 830], EASE_IN_OUT);
  const by = keyframes(f, [26, 46], [400, 600], EASE_IN_OUT);
  const bScale = Math.sin(Math.PI * ramp(f, 24, 50, [0, 1], (t) => t));
  const swing = ramp(f, 70, 104, [0, 1], EASE_IN);

  return (
    <DarkBackdrop
      orbs={[
        {x: 960, y: 1150, r: 700, color: 'rgba(217,119,87,0.6)', drift: 40},
        {x: 960, y: 1150, r: 420, color: 'rgba(242,166,90,0.45)', drift: 30},
        {x: 300, y: 300, r: 420, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      <svg
        width={1920}
        height={1080}
        style={{position: 'absolute', inset: 0, opacity: enterO, transform: `scale(${enter})`, overflow: 'visible'}}
      >
        {CIRCLES.map((c, i) => {
          const L = 2 * Math.PI * c.r;
          const head = (f * 9 + i * 700) % L;
          return (
            <g key={i}>
              <circle cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke="rgba(255,200,170,0.32)" strokeWidth={2} />
              <circle
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                fill="none"
                stroke={C.amber}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={`220 ${L}`}
                strokeDashoffset={-head}
                style={{filter: `drop-shadow(0 0 8px ${C.coral})`}}
              />
              {/* puntos que orbitan */}
              {[0, 1].map((k) => {
                const a = f * 0.012 * (i % 2 ? 1 : -1) + i + k * 2.4;
                return <circle key={k} cx={c.cx + Math.cos(a) * c.r} cy={c.cy + Math.sin(a) * c.r} r={5} fill={C.spark} />;
              })}
            </g>
          );
        })}
      </svg>

      {/* Chispa pequeña orbitando */}
      <div
        style={{
          position: 'absolute',
          left: 1450 + Math.cos(2.2 + f * 0.015) * 600,
          top: 990 + Math.sin(2.2 + f * 0.015) * 600 - 20,
          transform: 'translate(-50%,-50%)',
        }}
      >
        <Spark size={46} rotate={f * 3} />
      </div>

      {/* Palabras */}
      <AbsoluteFill
        style={{
          transformOrigin: '960px 1500px',
          transform: `rotate(${swing * 32}deg)`,
          opacity: 1 - ramp(f, 92, 106),
        }}
      >
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <Line size={96} seed={3} segs={[{text: 'Idea', at: 6, mode: 'rise', weight: 400, speed: 2, out: 36}]} />
        </AbsoluteFill>
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <Line
            size={118}
            seed={4}
            segs={[{text: 'Prompt', at: 40, mode: 'scramble', weight: 800, color: C.glow, speed: 1.6}]}
            style={{textShadow: `0 0 30px ${C.coral}88`}}
          />
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Mancha de luz que barre la palabra */}
      <div
        style={{
          position: 'absolute',
          left: bx,
          top: by,
          transform: `translate(-50%,-50%) scale(${bScale})`,
          opacity: bScale > 0.02 ? 1 : 0,
        }}
      >
        <GlowBlob w={180} h={230} rotate={-25 + f * 2} />
      </div>
      <AbsoluteFill style={{background: C.ink, opacity: ramp(f, 100, 108, [0, 0.4], EASE_IN)}} />
    </DarkBackdrop>
  );
};
