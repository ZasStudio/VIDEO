import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_OUT, clamp01} from '../anim';
import {FONT} from '../theme';
import {motionBlur} from './Blur';
import {BlackStage, SyncLine, YELLOW, revealAt, t0, useMs} from './Kit';

// Interludio 4 — "Todo comienzo da miedo, es normal, pero no dejes que ese miedo te detenga."
// "MIEDO" tiembla, se calma con "es normal", se tacha con "ese miedo" y una flecha empuja hacia adelante.

const RED = '#FF5A5F';

export const MGFear: React.FC = () => {
  const f = useCurrentFrame();
  const ms = useMs();
  const tFear = t0('da miedo') + 150;
  const tNormal = t0('es normal');
  const tStrike = t0('ese miedo te detenga') + 200;
  const tGo = t0('te detenga');

  const fearIn = revealAt(ms, tFear, 260);
  const calm = clamp01((ms - tNormal) / 700);
  const shake = (1 - calm * 0.85) * fearIn;
  const jx = Math.sin(f * 2.7) * 9 * shake + Math.sin(f * 5.3) * 4 * shake;
  const jy = Math.cos(f * 3.1) * 6 * shake;
  const strike = EASE_OUT(clamp01((ms - tStrike) / 380));
  const go = EASE_OUT(clamp01((ms - tGo) / 450));

  return (
    <BlackStage>
      <div style={{position: 'absolute', top: 430, left: 0, right: 0}}>
        <SyncLine phrase="todo comienzo" display={['Todo', 'comienzo']} size={108} />
        <SyncLine phrase="da miedo" display={['da', '']} size={70} weight={600} color="rgba(255,255,255,0.7)" style={{marginTop: 14}} />
      </div>
      <div style={{position: 'absolute', top: 690, left: 0, right: 0, textAlign: 'center'}}>
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: 250,
            letterSpacing: '-0.04em',
            color: strike > 0.5 ? 'rgba(255,255,255,0.28)' : RED,
            opacity: fearIn,
            scale: String((0.8 + 0.2 * fearIn) * (1 - 0.12 * strike)),
            translate: `${jx}px ${jy + (1 - fearIn) * 60}px`,
            textShadow: strike > 0.5 ? 'none' : `0 0 60px ${RED}66`,
            filter: motionBlur((1 - fearIn) * 0.9 + shake * 0.12, 'x'),
          }}
        >
          MIEDO
          <div
            style={{
              position: 'absolute',
              left: '-4%',
              top: '52%',
              height: 22,
              width: `${108 * strike}%`,
              borderRadius: 11,
              background: YELLOW,
              rotate: '-4deg',
              boxShadow: `0 0 30px ${YELLOW}88`,
            }}
          />
        </div>
      </div>
      <div style={{position: 'absolute', top: 1010, left: 0, right: 0}}>
        <SyncLine phrase="es normal" display={['es', 'normal.']} size={64} weight={600} color="rgba(255,255,255,0.7)" />
      </div>
      <div style={{position: 'absolute', top: 1180, left: 0, right: 0}}>
        <SyncLine phrase="pero no dejes que" size={74} weight={700} />
        <SyncLine phrase="ese miedo te detenga" display={['ese', 'miedo', 'te', 'detenga.']} size={74} weight={700} colors={{3: YELLOW}} style={{marginTop: 8}} />
      </div>
      {/* Flecha hacia adelante */}
      <svg width={1080} height={200} style={{position: 'absolute', left: 0, top: 1420, overflow: 'visible', filter: motionBlur(Math.sin(Math.PI * go) * 0.7, 'x')}}>
        <line x1={180} y1={100} x2={180 + 640 * go} y2={100} stroke={YELLOW} strokeWidth={16} strokeLinecap="round" opacity={go > 0 ? 1 : 0} />
        <path
          d={`M ${180 + 640 * go - 50} 55 L ${180 + 640 * go + 6} 100 L ${180 + 640 * go - 50} 145`}
          fill="none"
          stroke={YELLOW}
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={go > 0.05 ? 1 : 0}
        />
      </svg>
    </BlackStage>
  );
};
