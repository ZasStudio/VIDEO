import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN, EASE_OUT, keyframes, pop, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {ChartCard, CodeCard, DocCard, Gauge, Toggles, bar, glass} from '../mg/UI';
import {C} from '../theme';

// Tarjetas de vidrio que llegan en perspectiva y forman un tablero;
// luego se alejan y aparece "Claude escribe, analiza y [programa]".
export const S7_DURATION = 144;

type Card = {x: number; y: number; w: number; h: number; el: React.ReactNode};

export const S7Dashboard: React.FC = () => {
  const f = useCurrentFrame();
  const away = ramp(f, 70, 88, [0, 1], EASE_IN);

  const cards: Card[] = [
    {
      x: 380,
      y: 0,
      w: 520,
      h: 74,
      el: (
        <div style={{width: 520, height: 74, ...glass(), display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px'}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{width: 40, height: 40, borderRadius: 20, background: i === 2 ? C.amber : 'rgba(255,235,220,0.75)'}} />
          ))}
          <div style={bar(120, 12, 'rgba(255,235,220,0.35)')} />
        </div>
      ),
    },
    {x: 0, y: 40, w: 350, h: 330, el: <DocCard w={350} h={330} />},
    {x: 380, y: 100, w: 520, h: 330, el: <ChartCard w={520} h={330} p={ramp(f, 14, 50)} />},
    {
      x: 930,
      y: 40,
      w: 300,
      h: 300,
      el: (
        <div style={{width: 300, height: 300, ...glass(), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Gauge size={210} value={ramp(f, 20, 56, [0, 0.72])} />
        </div>
      ),
    },
    {x: 0, y: 400, w: 350, h: 200, el: <Toggles w={350} h={200} />},
    {x: 380, y: 460, w: 520, h: 260, el: <CodeCard w={520} h={260} p={ramp(f, 24, 60)} />},
    {x: 930, y: 370, w: 300, h: 350, el: <DocCard w={300} h={350} />},
  ];

  const rotY = keyframes(f, [0, 70], [-22, 4]);
  const rotX = keyframes(f, [0, 70], [24, 14]);

  return (
    <DarkBackdrop
      orbs={[
        {x: 1450, y: 250, r: 720, color: 'rgba(217,119,87,0.55)', kind: 'ring', drift: 40},
        {x: 600, y: 900, r: 520, color: 'rgba(242,166,90,0.3)', drift: 60},
        {x: 200, y: 150, r: 380, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      <AbsoluteFill style={{perspective: 1800, opacity: 1 - away}}>
        <div
          style={{
            position: 'absolute',
            left: 345,
            top: 170,
            width: 1230,
            height: 720,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(-6deg) translateZ(${-away * 900}px) scale(${keyframes(f, [0, 70], [0.9, 1.02])})`,
          }}
        >
          {cards.map((c, i) => {
            const p = ramp(f, 2 + i * 5, 20 + i * 5, [0, 1], EASE_OUT);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: c.x,
                  top: c.y,
                  opacity: p,
                  transform: `translateZ(${(1 - p) * -700 + Math.sin((f + i * 11) / 18) * 14}px) translateY(${(1 - p) * 90}px)`,
                }}
              >
                {c.el}
              </div>
            );
          })}
          <div style={{position: 'absolute', left: 1205, top: 15, transform: `translate(-50%,-50%) scale(${pop(f, 40)})`}}>
            <Spark size={72} rotate={f * 4} />
          </div>
        </div>
      </AbsoluteFill>

      <div style={{position: 'absolute', left: 560, top: 330}}>
        <Line size={92} seed={9} segs={[{text: 'Claude', at: 80, weight: 400, speed: 1.4}]} />
        <Line
          size={92}
          seed={10}
          style={{marginLeft: 120}}
          segs={[
            {text: 'escribe', at: 88, weight: 800, color: C.glow, speed: 1.2},
            {text: ', analiza', at: 96, weight: 400, speed: 1.2},
          ]}
        />
        <Line
          size={92}
          seed={11}
          style={{marginLeft: 120, marginTop: 8}}
          segs={[
            {text: 'y  ', at: 106, weight: 400},
            {text: 'programa', at: 108, weight: 800, color: C.glow, mode: 'spread', speed: 0.6, select: {at: 120}},
          ]}
        />
      </div>
    </DarkBackdrop>
  );
};
