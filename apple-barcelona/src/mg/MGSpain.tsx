import {getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
import React from 'react';
import {EASE_IN_OUT, EASE_OUT, clamp01, rand} from '../anim';
import {FONT} from '../theme';
import {motionBlur} from './Blur';
import {FPS} from '../edit';
import {GlassField3D} from '../three/GlassField3D';
import {Glass} from './GlassCss';
import {BlackStage, PINK, SyncLine, Twinkle, YELLOW, revealAt, t0, useMs} from './Kit';

// Interludio 3 — "Cuando uno llega aquí a España, lleva prácticamente con ganas,
// solo con una maleta llena de sueños."
// Un avión cruza un arco punteado hasta un pin "España"; luego una maleta se abre y suelta estrellas.

const ARC = 'M 150 640 Q 520 230 910 500';
const ARC_LEN = getLength(ARC);

const Plane: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible'}}>
    <path d="M2 12 L22 4 L16 20 L12 13 Z" fill="#fff" />
    <path d="M12 13 L22 4" stroke="#bbb" strokeWidth={1} />
  </svg>
);

const Suitcase: React.FC<{lid: number}> = ({lid}) => (
  <div style={{position: 'relative', width: 420, height: 330}}>
    {/* interior oscuro que se ve al abrir */}
    <div style={{position: 'absolute', left: 14, top: 120, width: 392, height: 50, borderRadius: 18, background: '#2a0f16', opacity: lid}} />
    {/* cuerpo inferior */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 150,
        width: 420,
        height: 180,
        borderRadius: '0 0 34px 34px',
        background: 'linear-gradient(160deg, rgba(255,170,185,0.55), rgba(231,111,130,0.35))',
        backdropFilter: 'blur(22px) saturate(1.8)',
        border: '1.5px solid rgba(255,255,255,0.4)',
        boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.55), inset 0 -10px 30px rgba(120,20,40,0.25), 0 30px 60px rgba(0,0,0,0.45)',
      }}
    />
    {/* tapa (se abre hacia arriba, con la bisagra a la izquierda) */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 420,
        height: 150,
        borderRadius: '34px 34px 0 0',
        background: 'linear-gradient(160deg, rgba(255,200,210,0.65), rgba(255,143,163,0.4))',
        backdropFilter: 'blur(22px) saturate(1.8)',
        border: '1.5px solid rgba(255,255,255,0.45)',
        transformOrigin: '6% 100%',
        rotate: `${-lid * 34}deg`,
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6), 0 20px 40px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{position: 'absolute', left: 160, top: -40, width: 100, height: 52, borderRadius: '30px 30px 0 0', border: '12px solid #C9646F', borderBottom: 'none'}} />
    </div>
    {/* correas */}
    {[110, 290].map((x) => (
      <div key={x} style={{position: 'absolute', left: x, top: 150, width: 22, height: 180, background: 'rgba(255,255,255,0.22)'}} />
    ))}
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
  const head = getPointAtLength(ARC, Math.max(1, fly * ARC_LEN)) ?? {x: 150, y: 640};
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
          {shape: 'sphere', p: [-2.0, 3.3, -1], s: 0.8, tint: '#ffd0da'},
          {shape: 'ring', p: [2.0, -1.0, -0.5], s: 0.9, spin: 0.6},
          {shape: 'capsule', p: [-2.2, -3.5, 0.5], s: 0.7, tint: '#fff3c4', spin: -1},
          {shape: 'torus', p: [2.2, -4.0, 0], s: 0.6, tint: '#ffffff'},
        ]}
      />
      {/* Parte 1: viaje a España */}
      <div style={{position: 'absolute', inset: 0, opacity: 1 - part1Out, translate: `0px ${-part1Out * 120}px`, filter: motionBlur(part1Out * 0.6, 'y')}}>
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
          <path d={ARC} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={5} strokeDasharray="2 18" strokeLinecap="round" />
          <path
            d={ARC}
            fill="none"
            stroke={YELLOW}
            strokeWidth={6}
            strokeDasharray={`2 18`}
            strokeLinecap="round"
            style={{clipPath: `inset(0 ${100 - fly * 100}% 0 0)`}}
          />
          <circle cx={150} cy={640} r={14} fill="rgba(255,255,255,0.75)" />
        </svg>
        <div style={{position: 'absolute', left: 150, top: 670, translate: '-50% 0', fontFamily: FONT.sans, fontWeight: 600, fontSize: 36, color: 'rgba(255,255,255,0.7)'}}>
          Mi país
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
          <Plane size={70} />
        </div>
        {/* Pin España */}
        <div style={{position: 'absolute', left: 910, top: 500, translate: '-50% -100%', opacity: pin, scale: String(0.6 + 0.4 * pin)}}>
          <svg width={70} height={90} viewBox="0 0 24 30">
            <path d="M12 30s10-9 10-17A10 10 0 1 0 2 13c0 8 10 17 10 17z" fill={PINK} />
            <circle cx="12" cy="12" r="4" fill="#fff" />
          </svg>
        </div>
        <div
          style={{position: 'absolute', left: 910, top: 520, translate: '-50% 0', opacity: pin}}
        >
          <Glass tint="rgba(255,143,163,0.35)" radius={999} style={{padding: '12px 30px', fontFamily: FONT.sans, fontWeight: 800, fontSize: 40, color: '#fff'}}>
            España
          </Glass>
        </div>
        <div style={{position: 'absolute', top: 900, left: 0, right: 0}}>
          <SyncLine phrase="cuando uno llega" display={['Cuando', 'uno', 'llega']} size={100} />
          <SyncLine phrase="aquí a españa" display={['aquí', 'a', 'España']} size={100} colors={{2: PINK}} style={{marginTop: 10}} />
        </div>
      </div>

      {/* Parte 2: la maleta llena de sueños */}
      <div style={{position: 'absolute', left: 330, top: 760, opacity: suitIn, scale: String(0.85 + 0.15 * suitIn), translate: `0px ${(1 - suitIn) * 80}px`}}>
        <Suitcase lid={lid} />
        {Array.from({length: 14}, (_, i) => {
          const k = clamp01(burst / 1100 - rand(i + 1) * 0.25);
          const e = EASE_OUT(k);
          const x = 210 + (rand(i + 5) - 0.5) * 760 * e;
          const y = 120 - (220 + rand(i + 2) * 420) * e;
          const o = burst > 0 ? clamp01(k * 4) * (1 - clamp01((k - 0.75) / 0.25) * 0.4) : 0;
          return (
            <div key={i} style={{position: 'absolute', left: x, top: y, opacity: o}}>
              <Twinkle size={24 + rand(i + 7) * 40} color={i % 3 === 0 ? PINK : YELLOW} rotate={burst * 0.1 + i * 20} />
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', top: 1230, left: 0, right: 0, opacity: revealAt(ms, tSuit)}}>
        <SyncLine phrase="solo con una maleta" display={['solo', 'con', 'una', 'maleta']} size={76} weight={600} color="rgba(255,255,255,0.85)" />
        <SyncLine phrase="llena de sueños" display={['llena', 'de', 'sueños']} size={124} colors={{2: YELLOW}} style={{marginTop: 14}} />
      </div>
    </BlackStage>
  );
};
