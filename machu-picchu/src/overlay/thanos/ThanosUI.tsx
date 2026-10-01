import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, pop, ramp, rand, windowIn } from "../../anim";
import { FONT } from "../../theme";
import { fmtNumber } from "../Graphics";
import { HeavyText } from "../inca/HeavyText";
import { CommentBubbleIcon, HandPointer, INK } from "../inca/icons";
import { MarkBadge } from "../oxigeno/OxiUI";

// 2D overlays for "¿Y si Thanos NUNCA chasqueaba los dedos?" (1080 x 1920, 30 fps).
// Same punchy look as the dinosaur overlays (thick dark outlines, white-bordered cards with hard
// drop shadows, HeavyText titles, springy pops with a slight wobble) plus a cosmic purple/gold
// accent. Everything is driven by the global `frame` plus explicit cue frames: no timers, no
// Math.random (`rand`), no CSS animations, no emoji (all icons are inline SVG). Original
// designs only: no logos, emblems or lettering of any real brand or film.
// TikTok safe zone: keep content inside x 60-940, y 230-1180 (top bar above y 200, the button
// column right of x 940, captions at y 1210-1400, description below y 1400). Each component's
// doc comment gives its footprint at scale 1 and a suggested placement.

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
const bump = (frame: number, at: number, dur: number) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

/** Square-wave blink: 1 for `on` frames, 0 for `off` frames, starting at `from`. */
const blink = (frame: number, from: number, on = 7, off = 6) => {
  const n = on + off;
  return ((((frame - from) % n) + n) % n) < on ? 1 : 0;
};

/** Point on a circle, angle in degrees clockwise from 12 o'clock. */
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};

/** Stepped noise in [-1, 1]: a new value every `hold` frames. */
const jit = (frame: number, seed: number, hold = 2) => rand(Math.floor(frame / hold) * 7.31 + seed * 13.7) * 2 - 1;

/** Decaying shake offset (px) after an impact at `at`. */
const kick = (frame: number, at: number, amp: number, dur = 12, seed = 1) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return jit(frame, seed, 1) * amp * Math.pow(1 - d / dur, 2);
};

/** Exit progress 0 -> 1 over `dur` frames from `out` (always 0 without an out). */
const leave = (frame: number, out: number | undefined, dur = 9) => (out === undefined ? 0 : ramp(frame, out, out + dur, [0, 1], EASE_IN));

/** Silhouette drawn as a thick outline first, then filled on top. */
const Outlined: React.FC<{ w?: number; color?: string; children: React.ReactNode }> = ({ w = 7, color = INK, children }) => (
  <>
    <g stroke={color} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
    <g>{children}</g>
  </>
);

const hexRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256];
};

/** Linear mix of two hex colours (t = 0 -> a, 1 -> b). */
const mix = (a: string, b: string, t: number) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return `#${A.map((v, i) => `0${Math.round(v + (B[i] - v) * t).toString(16)}`.slice(-2)).join("")}`;
};

const luma = (hex: string) => {
  const [r, g, b] = hexRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** Four-point sparkle star centred on (cx, cy). */
const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r} Z`;

type IconProps = { size?: number; style?: React.CSSProperties };

const SHADOW = `0 0 0 5px ${INK}, 0 14px 0 5px rgba(0,0,0,0.3), 0 26px 50px rgba(0,0,0,0.3)`;
const GOLD = "#FFC83D";
const TXT_WHITE = ["#FFFFFF", "#FFFFFF", "#E2E4EE"];
const TXT_GOLD = ["#FFFBD1", "#FFD21F", "#FF9500"];
const TXT_MINT = ["#F2FFF6", "#B6F5C9", "#4FCB7A"];
const TXT_GREEN = ["#F0FFE8", "#7CFF6B", "#16B03A"];
const TXT_RED = ["#FFE3E3", "#FF5A5A", "#D0001A"];

/** Montserrat 900 with a dark outline (labels, small captions). */
const strokeText = (size: number, color = "#FFFFFF", stroke = 8, spacing = 1.5): React.CSSProperties => ({
  fontFamily: FONT.heavy,
  fontWeight: 900,
  fontSize: size,
  lineHeight: 1.1,
  letterSpacing: spacing,
  color,
  WebkitTextStroke: `${stroke}px ${INK}`,
  paintOrder: "stroke fill",
  whiteSpace: "nowrap",
});

/** Rubber stamp with worn speckles (double border, Luckiest Guy lettering fitted to the box). */
const Stamp: React.FC<{ id: string; text: string; color: string; w: number; h: number; fontSize: number; paper?: string }> = ({
  id,
  text,
  color,
  w,
  h,
  fontSize,
  paper = "rgba(255,250,236,0.94)",
}) => {
  const specks = [];
  for (let i = 0; i < 70; i++) {
    specks.push(<circle key={i} cx={-w / 2 + rand(i * 3.1 + 1) * w} cy={-h / 2 + rand(i * 5.7 + 2) * h} r={1.2 + rand(i * 7.9 + 3) * 3.4} fill="#000" />);
  }
  return (
    <svg width={w + 20} height={h + 20} viewBox={`${-(w + 20) / 2} ${-(h + 20) / 2} ${w + 20} ${h + 20}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <mask id={`stm${id}`} maskUnits="userSpaceOnUse" x={-(w + 20) / 2} y={-(h + 20) / 2} width={w + 20} height={h + 20}>
          <rect x={-(w + 20) / 2} y={-(h + 20) / 2} width={w + 20} height={h + 20} fill="#FFFFFF" />
          {specks}
        </mask>
      </defs>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={20} fill={paper} />
      <g mask={`url(#stm${id})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={20} fill="none" stroke={color} strokeWidth={10} />
        <rect x={-w / 2 + 15} y={-h / 2 + 15} width={w - 30} height={h - 30} rx={11} fill="none" stroke={color} strokeWidth={4} />
        <text x={0} y={fontSize * 0.36} textAnchor="middle" fontFamily={FONT.title} fontSize={fontSize} fill={color} textLength={w - 70} lengthAdjust="spacingAndGlyphs">
          {text}
        </text>
      </g>
    </svg>
  );
};

/** Ink-and-white impact lines around an ellipse (rx x ry), for `dur` frames from `at`. */
const ImpactLines: React.FC<{ frame: number; at: number; rx: number; ry: number; n?: number; dur?: number }> = ({ frame, at, rx, ry, n = 14, dur = 10 }) => {
  const d = frame - at;
  if (d < 0 || d >= dur) return null;
  const tt = d / dur;
  const els: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const r0 = 1 + 0.3 * tt;
    const len = 0.28 * (1 - tt) + 0.05;
    const x1 = Math.cos(a) * rx * r0;
    const y1 = Math.sin(a) * ry * r0;
    const x2 = Math.cos(a) * rx * (r0 + len);
    const y2 = Math.sin(a) * ry * (r0 + len);
    els.push(<line key={`k${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={12 * (1 - tt) + 3} strokeLinecap="round" />);
    els.push(<line key={`w${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeWidth={6 * (1 - tt) + 1} strokeLinecap="round" />);
  }
  return (
    <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {els}
    </svg>
  );
};

// Advance widths of Luckiest Guy (em), to size the ImpactText burst around its word.
const LG_W: Record<string, number> = {
  A: 0.626, B: 0.594, C: 0.515, D: 0.583, E: 0.479, F: 0.487, G: 0.626, H: 0.626, I: 0.297, J: 0.51, K: 0.614, L: 0.452, M: 0.791,
  N: 0.704, Ñ: 0.704, O: 0.638, P: 0.596, Q: 0.691, R: 0.606, S: 0.531, T: 0.543, U: 0.623, V: 0.613, W: 0.908, X: 0.588, Y: 0.607,
  Z: 0.487, Á: 0.626, É: 0.479, Í: 0.297, Ó: 0.638, Ú: 0.623, "¡": 0.278, "!": 0.279, "¿": 0.563, "?": 0.554, " ": 0.195, ".": 0.222,
  "…": 0.769, "-": 0.382, "0": 0.633, "1": 0.388, "2": 0.509, "3": 0.528, "4": 0.539, "5": 0.531, "6": 0.573, "7": 0.506, "8": 0.571, "9": 0.555,
};
const lgWidth = (s: string) => {
  let w = 0;
  for (const ch of Array.from(s)) w += LG_W[ch] ?? 0.62;
  return w;
};

// =============================================================================================
// TimeFrozenHUD

/** Stopwatch with a frosted case and icicles; the hands are stuck (the second hand shudders). */
const FrozenWatch: React.FC<{ size?: number; frame: number; uid: string }> = ({ size = 96, frame, uid }) => {
  const ph = ((frame % 26) + 26) % 26;
  const shudder = ph < 6 ? Math.sin(ph * 2.4) * 6 * (1 - ph / 6) : 0;
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = polar(i % 3 === 0 ? 20 : 23, i * 30);
    const [x2, y2] = polar(27, i * 30);
    ticks.push(<line key={i} x1={50 + x1} y1={57 + y1} x2={50 + x2} y2={57 + y2} stroke="#2A5C86" strokeWidth={i % 3 === 0 ? 3.5 : 2} strokeLinecap="round" />);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id={`fwf${uid}`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#E3F7FF" />
          <stop offset="1" stopColor="#9DD9F7" />
        </radialGradient>
        <linearGradient id={`fwb${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D2F3FF" />
          <stop offset="1" stopColor="#3F8FE0" />
        </linearGradient>
      </defs>
      <Outlined w={7}>
        <rect x={41} y={3} width={18} height={11} rx={4} fill="#E6F7FF" />
        <rect x={46} y={11} width={8} height={10} fill="#9FB8CE" />
        <rect x={71} y={14} width={12} height={10} rx={3} transform="rotate(45 77 19)" fill="#9FB8CE" />
        <circle cx={50} cy={57} r={37} fill={`url(#fwb${uid})`} />
        <path d="M27 84 L32 99 L39 89 Z" fill="#EAF9FF" />
        <path d="M44 92 L49 106 L55 93 Z" fill="#EAF9FF" />
        <path d="M61 90 L67 101 L71 86 Z" fill="#EAF9FF" />
      </Outlined>
      <circle cx={50} cy={57} r={29} fill={`url(#fwf${uid})`} />
      {ticks}
      <g transform="rotate(-62 50 57)">
        <line x1={50} y1={61} x2={50} y2={40} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      </g>
      <g transform={`rotate(${58 + shudder} 50 57)`}>
        <line x1={50} y1={63} x2={50} y2={32} stroke="#FF3B30" strokeWidth={3.5} strokeLinecap="round" />
      </g>
      <circle cx={50} cy={57} r={4.5} fill={INK} />
      <path d="M17 52 C15 38 24 25 38 20 L42 28 L34 31 L38 38 L28 40 L29 49 Z" fill="#FFFFFF" opacity={0.9} />
      <path d="M60 89 L68 79 L72 86 L80 74 C83 81 78 89 69 92 Z" fill="#FFFFFF" opacity={0.75} />
      <path d="M64 40 l9 0 M68.5 35.5 l0 9 M65 37 l7 7 M72 37 l-7 7" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
};

/** Six-armed snowflake, white with a dark outline. */
const Snowflake: React.FC<IconProps> = ({ size = 40, style }) => {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = i * 60;
    const [ex, ey] = polar(40, a);
    const [bx, by] = polar(23, a);
    const [l1x, l1y] = polar(13, a - 45);
    const [l2x, l2y] = polar(13, a + 45);
    d += `M50 50 L${50 + ex} ${50 + ey} M${50 + bx} ${50 + by} l${l1x} ${l1y} M${50 + bx} ${50 + by} l${l2x} ${l2y} `;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      <path d={d} stroke={INK} strokeWidth={16} strokeLinecap="round" fill="none" />
      <path d={d} stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" fill="none" />
    </svg>
  );
};

/** Frost creeping in from a corner of a pill (white crust and crystal scratches). */
const FrostCorner: React.FC<{ k: number; flip?: boolean }> = ({ k, flip = false }) => (
  <svg
    width={160}
    height={74}
    viewBox="0 0 160 74"
    style={{
      position: "absolute",
      left: flip ? undefined : 0,
      right: flip ? 0 : undefined,
      top: flip ? undefined : 0,
      bottom: flip ? 0 : undefined,
      transform: `scale(${k})`,
      transformOrigin: flip ? "100% 100%" : "0% 0%",
    }}
  >
    <g transform={flip ? "rotate(180 80 37)" : undefined}>
      <path d="M0 0 H150 C138 7 128 3 119 12 C110 21 100 14 91 25 C82 36 70 29 61 40 C52 51 40 45 31 56 C22 66 10 62 0 72 Z" fill="#FFFFFF" opacity={0.55} />
      <path d="M0 0 H92 C80 6 70 4 62 13 C54 22 42 17 34 27 C26 37 12 34 0 44 Z" fill="#FFFFFF" opacity={0.5} />
      <path d="M16 10 l16 11 M30 6 l7 15 M48 8 l12 9 M10 26 l14 4" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
    </g>
  </svg>
);

/**
 * HUD chip for the frozen-time moment: an icy blue pill with a frosted stopwatch whose hands
 * are stuck (the second hand shudders but can't move), "TIEMPO CONGELADO" and a turning
 * snowflake. Frost creeps in from two corners behind a white "freeze" flash, an ice glint
 * sweeps across, a few flakes drift around it and every so often it glitches for two frames
 * (RGB split, a jump sideways, a bright scan line). Pops in at `at`, shrinks away at `out`.
 * `x`, `y` = pill centre; ~560 x 100 (x ± 280, y ± 50; the stopwatch and the flakes poke
 * ~30 px above and below). Suggested: x 500, y 300 (top of the safe area).
 */
export const TimeFrozenHUD: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  scale?: number;
  label?: string;
}> = ({ frame, at, out, x, y, scale = 1, label = "TIEMPO CONGELADO" }) => {
  const uid = useUid();
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 11, stiffness: 210 });
  const k = leave(frame, out);
  const flash = bump(frame, at + 2, 9);
  const frost = ramp(frame, at + 3, at + 16, [0, 1], EASE_OUT);
  const g = Math.floor(frame / 2);
  const glitch = t > 14 && frame < out && rand(g * 3.71 + 0.37) < 0.08;
  const gx = glitch ? (rand(g * 5.13) - 0.5) * 18 : 0;
  const sliceY = 15 + rand(g * 2.17) * 70;
  const sweepT = (((t - 6) % 56) + 56) % 56;
  const flakes: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const span = 210;
    const fy = ((rand(i * 5.1 + 2) * span + t * (0.6 + rand(i * 2.2) * 0.7)) % span) - span / 2;
    const fx = -300 + rand(i * 3.3 + 1) * 600 + Math.sin(t * 0.07 + i) * 8;
    const fo = Math.sin(((fy + span / 2) / span) * Math.PI) * frost;
    flakes.push(
      <div key={i} style={{ position: "absolute", left: fx, top: fy, transform: `translate(-50%, -50%) rotate(${t * 2 + i * 40}deg)`, opacity: fo }}>
        <Snowflake size={14 + rand(i * 7.7) * 12} />
      </div>,
    );
  }
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${scale * (1 - k)})`, opacity: 1 - k, pointerEvents: "none" }}>
      {flakes}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "max-content",
          transform: `translate(-50%, -50%) translateX(${gx}px) scale(${p}) rotate(${-2 + (1 - p) * -12 + Math.sin(t * 0.07) * 0.6}deg)`,
          filter: glitch ? "drop-shadow(-5px 0 0 rgba(255,0,90,0.8)) drop-shadow(5px 0 0 rgba(0,225,255,0.8))" : undefined,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 26px 10px 14px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #9BE7FF 0%, #42ACF5 48%, #1E68DA 100%)",
            border: "6px solid #FFFFFF",
            boxShadow: `0 0 0 4px ${INK}, 0 10px 0 4px rgba(0,0,0,0.3), 0 0 ${26 + 10 * Math.sin(t * 0.15)}px rgba(130,225,255,0.6)`,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, overflow: "hidden" }}>
            <FrostCorner k={frost} />
            <FrostCorner k={frost} flip />
            <div
              style={{
                position: "absolute",
                top: -30,
                bottom: -30,
                left: `${-20 + sweepT * 3.2}%`,
                width: 54,
                background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%)",
                transform: "skewX(-22deg)",
              }}
            />
            {glitch ? <div style={{ position: "absolute", left: 0, right: 0, top: `${sliceY}%`, height: 5, background: "rgba(255,255,255,0.85)" }} /> : null}
            {flash > 0 ? <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: flash * 0.9 }} /> : null}
          </div>
          <div style={{ position: "relative", width: 70, height: 56 }}>
            <div style={{ position: "absolute", left: -10, top: -26 }}>
              <FrozenWatch size={88} frame={frame} uid={uid} />
            </div>
          </div>
          <div style={{ position: "relative", paddingTop: 10 }}>
            <HeavyText text={label} size={42} colors={["#FFFFFF", "#F4FCFF", "#C4ECFF"]} />
          </div>
          <div style={{ position: "relative", transform: `rotate(${t * 1.6}deg) scale(${0.4 + 0.6 * frost})` }}>
            <Snowflake size={38} />
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// SlowMoBars

/** Little snail (the slow-motion mascot): eye stalks sway, the body squishes as it crawls. */
const SnailIcon: React.FC<{ size?: number; frame: number }> = ({ size = 56, frame }) => {
  const sway = Math.sin(frame * 0.2) * 4;
  const sq = 1 + 0.05 * Math.sin(frame * 0.25);
  const stalks = `M72 70 Q${68 + sway * 0.3} 50 ${64 + sway} 32 M82 70 Q${84 + sway * 0.2} 52 ${86 + sway * 0.8} 34`;
  let spiral = "";
  for (let s = 0; s <= 40; s++) {
    const [px, py] = polar(2 + (17 * s) / 40, 90 + (s / 40) * 640);
    spiral += `${s ? "L" : "M"}${(40 + px).toFixed(1)} ${(54 + py).toFixed(1)} `;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible" }}>
      <path d={stalks} stroke={INK} strokeWidth={10} strokeLinecap="round" fill="none" />
      <path d={stalks} stroke="#FFD3A1" strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <g transform={`translate(50 88) scale(${sq} ${2 - sq}) translate(-50 -88)`}>
        <Outlined w={7}>
          <path d="M6 84 C6 77 14 74 26 74 L68 74 C70 66 76 62 84 62 C93 62 96 70 94 77 C92 85 84 89 72 89 L12 89 C8 89 6 87 6 84 Z" fill="#FFD3A1" />
          <circle cx={40} cy={54} r={26} fill="#FF9F3D" />
        </Outlined>
        <path d={spiral} stroke="#B9500D" strokeWidth={4.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 40 Q28 31 39 30" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.7} />
      </g>
      <circle cx={64 + sway} cy={32} r={6.5} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      <circle cx={86 + sway * 0.8} cy={34} r={6.5} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      <circle cx={65 + sway} cy={33} r={2.8} fill={INK} />
      <circle cx={87 + sway * 0.8} cy={35} r={2.8} fill={INK} />
    </svg>
  );
};

/**
 * Cinematic slow-motion treatment for the whole frame, between `from` and `to`: black
 * letterbox bars (`barH`, 90 px, i.e. only the area the TikTok top bar / description cover
 * anyway) slide in from the edges, faint white speed streaks drift slowly across the left and
 * right sides (the middle stays clear), a soft dark vignette, and a "CÁMARA LENTA ×0.25" tag
 * with a crawling snail. The tag's left edge is at `tagX` (76) and its centre at `tagY` (272):
 * ~470 x 80, so it sits at the top-left of the safe area (x 76-550, y 232-312); move it with
 * tagX/tagY or hide it with showTag={false} (e.g. if TimeFrozenHUD shares the top).
 */
export const SlowMoBars: React.FC<{
  frame: number;
  from: number;
  to: number;
  barH?: number;
  label?: string;
  speed?: string;
  tagX?: number;
  tagY?: number;
  showTag?: boolean;
  streaks?: boolean;
}> = ({ frame, from, to, barH = 90, label = "CÁMARA LENTA", speed = "×0.25", tagX = 76, tagY = 272, showTag = true, streaks = true }) => {
  const uid = useUid();
  if (frame < from || frame > to) return null;
  const t = frame - from;
  const bars = ramp(frame, from, from + 14, [0, 1], EASE_OUT) * (1 - ramp(frame, to - 12, to, [0, 1], EASE_IN_OUT));
  const w = windowIn(frame, from, to, 10);
  const tagS = pop(frame, from + 8, { damping: 11, stiffness: 200 }) * (1 - ramp(frame, to - 10, to - 2, [0, 1], EASE_IN));
  const lines: React.ReactNode[] = [];
  if (streaks) {
    for (let i = 0; i < 28; i++) {
      const yy = 130 + rand(i * 3.1) * 1660;
      const len = 160 + rand(i * 5.3) * 320;
      const th = 2 + rand(i * 7.7) * 4.5;
      const sp = 2 + rand(i * 2.9) * 3.5;
      const span = 1080 + len + 200;
      const xx = ((((rand(i * 9.1) * span - sp * t) % span) + span) % span) - len - 100;
      lines.push(<rect key={i} x={xx} y={yy} width={len} height={th} rx={th / 2} fill={`url(#sms${uid})`} opacity={0.35 + 0.45 * rand(i * 4.4)} />);
    }
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 62% at 50% 46%, rgba(0,0,0,0) 52%, rgba(10,8,40,0.45) 100%)", opacity: w }} />
      {streaks ? (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: w }}>
          <defs>
            <linearGradient id={`sms${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.8} />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </linearGradient>
            <radialGradient id={`smg${uid}`} cx="0.5" cy="0.46" r="0.62">
              <stop offset="0" stopColor="#000000" />
              <stop offset="0.52" stopColor="#000000" />
              <stop offset="0.95" stopColor="#FFFFFF" />
            </radialGradient>
            <mask id={`smm${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
              <rect width={1080} height={1920} fill={`url(#smg${uid})`} />
            </mask>
          </defs>
          <g mask={`url(#smm${uid})`}>{lines}</g>
        </svg>
      ) : null}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: barH, background: "#000", transform: `translateY(${-(1 - bars) * (barH + 10)}px)` }} />
      <div style={{ position: "absolute", left: 0, top: 1920 - barH, width: 1080, height: barH, background: "#000", transform: `translateY(${(1 - bars) * (barH + 10)}px)` }} />
      {showTag && tagS > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: tagX,
            top: tagY,
            transform: `translate(0, -50%) scale(${tagS}) rotate(${-2 + Math.sin(t * 0.05) * 0.5}deg)`,
            transformOrigin: "0% 50%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "6px 10px 6px 12px",
            borderRadius: 999,
            background: "linear-gradient(180deg, #3D2E80 0%, #1C1240 100%)",
            border: "5px solid #FFFFFF",
            boxShadow: `0 0 0 4px ${INK}, 0 8px 0 4px rgba(0,0,0,0.3)`,
            whiteSpace: "nowrap",
          }}
        >
          <SnailIcon size={56} frame={frame} />
          <div style={{ paddingTop: 9 }}>
            <HeavyText text={label} size={36} colors={["#FFFFFF", "#F3EEFF", "#CFC2FF"]} />
          </div>
          <div
            style={{
              padding: "7px 14px 1px",
              borderRadius: 999,
              background: "linear-gradient(180deg, #FFE45C 0%, #FFB703 100%)",
              border: `4px solid ${INK}`,
              fontFamily: FONT.title,
              fontSize: 38,
              lineHeight: 1,
              color: INK,
            }}
          >
            {speed}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// ImpactText

/**
 * Comic onomatopoeia ("¡CLIC!", "¡KRAK!", "¡BOOM!", "¡ZAS!", "¡PUM!"): a spiky starburst in
 * `color` (yellow) with a halftone rim and a pale core, heavy outlined letters bursting out one
 * by one on a slight arc, speed lines, a hard pop and a decaying shake, then a gentle
 * "breathing". Lasts until `out` (default at + 40), then shrinks away in 8 frames. Letters are
 * red on light bursts and white/yellow on dark ones unless `textColors` is given. `x`, `y` =
 * centre; at size 120 (font size) a five-letter word is ~ 680 x 330 including the spikes (the
 * speed lines flash ~25 % further out for 12 frames). `rotate` = tilt in degrees (-8).
 */
export const ImpactText: React.FC<{
  frame: number;
  at: number;
  out?: number;
  text: string;
  x: number;
  y: number;
  color?: string;
  textColors?: string[];
  rotate?: number;
  size?: number;
  scale?: number;
}> = ({ frame, at, out, text, x, y, color = "#FFD60A", textColors, rotate = -8, size = 120, scale = 1 }) => {
  const uid = useUid();
  const outAt = out ?? at + 40;
  if (frame < at || frame > outAt + 8) return null;
  const d = frame - at;
  let seed = 7;
  for (const ch of Array.from(text)) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  const tw = lgWidth(text) * size;
  const rx = tw / 2 + size * 0.78;
  const ry = size * 1.02;
  const p = pop(frame, at, { damping: 8, stiffness: 300, mass: 0.6 });
  const k = ramp(frame, outAt, outAt + 8, [0, 1], EASE_IN);
  const sh = Math.exp(-d / 6);
  const sx = jit(frame, (seed % 97) + 1, 1) * 13 * sh;
  const sy = jit(frame, (seed % 89) + 3, 1) * 10 * sh;
  const breathe = 1 + 0.025 * Math.sin(d * 0.6);
  const n = 18;
  let burst = "";
  for (let j = 0; j < 2 * n; j++) {
    const a = (j / (2 * n)) * Math.PI * 2 + (rand(seed + j * 1.37) - 0.5) * 0.1;
    const r = j % 2 === 0 ? 1.1 + rand(seed * 0.71 + j * 3.1) * 0.24 : 0.82 + rand(seed * 0.33 + j * 5.7) * 0.05;
    burst += `${j ? "L" : "M"}${(Math.cos(a) * rx * r).toFixed(1)} ${(Math.sin(a) * ry * r).toFixed(1)} `;
  }
  burst += "Z";
  const tc = textColors ?? (luma(color) > 0.55 ? ["#FFF1E6", "#FF5A3D", "#C8001A"] : ["#FFFFFF", "#FFF6C2", "#FFD23F"]);
  const letters = Array.from(text);
  return (
    <div
      style={{
        position: "absolute",
        left: x + sx,
        top: y + sy,
        width: 0,
        height: 0,
        transform: `scale(${scale * p * (1 - k) * breathe}) rotate(${rotate + (1 - p) * -24}deg)`,
        opacity: 1 - k,
        pointerEvents: "none",
      }}
    >
      <ImpactLines frame={frame} at={at} rx={rx * 1.3} ry={ry * 1.3} dur={12} />
      <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <pattern id={`htp${uid}`} width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <circle cx={8} cy={8} r={3.8} fill={mix(color, INK, 0.3)} />
          </pattern>
          <clipPath id={`htc${uid}`}>
            <path d={burst} />
          </clipPath>
        </defs>
        <path d={burst} transform="translate(0 14)" fill="rgba(0,0,0,0.3)" />
        <path d={burst} fill={color} stroke={INK} strokeWidth={10} strokeLinejoin="round" />
        <g clipPath={`url(#htc${uid})`}>
          <rect x={-rx * 1.5} y={-ry * 1.5} width={rx * 3} height={ry * 3} fill={`url(#htp${uid})`} opacity={0.45} />
        </g>
        <path d={burst} transform="scale(0.78)" fill={mix(color, "#FFFFFF", 0.6)} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: size * 0.04,
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "flex-end",
          whiteSpace: "nowrap",
        }}
      >
        {letters.map((ch, i) => {
          const pi = pop(frame, at + 1 + i * 1.2, { damping: 7, stiffness: 320, mass: 0.5 });
          const c = i - (letters.length - 1) / 2;
          return (
            <div
              key={i}
              style={{
                transform: `translateY(${c * c * 2.4 * (size / 120)}px) rotate(${c * 3 + (1 - pi) * (i % 2 ? 30 : -30)}deg) scale(${pi})`,
                opacity: pi > 0.02 ? 1 : 0,
              }}
            >
              <HeavyText text={ch} size={i % 2 ? size * 0.92 : size} colors={tc} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================================
// NoSignal

/**
 * The "¡SIN SEÑAL CÓSMICA!" gag: a cosmic purple card with a gold rim. On the left a
 * phone-style signal icon whose four gold bars drain one by one (tallest first, each
 * flickering out) while static creeps in and "BUSCANDO SEÑAL…" blinks; at `xAt` (default
 * at + 24) a red X badge slams onto the icon, the card glitches (RGB split, jump, scan
 * noise) and "SIN SEÑAL / CÓSMICA" pops in big gold letters. After that the dead icon keeps
 * crackling with static. At `out` it switches off like an old TV (10 frames). `x`, `y` = card
 * centre; ~600 x 250 (x ± 300, y ± 125; the X badge pokes ~25 px above). Suggested: next to
 * Thanos' raised hand, e.g. x 500, y 420.
 */
export const NoSignal: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  xAt?: number;
  scale?: number;
  line1?: string;
  line2?: string;
}> = ({ frame, at, out, x, y, xAt, scale = 1, line1 = "SIN SEÑAL", line2 = "CÓSMICA" }) => {
  const uid = useUid();
  if (frame < at || frame > out + 11) return null;
  const t = frame - at;
  const X = xAt ?? at + 24;
  const p = pop(frame, at, { damping: 11, stiffness: 200 });
  const off1 = ramp(frame, out, out + 5, [0, 1], EASE_IN);
  const off2 = ramp(frame, out + 5, out + 10, [0, 1], EASE_IN);
  const crossed = frame >= X;
  const drainFrom = at + 6;
  const step = Math.max(2, (X - 2 - drainFrom) / 4);
  const barOn = [0, 1, 2, 3].map((i) => {
    const offAt = drainFrom + (3 - i) * step;
    if (frame < offAt - 4) return 1;
    if (frame < offAt) return blink(frame, offAt - 4, 1, 1) ? 1 : 0.2;
    return 0;
  });
  const lost = ramp(frame, drainFrom, X, [0, 1]);
  const sd = frame - X;
  const xS =
    sd < 0
      ? 0
      : sd < 5
        ? interpolate(sd, [0, 5], [2.4, 1], { ...CLAMP, easing: EASE_IN })
        : 1 + 0.08 * Math.sin((sd - 5) * 0.9) * Math.exp(-(sd - 5) / 5);
  const shx = kick(frame, X + 4, 12, 12, 3);
  const g = Math.floor(frame / 2);
  const glitch = (sd >= 3 && sd < 10) || (t > 10 && frame < out && rand(g * 4.21 + 0.11) < 0.07);
  const split = glitch ? 3 + 6 * rand(g * 1.7) : 0;
  const gx = glitch ? (rand(g * 3.9) - 0.5) * 18 : 0;
  const statics: React.ReactNode[] = [];
  const nStatic = crossed ? 30 : Math.round(30 * lost);
  for (let i = 0; i < nStatic; i++) {
    const s = frame * 3.17 + i * 11.3;
    statics.push(
      <rect
        key={i}
        x={6 + rand(s) * 170}
        y={6 + rand(s + 1.1) * 178}
        width={4 + rand(s + 2.2) * 30}
        height={2 + rand(s + 3.3) * 3}
        fill={rand(s + 4.4) < 0.5 ? "#FFFFFF" : "#C9A8FF"}
        opacity={0.15 + rand(s + 5.5) * 0.4}
      />,
    );
  }
  const BAR_H = [34, 60, 86, 112];
  const lineIn1 = pop(frame, X + 1, { damping: 9, stiffness: 240 });
  const lineIn2 = pop(frame, X + 5, { damping: 9, stiffness: 240 });
  const dots = Math.floor(t / 5) % 4;
  return (
    <div
      style={{
        position: "absolute",
        left: x + shx,
        top: y,
        width: 0,
        height: 0,
        transform: `scale(${scale * p * (1 - off2 * 0.97)}, ${scale * p * (1 - off1 * 0.96)})`,
        opacity: Math.min(1, p * 3) * (1 - off2),
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "max-content",
          transform: `translate(-50%, -50%) translateX(${gx}px) rotate(${-2 + (1 - p) * -10 + Math.sin(t * 0.07) * 0.5}deg)`,
          filter: split > 0 ? `drop-shadow(${-split}px 0 0 rgba(255,0,90,0.8)) drop-shadow(${split}px 0 0 rgba(0,225,255,0.8))` : undefined,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 22,
            padding: "18px 30px 18px 18px",
            borderRadius: 40,
            background: "linear-gradient(160deg, #6C3CEB 0%, #3F1BA6 55%, #230A63 100%)",
            border: `7px solid ${GOLD}`,
            boxShadow: `${SHADOW}, 0 0 46px rgba(155,61,255,0.5)`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, borderRadius: 33, overflow: "hidden", pointerEvents: "none" }}>
            {Array.from({ length: 18 }, (_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${rand(i * 4.7 + 1) * 100}%`,
                  top: `${rand(i * 8.3 + 2) * 100}%`,
                  width: 3 + rand(i * 2.9) * 3,
                  height: 3 + rand(i * 2.9) * 3,
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  opacity: 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.2 + i)),
                }}
              />
            ))}
            {off1 > 0 ? <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: off1 }} /> : null}
          </div>
          <div style={{ position: "relative", width: 190, height: 190 }}>
            <svg width={190} height={190} viewBox="0 0 190 190" style={{ display: "block", overflow: "visible" }}>
              <defs>
                <linearGradient id={`nsg${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFF4BF" />
                  <stop offset="0.5" stopColor="#FFC83D" />
                  <stop offset="1" stopColor="#E08A00" />
                </linearGradient>
                <radialGradient id={`nss${uid}`} cx="0.5" cy="0.4" r="0.75">
                  <stop offset="0" stopColor="#4A23A8" />
                  <stop offset="1" stopColor="#170838" />
                </radialGradient>
                <clipPath id={`nsc${uid}`}>
                  <rect x={6} y={6} width={178} height={178} rx={34} />
                </clipPath>
              </defs>
              <rect x={4} y={4} width={182} height={182} rx={38} fill={`url(#nss${uid})`} stroke={INK} strokeWidth={6} />
              <g clipPath={`url(#nsc${uid})`}>
                {statics}
                {crossed ? <rect x={0} y={((frame * 9) % 230) - 30} width={190} height={14} fill="#FFFFFF" opacity={0.08} /> : null}
              </g>
              {BAR_H.map((h, i) => {
                const bx = 30 + i * 36;
                const on = barOn[i];
                return (
                  <g key={i}>
                    {on > 0 ? <rect x={bx - 6} y={152 - h - 6} width={38} height={h + 12} rx={12} fill={GOLD} opacity={0.3 * on} /> : null}
                    <rect
                      x={bx}
                      y={152 - h}
                      width={26}
                      height={h}
                      rx={7}
                      fill={on > 0 ? `url(#nsg${uid})` : "rgba(255,255,255,0.07)"}
                      opacity={on > 0 ? Math.max(0.35, on) : 1}
                      stroke={on > 0 ? INK : "rgba(214,196,255,0.55)"}
                      strokeWidth={on > 0 ? 5 : 3}
                      strokeDasharray={on > 0 ? undefined : "6 5"}
                    />
                  </g>
                );
              })}
              <path d={sparkle(42, 44, 15 + 3 * Math.sin(t * 0.3))} fill="#FFF3B0" stroke={INK} strokeWidth={3} strokeLinejoin="round" opacity={1 - lost} />
            </svg>
            {xS > 0 ? (
              <div style={{ position: "absolute", left: 104, top: 98, transform: `scale(${xS}) rotate(${(1 - Math.min(1, sd / 5)) * -40 + 8}deg)`, opacity: ramp(frame, X, X + 2) }}>
                <MarkBadge kind="cross" size={100} />
              </div>
            ) : null}
          </div>
          <div style={{ position: "relative", width: 300, height: 170 }}>
            {!crossed ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 4 }}>
                <span style={{ ...strokeText(34, "#E4D8FF", 7, 2), opacity: 0.55 + 0.45 * blink(frame, at, 8, 5) }}>BUSCANDO</span>
                <span style={{ ...strokeText(34, "#E4D8FF", 7, 2) }}>
                  SEÑAL
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ opacity: dots > i ? 1 : 0.15 }}>
                      .
                    </span>
                  ))}
                </span>
              </div>
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
                <div style={{ paddingTop: 16, transform: `scale(${lineIn1}) rotate(${-3 + (1 - lineIn1) * -14}deg)`, transformOrigin: "0% 60%" }}>
                  <HeavyText text={line1} size={62} colors={["#FFFFFF", "#FFF3C4", "#FFC83D"]} />
                </div>
                <div style={{ paddingTop: 20, transform: `scale(${lineIn2}) rotate(${2 + (1 - lineIn2) * 14}deg)`, transformOrigin: "0% 60%" }}>
                  <HeavyText text={line2} size={62} colors={["#FFF3C4", "#FFC83D", "#FF8A1F"]} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// CrossedList

const CROSS_W = 330;
const CROSS_H = 440;

/** Tear-off calendar page: red header with binder rings, a big "5 AÑOS" and a sad-face doodle. */
const CalendarArt: React.FC<{ uid: string }> = ({ uid }) => (
  <svg width={264} height={250} viewBox="0 0 264 250" style={{ display: "block", overflow: "visible" }}>
    <defs>
      <linearGradient id={`clh${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FF6B6B" />
        <stop offset="1" stopColor="#D0001A" />
      </linearGradient>
    </defs>
    <rect x={30} y={44} width={214} height={198} rx={18} fill="#D5DCE8" stroke={INK} strokeWidth={6} transform="rotate(4 137 143)" />
    <rect x={22} y={36} width={220} height={204} rx={18} fill="#FFFFFF" stroke={INK} strokeWidth={6} />
    <path d="M22 54 a18 18 0 0 1 18 -18 h184 a18 18 0 0 1 18 18 v34 h-220 Z" fill={`url(#clh${uid})`} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    <path d="M38 50 h188" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.3} />
    {[78, 186].map((rx) => (
      <rect key={rx} x={rx - 9} y={16} width={18} height={42} rx={9} fill="#D6DEE9" stroke={INK} strokeWidth={5} />
    ))}
    <path d="M242 206 L242 222 a18 18 0 0 1 -18 18 L206 240 Z" fill="#E4E9F2" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <text x={88} y={190} textAnchor="middle" fontFamily={FONT.title} fontSize={118} fill={INK}>
      5
    </text>
    <text x={88} y={226} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={900} fontSize={30} letterSpacing={2} fill={INK}>
      AÑOS
    </text>
    <g stroke="#2F6BFF" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M190 120 C208 119 220 134 218 152 C216 170 202 182 186 180 C168 178 158 164 160 148 C162 132 174 121 192 122" />
      <path d="M177 143 L177 150 M200 143 L200 150" />
      <path d="M175 168 C182 160 194 160 202 168" />
    </g>
    <path d="M208 153 C211 159 213 163 211 166 C209 169 204 168 204 164 C204 161 206 157 208 153 Z" fill="#8FD0FF" stroke="#2F6BFF" strokeWidth={2.5} />
    <path d="M168 200 l6 -10 M184 204 l6 -10 M200 200 l6 -10" stroke="#2F6BFF" strokeWidth={3.5} strokeLinecap="round" opacity={0.7} />
  </svg>
);

/** Time-travel icon: a gold stopwatch whose hands run backwards, inside two circular arrows. */
const TimeTravelArt: React.FC<{ uid: string; spin: number; hand: number }> = ({ uid, spin, hand }) => {
  const C = { x: 132, y: 130 };
  const R = 104;
  const arc = (a1: number, a2: number) => {
    const [x1, y1] = polar(R, a1);
    const [x2, y2] = polar(R, a2);
    return `M${C.x + x1} ${C.y + y1} A${R} ${R} 0 0 1 ${C.x + x2} ${C.y + y2}`;
  };
  const head = (a: number) => {
    const [tx, ty] = polar(R, a - 17);
    const [b1x, b1y] = polar(R - 17, a + 3);
    const [b2x, b2y] = polar(R + 17, a + 3);
    return `M${C.x + tx} ${C.y + ty} L${C.x + b1x} ${C.y + b1y} L${C.x + b2x} ${C.y + b2y} Z`;
  };
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = polar(i % 3 === 0 ? 36 : 41, i * 30);
    const [x2, y2] = polar(46, i * 30);
    ticks.push(<line key={i} x1={C.x + x1} y1={C.y + 8 + y1} x2={C.x + x2} y2={C.y + 8 + y2} stroke={INK} strokeWidth={i % 3 === 0 ? 5 : 3} strokeLinecap="round" />);
  }
  return (
    <svg width={264} height={250} viewBox="0 0 264 250" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`ttg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE680" />
          <stop offset="0.6" stopColor="#FFB02E" />
          <stop offset="1" stopColor="#E07800" />
        </linearGradient>
      </defs>
      <g transform={`rotate(${spin} ${C.x} ${C.y})`}>
        {[
          [300, 60],
          [120, 240],
        ].map(([a1, a2]) => (
          <g key={a1}>
            <path d={arc(a1, a2)} stroke={INK} strokeWidth={22} fill="none" strokeLinecap="round" />
            <path d={head(a1)} fill={INK} stroke={INK} strokeWidth={10} strokeLinejoin="round" />
            <path d={arc(a1, a2)} stroke="#5CF2FF" strokeWidth={11} fill="none" strokeLinecap="round" />
            <path d={head(a1)} fill="#5CF2FF" />
          </g>
        ))}
      </g>
      <Outlined w={8}>
        <rect x={C.x - 13} y={C.y - 82} width={26} height={18} rx={6} fill="#FFE680" />
        <rect x={C.x - 6} y={C.y - 68} width={12} height={14} fill="#C9D2DE" />
        <rect x={C.x + 38} y={C.y - 60} width={18} height={14} rx={4} transform={`rotate(45 ${C.x + 47} ${C.y - 53})`} fill="#C9D2DE" />
        <circle cx={C.x} cy={C.y + 8} r={64} fill={`url(#ttg${uid})`} />
      </Outlined>
      <circle cx={C.x} cy={C.y + 8} r={50} fill="#FFFFFF" />
      {ticks}
      <g transform={`rotate(${hand * 0.25} ${C.x} ${C.y + 8})`}>
        <line x1={C.x} y1={C.y + 12} x2={C.x} y2={C.y - 18} stroke={INK} strokeWidth={6} strokeLinecap="round" />
      </g>
      <g transform={`rotate(${hand} ${C.x} ${C.y + 8})`}>
        <line x1={C.x} y1={C.y + 16} x2={C.x} y2={C.y - 32} stroke="#FF3B30" strokeWidth={4.5} strokeLinecap="round" />
      </g>
      <circle cx={C.x} cy={C.y + 8} r={6} fill={INK} />
      <path d={`M${C.x - 40} ${C.y - 12} Q${C.x - 30} ${C.y - 34} ${C.x - 10} ${C.y - 40}`} stroke="#FFFFFF" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={sparkle(30, 40, 13)} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      <path d={sparkle(236, 210, 11)} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
    </svg>
  );
};

const CROSS_ITEMS = [
  { bg: "linear-gradient(160deg, #B8C6E6 0%, #7F90BF 55%, #5A6A9E 100%)", label: ["TRISTES"], size: 58 },
  { bg: "linear-gradient(160deg, #A58BFF 0%, #6A4BEB 50%, #3A22B8 100%)", label: ["VIAJE EN", "EL TIEMPO"], size: 44 },
];

/** Hand-drawn red X: two brush strokes in a CROSS_W x CROSS_H box. */
const RedX: React.FC<{ s1: number; s2: number }> = ({ s1, s2 }) => {
  const strokes: [string, number][] = [
    ["M34 56 Q150 214 296 388", s1],
    ["M298 52 Q168 236 36 392", s2],
  ];
  return (
    <svg width={CROSS_W} height={CROSS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {strokes.map(([d, s], i) =>
        s > 0 ? (
          <g key={i}>
            <path d={d} stroke={INK} strokeWidth={54} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - s)} />
            <path d={d} stroke="#FF2238" strokeWidth={36} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - s)} />
            <path
              d={d}
              transform="translate(-5 -6)"
              stroke="#FF8A8A"
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${Math.max(0, 86 * s - 8)} 200`}
              strokeDashoffset={-8}
            />
          </g>
        ) : null,
      )}
    </svg>
  );
};

/**
 * "No hay cinco años tristes, no hay viaje en el tiempo": two cards side by side that pop in
 * and get slashed by a big hand-drawn red X. Card 1 = a tear-off calendar page "5 AÑOS" with a
 * sad-face doodle, labelled "TRISTES"; card 2 = a stopwatch running backwards inside two
 * circular arrows, labelled "VIAJE EN EL TIEMPO". `items[i].at` pops card i in, at
 * `items[i].crossAt` its X is drawn (two strokes over 7 frames), the card jolts with impact
 * lines and turns grey. Only the first two items are used (one item = one centred card).
 * Leaves at `out` if given. `x`, `y` = centre of the pair; ~720 x 460 (x ± 360, y ± 230).
 * Suggested: x 500, y 600.
 */
export const CrossedList: React.FC<{
  frame: number;
  items: { at: number; crossAt: number }[];
  x: number;
  y: number;
  out?: number;
  scale?: number;
  gap?: number;
}> = ({ frame, items, x, y, out, scale = 1, gap = 44 }) => {
  const uid = useUid();
  const list = items.slice(0, 2);
  if (!list.length || frame < Math.min(...list.map((it) => it.at))) return null;
  if (out !== undefined && frame > out + 10) return null;
  const k = leave(frame, out);
  const n = list.length;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${scale * (1 - k)})`, opacity: 1 - k, pointerEvents: "none" }}>
      {list.map((it, i) => {
        if (frame < it.at) return null;
        const t = frame - it.at;
        const p = pop(frame, it.at, { damping: 10, stiffness: 190 });
        const hit = it.crossAt + 4;
        const s1 = ramp(frame, it.crossAt, it.crossAt + 4, [0, 1], EASE_OUT);
        const s2 = ramp(frame, it.crossAt + 3, it.crossAt + 7, [0, 1], EASE_OUT);
        const dim = ramp(frame, hit, hit + 8, [0, 1], EASE_OUT);
        const tilt = (i % 2 ? 1 : -1) * 4 * ramp(frame, hit, hit + 6, [0, 1], EASE_OUT);
        const ox = (i - (n - 1) / 2) * (CROSS_W + gap) + kick(frame, hit, 16, 12, i + 5);
        const oy = kick(frame, hit, 9, 12, i + 9);
        const rot = (i % 2 ? 3.5 : -3.5) + tilt + (1 - p) * (i % 2 ? 14 : -14) + Math.sin(t * 0.07 + i) * 0.6;
        const frozen = Math.min(frame, hit);
        const item = CROSS_ITEMS[i];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: ox,
              top: oy,
              width: CROSS_W,
              height: CROSS_H,
              transform: `translate(-50%, -50%) translateY(${(1 - p) * 70}px) scale(${p}) rotate(${rot}deg)`,
              opacity: Math.min(1, p * 3),
            }}
          >
            <div style={{ position: "absolute", left: CROSS_W / 2, top: CROSS_H / 2 }}>
              <ImpactLines frame={frame} at={hit} rx={250} ry={290} />
            </div>
            <div
              style={{
                position: "relative",
                width: CROSS_W,
                height: CROSS_H,
                borderRadius: 36,
                background: item.bg,
                border: "7px solid #FFFFFF",
                boxShadow: SHADOW,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 22,
                filter: dim > 0 ? `grayscale(${0.8 * dim}) brightness(${1 - 0.15 * dim})` : undefined,
              }}
            >
              {i === 0 ? <CalendarArt uid={`${uid}a`} /> : <TimeTravelArt uid={`${uid}b`} spin={-frozen * 2.4} hand={-frozen * 14} />}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 8 }}>
                {item.label.map((ln) => (
                  <div key={ln} style={{ paddingTop: item.size * 0.24 }}>
                    <HeavyText text={ln} size={item.size} colors={TXT_WHITE} />
                  </div>
                ))}
              </div>
            </div>
            <RedX s1={s1} s2={s2} />
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================================
// TeamComplete

type HeroKind = "mask" | "glow" | "gem" | "brow" | "visor" | "slits" | "nubi";
const TEAM: { c: string; kind: HeroKind }[] = [
  { c: "#E8323C", kind: "mask" },
  { c: "#2B2B36", kind: "glow" },
  { c: "#B3123E", kind: "gem" },
  { c: "#8A5A3C", kind: "brow" },
  { c: "#2F6BFF", kind: "visor" },
  { c: "#FFC233", kind: "slits" },
  { c: "#8EDCA2", kind: "nubi" },
];

/** Round hero token: a coloured disc with a white ring and a simple face (eyes only, no mouth). */
const HeroToken: React.FC<{ c: string; kind: HeroKind; size?: number; id: string }> = ({ c, kind, size = 92, id }) => {
  const eye = (cx: number, rx = 7.5, ry = 10) => (
    <g key={cx}>
      <ellipse cx={cx} cy={-3} rx={rx} ry={ry} fill="#141414" />
      <circle cx={cx + rx * 0.3} cy={-3 - ry * 0.4} r={rx * 0.38} fill="#FFFFFF" />
    </g>
  );
  let face: React.ReactNode;
  switch (kind) {
    case "mask":
      face = (
        <>
          <rect x={-33} y={-15} width={66} height={22} rx={11} fill={mix(c, "#000000", 0.55)} />
          <path d="M-25 -4 C-21 -11 -10 -11 -6 -3 C-11 0 -20 0 -25 -4 Z" fill="#FFFFFF" />
          <path d="M25 -4 C21 -11 10 -11 6 -3 C11 0 20 0 25 -4 Z" fill="#FFFFFF" />
        </>
      );
      break;
    case "glow":
      face = (
        <>
          <circle cx={-14} cy={-3} r={12} fill="#FFFFFF" opacity={0.18} />
          <circle cx={14} cy={-3} r={12} fill="#FFFFFF" opacity={0.18} />
          <path d="M-24 -8 L-6 -3 L-9 3 L-23 0 Z" fill="#FFFFFF" />
          <path d="M24 -8 L6 -3 L9 3 L23 0 Z" fill="#FFFFFF" />
        </>
      );
      break;
    case "gem":
      face = (
        <>
          {eye(-14)}
          {eye(14)}
          <path d="M0 -32 L7 -24 L0 -16 L-7 -24 Z" fill="#FFD60A" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        </>
      );
      break;
    case "brow":
      face = (
        <>
          {eye(-14, 7, 9)}
          {eye(14, 7, 9)}
          <path d="M-25 -18 L-6 -13 M25 -18 L6 -13" stroke="#141414" strokeWidth={5} strokeLinecap="round" />
        </>
      );
      break;
    case "visor":
      face = (
        <>
          <rect x={-31} y={-15} width={62} height={24} rx={12} fill="#BDEBFF" stroke={INK} strokeWidth={3} />
          {eye(-13, 6.5, 8)}
          {eye(13, 6.5, 8)}
          <path d="M-24 -10 L-14 -10" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        </>
      );
      break;
    case "slits":
      face = (
        <>
          <rect x={-31} y={-13} width={62} height={20} rx={8} fill={mix(c, "#7A1010", 0.6)} />
          <rect x={-25} y={-7} width={18} height={7} rx={3} fill="#E6FFFF" />
          <rect x={7} y={-7} width={18} height={7} rx={3} fill="#E6FFFF" />
          <rect x={-27} y={-9} width={22} height={11} rx={5} fill="#7CF6FF" opacity={0.35} />
          <rect x={5} y={-9} width={22} height={11} rx={5} fill="#7CF6FF" opacity={0.35} />
        </>
      );
      break;
    default:
      face = (
        <>
          {eye(-14, 8.5, 11)}
          {eye(14, 8.5, 11)}
          <ellipse cx={-24} cy={12} rx={6} ry={4} fill="#FF9EB0" opacity={0.7} />
          <ellipse cx={24} cy={12} rx={6} ry={4} fill="#FF9EB0" opacity={0.7} />
        </>
      );
  }
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id={`htg${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={mix(c, "#FFFFFF", 0.35)} />
          <stop offset="1" stopColor={c} />
        </radialGradient>
      </defs>
      <circle r={48} fill={INK} />
      <circle r={44} fill="#FFFFFF" />
      <circle r={38} fill={`url(#htg${id})`} />
      <g transform="translate(0 4)">{face}</g>
      <path d="M-27 -18 A32 32 0 0 1 -8 -32" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.5} />
    </svg>
  );
};

/**
 * "¡EQUIPO COMPLETO!" badge: a cosmic purple card with a "HÉROES n/7" header and a row of seven
 * empty dashed slots that fill one by one with round hero tokens (red, black, crimson, brown,
 * blue, gold and mint-green Nubi; simple eye shapes, no mouths) from `fillFrom` (at + 8) to
 * `fillTo` (fillFrom + 30), each with a sparkle. Then the counter turns green with a check
 * badge (fillTo + 4) and a green rubber stamp "¡EQUIPO COMPLETO!" slams onto the card's
 * bottom edge (fillTo + 10) with a jolt, impact lines and confetti. Leaves at `out` if given.
 * `x`, `y` = card centre; ~800 x 270 plus the stamp (~60 px below): x ± 400, y - 135 … y + 200.
 * Suggested: x 500, y 520.
 */
export const TeamComplete: React.FC<{
  frame: number;
  at: number;
  fillFrom?: number;
  fillTo?: number;
  x: number;
  y: number;
  out?: number;
  scale?: number;
  stampText?: string;
}> = ({ frame, at, fillFrom, fillTo, x, y, out, scale = 1, stampText = "¡EQUIPO COMPLETO!" }) => {
  const uid = useUid();
  if (frame < at) return null;
  if (out !== undefined && frame > out + 10) return null;
  const t = frame - at;
  const f0 = fillFrom ?? at + 8;
  const f1 = fillTo ?? f0 + 30;
  const N = TEAM.length;
  const fillAt = (i: number) => f0 + ((f1 - f0) * i) / (N - 1);
  const count = TEAM.filter((_, i) => frame >= fillAt(i)).length;
  const doneAt = f1 + 4;
  const stampAt = f1 + 10;
  const done = frame >= doneAt;
  const p = pop(frame, at, { damping: 11, stiffness: 180 });
  const k = leave(frame, out);
  const checkP = pop(frame, doneAt, { damping: 8, stiffness: 240 });
  const countBump = TEAM.reduce((m, _, i) => Math.max(m, bump(frame, fillAt(i), 6)), 0);
  const sd = frame - stampAt;
  const IMPACT = 5;
  const stampS =
    sd < 0 ? 0 : sd < IMPACT ? interpolate(sd, [0, IMPACT], [2.4, 1], { ...CLAMP, easing: EASE_IN }) : 1 + 0.07 * Math.sin((sd - IMPACT) * 0.9) * Math.exp(-(sd - IMPACT) / 5);
  const hitAt = stampAt + IMPACT;
  const shx = kick(frame, hitAt, 12, 12, 21);
  const shy = kick(frame, hitAt, 7, 12, 23);
  const confetti: React.ReactNode[] = [];
  const cd = frame - hitAt;
  const CONFETTI = ["#FFD60A", "#8EDCA2", "#FF5C8A", "#5CE1FF", "#FFFFFF", "#FF9A3D", "#B48CFF"];
  if (cd >= 0 && cd < 36) {
    for (let i = 0; i < 32; i++) {
      const x0 = (rand(i * 1.9 + 4) - 0.5) * 520;
      const vx = x0 * 0.03 + (rand(i * 2.3 + 1) - 0.5) * 14;
      const vy = -9 - rand(i * 3.7 + 2) * 15;
      const px = x0 + vx * cd;
      const py = vy * cd + 0.85 * cd * cd;
      const rot = (rand(i * 5.1) - 0.5) * 40 * cd;
      confetti.push(
        <rect
          key={i}
          x={-6}
          y={-9}
          width={12}
          height={18}
          rx={3}
          transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${rot.toFixed(1)})`}
          fill={CONFETTI[i % CONFETTI.length]}
          stroke={INK}
          strokeWidth={2.5}
          opacity={Math.min(1, 2 * (1 - cd / 36))}
        />,
      );
    }
  }
  return (
    <div style={{ position: "absolute", left: x + shx, top: y + shy, width: 0, height: 0, transform: `scale(${scale * (1 - k)})`, opacity: 1 - k, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 800,
          transform: `translate(-50%, -50%) scale(${p}) rotate(${-1.5 + (1 - p) * -10 + Math.sin(t * 0.06) * 0.5}deg)`,
          opacity: Math.min(1, p * 3),
        }}
      >
        {sd >= 0 ? (
          <div style={{ position: "absolute", left: "50%", top: "100%", width: 0, height: 0, marginTop: 24 }}>
            <ImpactLines frame={frame} at={hitAt} rx={400} ry={150} n={16} />
          </div>
        ) : null}
        <div
          style={{
            position: "relative",
            borderRadius: 38,
            background: "linear-gradient(160deg, #4B2FC9 0%, #2A1784 60%, #1B0E5A 100%)",
            border: "7px solid #FFFFFF",
            boxShadow: SHADOW,
            padding: "12px 24px 54px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 70, padding: "0 4px" }}>
            <div style={{ paddingTop: 12 }}>
              <HeavyText text="HÉROES" size={50} colors={TXT_WHITE} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ paddingTop: 12, transform: `scale(${1 + 0.2 * countBump})` }}>
                <HeavyText text={`${count}/${N}`} size={54} colors={done ? TXT_GREEN : TXT_GOLD} />
              </div>
              <div style={{ width: 62, height: 62, transform: `scale(${done ? checkP : 0}) rotate(${(1 - checkP) * -90}deg)` }}>
                <MarkBadge kind="check" size={62} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            {TEAM.map((h, i) => {
              const fa = fillAt(i);
              const tp = pop(frame, fa, { damping: 8, stiffness: 260, mass: 0.6 });
              const spark = bump(frame, fa, 12);
              const bob = frame >= fa ? Math.sin((frame - fa) * 0.16 + i) * 3 : 0;
              return (
                <div key={i} style={{ position: "relative", width: 92, height: 92 }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "5px dashed rgba(255,255,255,0.4)",
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: FONT.heavy,
                      fontWeight: 900,
                      fontSize: 36,
                      color: "rgba(255,255,255,0.4)",
                      opacity: 1 - Math.min(1, tp),
                    }}
                  >
                    ?
                  </div>
                  {frame >= fa ? (
                    <div style={{ position: "absolute", inset: 0, transform: `translateY(${bob}px) scale(${tp}) rotate(${(1 - tp) * -40}deg)` }}>
                      <HeroToken c={h.c} kind={h.kind} id={`${uid}${i}`} />
                    </div>
                  ) : null}
                  {spark > 0.02 ? (
                    <svg width={92} height={92} viewBox="0 0 92 92" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                      <circle cx={46} cy={46} r={46 + 22 * (1 - spark)} fill="none" stroke="#FFFFFF" strokeWidth={6 * spark} opacity={spark} />
                      <path d={sparkle(86, 8, 14 * spark)} fill="#FFF3B0" stroke={INK} strokeWidth={2.5} />
                      <path d={sparkle(6, 78, 10 * spark)} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
                    </svg>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {sd >= 0 ? (
          <div style={{ position: "absolute", left: "50%", top: "100%", width: 0, height: 0, marginTop: 24 }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(-50%, -50%) rotate(-5deg) scale(${stampS})`,
                opacity: ramp(frame, stampAt, stampAt + 2),
                filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.25))",
              }}
            >
              <Stamp id={`${uid}st`} text={stampText} color="#13A548" w={600} h={116} fontSize={64} />
            </div>
            <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              {confetti}
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// =============================================================================================
// PowerChips

const ShieldIcon: React.FC<IconProps> = ({ size = 84, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <Outlined w={8}>
      <path d="M50 6 C62 13 76 15 88 15 C89 52 76 79 50 95 C24 79 11 52 12 15 C24 15 38 13 50 6 Z" fill="#E4EBF5" />
    </Outlined>
    <path d="M50 16 C60 22 70 24 79 24 C78 54 68 72 50 85 C32 72 22 54 21 24 C30 24 40 22 50 16 Z" fill="#2F6BFF" />
    <path d="M27 42 L50 56 L73 42 L72 53 L50 67 L28 53 Z" fill="#FFFFFF" />
    <path d="M30 31 C36 30 42 28 47 25" stroke="#9CC2FF" strokeWidth={4} strokeLinecap="round" fill="none" />
  </svg>
);

const HammerIcon: React.FC<IconProps> = ({ size = 84, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <g transform="rotate(-38 50 54)">
      <Outlined w={8}>
        <rect x={44} y={38} width={13} height={56} rx={6} fill="#9A5B2E" />
        <rect x={16} y={12} width={68} height={34} rx={8} fill="#C5CEDB" />
      </Outlined>
      <rect x={16} y={12} width={12} height={34} rx={5} fill="#8F9BAE" />
      <rect x={72} y={12} width={12} height={34} rx={5} fill="#8F9BAE" />
      <path d="M32 20 L66 20" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
      <path d="M44 58 L57 54 M44 68 L57 64 M44 78 L57 74" stroke="#5E3416" strokeWidth={3} strokeLinecap="round" />
    </g>
  </svg>
);

const BoltIcon: React.FC<IconProps> = ({ size = 84, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <Outlined w={8}>
      <path d="M60 4 L20 56 L46 56 L36 96 L82 38 L55 38 L66 4 Z" fill="#FFE14D" />
    </Outlined>
    <path d="M57 13 L31 48 L42 48" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.85} />
    <path d="M86 16 l8 -6 M90 30 l9 1 M10 76 l-8 5 M14 90 l-6 7" stroke={INK} strokeWidth={4} strokeLinecap="round" />
  </svg>
);

const MagicIcon: React.FC<IconProps & { frame?: number }> = ({ size = 84, frame = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <circle cx={50} cy={50} r={46} fill="#FFD27A" opacity={0.35 + 0.15 * Math.sin(frame * 0.3)} />
    <circle cx={50} cy={50} r={40} fill="#FFF4DD" stroke={INK} strokeWidth={13} />
    <circle cx={50} cy={50} r={40} fill="none" stroke="#FF9F1C" strokeWidth={6} />
    <g transform={`rotate(${frame * 3} 50 50)`}>
      <circle cx={50} cy={50} r={31} fill="none" stroke="#FFB13D" strokeWidth={3} strokeDasharray="6 5" />
      <rect x={29} y={29} width={42} height={42} fill="none" stroke="#FF7A1F" strokeWidth={4} strokeLinejoin="round" />
      <rect x={29} y={29} width={42} height={42} fill="none" stroke="#FF7A1F" strokeWidth={4} strokeLinejoin="round" transform="rotate(45 50 50)" />
    </g>
    <circle cx={50} cy={50} r={9} fill="#FFF3C4" stroke={INK} strokeWidth={3} />
  </svg>
);

const RockIcon: React.FC<IconProps> = ({ size = 84, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <Outlined w={8}>
      <path d="M14 70 C8 56 14 40 28 34 C34 20 54 14 68 22 C84 26 92 44 88 60 C90 76 76 88 58 86 C42 90 22 86 14 70 Z" fill="#A9A397" />
    </Outlined>
    <path d="M22 68 C30 78 44 81 58 79 C70 78 80 72 85 62 C86 75 76 85 58 84 C42 88 26 82 22 68 Z" fill="#8A847A" />
    <path d="M40 34 L48 46 L44 56 M64 40 L59 50" stroke="#6E695F" strokeWidth={3.5} strokeLinecap="round" fill="none" />
    <ellipse cx={34} cy={42} rx={8} ry={4} fill="#D8D3C8" transform="rotate(-25 34 42)" />
    <circle cx={66} cy={66} r={2.5} fill="#7A756B" />
    <circle cx={30} cy={62} r={2} fill="#7A756B" />
  </svg>
);

const POWERS: { label: string; bg: string; txt: string[] }[] = [
  { label: "ESCUDO", bg: "linear-gradient(135deg, #6FB6FF 0%, #2F6BFF 55%, #1E46C8 100%)", txt: TXT_WHITE },
  { label: "MARTILLO", bg: "linear-gradient(135deg, #A99CFF 0%, #6A55E8 55%, #4A33C4 100%)", txt: TXT_WHITE },
  { label: "RAYOS", bg: "linear-gradient(135deg, #FFE45C 0%, #FFC21F 55%, #FF9E0A 100%)", txt: TXT_WHITE },
  { label: "MAGIA", bg: "linear-gradient(135deg, #FFB45C 0%, #FF7A2A 55%, #E04E1A 100%)", txt: TXT_WHITE },
  { label: "PIEDRA", bg: "linear-gradient(135deg, #D4CEC4 0%, #A39C90 55%, #7E776C 100%)", txt: TXT_WHITE },
];

const CHIP_W = 350;

/**
 * "Uno con escudo, uno con martillo, uno con rayos, uno con magia… ¡y yo, que traje una
 * piedra!": five pill chips that pop in one at a time (`times[i]`), each with a drawn icon in a
 * white disc: shield "ESCUDO", hammer "MARTILLO", lightning "RAYOS", magic circle "MAGIA" and,
 * last, a grey rock chip "PIEDRA" that wobbles comically with a "?" bubble and a sweat drop.
 * layout "column" (default): a left-aligned stack of 5, ~370 x 620 (x ± 185, y ± 310), meant
 * for one side of the frame, e.g. x 250, y 640 (left edge ~75). layout "grid": 2 x 2 plus the
 * rock centred below, ~750 x 380 (x ± 375, y - 190 … y + 190), e.g. x 500, y 430. All leave
 * together at `out` if given.
 */
export const PowerChips: React.FC<{
  frame: number;
  times: number[];
  out?: number;
  x: number;
  y: number;
  scale?: number;
  layout?: "column" | "grid";
}> = ({ frame, times, out, x, y, scale = 1, layout = "column" }) => {
  if (!times.length || frame < Math.min(...times)) return null;
  if (out !== undefined && frame > out + 10) return null;
  const k = leave(frame, out);
  const pos = (i: number) =>
    layout === "grid"
      ? i < 4
        ? { x: (i % 2 ? 1 : -1) * (CHIP_W / 2 + 22), y: Math.floor(i / 2) * 128 - 128 }
        : { x: 0, y: 134 }
      : { x: 0, y: (i - 2) * 126 };
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${scale * (1 - k)})`, opacity: 1 - k, pointerEvents: "none" }}>
      {POWERS.map((pw, i) => {
        const at = times[i];
        if (at === undefined || frame < at) return null;
        const t = frame - at;
        const rock = i === 4;
        const p = pop(frame, at, rock ? { damping: 7, stiffness: 220 } : { damping: 10, stiffness: 220 });
        const wob = rock ? Math.sin(t * 0.32) * 5 : Math.sin(t * 0.08 + i) * 0.8;
        const hop = rock ? -Math.abs(Math.sin(t * 0.32)) * 6 : 0;
        const q = pop(frame, at + 8, { damping: 8, stiffness: 260 });
        const dropT = (((t - 12) % 26) + 26) % 26;
        const { x: px, y: py } = pos(i);
        let icon: React.ReactNode;
        if (i === 0) icon = <ShieldIcon size={80} />;
        else if (i === 1) icon = <HammerIcon size={80} />;
        else if (i === 2) icon = <BoltIcon size={80} />;
        else if (i === 3) icon = <MagicIcon size={80} frame={frame} />;
        else icon = <RockIcon size={82} />;
        return (
          <div
            key={pw.label}
            style={{
              position: "absolute",
              left: px,
              top: py + hop,
              width: CHIP_W,
              transform: `translate(-50%, -50%) translateX(${(1 - p) * -60}px) scale(${0.3 + 0.7 * p}) rotate(${(1 - p) * -14 + wob}deg)`,
              opacity: Math.min(1, p * 3),
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                height: 92,
                padding: "0 24px 0 112px",
                borderRadius: 999,
                background: pw.bg,
                border: "6px solid #FFFFFF",
                boxShadow: `0 0 0 4px ${INK}, 0 9px 0 4px rgba(0,0,0,0.3)`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -18,
                  top: "50%",
                  width: 116,
                  height: 116,
                  transform: "translateY(-50%)",
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 40% 35%, #FFFFFF 0%, #E8EEF8 100%)",
                  border: `5px solid ${INK}`,
                  boxSizing: "border-box",
                  boxShadow: "0 6px 0 rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {icon}
              </div>
              <div style={{ paddingTop: 12 }}>
                <HeavyText text={pw.label} size={48} colors={pw.txt} />
              </div>
              {rock ? (
                <>
                  <div
                    style={{
                      position: "absolute",
                      right: -26,
                      top: -40,
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      border: `5px solid ${INK}`,
                      boxSizing: "border-box",
                      boxShadow: "0 5px 0 rgba(0,0,0,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `scale(${q}) rotate(${12 + Math.sin(t * 0.25) * 8}deg)`,
                      fontFamily: FONT.title,
                      fontSize: 44,
                      lineHeight: 1,
                      paddingTop: 8,
                      color: "#FF7A1F",
                    }}
                  >
                    ?
                  </div>
                  {t >= 12 ? (
                    <svg
                      width={26}
                      height={34}
                      viewBox="0 0 26 34"
                      style={{ position: "absolute", left: 70, top: -26 + dropT * 1.4, opacity: 1 - dropT / 26, overflow: "visible" }}
                    >
                      <path d="M13 2 C17 10 23 16 23 23 C23 29 18 32 13 32 C8 32 3 29 3 23 C3 16 9 10 13 2 Z" fill="#7FD0FF" stroke={INK} strokeWidth={3} />
                      <path d="M9 22 C9 19 10 17 12 15" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" fill="none" />
                    </svg>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================================
// StonesHUD

const STONES = ["#2F7BFF", "#FF2D3D", "#9B3DFF", "#FFD60A", "#FF8A1F", "#2EE07A"];
const SOCKET_X = [205, 291, 377, 463, 549, 635];
const SOCKET_Y = 112;

/** Faceted gem (unlit = dark and dull; lit = bright with a glint). */
const Gem: React.FC<{ cx: number; cy: number; color: string; lit: boolean }> = ({ cx, cy, color, lit }) => {
  const base = lit ? color : mix(color, "#1A1030", 0.7);
  const pts: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    pts.push([cx + Math.cos(a) * 24, cy + Math.sin(a) * 29]);
  }
  const inner = pts.map(([px, py]) => [cx + (px - cx) * 0.52, cy + (py - cy) * 0.52 - 3] as [number, number]);
  const toPath = (ps: [number, number][]) => `M${ps.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(" L")} Z`;
  return (
    <g>
      <path d={toPath(pts)} fill={base} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      {pts.map(([px, py], i) => (
        <line key={i} x1={inner[i][0]} y1={inner[i][1]} x2={px} y2={py} stroke="rgba(0,0,0,0.22)" strokeWidth={2} />
      ))}
      <path d={`M${pts[4][0]} ${pts[4][1]} L${pts[5][0]} ${pts[5][1]} L${pts[6][0]} ${pts[6][1]} L${inner[6][0]} ${inner[6][1]} L${inner[5][0]} ${inner[5][1]} L${inner[4][0]} ${inner[4][1]} Z`} fill={mix(base, "#FFFFFF", 0.25)} />
      <path d={toPath(inner)} fill={mix(base, "#FFFFFF", lit ? 0.4 : 0.15)} stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} />
      <ellipse cx={cx - 8} cy={cy - 12} rx={5} ry={7} transform={`rotate(25 ${cx - 8} ${cy - 12})`} fill="#FFFFFF" opacity={lit ? 0.9 : 0.25} />
    </g>
  );
};

/** Small warning triangle with "!". */
const WarnTri: React.FC<{ size?: number; on?: number }> = ({ size = 40, on = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
    <path d="M50 10 L93 86 L7 86 Z" fill={on ? "#FFD60A" : "#8A7420"} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
    <rect x={45} y={34} width={10} height={30} rx={5} fill={INK} />
    <circle cx={50} cy={74} r={6} fill={INK} />
  </svg>
);

/**
 * The six stones (blue, red, purple, yellow, orange, green) set in a gold, gauntlet-shaped
 * armoured bar (knuckle plates on top, a flared cuff on the left, a rounded fist end), on a
 * dark cosmic panel. The panel pops in at `at`; the stones light up one by one from `litFrom`
 * (at + 10), every `step` frames (6), each with a flash ring and a sparkle, while the "PODER"
 * meter below climbs in steps to `power` % (100). When it hits 100 % (≈ litFrom + 5·step + 6)
 * the danger kicks in: red flash, the rim blinks red/gold, a "¡PELIGRO!" tag pops on the top
 * right corner, the meter pulses red and (vignette) the edges of the whole frame pulse red.
 * Out at `out`. `x`, `y` = panel centre; ~800 x 300 (x ± 400, y ± 150; the tag pokes ~40 px
 * above the top-right). Suggested: x 500, y 450.
 */
export const StonesHUD: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  power?: number;
  litFrom?: number;
  step?: number;
  scale?: number;
  vignette?: boolean;
}> = ({ frame, at, out, x, y, power = 100, litFrom, step = 6, scale = 1, vignette = true }) => {
  const uid = useUid();
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const l0 = litFrom ?? at + 10;
  const litAt = (i: number) => l0 + i * step;
  const p = pop(frame, at, { damping: 11, stiffness: 180 });
  const k = leave(frame, out);
  let pct = 0;
  for (let i = 0; i < 6; i++) pct += (power / 6) * ramp(frame, litAt(i), litAt(i) + 6, [0, 1], EASE_OUT);
  const maxAt = litAt(5) + 6;
  const danger = power >= 100 && frame >= maxAt;
  const dk = danger ? 1 : 0;
  const alarm = danger ? blink(frame, maxAt, 4, 4) : 0;
  const flash = bump(frame, maxAt, 10);
  const pulse = danger ? 0.5 + 0.5 * Math.sin((frame - maxAt) * 0.45) : 0;
  const tagP = pop(frame, maxAt, { damping: 8, stiffness: 240 });
  const shx = kick(frame, maxAt, 9, 14, 31);
  const scallops = SOCKET_X.map((cx) => `Q${cx} 28 ${cx + 43} 64`).join(" ");
  const plate = `M118 64 L162 64 ${scallops} C722 66 752 92 752 116 C752 142 722 166 678 168 L118 168 Z`;
  return (
    <>
      {vignette && danger ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            boxShadow: `inset 0 0 ${150 + 60 * pulse}px ${30 + 20 * pulse}px rgba(255,20,40,${(0.35 + 0.3 * pulse + 0.3 * flash) * (1 - k)})`,
          }}
        />
      ) : null}
      <div style={{ position: "absolute", left: x + shx, top: y, width: 0, height: 0, transform: `scale(${scale * (1 - k)})`, opacity: 1 - k, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 800,
            transform: `translate(-50%, -50%) scale(${p}) rotate(${(1 - p) * -8 + Math.sin(t * 0.06) * 0.4}deg)`,
            opacity: Math.min(1, p * 3),
          }}
        >
          <div
            style={{
              position: "relative",
              borderRadius: 40,
              background: "linear-gradient(180deg, rgba(48,18,104,0.95) 0%, rgba(20,6,52,0.95) 100%)",
              border: `7px solid ${alarm ? "#FF3B30" : GOLD}`,
              boxShadow: `${SHADOW}, 0 0 ${30 + 30 * dk * pulse}px rgba(${danger ? "255,40,60" : "160,90,255"},${0.45 + 0.3 * dk * pulse})`,
              padding: "6px 10px 22px",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <svg width={766} height={196} viewBox="0 0 780 200" style={{ display: "block", overflow: "visible" }}>
              <defs>
                <linearGradient id={`sgg${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFF3BF" />
                  <stop offset="0.35" stopColor="#FFD45C" />
                  <stop offset="0.7" stopColor="#E0A020" />
                  <stop offset="1" stopColor="#A86A0C" />
                </linearGradient>
                <linearGradient id={`sgc${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFE38A" />
                  <stop offset="0.5" stopColor="#D99A1C" />
                  <stop offset="1" stopColor="#8E5A08" />
                </linearGradient>
                {STONES.map((c, i) => (
                  <radialGradient key={i} id={`sgl${uid}${i}`}>
                    <stop offset="0" stopColor={c} stopOpacity={0.9} />
                    <stop offset="1" stopColor={c} stopOpacity={0} />
                  </radialGradient>
                ))}
              </defs>
              {STONES.map((c, i) =>
                frame >= litAt(i) ? (
                  <circle key={i} cx={SOCKET_X[i]} cy={SOCKET_Y} r={62 + 6 * Math.sin(t * 0.3 + i)} fill={`url(#sgl${uid}${i})`} opacity={0.75} />
                ) : null,
              )}
              <Outlined w={9}>
                <path d="M22 48 L134 60 L134 172 L22 184 C13 150 13 82 22 48 Z" fill={`url(#sgc${uid})`} />
                <path d={plate} fill={`url(#sgg${uid})`} />
              </Outlined>
              <path d="M48 56 C42 90 42 140 48 178 M76 58 C71 92 71 140 76 175 M104 60 C100 94 100 138 104 172" stroke="#8E5A08" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.7} />
              <path d="M124 150 L676 150 C700 150 726 140 742 126" stroke="#A86A0C" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.55} />
              <path d={`M170 74 ${SOCKET_X.map((cx) => `L${cx - 20} 72 Q${cx} 52 ${cx + 20} 72`).join(" ")}`} stroke="#FFF8DA" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.65} />
              {SOCKET_X.slice(0, 5).map((cx) => (
                <g key={cx}>
                  <circle cx={cx + 43} cy={136} r={6} fill="#FFE38A" stroke={INK} strokeWidth={3} />
                  <path d={`M${cx + 43} 78 L${cx + 43} 120`} stroke="#A86A0C" strokeWidth={4} strokeLinecap="round" opacity={0.6} />
                </g>
              ))}
              {SOCKET_X.map((cx, i) => {
                const lit = frame >= litAt(i);
                const fl = bump(frame, litAt(i), 12);
                const gs = lit ? 1 + 0.25 * bump(frame, litAt(i), 8) : 1;
                return (
                  <g key={i}>
                    <ellipse cx={cx} cy={SOCKET_Y} rx={33} ry={38} fill="#2A160A" stroke={INK} strokeWidth={4} />
                    <ellipse cx={cx} cy={SOCKET_Y} rx={33} ry={38} fill="none" stroke="#8E5A08" strokeWidth={3} transform={`translate(0 2)`} opacity={0.6} />
                    <g transform={`translate(${cx} ${SOCKET_Y}) scale(${gs}) translate(${-cx} ${-SOCKET_Y})`}>
                      <Gem cx={cx} cy={SOCKET_Y} color={STONES[i]} lit={lit} />
                    </g>
                    {fl > 0.02 ? (
                      <>
                        <circle cx={cx} cy={SOCKET_Y} r={34 + 40 * (1 - fl)} fill="none" stroke="#FFFFFF" strokeWidth={7 * fl} opacity={fl} />
                        <path d={sparkle(cx + 24, SOCKET_Y - 34, 20 * fl)} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
                      </>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 18px 0 14px" }}>
              <div style={{ paddingTop: 10 }}>
                <HeavyText text="PODER" size={42} colors={TXT_GOLD} />
              </div>
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  height: 40,
                  borderRadius: 20,
                  background: "#160A2E",
                  boxShadow: `0 0 0 4px ${INK}, 0 0 0 7px rgba(255,255,255,0.18)`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    height: "100%",
                    background: danger
                      ? `linear-gradient(90deg, #FF8A7A 0%, ${alarm ? "#FFFFFF" : "#FF3B30"} 60%, #D0001A 100%)`
                      : "linear-gradient(90deg, #7B2FF7 0%, #FF4FD8 55%, #FFC83D 100%)",
                  }}
                />
                {Array.from({ length: 9 }, (_, j) => (
                  <div key={j} style={{ position: "absolute", left: `${(j + 1) * 10}%`, top: 0, bottom: 0, width: 3, background: "rgba(0,0,0,0.3)" }} />
                ))}
                <div style={{ position: "absolute", left: 10, right: 10, top: 6, height: 9, borderRadius: 5, background: "rgba(255,255,255,0.28)" }} />
              </div>
              <div style={{ width: 128, display: "flex", justifyContent: "flex-end", paddingTop: 10, transform: `scale(${1 + 0.12 * dk * pulse})` }}>
                <HeavyText text={`${Math.round(pct)}%`} size={46} colors={danger ? TXT_RED : TXT_WHITE} />
              </div>
            </div>
            {flash > 0 ? <div style={{ position: "absolute", inset: 0, background: "#FF2A3A", opacity: flash * 0.55 }} /> : null}
          </div>
          {danger ? (
            <div
              style={{
                position: "absolute",
                right: 18,
                top: 0,
                transform: `translate(0, -62%) scale(${tagP}) rotate(${5 + (1 - tagP) * 20}deg)`,
                transformOrigin: "100% 100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 22px 4px 12px",
                borderRadius: 999,
                background: "linear-gradient(180deg, #FF5A4E 0%, #C8001A 100%)",
                border: "5px solid #FFFFFF",
                boxShadow: `0 0 0 4px ${INK}, 0 7px 0 4px rgba(0,0,0,0.3), 0 0 ${20 + 20 * pulse}px rgba(255,40,40,0.8)`,
                whiteSpace: "nowrap",
              }}
            >
              <WarnTri size={42} on={alarm ? 0 : 1} />
              <div style={{ paddingTop: 8 }}>
                <HeavyText text="¡PELIGRO!" size={40} colors={TXT_WHITE} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

// =============================================================================================
// PizzaApp

type Holo = { line: string; strong: string; fill: string; glow: string; dark: string; btn: [string, string] };
const HOLO_CYAN: Holo = {
  line: "#BFFBFF",
  strong: "#5CF2FF",
  fill: "rgba(90,230,255,0.32)",
  glow: "rgba(80,230,255,0.65)",
  dark: "rgba(4,46,70,0.55)",
  btn: ["#C8FDFF", "#3FD8F5"],
};
const HOLO_RED: Holo = {
  line: "#FFD3DE",
  strong: "#FF5C8A",
  fill: "rgba(255,92,138,0.32)",
  glow: "rgba(255,80,120,0.65)",
  dark: "rgba(70,6,30,0.55)",
  btn: ["#FFD3DE", "#FF6F98"],
};

/** Hologram pizza (monochrome): seven slices plus one pulled out with stretchy cheese. */
const HoloPizza: React.FC<{ size?: number; frame: number; h: Holo }> = ({ size = 200, frame, h }) => {
  const R = 80;
  const wedge = (i: number, dx: number, dy: number) => {
    const [x1, y1] = polar(R, i * 45);
    const [x2, y2] = polar(R, (i + 1) * 45);
    return `M${dx} ${dy} L${x1 + dx} ${y1 + dy} A${R} ${R} 0 0 1 ${x2 + dx} ${y2 + dy} Z`;
  };
  const crust = (i: number, dx: number, dy: number) => {
    const [x1, y1] = polar(R - 5, i * 45 + 2);
    const [x2, y2] = polar(R - 5, (i + 1) * 45 - 2);
    return `M${x1 + dx} ${y1 + dy} A${R - 5} ${R - 5} 0 0 1 ${x2 + dx} ${y2 + dy}`;
  };
  const pull = 1;
  const [ox, oy] = polar(14 + 4 * Math.sin(frame * 0.15), pull * 45 + 22.5);
  const slices = [];
  for (let i = 0; i < 8; i++) {
    const dx = i === pull ? ox : 0;
    const dy = i === pull ? oy : 0;
    const [m1x, m1y] = polar(48, i * 45 + 22.5);
    const [m2x, m2y] = polar(26, i * 45 + 14);
    slices.push(
      <g key={i}>
        <path d={wedge(i, dx, dy)} fill={h.fill} stroke={h.line} strokeWidth={3} strokeLinejoin="round" />
        <path d={crust(i, dx, dy)} stroke={h.line} strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.85} />
        <circle cx={m1x + dx} cy={m1y + dy} r={9} fill={h.strong} opacity={0.75} stroke={h.line} strokeWidth={2} />
        {i % 2 ? <circle cx={m2x + dx} cy={m2y + dy} r={6} fill={h.strong} opacity={0.6} /> : null}
      </g>,
    );
  }
  const [c1x, c1y] = polar(36, pull * 45 + 4);
  const [c2x, c2y] = polar(44, pull * 45 + 40);
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={{ display: "block", overflow: "visible" }}>
      <circle r={94} fill={h.strong} opacity={0.12} />
      <g transform={`rotate(${frame * 0.8})`}>
        {slices}
        <path d={`M${c1x} ${c1y} Q${c1x + ox * 0.6} ${c1y + oy * 0.2} ${c1x + ox} ${c1y + oy}`} stroke={h.line} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d={`M${c2x} ${c2y} Q${c2x + ox * 0.3} ${c2y + oy * 0.7} ${c2x + ox} ${c2y + oy}`} stroke={h.line} strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
};

const Spinner: React.FC<{ size?: number; frame: number; color: string }> = ({ size = 70, frame, color }) => {
  const n = 10;
  const head = Math.floor(frame * 0.5) % n;
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ display: "block" }}>
      {Array.from({ length: n }, (_, i) => {
        const [px, py] = polar(36, i * 36);
        const age = (head - i + n) % n;
        return <circle key={i} cx={px} cy={py} r={10 - age * 0.6} fill={color} opacity={1 - age / n} />;
      })}
    </svg>
  );
};

const PIZZA_W = 480;
const PIZZA_H = 520;

/**
 * Holographic mini app projected from the gauntlet ("¿esto sirve para pedir pizza?"): a cyan,
 * translucent card (scanlines, flicker, glow, a slight 3D tilt) projected by a light beam from
 * `beamFrom` (the gauntlet; default 400 px below the card centre). It materialises bottom-up
 * at `at`: title "PIZZA CÓSMICA", a slowly turning hologram pizza with one slice pulled out
 * and a "PEDIR PIZZA" button that is tapped at `pressAt` (default at + 30: squash, flash,
 * ripple). Then a loading spinner with "BUSCANDO REPARTIDOR…". With `noDriverAt` the spinner
 * turns into an X, the hologram glitches and tints red with "SIN REPARTIDORES / EN ESTE
 * UNIVERSO". At `out` it collapses into a line and blinks off. `x`, `y` = card centre;
 * 480 x 520 (x ± 240, y ± 260) plus the beam. Suggested: x 500, y 640 with the gauntlet
 * below it (e.g. beamFrom {x: 520, y: 1060}).
 */
export const PizzaApp: React.FC<{
  frame: number;
  at: number;
  out?: number;
  x: number;
  y: number;
  pressAt?: number;
  noDriverAt?: number;
  beamFrom?: { x: number; y: number };
  scale?: number;
}> = ({ frame, at, out, x, y, pressAt, noDriverAt, beamFrom, scale = 1 }) => {
  const uid = useUid();
  if (frame < at) return null;
  if (out !== undefined && frame > out + 11) return null;
  const t = frame - at;
  const press = pressAt ?? at + 30;
  const failed = noDriverAt !== undefined && frame >= noDriverAt;
  const failT = noDriverAt === undefined ? -1 : frame - noDriverAt;
  const h = failed && !(failT < 6 && failT % 2 === 1) ? HOLO_RED : HOLO_CYAN;
  const grow = ramp(frame, at + 2, at + 12, [0.02, 1], EASE_OUT);
  const widen = ramp(frame, at, at + 5, [0.3, 1], EASE_OUT);
  const c1 = out === undefined ? 0 : ramp(frame, out, out + 6, [0, 1], EASE_IN);
  const c2 = out === undefined ? 0 : ramp(frame, out + 6, out + 10, [0, 1], EASE_IN);
  const sy = grow * (1 - 0.98 * c1);
  const sxs = widen * (1 - c2);
  const g = Math.floor(frame / 2);
  const startFlicker = t < 12 ? (blink(frame, at, 2, 1) ? 1 : 0.45) : 1;
  const glitch = (failT >= 0 && failT < 8) || (t > 14 && rand(g * 2.71 + 0.5) < 0.06);
  const gx = glitch ? (rand(g * 6.1) - 0.5) * 22 : 0;
  const flick = (0.9 + 0.1 * rand(frame * 1.37)) * startFlicker;
  const btnIn = pop(frame, at + 12, { damping: 11, stiffness: 220 });
  const squash = bump(frame, press - 2, 8);
  const btnOut = ramp(frame, press + 5, press + 11, [0, 1], EASE_IN);
  const rip = frame >= press && frame < press + 16 ? (frame - press) / 16 : -1;
  const statusIn = pop(frame, press + 9, { damping: 11, stiffness: 220 });
  const failIn = noDriverAt === undefined ? 0 : pop(frame, noDriverAt, { damping: 8, stiffness: 240 });
  const dots = Math.floor((frame - press) / 6) % 4;
  const bx = ((beamFrom?.x ?? x) - x) / scale;
  const by = ((beamFrom?.y ?? y + 400) - y) / scale;
  const beamOp = (out === undefined ? 1 : 1 - ramp(frame, out, out + 8)) * ramp(frame, at, at + 4) * flick;
  const textGlow = { color: "#F2FFFF", textShadow: `0 0 12px ${h.glow}, 0 0 3px ${h.strong}` };
  const particles: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const life = 30;
    const age = ((t + rand(i * 3.3) * life) % life) / life;
    const u = rand(i * 7.1) - 0.5;
    const px = bx + (u * PIZZA_W * 0.8 - bx) * age;
    const py = by + (PIZZA_H / 2 - by) * age;
    particles.push(<circle key={i} cx={px} cy={py} r={2 + rand(i * 5.5) * 3} fill={h.line} opacity={Math.sin(age * Math.PI) * 0.8} />);
  }
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${scale})`, pointerEvents: "none" }}>
      <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: beamOp }}>
        <defs>
          <linearGradient id={`pzb${uid}`} gradientUnits="userSpaceOnUse" x1={bx} y1={by} x2={0} y2={PIZZA_H / 2}>
            <stop offset="0" stopColor={h.strong} stopOpacity={0.75} />
            <stop offset="1" stopColor={h.strong} stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <path d={`M${bx - 12} ${by} L${bx + 12} ${by} L${(PIZZA_W / 2 - 24) * sxs} ${PIZZA_H / 2} L${(-PIZZA_W / 2 + 24) * sxs} ${PIZZA_H / 2} Z`} fill={`url(#pzb${uid})`} />
        {[-0.7, -0.25, 0.2, 0.62].map((u, i) => (
          <line key={i} x1={bx} y1={by} x2={u * (PIZZA_W / 2 - 24) * sxs} y2={PIZZA_H / 2} stroke={h.line} strokeWidth={2} opacity={0.2 + 0.35 * rand(frame * 0.7 + i * 3.1)} />
        ))}
        {particles}
        <ellipse cx={bx} cy={by} rx={26} ry={10} fill={h.line} opacity={0.9} />
        <ellipse cx={bx} cy={by} rx={46} ry={18} fill={h.strong} opacity={0.35} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: -PIZZA_W / 2 + gx,
          top: -PIZZA_H / 2,
          width: PIZZA_W,
          height: PIZZA_H,
          transform: `perspective(1400px) rotateX(9deg) scale(${sxs}, ${sy})`,
          transformOrigin: "50% 100%",
          opacity: flick * (1 - c2),
          filter: glitch ? "drop-shadow(-5px 0 0 rgba(255,0,90,0.7)) drop-shadow(5px 0 0 rgba(0,225,255,0.7))" : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 34,
            background: `linear-gradient(180deg, ${h.dark} 0%, rgba(0,0,0,0.25) 100%)`,
            border: `4px solid ${h.line}`,
            boxShadow: `0 0 0 3px rgba(0,0,0,0.25), 0 0 40px ${h.glow}, inset 0 0 46px ${h.glow}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "repeating-linear-gradient(180deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 2px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 7px)",
              backgroundPosition: `0 ${t * 1.5}px`,
            }}
          />
          {glitch ? <div style={{ position: "absolute", left: 0, right: 0, top: `${rand(g * 1.9) * 90}%`, height: 8, background: h.line, opacity: 0.5 }} /> : null}
          <div style={{ position: "absolute", left: 0, right: 0, top: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <svg width={34} height={34} viewBox="0 0 100 100" style={{ display: "block" }}>
              <path d="M50 8 L92 86 L8 86 Z" fill={h.fill} stroke={h.line} strokeWidth={8} strokeLinejoin="round" />
              <circle cx={42} cy={58} r={9} fill={h.strong} />
              <circle cx={60} cy={70} r={7} fill={h.strong} />
              <circle cx={52} cy={38} r={6} fill={h.strong} />
            </svg>
            <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 34, letterSpacing: 3, ...textGlow }}>PIZZA CÓSMICA</span>
          </div>
          <div style={{ position: "absolute", left: 40, right: 40, top: 76, height: 3, background: h.line, opacity: 0.45 }} />
          <div style={{ position: "absolute", left: PIZZA_W / 2 - 104, top: 92, transform: `scale(${pop(frame, at + 8, { damping: 12, stiffness: 180 })})` }}>
            <HoloPizza size={208} frame={frame} h={h} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 318, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {btnOut < 1 ? (
              <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
                {rip >= 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: -170,
                      top: -48,
                      width: 340,
                      height: 96,
                      borderRadius: 999,
                      border: `${8 * (1 - rip)}px solid ${h.line}`,
                      transform: `scale(${1 + rip * 0.5})`,
                      opacity: 1 - rip,
                    }}
                  />
                ) : null}
                <div
                  style={{
                    position: "absolute",
                    left: -170,
                    top: -48,
                    width: 340,
                    height: 96,
                    borderRadius: 999,
                    background: `linear-gradient(180deg, ${h.btn[0]} 0%, ${h.btn[1]} 100%)`,
                    boxShadow: `0 0 0 3px ${h.line}, 0 0 30px ${h.glow}, inset 0 -7px 0 rgba(0,0,0,0.16)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${btnIn * (1 - 0.1 * squash) * (1 - btnOut)})`,
                    opacity: 1 - btnOut,
                    fontFamily: FONT.heavy,
                    fontWeight: 900,
                    fontSize: 38,
                    letterSpacing: 1.5,
                    color: "#03314A",
                    whiteSpace: "nowrap",
                  }}
                >
                  PEDIR PIZZA
                  {squash > 0 ? <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "#FFFFFF", opacity: squash * 0.6 }} /> : null}
                </div>
                {frame >= press - 4 && frame < press + 8 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 40,
                      top: 6,
                      width: 46,
                      height: 46,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.85)",
                      boxShadow: "0 0 18px rgba(255,255,255,0.9)",
                      transform: `translate(-50%, -50%) scale(${1 - 0.4 * ramp(frame, press - 4, press + 8)})`,
                      opacity: 1 - ramp(frame, press + 2, press + 8),
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            {frame >= press + 9 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transform: `scale(${statusIn})` }}>
                {failed ? (
                  <svg width={72} height={72} viewBox="-50 -50 100 100" style={{ display: "block", transform: `scale(${failIn})` }}>
                    <circle r={40} fill={h.fill} stroke={h.line} strokeWidth={6} />
                    <path d="M-18 -18 L18 18 M18 -18 L-18 18" stroke={h.line} strokeWidth={10} strokeLinecap="round" />
                  </svg>
                ) : (
                  <Spinner size={72} frame={frame} color={h.line} />
                )}
                {failed ? (
                  <div style={{ textAlign: "center", fontFamily: FONT.heavy, fontWeight: 900, fontSize: 30, lineHeight: 1.15, letterSpacing: 1, ...textGlow }}>
                    SIN REPARTIDORES
                    <br />
                    EN ESTE UNIVERSO
                  </div>
                ) : (
                  <div style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 28, letterSpacing: 1, whiteSpace: "nowrap", ...textGlow }}>
                    BUSCANDO REPARTIDOR
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{ opacity: dots > i ? 1 : 0.2 }}>
                        .
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// PostCreditsCard

/**
 * Full-screen black card: "ESCENA POSCRÉDITOS…" typed letter by letter (one every 2 frames from
 * at + 10; first word on line 1, the rest on line 2) with a mint block cursor that blinks
 * once it is done, over flickering film grain, dust, the odd vertical scratch and a vignette.
 * Black fades in over 3 frames from `at`; at `out` everything fades away in 8 frames (cut to
 * the next shot under it). `y` = text centre (720).
 */
export const PostCreditsCard: React.FC<{ frame: number; at: number; out: number; text?: string; y?: number; perChar?: number }> = ({
  frame,
  at,
  out,
  text = "ESCENA POSCRÉDITOS…",
  y = 720,
  perChar = 2,
}) => {
  if (frame < at || frame > out + 8) return null;
  const op = ramp(frame, at, at + 3) * (1 - ramp(frame, out, out + 8, [0, 1], EASE_IN));
  const words = text.split(" ");
  const lines = [words[0], words.slice(1).join(" ")].filter((l) => l.length > 0);
  const total = lines.reduce((s, l) => s + Array.from(l).length, 0);
  const typeFrom = at + 10;
  const typed = frame < typeFrom ? 0 : Math.min(total, Math.floor((frame - typeFrom) / perChar) + 1);
  const doneAt = typeFrom + (total - 1) * perChar;
  const cursorOn = frame < doneAt + 4 ? 1 : blink(frame, doneAt + 4, 9, 8);
  const flicker = 0.9 + 0.1 * rand(frame * 2.31);
  const specks: React.ReactNode[] = [];
  for (let i = 0; i < 170; i++) {
    const s = frame * 13.37 + i * 7.13;
    const sz = 1.5 + rand(s + 3.1) * 3;
    specks.push(<rect key={i} x={rand(s) * 1080} y={rand(s + 1.7) * 1920} width={sz} height={sz} fill={rand(s + 5.9) < 0.6 ? "#FFFFFF" : "#9A9A9A"} opacity={0.06 + rand(s + 6.7) * 0.2} />);
  }
  const dust: React.ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const s = Math.floor(frame / 3) * 3.7 + i * 17.3;
    if (rand(s) < 0.45) dust.push(<ellipse key={i} cx={rand(s + 1) * 1080} cy={rand(s + 2) * 1920} rx={3 + rand(s + 3) * 7} ry={2 + rand(s + 4) * 4} fill="#DDDDDD" opacity={0.25} />);
  }
  const sc = Math.floor(frame / 4) * 5.13;
  const scratch = rand(sc) < 0.4 ? <rect x={80 + rand(sc + 1) * 920} y={0} width={2} height={1920} fill="#FFFFFF" opacity={0.12 + rand(sc + 2) * 0.12} /> : null;
  let idx = 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: op }}>
      <AbsoluteFill style={{ background: "#050505" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(60,60,60,0.25) 0%, rgba(0,0,0,0) 70%)", opacity: flicker }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y,
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          opacity: flicker,
        }}
      >
        <div style={{ width: 120, height: 4, borderRadius: 2, background: "#8EDCA2", opacity: 0.9 * ramp(frame, at + 4, at + 12) }} />
        {lines.map((ln, li) => (
          <div
            key={li}
            style={{
              fontFamily: FONT.heavy,
              fontWeight: 900,
              fontSize: li === 0 ? 70 : 84,
              letterSpacing: li === 0 ? 14 : 6,
              lineHeight: 1.1,
              color: "#F4F1E8",
              textShadow: "0 0 18px rgba(255,255,255,0.25)",
              whiteSpace: "nowrap",
            }}
          >
            {Array.from(ln).map((ch, ci) => {
              const my = idx++;
              const shown = my < typed;
              const isLast = my === typed - 1;
              return (
                <span key={ci} style={{ position: "relative", opacity: shown ? 1 : 0 }}>
                  {ch}
                  {isLast && cursorOn ? (
                    <span
                      style={{
                        position: "absolute",
                        left: "100%",
                        top: "12%",
                        marginLeft: 8,
                        width: "0.5em",
                        height: "0.78em",
                        background: "#8EDCA2",
                        boxShadow: "0 0 14px rgba(142,220,162,0.8)",
                      }}
                    />
                  ) : null}
                </span>
              );
            })}
          </div>
        ))}
        <div style={{ width: 120, height: 4, borderRadius: 2, background: "#8EDCA2", opacity: 0.9 * ramp(frame, at + 4, at + 12) }} />
      </div>
      {typed === 0 && blink(frame, at, 8, 7) ? (
        <div style={{ position: "absolute", left: 540 - 22, top: y - 30, width: 42, height: 66, background: "#8EDCA2", opacity: 0.9 }} />
      ) : null}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {specks}
        {dust}
        {scratch}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 60% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)" }} />
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: 0.025 * rand(frame * 3.7) }} />
    </AbsoluteFill>
  );
};

// =============================================================================================
// FinalQuestion

const FQ_TITLE: { parts: { text: string; colors: string[] }[]; y: number }[] = [
  {
    parts: [
      { text: "¿NUBI", colors: TXT_MINT },
      { text: "DEBERÍA", colors: TXT_WHITE },
    ],
    y: 330,
  },
  { parts: [{ text: "ENFRENTAR A", colors: TXT_WHITE }], y: 446 },
  { parts: [{ text: "DOCTOR DOOM?", colors: TXT_GOLD }], y: 562 },
];

/** Answer bubble ("SÍ" / "NO") with a white tail pointing down. */
const AnswerBubble: React.FC<{ text: string; bg: string; tail: "left" | "right" }> = ({ text, bg, tail }) => {
  const tailSvg = (pass: "outline" | "fill") => (
    <svg
      width={70}
      height={80}
      viewBox="0 0 70 80"
      style={{ position: "absolute", [tail === "left" ? "left" : "right"]: 46, bottom: -58, overflow: "visible", transform: tail === "right" ? "scaleX(-1)" : undefined }}
    >
      <path d="M6 4 C14 30 12 52 2 74 C26 58 46 34 60 4 Z" fill="#FFFFFF" stroke={pass === "outline" ? INK : "none"} strokeWidth={pass === "outline" ? 13 : 0} strokeLinejoin="round" />
    </svg>
  );
  return (
    <div style={{ position: "relative", width: 250, height: 164 }}>
      {tailSvg("outline")}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 70,
          background: bg,
          border: "8px solid #FFFFFF",
          boxShadow: `0 0 0 5px ${INK}, 0 12px 0 5px rgba(0,0,0,0.3)`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ paddingTop: 22 }}>
          <HeavyText text={text} size={104} colors={TXT_WHITE} />
        </div>
      </div>
      {tailSvg("fill")}
    </div>
  );
};

/**
 * Closing card on black (full frame): "¿NUBI DEBERÍA / ENFRENTAR A / DOCTOR DOOM?" in big
 * heavy letters (NUBI mint green, DOCTOR DOOM gold with a gold underline swoosh) over soft
 * green/gold glows and rising sparkles; then two answer bubbles "SÍ" (green) and "NO" (red)
 * pop in and bob, and a green comment button is tapped by a hand (ripples) while the count
 * next to it ticks up to `countTo` with "COMENTA" under it. Black fades in over 5 frames from
 * `at`; with `out` it fades out over 10. Layout (fixed, inside the safe area): title y
 * 270-620, bubbles at y ≈ 790, button and count at y ≈ 1010.
 */
export const FinalQuestion: React.FC<{ frame: number; at: number; out?: number; countTo?: number }> = ({ frame, at, out, countTo = 12480 }) => {
  if (frame < at) return null;
  if (out !== undefined && frame > out + 10) return null;
  const t = frame - at;
  const bgK = ramp(frame, at, at + 5);
  const k = leave(frame, out, 10);
  const sparks: React.ReactNode[] = [];
  for (let i = 0; i < 40; i++) {
    const sp = 1.2 + rand(i * 3.3) * 2.2;
    const yy = 1920 - ((rand(i * 1.7) * 1920 + t * sp) % 1920);
    const xx = rand(i * 5.1) * 1080 + Math.sin(t * 0.04 + i) * 14;
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.25 + i * 1.3));
    sparks.push(<circle key={i} cx={xx} cy={yy} r={1.5 + rand(i * 2.9) * 3.5} fill={i % 3 ? "#FFD95C" : "#8EDCA2"} opacity={tw * 0.7} />);
  }
  const taps = [at + 56, at + 82, at + 108, at + 134, at + 160, at + 186];
  let squish = 0;
  let handPush = 0;
  let rip = -1;
  let lastTap = -1;
  for (const tp of taps) {
    squish = Math.max(squish, bump(frame, tp - 1, 8));
    handPush = Math.max(handPush, bump(frame, tp - 4, 10));
    if (frame >= tp && frame < tp + 18) rip = (frame - tp) / 18;
    if (frame >= tp) lastTap = tp;
  }
  const btnIn = pop(frame, at + 38, { damping: 10, stiffness: 190 });
  const handIn = pop(frame, at + 46, { damping: 13, stiffness: 150 });
  const count = Math.round(countTo * ramp(frame, at + 42, at + 110, [0, 1], EASE_OUT));
  const countBump = lastTap >= 0 ? bump(frame, lastTap, 8) : 0;
  const countIn = pop(frame, at + 42, { damping: 11, stiffness: 200 });
  const swoosh = ramp(frame, at + 20, at + 32, [0, 1], EASE_IN_OUT);
  const R = 96;
  const BTN = { x: 380, y: 1010 };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - k }}>
      <AbsoluteFill style={{ background: "#000", opacity: bgK }} />
      <AbsoluteFill
        style={{
          opacity: bgK,
          background:
            "radial-gradient(ellipse 70% 30% at 50% 24%, rgba(46,170,90,0.32) 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 70% 28% at 50% 52%, rgba(255,190,60,0.16) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: bgK }}>
        {sparks}
      </svg>
      {FQ_TITLE.map((line, i) => {
        const p = pop(frame, at + 4 + i * 5, { damping: 10, stiffness: 180 });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 500,
              top: line.y,
              display: "flex",
              gap: 26,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(i % 2 ? 2 : -2) * (0.6 + 0.4 * (1 - p)) + Math.sin(t * 0.08 + i) * 0.7}deg)`,
              opacity: Math.min(1, p * 3),
            }}
          >
            {line.parts.map((pt) => (
              <HeavyText key={pt.text} text={pt.text} size={100} colors={pt.colors} />
            ))}
          </div>
        );
      })}
      {swoosh > 0 ? (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d="M210 632 C380 612 600 612 790 628" stroke={INK} strokeWidth={22} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - swoosh)} />
          <path d="M210 632 C380 612 600 612 790 628" stroke="#FFC83D" strokeWidth={11} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - swoosh)} />
        </svg>
      ) : null}
      {[
        { text: "SÍ", bg: "linear-gradient(160deg, #8CFF7A 0%, #22C55E 55%, #128A3E 100%)", x: 300, at: at + 24, tail: "left" as const },
        { text: "NO", bg: "linear-gradient(160deg, #FF9A8A 0%, #FF3B30 55%, #B0001A 100%)", x: 700, at: at + 30, tail: "right" as const },
      ].map((b, i) => {
        const p = pop(frame, b.at, { damping: 9, stiffness: 200 });
        if (p < 0.001) return null;
        const bob = Math.sin((frame - b.at) * 0.1 + i * 2) * 8;
        return (
          <div
            key={b.text}
            style={{
              position: "absolute",
              left: b.x,
              top: 780 + bob,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(i ? 5 : -5) * (0.7 + 0.3 * (1 - p)) + Math.sin(t * 0.07 + i) * 2}deg)`,
            }}
          >
            <AnswerBubble text={b.text} bg={b.bg} tail={b.tail} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: BTN.x, top: BTN.y, width: 0, height: 0 }}>
        {rip >= 0 ? (
          <div
            style={{
              position: "absolute",
              left: -R,
              top: -R,
              width: 2 * R,
              height: 2 * R,
              borderRadius: "50%",
              border: `${13 * (1 - rip)}px solid #FFFFFF`,
              boxSizing: "border-box",
              transform: `scale(${1 + rip * 0.9})`,
              opacity: 1 - rip,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            left: -R,
            top: -R,
            width: 2 * R,
            height: 2 * R,
            borderRadius: "50%",
            background: "linear-gradient(145deg, #B6F26B 0%, #43C463 55%, #139A5B 100%)",
            border: "11px solid #FFFFFF",
            boxSizing: "border-box",
            boxShadow: `0 0 0 5px ${INK}, 0 13px 0 5px rgba(0,0,0,0.3), 0 0 50px rgba(120,255,140,0.35)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${btnIn * (1 - 0.12 * squish)}) rotate(${(1 - btnIn) * -30}deg)`,
          }}
        >
          <CommentBubbleIcon size={122} dot="#139A5B" frame={frame} style={{ marginTop: 6 }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 24,
            transformOrigin: "0 0",
            transform: `translate(${(1 - handIn) * 380 - handPush * 22}px, ${(1 - handIn) * 170 - handPush * 10}px) rotate(-66deg) scale(${1 - 0.06 * handPush})`,
            opacity: Math.min(1, handIn * 2),
          }}
        >
          <HandPointer size={160} style={{ marginLeft: -64, marginTop: -6 }} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 660,
          top: 1004,
          transform: `translate(-50%, -50%) scale(${countIn * (1 + 0.16 * countBump)})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <HeavyText text={fmtNumber(count)} size={84} colors={TXT_MINT} />
        <div style={{ ...strokeText(40, "#FFFFFF", 9, 3), marginTop: 12 }}>COMENTA</div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// HeroLabel

/** Small icon for HeroLabel. */
const LabelIcon: React.FC<{ kind: "bolt" | "star" }> = ({ kind }) => (
  <svg width={44} height={44} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible" }}>
    <Outlined w={10}>
      {kind === "bolt" ? (
        <path d="M60 4 L20 56 L46 56 L36 96 L82 38 L55 38 L66 4 Z" fill="#FFE14D" />
      ) : (
        <path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z" fill="#FFE14D" />
      )}
    </Outlined>
  </svg>
);

/**
 * Name tag that pops next to a character ("MODO TRUENO"): a pill in `color` (gradient) with a
 * white border, heavy white lettering, an optional little bolt/star icon and a tail on `side`
 * pointing at the character (put the tag on the opposite side of it). Pops with a twist and
 * two sparkles at `at`, wobbles gently, shrinks away at `out`. `x`, `y` = pill centre; ~380 x
 * 90 for a 12-letter text at size 46 (the tail adds ~40 px on its side).
 */
export const HeroLabel: React.FC<{
  frame: number;
  at: number;
  out: number;
  text: string;
  x: number;
  y: number;
  color?: string;
  side?: "left" | "right" | "top" | "bottom" | "none";
  icon?: "bolt" | "star" | "none";
  size?: number;
  scale?: number;
  rotate?: number;
}> = ({ frame, at, out, text, x, y, color = "#2F8CFF", side = "bottom", icon = "none", size = 46, scale = 1, rotate = -3 }) => {
  if (frame < at || frame > out + 9) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 9, stiffness: 230 });
  const k = leave(frame, out);
  const spark = bump(frame, at + 2, 14);
  const origin = side === "left" ? "0% 50%" : side === "right" ? "100% 50%" : side === "top" ? "50% 0%" : "50% 100%";
  const tail = (pass: "outline" | "fill") => {
    if (side === "none") return null;
    const common = { fill: "#FFFFFF", stroke: pass === "outline" ? INK : "none", strokeWidth: pass === "outline" ? 12 : 0, strokeLinejoin: "round" as const };
    const rot = side === "bottom" ? 0 : side === "top" ? 180 : side === "left" ? 90 : -90;
    const pos: React.CSSProperties =
      side === "bottom"
        ? { left: "50%", top: "100%", marginLeft: -24, marginTop: -10 }
        : side === "top"
          ? { left: "50%", bottom: "100%", marginLeft: -24, marginBottom: -10 }
          : side === "left"
            ? { right: "100%", top: "50%", marginTop: -22, marginRight: -12 }
            : { left: "100%", top: "50%", marginTop: -22, marginLeft: -12 };
    return (
      <svg width={48} height={44} viewBox="0 0 48 44" style={{ position: "absolute", ...pos, overflow: "visible", transform: `rotate(${rot}deg)` }}>
        <path d="M4 2 L44 2 L24 40 Z" {...common} />
      </svg>
    );
  };
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "max-content",
          transform: `translate(-50%, -50%) scale(${p * (1 - k) * scale}) rotate(${rotate + (1 - p) * -16 + Math.sin(t * 0.09) * 1.2}deg)`,
          transformOrigin: origin,
          opacity: Math.min(1, p * 3),
        }}
      >
        {tail("outline")}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: `6px ${icon === "none" ? 26 : 24}px 2px ${icon === "none" ? 26 : 16}px`,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${mix(color, "#FFFFFF", 0.35)} 0%, ${color} 55%, ${mix(color, "#000000", 0.25)} 100%)`,
            border: "6px solid #FFFFFF",
            boxShadow: `0 0 0 4px ${INK}, 0 8px 0 4px rgba(0,0,0,0.3)`,
            whiteSpace: "nowrap",
          }}
        >
          {icon !== "none" ? (
            <div style={{ marginTop: -4 }}>
              <LabelIcon kind={icon} />
            </div>
          ) : null}
          <div style={{ paddingTop: size * 0.22 }}>
            <HeavyText text={text} size={size} colors={TXT_WHITE} />
          </div>
        </div>
        {tail("fill")}
        {spark > 0.02 ? (
          <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <path d={sparkle(-14, -10, 22 * spark)} fill="#FFF3B0" stroke={INK} strokeWidth={3} />
            <path d={sparkle(28, 74, 14 * spark)} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
          </svg>
        ) : null}
      </div>
    </div>
  );
};
