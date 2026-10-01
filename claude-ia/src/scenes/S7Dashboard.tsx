import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, appear, keyframes, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {ChartCard, CodeCard, DocCard, Gauge, Toggles, bar, glass} from '../mg/UI';
import {C} from '../theme';

// Tarjetas de vidrio que llegan en perspectiva y forman un tablero;
// luego se alejan y aparece "Claude / escribe, / analiza / y [programa]".
export const S7_DURATION = 144;

type Card = {x: number; y: number; el: React.ReactNode};

const Board: React.FC = () => {
  const f = useCurrentFrame();
  const away = ramp(f, 66, 86, [0, 1], EASE_IN_OUT);
  const cards: Card[] = [
    {
      x: 0,
      y: 0,
      el: (
        <div style={{width: 900, height: 84, ...glass(), display: 'flex', alignItems: 'center', gap: 20, padding: '0 26px'}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{width: 46, height: 46, borderRadius: 23, background: i === 2 ? C.amber : 'rgba(255,235,220,0.75)'}} />
          ))}
          <div style={bar(260, 14, 'rgba(255,235,220,0.35)')} />
        </div>
      ),
    },
    {x: 0, y: 114, el: <ChartCard w={560} h={360} p={ramp(f, 14, 50)} />},
    {
      x: 590,
      y: 114,
      el: (
        <div style={{width: 310, height: 360, ...glass(), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Gauge size={230} value={ramp(f, 20, 56, [0, 0.72])} />
        </div>
      ),
    },
    {x: 0, y: 504, el: <DocCard w={300} h={360} />},
    {x: 330, y: 504, el: <CodeCard w={570} h={360} p={ramp(f, 24, 60)} />},
    {x: 0, y: 894, el: <Toggles w={440} h={220} />},
    {x: 470, y: 894, el: <DocCard w={430} h={220} />},
  ];
  return (
    <AbsoluteFill style={{perspective: 2000, opacity: 1 - away}}>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 360,
          width: 900,
          height: 1120,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${keyframes(f, [0, 70], [26, 14])}deg) rotateY(${keyframes(f, [0, 70], [-24, 6])}deg) rotateZ(-6deg) translateZ(${-away * 1000}px) scale(${keyframes(f, [0, 70], [0.88, 1])})`,
        }}
      >
        {cards.map((c, i) => {
          const p = ramp(f, 2 + i * 4, 20 + i * 4, [0, 1], EASE_OUT);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: c.x,
                top: c.y,
                opacity: p,
                transform: `translateZ(${(1 - p) * -800 + Math.sin((f + i * 11) / 18) * 16}px) translateY(${(1 - p) * 140}px)`,
              }}
            >
              {c.el}
            </div>
          );
        })}
        <div style={{position: 'absolute', left: 880, top: 10, translate: '-50% -50%', ...appear(f, 40)}}>
          <Spark size={90} rotate={f * 4} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const S7Dashboard: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <DarkBackdrop
      orbs={[
        {x: 900, y: 420, r: 800, color: 'rgba(217,119,87,0.55)', kind: 'ring', drift: 40},
        {x: 300, y: 1600, r: 600, color: 'rgba(242,166,90,0.3)', drift: 60},
        {x: 150, y: 200, r: 420, color: 'rgba(90,40,22,0.6)'},
      ]}
    >
      {f < 90 ? <Board /> : null}

      <div style={{position: 'absolute', left: 110, top: 600}}>
        <Line size={128} seed={9} segs={[{text: 'Claude', at: 80, weight: 400, speed: 1.4}]} />
        <Line size={128} seed={10} style={{marginTop: 8}} segs={[{text: 'escribe,', at: 88, weight: 800, color: C.glow, speed: 1.2}]} />
        <Line size={128} seed={11} style={{marginTop: 8}} segs={[{text: 'analiza', at: 96, weight: 400, speed: 1.2}]} />
        <Line
          size={128}
          seed={12}
          style={{marginTop: 8}}
          segs={[
            {text: 'y  ', at: 104, weight: 400},
            {text: 'programa', at: 106, weight: 800, color: C.glow, mode: 'spread', speed: 0.6, select: {at: 120}},
          ]}
        />
      </div>
    </DarkBackdrop>
  );
};
