import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, appear, clamp01, ramp} from './anim';
import {FPS} from './edit';
import {C, FONT, TEXT_SHADOW} from './theme';
import {findPhrase} from './words';
import {glassStyle} from './mg/GlassCss';

// Títulos y tarjetas: limpios, estilo Apple (vidrio esmerilado, serif cursiva para las citas),
// con entradas que suben con desenfoque y frenan despacio.

const sec = (s: number) => Math.round(s * FPS);

/** Entrada/salida con ascenso y desenfoque (frenado largo). */
const rise = (f: number, start: number, end: number, dist = 30) => {
  const pin = EASE_OUT(clamp01((f - start) / 14));
  const pout = EASE_IN_OUT(clamp01((f - (end - 10)) / 10));
  const v = pin * (1 - pout);
  return {
    opacity: v,
    translate: `0px ${(1 - pin) * dist - pout * dist * 0.6}px`,
    filter: v < 0.98 ? `blur(${(1 - v) * 10}px)` : undefined,
  } as const;
};

const Pin: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="#FF5A5F" />
    <circle cx="12" cy="10" r="2.6" fill="#fff" />
  </svg>
);

const Laptop: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path d="M2 19h20" />
  </svg>
);

const Chip: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 14,
      ...glassStyle('rgba(255,255,255,0.20)', 999),
      padding: '16px 30px',
      color: C.white,
      fontFamily: FONT.sans,
      fontWeight: 700,
      fontSize: 38,
      letterSpacing: '0.01em',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Gancho inicial: ubicación + título. */
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const end = sec(3.7);
  const title = ['Cumpliendo', 'un', 'sueño'];
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 210, ...rise(f, 4, end, -24)}}>
        <Chip>
          <Pin size={40} />
          Apple Store · Barcelona
        </Chip>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 320,
          fontFamily: FONT.serif,
          fontStyle: 'italic',
          fontSize: 112,
          color: C.white,
          textShadow: TEXT_SHADOW,
          whiteSpace: 'nowrap',
        }}
      >
        {title.map((w, i) => (
          <span key={i} style={{display: 'inline-block', marginRight: '0.22em', ...rise(f, 10 + i * 4, end + i * 2, 40)}}>
            {w}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Etiqueta de producto cuando aparece la página del MacBook en pantalla. */
export const ProductChip: React.FC<{from: number; to: number}> = ({from, to}) => {
  const f = useCurrentFrame();
  if (f < from || f > to) return null;
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 230, ...rise(f, from, to, -24)}}>
        <Chip>
          <Laptop size={42} />
          MacBook Pro 16”
        </Chip>
      </div>
    </AbsoluteFill>
  );
};

/** Etiqueta de capítulo. */
export const ChapterChip: React.FC<{from: number; to: number; text: string}> = ({from, to, text}) => {
  const f = useCurrentFrame();
  if (f < from || f > to) return null;
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 230, ...rise(f, from, to, -24)}}>
        <Chip style={{fontWeight: 600}}>{text}</Chip>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Cita grande sincronizada con la voz: cada palabra aparece cuando la dice
 * (reemplaza a los subtítulos en ese tramo).
 */
export const SpokenQuote: React.FC<{
  lines: string[][];
  from: number;
  to: number;
  serif?: boolean;
  accent?: string[];
  size?: number;
}> = ({lines, from, to, serif = true, accent = [], size = 104}) => {
  const f = useCurrentFrame();
  if (f < from - 2 || f > to) return null;
  const ms = (f / FPS) * 1000;
  const dim = EASE_OUT(clamp01((f - from) / 12)) * (1 - EASE_IN_OUT(clamp01((f - (to - 10)) / 10)));
  const words = lines.map((l) => findPhrase(l.join(' ')));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.35) 0%, transparent 75%)', opacity: dim}} />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: 1 - EASE_IN_OUT(clamp01((f - (to - 10)) / 10))}}>
        <div
          style={{
            ...glassStyle('rgba(255,255,255,0.14)', 48),
            textAlign: 'center',
            padding: '54px 56px',
            margin: '0 50px',
            opacity: dim,
            scale: String(0.94 + 0.06 * dim),
          }}
        >
          {lines.map((line, li) => (
            <div
              key={li}
              style={{
                fontFamily: serif ? FONT.serif : FONT.sans,
                fontStyle: serif ? 'italic' : 'normal',
                fontWeight: serif ? 400 : 800,
                fontSize: size,
                lineHeight: 1.12,
                color: C.white,
                textShadow: TEXT_SHADOW,
                marginTop: li ? 18 : 0,
              }}
            >
              {line.map((txt, wi) => {
                const w = words[li][wi];
                const t = clamp01((ms - w.startMs + 60) / 260);
                const e = EASE_OUT(t);
                return (
                  <span
                    key={wi}
                    style={{
                      display: 'inline-block',
                      marginRight: '0.24em',
                      color: accent.includes(txt) ? C.key : C.white,
                      opacity: e,
                      translate: `0px ${(1 - e) * 0.35}em`,
                      filter: e < 0.98 ? `blur(${(1 - e) * 9}px)` : undefined,
                    }}
                  >
                    {txt}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Cierre: frase final sobre la celebración. */
export const EndCard: React.FC<{from: number}> = ({from}) => {
  const f = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  if (f < from) return null;
  const line = appear(f, from + 2, 0.94);
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center'}}>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.6) 100%)', opacity: ramp(f, from, from + 12)}} />
      <div
        style={{
          position: 'absolute',
          bottom: 300,
          textAlign: 'center',
          ...glassStyle('rgba(255,255,255,0.14)', 40),
          padding: '34px 50px 30px',
          ...rise(f, from, durationInFrames + 20, 36),
        }}
      >
        <div style={{fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 96, color: C.white, textShadow: TEXT_SHADOW}}>
          Cada esfuerzo es un logro.
        </div>
        <div
          style={{
            margin: '26px auto 0',
            width: 220,
            height: 3,
            borderRadius: 2,
            background: C.key,
            opacity: line.opacity,
            scale: `${Number(line.scale) * ramp(f, from + 4, from + 20)} 1`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
