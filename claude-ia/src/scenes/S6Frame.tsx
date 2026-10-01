import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, appear, keyframes, ramp} from '../anim';
import {LightBackdrop} from '../mg/Backdrop';
import {Ribbon, Sticker} from '../mg/Ribbon';
import {Spark} from '../mg/Spark';
import {ChatWindow} from '../mg/UI';
import {C} from '../theme';

// Ventana de chat enmarcada por una cinta en espiral con texto
// (equivale a la foto rodeada por la cinta verde de la referencia).
export const S6_DURATION = 144;

const LOOP =
  'M 30 -100 C -20 640, 40 1700, 560 1680 C 1020 1660, 1120 1340, 1070 1000 C 1040 760, 860 650, 800 800 C 740 960, 980 1060, 1200 960';

export const S6Frame: React.FC = () => {
  const f = useCurrentFrame();
  const cardIn = ramp(f, 0, 16, [0, 1], EASE_OUT);
  const head = ramp(f, 2, 46, [0, 1], EASE_IN_OUT);
  const zoom = keyframes(f, [0, 144], [1, 1.06], (t) => t);

  return (
    <LightBackdrop
      orbs={[
        {x: 900, y: 1800, r: 560, color: 'rgba(251,227,184,0.95)', drift: 40},
        {x: 120, y: 260, r: 520, color: 'rgba(246,205,178,0.8)', drift: 50},
      ]}
    >
      <AbsoluteFill style={{scale: String(zoom)}}>
        <div
          style={{
            position: 'absolute',
            left: 110,
            top: 380,
            opacity: cardIn,
            translate: `0px ${(1 - cardIn) * 80}px`,
            scale: String(0.94 + 0.06 * cardIn),
          }}
        >
          <ChatWindow w={860} h={1120} dark={false} p={ramp(f, 14, 128, [0, 1], (t) => t)} />
        </div>

        <Ribbon
          id="loop"
          d={LOOP}
          width={96}
          head={head}
          from={[0, 0]}
          to={[1080, 1700]}
          text="Sin ruido  ·  Sin esperas  ·  Solo respuestas útiles  ·  Sin ruido  ·  Sin esperas  ·  Solo respuestas útiles"
          textSize={38}
          textOffset={keyframes(f, [10, 144], [80, -520], (t) => t)}
          textOpacity={ramp(f, 20, 34)}
        />

        {[
          {x: 840, y: 270, icon: 'bulb' as const, at: 22},
          {x: 250, y: 1780, icon: 'chat' as const, at: 30},
          {x: 960, y: 1560, icon: 'code' as const, at: 38},
        ].map((s, i) => {
          const a = appear(f, s.at);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: s.x,
                top: s.y + Math.sin((f + i * 17) / 15) * 14,
                translate: '-50% -50%',
                opacity: a.opacity,
                scale: a.scale,
                rotate: `${Math.sin((f + i * 9) / 20) * 8}deg`,
              }}
            >
              <Sticker size={128} icon={s.icon} />
            </div>
          );
        })}
        <div style={{position: 'absolute', left: 140, top: 250, translate: '-50% -50%', ...appear(f, 46)}}>
          <Spark size={84} color={C.clay} glow={null} rotate={f * 3} />
        </div>
      </AbsoluteFill>
    </LightBackdrop>
  );
};
