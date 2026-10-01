import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, keyframes, pop, ramp} from '../anim';
import {LightBackdrop} from '../mg/Backdrop';
import {Ribbon, Sticker} from '../mg/Ribbon';
import {Spark} from '../mg/Spark';
import {ChatWindow} from '../mg/UI';
import {C} from '../theme';

// Ventana de chat enmarcada por una cinta en espiral con texto
// (equivale a la foto rodeada por la cinta verde de la referencia).
export const S6_DURATION = 144;

const LOOP =
  'M 380 -90 C 320 420, 420 970, 1000 955 C 1500 945, 1720 800, 1700 520 C 1690 300, 1500 190, 1410 320 C 1330 450, 1560 560, 1770 470 C 1900 410, 1960 320, 2060 290';

export const S6Frame: React.FC = () => {
  const f = useCurrentFrame();
  const cardIn = ramp(f, 0, 16, [0, 1], EASE_OUT);
  const head = ramp(f, 2, 46, [0, 1], EASE_IN_OUT);
  const zoom = keyframes(f, [0, 144], [1, 1.06], (t) => t);

  return (
    <LightBackdrop
      orbs={[
        {x: 1700, y: 980, r: 520, color: 'rgba(251,227,184,0.95)', drift: 40},
        {x: 160, y: 200, r: 460, color: 'rgba(246,205,178,0.8)', drift: 50},
      ]}
    >
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 250,
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * 60}px) scale(${0.92 + 0.08 * cardIn})`,
          }}
        >
          <ChatWindow w={1080} h={620} dark={false} p={ramp(f, 14, 128, [0, 1], (t) => t)} />
        </div>

        <Ribbon
          id="loop"
          d={LOOP}
          width={78}
          head={head}
          from={[380, 0]}
          to={[1900, 700]}
          text="Sin ruido  ·  Sin esperas  ·  Solo respuestas útiles  ·  Sin ruido  ·  Sin esperas"
          textSize={30}
          textOffset={keyframes(f, [10, 144], [80, -420], (t) => t)}
          textOpacity={ramp(f, 20, 34)}
        />

        {[
          {x: 1240, y: 160, icon: 'bulb' as const, at: 22},
          {x: 250, y: 560, icon: 'chat' as const, at: 30},
          {x: 1820, y: 700, icon: 'code' as const, at: 38},
        ].map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y + Math.sin((f + i * 17) / 15) * 12,
              transform: `translate(-50%,-50%) scale(${pop(f, s.at)}) rotate(${Math.sin((f + i * 9) / 20) * 8}deg)`,
            }}
          >
            <Sticker size={104} icon={s.icon} />
          </div>
        ))}
        <div style={{position: 'absolute', left: 1800, top: 900, transform: `translate(-50%,-50%) scale(${pop(f, 46)})`}}>
          <Spark size={70} color={C.clay} glow={null} rotate={f * 3} />
        </div>
      </AbsoluteFill>
    </LightBackdrop>
  );
};
