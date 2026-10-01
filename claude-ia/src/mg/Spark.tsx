import React from 'react';
import {C} from '../theme';

// Chispa tipo "starburst": rayos redondeados de largo irregular alrededor de un núcleo.
// Es el hilo conductor del video (equivale a la florecita luminosa de la referencia).
const RAYS = [1, 0.78, 0.94, 0.7, 0.98, 0.82, 0.9, 0.72, 1, 0.8, 0.92, 0.76];

export const Spark: React.FC<{
  size: number;
  color?: string;
  glow?: string | null;
  rotate?: number;
  /** 0..1, permite que los rayos "brote" desde el centro */
  bloom?: number;
  style?: React.CSSProperties;
}> = ({size, color = C.spark, glow = C.coral, rotate = 0, bloom = 1, style}) => {
  const R = 50;
  return (
    <svg
      width={size}
      height={size}
      viewBox="-60 -60 120 120"
      style={{
        overflow: 'visible',
        transform: `rotate(${rotate}deg)`,
        filter: glow ? `drop-shadow(0 0 ${size * 0.08}px ${glow}) drop-shadow(0 0 ${size * 0.25}px ${glow})` : undefined,
        ...style,
      }}
    >
      {RAYS.map((len, i) => {
        const a = (i / RAYS.length) * Math.PI * 2;
        const l = R * len * bloom;
        return (
          <line
            key={i}
            x1={0}
            y1={0}
            x2={Math.cos(a) * l}
            y2={Math.sin(a) * l}
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
          />
        );
      })}
      <circle r={13 * Math.max(bloom, 0.4)} fill={color} />
    </svg>
  );
};

/** Mancha luminosa (el "blob" de luz que barre palabras en la referencia). */
export const GlowBlob: React.FC<{
  w: number;
  h: number;
  color?: string;
  glow?: string;
  rotate?: number;
  style?: React.CSSProperties;
}> = ({w, h, color = C.spark, glow = C.coral, rotate = 0, style}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: '50%',
      background: `radial-gradient(ellipse at 45% 40%, #FFFFFF 0%, ${color} 55%, ${glow} 100%)`,
      boxShadow: `0 0 ${w * 0.25}px ${glow}, 0 0 ${w * 0.6}px ${glow}88`,
      transform: `rotate(${rotate}deg)`,
      ...style,
    }}
  />
);

/** Puntero de mouse estilizado. */
export const Cursor: React.FC<{size?: number; color?: string; style?: React.CSSProperties}> = ({
  size = 44,
  color = C.glow,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible', filter: `drop-shadow(0 0 8px ${color})`, ...style}}>
    <path d="M2 2 L21 10 L12.5 12.5 L10 21 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth={1.5} />
  </svg>
);
