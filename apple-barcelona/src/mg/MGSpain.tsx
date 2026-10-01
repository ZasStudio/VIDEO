import {getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
import React from 'react';
import {EASE_IN_OUT, EASE_OUT, clamp01, rand} from '../anim';
import {FPS} from '../edit';
import {C, FONT, TEXT_GRADIENT_BLUE} from '../theme';
import {GlassField3D} from '../three/GlassField3D';
import {motionBlur} from './Blur';
import {BLUE, BlackStage, SKY, SyncLine, Twinkle, t0, useMs} from './Kit';

// Interludio 3 — "Cuando uno llega aquí a España, lleva prácticamente con ganas,
// solo con una maleta llena de sueños."
// Avión sobre un arco punteado hasta "España"; luego una maleta de vidrio azul que se abre y
// suelta destellos. Jerarquía: etiqueta → línea ligera → palabra grande (sans o serif).

const ARC = 'M 150 600 Q 520 200 910 470';
const ARC_LEN = getLength(ARC);

const Plane: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible'}}>
    <path d="M2 12 L22 4 L16 20 L12 13 Z" fill="#fff" />
  </svg>
);

const glassPart = (radius: string): React.CSSProperties => ({
  borderRadius: radius,
  background: 'linear-gradient(160deg, rgba(170,210,255,0.32), rgba(61,139,255,0.14))',
  backdropFilter: 'blur(20px) saturate(1.6)',
  border: '1px solid rgba(200,225,255,0.45)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 30px 60px rgba(0,0,0,0.5)',
});

const Suitcase: React.FC<{lid: number}> = ({lid}) => (
  <div style={{position: 'relative', width: 380, height: 300}}>
    <div style={{position: 'absolute', left: 14, top: 112, width: 352, height: 44, borderRadius: 16, background: '#06142e', opacity: lid}} />
    <div style={{position: 'absolute', left: 0, top: 136, width: 380, height: 164, ...glassPart('0 0 30px 30px')}} />
    {[100, 262].map((x) => (
      <div key={x} style={{position: 'absolute', left: x, top: 136, width: 18, height: 164, background: 'rgba(200,225,255,0.18)'}} />
    ))}
    <div style={{position: 'absolute', left: 0, top: 0, width: 380, height: 136, ...glassPart('30px 30px 0 0'), transformOrigin: '6% 100%', rotate: `${-lid * 34}deg`}}>
      <div style={{position: 'absolute', left: 145, top: -38, width: 90, height: 48, borderRadius: '26px 26px 0 0', border: '6px solid rgba(200,225,255,0.7)', borderBottom: 'none'}} />
    </div>
  </div>
);

export const MGSpain: React.FC = () => {
  const ms = useMs();
  const tArrive = t0('cuando uno llega');
  const tSpain = t0('aquí a españa') + 500;
  const tSuit = t0('lleva prácticamente');
  const tCase = t0('maleta');
  const tDreams = t0('sueños');

  const fly = EASE_IN_OUT(clamp01((ms - tArrive) / (tSpain - tArrive)));
  const head = getPointAtLength(ARC, Math.max(1, fly * ARC_LEN)) ?? {x: 150, y: 600};
  const tan = getTangentAtLength(ARC, Math.max(1, fly * ARC_LEN)) ?? {x: 1, y: 0};
  const pin = EASE_OUT(clamp01((ms - tSpain + 100) / 400));
  const part1Out = EASE_IN_OUT(clamp01((ms - tSuit + 150) / 400));
  const suitIn = EASE_OUT(clamp01((ms - tSuit) / 500));
  const lid = EASE_OUT(clamp01((ms - tCase) / 450));
  const burst = ms - tDreams + 150;

  return (
    <BlackStage>
      <GlassField3D
        startFrame={Math.round((tArrive / 1000) * FPS)}
        items={[
          {shape: 'sphere', p: [-2.1, 3.6, -1], s: 0.7, tint: '#cfe6ff'},
          {shape: 'ring', p: [2.1, -1.4, -0.6], s: 0.85, spin: 0.6},
          {shape: 'capsule', p: [-2.2, -3.9, 0.5], s: 0.6, tint: '#a9d0ff', spin: -1},
        ]}
      />
      {/* Parte 1: viaje a España */}
      <div style={{position: 'absolute', inset: 0, opacity: 1 - part1Out, translate: `0px ${-part1Out * 120}px`, filter: motionBlur(part1Out * 0.6, 'y')}}>
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
          <path d={ARC} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={3} strokeDasharray="1 14" strokeLinecap="round" />
          <path d={ARC} fill="none" stroke={SKY} strokeWidth={4} strokeDasharray="1 14" strokeLinecap="round" style={{clipPath: `inset(0 ${100 - fly * 100}% 0 0)`}} />
          <circle cx={150} cy={600} r={8} fill="rgba(255,255,255,0.8)" />
          <circle cx={910} cy={470} r={10 * pin} fill={BLUE} />
          <circle cx={910} cy={470} r={10 + 30 * pin} fill="none" stroke={SKY} strokeWidth={1.5} opacity={(1 - pin) * 0.9 + 0.1} />
        </svg>
        <div style={{position: 'absolute', left: 150, top: 630, translate: '-50% 0', fontFamily: FONT.sans, fontWeight: 600, fontSize: 24, letterSpacing: '0.3em', color: C.ice}}>
          MI PAÍS
        </div>
        <div style={{position: 'absolute', left: 910, top: 505, translate: '-50% 0', opacity: pin, fontFamily: FONT.sans, fontWeight: 600, fontSize: 24, letterSpacing: '0.3em', color: C.ice}}>
          ESPAÑA
        </div>
        <div
          style={{
            position: 'absolute',
            left: head.x,
            top: head.y,
            translate: '-50% -50%',
            rotate: `${(Math.atan2(tan.y, tan.x) * 180) / Math.PI + 22}deg`,
            opacity: fly > 0 && fly < 0.98 ? 1 : 0,
            filter: motionBlur(Math.sin(Math.PI * fly) * 0.5, 'x'),
          }}
        >
          <Plane size={54} />
        </div>
        <div style={{position: 'absolute', top: 860, left: 0, right: 0}}>
          <SyncLine phrase="cuando uno llega" tone="label" size={30} />
          <SyncLine phrase="aquí a" display={['aquí', 'a']} tone="light" size={78} style={{marginTop: 24}} />
          <SyncLine phrase="españa" display={['España']} size={190} grad="all" gradient={TEXT_GRADIENT_BLUE} />
        </div>
      </div>

      {/* Parte 2: la maleta llena de sueños */}
      <div style={{position: 'absolute', left: 350, top: 640, opacity: suitIn, scale: String(0.85 + 0.15 * suitIn), translate: `0px ${(1 - suitIn) * 80}px`}}>
        <Suitcase lid={lid} />
        {Array.from({length: 14}, (_, i) => {
          const k = clamp01(burst / 1100 - rand(i + 1) * 0.25);
          const e = EASE_OUT(k);
          const x = 190 + (rand(i + 5) - 0.5) * 740 * e;
          const y = 110 - (220 + rand(i + 2) * 380) * e;
          const o = burst > 0 ? clamp01(k * 4) * (1 - clamp01((k - 0.75) / 0.25) * 0.4) : 0;
          return (
            <div key={i} style={{position: 'absolute', left: x, top: y, opacity: o}}>
              <Twinkle size={18 + rand(i + 7) * 30} color={i % 3 === 0 ? '#FFFFFF' : SKY} rotate={burst * 0.1 + i * 20} />
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', top: 1060, left: 0, right: 0}}>
        <SyncLine phrase="solo con una maleta" tone="label" size={30} />
        <SyncLine phrase="llena de" display={['llena', 'de']} tone="light" size={78} style={{marginTop: 24}} />
        <SyncLine phrase="sueños" display={['sueños']} tone="serif" size={230} grad="all" gradient={TEXT_GRADIENT_BLUE} style={{lineHeight: 0.95}} />
      </div>
    </BlackStage>
  );
};
