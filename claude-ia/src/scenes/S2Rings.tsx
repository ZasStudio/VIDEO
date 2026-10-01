import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, keyframes, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {GlowBlob, Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C} from '../theme';

// "Idea" -> una mancha de luz barre la palabra -> "Prompt", que gira siguiendo los arcos.
export const S2_DURATION = 108;

const CIRCLES = [
  {cx: 80, cy: 560, r: 660},
  {cx: 1000, cy: 560, r: 660},
  {cx: 80, cy: 1360, r: 660},
  {cx: 1000, cy: 1360, r: 660},
];

export const S2Rings: React.FC = () => {
  const f = useCurrentFrame();
  const bx = keyframes(f, [26, 46], [800, 420], EASE_IN_OUT);
  const by = keyframes(f, [26, 46], [800, 1080], EASE_IN_OUT);
  const bScale = Math.sin(Math.PI * ramp(f, 24, 50, [0, 1], (t) => t));
  const swing = ramp(f, 70, 104, [0, 1], EASE_IN_OUT);
  const orbitA = 2.6 + f * 0.015;

  return (
    <DarkBackdrop
      orbs={[
        {x: 540, y: 2050, r: 820, color: 'rgba(217,119,87,0.6)', drift: 40},
        {x: 540, y: 2050, r: 500, color: 'rgba(242,166,90,0.45)', drift: 30},
        {x: 200, y: 300, r: 460, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      <svg
        width={1080}
        height={1920}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: ramp(f, 0, 10),
          scale: String(keyframes(f, [0, 20], [1.5, 1], EASE_OUT)),
          overflow: 'visible',
        }}
      >
        {CIRCLES.map((c, i) => {
          const L = 2 * Math.PI * c.r;
          const head = (f * 10 + i * 760) % L;
          return (
            <g key={i}>
              <circle cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke="rgba(255,200,170,0.32)" strokeWidth={2} />
              <circle
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                fill="none"
                stroke={C.amber}
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={`240 ${L}`}
                strokeDashoffset={-head}
                style={{filter: `drop-shadow(0 0 8px ${C.coral})`}}
              />
              {[0, 1].map((k) => {
                const a = f * 0.012 * (i % 2 ? 1 : -1) + i + k * 2.4;
                return <circle key={k} cx={c.cx + Math.cos(a) * c.r} cy={c.cy + Math.sin(a) * c.r} r={6} fill={C.spark} />;
              })}
            </g>
          );
        })}
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 1000 + Math.cos(orbitA) * 660,
          top: 1360 + Math.sin(orbitA) * 660,
          translate: '-50% -50%',
        }}
      >
        <Spark size={58} rotate={f * 3} />
      </div>

      {/* Palabras: giran alrededor de un pivote bajo la pantalla, siguiendo los arcos */}
      <AbsoluteFill
        style={{
          transformOrigin: '540px 2700px',
          rotate: `${swing * 28}deg`,
          opacity: 1 - ramp(f, 92, 106),
        }}
      >
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <Line size={150} seed={3} segs={[{text: 'Idea', at: 6, mode: 'rise', weight: 400, speed: 2, out: 36}]} />
        </AbsoluteFill>
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <Line
            size={176}
            seed={4}
            segs={[{text: 'Prompt', at: 40, mode: 'scramble', weight: 800, color: C.glow, speed: 1.6}]}
            style={{textShadow: `0 0 40px ${C.coral}88`}}
          />
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Mancha de luz que barre la palabra */}
      <div
        style={{
          position: 'absolute',
          left: bx,
          top: by,
          translate: '-50% -50%',
          scale: String(Math.max(bScale, 0.001)),
          opacity: bScale > 0.02 ? 1 : 0,
        }}
      >
        <GlowBlob w={240} h={300} rotate={-25 + f * 2} />
      </div>
      <AbsoluteFill style={{background: C.ink, opacity: ramp(f, 100, 108, [0, 0.4])}} />
    </DarkBackdrop>
  );
};
