import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_IN_OUT, EASE_OUT, keyframes, pop, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Cursor, Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C, FONT} from '../theme';

// 0:00 — "Todo empieza con una [pregunta]". La pastilla se colapsa en la chispa,
// que vuela al centro, dibuja un anillo y este se expande hacia la escena 2.
export const S1_DURATION = 144;

const ROW_Y = 540;
const TEXT_RIGHT = 1180;
const CHIP_X = 1196;
const CHIP_W = 330;
const CHIP_H = 82;

export const S1Spark: React.FC = () => {
  const f = useCurrentFrame();

  const grow = ramp(f, 40, 58) * (1 - ramp(f, 92, 104, [0, 1], EASE_IN));
  const chipW = 90 + (CHIP_W - 90) * grow;
  const chipOn = ramp(f, 38, 44) * (1 - ramp(f, 100, 106));
  const press = 1 - 0.08 * Math.sin(Math.PI * ramp(f, 78, 86, [0, 1], EASE_IN_OUT));

  // Chispa: dentro de la pastilla -> vuela al centro -> se queda en el anillo
  const sx0 = CHIP_X + chipW - CHIP_H / 2;
  const fly = ramp(f, 98, 118, [0, 1], EASE_IN_OUT);
  const sx = sx0 + (960 - sx0) * fly;
  const sy = ROW_Y - Math.sin(Math.PI * fly) * 140 + (540 - ROW_Y) * fly;
  const sSize = 52 + 58 * fly + 30 * ramp(f, 118, 128) - 60 * ramp(f, 128, 144, [0, 1], EASE_IN);
  const sparkIn = pop(f, 40);

  // Anillo central
  const ringDraw = ramp(f, 106, 128);
  const ringScale = keyframes(f, [126, 144], [1, 6.5], EASE_IN);
  const ringOpacity = 1 - ramp(f, 134, 144);

  // Puntero
  const cx = keyframes(f, [52, 78], [1640, sx0 + 4], EASE_OUT);
  const cy = keyframes(f, [52, 78], [900, ROW_Y + 18], EASE_OUT);
  const cursorOn = ramp(f, 50, 58) * (1 - ramp(f, 90, 98));

  const out = 92;
  const drift = f * -0.8;

  return (
    <DarkBackdrop
      offsetY={drift}
      orbs={[
        {x: 330, y: 1020, r: 620, color: 'rgba(242,166,90,0.55)', kind: 'ring', drift: 40},
        {x: 1450, y: 180, r: 520, color: 'rgba(217,119,87,0.38)', drift: 80},
        {x: 1780, y: 980, r: 460, color: 'rgba(138,58,32,0.55)', drift: 50},
        {x: 860, y: 120, r: 380, color: 'rgba(90,40,22,0.6)', drift: 60},
      ]}
    >
      {/* Texto alineado a la derecha para que la pastilla crezca hacia la derecha */}
      <AbsoluteFill>
        <div style={{position: 'absolute', right: 1920 - TEXT_RIGHT, top: ROW_Y - 46}}>
          <Line
            size={78}
            seed={1}
            segs={[
              {text: 'Todo', at: 6, weight: 800, color: C.glow, out},
              {text: ' empieza', at: 14, weight: 500, out: out + 3},
              {text: ' con', at: 24, weight: 500, out: out + 6},
              {text: ' una', at: 30, weight: 500, out: out + 8},
            ]}
          />
        </div>
      </AbsoluteFill>

      {/* Pastilla "pregunta" */}
      <div
        style={{
          position: 'absolute',
          left: CHIP_X,
          top: ROW_Y - CHIP_H / 2 + 4,
          width: chipW,
          height: CHIP_H,
          borderRadius: CHIP_H / 2,
          opacity: chipOn,
          transform: `scale(${press})`,
          transformOrigin: 'left center',
          background: `linear-gradient(90deg, rgba(217,119,87,0.25) 0%, ${C.coral} 55%, ${C.amber} 100%)`,
          boxShadow: `0 0 40px ${C.coral}AA, inset 0 1px 0 rgba(255,240,230,0.6)`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 34,
          fontFamily: FONT.sans,
          fontWeight: 700,
          fontSize: 50,
          color: C.white,
        }}
      >
        <Line size={50} seed={2} segs={[{text: 'pregunta', at: 50, speed: 2.2, weight: 700, color: C.white, out: 90}]} />
      </div>
      {/* Reflejo tenue debajo, como el "Spark" fantasma de la referencia */}
      <div
        style={{
          position: 'absolute',
          left: CHIP_X + 34,
          top: ROW_Y + 56,
          opacity: 0.18 * chipOn,
          filter: 'blur(2px)',
          transform: 'scaleY(-0.6)',
          transformOrigin: 'top',
        }}
      >
        <Line size={50} seed={2} segs={[{text: 'pregunta', at: 50, speed: 2.2, weight: 700, color: C.glow, out: 90}]} />
      </div>

      {/* Anillo */}
      <svg
        width={1920}
        height={1080}
        style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: ringDraw > 0.01 ? ringOpacity : 0}}
      >
        <circle
          cx={960}
          cy={540}
          r={92 * ringScale}
          fill="none"
          stroke={C.amber}
          strokeWidth={22 / Math.sqrt(ringScale)}
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 92 * ringScale * ringDraw} 99999`}
          transform="rotate(-100 960 540)"
          style={{filter: `drop-shadow(0 0 14px ${C.coral}) drop-shadow(0 0 40px ${C.coral})`}}
        />
      </svg>

      {/* Chispa */}
      <div
        style={{
          position: 'absolute',
          left: sx,
          top: sy,
          transform: `translate(-50%, -50%) scale(${sparkIn})`,
          opacity: 1 - ramp(f, 136, 144),
        }}
      >
        <Spark size={Math.max(sSize, 1)} rotate={f * 4} glow={C.coral} />
      </div>

      {/* Puntero */}
      <div
        style={{
          position: 'absolute',
          left: cx,
          top: cy,
          opacity: cursorOn,
          transform: `scale(${1 - 0.18 * Math.sin(Math.PI * ramp(f, 78, 86))})`,
        }}
      >
        <Cursor size={46} />
      </div>
    </DarkBackdrop>
  );
};
