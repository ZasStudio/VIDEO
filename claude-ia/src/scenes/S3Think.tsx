import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_IN_OUT, keyframes, pop, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {glass} from '../mg/UI';
import {C} from '../theme';

// "¿Y si esto pudiera [pensar] contigo?" — cuadro de vidrio con la chispa dentro y un haz de luz.
// Al final la chispa florece abajo a la izquierda y sale disparada como una estela.
export const S3_DURATION = 108;

export const S3Think: React.FC = () => {
  const f = useCurrentFrame();
  const boxIn = pop(f, 2, {damping: 13});
  const toDiamond = ramp(f, 74, 92, [0, 1], EASE_IN_OUT);
  const boxRot = keyframes(f, [0, 74], [-24, 10]) + toDiamond * 35;
  const boxX = 1180 + toDiamond * 120;
  const boxScale = boxIn * (1 - 0.45 * toDiamond);
  const boxFill = 1 - toDiamond;

  // chispa: dentro del cuadro -> florece abajo a la izquierda -> estela
  const leave = ramp(f, 78, 92, [0, 1], EASE_IN_OUT);
  const spX = boxX + (330 - boxX) * leave;
  const spY = 540 + (880 - 540) * leave;
  const spSize = 120 + 200 * leave;
  const streak = ramp(f, 92, 106, [0, 1], EASE_IN);

  const beam = ramp(f, 6, 30) * (1 - ramp(f, 86, 100));

  return (
    <DarkBackdrop
      orbs={[
        {x: 1620, y: 150, r: 300, color: 'rgba(217,119,87,0.9)', drift: 20, speed: 0.08},
        {x: 1300, y: 760, r: 560, color: 'rgba(242,166,90,0.45)', drift: 60},
        {x: 380, y: 520, r: 640, color: 'rgba(160,70,38,0.35)', kind: 'ring', drift: 50},
        {x: 300, y: 1000, r: 380, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      {/* Haz de luz diagonal */}
      <div
        style={{
          position: 'absolute',
          left: 1080,
          top: -260,
          width: 360,
          height: 1200,
          transform: 'rotate(38deg)',
          background: `linear-gradient(180deg, transparent 0%, ${C.amber}66 45%, ${C.coral}33 75%, transparent 100%)`,
          filter: 'blur(40px)',
          opacity: beam,
        }}
      />

      {/* Cuadro de vidrio */}
      <div
        style={{
          position: 'absolute',
          left: boxX - 170,
          top: 540 - 170,
          width: 340,
          height: 340,
          transform: `perspective(1200px) rotateY(${18 - f * 0.25}deg) rotate(${boxRot}deg) scale(${boxScale})`,
          ...glass(true, 1.6),
          borderRadius: 44,
          border: `3px solid ${C.amber}`,
          background: `linear-gradient(150deg, rgba(255,200,160,${0.22 * boxFill}), rgba(217,119,87,${0.1 * boxFill}))`,
          boxShadow: `0 0 30px ${C.coral}, 0 0 80px ${C.coral}66, inset 0 0 40px rgba(255,180,138,${0.3 * boxFill})`,
        }}
      />

      {/* Chispa */}
      <div
        style={{
          position: 'absolute',
          left: spX + streak * 1900,
          top: spY - streak * 340,
          transform: `translate(-50%,-50%) scaleX(${1 + streak * 4}) scaleY(${1 - streak * 0.75})`,
          opacity: ramp(f, 4, 12),
        }}
      >
        <Spark size={spSize * boxIn} rotate={f * 3} glow={C.coral} bloom={1 - streak * 0.6} />
      </div>

      {/* Texto */}
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 120, top: 830}}>
          <Line
            size={66}
            seed={5}
            segs={[
              {text: '¿Y si esto', at: 16, weight: 500, out: 78},
              {text: ' pudiera ', at: 28, weight: 500, out: 80},
              {text: 'pensar', at: 40, weight: 800, color: C.glow, mode: 'rise', select: {at: 52}, out: 82},
              {text: ' contigo?', at: 54, weight: 500, out: 84},
            ]}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: C.ink, opacity: ramp(f, 98, 108, [0, 0.85], EASE_IN)}} />
    </DarkBackdrop>
  );
};
