import React from 'react';
import {EASE_OUT, clamp01} from '../anim';
import {FPS} from '../edit';
import {FONT, TEXT_GRADIENT} from '../theme';
import {GlassField3D} from '../three/GlassField3D';
import {motionBlur} from './Blur';
import {BLUE, BlackStage, Hairline, SKY, SyncLine, revealAt, t0, useMs} from './Kit';

// Interludio 2 — "Y no ha sido fácil, me ha costado esfuerzo, sacrificio y mucha constancia."
// Jerarquía: "No ha sido" ligero + "fácil." enorme; luego una lista numerada (01–03) con
// íconos de línea fina y palabras grandes, separadas por líneas finas. Sin recuadros.

const Bars: React.FC<{p: number}> = ({p}) => (
  <svg width={72} height={72} viewBox="0 0 96 96" fill="none">
    {[0.32, 0.52, 0.72, 0.96].map((h, i) => {
      const k = EASE_OUT(clamp01(p * 4 - i * 0.6));
      const H = 76 * h * k;
      return <rect key={i} x={10 + i * 21} y={88 - H} width={13} height={H} rx={4} fill={i === 3 ? SKY : 'rgba(255,255,255,0.85)'} />;
    })}
  </svg>
);

const Clock: React.FC<{p: number}> = ({p}) => (
  <svg width={72} height={72} viewBox="-48 -48 96 96" fill="none">
    <circle r={38} stroke="rgba(255,255,255,0.85)" strokeWidth={4} />
    <line x1={0} y1={0} x2={0} y2={-20} stroke={SKY} strokeWidth={5} strokeLinecap="round" transform={`rotate(${p * 360})`} />
    <line x1={0} y1={0} x2={0} y2={-30} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" transform={`rotate(${p * 360 * 8})`} />
  </svg>
);

const Calendar: React.FC<{p: number}> = ({p}) => (
  <svg width={72} height={72} viewBox="0 0 96 96" fill="none">
    <rect x={8} y={12} width={80} height={76} rx={14} stroke="rgba(255,255,255,0.85)" strokeWidth={4} />
    <line x1={8} y1={32} x2={88} y2={32} stroke="rgba(255,255,255,0.85)" strokeWidth={4} />
    {Array.from({length: 9}, (_, i) => {
      const on = p * 10 > i;
      const x = 26 + (i % 3) * 22;
      const y = 48 + Math.floor(i / 3) * 14;
      return on ? (
        <path key={i} d={`M${x - 5} ${y} l3.5 4 l7 -8`} stroke={SKY} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <circle key={i} cx={x} cy={y} r={2.5} fill="rgba(255,255,255,0.4)" />
      );
    })}
  </svg>
);

const Row: React.FC<{at: number; y: number; n: string; word: string; grad?: boolean; icon: (p: number) => React.ReactNode}> = ({at, y, n, word, grad, icon}) => {
  const ms = useMs();
  const e = revealAt(ms, at, 380);
  const p = clamp01((ms - at) / 1400);
  return (
    <div style={{position: 'absolute', left: 110, right: 110, top: y}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 34,
          opacity: e,
          translate: `${(1 - e) * 260}px 0px`,
          filter: motionBlur((1 - e) * 1.1, 'x'),
        }}
      >
        <div style={{width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: 24, letterSpacing: '0.3em', color: SKY}}>{n}</div>
          {icon(p)}
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: 116,
            letterSpacing: '-0.04em',
            color: '#fff',
            ...(grad ? {backgroundImage: TEXT_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'} : {}),
          }}
        >
          {word}
        </div>
      </div>
      <div style={{marginTop: 26}}>
        <Hairline p={e} width={860} color="rgba(255,255,255,0.35)" center={false} />
      </div>
    </div>
  );
};

export const MGEffort: React.FC = () => {
  const ms = useMs();
  const tEasy = t0('sido fácil');
  const under = EASE_OUT(clamp01((ms - tEasy - 450) / 450));
  return (
    <BlackStage>
      <GlassField3D
        startFrame={Math.round((t0('no ha sido fácil') / 1000) * FPS)}
        items={[
          {shape: 'torus', p: [2.1, 4.0, -1.2], s: 0.75, tint: '#cfe6ff'},
          {shape: 'sphere', p: [-2.3, -4.0, 0], s: 0.65, tint: '#a9d0ff', spin: -1},
          {shape: 'cube', p: [2.25, -3.7, 0.5], s: 0.5},
        ]}
      />
      <div style={{position: 'absolute', top: 250, left: 0, right: 0}}>
        <SyncLine phrase="no ha sido" display={['No', 'ha', 'sido']} tone="light" size={72} />
        <SyncLine phrase="fácil" display={['fácil.']} size={168} grad="all" style={{marginTop: 2}} />
        <div style={{marginTop: 14}}>
          <Hairline p={under} width={360} color={BLUE} />
        </div>
      </div>
      <div style={{position: 'absolute', top: 640, left: 110}}>
        <SyncLine phrase="me ha costado" tone="label" size={28} align="left" />
      </div>
      <Row at={t0('esfuerzo')} y={720} n="01" word="Esfuerzo" grad icon={(p) => <Bars p={p} />} />
      <Row at={t0('sacrificio')} y={940} n="02" word="Sacrificio" icon={(p) => <Clock p={p} />} />
      <Row at={t0('constancia')} y={1160} n="03" word="Constancia" icon={(p) => <Calendar p={p} />} />
    </BlackStage>
  );
};
