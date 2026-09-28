import React from 'react';
import {interpolate} from 'remotion';
import {EASE_OUT, pop, ramp} from '../anim';
import {C, FONT} from '../theme';
import {Rect} from '../ui/layout';

// Cursor, keyboard keys and UI callouts (screen-space overlays).

export const Cursor: React.FC<{
  x: number;
  y: number;
  frame: number;
  clicks?: number[];
  kind?: 'arrow' | 'razor' | 'grab' | 'ai';
  scale?: number;
  visible?: boolean;
}> = ({x, y, frame, clicks = [], kind = 'arrow', scale = 1.6, visible = true}) => {
  if (!visible) return null;
  const pressed = clicks.some((c) => frame >= c && frame < c + 4);
  return (
    <>
      {clicks.map((c) => {
        const t = frame - c;
        if (t < 0 || t > 14) return null;
        const r = interpolate(t, [0, 14], [8, 46], {easing: EASE_OUT});
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: x - r,
              top: y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: `5px solid ${C.yellow}`,
              opacity: 1 - t / 14,
            }}
          />
        );
      })}
      <svg
        width={40 * scale}
        height={40 * scale}
        viewBox="0 0 40 40"
        style={{position: 'absolute', left: x - 6 * scale, top: y - 4 * scale, overflow: 'visible', scale: pressed ? '0.88' : '1', transformOrigin: '6px 4px', filter: 'drop-shadow(3px 4px 0 rgba(0,0,0,0.35))'}}
      >
        {kind === 'arrow' || kind === 'grab' ? (
          <path d="M6,4 L6,30 L13,24 L18,35 L23,33 L18,22 L27,22 Z" fill={C.white} stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
        ) : null}
        {kind === 'razor' ? (
          <g>
            <circle cx={6} cy={4} r={13} fill={C.white} stroke={C.ink} strokeWidth={2.6} />
            <path d="M-1,11 L9,1 M9,1 L13,-3 L14,1 L11,3 Z" stroke={C.ink} strokeWidth={2.4} fill={C.ink} strokeLinejoin="round" />
          </g>
        ) : null}
        {kind === 'ai' ? (
          <g>
            <circle cx={6} cy={4} r={13} fill={C.ai} stroke={C.ink} strokeWidth={2.6} />
            <path d="M6,-5 C7,1 9,3 15,4 C9,5 7,7 6,13 C5,7 3,5 -3,4 C3,3 5,1 6,-5 Z" fill={C.white} />
          </g>
        ) : null}
      </svg>
    </>
  );
};

export const KeyCap: React.FC<{
  frame: number;
  start: number;
  exit?: number;
  x: number;
  y: number;
  label: string;
  sub?: string;
  press?: number;
  size?: number;
}> = ({frame, start, exit, x, y, label, sub, press, size = 110}) => {
  if (frame < start) return null;
  const s = pop(frame, start, {damping: 9, stiffness: 200});
  const out = exit !== undefined ? ramp(frame, exit, exit + 8, [1, 0]) : 1;
  if (out <= 0) return null;
  const down = press !== undefined && frame >= press && frame < press + 5 ? 1 : 0;
  const w = Math.max(size, label.length * size * 0.42 + size * 0.4);
  return (
    <div style={{position: 'absolute', left: x, top: y, translate: '-50% -50%', scale: `${s * out}`}}>
      <div
        style={{
          position: 'relative',
          width: w,
          height: size,
          borderRadius: size * 0.18,
          background: '#F4F4F4',
          border: `${size * 0.05}px solid ${C.ink}`,
          boxShadow: `0 ${size * (0.12 - down * 0.08)}px 0 ${C.ink}`,
          translate: `0 ${down * size * 0.08}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT.block,
          fontSize: size * 0.42,
          color: C.ink,
        }}
      >
        {label}
        {sub ? <div style={{fontFamily: FONT.ui, fontWeight: 800, fontSize: size * 0.14, color: '#555', marginTop: -size * 0.02}}>{sub}</div> : null}
      </div>
    </div>
  );
};

/** Dims everything except `rect` and draws an animated highlight around it. */
export const Callout: React.FC<{
  frame: number;
  start: number;
  end: number;
  rect: Rect;
  color?: string;
  dim?: number;
  radius?: number;
}> = ({frame, start, end, rect, color = C.yellow, dim = 0.55, radius = 12}) => {
  if (frame < start - 2 || frame > end + 8) return null;
  const inP = ramp(frame, start, start + 10);
  const outP = ramp(frame, end, end + 8);
  const vis = inP * (1 - outP);
  const pad = 8;
  const r = {x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2};
  const perim = 2 * (r.w + r.h);
  return (
    <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <defs>
        <mask id={`callout-${start}`}>
          <rect width="1920" height="1080" fill="white" />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={radius} fill="black" />
        </mask>
      </defs>
      <rect width="1920" height="1080" fill="#000" opacity={dim * vis} mask={`url(#callout-${start})`} />
      <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        rx={radius}
        fill="none"
        stroke={C.ink}
        strokeWidth={14}
        strokeDasharray={perim}
        strokeDashoffset={perim * (1 - inP)}
        opacity={1 - outP}
      />
      <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        rx={radius}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeDasharray={perim}
        strokeDashoffset={perim * (1 - inP)}
        opacity={1 - outP}
      />
    </svg>
  );
};

export const NumberBadge: React.FC<{frame: number; start: number; x: number; y: number; n: string; size?: number; color?: string}> = ({
  frame,
  start,
  x,
  y,
  n,
  size = 120,
  color = C.yellow,
}) => {
  if (frame < start) return null;
  const s = pop(frame, start, {damping: 9});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        translate: '-50% -50%',
        scale: `${s}`,
        rotate: `${(1 - s) * 90 - 8}deg`,
        borderRadius: '50%',
        background: color,
        border: `${size * 0.06}px solid ${C.ink}`,
        boxShadow: `${size * 0.06}px ${size * 0.07}px 0 ${C.ink}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT.display,
        fontSize: size * 0.55,
        color: C.ink,
      }}
    >
      {n}
    </div>
  );
};

/** Two-line label that pops next to a highlighted panel. */
export const CalloutLabel: React.FC<{
  frame: number;
  start: number;
  end: number;
  x: number;
  y: number;
  title: string;
  desc: string;
  rotate?: number;
  color?: string;
}> = ({frame, start, end, x, y, title, desc, rotate = -2, color = C.yellow}) => {
  if (frame < start || frame > end + 8) return null;
  const s = pop(frame, start, {damping: 11, stiffness: 200});
  const out = ramp(frame, end, end + 8, [1, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        translate: '0 -100%',
        scale: `${s * out}`,
        transformOrigin: '0% 100%',
        rotate: `${rotate}deg`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        filter: 'drop-shadow(8px 10px 0 rgba(0,0,0,0.35))',
      }}
    >
      <div style={{background: color, color: C.ink, fontFamily: FONT.display, fontSize: 56, lineHeight: 1.05, padding: '4px 18px', border: `5px solid ${C.ink}`, whiteSpace: 'nowrap'}}>
        {title}
      </div>
      <div style={{background: C.ink, color: C.white, fontFamily: FONT.ui, fontWeight: 800, fontSize: 30, padding: '6px 18px', marginTop: -5, marginLeft: 14, whiteSpace: 'nowrap', border: `5px solid ${C.ink}`}}>
        {desc}
      </div>
    </div>
  );
};
