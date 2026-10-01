import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, appear, keyframes, ramp} from '../anim';
import {LightBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C} from '../theme';

// Cierre claro: "✸ Es cómo / [te ayuda]" -> "✸ ¿Listo para / crear con / Claude?"
export const S12_DURATION = 144;

export const S12Outro: React.FC = () => {
  const f = useCurrentFrame();
  const arcT = ramp(f, 50, 66, [0, 1], EASE_IN_OUT);
  const a = appear(f, 2);
  const b = appear(f, 62);
  const end = ramp(f, 132, 144, [0, 1], EASE_IN_OUT);
  return (
    <LightBackdrop
      orbs={[
        {x: 140, y: 300, r: 620, color: 'rgba(251,227,184,0.9)', drift: 60},
        {x: 950, y: 700, r: 560, color: 'rgba(246,205,178,0.7)', drift: 70},
        {x: 540, y: 1900, r: 700, color: 'rgba(251,227,184,0.8)', drift: 50},
      ]}
    >
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: f < 60 ? 1 : 0}}>
        <div style={{opacity: a.opacity * (1 - ramp(f, 48, 56)), scale: a.scale, marginBottom: 40}}>
          <Spark size={90} color={C.cocoa} glow={null} rotate={f * 3} />
        </div>
        <Line size={116} dark={false} seed={40} style={{textAlign: 'center'}} segs={[{text: 'Es cómo', at: 8, weight: 400, out: 46}]} />
        <Line
          size={124}
          dark={false}
          seed={41}
          style={{textAlign: 'center', marginTop: 12}}
          segs={[{text: 'te ayuda', at: 18, weight: 800, highlight: {at: 26, textColor: C.white}, out: 50}]}
        />
      </AbsoluteFill>

      {/* Arco de tinta de transición */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <path
          d="M 440 950 Q 540 880 640 930"
          fill="none"
          stroke={C.clay}
          strokeWidth={10}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.5 1"
          strokeDashoffset={keyframes(f, [50, 66], [0.5, -1])}
          opacity={arcT > 0 && arcT < 1 ? 1 : 0}
          transform={`translate(${(arcT - 0.5) * 160} ${-arcT * 60})`}
        />
      </svg>

      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: 1 - end}}>
        <div style={{opacity: b.opacity, scale: b.scale, marginBottom: 44}}>
          <Spark size={104} color={C.clay} glow={null} rotate={f * 2.5} />
        </div>
        <Line size={112} dark={false} seed={42} style={{textAlign: 'center'}} segs={[{text: '¿Listo para', at: 66, weight: 400, speed: 1.1}]} />
        <Line size={112} dark={false} seed={43} style={{textAlign: 'center', marginTop: 8}} segs={[{text: 'crear con', at: 78, weight: 400, speed: 1.1}]} />
        <Line
          size={150}
          dark={false}
          seed={44}
          style={{textAlign: 'center', marginTop: 12}}
          segs={[
            {text: 'Claude', at: 90, weight: 800, color: C.clay, mode: 'rise', speed: 2},
            {text: '?', at: 102, weight: 400},
          ]}
        />
      </AbsoluteFill>
    </LightBackdrop>
  );
};
