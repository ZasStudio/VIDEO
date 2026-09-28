import React from 'react';
import {interpolate} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, pop, ramp, rand} from '../anim';
import {C, FONT} from '../theme';

// Urban motion-graphics building blocks (all procedural).

// ---------- Background ----------

export const UrbanBackground: React.FC<{
  frame: number;
  word?: string;
  dark?: boolean;
  dots?: boolean;
}> = ({frame, word, dark, dots = true}) => {
  const base = dark ? '#150A0D' : C.red;
  const dotColor = dark ? '#3A1119' : '#C8102A';
  return (
    <div style={{position: 'absolute', inset: 0, background: base, overflow: 'hidden'}}>
      <svg width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id={`dots-${dark ? 'd' : 'r'}`} width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <circle cx="13" cy="13" r="5" fill={dotColor} />
          </pattern>
          <radialGradient id={`dotsMask-g-${dark ? 'd' : 'r'}`} cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.35" stopColor="black" />
            <stop offset="1" stopColor="white" />
          </radialGradient>
          <mask id={`dotsMask-${dark ? 'd' : 'r'}`}>
            <rect width="1920" height="1080" fill={`url(#dotsMask-g-${dark ? 'd' : 'r'})`} />
          </mask>
          <radialGradient id={`vig-${dark ? 'd' : 'r'}`} cx="0.5" cy="0.45" r="0.8">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity={dark ? 0.6 : 0.28} />
          </radialGradient>
        </defs>
        {dots ? (
          <rect width="1920" height="1080" fill={`url(#dots-${dark ? 'd' : 'r'})`} mask={`url(#dotsMask-${dark ? 'd' : 'r'})`} />
        ) : null}
        {word ? (
          <text
            x={960 - ((frame * 1.2) % 400)}
            y={760}
            textAnchor="middle"
            fontFamily={FONT.display}
            fontSize={620}
            fill="none"
            stroke={dark ? '#2A0E14' : '#FF4A5A'}
            strokeWidth={4}
            opacity={0.55}
            letterSpacing={20}
          >
            {`${word} ${word}`}
          </text>
        ) : null}
        <rect width="1920" height="1080" fill={`url(#vig-${dark ? 'd' : 'r'})`} />
      </svg>
    </div>
  );
};

// ---------- Corner crosshairs (poster homage) ----------

export const CornerMarks: React.FC<{frame: number; start?: number; color?: string; inset?: number}> = ({
  frame,
  start = 0,
  color = 'rgba(255,255,255,0.85)',
  inset = 70,
}) => {
  const s = ramp(frame, start, start + 14);
  const len = 34 * s;
  const pts = [
    [inset, inset],
    [1920 - inset, inset],
    [inset, 1080 - inset],
    [1920 - inset, 1080 - inset],
  ];
  return (
    <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {pts.map(([x, y], i) => (
        <g key={i} stroke={color} strokeWidth={2.5}>
          <path d={`M${x - len},${y} L${x + len},${y}`} />
          <path d={`M${x},${y - len} L${x},${y + len}`} />
        </g>
      ))}
    </svg>
  );
};

// ---------- Ticker tape ----------

export const Ticker: React.FC<{
  frame: number;
  text: string;
  y: number;
  rotate?: number;
  speed?: number;
  bg?: string;
  color?: string;
  accent?: string;
  height?: number;
  enter?: number; // frame when the tape slides in
}> = ({frame, text, y, rotate = -4, speed = 4, bg = C.ink, color = C.white, accent = C.red, height = 74, enter = -100}) => {
  const slide = ramp(frame, enter, enter + 14, [-2600, 0]);
  const items = [...Array(14)].map((_, i) => i);
  const offset = -((frame * speed) % 700);
  return (
    <div
      style={{
        position: 'absolute',
        left: -300,
        width: 2520,
        top: y - height / 2,
        height,
        background: bg,
        rotate: `${rotate}deg`,
        translate: `${slide}px 0px`,
        overflow: 'hidden',
        boxShadow: '0 10px 0 rgba(0,0,0,0.25)',
        borderTop: `4px solid ${accent}`,
        borderBottom: `4px solid ${accent}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: offset,
          top: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 38,
          whiteSpace: 'nowrap',
          fontFamily: FONT.display,
          fontSize: height * 0.56,
          color,
          letterSpacing: 2,
        }}
      >
        {items.map((i) => (
          <React.Fragment key={i}>
            <span>{text}</span>
            <span style={{color: accent}}>✦</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ---------- Sticker ----------

export const Sticker: React.FC<{
  frame: number;
  start: number;
  x: number;
  y: number;
  rotate?: number;
  bg?: string;
  color?: string;
  font?: string;
  size?: number;
  children: React.ReactNode;
  exit?: number;
  padding?: string;
  anchor?: 'center' | 'left';
}> = ({frame, start, x, y, rotate = -6, bg = C.yellow, color = C.ink, font = FONT.display, size = 64, children, exit, padding = '0.12em 0.4em', anchor = 'center'}) => {
  const s = pop(frame, start, {damping: 9, stiffness: 190});
  const out = exit !== undefined ? ramp(frame, exit, exit + 8, [1, 0], EASE_IN_OUT) : 1;
  if (frame < start) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        translate: anchor === 'center' ? '-50% -50%' : '0 -50%',
        rotate: `${rotate + (1 - s) * 18}deg`,
        scale: `${Math.max(0, s * out)}`,
        transformOrigin: anchor === 'center' ? '50% 50%' : '0% 50%',
        background: bg,
        color,
        fontFamily: font,
        fontSize: size,
        lineHeight: 1.05,
        padding,
        borderRadius: size * 0.16,
        border: `${Math.max(4, size * 0.08)}px solid ${C.white}`,
        boxShadow: `0 0 0 ${Math.max(3, size * 0.05)}px ${C.ink}, ${size * 0.12}px ${size * 0.14}px 0 ${Math.max(3, size * 0.05)}px rgba(0,0,0,0.35)`,
        whiteSpace: 'nowrap',
        letterSpacing: 1,
      }}
    >
      {children}
    </div>
  );
};

// ---------- Kinetic block title ----------

export const BlockTitle: React.FC<{
  frame: number;
  start: number;
  text: string;
  x: number;
  y: number;
  size: number;
  color?: string;
  stroke?: string;
  shadow?: string;
  align?: 'left' | 'center' | 'right';
  stagger?: number;
  rotate?: number;
  exit?: number;
  font?: string;
}> = ({frame, start, text, x, y, size, color = C.white, stroke = C.ink, shadow = C.ink, align = 'left', stagger = 2, rotate = 0, exit, font = FONT.display}) => {
  const out = exit !== undefined ? ramp(frame, exit, exit + 10, [0, 1], EASE_IN_OUT) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        translate: align === 'center' ? '-50% 0' : align === 'right' ? '-100% 0' : '0 0',
        rotate: `${rotate}deg`,
        whiteSpace: 'nowrap',
        fontFamily: font,
        fontSize: size,
        lineHeight: 1,
        color,
        WebkitTextStroke: `${Math.max(3, size * 0.05)}px ${stroke}`,
        paintOrder: 'stroke fill',
        textShadow: `${size * 0.06}px ${size * 0.07}px 0 ${shadow}`,
        letterSpacing: size * 0.01,
      }}
    >
      {text.split('').map((ch, i) => {
        const s = pop(frame, start + i * stagger, {damping: 10, stiffness: 200});
        const vis = frame >= start + i * stagger;
        const o = out > 0 ? ramp(frame, exit! + i * 1, exit! + i * 1 + 8, [1, 0], EASE_IN_OUT) : 1;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: vis ? o : 0,
              translate: `0 ${(1 - s) * size * 0.6 + (1 - o) * -size * 0.4}px`,
              scale: `${0.4 + 0.6 * s}`,
              whiteSpace: 'pre',
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// ---------- Sparkle (AI) ----------

export const Sparkle: React.FC<{x: number; y: number; size: number; frame: number; start: number; color?: string; spin?: number}> = ({
  x,
  y,
  size,
  frame,
  start,
  color = C.white,
  spin = 1,
}) => {
  if (frame < start) return null;
  const s = pop(frame, start, {damping: 8});
  const tw = 0.85 + 0.15 * Math.sin((frame - start) * 0.4);
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      style={{position: 'absolute', left: x - size / 2, top: y - size / 2, rotate: `${(frame - start) * 2 * spin}deg`, scale: `${s * tw}`, overflow: 'visible'}}
    >
      <path d="M0,-50 C6,-10 10,-6 50,0 C10,6 6,10 0,50 C-6,10 -10,6 -50,0 C-10,-6 -6,-10 0,-50 Z" fill={color} stroke={C.ink} strokeWidth={6} />
    </svg>
  );
};

// ---------- Comic burst lines ----------

export const Burst: React.FC<{x: number; y: number; frame: number; start: number; color?: string; radius?: number; count?: number}> = ({
  x,
  y,
  frame,
  start,
  color = C.white,
  radius = 220,
  count = 14,
}) => {
  const t = frame - start;
  if (t < 0 || t > 16) return null;
  const p = ramp(frame, start, start + 12);
  const fade = 1 - ramp(frame, start + 8, start + 16);
  return (
    <svg width="2" height="2" style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
      {[...Array(count)].map((_, i) => {
        const a = (i / count) * Math.PI * 2 + rand(i) * 0.2;
        const r0 = radius * (0.45 + 0.5 * p);
        const r1 = r0 + radius * 0.35 * (1 - p * 0.6);
        return (
          <line
            key={i}
            x1={Math.cos(a) * r0}
            y1={Math.sin(a) * r0}
            x2={Math.cos(a) * r1}
            y2={Math.sin(a) * r1}
            stroke={color}
            strokeWidth={10 * fade}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

// ---------- Slash wipe transition (centered on `at`) ----------

export const SlashWipe: React.FC<{frame: number; at: number; colors?: string[]; dur?: number}> = ({
  frame,
  at,
  colors = [C.ink, C.white, C.red],
  dur = 12,
}) => {
  if (frame < at - dur || frame > at + dur) return null;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'}}>
      {colors.map((col, i) => {
        const delay = i * 2;
        const pIn = interpolate(frame, [at - dur + delay, at - 1 + delay * 0.3], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_IN_OUT,
        });
        const pOut = interpolate(frame, [at + delay * 0.5, at + dur], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_IN_OUT,
        });
        const left = -2800 + pIn * 2600 + pOut * 2600;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: -400,
              left,
              width: 2600 - i * 180,
              height: 1880,
              background: col,
              rotate: '14deg',
            }}
          />
        );
      })}
    </div>
  );
};

// ---------- Flash ----------

export const Flash: React.FC<{frame: number; at: number; color?: string; dur?: number}> = ({frame, at, color = C.white, dur = 8}) => {
  const o = interpolate(frame, [at - 1, at, at + dur], [0, 0.9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT});
  if (o <= 0) return null;
  return <div style={{position: 'absolute', inset: 0, background: color, opacity: o, pointerEvents: 'none'}} />;
};

// ---------- Film grain ----------

export const Grain: React.FC<{frame: number; opacity?: number}> = ({frame, opacity = 0.07}) => {
  const seed = Math.floor(frame / 2) % 50;
  return (
    <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
      <filter id={`grain-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="1920" height="1080" filter={`url(#grain-${seed})`} />
    </svg>
  );
};

// ---------- Scene tag (top-left label) ----------

export const SceneTag: React.FC<{frame: number; start: number; num: string; label: string; exit?: number}> = ({frame, start, num, label, exit}) => {
  if (frame < start || (exit !== undefined && frame > exit + 10)) return null;
  const s = ramp(frame, start, start + 12, [0, 1]);
  const out = exit !== undefined ? ramp(frame, exit, exit + 10, [0, 1], EASE_IN_OUT) : 0;
  const x = -1400 + 1480 * s - 1600 * out;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 64,
        display: 'flex',
        alignItems: 'stretch',
        rotate: '-2deg',
        filter: 'drop-shadow(8px 10px 0 rgba(0,0,0,0.35))',
      }}
    >
      <div style={{background: C.yellow, color: C.ink, fontFamily: FONT.display, fontSize: 58, padding: '4px 22px', border: `5px solid ${C.ink}`}}>{num}</div>
      <div style={{background: C.ink, color: C.white, fontFamily: FONT.display, fontSize: 58, padding: '4px 28px', letterSpacing: 2, border: `5px solid ${C.ink}`}}>{label}</div>
    </div>
  );
};
