import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_OUT, clamp01} from '../anim';
import {FPS} from '../edit';
import {C, FONT} from '../theme';
import {findPhrase, type Word} from '../words';
import {BlurDefs, motionBlur} from './Blur';

// Kit para los interludios de motion graphics sobre negro.
// Todo se sincroniza con las palabras de la voz (tiempos de la línea editada).

export const PINK = C.key;
export const YELLOW = C.active;

export const useMs = () => (useCurrentFrame() / FPS) * 1000;

/** 0..1 con frenado largo, empezando un poco antes de que se diga la palabra. */
export const revealAt = (ms: number, startMs: number, dur = 320) => EASE_OUT(clamp01((ms - startMs + 90) / dur));

export const wordsOf = (phrase: string): Word[] => findPhrase(phrase);
export const t0 = (phrase: string) => findPhrase(phrase)[0].startMs;

/** Fondo negro con dos brillos suaves (rosa y amarillo) que respiran, viñeta y grano. */
export const BlackStage: React.FC<{children: React.ReactNode; hue?: 'pink' | 'yellow'}> = ({children, hue = 'pink'}) => {
  const f = useCurrentFrame();
  const a = hue === 'pink' ? 'rgba(255,143,163,0.20)' : 'rgba(255,212,59,0.16)';
  const b = hue === 'pink' ? 'rgba(255,212,59,0.10)' : 'rgba(255,143,163,0.12)';
  return (
    <AbsoluteFill style={{background: '#050506'}}>
      <BlurDefs />
      <div
        style={{
          position: 'absolute',
          left: -300 + Math.sin(f / 40) * 60,
          top: 150 + Math.cos(f / 50) * 60,
          width: 1100,
          height: 1100,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${a} 0%, transparent 65%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 380 + Math.cos(f / 45) * 60,
          top: 1050 + Math.sin(f / 38) * 60,
          width: 1000,
          height: 1000,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${b} 0%, transparent 65%)`,
        }}
      />
      {children}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.7) 100%)'}} />
      <AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'overlay'}}>
        <svg width="100%" height="100%">
          <filter id="g">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed={f % 7} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#g)" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Línea de texto sincronizada: cada palabra entra (sube + desenfoque de movimiento)
 * justo cuando él la dice. `display` permite cambiar mayúsculas/puntuación por palabra.
 */
export const SyncLine: React.FC<{
  phrase: string;
  display?: string[];
  size: number;
  weight?: number;
  color?: string;
  colors?: Record<number, string>;
  serif?: boolean;
  align?: 'left' | 'center';
  style?: React.CSSProperties;
  /** desplaza la entrada de todas las palabras (ms) */
  lead?: number;
}> = ({phrase, display, size, weight = 800, color = C.white, colors = {}, serif, align = 'center', style, lead = 0}) => {
  const ms = useMs();
  const words = wordsOf(phrase);
  return (
    <div
      style={{
        fontFamily: serif ? FONT.serif : FONT.sans,
        fontStyle: serif ? 'italic' : 'normal',
        fontWeight: serif ? 400 : weight,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: serif ? 0 : '-0.02em',
        color,
        textAlign: align,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {words.map((w, i) => {
        const e = revealAt(ms, w.startMs - lead);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: i < words.length - 1 ? '0.24em' : 0,
              color: colors[i] ?? color,
              opacity: e,
              translate: `0px ${(1 - e) * 0.45}em`,
              filter: motionBlur((1 - e) * 0.9, 'y'),
            }}
          >
            {display?.[i] ?? w.text}
          </span>
        );
      })}
    </div>
  );
};

/** Barra de resaltado que se dibuja detrás de un texto (de izquierda a derecha). */
export const Highlight: React.FC<{p: number; color: string; children: React.ReactNode}> = ({p, color, children}) => (
  <span style={{position: 'relative', display: 'inline-block'}}>
    <span
      style={{
        position: 'absolute',
        left: '-0.12em',
        right: '-0.12em',
        top: '0.14em',
        bottom: '0.04em',
        borderRadius: '0.14em',
        background: color,
        scale: `${p} 1`,
        transformOrigin: 'left center',
      }}
    />
    <span style={{position: 'relative'}}>{children}</span>
  </span>
);

/** Tarjeta de vidrio para íconos. */
export const IconTile: React.FC<{size: number; children: React.ReactNode; tint?: string}> = ({size, children, tint = 'rgba(255,255,255,0.08)'}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: `linear-gradient(150deg, ${tint}, rgba(255,255,255,0.03))`,
      border: '1.5px solid rgba(255,255,255,0.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
    }}
  >
    {children}
  </div>
);

/** Estrella de 4 puntas (destello). */
export const Twinkle: React.FC<{size: number; color?: string; rotate?: number; style?: React.CSSProperties}> = ({
  size,
  color = YELLOW,
  rotate = 0,
  style,
}) => (
  <svg width={size} height={size} viewBox="-10 -10 20 20" style={{rotate: `${rotate}deg`, overflow: 'visible', filter: `drop-shadow(0 0 ${size * 0.15}px ${color})`, ...style}}>
    <path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10 Z" fill={color} />
  </svg>
);
