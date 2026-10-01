import React from 'react';
import {useCurrentFrame} from 'remotion';

// Vidrio esmerilado (glassmorphism): desenfoca y satura lo que hay detrás, borde con luz,
// brillo interior arriba y un reflejo especular que recorre la superficie lentamente.
export const glassStyle = (tint = 'rgba(255,255,255,0.16)', radius = 32): React.CSSProperties => ({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: radius,
  background: `linear-gradient(140deg, ${tint} 0%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.02) 100%)`,
  backdropFilter: 'blur(26px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(26px) saturate(1.8)',
  border: '1.5px solid rgba(255,255,255,0.30)',
  boxShadow:
    'inset 0 1.5px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(255,255,255,0.08), inset 0 0 30px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.45)',
});

export const Glass: React.FC<{
  children?: React.ReactNode;
  tint?: string;
  radius?: number;
  style?: React.CSSProperties;
  /** desfase del reflejo para que no todos brillen a la vez */
  phase?: number;
}> = ({children, tint, radius, style, phase = 0}) => {
  const f = useCurrentFrame();
  const sweep = ((f * 1.4 + phase * 60) % 260) - 80; // % del ancho
  return (
    <div style={{...glassStyle(tint, radius), ...style}}>
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          bottom: '-50%',
          left: `${sweep}%`,
          width: '38%',
          rotate: '20deg',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
          pointerEvents: 'none',
        }}
      />
      <div style={{position: 'relative', width: '100%', height: '100%'}}>{children}</div>
    </div>
  );
};
