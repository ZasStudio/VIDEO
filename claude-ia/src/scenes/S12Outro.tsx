import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_IN_OUT, keyframes, pop, ramp} from '../anim';
import {LightBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C} from '../theme';

// Cierre claro: "✸ Es cómo [te ayuda]" -> "✸ ¿Listo para crear con Claude?"
export const S12_DURATION = 144;

export const S12Outro: React.FC = () => {
  const f = useCurrentFrame();
  const arcT = ramp(f, 50, 66, [0, 1], EASE_IN_OUT);
  const sparkA = pop(f, 2) * (1 - ramp(f, 50, 58));
  const sparkB = pop(f, 62);
  const end = ramp(f, 132, 144, [0, 1], EASE_IN);
  return (
    <LightBackdrop
      orbs={[
        {x: 200, y: 200, r: 560, color: 'rgba(251,227,184,0.9)', drift: 60},
        {x: 1400, y: 300, r: 520, color: 'rgba(246,205,178,0.7)', drift: 70},
        {x: 900, y: 1150, r: 620, color: 'rgba(251,227,184,0.8)', drift: 50},
      ]}
    >
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, opacity: f < 60 ? 1 : 0}}>
          <div style={{transform: `scale(${sparkA})`}}>
            <Spark size={56} color={C.cocoa} glow={null} rotate={f * 3} />
          </div>
          <Line
            size={72}
            dark={false}
            seed={40}
            segs={[
              {text: 'Es cómo ', at: 8, weight: 400, out: 48},
              {text: 'te ayuda', at: 18, weight: 800, highlight: {at: 26, textColor: C.white}, out: 52},
            ]}
          />
        </div>
      </AbsoluteFill>

      {/* Arco de tinta de transición */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <path
          d="M 900 520 Q 960 470 1020 500"
          fill="none"
          stroke={C.clay}
          strokeWidth={7}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${0.5} 1`}
          strokeDashoffset={keyframes(f, [50, 66], [0.5, -1])}
          opacity={arcT > 0 && arcT < 1 ? 1 : 0}
          transform={`translate(${(arcT - 0.5) * 120} ${-arcT * 40})`}
        />
      </svg>

      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: 1 - end}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
          <div style={{transform: `scale(${sparkB})`}}>
            <Spark size={62} color={C.clay} glow={null} rotate={f * 2.5} />
          </div>
          <Line
            size={80}
            dark={false}
            seed={41}
            segs={[
              {text: '¿Listo para crear con ', at: 66, weight: 400, speed: 1.1},
              {text: 'Claude', at: 90, weight: 800, color: C.clay, mode: 'rise', speed: 2},
              {text: '?', at: 102, weight: 400},
            ]}
          />
        </div>
      </AbsoluteFill>
    </LightBackdrop>
  );
};
