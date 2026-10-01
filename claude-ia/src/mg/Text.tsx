import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_OUT, clamp01, rand, ramp} from '../anim';
import {C, FONT} from '../theme';

// Tipografía cinética: cada segmento se revela letra por letra con su propio estilo.
// Imita los recursos de la referencia: tecleo con desenfoque, decodificado
// (letras aleatorias que se asientan), palabra destacada con barra de color.

export type Seg = {
  text: string;
  /** frame (local) en que empieza a aparecer el segmento */
  at: number;
  /** frames entre letra y letra */
  speed?: number;
  mode?: 'type' | 'scramble' | 'rise' | 'spread';
  weight?: number;
  color?: string;
  serif?: boolean;
  italic?: boolean;
  /** barra de resaltado detrás de la palabra */
  highlight?: {at: number; color?: string; textColor?: string};
  /** caja de selección con esquinas (como "grow" en la referencia) */
  select?: {at: number; color?: string};
  /** frame en que el segmento desaparece (letra por letra) */
  out?: number;
};

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz0123456789#%&*+<>/';

const Char: React.FC<{
  ch: string;
  i: number;
  seg: Seg;
  frame: number;
  seed: number;
}> = ({ch, i, seg, frame, seed}) => {
  const speed = seg.speed ?? 1.4;
  const t0 = seg.at + i * speed;
  const p = clamp01((frame - t0) / 7);
  const e = EASE_OUT(p);
  let q = 1;
  if (seg.out !== undefined) q = 1 - EASE_OUT(clamp01((frame - (seg.out + i * 0.8)) / 6));
  const vis = e * q;
  if (vis <= 0.001) {
    return <span style={{display: 'inline-block', opacity: 0, whiteSpace: 'pre'}}>{ch}</span>;
  }
  let shown = ch;
  const mode = seg.mode ?? 'type';
  if (mode === 'scramble' && ch !== ' ' && frame < t0 + 9) {
    shown = GLYPHS[Math.floor(rand(seed * 31 + i * 7 + Math.floor(frame / 2)) * GLYPHS.length)];
  }
  let transform = '';
  let blur = (1 - vis) * 10;
  if (mode === 'rise') transform = `translateY(${(1 - e) * 0.6}em)`;
  else if (mode === 'type') transform = `translateX(${(1 - e) * 0.25}em)`;
  else if (mode === 'spread') {
    const sp = 1 - EASE_OUT(clamp01((frame - seg.at - 6) / 22));
    transform = `translateX(${sp * (i - seg.text.length / 2) * 0.35}em)`;
    blur = (1 - vis) * 6;
  }
  return (
    <span
      style={{
        display: 'inline-block',
        whiteSpace: 'pre',
        opacity: vis,
        transform,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
      }}
    >
      {shown}
    </span>
  );
};

export const Segment: React.FC<{seg: Seg; seed: number; dark: boolean}> = ({seg, seed, dark}) => {
  const frame = useCurrentFrame();
  const chars = Array.from(seg.text);
  const hl = seg.highlight;
  const hlP = hl ? ramp(frame, hl.at, hl.at + 10) : 0;
  const hlOut = hl && seg.out !== undefined ? 1 - ramp(frame, seg.out, seg.out + 8) : 1;
  const sel = seg.select;
  const selP = sel ? ramp(frame, sel.at, sel.at + 10) : 0;
  const baseColor = seg.color ?? (dark ? C.white : C.cocoa);
  const color = hl && hlP > 0.5 ? hl.textColor ?? baseColor : baseColor;
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        fontFamily: seg.serif ? FONT.serif : FONT.sans,
        fontStyle: seg.italic ? 'italic' : 'normal',
        fontWeight: seg.serif ? 400 : seg.weight ?? 400,
        color,
      }}
    >
      {hl ? (
        <span
          style={{
            position: 'absolute',
            left: '-0.12em',
            right: '-0.12em',
            top: '0.12em',
            bottom: '0.06em',
            borderRadius: '0.12em',
            background: hl.color ?? `linear-gradient(90deg, ${C.coral}, ${C.amber})`,
            transform: `scaleX(${hlP * hlOut})`,
            transformOrigin: 'left center',
            boxShadow: dark ? `0 0 30px ${C.coral}88` : undefined,
          }}
        />
      ) : null}
      {sel ? <SelectBox p={selP * (seg.out !== undefined ? 1 - ramp(frame, seg.out, seg.out + 6) : 1)} color={sel.color ?? C.glow} /> : null}
      <span style={{position: 'relative'}}>
        {chars.map((ch, i) => (
          <Char key={i} ch={ch} i={i} seg={seg} frame={frame} seed={seed} />
        ))}
      </span>
    </span>
  );
};

const SelectBox: React.FC<{p: number; color: string}> = ({p, color}) => {
  if (p <= 0) return null;
  const dot = (s: React.CSSProperties) => (
    <span style={{position: 'absolute', width: 9, height: 9, borderRadius: 2, background: color, ...s}} />
  );
  return (
    <span
      style={{
        position: 'absolute',
        left: '-0.18em',
        right: '-0.18em',
        top: '0.05em',
        bottom: '-0.02em',
        border: `2px solid ${color}`,
        opacity: p,
        transform: `scale(${1.25 - 0.25 * p})`,
        borderRadius: 4,
      }}
    >
      {dot({left: -6, top: -6})}
      {dot({right: -6, top: -6})}
      {dot({left: -6, bottom: -6})}
      {dot({right: -6, bottom: -6})}
    </span>
  );
};

/** Una línea de texto formada por segmentos. */
export const Line: React.FC<{
  segs: Seg[];
  size: number;
  dark?: boolean;
  seed?: number;
  tracking?: number;
  style?: React.CSSProperties;
}> = ({segs, size, dark = true, seed = 1, tracking = -0.01, style}) => (
  <div
    style={{
      fontSize: size,
      lineHeight: 1.15,
      letterSpacing: `${tracking}em`,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {segs.map((s, i) => (
      <Segment key={i} seg={s} seed={seed * 13 + i} dark={dark} />
    ))}
  </div>
);
