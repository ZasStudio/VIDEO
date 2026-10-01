import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_IN, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Line} from '../mg/Text';
import {C} from '../theme';

// "Porque una gran IA / no solo / responde, / [entiende]" — texto apilado a la izquierda,
// con una chispa gigante dibujada a línea en la esquina.
export const S11_DURATION = 108;

const PETALS = [0, 1, 2, 3, 4, 5, 6, 7];

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
  const dotX = 150 + dotT * 420;
  const dotY = 860 - Math.abs(Math.sin(dotT * Math.PI * 3)) * 70;

  return (
    <DarkBackdrop
      orbs={[
        {x: 1300, y: 300, r: 760, color: 'rgba(217,119,87,0.45)', kind: 'ring', drift: 40},
        {x: 300, y: 1000, r: 400, color: 'rgba(90,40,22,0.6)'},
        {x: 1700, y: 900, r: 420, color: 'rgba(242,166,90,0.2)'},
      ]}
    >
      {/* Chispa a línea */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, transform: `rotate(${f * 0.15}deg)`, transformOrigin: '1560px 980px'}}>
        {PETALS.map((i) => {
          const a = (i / PETALS.length) * 360;
          const L = 2 * Math.PI * 210;
          return (
            <ellipse
              key={i}
              cx={0}
              cy={-220}
              rx={95}
              ry={200}
              fill="none"
              stroke={C.amber}
              strokeOpacity={0.45}
              strokeWidth={2.5}
              strokeDasharray={`${L * draw} ${L}`}
              transform={`translate(1560 980) rotate(${a})`}
            />
          );
        })}
      </svg>

      <div style={{position: 'absolute', left: 130, top: 170, opacity: 1 - ramp(f, 98, 108, [0, 1], EASE_IN)}}>
        {lines.map((l, i) => (
          <Line key={i} size={90} seed={20 + i} tracking={0.01} style={{lineHeight: 1.3}} segs={[{...l, speed: 1.3}]} />
        ))}
        <Line
          size={112}
          seed={30}
          style={{marginTop: 10, textShadow: `0 0 34px ${C.coral}`}}
          segs={[{text: 'entiende', at: 58, weight: 800, color: C.glow, mode: 'spread', speed: 0.7}]}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: dotX,
          top: dotY,
          width: 18,
          height: 18,
          borderRadius: 9,
          background: C.spark,
          boxShadow: `0 0 16px ${C.coral}`,
          opacity: ramp(f, 66, 70) * (1 - ramp(f, 84, 90)),
        }}
      />
    </DarkBackdrop>
  );
};
