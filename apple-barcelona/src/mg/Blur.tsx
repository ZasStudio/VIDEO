import React from 'react';

// Desenfoque de movimiento direccional barato: filtros SVG con desviación solo en X (o Y).
// Se referencian desde CSS con `filter: url(#mbx-6)`. Niveles 1..MB_LEVELS.
export const MB_LEVELS = 12;
const STEP = 2.2; // px de desviación por nivel

export const BlurDefs: React.FC = () => (
  <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
    <defs>
      {Array.from({length: MB_LEVELS}, (_, i) => i + 1).map((k) => (
        <React.Fragment key={k}>
          <filter id={`mbx-${k}`} x="-50%" y="-10%" width="200%" height="120%">
            <feGaussianBlur stdDeviation={`${k * STEP} 0`} />
          </filter>
          <filter id={`mby-${k}`} x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation={`0 ${k * STEP}`} />
          </filter>
        </React.Fragment>
      ))}
    </defs>
  </svg>
);

/** Filtro CSS de desenfoque direccional para una cantidad 0..1 (0 = nítido). */
export const motionBlur = (amount: number, axis: 'x' | 'y' = 'x'): string | undefined => {
  const k = Math.round(Math.max(0, Math.min(1, amount)) * MB_LEVELS);
  return k > 0 ? `url(#mb${axis}-${k})` : undefined;
};
