import {getLength} from '@remotion/paths';
import React, {useMemo} from 'react';
import {C, FONT} from '../theme';

// Cinta gruesa con degradado (como las cintas verdes de la referencia).
// head/tail en 0..1 controlan qué tramo del trazo está visible.
export const Ribbon: React.FC<{
  id: string;
  d: string;
  width: number;
  head: number;
  tail?: number;
  from?: [number, number];
  to?: [number, number];
  stops?: string[];
  text?: string;
  textSize?: number;
  /** desplazamiento del texto a lo largo del trazo, en px */
  textOffset?: number;
  textOpacity?: number;
  shadow?: boolean;
}> = ({
  id,
  d,
  width,
  head,
  tail = 0,
  from = [0, 0],
  to = [1920, 1080],
  stops = [C.cocoa, C.clay, C.amber],
  text,
  textSize = 30,
  textOffset = 0,
  textOpacity = 1,
  shadow = true,
}) => {
  const L = useMemo(() => getLength(d), [d]);
  const vis = Math.max(0, head - tail) * L;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs>
        <linearGradient id={`g-${id}`} gradientUnits="userSpaceOnUse" x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}>
          {stops.map((s, i) => (
            <stop key={i} offset={i / (stops.length - 1)} stopColor={s} />
          ))}
        </linearGradient>
        <path id={`p-${id}`} d={d} />
      </defs>
      {vis > 0.5 ? (
        <>
          <path
            d={d}
            fill="none"
            stroke={`url(#g-${id})`}
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray={`${vis} ${L * 2}`}
            strokeDashoffset={-tail * L}
            style={shadow ? {filter: 'drop-shadow(0 18px 24px rgba(120,60,30,0.25))'} : undefined}
          />
          {text ? (
            <text
              fontFamily={FONT.sans}
              fontWeight={700}
              fontSize={textSize}
              fill={C.cream}
              opacity={textOpacity}
              dominantBaseline="central"
              letterSpacing={1}
            >
              <textPath href={`#p-${id}`} startOffset={textOffset}>
                {text}
              </textPath>
            </text>
          ) : null}
        </>
      ) : null}
    </svg>
  );
};

/** Sticker circular con un dibujo a línea (foco, código o globo de chat). */
export const Sticker: React.FC<{size: number; icon: 'bulb' | 'code' | 'chat' | 'pen'; style?: React.CSSProperties}> = ({
  size,
  icon,
  style,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #FFF4EA, #F6CDB2)',
      border: `2px solid rgba(194,96,58,0.35)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 10px 24px rgba(120,60,30,0.18)',
      ...style,
    }}
  >
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke={C.clay} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {icon === 'bulb' ? (
        <>
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z" />
        </>
      ) : icon === 'code' ? (
        <>
          <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
        </>
      ) : icon === 'chat' ? (
        <>
          <path d="M4 5h16v11H9l-5 4z" />
          <path d="M8 10h8M8 13h5" />
        </>
      ) : (
        <>
          <path d="M4 20l4-1L19 8l-3-3L5 16z" />
          <path d="M14 7l3 3" />
        </>
      )}
    </svg>
  </div>
);
