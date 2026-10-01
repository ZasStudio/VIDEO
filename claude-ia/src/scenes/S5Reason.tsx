import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_IN_OUT, EASE_OUT, keyframes, pop, ramp} from '../anim';
import {LightBackdrop} from '../mg/Backdrop';
import {Ribbon, Sticker} from '../mg/Ribbon';
import {Spark} from '../mg/Spark';
import {C, FONT} from '../theme';

// Sección clara: "RAZONA" con ecos apilados -> "CLARIDAD" gigante de fondo y una cinta
// que se dibuja con la palabra "claridad", y luego nada en "S" atravesando la pantalla.
export const S5_DURATION = 216;

const WAVE =
  'M -120 260 C 260 60, 720 80, 820 380 S 640 920, 1060 930 S 1640 640, 2080 760';

export const S5Reason: React.FC = () => {
  const f = useCurrentFrame();

  const circX = keyframes(f, [0, 90], [170, 470], EASE_OUT);
  const circO = 1 - ramp(f, 96, 112);
  const spX = keyframes(f, [0, 34], [1760, 690], EASE_IN_OUT);
  const spY = keyframes(f, [0, 34], [500, 560], EASE_IN_OUT);
  const word = ramp(f, 30, 44);
  const wordOut = ramp(f, 94, 108, [0, 1], EASE_IN);
  const echo = (k: number) => ramp(f, 40 + Math.abs(k) * 4, 54 + Math.abs(k) * 4);
  const scroll = f * 0.6;

  const big = ramp(f, 100, 120) * (1 - ramp(f, 196, 214));
  const head = ramp(f, 104, 176, [0, 1], EASE_IN_OUT);
  const tail = ramp(f, 150, 214, [0, 1], EASE_IN);

  return (
    <LightBackdrop
      orbs={[
        {x: 260, y: 520, r: 520, color: 'rgba(246,205,178,0.85)', drift: 40},
        {x: 1640, y: 120, r: 460, color: 'rgba(251,227,184,0.95)', drift: 50},
        {x: 1500, y: 1040, r: 480, color: 'rgba(246,205,178,0.7)', drift: 60},
      ]}
    >
      {/* Círculo pálido con contorno fino */}
      <div
        style={{
          position: 'absolute',
          left: circX - 330,
          top: 540 - 330,
          width: 660,
          height: 660,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, rgba(255,240,228,0.9), rgba(246,205,178,0.75))',
          border: `2px solid ${C.line}`,
          opacity: circO,
          boxShadow: '0 30px 80px rgba(194,96,58,0.12)',
        }}
      />

      {/* Ecos apilados + palabra principal */}
      <AbsoluteFill style={{opacity: 1 - wordOut, transform: `translateY(${-wordOut * 80}px)`}}>
        {[-3, -2, -1, 1, 2, 3].map((k) => (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: 760,
              top: 470 + k * 150 - scroll * Math.sign(k),
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 170,
              letterSpacing: '-0.02em',
              color: 'transparent',
              WebkitTextStroke: `2px rgba(194,96,58,${0.32 - Math.abs(k) * 0.07})`,
              opacity: echo(k),
              lineHeight: 1,
            }}
          >
            RAZONA
          </div>
        ))}
        <div style={{position: 'absolute', left: 760, top: 470, lineHeight: 1}}>
          <div
            style={{
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 170,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: C.clay,
              clipPath: `inset(-20% ${100 - word * 100}% -20% 0)`,
            }}
          >
            RAZONA
          </div>
        </div>
      </AbsoluteFill>

      {/* Chispa oscura que "escribe" la palabra */}
      <div
        style={{
          position: 'absolute',
          left: spX + word * 640,
          top: spY,
          transform: `translate(-50%,-50%) scale(${1 - ramp(f, 44, 54)})`,
        }}
      >
        <Spark size={70} color={C.cocoa} glow={null} rotate={f * 6} />
      </div>

      {/* CLARIDAD gigante de fondo */}
      <AbsoluteFill style={{opacity: big}}>
        {[0, 1, 2].map((k) => (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: -200 + k * 260 - f * 1.4,
              top: 40 + k * 330,
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 280,
              letterSpacing: '-0.02em',
              color: `rgba(194,96,58,${0.09 - k * 0.015})`,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            CLARIDAD
          </div>
        ))}
      </AbsoluteFill>

      <Ribbon
        id="wave"
        d={WAVE}
        width={86}
        head={head}
        tail={tail}
        from={[0, 300]}
        to={[1920, 800]}
        text="claridad  ·  contexto  ·  criterio"
        textSize={36}
        textOffset={keyframes(f, [104, 214], [-200, 2400], (t) => t)}
        textOpacity={ramp(f, 118, 128)}
      />

      {[
        {x: 1220, y: 300, icon: 'bulb' as const, at: 120},
        {x: 520, y: 760, icon: 'pen' as const, at: 134},
      ].map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y + Math.sin((f + i * 20) / 14) * 10,
            transform: `translate(-50%,-50%) scale(${pop(f, s.at) * (1 - ramp(f, 190, 204, [0, 1], EASE_IN))})`,
          }}
        >
          <Sticker size={96} icon={s.icon} />
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 1600,
          top: 420,
          transform: `translate(-50%,-50%) scale(${pop(f, 142) * (1 - ramp(f, 192, 204, [0, 1], EASE_IN))})`,
        }}
      >
        <Spark size={64} color={C.cocoa} glow={null} rotate={f * 3} />
      </div>
    </LightBackdrop>
  );
};
