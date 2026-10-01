import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, keyframes, ramp} from '../anim';
import {BlurDefs, motionBlur} from '../mg/Blur';
import {Bleed, Grain} from '../mg/Backdrop';
import {CollabCursor} from '../mg/CollabCursor';
import {Line} from '../mg/Text';
import {C} from '../theme';

// "Crea / juntos" — basada en la referencia "Design together": fondo negro con un brillo
// naranja granulado y un borde celeste, caja de selección tipo Figma y dos cursores con nombre.
// "juntos" entra letra por letra desde la derecha con desenfoque de movimiento.
export const SJ_DURATION = 144;

const TEXT = '#ECEAE6';

export const SJTogether: React.FC = () => {
  const f = useCurrentFrame();
  const cam = keyframes(f, [0, 144], [1.06, 1], (t) => t);

  // Cursor "Tú": entra desde abajo a la izquierda, se queda junto a "Crea" y luego baja
  const youX = keyframes(f, [8, 28, 84, 104], [-160, 170, 170, 210], EASE_OUT);
  const youY = keyframes(f, [8, 28, 84, 104], [1560, 975, 975, 1250], EASE_OUT);
  const youV = 1 - ramp(f, 8, 28, [0, 1], EASE_OUT);

  // Cursor "Claude": entra por la derecha, va a "juntos" y hace clic (mueve la selección)
  const clX = keyframes(f, [30, 50, 62, 74], [1300, 860, 860, 800], EASE_IN_OUT);
  const clY = keyframes(f, [30, 50, 62, 74], [1600, 1330, 1330, 1250], EASE_IN_OUT);
  const clV = 1 - ramp(f, 30, 50, [0, 1], EASE_OUT);
  const click = Math.sin(Math.PI * ramp(f, 74, 82));

  const idle = (k: number) => ({x: Math.sin((f + k) / 17) * 8, y: Math.cos((f + k) / 21) * 6});

  return (
    <AbsoluteFill>
      <Bleed background="#060303" />
      <BlurDefs />
      <AbsoluteFill style={{scale: String(cam)}}>
        {/* Brillo naranja abajo a la izquierda */}
        <div
          style={{
            position: 'absolute',
            left: -520,
            top: 1260,
            width: 1300,
            height: 1100,
            borderRadius: '50%',
            background: `radial-gradient(ellipse at 50% 50%, ${C.you} 0%, #9A3412 38%, rgba(60,16,6,0.6) 60%, transparent 72%)`,
            filter: 'blur(30px)',
            opacity: ramp(f, 0, 14),
          }}
        />
        {/* "Pantalla" a la derecha: relleno naranja difuso + borde celeste */}
        <div
          style={{
            position: 'absolute',
            left: 700,
            top: -260,
            width: 980,
            height: 1700,
            borderRadius: 180,
            rotate: `${keyframes(f, [0, 144], [10, 7])}deg`,
            background: `radial-gradient(ellipse at 18% 55%, ${C.you} 0%, #B4401A 28%, rgba(80,22,8,0.5) 55%, transparent 75%)`,
            boxShadow: `inset 0 0 0 10px ${C.sky}, 0 0 70px ${C.sky}66, inset 0 0 80px ${C.sky}55`,
            filter: 'blur(5px)',
            opacity: 0.95 * ramp(f, 0, 16),
          }}
        />
        <AbsoluteFill
          style={{background: 'radial-gradient(ellipse at 45% 45%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, transparent 70%)'}}
        />

        {/* Texto */}
        <div style={{position: 'absolute', left: 120, top: 700}}>
          <Line
            size={210}
            seed={50}
            tracking={-0.03}
            segs={[
              {
                text: 'Crea',
                at: 6,
                weight: 500,
                color: TEXT,
                mode: 'rise',
                speed: 1.6,
                select: {at: 16, out: 72, color: C.claudeBlue, variant: 'figma'},
              },
            ]}
          />
        </div>
        <div style={{position: 'absolute', left: 250, top: 940}}>
          <Line
            size={210}
            seed={51}
            tracking={-0.03}
            segs={[
              {
                text: 'juntos',
                at: 26,
                weight: 500,
                color: TEXT,
                mode: 'slide',
                speed: 2.4,
                select: {at: 78, color: C.claudeBlue, variant: 'figma'},
              },
            ]}
          />
        </div>
        <div style={{position: 'absolute', left: 124, top: 1430}}>
          <Line
            size={54}
            seed={52}
            segs={[
              {text: 'Tú propones. ', at: 96, weight: 500, color: 'rgba(236,234,230,0.7)', speed: 1},
              {text: 'Claude construye.', at: 108, weight: 700, color: TEXT, speed: 1},
            ]}
          />
        </div>

        {/* Cursores */}
        <div
          style={{
            position: 'absolute',
            left: youX + idle(0).x,
            top: youY + idle(0).y,
            opacity: ramp(f, 8, 14),
            filter: motionBlur(youV * 0.6, 'x'),
          }}
        >
          <CollabCursor name="Tú" color={C.you} side="left" />
        </div>
        <div
          style={{
            position: 'absolute',
            left: clX + idle(40).x,
            top: clY + idle(40).y,
            opacity: ramp(f, 30, 36),
            filter: motionBlur(clV * 0.6, 'x'),
          }}
        >
          <CollabCursor name="Claude" color={C.claudeBlue} side="right" press={click} />
        </div>
      </AbsoluteFill>
      <Grain opacity={0.13} />
    </AbsoluteFill>
  );
};
