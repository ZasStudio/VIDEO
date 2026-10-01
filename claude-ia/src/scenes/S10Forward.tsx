import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, appear, keyframes, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {motionBlur} from '../mg/Blur';
import {Sticker} from '../mg/Ribbon';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {C} from '../theme';

// "Todo / pensado para / llevarte / más lejos" con un racimo de stickers y chispa.
// Sale con una pastilla crema que entra desde la derecha.
export const S10_DURATION = 108;

export const S10Forward: React.FC = () => {
  const f = useCurrentFrame();
  const pill = keyframes(f, [84, 104], [1250, 380], EASE_IN_OUT);
  const pillV = Math.sin(Math.PI * ramp(f, 84, 104));
  const clusterOut = 1 - ramp(f, 86, 98, [0, 1], EASE_IN_OUT);
  return (
    <DarkBackdrop
      orbs={[
        {x: 200, y: 1100, r: 800, color: 'rgba(217,119,87,0.42)', kind: 'ring', drift: 50},
        {x: 950, y: 300, r: 480, color: 'rgba(242,166,90,0.25)', drift: 40},
        {x: 900, y: 1800, r: 500, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      <div style={{position: 'absolute', left: 90, top: 720}}>
        <Line size={124} seed={17} segs={[{text: 'Todo', at: 4, weight: 400, out: 88}]} />
        <Line
          size={124}
          seed={18}
          style={{marginTop: 6}}
          segs={[
            {text: 'pensado', at: 12, weight: 800, out: 90},
            {text: ' para', at: 24, weight: 400, out: 92},
          ]}
        />
        <Line size={124} seed={19} style={{marginTop: 6}} segs={[{text: 'llevarte', at: 32, weight: 800, out: 94}]} />
        <Line
          size={124}
          seed={20}
          style={{marginTop: 6}}
          segs={[
            {text: 'más lejos', at: 42, weight: 800, color: C.glow, mode: 'scramble', speed: 1.8, highlight: {at: 60, color: 'rgba(242,166,90,0.22)'}, out: 96},
          ]}
        />
      </div>

      {/* Racimo de stickers + chispa */}
      {[
        {x: 780, y: 560, s: 96, icon: 'chat' as const, at: 14},
        {x: 890, y: 660, s: 78, icon: 'bulb' as const, at: 20},
      ].map((s, i) => {
        const a = appear(f, s.at);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y + Math.sin((f + i * 13) / 12) * 10,
              translate: '-50% -50%',
              opacity: a.opacity * clusterOut * 0.92,
              scale: a.scale,
            }}
          >
            <Sticker size={s.s} icon={s.icon} />
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 900,
          top: 530 + Math.sin(f / 10) * 8,
          translate: '-50% -50%',
          opacity: appear(f, 24).opacity * clusterOut,
          scale: appear(f, 24).scale,
        }}
      >
        <Spark size={110} rotate={f * 4} />
      </div>

      {/* Pastilla crema */}
      <div
        style={{
          position: 'absolute',
          left: pill,
          top: 1440,
          width: 900,
          height: 300,
          borderRadius: 150,
          background: `linear-gradient(90deg, ${C.butter}, ${C.cream})`,
          boxShadow: `0 0 60px ${C.amber}66`,
          filter: motionBlur(pillV * 0.8, 'x'),
        }}
      />
    </DarkBackdrop>
  );
};
