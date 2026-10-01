import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C} from '../theme';
import {BlurDefs} from './Blur';

export type Orb = {
  x: number; // centro en px
  y: number;
  r: number; // radio en px
  color: string;
  opacity?: number;
  /** 'disc' = mancha llena, 'ring' = dona luminosa como en la referencia */
  kind?: 'disc' | 'ring';
  drift?: number; // amplitud del vaivén en px
  speed?: number; // ciclos por segundo (aprox.)
  phase?: number;
};

const orbBackground = (o: Orb) =>
  o.kind === 'ring'
    ? `radial-gradient(circle, transparent 38%, ${o.color} 56%, transparent 72%)`
    : `radial-gradient(circle, ${o.color} 0%, ${o.color}AA 28%, transparent 70%)`;

export const Orbs: React.FC<{orbs: Orb[]; offsetX?: number; offsetY?: number}> = ({
  orbs,
  offsetX = 0,
  offsetY = 0,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {orbs.map((o, i) => {
        const t = (frame / 30) * (o.speed ?? 0.12) * Math.PI * 2 + (o.phase ?? i * 1.7);
        const d = o.drift ?? 60;
        const x = o.x + Math.sin(t) * d + offsetX;
        const y = o.y + Math.cos(t * 0.8) * d * 0.7 + offsetY;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - o.r,
              top: y - o.r,
              width: o.r * 2,
              height: o.r * 2,
              borderRadius: '50%',
              background: orbBackground(o),
              opacity: o.opacity ?? 1,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Fondo oscuro cálido con orbes, viñeta y grano suave. */
export const DarkBackdrop: React.FC<{orbs: Orb[]; offsetX?: number; offsetY?: number; children?: React.ReactNode}> = ({
  orbs,
  offsetX,
  offsetY,
  children,
}) => (
  <AbsoluteFill>
    <Bleed background={`linear-gradient(180deg, ${C.ink} 0%, ${C.night} 55%, #24140E 100%)`} />
    <BlurDefs />
    <Orbs orbs={orbs} offsetX={offsetX} offsetY={offsetY} />
    <AbsoluteFill
      style={{background: 'radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(6,3,2,0.65) 100%)'}}
    />
    {children}
    <Grain opacity={0.06} />
  </AbsoluteFill>
);

/** Fondo claro crema con orbes durazno/mantequilla. */
export const LightBackdrop: React.FC<{orbs: Orb[]; offsetX?: number; offsetY?: number; children?: React.ReactNode}> = ({
  orbs,
  offsetX,
  offsetY,
  children,
}) => (
  <AbsoluteFill>
    <Bleed background={`linear-gradient(160deg, #FFFBF4 0%, ${C.cream} 50%, ${C.paper} 100%)`} />
    <BlurDefs />
    <Orbs orbs={orbs} offsetX={offsetX} offsetY={offsetY} />
    {children}
    <Grain opacity={0.035} />
  </AbsoluteFill>
);

/** Grano de película estático (SVG turbulence) para que los degradados no se vean planos. */
export const Grain: React.FC<{opacity: number}> = ({opacity}) => (
  <AbsoluteFill style={{opacity, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
    <svg width="100%" height="100%">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

/**
 * Fondo que sobresale del cuadro: los movimientos de cámara entre escenas
 * (barridos y zooms) nunca dejan ver bordes vacíos.
 */
export const Bleed: React.FC<{background: string}> = ({background}) => (
  <div style={{position: 'absolute', left: -1200, top: -1600, right: -1200, bottom: -1600, background}} />
);
