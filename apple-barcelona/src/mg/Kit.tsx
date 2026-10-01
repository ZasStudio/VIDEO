import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_OUT, clamp01} from '../anim';
import {FPS} from '../edit';
import {C, FONT, TEXT_GRADIENT} from '../theme';
import {findPhrase, type Word} from '../words';
import {BlurDefs, motionBlur} from './Blur';

// Kit para los interludios de motion graphics: fondo azul que se degrada a negro y
// tipografía con jerarquía (etiquetas pequeñas espaciadas, palabras grandes, acentos serif).
// Todo se sincroniza con las palabras de la voz (tiempos de la línea editada).

export const BLUE = C.blue;
export const SKY = C.sky;

export const useMs = () => (useCurrentFrame() / FPS) * 1000;

/** 0..1 con frenado largo, empezando un poco antes de que se diga la palabra. */
export const revealAt = (ms: number, startMs: number, dur = 320) => EASE_OUT(clamp01((ms - startMs + 90) / dur));

export const wordsOf = (phrase: string): Word[] => findPhrase(phrase);
export const t0 = (phrase: string) => findPhrase(phrase)[0].startMs;

/** Fondo: azul profundo arriba que se degrada a negro, con brillos azules que respiran. */
export const BlackStage: React.FC<{children: React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #0B2A63 0%, #071A3D 30%, #030914 70%, #000000 100%)'}}>
      <BlurDefs />
      <div
        style={{
          position: 'absolute',
          left: -260 + Math.sin(f / 40) * 50,
          top: -200 + Math.cos(f / 50) * 50,
          width: 1100,
          height: 1100,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(61,139,255,0.38) 0%, transparent 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 420 + Math.cos(f / 45) * 50,
          top: 700 + Math.sin(f / 38) * 50,
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(140,200,255,0.12) 0%, transparent 65%)',
        }}
      />
      {children}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.65) 100%)'}} />
      <AbsoluteFill style={{opacity: 0.06, mixBlendMode: 'overlay'}}>
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

export type Tone = 'label' | 'light' | 'bold' | 'serif';

const toneStyle = (tone: Tone): React.CSSProperties => {
  switch (tone) {
    case 'label':
      return {fontFamily: FONT.sans, fontWeight: 600, letterSpacing: '0.32em', textTransform: 'uppercase', color: C.ice};
    case 'light':
      return {fontFamily: FONT.sans, fontWeight: 300, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.88)'};
    case 'serif':
      return {fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.01em', color: C.white};
    default:
      return {fontFamily: FONT.sans, fontWeight: 800, letterSpacing: '-0.035em', color: C.white};
  }
};

/**
 * Línea de texto sincronizada: cada palabra entra (sube + desenfoque de movimiento)
 * justo cuando él la dice. `grad` aplica el degradado blanco -> azul a esas palabras.
 */
export const SyncLine: React.FC<{
  phrase: string;
  display?: string[];
  size: number;
  tone?: Tone;
  grad?: number[] | 'all';
  gradient?: string;
  align?: 'left' | 'center';
  style?: React.CSSProperties;
  lead?: number;
}> = ({phrase, display, size, tone = 'bold', grad = [], gradient = TEXT_GRADIENT, align = 'center', style, lead = 0}) => {
  const ms = useMs();
  const words = wordsOf(phrase);
  return (
    <div style={{...toneStyle(tone), fontSize: size, lineHeight: 1.04, textAlign: align, whiteSpace: 'nowrap', ...style}}>
      {words.map((w, i) => {
        const e = revealAt(ms, w.startMs - lead);
        const g = grad === 'all' || grad.includes(i);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: i < words.length - 1 ? (tone === 'label' ? '0.5em' : '0.24em') : 0,
              opacity: e,
              translate: `0px ${(1 - e) * 0.45}em`,
              filter: motionBlur((1 - e) * 0.9, 'y'),
              ...(g ? {backgroundImage: gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', paddingBottom: '0.08em'} : {}),
            }}
          >
            {display?.[i] ?? w.text}
          </span>
        );
      })}
    </div>
  );
};

/** Línea fina decorativa que se dibuja (de izquierda a derecha o desde el centro). */
export const Hairline: React.FC<{p: number; width: number; color?: string; center?: boolean; style?: React.CSSProperties}> = ({
  p,
  width,
  color = SKY,
  center = true,
  style,
}) => (
  <div
    style={{
      width,
      height: 2,
      margin: center ? '0 auto' : undefined,
      borderRadius: 1,
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      scale: `${p} 1`,
      transformOrigin: center ? 'center' : 'left center',
      ...style,
    }}
  />
);

/** Estrella de 4 puntas (destello). */
export const Twinkle: React.FC<{size: number; color?: string; rotate?: number; style?: React.CSSProperties}> = ({
  size,
  color = SKY,
  rotate = 0,
  style,
}) => (
  <svg width={size} height={size} viewBox="-10 -10 20 20" style={{rotate: `${rotate}deg`, overflow: 'visible', filter: `drop-shadow(0 0 ${size * 0.15}px ${color})`, ...style}}>
    <path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10 Z" fill={color} />
  </svg>
);
