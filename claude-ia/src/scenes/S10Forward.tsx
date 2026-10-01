import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, keyframes, pop, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Sticker} from '../mg/Ribbon';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C} from '../theme';

// "Todo pensado para llevarte más lejos" con un racimo de stickers y chispa.
// Sale con una pastilla crema que entra desde la derecha.
export const S10_DURATION = 108;

export const S10Forward: React.FC = () => {
  const f = useCurrentFrame();
  const pill = keyframes(f, [84, 104], [2100, 1560], EASE_IN_OUT);
  return (
    <DarkBackdrop
      orbs={[
        {x: 420, y: 660, r: 700, color: 'rgba(217,119,87,0.42)', kind: 'ring', drift: 50},
        {x: 1600, y: 200, r: 420, color: 'rgba(242,166,90,0.25)', drift: 40},
        {x: 1500, y: 980, r: 460, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      <div style={{position: 'absolute', left: 140, top: 400}}>
        <Line
          size={84}
          seed={14}
          segs={[
            {text: 'Todo ', at: 4, weight: 400, out: 88},
            {text: 'pensado', at: 12, weight: 800, out: 90},
            {text: ' para', at: 24, weight: 400, out: 92},
          ]}
        />
        <Line
          size={84}
          seed={15}
          style={{marginLeft: 120, marginTop: 6}}
          segs={[
            {text: 'llevarte ', at: 32, weight: 800, out: 94},
            {text: 'más lejos', at: 42, weight: 800, color: C.glow, mode: 'scramble', speed: 1.8, highlight: {at: 60, color: 'rgba(242,166,90,0.22)'}, out: 96},
          ]}
        />
      </div>

      {/* Racimo de stickers + chispa */}
      {[
        {x: 1100, y: 380, s: 70, icon: 'chat' as const, at: 14},
        {x: 1180, y: 450, s: 56, icon: 'bulb' as const, at: 20},
      ].map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y + Math.sin((f + i * 13) / 12) * 8,
            transform: `translate(-50%,-50%) scale(${pop(f, s.at) * (1 - ramp(f, 86, 98))})`,
            opacity: 0.9,
          }}
        >
          <Sticker size={s.s} icon={s.icon} />
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 1190,
          top: 360 + Math.sin(f / 10) * 6,
          transform: `translate(-50%,-50%) scale(${pop(f, 24) * (1 - ramp(f, 86, 98))})`,
        }}
      >
        <Spark size={84} rotate={f * 4} />
      </div>

      {/* Pastilla crema */}
      <div
        style={{
          position: 'absolute',
          left: pill,
          top: 380,
          width: 700,
          height: 260,
          borderRadius: 130,
          background: `linear-gradient(90deg, ${C.butter}, ${C.cream})`,
          boxShadow: `0 0 60px ${C.amber}66`,
        }}
      />
    </DarkBackdrop>
  );
};
