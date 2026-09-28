import React from 'react';
import {Sheep} from '../character/Sheep';
import {blinkAt, idlePose, talkAt} from '../character/poses';
import {rand} from '../anim';
import {C, FONT} from '../theme';

// Procedurally drawn "footage" shown inside the Premiere monitors and thumbnails.

export type FootageKind = 'vlog' | 'city' | 'graffiti' | 'title';

const VlogBackground: React.FC<{t: number}> = ({t}) => {
  const flicker = 0.85 + 0.15 * Math.sin(t * 0.7) * Math.sin(t * 0.23);
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="vlog-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A1D55" />
          <stop offset="1" stopColor="#170B26" />
        </linearGradient>
        <radialGradient id="vlog-glow" cx="0.72" cy="0.22" r="0.5">
          <stop offset="0" stopColor="#FF2A3D" stopOpacity={0.45 * flicker} />
          <stop offset="1" stopColor="#FF2A3D" stopOpacity={0} />
        </radialGradient>
        <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="1600" height="900" fill="url(#vlog-bg)" />
      <rect width="1600" height="900" fill="url(#vlog-glow)" />
      {/* LED strip */}
      <rect x="0" y="118" width="1600" height="6" fill="#B98CFF" opacity={0.7} />
      <rect x="0" y="110" width="1600" height="22" fill="#B98CFF" opacity={0.12} />
      {/* shelves */}
      <rect x="90" y="300" width="360" height="14" fill="#5A3A73" />
      <rect x="120" y="236" width="44" height="64" rx="4" fill="#FFE14D" />
      <rect x="176" y="252" width="36" height="48" rx="4" fill="#23B08F" />
      <rect x="224" y="226" width="30" height="74" rx="4" fill="#EE1B2E" />
      <circle cx="320" cy="270" r="30" fill="#F5B3AA" />
      <rect x="90" y="470" width="360" height="14" fill="#5A3A73" />
      <rect x="130" y="410" width="120" height="60" rx="6" fill="#1D1D1D" stroke="#8C8C8C" strokeWidth="4" />
      <rect x="270" y="420" width="50" height="50" rx="6" fill="#9999FF" />
      {/* neon sign */}
      <g filter="url(#neon)" opacity={flicker}>
        <rect x="1080" y="150" width="330" height="120" rx="60" fill="none" stroke="#FF2A3D" strokeWidth="10" />
        <text x="1245" y="233" textAnchor="middle" fontFamily={FONT.sign} fontSize="64" fill="#FFD1D6">
          ON AIR
        </text>
      </g>
      {/* plant */}
      <g transform="translate(1400, 900)">
        <rect x="-60" y="-150" width="120" height="150" rx="10" fill="#EE1B2E" />
        {[...Array(7)].map((_, i) => (
          <ellipse
            key={i}
            cx={Math.sin(i * 1.3) * 60}
            cy={-190 - i * 26}
            rx="26"
            ry="70"
            fill={i % 2 ? '#1F8F6A' : '#27B083'}
            transform={`rotate(${-50 + i * 17}, ${Math.sin(i * 1.3) * 60}, ${-190 - i * 26})`}
          />
        ))}
      </g>
    </svg>
  );
};

const Mic: React.FC = () => (
  <svg viewBox="0 0 300 600" width="100%" height="100%" style={{overflow: 'visible'}}>
    <path d="M150,600 L150,330" stroke="#111" strokeWidth="26" />
    <path d="M150,600 L150,330" stroke="#3C3C3C" strokeWidth="10" />
    <rect x="96" y="120" width="108" height="220" rx="54" fill="#1A1A1A" stroke="#000" strokeWidth="10" />
    <g stroke="#555" strokeWidth="6">
      {[160, 190, 220, 250, 280].map((y) => (
        <path key={y} d={`M110,${y} H190`} />
      ))}
    </g>
    <rect x="86" y="290" width="128" height="40" rx="12" fill="#EE1B2E" stroke="#000" strokeWidth="8" />
  </svg>
);

const Vlog: React.FC<{t: number; w: number; h: number; talking: boolean}> = ({t, w, h, talking}) => {
  const p = idlePose(t, 0.6, {
    blink: blinkAt(t, 13),
    mouth: talking ? 'talk' : 'smile',
    mouthOpen: talking ? talkAt(t) : 0,
    nearShoulder: 18,
    nearElbow: 70,
    farShoulder: 20,
    farElbow: 60,
    nearHand: 'open',
  });
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <VlogBackground t={t} />
      <div style={{position: 'absolute', left: w * 0.5 - h * 0.47, top: h * 0.06}}>
        <Sheep pose={p} height={h * 1.12} shadow={false} />
      </div>
      {/* desk */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: h * 0.2,
          background: 'linear-gradient(#3B2A20, #24170F)',
          borderTop: `${Math.max(2, h * 0.012)}px solid #6B4A35`,
        }}
      />
      <div style={{position: 'absolute', left: w * 0.5 + h * 0.2, bottom: h * 0.0, width: h * 0.22, height: h * 0.46}}>
        <Mic />
      </div>
    </div>
  );
};

const City: React.FC<{t: number}> = ({t}) => {
  const buildings = [...Array(18)].map((_, i) => ({
    x: i * 92 - 20,
    w: 70 + rand(i) * 50,
    h: 180 + rand(i + 50) * 360,
  }));
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="city-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E1A5E" />
          <stop offset="0.55" stopColor="#FF3D6E" />
          <stop offset="1" stopColor="#FFB35C" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#city-sky)" />
      <circle cx={800} cy={600 - t * 0.4} r="170" fill="#FFE8A3" opacity="0.95" />
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={900 - b.h} width={b.w} height={b.h} fill={i % 3 ? '#23123F' : '#1A0D30'} />
          {[...Array(Math.floor(b.h / 40))].map((_, j) =>
            rand(i * 31 + j) > 0.55 ? (
              <rect key={j} x={b.x + 14 + (j % 2) * 26} y={900 - b.h + 20 + j * 36} width="14" height="18" fill="#FFD66B" opacity={0.85} />
            ) : null,
          )}
        </g>
      ))}
      {[...Array(5)].map((_, i) => {
        const x = ((t * (6 + i * 2) + i * 400) % 2000) - 200;
        return <rect key={i} x={x} y={860 + (i % 2) * 14} width="160" height="6" rx="3" fill={i % 2 ? '#FF2A3D' : '#FFF4D6'} opacity={0.9} />;
      })}
    </svg>
  );
};

const Graffiti: React.FC<{t: number}> = ({t}) => (
  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
    <rect width="1600" height="900" fill="#8E8A86" />
    {[...Array(20)].map((_, row) =>
      [...Array(14)].map((__, col) => (
        <rect
          key={`${row}-${col}`}
          x={col * 124 - (row % 2) * 62}
          y={row * 46}
          width="118"
          height="40"
          fill={rand(row * 20 + col) > 0.5 ? '#9C9792' : '#86817C'}
        />
      )),
    )}
    <path d="M160,620 C300,380 520,300 760,420 C980,530 1180,320 1460,380 L1500,700 L140,760 Z" fill="#FFE14D" opacity="0.92" />
    <text x="800" y="600" textAnchor="middle" fontFamily={FONT.marker} fontSize="300" fill="#EE1B2E" stroke="#141414" strokeWidth="12" transform={`rotate(-6, 800, 520) translate(${Math.sin(t * 0.05) * 6}, 0)`}>
      EDIT!
    </text>
    {[...Array(8)].map((_, i) => (
      <rect key={i} x={420 + i * 110} y={590} width="14" height={60 + rand(i) * 120} rx="7" fill="#EE1B2E" />
    ))}
  </svg>
);

const TitleCard: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: C.red,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: 'white',
      fontFamily: FONT.display,
      lineHeight: 0.9,
      textAlign: 'center',
    }}
  >
    <div style={{fontSize: '28cqh'}}>EDITA</div>
    <div style={{fontSize: '28cqh', color: C.ink}}>CON IA</div>
  </div>
);

export const Footage: React.FC<{
  kind: FootageKind;
  t: number;
  w: number;
  h: number;
  talking?: boolean;
}> = ({kind, t, w, h, talking = true}) => {
  return (
    <div style={{position: 'relative', width: w, height: h, overflow: 'hidden', containerType: 'size'}}>
      {kind === 'vlog' ? <Vlog t={t} w={w} h={h} talking={talking} /> : null}
      {kind === 'city' ? <City t={t} /> : null}
      {kind === 'graffiti' ? <Graffiti t={t} /> : null}
      {kind === 'title' ? <TitleCard /> : null}
    </div>
  );
};
