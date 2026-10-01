import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_IN_OUT, EASE_OUT, appear, keyframes, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {motionBlur} from '../mg/Blur';
import {Cursor, Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C, FONT} from '../theme';

// 0:00 — "Todo empieza / con una [pregunta]". La pastilla se colapsa en la chispa,
// que vuela al centro, dibuja un anillo y este se expande hacia la escena 2.
export const S1_DURATION = 144;

const ROW1_Y = 800;
const ROW2_Y = 950;
const TEXT_RIGHT = 470;
const CHIP_X = 490;
const CHIP_W = 480;
const CHIP_H = 110;
const CX = 540;
const CY = 960;

export const S1Spark: React.FC = () => {
  const f = useCurrentFrame();

  const grow = ramp(f, 40, 58) * (1 - ramp(f, 92, 104, [0, 1], EASE_IN_OUT));
  const chipW = 110 + (CHIP_W - 110) * grow;
  const chipOn = ramp(f, 38, 44) * (1 - ramp(f, 100, 106));
  const press = 1 - 0.06 * Math.sin(Math.PI * ramp(f, 78, 86, [0, 1], EASE_IN_OUT));

  // Chispa: dentro de la pastilla -> vuela al centro en arco -> se queda en el anillo
  const sx0 = CHIP_X + chipW - CHIP_H / 2;
  const fly = ramp(f, 98, 118, [0, 1], EASE_IN_OUT);
  const sx = sx0 + (CX - sx0) * fly;
  const sy = ROW2_Y + (CY - ROW2_Y) * fly - Math.sin(Math.PI * fly) * 220;
  const flySpeed = Math.sin(Math.PI * fly);
  const sSize = 70 + 70 * fly + 40 * ramp(f, 118, 128) - 80 * ramp(f, 128, 144, [0, 1], EASE_IN);
  const sparkIn = appear(f, 40);

  // Anillo central
  const ringDraw = ramp(f, 106, 128);
  const ringScale = keyframes(f, [126, 144], [1, 12], EASE_IN);
  const ringOpacity = 1 - ramp(f, 136, 144);

  // Puntero
  const cx = keyframes(f, [52, 78], [960, sx0 + 4], EASE_OUT);
  const cy = keyframes(f, [52, 78], [1500, ROW2_Y + 22], EASE_OUT);
  const cursorOn = ramp(f, 50, 58) * (1 - ramp(f, 90, 98));

  const out = 92;
  const drift = f * -0.8;

  return (
    <DarkBackdrop
      offsetY={drift}
      orbs={[
        {x: 160, y: 1640, r: 760, color: 'rgba(242,166,90,0.55)', kind: 'ring', drift: 40},
        {x: 900, y: 320, r: 620, color: 'rgba(217,119,87,0.38)', drift: 80},
        {x: 980, y: 1800, r: 520, color: 'rgba(138,58,32,0.55)', drift: 50},
        {x: 300, y: 260, r: 420, color: 'rgba(90,40,22,0.6)', drift: 60},
      ]}
    >
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 0, right: 0, top: ROW1_Y - 70, textAlign: 'center'}}>
          <Line
            size={112}
            seed={1}
            segs={[
              {text: 'Todo', at: 6, weight: 800, color: C.glow, out},
              {text: ' empieza', at: 14, weight: 500, out: out + 3},
            ]}
          />
        </div>
        <div style={{position: 'absolute', right: 1080 - TEXT_RIGHT, top: ROW2_Y - 64}}>
          <Line
            size={104}
            seed={11}
            segs={[
              {text: 'con', at: 24, weight: 500, out: out + 6},
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
          top: ROW2_Y - CHIP_H / 2 + 6,
          width: chipW,
          height: CHIP_H,
          borderRadius: CHIP_H / 2,
          opacity: chipOn,
          scale: String(press),
          transformOrigin: 'left center',
          background: `linear-gradient(90deg, rgba(217,119,87,0.25) 0%, ${C.coral} 55%, ${C.amber} 100%)`,
          boxShadow: `0 0 50px ${C.coral}AA, inset 0 1px 0 rgba(255,240,230,0.6)`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 40,
          fontFamily: FONT.sans,
        }}
      >
        <Line size={66} seed={2} segs={[{text: 'pregunta', at: 50, speed: 2.2, weight: 700, color: C.white, out: 90}]} />
      </div>
      {/* Reflejo tenue debajo, como el "Spark" fantasma de la referencia */}
      <div
        style={{
          position: 'absolute',
          left: CHIP_X + 40,
          top: ROW2_Y + 74,
          opacity: 0.16 * chipOn,
          filter: 'blur(2px)',
          transform: 'scaleY(-0.6)',
          transformOrigin: 'top',
        }}
      >
        <Line size={66} seed={2} segs={[{text: 'pregunta', at: 50, speed: 2.2, weight: 700, color: C.glow, out: 90}]} />
      </div>

      {/* Anillo */}
      <svg
        width={1080}
        height={1920}
        style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: ringDraw > 0.01 ? ringOpacity : 0}}
      >
        <circle
          cx={CX}
          cy={CY}
          r={110 * ringScale}
          fill="none"
          stroke={C.amber}
          strokeWidth={26 / Math.sqrt(ringScale)}
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 110 * ringScale * ringDraw} 99999`}
          transform={`rotate(-100 ${CX} ${CY})`}
          style={{filter: `drop-shadow(0 0 14px ${C.coral}) drop-shadow(0 0 40px ${C.coral})`}}
        />
      </svg>

      {/* Chispa (con desenfoque de movimiento durante el vuelo) */}
      <div
        style={{
          position: 'absolute',
          left: sx,
          top: sy,
          translate: '-50% -50%',
          opacity: sparkIn.opacity * (1 - ramp(f, 136, 144)),
          scale: sparkIn.scale,
          filter: motionBlur(flySpeed * 0.7, 'x'),
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
          scale: String(1 - 0.18 * Math.sin(Math.PI * ramp(f, 78, 86))),
        }}
      >
        <Cursor size={58} />
      </div>
    </DarkBackdrop>
  );
};
