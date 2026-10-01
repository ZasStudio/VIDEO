import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_OUT, appear, keyframes, ramp} from '../anim';
import {BlurDefs, motionBlur} from '../mg/Blur';
import {Grain} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {ChatWindow} from '../mg/UI';
import {C} from '../theme';

// "Convirtiendo / [ideas] / en resultados" sobre un chat desenfocado (equivale al metraje
// de la persona frente al monitor). La chispa abre un círculo crema hacia la escena clara.
export const S4_DURATION = 144;

const SPARK_REST = {x: 820, y: 1520};

export const S4Chat: React.FC = () => {
  const f = useCurrentFrame();
  const push = keyframes(f, [0, 144], [1.04, 1.16], (t) => t);
  const sparkX = keyframes(f, [56, 76], [1250, SPARK_REST.x], EASE_OUT);
  const sparkV = 1 - ramp(f, 56, 76, [0, 1], EASE_OUT);
  const bounce = Math.abs(Math.sin(((f - 76) / 22) * Math.PI)) * 40 * (f > 76 ? Math.exp(-(f - 76) / 40) : 0);
  const open = ramp(f, 118, 142, [0, 1], EASE_IN);
  const sIn = appear(f, 56);

  return (
    <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
      <BlurDefs />
      {/* Chat desenfocado de fondo */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${push}) perspective(1600px) rotateY(-12deg) rotateX(4deg)`,
          filter: 'blur(7px) brightness(0.6) saturate(1.1)',
        }}
      >
        <ChatWindow w={980} h={1560} p={ramp(f, 0, 144, [0.15, 1], (t) => t)} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 85% 15%, ${C.amber}40 0%, transparent 45%), radial-gradient(ellipse at 10% 85%, ${C.coral}55 0%, transparent 50%)`,
        }}
      />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(15,10,8,0.2) 0%, rgba(15,10,8,0.75) 45%, rgba(15,10,8,0.3) 100%)'}} />
      {/* Retícula de puntos */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 260,
          width: 860,
          height: 1400,
          backgroundImage: `radial-gradient(circle, ${C.glow} 2.4px, transparent 3px)`,
          backgroundSize: '54px 54px',
          opacity: 0.3 * ramp(f, 10, 40),
          maskImage: 'radial-gradient(ellipse at 60% 50%, black 35%, transparent 70%)',
        }}
      />

      <div style={{position: 'absolute', left: 80, top: 600}}>
        <Line size={128} seed={6} segs={[{text: 'Convirtiendo', at: 8, weight: 400, color: C.glow, speed: 1.2}]} />
        <Line
          size={150}
          seed={7}
          style={{marginTop: 14}}
          segs={[{text: 'ideas', at: 22, weight: 800, color: C.white, mode: 'rise', highlight: {at: 30, textColor: C.white}}]}
        />
        <Line
          size={112}
          seed={8}
          style={{marginTop: 14}}
          segs={[
            {text: 'en ', at: 42, weight: 400},
            {text: 'resultados', at: 48, weight: 800, color: C.glow, speed: 1.4},
          ]}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: sparkX,
          top: SPARK_REST.y - bounce,
          translate: '-50% -50%',
          opacity: sIn.opacity,
          scale: sIn.scale,
          filter: motionBlur(sparkV * 0.8, 'x'),
        }}
      >
        <Spark size={120} rotate={f * 4} />
      </div>

      {/* Círculo crema que se abre desde la chispa */}
      <div
        style={{
          position: 'absolute',
          left: SPARK_REST.x,
          top: SPARK_REST.y,
          width: open * 4400,
          height: open * 4400,
          borderRadius: '50%',
          background: C.cream,
          translate: '-50% -50%',
          opacity: open > 0 ? 1 : 0,
        }}
      />
      <Grain opacity={0.06 * (1 - open)} />
    </AbsoluteFill>
  );
};
