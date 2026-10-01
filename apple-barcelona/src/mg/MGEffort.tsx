import React from 'react';
import {EASE_OUT, clamp01} from '../anim';
import {FONT} from '../theme';
import {motionBlur} from './Blur';
import {BlackStage, IconTile, PINK, SyncLine, YELLOW, revealAt, t0, useMs} from './Kit';

// Interludio 2 — "Y no ha sido fácil, me ha costado esfuerzo, sacrificio y mucha constancia."
// Tres filas con ícono animado entran justo cuando dice cada palabra.

const Bars: React.FC<{p: number}> = ({p}) => (
  <svg width={96} height={96} viewBox="0 0 96 96">
    {[0.32, 0.52, 0.72, 0.96].map((h, i) => {
      const k = EASE_OUT(clamp01(p * 4 - i * 0.6));
      const H = 76 * h * k;
      return <rect key={i} x={8 + i * 22} y={88 - H} width={16} height={H} rx={4} fill={i === 3 ? YELLOW : 'rgba(255,255,255,0.8)'} />;
    })}
  </svg>
);

const Clock: React.FC<{p: number}> = ({p}) => (
  <svg width={96} height={96} viewBox="-48 -48 96 96">
    <circle r={38} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={5} />
    <line x1={0} y1={0} x2={0} y2={-20} stroke={PINK} strokeWidth={6} strokeLinecap="round" transform={`rotate(${p * 360})`} />
    <line x1={0} y1={0} x2={0} y2={-30} stroke="#fff" strokeWidth={4} strokeLinecap="round" transform={`rotate(${p * 360 * 8})`} />
    <circle r={5} fill="#fff" />
  </svg>
);

const Calendar: React.FC<{p: number}> = ({p}) => (
  <svg width={96} height={96} viewBox="0 0 96 96">
    <rect x={6} y={10} width={84} height={80} rx={12} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={5} />
    <rect x={6} y={10} width={84} height={18} rx={9} fill="rgba(255,255,255,0.85)" />
    {Array.from({length: 9}, (_, i) => {
      const on = p * 10 > i;
      const x = 22 + (i % 3) * 26;
      const y = 44 + Math.floor(i / 3) * 16;
      return on ? (
        <path key={i} d={`M${x - 6} ${y} l4 5 l8 -9`} fill="none" stroke={YELLOW} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <circle key={i} cx={x} cy={y} r={3} fill="rgba(255,255,255,0.4)" />
      );
    })}
  </svg>
);

const Row: React.FC<{at: number; y: number; word: string; color: string; icon: (p: number) => React.ReactNode}> = ({at, y, word, color, icon}) => {
  const ms = useMs();
  const e = revealAt(ms, at, 380);
  const p = clamp01((ms - at) / 1400);
  return (
    <div
      style={{
        position: 'absolute',
        left: 110,
        top: y,
        display: 'flex',
        alignItems: 'center',
        gap: 44,
        opacity: e,
        translate: `${(1 - e) * 320}px 0px`,
        filter: motionBlur((1 - e) * 1.1, 'x'),
      }}
    >
      <IconTile size={168}>{icon(p)}</IconTile>
      <div style={{fontFamily: FONT.sans, fontWeight: 800, fontSize: 104, letterSpacing: '-0.03em', color}}>{word}</div>
    </div>
  );
};

export const MGEffort: React.FC = () => {
  const ms = useMs();
  const tEasy = t0('sido fácil');
  const strike = EASE_OUT(clamp01((ms - tEasy - 450) / 350));
  return (
    <BlackStage hue="yellow">
      <div style={{position: 'absolute', top: 300, left: 0, right: 0}}>
        <SyncLine phrase="no ha sido fácil" display={['No', 'ha', 'sido', 'fácil']} size={112} />
        {/* subrayado a mano bajo "fácil" */}
        <svg width={1080} height={60} style={{position: 'absolute', left: 0, top: 118}}>
          <path
            d="M 610 30 C 680 14, 780 44, 880 22"
            fill="none"
            stroke={PINK}
            strokeWidth={12}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${strike} 1`}
          />
        </svg>
      </div>
      <div style={{position: 'absolute', top: 540, left: 0, right: 0}}>
        <SyncLine phrase="me ha costado" size={58} weight={600} color="rgba(255,255,255,0.7)" />
      </div>
      <Row at={t0('esfuerzo')} y={700} word="Esfuerzo" color={YELLOW} icon={(p) => <Bars p={p} />} />
      <Row at={t0('sacrificio')} y={940} word="Sacrificio" color={PINK} icon={(p) => <Clock p={p} />} />
      <Row at={t0('constancia')} y={1180} word="Constancia" color="#FFFFFF" icon={(p) => <Calendar p={p} />} />
    </BlackStage>
  );
};
