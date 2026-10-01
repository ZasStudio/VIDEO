import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, clamp01, ramp} from './anim';
import {FPS} from './edit';
import {C, FONT, TEXT_GRADIENT, TEXT_GRADIENT_BLUE, TEXT_SHADOW} from './theme';
import {findPhrase} from './words';

// Textos sobre el video: sin cajas, con jerarquía tipográfica (etiqueta pequeña espaciada,
// línea ligera, palabra grande o serif cursiva) y entradas que suben con desenfoque.

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

const LABEL: React.CSSProperties = {
  fontFamily: FONT.sans,
  fontWeight: 600,
  fontSize: 28,
  letterSpacing: '0.34em',
  textTransform: 'uppercase',
  color: C.white,
  textShadow: TEXT_SHADOW,
};

const gradText = (g = TEXT_GRADIENT): React.CSSProperties => ({
  backgroundImage: g,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))',
});

const Pin: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{marginRight: 14, verticalAlign: '-0.12em'}}>
    <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill={C.blue} />
    <circle cx="12" cy="10" r="2.6" fill="#fff" />
  </svg>
);

const Line: React.FC<{p: number; width: number}> = ({p, width}) => (
  <div
    style={{
      width,
      height: 2,
      margin: '18px auto 0',
      background: `linear-gradient(90deg, transparent, ${C.sky}, transparent)`,
      scale: `${p} 1`,
    }}
  />
);

/** Gancho inicial: ubicación (etiqueta) + "Cumpliendo / un sueño". */
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const end = sec(3.7);
  const shade = EASE_OUT(clamp01(f / 10)) * (1 - EASE_IN_OUT(clamp01((f - end + 6) / 12)));
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      {/* sombra azul suave arriba para que el título se lea sobre la fachada clara (sin recuadro) */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(3,14,38,0.78) 0%, rgba(3,14,38,0.55) 22%, rgba(3,14,38,0.0) 40%)', opacity: shade}} />
      <div style={{position: 'absolute', top: 210, textAlign: 'center', ...rise(f, 4, end, -20)}}>
        <div style={LABEL}>
          <Pin size={30} />
          Apple Store · Barcelona
        </div>
        <Line p={EASE_OUT(clamp01((f - 8) / 16))} width={260} />
      </div>
      <div style={{position: 'absolute', top: 300, textAlign: 'center'}}>
        <div style={{fontFamily: FONT.sans, fontWeight: 300, fontSize: 70, color: C.white, textShadow: TEXT_SHADOW, ...rise(f, 10, end, 30)}}>
          Cumpliendo
        </div>
        <div style={{fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 168, lineHeight: 1, ...gradText(), ...rise(f, 15, end + 2, 40)}}>
          un sueño
        </div>
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
      <div style={{position: 'absolute', top: 230, textAlign: 'center', ...rise(f, from, to, -20)}}>
        <div style={LABEL}>MacBook Pro 16”</div>
        <Line p={EASE_OUT(clamp01((f - from - 4) / 14))} width={220} />
      </div>
    </AbsoluteFill>
  );
};

export type QuoteLine = {words: string[]; tone: 'light' | 'bold' | 'serif'; size: number; grad?: boolean};

/**
 * Cita sincronizada con la voz, con jerarquía por línea (ligera / negrita / serif).
 * Cada palabra aparece cuando la dice; reemplaza a los subtítulos en ese tramo.
 */
export const SpokenQuote: React.FC<{lines: QuoteLine[]; from: number; to: number}> = ({lines, from, to}) => {
  const f = useCurrentFrame();
  if (f < from - 2 || f > to) return null;
  const ms = (f / FPS) * 1000;
  const dim = EASE_OUT(clamp01((f - from) / 12)) * (1 - EASE_IN_OUT(clamp01((f - (to - 10)) / 10)));
  const words = lines.map((l) => findPhrase(l.words.join(' ')));
  return (
    <AbsoluteFill>
      {/* oscurece el video hacia el azul de la paleta, sin recuadro */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(4,16,40,0.15) 0%, rgba(3,10,26,0.62) 40%, rgba(3,10,26,0.62) 65%, rgba(0,0,0,0.2) 100%)', opacity: dim}} />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: 1 - EASE_IN_OUT(clamp01((f - (to - 10)) / 10))}}>
        <div style={{textAlign: 'center', padding: '0 60px'}}>
          {lines.map((line, li) => (
            <div
              key={li}
              style={{
                fontFamily: line.tone === 'serif' ? FONT.serif : FONT.sans,
                fontStyle: line.tone === 'serif' ? 'italic' : 'normal',
                fontWeight: line.tone === 'bold' ? 800 : line.tone === 'light' ? 300 : 400,
                letterSpacing: line.tone === 'bold' ? '-0.035em' : '-0.01em',
                fontSize: line.size,
                lineHeight: 1.04,
                color: C.white,
                textShadow: line.grad ? undefined : TEXT_SHADOW,
                marginTop: li ? 10 : 0,
                whiteSpace: 'nowrap',
              }}
            >
              {line.words.map((txt, wi) => {
                const w = words[li][wi];
                const e = EASE_OUT(clamp01((ms - w.startMs + 60) / 280));
                return (
                  <span
                    key={wi}
                    style={{
                      display: 'inline-block',
                      marginRight: wi < line.words.length - 1 ? '0.24em' : 0,
                      opacity: e,
                      translate: `0px ${(1 - e) * 0.35}em`,
                      ...(line.grad ? gradText(line.tone === 'serif' ? TEXT_GRADIENT_BLUE : TEXT_GRADIENT) : {}),
                      filter: e < 0.98 ? `blur(${(1 - e) * 9}px)` : line.grad ? 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))' : undefined,
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

/** Cierre: "Cada esfuerzo / es un logro." sobre la celebración. */
export const EndCard: React.FC<{from: number}> = ({from}) => {
  const f = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  if (f < from) return null;
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center'}}>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 40%, rgba(4,16,40,0.55) 75%, rgba(0,0,0,0.85) 100%)', opacity: ramp(f, from, from + 12)}} />
      <div style={{position: 'absolute', bottom: 300, textAlign: 'center'}}>
        <div style={{...LABEL, ...rise(f, from, durationInFrames + 20, 24)}}>Cada esfuerzo</div>
        <div style={{fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 150, lineHeight: 1.05, marginTop: 12, ...gradText(TEXT_GRADIENT_BLUE), ...rise(f, from + 4, durationInFrames + 20, 36)}}>
          es un logro.
        </div>
        <Line p={EASE_OUT(clamp01((f - from - 10) / 16))} width={240} />
      </div>
    </AbsoluteFill>
  );
};
