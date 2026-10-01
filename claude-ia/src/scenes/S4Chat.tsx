import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_OUT, keyframes, pop, ramp} from '../anim';
import {Grain} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {ChatWindow} from '../mg/UI';
import {C} from '../theme';

// "Convirtiendo [ideas] en resultados" sobre un chat desenfocado (equivale al metraje
// de la persona frente al monitor). La chispa abre un círculo crema hacia la escena clara.
export const S4_DURATION = 144;

export const S4Chat: React.FC = () => {
  const f = useCurrentFrame();
  const push = keyframes(f, [0, 144], [1.04, 1.16], (t) => t);
  const sparkX = keyframes(f, [56, 76], [2050, 1520], EASE_OUT);
  const bounce = Math.abs(Math.sin(((f - 76) / 22) * Math.PI)) * 34 * (f > 76 ? Math.exp(-(f - 76) / 40) : 0);
  const sparkY = 850 - bounce;
  const open = ramp(f, 118, 142, [0, 1], EASE_IN);

  return (
    <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
      {/* Chat desenfocado de fondo */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${push}) perspective(1600px) rotateY(-10deg)`,
          filter: 'blur(7px) brightness(0.62) saturate(1.1)',
        }}
      >
        <ChatWindow w={1640} h={940} p={ramp(f, 0, 144, [0.15, 1], (t) => t)} />
      </AbsoluteFill>
      {/* Luz cálida y viñeta */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 80% 20%, ${C.amber}40 0%, transparent 45%), radial-gradient(ellipse at 15% 80%, ${C.coral}55 0%, transparent 50%)`,
        }}
      />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(15,10,8,0.75) 0%, rgba(15,10,8,0.2) 60%, transparent 100%)'}} />
      {/* Retícula de puntos */}
      <AbsoluteFill
        style={{
          left: 820,
          top: 180,
          width: 900,
          height: 720,
          backgroundImage: `radial-gradient(circle, ${C.glow} 2px, transparent 2.6px)`,
          backgroundSize: '48px 48px',
          opacity: 0.35 * ramp(f, 10, 40),
          maskImage: 'linear-gradient(90deg, transparent, black 30%, black 70%, transparent)',
        }}
      />

      <div style={{position: 'absolute', left: 200, top: 300}}>
        <Line size={104} seed={6} segs={[{text: 'Convirtiendo', at: 8, weight: 400, color: C.glow, speed: 1.2}]} />
        <Line
          size={118}
          seed={7}
          style={{marginTop: 6}}
          segs={[{text: 'ideas', at: 22, weight: 800, color: C.white, mode: 'rise', highlight: {at: 30, textColor: C.white}}]}
        />
        <Line
          size={104}
          seed={8}
          style={{marginTop: 6}}
          segs={[
            {text: 'en ', at: 42, weight: 400},
            {text: 'resultados', at: 48, weight: 800, color: C.glow, speed: 1.4},
          ]}
        />
      </div>

      <div style={{position: 'absolute', left: sparkX, top: sparkY, transform: `translate(-50%,-50%) scale(${pop(f, 56)})`}}>
        <Spark size={96} rotate={f * 4} />
      </div>

      {/* Círculo crema que se abre desde la chispa */}
      <div
        style={{
          position: 'absolute',
          left: 1520,
          top: 850,
          width: open * 4600,
          height: open * 4600,
          borderRadius: '50%',
          background: C.cream,
          transform: 'translate(-50%,-50%)',
          opacity: open > 0 ? 1 : 0,
        }}
      />
      <Grain opacity={0.06 * (1 - open)} />
    </AbsoluteFill>
  );
};
