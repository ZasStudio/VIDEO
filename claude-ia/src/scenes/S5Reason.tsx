import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, appear, keyframes, ramp} from '../anim';
import {LightBackdrop} from '../mg/Backdrop';
import {Ribbon, Sticker} from '../mg/Ribbon';
import {Spark} from '../mg/Spark';
import {C, FONT} from '../theme';

// Sección clara: "RAZONA" con ecos apilados -> "CLARIDAD" gigante de fondo y una cinta
// que se dibuja con la palabra "claridad", y luego nada en "S" atravesando la pantalla.
export const S5_DURATION = 216;

const WAVE = 'M -140 360 C 420 80, 1040 260, 860 700 S 120 1080, 260 1380 S 980 1560, 1240 1880';
const WORD_Y = 880;
const WORD_X = 80;

export const S5Reason: React.FC = () => {
  const f = useCurrentFrame();

  const circY = keyframes(f, [0, 90], [260, 520], EASE_OUT);
  const circO = 1 - ramp(f, 96, 112);
  const spX = keyframes(f, [0, 34], [1000, WORD_X - 10], EASE_IN_OUT);
  const spY = keyframes(f, [0, 34], [600, WORD_Y + 105], EASE_IN_OUT);
  const word = ramp(f, 30, 46, [0, 1], EASE_IN_OUT);
  const wordOut = ramp(f, 94, 108, [0, 1], EASE_IN_OUT);
  const echo = (k: number) => ramp(f, 40 + Math.abs(k) * 4, 54 + Math.abs(k) * 4);
  const scroll = f * 0.7;

  const big = ramp(f, 100, 120) * (1 - ramp(f, 196, 214));
  const head = ramp(f, 104, 176, [0, 1], EASE_IN_OUT);
  const tail = ramp(f, 150, 214, [0, 1], EASE_IN_OUT);
  const stickerOut = 1 - ramp(f, 190, 204, [0, 1], EASE_IN_OUT);

  return (
    <LightBackdrop
      orbs={[
        {x: 180, y: 600, r: 560, color: 'rgba(246,205,178,0.85)', drift: 40},
        {x: 960, y: 200, r: 500, color: 'rgba(251,227,184,0.95)', drift: 50},
        {x: 900, y: 1760, r: 560, color: 'rgba(246,205,178,0.7)', drift: 60},
      ]}
    >
      {/* Círculo pálido con contorno fino */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 380,
          top: circY - 380,
          width: 760,
          height: 760,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, rgba(255,240,228,0.9), rgba(246,205,178,0.75))',
          border: `2px solid ${C.line}`,
          opacity: circO,
          boxShadow: '0 30px 80px rgba(194,96,58,0.12)',
        }}
      />

      {/* Ecos apilados + palabra principal */}
      <AbsoluteFill style={{opacity: 1 - wordOut, translate: `0px ${-wordOut * 120}px`}}>
        {[-4, -3, -2, -1, 1, 2, 3, 4].map((k) => (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: WORD_X,
              top: WORD_Y + k * 200 - scroll * Math.sign(k),
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 220,
              letterSpacing: '-0.03em',
              color: 'transparent',
              WebkitTextStroke: `2.5px rgba(194,96,58,${0.34 - Math.abs(k) * 0.065})`,
              opacity: echo(k),
              lineHeight: 1,
            }}
          >
            RAZONA
          </div>
        ))}
        <div
          style={{
            position: 'absolute',
            left: WORD_X,
            top: WORD_Y,
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: 220,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: C.clay,
            clipPath: `inset(-20% ${100 - word * 100}% -20% 0)`,
          }}
        >
          RAZONA
        </div>
      </AbsoluteFill>

      {/* Chispa oscura que "escribe" la palabra */}
      <div
        style={{
          position: 'absolute',
          left: spX + word * 900,
          top: spY,
          translate: '-50% -50%',
          scale: String(1 - 0.9 * ramp(f, 46, 56, [0, 1], EASE_IN_OUT)),
          opacity: 1 - ramp(f, 50, 56),
        }}
      >
        <Spark size={90} color={C.cocoa} glow={null} rotate={f * 6} />
      </div>

      {/* CLARIDAD gigante de fondo */}
      <AbsoluteFill style={{opacity: big}}>
        {[0, 1, 2, 3, 4].map((k) => (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: -260 + (k % 2) * 200 + (k % 2 ? 1 : -1) * f * 1.5,
              top: 40 + k * 380,
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 300,
              letterSpacing: '-0.03em',
              color: `rgba(194,96,58,${0.085 - k * 0.01})`,
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
        width={110}
        head={head}
        tail={tail}
        from={[0, 300]}
        to={[1080, 1800]}
        text="claridad  ·  contexto  ·  criterio"
        textSize={44}
        textOffset={keyframes(f, [104, 214], [-200, 2600], (t) => t)}
        textOpacity={ramp(f, 118, 128)}
      />

      {[
        {x: 870, y: 420, icon: 'bulb' as const, at: 120},
        {x: 200, y: 1540, icon: 'pen' as const, at: 134},
      ].map((s, i) => {
        const a = appear(f, s.at);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y + Math.sin((f + i * 20) / 14) * 12,
              translate: '-50% -50%',
              opacity: a.opacity * stickerOut,
              scale: String(Number(a.scale) * (0.85 + 0.15 * stickerOut)),
            }}
          >
            <Sticker size={124} icon={s.icon} />
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 900,
          top: 1180,
          translate: '-50% -50%',
          opacity: appear(f, 142).opacity * stickerOut,
          scale: appear(f, 142).scale,
        }}
      >
        <Spark size={84} color={C.cocoa} glow={null} rotate={f * 3} />
      </div>
    </LightBackdrop>
  );
};
