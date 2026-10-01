import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Line} from '../mg/Text';
import {C} from '../theme';

// "Porque / una gran IA / no solo / responde, / [entiende]" — texto apilado a la izquierda,
// con una chispa gigante dibujada a línea en la esquina.
export const S11_DURATION = 108;

const PETALS = [0, 1, 2, 3, 4, 5, 6, 7];
const PIVOT = {x: 900, y: 1720};

export const S11Understand: React.FC = () => {
  const f = useCurrentFrame();
  const draw = ramp(f, 6, 60);
  const lines = [
    {text: 'Porque', at: 2, weight: 400},
    {text: 'una gran IA', at: 14, weight: 400},
    {text: 'no solo', at: 30, weight: 400},
    {text: 'responde,', at: 42, weight: 400},
  ];
  // punto que "rebota" sobre la última línea, como en la referencia
  const dotT = ramp(f, 66, 86, [0, 1], (t) => t);
  const dotX = 110 + dotT * 600;
  const dotY = 1225 - Math.abs(Math.sin(dotT * Math.PI * 3)) * 90;

  return (
    <DarkBackdrop
      orbs={[
        {x: 820, y: 500, r: 860, color: 'rgba(217,119,87,0.45)', kind: 'ring', drift: 40},
        {x: 200, y: 1800, r: 460, color: 'rgba(90,40,22,0.6)'},
        {x: 1000, y: 1600, r: 480, color: 'rgba(242,166,90,0.2)'},
      ]}
    >
      <svg
        width={1080}
        height={1920}
        style={{position: 'absolute', inset: 0, rotate: `${f * 0.15}deg`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px`}}
      >
        {PETALS.map((i) => {
          const a = (i / PETALS.length) * 360;
          const L = 2 * Math.PI * 250;
          return (
            <ellipse
              key={i}
              cx={0}
              cy={-260}
              rx={110}
              ry={240}
              fill="none"
              stroke={C.amber}
              strokeOpacity={0.45}
              strokeWidth={3}
              strokeDasharray={`${L * draw} ${L}`}
              transform={`translate(${PIVOT.x} ${PIVOT.y}) rotate(${a})`}
            />
          );
        })}
      </svg>

      <div style={{position: 'absolute', left: 90, top: 420, opacity: 1 - ramp(f, 98, 108, [0, 1], EASE_IN_OUT)}}>
        {lines.map((l, i) => (
          <Line key={i} size={128} seed={21 + i} tracking={0.01} style={{lineHeight: 1.28}} segs={[{...l, speed: 1.3}]} />
        ))}
        <Line
          size={168}
          seed={30}
          style={{marginTop: 16, textShadow: `0 0 40px ${C.coral}`}}
          segs={[{text: 'entiende', at: 58, weight: 800, color: C.glow, mode: 'spread', speed: 0.7}]}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: dotX,
          top: dotY,
          width: 24,
          height: 24,
          borderRadius: 12,
          background: C.spark,
          boxShadow: `0 0 18px ${C.coral}`,
          opacity: ramp(f, 66, 70) * (1 - ramp(f, 84, 90)),
        }}
      />
    </DarkBackdrop>
  );
};
