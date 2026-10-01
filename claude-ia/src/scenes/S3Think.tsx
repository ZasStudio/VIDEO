import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_IN_OUT, appear, keyframes, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {glass} from '../mg/UI';
import {C} from '../theme';

// "¿Y si esto / pudiera [pensar] / contigo?" — cuadro de vidrio con la chispa dentro y un haz de luz.
// Al final la chispa florece abajo y sale disparada como una estela (con motion blur real).
export const S3_DURATION = 108;

const BOX = 440;

const Streak: React.FC<{x: number; y: number; size: number; bloom: number}> = ({x, y, size, bloom}) => {
  const f = useCurrentFrame();
  const streak = ramp(f, 92, 106, [0, 1], EASE_IN);
  return (
    <div
      style={{
        position: 'absolute',
        left: x + streak * 1500,
        top: y - streak * 900,
        translate: '-50% -50%',
      }}
    >
      <Spark size={size} rotate={f * 3} glow={C.coral} bloom={bloom * (1 - streak * 0.5)} />
    </div>
  );
};

export const S3Think: React.FC = () => {
  const f = useCurrentFrame();
  const boxIn = appear(f, 2, 0.7);
  const toDiamond = ramp(f, 74, 92, [0, 1], EASE_IN_OUT);
  const boxRot = keyframes(f, [0, 74], [-24, 10]) + toDiamond * 35;
  const boxY = 700 - toDiamond * 60;
  const boxFill = 1 - toDiamond;

  const leave = ramp(f, 78, 92, [0, 1], EASE_IN_OUT);
  const spX = 540 + (230 - 540) * leave;
  const spY = boxY + (1640 - boxY) * leave;
  const spSize = 150 + 230 * leave;

  const beam = ramp(f, 6, 30) * (1 - ramp(f, 86, 100));

  return (
    <DarkBackdrop
      orbs={[
        {x: 920, y: 240, r: 320, color: 'rgba(217,119,87,0.9)', drift: 20, speed: 0.08},
        {x: 700, y: 1000, r: 620, color: 'rgba(242,166,90,0.42)', drift: 60},
        {x: 120, y: 900, r: 700, color: 'rgba(160,70,38,0.35)', kind: 'ring', drift: 50},
        {x: 200, y: 1800, r: 420, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      {/* Haz de luz diagonal */}
      <div
        style={{
          position: 'absolute',
          left: 520,
          top: -300,
          width: 380,
          height: 1500,
          rotate: '32deg',
          background: `linear-gradient(180deg, transparent 0%, ${C.amber}66 45%, ${C.coral}33 75%, transparent 100%)`,
          filter: 'blur(44px)',
          opacity: beam,
        }}
      />

      {/* Cuadro de vidrio */}
      <div
        style={{
          position: 'absolute',
          left: 540 - BOX / 2,
          top: boxY - BOX / 2,
          width: BOX,
          height: BOX,
          opacity: boxIn.opacity,
          transform: `perspective(1200px) rotateY(${18 - f * 0.25}deg) rotate(${boxRot}deg) scale(${Number(boxIn.scale) * (1 - 0.45 * toDiamond)})`,
          ...glass(true, 1.6),
          borderRadius: 56,
          border: `3px solid ${C.amber}`,
          background: `linear-gradient(150deg, rgba(255,200,160,${0.22 * boxFill}), rgba(217,119,87,${0.1 * boxFill}))`,
          boxShadow: `0 0 30px ${C.coral}, 0 0 90px ${C.coral}66, inset 0 0 40px rgba(255,180,138,${0.3 * boxFill})`,
        }}
      />

      {/* Chispa (el motion blur del disparo lo pone el director global) */}
      <div style={{opacity: ramp(f, 4, 12)}}>
        <Streak x={spX} y={spY} size={spSize * (f >= 90 ? 1 : Number(boxIn.scale))} bloom={1} />
      </div>

      {/* Texto */}
      <div style={{position: 'absolute', left: 90, top: 1150}}>
        <Line size={108} seed={5} segs={[{text: '¿Y si esto', at: 16, weight: 500, out: 78}]} />
        <Line
          size={108}
          seed={6}
          style={{marginTop: 10}}
          segs={[
            {text: 'pudiera ', at: 28, weight: 500, out: 80},
            {text: 'pensar', at: 40, weight: 800, color: C.glow, mode: 'rise', select: {at: 52}, out: 82},
          ]}
        />
        <Line size={108} seed={7} style={{marginTop: 10}} segs={[{text: 'contigo?', at: 54, weight: 500, out: 84}]} />
      </div>
      <AbsoluteFill style={{background: C.ink, opacity: ramp(f, 98, 108, [0, 0.85])}} />
    </DarkBackdrop>
  );
};
