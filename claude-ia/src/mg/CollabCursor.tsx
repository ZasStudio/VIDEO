import React from 'react';
import {FONT} from '../theme';

// Cursor multijugador tipo Figma: flecha + etiqueta con el nombre.
// `side` indica hacia dónde apunta la flecha (y de qué lado queda la etiqueta).
export const CollabCursor: React.FC<{
  name: string;
  color: string;
  side: 'left' | 'right';
  press?: number; // 0..1, hundimiento al hacer clic
  style?: React.CSSProperties;
}> = ({name, color, side, press = 0, style}) => {
  const flip = side === 'right' ? -1 : 1;
  return (
    <div style={{position: 'absolute', scale: String(1 - 0.12 * press), ...style}}>
      {/* La punta de la flecha está en (0,0) del contenedor */}
      <svg
        width={44}
        height={44}
        viewBox="0 0 24 24"
        style={{position: 'absolute', left: side === 'right' ? 0 : -44, top: 0, scale: `${flip} 1`, overflow: 'visible'}}
      >
        <path d="M 24 0 L 5 7.5 L 12.5 11.5 L 16.5 19 Z" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 46,
          ...(side === 'right' ? {left: 6} : {right: 12}),
          padding: '14px 30px',
          borderRadius: 40,
          background: color,
          color: '#FFFFFF',
          fontFamily: FONT.sans,
          fontWeight: 600,
          fontSize: 38,
          whiteSpace: 'nowrap',
          boxShadow: `0 10px 30px ${color}55`,
        }}
      >
        {name}
      </div>
    </div>
  );
};
