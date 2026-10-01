import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_OUT, clamp01} from '../anim';
import {FPS} from '../edit';
import {FONT, TEXT_GRADIENT} from '../theme';
import {GlassField3D} from '../three/GlassField3D';
import {motionBlur} from './Blur';
import {SKY, BlackStage, SyncLine, revealAt, t0, useMs} from './Kit';

// Interludio 4 — "Todo comienzo da miedo, es normal, pero no dejes que ese miedo te detenga."
// "MIEDO" enorme tiembla, se calma con "es normal" y una línea fina lo tacha; cierre con
// "te detenga." grande y una flecha fina hacia adelante. Sin recuadros.

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
  const strike = EASE_OUT(clamp01((ms - tStrike) / 420));
  const go = EASE_OUT(clamp01((ms - tGo) / 500));

  return (
    <BlackStage>
      <GlassField3D
        startFrame={Math.round((t0('todo comienzo') / 1000) * FPS)}
        shake={shake}
        items={[
          {shape: 'cube', p: [-2.15, 2.5, 0], s: 0.5, spin: 1.4},
          {shape: 'cube', p: [2.2, 3.4, -0.5], s: 0.4, tint: '#a9d0ff', spin: -1.2},
          {shape: 'sphere', p: [2.1, -4.0, -0.5], s: 0.55, tint: '#cfe6ff'},
        ]}
      />
      <div style={{position: 'absolute', top: 400, left: 0, right: 0}}>
        <SyncLine phrase="todo comienzo" tone="label" size={30} />
        <SyncLine phrase="da" display={['da']} tone="light" size={78} style={{marginTop: 22}} />
      </div>
      <div style={{position: 'absolute', top: 560, left: 0, right: 0, textAlign: 'center'}}>
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: 270,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            backgroundImage: TEXT_GRADIENT,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            opacity: fearIn * (1 - 0.6 * strike),
            scale: String((0.82 + 0.18 * fearIn) * (1 - 0.08 * strike)),
            translate: `${jx}px ${jy + (1 - fearIn) * 60}px`,
            filter: motionBlur((1 - fearIn) * 0.9 + shake * 0.15, 'x'),
          }}
        >
          MIEDO
        </div>
        <div
          style={{
            position: 'absolute',
            left: 120,
            top: 150,
            height: 5,
            width: 840 * strike,
            borderRadius: 3,
            background: SKY,
            rotate: '-3deg',
            boxShadow: `0 0 18px ${SKY}`,
          }}
        />
      </div>
      <div style={{position: 'absolute', top: 870, left: 0, right: 0}}>
        <SyncLine phrase="es normal" display={['es', 'normal.']} tone="serif" size={74} style={{color: 'rgba(255,255,255,0.8)'}} />
      </div>
      <div style={{position: 'absolute', top: 1110, left: 0, right: 0}}>
        <SyncLine phrase="pero no dejes que ese miedo" tone="light" size={56} />
        <SyncLine phrase="te detenga" display={['te', 'detenga.']} size={150} grad={[1]} style={{marginTop: 10}} />
      </div>
      {/* Flecha fina hacia adelante */}
      <svg width={1080} height={120} style={{position: 'absolute', left: 0, top: 1400, overflow: 'visible', filter: motionBlur(Math.sin(Math.PI * go) * 0.7, 'x')}}>
        <line x1={240} y1={60} x2={240 + 600 * go} y2={60} stroke={SKY} strokeWidth={4} strokeLinecap="round" opacity={go > 0 ? 1 : 0} />
        <path
          d={`M ${240 + 600 * go - 26} 36 L ${240 + 600 * go + 2} 60 L ${240 + 600 * go - 26} 84`}
          fill="none"
          stroke={SKY}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={go > 0.05 ? 1 : 0}
        />
      </svg>
    </BlackStage>
  );
};
