import React from "react";
import { AbsoluteFill, interpolateColors } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, rand } from "../../anim";
import { FONT } from "../../theme";
import { HeavyText } from "../inca/HeavyText";

// 2D overlays for "¿Y si dormir te pagara?" (1080 x 1920, 30 fps). A bright, toy-like comedy look:
// thick night-ink outlines, white-bordered cards with hard drop shadows, Luckiest Guy (HeavyText)
// for the big punchy words and Montserrat 900 for the UI, in two themed colours: money green (plus
// gold S/ coins) and sleepy violet / blue. Everything is driven by the global `frame` plus explicit
// cue frames: no timers, no Math.random (`rand`), no CSS animations. Emoji in any text (💤 💸 ❌ ✅
// 🔇 👇) are drawn as inline SVG icons (RichText), so they never depend on an emoji font in the
// headless renderer. TikTok safe zone: content inside x 60-940, y 230-1180 (top bar above y 200,
// the button column right of x 940 from y 700, captions at y 1210-1400). Every timed component
// enters at `at` and is gone ~10 frames after `out`. Amounts are Peruvian soles: "S/ 1 280" (a
// space between thousands).

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

/** The short's palette. */
export const DORMIR_COLORS = {
  ink: "#1A1233",
  night: "#241A5E",
  violet: "#6E4BFF",
  lavender: "#B9A8FF",
  green: "#22D36B",
  greenDark: "#0E9F4A",
  gold: "#FFC83D",
  goldDark: "#E08A00",
  red: "#FF3B4E",
  yellow: "#FFD84D",
  grey: "#AEB6C4",
  cream: "#FFF8E8",
  sky: "#8EC9FF",
} as const;
const K = DORMIR_COLORS;
const UI = FONT.heavy;
const TAB: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };
const SHADOW = `0 0 0 5px ${K.ink}, 0 12px 0 5px rgba(0,0,0,0.3), 0 24px 46px rgba(0,0,0,0.28)`;
const SHADOW_SM = `0 0 0 4px ${K.ink}, 0 7px 0 4px rgba(0,0,0,0.28)`;
const TXT_WHITE = ["#FFFFFF", "#FFFFFF", "#E6E3F5"];
const TXT_GOLD = ["#FFFBD1", "#FFD21F", "#FF9500"];
const TXT_GREEN = ["#F0FFF4", "#8DF7A8", "#14B85A"];
const TXT_RED = ["#FFE3E3", "#FF6B6B", "#D0001A"];
const TXT_DREAM = ["#F6F3FF", "#C9BBFF", "#8E6BFF"];

// =============================================================================================
// Helpers

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
const bump = (frame: number, at: number, dur: number) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

/** Square-wave blink: 1 for `on` frames, 0 for `off` frames, starting at `from`. */
const blink = (frame: number, from: number, on = 4, off = 3) => {
  const n = on + off;
  return (((frame - from) % n) + n) % n < on ? 1 : 0;
};

/** Exit progress 0 -> 1 over `dur` frames from `out`. */
const leave = (frame: number, out: number, dur = 9) => ramp(frame, out, out + dur, [0, 1], EASE_IN);

/** Damped shake offset after an impact at `at` (pixels / degrees). */
const impact = (frame: number, at: number, amp: number, dur = 10) => {
  const d = frame - at;
  if (d < 0 || d > dur) return { x: 0, y: 0, r: 0 };
  const k = amp * Math.pow(1 - d / dur, 2);
  return { x: Math.sin(d * 2.9 + at) * k, y: Math.cos(d * 3.7 + at * 0.7) * k * 0.7, r: Math.sin(d * 2.3 + at) * k * 0.08 };
};

/** Stepped noise in [-1, 1]: a new value every `hold` frames. */
const jit = (frame: number, seed: number, hold = 2) => {
  const n = Math.floor(frame / hold) * 12.9898 + seed * 78.233;
  const x = Math.sin(n) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/** Damped pendulum angle (degrees) for a sign that swings in at `at`. */
const swing = (frame: number, at: number, amp: number, period = 16, decay = 10) => {
  const d = Math.max(0, frame - at);
  return amp * Math.exp(-d / decay) * Math.cos((d / period) * Math.PI * 2);
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** "#RRGGBB" + alpha -> "rgba(...)". */
const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/** 1280 -> "1 280" (soles, a space between thousands, never negative). */
export const fmtSoles = (n: number) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Silhouette drawn as a thick outline first, then filled on top. */
const Outlined: React.FC<{ w?: number; color?: string; children: React.ReactNode }> = ({ w = 7, color = K.ink, children }) => (
  <>
    <g stroke={color} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
    <g>{children}</g>
  </>
);

// =============================================================================================
// Icons (inline SVG: there is no emoji font in the headless renderer)

type IconProps = { size?: number; style?: React.CSSProperties };
const svgStyle = (style?: React.CSSProperties): React.CSSProperties => ({ display: "block", overflow: "visible", ...style });

/**
 * A gold sol coin with «S/» embossed (100 x 100 box). `spin` (radians) squashes it like a coin
 * turning on itself (the back has no letters); `grey` is the dead counter's coin.
 */
export const CoinIcon: React.FC<IconProps & { spin?: number; grey?: boolean }> = ({ size = 100, spin = 0, grey = false, style }) => {
  const c = Math.cos(spin);
  const sx = Math.max(0.1, Math.abs(c));
  const pal = grey
    ? { deep: "#7D8696", rim: "#CBD1DB", face: "#B5BCC9", text: "#7D8696", hi: "#FFFFFF" }
    : { deep: "#C97800", rim: "#FFD54A", face: "#FFC21F", text: "#B86A00", hi: "#FFF7C9" };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
      <g transform={`translate(50 50) scale(${sx} 1) translate(-50 -50)`}>
        <circle cx={50} cy={51} r={45} fill={pal.deep} stroke={K.ink} strokeWidth={5} />
        <circle cx={50} cy={47.5} r={41} fill={pal.rim} />
        <circle cx={50} cy={47.5} r={31} fill={pal.face} stroke={pal.deep} strokeWidth={3.5} />
        {c > 0 ? (
          <text x={50} y={60} textAnchor="middle" fontFamily={UI} fontWeight={900} fontSize={34} fill={pal.text}>
            S/
          </text>
        ) : (
          <circle cx={50} cy={47.5} r={12} fill="none" stroke={pal.deep} strokeWidth={4} />
        )}
        <path d="M22 36 A31 31 0 0 1 42 16" stroke={pal.hi} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.85} />
      </g>
    </svg>
  );
};

/** 💤: three Zs, big to small, rising to the right (100 x 100). `frame` makes them bob. */
export const ZzzIcon: React.FC<IconProps & { frame?: number; color?: string }> = ({ size = 100, frame, color = K.sky, style }) => {
  const zs = [
    { x: 6, y: 50, s: 40 },
    { x: 52, y: 27, s: 27 },
    { x: 80, y: 6, s: 18 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
      {zs.map((z, i) => {
        const dy = frame === undefined ? 0 : Math.sin(frame * 0.14 - i * 1.1) * 3.5;
        const d = `M${z.x} ${z.y + dy} H${z.x + z.s} L${z.x} ${z.y + dy + z.s} H${z.x + z.s}`;
        const w = 5 + z.s * 0.2;
        return (
          <g key={i}>
            <path d={d} stroke={K.ink} strokeWidth={w + 7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d={d} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d={`M${z.x + 2} ${z.y + dy} H${z.x + z.s * 0.55}`} stroke="#FFFFFF" strokeWidth={w * 0.35} strokeLinecap="round" opacity={0.7} />
          </g>
        );
      })}
    </svg>
  );
};

const WING = "M0 0 C-3 -12 -14 -24 -32 -28 C-28 -22 -31 -17 -28 -13 C-34 -12 -35 -6 -30 -3 C-34 0 -32 5 -26 5 C-17 7 -8 5 0 0 Z";

/** 💸: a green S/ banknote with two white wings (100 x 100); `frame` flaps the wings. */
export const MoneyWingsIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const flap = Math.sin(frame * 0.55) * 18;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
      <g transform="rotate(-12 50 58)">
        <g transform={`translate(26 46) rotate(${flap})`}>
          <Outlined w={6}>
            <path d={WING} fill="#FFFFFF" />
          </Outlined>
          <path d="M-6 -2 C-12 -6 -18 -10 -22 -18" stroke="#C9D3E6" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </g>
        <g transform={`translate(74 46) scale(-1 1) rotate(${flap})`}>
          <Outlined w={6}>
            <path d={WING} fill="#FFFFFF" />
          </Outlined>
          <path d="M-6 -2 C-12 -6 -18 -10 -22 -18" stroke="#C9D3E6" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </g>
        <rect x={16} y={40} width={68} height={38} rx={6} fill="#6EDB8F" stroke={K.ink} strokeWidth={5} />
        <rect x={22} y={46} width={56} height={26} rx={4} fill="none" stroke="#2F9E57" strokeWidth={2.5} />
        <circle cx={50} cy={59} r={10.5} fill="#C8F7D4" stroke="#2F9E57" strokeWidth={2.5} />
        <text x={50} y={63.5} textAnchor="middle" fontFamily={UI} fontWeight={900} fontSize={12} fill="#1F7A3E">
          S/
        </text>
        <circle cx={29} cy={59} r={3} fill="#2F9E57" />
        <circle cx={71} cy={59} r={3} fill="#2F9E57" />
      </g>
    </svg>
  );
};

/** ❌: a thick red cross (100 x 100). */
export const CrossIcon: React.FC<IconProps & { color?: string }> = ({ size = 100, color = K.red, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
    <path d="M22 22 L78 78 M78 22 L22 78" stroke={K.ink} strokeWidth={31} strokeLinecap="round" />
    <path d="M22 22 L78 78 M78 22 L22 78" stroke={color} strokeWidth={19} strokeLinecap="round" />
    <path d="M23 29 L33 39" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.65} />
  </svg>
);

/** ✅: a white tick on a green rounded square (100 x 100). */
export const CheckIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
    <rect x={7} y={7} width={86} height={86} rx={22} fill="#22C55E" stroke={K.ink} strokeWidth={6} />
    <rect x={15} y={13} width={70} height={22} rx={11} fill="#FFFFFF" opacity={0.22} />
    <path d="M27 52 L44 68 L74 33" stroke="#FFFFFF" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** 🔇: a speaker crossed by a red slash (100 x 100). */
export const MuteIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
    <path d="M12 38 H32 L58 16 V84 L32 62 H12 Z" fill="#E9ECF6" stroke={K.ink} strokeWidth={6} strokeLinejoin="round" />
    <path d="M17 44 H30" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
    <path d="M70 36 Q80 50 70 64" stroke="#B7BED0" strokeWidth={6} strokeLinecap="round" fill="none" />
    <path d="M12 14 L88 86" stroke={K.ink} strokeWidth={17} strokeLinecap="round" />
    <path d="M12 14 L88 86" stroke={K.red} strokeWidth={9} strokeLinecap="round" />
  </svg>
);

/** 👇: a yellow hand pointing down (100 x 124 at size 124). */
export const PointDownIcon: React.FC<IconProps> = ({ size = 124, style }) => (
  <svg width={size * (100 / 124)} height={size} viewBox="0 0 100 124" style={svgStyle(style)}>
    <g transform="translate(0 124) scale(1 -1)">
      <Outlined w={7}>
        <rect x={38} y={4} width={20} height={64} rx={10} fill="#FFCB3D" />
        <rect x={26} y={46} width={56} height={58} rx={20} fill="#FFCB3D" />
        <ellipse cx={25} cy={70} rx={10} ry={16} transform="rotate(-24 25 70)" fill="#FFCB3D" />
        <rect x={55} y={42} width={17} height={30} rx={8.5} fill="#FFCB3D" />
        <rect x={67} y={50} width={15} height={28} rx={7.5} fill="#FFCB3D" />
      </Outlined>
      <rect x={42} y={9} width={11} height={11} rx={4} fill="#FFF1BF" />
      <path d="M57 60 Q63 63 69 60 M70 68 Q75 70 80 68" stroke="#D9921A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  </svg>
);

/** A sleepy crescent moon with a closed eye (100 x 100). */
export const MoonIcon: React.FC<IconProps> = ({ size = 100, style }) => {
  const uid = useUid();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
      <defs>
        <mask id={`mm${uid}`}>
          <rect x={-10} y={-10} width={120} height={120} fill="#FFFFFF" />
          <circle cx={70} cy={34} r={33} fill="#000000" />
        </mask>
        <clipPath id={`mc${uid}`}>
          <circle cx={46} cy={54} r={40} />
        </clipPath>
      </defs>
      <g mask={`url(#mm${uid})`}>
        <circle cx={46} cy={54} r={40} fill="#FFE27A" stroke={K.ink} strokeWidth={5} />
      </g>
      <circle cx={70} cy={34} r={33} fill="none" stroke={K.ink} strokeWidth={5} clipPath={`url(#mc${uid})`} />
      <path d="M22 56 Q28 62 34 56" stroke={K.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
      <circle cx={24} cy={68} r={5} fill="#FFAE8F" opacity={0.75} />
      <path d="M18 34 Q20 24 30 20" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
    </svg>
  );
};

/** A smiling sun (100 x 100); `frame` turns the rays. */
export const SunIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
    <g transform={`rotate(${frame * 1.5} 50 50)`}>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <path
            key={i}
            d={`M${50 + Math.cos(a) * 34} ${50 + Math.sin(a) * 34} L${50 + Math.cos(a) * 47} ${50 + Math.sin(a) * 47}`}
            stroke="#FFB703"
            strokeWidth={8}
            strokeLinecap="round"
          />
        );
      })}
    </g>
    <circle cx={50} cy={50} r={27} fill="#FFD23F" stroke={K.ink} strokeWidth={5} />
    <circle cx={41} cy={47} r={3.6} fill={K.ink} />
    <circle cx={59} cy={47} r={3.6} fill={K.ink} />
    <path d="M40 57 Q50 66 60 57" stroke={K.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
    <ellipse cx={39} cy={36} rx={7} ry={4} transform="rotate(-35 39 36)" fill="#FFFFFF" opacity={0.6} />
  </svg>
);

/** A crusty bread roll (pan francés, 100 x 100). */
export const BreadIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
    <path d="M8 62 C8 38 28 22 50 22 C72 22 92 38 92 62 C92 76 80 82 50 82 C20 82 8 76 8 62 Z" fill="#E59A3F" stroke={K.ink} strokeWidth={5} />
    <path d="M14 66 C30 75 70 75 86 66 C86 74 76 78 50 78 C24 78 14 74 14 66 Z" fill="#B96A1C" opacity={0.75} />
    <path d="M30 46 C40 36 60 34 72 40" stroke="#FFE2A8" strokeWidth={7} strokeLinecap="round" fill="none" />
    <path d="M30 46 C40 36 60 34 72 40" stroke="#C97A22" strokeWidth={2.5} strokeLinecap="round" fill="none" />
    <ellipse cx={30} cy={35} rx={8} ry={4.5} transform="rotate(-30 30 35)" fill="#FFFFFF" opacity={0.45} />
  </svg>
);

/** A mattress with a pillow (COLCHÓN, 100 x 100). */
export const MattressIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
    <path d="M18 72 V84 M82 72 V84" stroke={K.ink} strokeWidth={7} strokeLinecap="round" />
    <rect x={6} y={42} width={88} height={34} rx={12} fill="#7EC8FF" stroke={K.ink} strokeWidth={5} />
    <path d="M10 58 H90" stroke="#4E9BE0" strokeWidth={3} />
    {[30, 50, 70].map((cx) => (
      <circle key={cx} cx={cx} cy={50} r={2.8} fill="#3F86C9" />
    ))}
    <rect x={14} y={26} width={30} height={20} rx={9} fill="#FFFFFF" stroke={K.ink} strokeWidth={4.5} />
    <rect x={14} y={66} width={72} height={5} rx={2.5} fill="#FFFFFF" opacity={0.35} />
  </svg>
);

/** A steaming bowl of food (COMIDA, 100 x 100). */
export const BowlIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const w = Math.sin(frame * 0.3) * 3;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
      {[36, 52, 68].map((x, i) => (
        <path key={x} d={`M${x} 36 C${x + 6 + w} 28 ${x - 8 - w} 20 ${x + (i === 1 ? 2 : -2)} 10`} stroke="#B8C0D0" strokeWidth={4.5} strokeLinecap="round" fill="none" />
      ))}
      <path d="M8 50 H92 C92 72 74 88 50 88 C26 88 8 72 8 50 Z" fill="#FF8A3D" stroke={K.ink} strokeWidth={5} strokeLinejoin="round" />
      <ellipse cx={50} cy={50} rx={42} ry={9} fill="#FFE29A" stroke={K.ink} strokeWidth={4.5} />
      <circle cx={38} cy={49} r={4} fill="#7CC254" />
      <circle cx={58} cy={48} r={4.5} fill="#E8452C" />
      <path d="M20 62 C24 72 32 78 40 80" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.45} />
    </svg>
  );
};

// =============================================================================================
// RichText: text with emoji drawn as SVG

const EMOJI_RE = /(💤|💸|❌|✅|🔇|👇)/u;

const EmojiGlyph: React.FC<{ ch: string; size: number; frame?: number }> = ({ ch, size, frame }) => {
  switch (ch) {
    case "💤":
      return <ZzzIcon size={size} frame={frame} />;
    case "💸":
      return <MoneyWingsIcon size={size * 1.15} frame={frame} />;
    case "❌":
      return <CrossIcon size={size * 0.9} />;
    case "✅":
      return <CheckIcon size={size * 0.92} />;
    case "🔇":
      return <MuteIcon size={size} />;
    case "👇":
      return <PointDownIcon size={size * 1.15} />;
    default:
      return <>{ch}</>;
  }
};

/**
 * Text with its emoji (💤 💸 ❌ ✅ 🔇 👇) replaced by inline SVG icons of `size` px (about the font
 * size). Works inside any styled text block; `frame` animates the icons (Zs bob, wings flap).
 */
export const RichText: React.FC<{ text: string; size: number; frame?: number }> = ({ text, size, frame }) => {
  const parts = text.replace(/️/g, "").split(EMOJI_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={{ display: "inline-block", verticalAlign: `${-size * 0.16}px`, margin: `0 ${size * 0.08}px`, lineHeight: 0 }}>
            <EmojiGlyph ch={p} size={size} frame={frame} />
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
};

// =============================================================================================
// Rolling digits

/**
 * One digit cell (`w` x `h`): rolls up from `from` to `to` as `k` goes 0 -> 1 (the old digit leaves
 * through the top, the new one comes in from below). `smear` (0..1) adds a vertical motion blur,
 * like a reel spinning. Only a rolling / smeared cell is clipped, so static digits keep their glow.
 */
const Reel: React.FC<{ from: string; to: string; k: number; w: number; h: number; smear?: number; down?: boolean }> = ({
  from,
  to,
  k,
  w,
  h,
  smear = 0,
  down = false,
}) => {
  const e = EASE_OUT(clamp01(k));
  const rolling = from !== to && e < 0.999;
  const dir = down ? -1 : 1;
  const glyph = (ch: string, dy: number, op: number, key: string) => (
    <span
      key={key}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: w,
        height: h,
        lineHeight: `${h}px`,
        textAlign: "center",
        transform: `translateY(${dy}px)`,
        opacity: op,
      }}
    >
      {ch}
    </span>
  );
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        flexShrink: 0,
        width: w,
        height: h,
        clipPath: rolling || smear > 0 ? `inset(${-h * 0.04}px ${-w}px ${-h * 0.04}px ${-w}px)` : undefined,
      }}
    >
      {rolling ? (
        <>
          {glyph(from, -e * h * dir, 1 - 0.5 * e, "a")}
          {glyph(to, (1 - e) * h * dir, 0.5 + 0.5 * e, "b")}
        </>
      ) : (
        <>
          {smear > 0 ? glyph(to, -h * 0.14, 0.3 * smear, "u") : null}
          {smear > 0 ? glyph(to, h * 0.14, 0.3 * smear, "d") : null}
          {glyph(to, 0, 1, "c")}
        </>
      )}
    </span>
  );
};

// =============================================================================================
// 1. MoneyCounter

export type MoneyEvent = { at: number; text: string; tone?: "plus" | "minus" };
type CounterState = "earning" | "frozen" | "alarm" | "zero";

type CounterPal = { led: string; core: string; rim: string; glass0: string; glass1: string };
const COUNTER_PAL: Record<CounterState, CounterPal> = {
  earning: { led: "#2BFF7E", core: "#E6FFEE", rim: "#3BEA7E", glass0: "#14402A", glass1: "#05140C" },
  frozen: { led: "#FFD84D", core: "#FFF9DA", rim: "#FFD84D", glass0: "#40340B", glass1: "#151003" },
  alarm: { led: "#FF4D5E", core: "#FFE3E6", rim: "#FF4D5E", glass0: "#520C18", glass1: "#1C0307" },
  zero: { led: "#C3CAD6", core: "#E3E7EE", rim: "#9AA3B2", glass0: "#2D323D", glass1: "#121419" },
};

// Counter geometry at scale 1 (px).
const MC = { H: 100, TAIL: 16, BORDER: 5, PAD_L: 9, COIN: 80, GAP: 8, PAD_R: 30, MAX_W: 412, FONT: 74 };

const eventTone = (e: MoneyEvent) => e.tone ?? (/^\s*[-−–]/.test(e.text) ? "minus" : "plus");

/**
 * A floating money counter, a glossy LED pill «🪙 S/ 1 280», anchored at its bottom centre (x, y):
 * the tip of its little pointer, as returned by counterAt() in src/dormir/counter.ts; `scale`
 * multiplies its size from there (about 250-400 x 116 at scale 1, never wider than ~412: long
 * numbers shrink their digits; legible down to scale 0.5).
 * - soles: the value (rounded, never negative). Drive it continuously (e.g. +3 per frame): while
 *   `earning`, each digit column rolls like an odometer reel shortly before it changes, and the
 *   last digit spins (motion blur). A leading digit (999 -> 1 000) grows in smoothly.
 * - state: "earning" (green glow, the coin spins, tiny coins pop out), "frozen" (yellow, a pause
 *   badge), "alarm" (red, flashing, shaking, a "!" badge), "zero" (grey, no glow).
 * - events: small labels ("+S/ 100" green, "−S/ 400" red; tone defaults from the sign) pop at
 *   their frame and float up ~200 px above the counter; the pill punches (and a + event bursts
 *   coins, a − event shakes it).
 * - appear: pops in at this frame (default: already there). opacity: multiplies.
 */
export const MoneyCounter: React.FC<{
  frame: number;
  soles: number;
  x: number;
  y: number;
  scale?: number;
  state?: "earning" | "frozen" | "alarm" | "zero";
  appear?: number;
  opacity?: number;
  events?: MoneyEvent[];
}> = ({ frame, soles, x, y, scale = 1, state = "earning", appear, opacity = 1, events = [] }) => {
  const inP = appear === undefined ? 1 : pop(frame, appear, { damping: 12, stiffness: 210 });
  if (inP <= 0.001 || opacity <= 0) return null;
  const pal = COUNTER_PAL[state];
  const earning = state === "earning";
  const alarm = state === "alarm";
  const frozen = state === "frozen";
  const zero = state === "zero";
  const v = Math.max(0, Math.round(soles));

  // Digit columns, most significant first. While earning, a column about to change rolls during
  // the last few soles before it does (an odometer carry), so a value climbing every frame reads
  // as rolling reels and a static value always shows clean digits.
  const s = String(v);
  const n = s.length;
  type Col = { from: string; to: string; k: number; w: number; pow: number };
  const carry = (pow: number) => {
    if (!earning || pow < 1) return 0;
    const p10 = Math.pow(10, pow);
    const W = pow === 1 ? 3 : 15;
    return clamp01(((v % p10) - (p10 - W)) / W);
  };
  const cols: Col[] = [];
  const lead = carry(n);
  if (lead > 0) cols.push({ from: "", to: "1", k: lead, w: lead, pow: n });
  for (let j = 0; j < n; j++) {
    const pow = n - 1 - j;
    const d = s.charCodeAt(j) - 48;
    const c = carry(pow);
    cols.push(c > 0 ? { from: String(d), to: String((d + 1) % 10), k: c, w: 1, pow } : { from: s[j], to: s[j], k: 1, w: 1, pow });
  }
  const isGap = (c: Col) => c.pow > 0 && c.pow % 3 === 0;
  const nEff = cols.reduce((a, c) => a + c.w, 0);
  const gEff = cols.reduce((a, c) => a + (isGap(c) ? c.w : 0), 0);
  const fixed = MC.PAD_L + MC.COIN + MC.GAP + MC.PAD_R + 2 * MC.BORDER + 8;
  const F = Math.min(MC.FONT, (MC.MAX_W - fixed) / (0.64 + 0.64 * Math.max(2, nEff) + 0.22 * gEff));
  const CW = 0.64 * F;
  const numW = Math.max(2, nEff) * CW + gEff * 0.22 * F;
  const labelW = 0.64 * F;
  const pillW = MC.PAD_L + MC.COIN + MC.GAP + labelW + numW + MC.PAD_R + 2 * MC.BORDER;
  const top = -MC.TAIL - MC.H;

  // Light, glow and motion per state.
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.2);
  const on = alarm ? blink(frame, 0, 4, 3) : 1;
  const glow = earning ? 0.5 + 0.5 * pulse : alarm ? (on ? 1 : 0.1) : frozen ? 0.5 : 0;
  let hit = 0;
  let shX = alarm ? jit(frame, 1) * 4 : 0;
  let shY = alarm ? jit(frame, 2) * 3 : 0;
  events.forEach((e) => {
    const d = frame - e.at;
    if (d >= 0 && d < 10) hit = Math.max(hit, 1 - d / 10);
    if (eventTone(e) === "minus") {
      const im = impact(frame, e.at, 14, 12);
      shX += im.x;
      shY += im.y;
    }
  });
  const sc = scale * (0.55 + 0.45 * inP) * (1 + 0.12 * hit);
  const coinSpin = earning ? frame * 0.17 : 0;
  const coinRot = zero ? -14 : alarm ? jit(frame, 5) * 8 : -8 + Math.sin(frame * 0.09) * 4;
  const coreColor = alarm && !on ? hexA(pal.core, 0.55) : pal.core;
  const textShadow =
    glow > 0
      ? `0 0 3px ${hexA(pal.led, 0.9)}, 0 0 ${8 + 12 * glow}px ${hexA(pal.led, 0.45 + 0.4 * glow)}, 0 3px 0 rgba(0,0,0,0.45)`
      : "0 3px 0 rgba(0,0,0,0.45)";
  const rim = alarm && !on ? hexA(pal.rim, 0.55) : pal.rim;

  // Tiny coins popping out of the top while earning (one every 7 frames, ~24 frames each).
  const pops: React.ReactNode[] = [];
  const spawnCoin = (key: string, a: number, seed: number, burst: number) => {
    const r1 = rand(seed * 1.37 + 0.2);
    const r2 = rand(seed * 2.91 + 0.7);
    const r3 = rand(seed * 4.13 + 0.4);
    const x0 = (r1 - 0.5) * pillW * 0.55;
    const vx = (r1 - 0.5) * 4 + (r2 - 0.5) * 3 + burst * (r1 - 0.5) * 10;
    const vy = -(9 + r2 * 5) - burst * 4;
    const px = x0 + vx * a;
    const py = top + 18 + vy * a + 0.55 * a * a;
    const sz = 26 + r3 * 12;
    const life = 24;
    const op = a > life - 6 ? Math.max(0, (life - a) / 6) : 1;
    pops.push(
      <div key={key} style={{ position: "absolute", left: px - sz / 2, top: py - sz / 2, opacity: op * Math.min(1, a / 2 + 0.3) }}>
        <CoinIcon size={sz} spin={a * 0.45 + r3 * 6} />
      </div>,
    );
  };
  if (earning) {
    const P = 7;
    const last = Math.floor(frame / P);
    for (let m = last; m > last - 4; m--) {
      const a = frame - m * P;
      if (a < 0 || a > 24) continue;
      if (appear !== undefined && m * P < appear + 3) continue;
      spawnCoin(`p${m}`, a, m, 0);
    }
  }
  events.forEach((e, i) => {
    if (eventTone(e) !== "plus") return;
    const a = frame - e.at;
    if (a < 0 || a > 24) return;
    for (let j = 0; j < 6; j++) spawnCoin(`e${i}-${j}`, a, e.at * 3.1 + j * 7.7, 1);
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x + shX,
        top: y + shY,
        width: 0,
        height: 0,
        transform: `scale(${sc})`,
        transformOrigin: "0 0",
        opacity: Math.min(1, inP * 2.5) * opacity,
        pointerEvents: "none",
      }}
    >
      {pops}
      {/* The pointer (its tip is the anchor). */}
      <svg width={40} height={MC.TAIL + 10} viewBox={`0 0 40 ${MC.TAIL + 10}`} style={{ position: "absolute", left: -20, top: -MC.TAIL - 10, overflow: "visible" }}>
        <path d={`M3 0 H37 L20 ${MC.TAIL + 10} Z`} fill={rim} stroke={K.ink} strokeWidth={4.5} strokeLinejoin="round" />
      </svg>
      {/* The glossy LED pill. */}
      <div
        style={{
          position: "absolute",
          left: -pillW / 2,
          top,
          width: pillW,
          height: MC.H,
          boxSizing: "border-box",
          borderRadius: MC.H / 2,
          border: `${MC.BORDER}px solid ${rim}`,
          background: `linear-gradient(180deg, ${pal.glass0} 0%, ${pal.glass1} 100%)`,
          boxShadow: `0 0 0 4px ${K.ink}, 0 9px 0 4px rgba(0,0,0,0.32), 0 0 ${16 + 30 * glow}px ${hexA(pal.led, 0.25 + 0.5 * glow)}, inset 0 0 24px ${hexA(pal.led, 0.18 + 0.2 * glow)}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: MC.PAD_L,
          paddingRight: MC.PAD_R,
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: MC.H / 2, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 4px)",
            }}
          />
          <div style={{ position: "absolute", left: 22, right: 22, top: 4, height: "40%", borderRadius: 999, background: "linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.03))" }} />
        </div>
        <div style={{ position: "relative", width: MC.COIN, height: MC.COIN, flexShrink: 0, transform: `rotate(${coinRot}deg)` }}>
          <CoinIcon size={MC.COIN} spin={coinSpin} grey={zero} />
        </div>
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            marginLeft: MC.GAP,
            fontFamily: UI,
            fontWeight: 900,
            color: coreColor,
            textShadow,
            whiteSpace: "nowrap",
            ...TAB,
          }}
        >
          <span style={{ fontSize: 0.5 * F, lineHeight: 1, marginRight: 0.1 * F, marginBottom: 0.075 * F, opacity: 0.92 }}>S/</span>
          <div style={{ display: "flex", width: numW, justifyContent: "center", fontSize: F, height: F }}>
            {cols.map((c, i) => (
              <React.Fragment key={`${c.pow}-${i}`}>
                <span style={{ display: "inline-block", width: CW * c.w, height: F, overflow: "visible", opacity: c.w < 1 ? c.w : 1 }}>
                  <Reel from={c.from} to={c.to} k={c.k} w={CW} h={F} smear={earning && c.pow === 0 ? 1 : 0} />
                </span>
                {isGap(c) ? <span style={{ display: "inline-block", width: 0.22 * F * c.w }} /> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
        {frozen ? (
          <div
            style={{
              position: "absolute",
              right: -14,
              top: -16,
              width: 44,
              height: 44,
              borderRadius: 22,
              background: K.yellow,
              boxShadow: `0 0 0 4px ${K.ink}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <div style={{ width: 8, height: 20, borderRadius: 2, background: K.ink }} />
            <div style={{ width: 8, height: 20, borderRadius: 2, background: K.ink }} />
          </div>
        ) : null}
        {alarm ? (
          <div
            style={{
              position: "absolute",
              right: -14,
              top: -18,
              width: 46,
              height: 46,
              borderRadius: 23,
              background: on ? K.red : "#B0182A",
              boxShadow: `0 0 0 4px ${K.ink}, 0 0 ${on ? 18 : 0}px ${K.red}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: UI,
              fontWeight: 900,
              fontSize: 32,
              color: "#FFFFFF",
              transform: `scale(${on ? 1.12 : 0.92}) rotate(${jit(frame, 7) * 10}deg)`,
            }}
          >
            !
          </div>
        ) : null}
      </div>
      {/* Event labels float up. */}
      {events.map((e, i) => {
        const d = frame - e.at;
        if (d < 0 || d > 44) return null;
        const minus = eventTone(e) === "minus";
        const p = pop(frame, e.at, { damping: 9, stiffness: 240 });
        const q = EASE_OUT(clamp01(d / 44));
        const fade = d > 32 ? 1 - (d - 32) / 12 : 1;
        return (
          <div
            key={`ev${i}`}
            style={{
              position: "absolute",
              left: (i % 2 ? 1 : -1) * 30 * q,
              top: top - 46 - 150 * q,
              transform: `translate(-50%, -50%) scale(${0.4 + 0.6 * p}) rotate(${(i % 2 ? 5 : -5) * (1 - q)}deg)`,
              opacity: fade * Math.min(1, p * 3),
              filter: `drop-shadow(0 0 12px ${minus ? "rgba(255,59,78,0.75)" : "rgba(43,255,126,0.7)"})`,
            }}
          >
            <div style={{ position: "relative", paddingTop: 4 }}>
              <HeavyText text={e.text} size={58} font={UI} colors={minus ? TXT_RED : TXT_GREEN} stroke={K.ink} style={{ fontWeight: 900 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================================
// 2. TitleSticker

/**
 * The hook title in the top band (x 70-930, y 245-480): «¿Y SI DORMIR 💤» (white, DORMIR in
 * dreamy lavender, bobbing Zs) over «TE PAGARA? 💸» (gold on a money-green marker bar that wipes
 * in, a flapping winged banknote). Readable from the first frames: line 1 lands ~4 frames after
 * `at`, line 2 ~8. A soft dark scrim behind keeps it readable on any shot. Lines leave one by one
 * (shrink, fly up) at `out`. Suggested: at GANCHO.START (0), out GANCHO.L02 - 10 or so.
 */
export const TitleSticker: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 16) return null;
  const t = frame - at;
  const scrimK = ramp(frame, at, at + 5) * (1 - ramp(frame, out, out + 14));
  const lines = [
    { y: 300, delay: 0 },
    { y: 420, delay: 4 },
  ];
  const zIn = pop(frame, at + 7, { damping: 9, stiffness: 200 });
  const mIn = pop(frame, at + 10, { damping: 9, stiffness: 200 });
  const icOut = ramp(frame, out, out + 8, [0, 1], EASE_IN);
  const sw = ramp(frame, at + 3, at + 10, [0, 1], EASE_OUT);
  const L1 = 104;
  const L2 = 108;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 10,
          top: 180,
          width: 980,
          height: 360,
          background: "radial-gradient(closest-side, rgba(16,10,40,0.52), rgba(16,10,40,0.28) 62%, rgba(16,10,40,0))",
          opacity: scrimK,
        }}
      />
      {lines.map((l, i) => {
        const la = at + l.delay;
        const p = pop(frame, la, { damping: 10, stiffness: 210 });
        const kk = ramp(frame, out + i * 2, out + i * 2 + 9, [0, 1], EASE_IN);
        if (p < 0.001 || kk >= 1) return null;
        const rot = (i % 2 ? 1.8 : -1.8) * (0.6 + 0.4 * (1 - p)) + Math.sin(t * 0.07 + i * 1.3) * 0.6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 500,
              top: l.y,
              transform: `translate(-50%, -50%) translateY(${-70 * kk}px) scale(${p * (1 - 0.6 * kk)}) rotate(${rot}deg)`,
              opacity: Math.min(1, p * 3) * (1 - kk),
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            {i === 0 ? (
              <>
                <div style={{ position: "relative", paddingTop: L1 * 0.06, display: "flex", gap: L1 * 0.22 }}>
                  <HeavyText text="¿Y SI" size={L1} colors={TXT_WHITE} stroke={K.ink} />
                  <HeavyText text="DORMIR" size={L1} colors={TXT_DREAM} stroke={K.ink} />
                </div>
                <div style={{ width: 104, height: 104, transform: `scale(${zIn * (1 - icOut)}) rotate(${(1 - zIn) * -40 + Math.sin(t * 0.1) * 5}deg) translateY(-14px)` }}>
                  <ZzzIcon size={104} frame={frame} />
                </div>
              </>
            ) : (
              <>
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: -30,
                      right: -30,
                      top: -12,
                      bottom: -10,
                      borderRadius: 22,
                      background: "linear-gradient(180deg, #4BEA85 0%, #1FBF5F 48%, #0B8F43 100%)",
                      border: "6px solid #FFFFFF",
                      boxShadow: `0 0 0 5px ${K.ink}, 0 10px 0 5px rgba(0,0,0,0.3)`,
                      transform: `scaleX(${sw}) rotate(-1.2deg)`,
                      transformOrigin: "0% 50%",
                    }}
                  />
                  <div style={{ position: "relative", paddingTop: L2 * 0.06 }}>
                    <HeavyText text="TE PAGARA?" size={L2} colors={TXT_GOLD} stroke={K.ink} />
                  </div>
                </div>
                <div style={{ width: 120, height: 120, marginLeft: 22, transform: `scale(${mIn * (1 - icOut)}) rotate(${(1 - mIn) * 50}deg) translateY(${Math.sin(t * 0.16) * 6}px)` }}>
                  <MoneyWingsIcon size={120} frame={frame} />
                </div>
              </>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 3. RuleStamp

/**
 * The rule as an official badge stamped in the top band (centre x 500, y 392; ~800 x 240, y
 * 270-515): a cream card with a thick green double border, a big gold S/ coin on its left edge,
 * «S/ 100» in huge green letters and «POR HORA DORMIDA 💤» on a violet ribbon. Slams in like a
 * rubber stamp at `at` (falls from 2.4x in 5 frames, squash, shake, a white shock ring, impact
 * lines and a burst of coins), wobbles gently, shrinks away at `out`. Suggested: at GANCHO.CIEN
 * - 3, out GANCHO.TODOS - 6 (or GANCHO.END - 8).
 */
export const RuleStamp: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 12) return null;
  const t = frame - at;
  const SLAM = 5;
  const fall = ramp(frame, at, at + SLAM, [0, 1], EASE_IN);
  const landed = t >= SLAM;
  const settle = landed ? pop(frame, at + SLAM, { damping: 8, stiffness: 260 }) : 0;
  const sq = bump(frame, at + SLAM - 1, 8);
  const base = landed ? 1 : 2.4 - 1.4 * fall;
  const k = leave(frame, out, 10);
  const sh = impact(frame, at + SLAM, 18, 12);
  const rot = -4 + (landed ? (1 - settle) * 6 : 10 * (1 - fall)) + Math.sin(t * 0.08) * 0.7 + sh.r;
  const ring = landed ? clamp01((t - SLAM) / 12) : -1;
  const CX = 500;
  const CY = 392;
  const W = 800;
  const H = 236;
  const coinIn = landed ? pop(frame, at + SLAM, { damping: 9, stiffness: 200 }) : 0;
  const ribbon = ramp(frame, at + SLAM + 1, at + SLAM + 8, [0, 1], EASE_OUT);
  const burst: React.ReactNode[] = [];
  if (landed && t - SLAM < 26) {
    const a = t - SLAM;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + rand(i * 3.3) * 0.5;
      const sp = 20 + rand(i * 7.7) * 12;
      const px = Math.cos(ang) * sp * a * 1.15;
      const py = Math.sin(ang) * sp * a * 0.55 + 0.9 * a * a;
      const sz = 46 + rand(i * 1.9) * 26;
      burst.push(
        <div key={i} style={{ position: "absolute", left: px - sz / 2, top: py - sz / 2, opacity: a > 18 ? (26 - a) / 8 : 1 }}>
          <CoinIcon size={sz} spin={a * 0.4 + i} />
        </div>,
      );
    }
  }
  return (
    <div style={{ position: "absolute", left: CX + sh.x, top: CY + sh.y, width: 0, height: 0, transform: `scale(${1 - 0.85 * k})`, opacity: Math.min(1, fall * 3) * (1 - k), pointerEvents: "none" }}>
      {burst}
      {ring >= 0 && ring < 1
        ? Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2 + 0.26;
            const r0 = 300 + 140 * EASE_OUT(ring);
            return (
              <div
                key={`l${i}`}
                style={{
                  position: "absolute",
                  left: Math.cos(a) * r0 * 1.2,
                  top: Math.sin(a) * r0 * 0.5,
                  width: 52 * (1 - ring),
                  height: 10,
                  borderRadius: 5,
                  background: "#FFFFFF",
                  boxShadow: `0 0 0 3px ${K.ink}`,
                  transform: `translate(-50%, -50%) rotate(${(a * 180) / Math.PI}deg)`,
                  opacity: 1 - ring,
                }}
              />
            );
          })
        : null}
      <div style={{ position: "absolute", left: -W / 2, top: -H / 2, width: W, height: H, transform: `scale(${base * (1 + 0.1 * sq)}, ${base * (1 - 0.14 * sq)}) rotate(${rot}deg)` }}>
        {ring >= 0 && ring < 1 ? (
          <div style={{ position: "absolute", inset: 0, borderRadius: 40, border: `${12 * (1 - ring)}px solid #FFFFFF`, transform: `scale(${1 + 0.25 * EASE_OUT(ring)})`, opacity: 1 - ring }} />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxSizing: "border-box",
            borderRadius: 38,
            background: "linear-gradient(180deg, #FFFEF6 0%, #FFF6DD 65%, #FFEBC2 100%)",
            border: `10px solid ${K.greenDark}`,
            boxShadow: SHADOW,
          }}
        >
          <div style={{ position: "absolute", inset: 8, borderRadius: 26, border: `4px solid ${hexA(K.greenDark, 0.75)}` }} />
          <div style={{ position: "absolute", inset: 18, borderRadius: 20, border: `3px dashed ${hexA(K.greenDark, 0.3)}` }} />
        </div>
        <div style={{ position: "absolute", left: 172, right: 24, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", paddingTop: 136 * 0.06, marginTop: -6 }}>
            <HeavyText text="S/ 100" size={136} colors={TXT_GREEN} stroke={K.ink} />
          </div>
          <div
            style={{
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 18px 8px 24px",
              borderRadius: 999,
              background: `linear-gradient(180deg, #7B5CFF 0%, ${K.night} 100%)`,
              boxShadow: SHADOW_SM,
              fontFamily: UI,
              fontWeight: 900,
              fontSize: 42,
              lineHeight: 1,
              color: "#FFFFFF",
              whiteSpace: "nowrap",
              transform: `scaleX(${0.6 + 0.4 * ribbon})`,
              opacity: ribbon,
            }}
          >
            POR HORA DORMIDA
            <ZzzIcon size={50} frame={frame} />
          </div>
        </div>
        <div style={{ position: "absolute", left: -66, top: H / 2 - 104, transform: `scale(${coinIn}) rotate(${-14 + (1 - coinIn) * -90 + Math.sin(t * 0.1) * 4}deg)` }}>
          <CoinIcon size={208} spin={(1 - coinIn) * 6} />
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// 4. SleepSensor

/**
 * A small sleep sensor clipped on a headboard, anchored at its bottom centre (x, y) (the clip),
 * `scale` multiplying from there (~330-430 x 120 at scale 1). A dark device with a lens LED and
 * a status screen: «DORMIDO ✅» in green (the LED breathes, a tiny Z floats up) or «DESPIERTO ❌»
 * in red (the LED blinks, the device buzzes and shakes, vibration marks on both sides). With
 * `buzzAt`, an awake sensor stays still until that frame, then jolts (pop, hard shake, flash)
 * and keeps buzzing; without it, an awake sensor buzzes all along. `appear` pops it in,
 * `opacity` multiplies. Suggested: state "awake", buzzAt PROBLEMA.FINGIR.
 */
export const SleepSensor: React.FC<{
  frame: number;
  x: number;
  y: number;
  scale?: number;
  state: "awake" | "asleep";
  buzzAt?: number;
  appear?: number;
  opacity?: number;
}> = ({ frame, x, y, scale = 1, state, buzzAt, appear, opacity = 1 }) => {
  const inP = appear === undefined ? 1 : pop(frame, appear, { damping: 11, stiffness: 220 });
  if (inP <= 0.001 || opacity <= 0) return null;
  const awake = state === "awake";
  const color = awake ? "#FF4D5E" : "#2BFF7E";
  const buzzing = awake && (buzzAt === undefined || frame >= buzzAt);
  const since = buzzAt === undefined ? frame : frame - buzzAt;
  // Buzz: a hard jolt at buzzAt, then a burst of vibration every 12 frames.
  const jolt = buzzAt !== undefined && awake ? impact(frame, buzzAt, 22, 14) : { x: 0, y: 0, r: 0 };
  const cycle = (((since % 12) + 12) % 12);
  const vib = buzzing ? (cycle < 6 ? 1 : 0.25) : 0;
  const bx = buzzing ? jit(frame, 3, 1) * 5 * vib : 0;
  const by = buzzing ? jit(frame, 4, 1) * 2.5 * vib : 0;
  const br = buzzing ? jit(frame, 6, 1) * 2.4 * vib : 0;
  const punch = buzzAt !== undefined && awake ? bump(frame, buzzAt, 8) : 0;
  const led = awake ? (blink(frame, 0, 4, 4) ? 1 : 0.35) : 0.65 + 0.35 * Math.sin(frame * 0.12);
  const s = scale * (0.55 + 0.45 * inP) * (1 + 0.16 * punch);
  const label = awake ? "DESPIERTO" : "DORMIDO";
  const H = 92;
  return (
    <div
      style={{
        position: "absolute",
        left: x + jolt.x + bx,
        top: y + jolt.y + by,
        width: 0,
        height: 0,
        transform: `scale(${s}) rotate(${jolt.r + br}deg)`,
        transformOrigin: "0 0",
        opacity: Math.min(1, inP * 2.5) * opacity,
        pointerEvents: "none",
      }}
    >
      {/* The clip on the headboard. */}
      <div style={{ position: "absolute", left: -26, top: -30, width: 52, height: 34, borderRadius: "8px 8px 12px 12px", background: "linear-gradient(180deg, #5A5F78, #2E3146)", boxShadow: `0 0 0 4px ${K.ink}` }} />
      <div style={{ position: "absolute", left: -40, top: -6, width: 80, height: 10, borderRadius: 5, background: "#8A90A8", boxShadow: `0 0 0 4px ${K.ink}` }} />
      {/* Vibration marks. */}
      {buzzing
        ? [-1, 1].map((sd) => (
            <svg key={sd} width={60} height={90} viewBox="0 0 60 90" style={{ position: "absolute", left: sd < 0 ? -258 : 198, top: -30 - H - 2, overflow: "visible", opacity: 0.35 + 0.65 * vib, transform: sd < 0 ? "scaleX(-1)" : undefined }}>
              {[0, 1, 2].map((i) => (
                <path key={i} d={`M${10 + i * 14} ${22 - i * 8} Q${22 + i * 14} 45 ${10 + i * 14} ${68 + i * 8}`} stroke={K.ink} strokeWidth={11} strokeLinecap="round" fill="none" />
              ))}
              {[0, 1, 2].map((i) => (
                <path key={`c${i}`} d={`M${10 + i * 14} ${22 - i * 8} Q${22 + i * 14} 45 ${10 + i * 14} ${68 + i * 8}`} stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
              ))}
            </svg>
          ))
        : null}
      {/* A tiny Z floating up from a sleeping sensor. */}
      {!awake
        ? [0, 1].map((i) => {
            const ph = ((frame + i * 30) % 60) / 60;
            return (
              <div key={i} style={{ position: "absolute", left: 120 + ph * 40, top: -30 - H - 30 - ph * 70, opacity: Math.sin(ph * Math.PI), transform: `scale(${0.6 + 0.5 * ph})` }}>
                <ZzzIcon size={46} />
              </div>
            );
          })
        : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -30 - H,
          height: H,
          transform: "translateX(-50%)",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 20px 0 14px",
          borderRadius: 28,
          background: "linear-gradient(180deg, #33365A 0%, #171A30 100%)",
          border: `4px solid ${color}`,
          boxShadow: `0 0 0 4px ${K.ink}, 0 8px 0 4px rgba(0,0,0,0.3), 0 0 ${awake ? 10 + 26 * vib + 30 * punch : 18}px ${hexA(color, awake ? 0.7 : 0.45)}`,
          whiteSpace: "nowrap",
        }}
      >
        {/* Lens LED with radar arcs. */}
        <div style={{ position: "relative", width: 58, height: 58, flexShrink: 0, borderRadius: 29, background: "#0B0D1A", boxShadow: `inset 0 0 0 4px #4A4F70` }}>
          <div
            style={{
              position: "absolute",
              left: 14,
              top: 14,
              width: 30,
              height: 30,
              borderRadius: 15,
              background: `radial-gradient(circle at 38% 35%, #FFFFFF 0%, ${color} 35%, ${hexA(color, 0.6)} 100%)`,
              opacity: 0.35 + 0.65 * led,
              boxShadow: `0 0 ${6 + 16 * led}px ${color}`,
            }}
          />
        </div>
        <div style={{ fontFamily: UI, fontWeight: 900, fontSize: 46, lineHeight: 1, color, letterSpacing: 1, textShadow: `0 0 12px ${hexA(color, 0.55)}` }}>{label}</div>
        <div style={{ width: 52, height: 52, flexShrink: 0, transform: `rotate(${awake ? jit(frame, 9, 2) * 8 * vib : 0}deg)` }}>
          {awake ? <CrossIcon size={52} /> : <CheckIcon size={52} />}
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// 5. PriceTag

/**
 * The bakery's chalkboard (centre x, y; default 500, 560; ~600 x 360 plus the hanging string
 * up to y - 250): a slate in a wooden frame hanging from a nail, a chalk bread roll, «1 PAN» in
 * chalk white and «= S/ 100» in big chalk yellow, underlined. Slapped in from above at `at`: it
 * drops, bounces on its string and swings to rest (a puff of chalk dust on the landing). Lifts
 * away at `out`. Suggested: at MUNDO.L09 + 6 (the baker's «cien soles»), out MUNDO.L11 + 30.
 */
export const PriceTag: React.FC<{ frame: number; at: number; out: number; x?: number; y?: number }> = ({ frame, at, out, x = 500, y = 560 }) => {
  if (frame < at || frame > out + 12) return null;
  const t = frame - at;
  const drop = pop(frame, at, { damping: 9, stiffness: 190, mass: 0.8 });
  const k = leave(frame, out, 10);
  const ty = -(1 - drop) * 620 - k * 700;
  const rot = swing(frame, at + 4, 9, 18, 12) + Math.sin(t * 0.06) * 0.6;
  const land = clamp01((t - 5) / 16);
  const W = 600;
  const H = 356;
  const chalk = (c: string): React.CSSProperties => ({
    backgroundImage: `repeating-linear-gradient(-24deg, ${c} 0px, ${c} 3px, ${hexA(c, 0.72)} 3px, ${hexA(c, 0.72)} 5px)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    filter: `drop-shadow(0 0 1.5px ${hexA(c, 0.6)})`,
  });
  return (
    <div style={{ position: "absolute", left: x, top: y + ty, width: 0, height: 0, opacity: 1 - k, pointerEvents: "none" }}>
      {/* Chalk dust puffs at the landing. */}
      {t > 4 && land < 1
        ? Array.from({ length: 8 }, (_, i) => {
            const sx = (i - 3.5) * 70;
            const r = 26 + rand(i * 2.1) * 26;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: sx + Math.sign(sx) * land * 50 - r,
                  top: H / 2 - 10 - land * 40 - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,255,255,0.75), rgba(255,255,255,0))",
                  transform: `scale(${0.5 + land})`,
                  opacity: 1 - land,
                }}
              />
            );
          })
        : null}
      <div style={{ position: "absolute", left: 0, top: -H / 2 - 110, width: 0, height: 0, transform: `rotate(${rot}deg)` }}>
        {/* String and nail. */}
        <svg width={400} height={130} viewBox="-200 0 400 130" style={{ position: "absolute", left: -200, top: 0, overflow: "visible" }}>
          <path d="M0 6 L-150 118 M0 6 L150 118" stroke={K.ink} strokeWidth={8} strokeLinecap="round" />
          <path d="M0 6 L-150 118 M0 6 L150 118" stroke="#D8C6A0" strokeWidth={4} strokeLinecap="round" />
          <circle cx={0} cy={6} r={11} fill="#9AA0B0" stroke={K.ink} strokeWidth={4} />
        </svg>
        <div
          style={{
            position: "absolute",
            left: -W / 2,
            top: 110,
            width: W,
            height: H,
            boxSizing: "border-box",
            borderRadius: 26,
            background: "linear-gradient(180deg, #C98A4B 0%, #A86A2F 100%)",
            boxShadow: SHADOW,
            padding: 20,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: 12,
              background: "radial-gradient(ellipse at 40% 30%, #2F4A3C 0%, #22362C 60%, #1A2A22 100%)",
              boxShadow: "inset 0 0 0 4px #7A4A1E, inset 0 6px 18px rgba(0,0,0,0.5)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ position: "absolute", left: 40, top: 30, width: 260, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.05)", transform: "rotate(-8deg)" }} />
            <div style={{ position: "absolute", right: 30, bottom: 26, width: 200, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: -6 }}>
              <svg width={104} height={80} viewBox="0 0 104 80" style={{ display: "block", overflow: "visible", opacity: 0.95 }}>
                <path d="M8 52 C8 30 28 16 52 16 C76 16 96 30 96 52 C96 64 84 70 52 70 C20 70 8 64 8 52 Z" fill="rgba(255,214,140,0.2)" stroke="#F4EBDA" strokeWidth={5} strokeLinejoin="round" />
                <path d="M30 40 C42 30 62 28 76 34" stroke="#F4EBDA" strokeWidth={5} strokeLinecap="round" fill="none" />
                <path d="M16 58 C34 64 70 64 88 58" stroke="#F4EBDA" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
              </svg>
              <div style={{ fontFamily: FONT.title, fontSize: 98, lineHeight: 1, paddingTop: 10, ...chalk("#F7F3EA") }}>1 PAN</div>
            </div>
            <div style={{ position: "relative", fontFamily: FONT.title, fontSize: 128, lineHeight: 1, paddingTop: 12, marginTop: 4, whiteSpace: "nowrap", ...chalk("#FFE45C") }}>= S/ 100</div>
            <svg width={420} height={30} viewBox="0 0 420 30" style={{ display: "block", marginTop: -6 }}>
              <path d="M10 18 C120 8 260 26 410 12" stroke="#FFE45C" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.85} />
              <path d="M60 26 C170 18 280 30 380 22" stroke="#FFE45C" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.55} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// 6. SilenceSign

const CARDBOARD = "M14 22 L120 8 L310 16 L470 6 L606 20 L598 140 L610 300 L596 392 L420 404 L250 396 L80 408 L8 396 L18 250 L6 120 Z";

/**
 * The neighbour's hand-written cardboard sign (centre x, y; default 500, 600; ~620 x 410, the
 * string reaches y - 300): uneven brown cardboard taped on a string, «SILENCIO:» in black marker,
 * a huge red «S/ 50» circled by hand and «la hora» scribbled beside it. Swings in at `at` (drops
 * on its string from a tilt and sways to rest), leaves upward at `out`. Suggested: at ENEMIGO.L13
 * + 4, out ENEMIGO.L14 - 4 (or ENEMIGO.END - 8).
 */
export const SilenceSign: React.FC<{ frame: number; at: number; out: number; x?: number; y?: number }> = ({ frame, at, out, x = 500, y = 600 }) => {
  if (frame < at || frame > out + 12) return null;
  const t = frame - at;
  const drop = pop(frame, at, { damping: 12, stiffness: 160 });
  const k = leave(frame, out, 10);
  const rot = swing(frame, at, 38, 22, 14) + Math.sin(t * 0.05) * 0.8;
  const ty = -(1 - drop) * 520 - k * 760;
  const circle = ramp(frame, at + 10, at + 22, [0, 1], EASE_IN_OUT);
  const W = 616;
  const H = 412;
  const marker: React.CSSProperties = { fontFamily: FONT.title, lineHeight: 1, whiteSpace: "nowrap" };
  return (
    <div style={{ position: "absolute", left: x, top: y + ty, width: 0, height: 0, opacity: 1 - k, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, top: -H / 2 - 96, width: 0, height: 0, transform: `rotate(${rot}deg)` }}>
        <svg width={360} height={110} viewBox="-180 0 360 110" style={{ position: "absolute", left: -180, top: 0, overflow: "visible" }}>
          <path d="M0 6 L-200 104 M0 6 L200 104" stroke={K.ink} strokeWidth={7} strokeLinecap="round" />
          <path d="M0 6 L-200 104 M0 6 L200 104" stroke="#E9E2D0" strokeWidth={3} strokeLinecap="round" />
          <circle cx={0} cy={6} r={10} fill="#9AA0B0" stroke={K.ink} strokeWidth={4} />
        </svg>
        <div style={{ position: "absolute", left: -W / 2, top: 92, width: W, height: H }}>
          <svg width={W} height={H} viewBox="0 0 616 412" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <defs>
              <linearGradient id="dormirCardboard" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#D9A867" />
                <stop offset="1" stopColor="#B98447" />
              </linearGradient>
            </defs>
            <path d={CARDBOARD} transform="translate(6 12)" fill="rgba(0,0,0,0.3)" />
            <path d={CARDBOARD} fill="url(#dormirCardboard)" stroke={K.ink} strokeWidth={6} strokeLinejoin="round" />
            {Array.from({ length: 22 }, (_, i) => (
              <path key={i} d={`M${30 + i * 26} 18 L${28 + i * 26} 396`} stroke="rgba(120,70,20,0.10)" strokeWidth={6} />
            ))}
            <path d="M20 300 L120 330 L60 392" stroke="rgba(120,70,20,0.25)" strokeWidth={3} fill="none" />
            {/* Tape where the string holds it. */}
            <rect x={60} y={0} width={86} height={34} rx={4} transform="rotate(-8 103 17)" fill="rgba(240,236,220,0.82)" stroke="rgba(26,18,51,0.35)" strokeWidth={2} />
            <rect x={470} y={0} width={86} height={34} rx={4} transform="rotate(7 513 17)" fill="rgba(240,236,220,0.82)" stroke="rgba(26,18,51,0.35)" strokeWidth={2} />
          </svg>
          <div style={{ position: "absolute", left: 0, right: 0, top: 56, display: "flex", justifyContent: "center" }}>
            <div style={{ ...marker, fontSize: 104, color: "#1C1A24", transform: "rotate(-3deg)", letterSpacing: 2 }}>SILENCIO:</div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 196, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 26 }}>
            <div style={{ position: "relative" }}>
              <svg width={330} height={190} viewBox="0 0 330 190" style={{ position: "absolute", left: -42, top: -40, overflow: "visible" }}>
                <path
                  d="M40 96 C34 40 110 14 176 16 C250 18 304 50 300 100 C296 150 226 176 160 172 C92 168 40 146 44 92 C46 70 62 52 84 40"
                  stroke="#E3242B"
                  strokeWidth={7}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={1000}
                  strokeDashoffset={1000 * (1 - circle)}
                />
              </svg>
              <div style={{ ...marker, fontSize: 132, color: "#E3242B", transform: "rotate(-4deg)" }}>S/ 50</div>
            </div>
            <div style={{ fontFamily: FONT.fun, fontSize: 70, lineHeight: 1, color: "#1C1A24", transform: "rotate(-6deg) translateY(-14px)", whiteSpace: "nowrap" }}>la hora</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// 7. PayToast

/**
 * A phone payment notification dropping into the top band (x 60-940, y 240-~420): a green wallet
 * app icon with an S/ coin, «PAGO ENVIADO · ahora» and «Pagaste S/ 50 a Vecino 🔇» (the amount in
 * red). Springs down at `at`, shakes a little when it lands (the mute icon wiggles), slides back
 * up at `out`. Suggested: at GIRO.PAY, out GIRO.MASK + 10.
 */
export const PayToast: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 12) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 13, stiffness: 160 });
  const k = leave(frame, out, 11);
  const sh = impact(frame, at + 6, 14, 12);
  const ty = 240 - (1 - p) * 440 - k * 500;
  const ding = bump(frame, at + 5, 10);
  const check = pop(frame, at + 7, { damping: 8, stiffness: 260 });
  return (
    <div style={{ position: "absolute", left: 60 + sh.x, top: ty + sh.y, width: 880, transform: `rotate(${sh.r * 0.6}deg)`, transformOrigin: "50% 0%", pointerEvents: "none" }}>
      <div
        style={{
          position: "relative",
          boxSizing: "border-box",
          borderRadius: 46,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(238,240,248,0.98) 100%)",
          border: "6px solid #FFFFFF",
          boxShadow: `0 0 0 5px ${K.ink}, 0 12px 0 5px rgba(0,0,0,0.3), 0 30px 60px rgba(0,0,0,0.35)`,
          padding: "22px 30px 24px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ position: "relative", flexShrink: 0, width: 112, height: 112 }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 30,
              background: "linear-gradient(160deg, #4BEA85 0%, #12A84F 100%)",
              boxShadow: `0 0 0 4px ${K.ink}, 0 0 ${20 * ding}px rgba(34,211,107,0.9)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CoinIcon size={78} spin={t < 12 ? t * 0.5 : 0} />
          </div>
          <div
            style={{
              position: "absolute",
              right: -14,
              bottom: -12,
              width: 48,
              height: 48,
              borderRadius: 24,
              background: K.green,
              border: "4px solid #FFFFFF",
              boxShadow: `0 0 0 3px ${K.ink}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${check})`,
            }}
          >
            <svg width={26} height={26} viewBox="0 0 26 26">
              <path d="M5 13.5 L11 19 L21 7" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontFamily: UI, fontSize: 30, lineHeight: 1, whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 900, letterSpacing: 3, color: K.greenDark }}>PAGO ENVIADO</span>
            <span style={{ fontWeight: 700, color: "#8A8D9C", marginLeft: 10 }}>· ahora</span>
          </div>
          <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 45, lineHeight: 1.1, color: "#22203A", marginTop: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
            <span>
              Pagaste <span style={{ fontWeight: 900, color: "#E3243A" }}>S/ 50</span> a Vecino
            </span>
            <span style={{ display: "inline-block", marginLeft: 14, transform: `rotate(${Math.sin(t * 0.5) * 10 * Math.max(0, 1 - t / 40)}deg)` }}>
              <MuteIcon size={50} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// 8. NightClock

/**
 * The montage clock badge in the top band (centre x 500, y 318; ~600 x 176, y 230-406): a sky
 * window where the sleepy moon sets and the sun rises, the time «11:00 P. M.» in big digits that
 * fly through the night to «9:00 A. M.» between `from` and `to` (eased: slow, racing, slow; the
 * minutes blur, each new hour rolls in, «P. M.» flips to «A. M.» at midnight), and ten little
 * coin slots that light up one per hour slept (S/ 100 each). The pill glows from night violet to
 * sunrise gold. Pops in at `at`, leaves at `out`. Suggested: at GIRO.MASK, from GIRO.MASK + 10,
 * to GIRO.MIL (or GIRO.RICO), out GIRO.OJOS - 4.
 */
export const NightClock: React.FC<{ frame: number; at: number; out: number; from: number; to: number }> = ({ frame, at, out, from, to }) => {
  const uid = useUid();
  if (frame < at || frame > out + 12) return null;
  const t = frame - at;
  const c = pop(frame, at, { damping: 12, stiffness: 190 });
  const k = leave(frame, out, 10);
  const prog = (f: number) => (to <= from ? (f >= to ? 1 : 0) : clamp01((f - from) / (to - from)));
  const lin = prog(frame);
  const e = EASE_IN_OUT(lin);
  const mins = 23 * 60 + 600 * e;
  const speed = 600 * (EASE_IN_OUT(prog(frame + 1)) - e);
  const total = Math.floor(mins + 1e-6);
  const h24 = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const h12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);
  const hourStr = (h: number) => {
    const v = h12(h);
    return v < 10 ? ` ${v}` : String(v);
  };
  // The next hour rolls in during the last 20 minutes of each hour.
  const frac = mins - Math.floor(mins / 60) * 60;
  const roll = lin > 0 && lin < 1 ? clamp01((frac - 40) / 20) : 0;
  const nextH = (h24 + 1) % 24;
  const curH = hourStr(h24);
  const nxtH = hourStr(nextH);
  const pm = h24 >= 12;
  const ampmK = h24 === 23 ? roll : 1;
  const ampmFrom = "P. M.";
  const ampmTo = pm && h24 !== 23 ? "P. M." : "A. M.";
  const hours = clamp01((mins - 23 * 60) / 600) * 10;
  const smear = clamp01((speed - 2) / 4);
  const F = 98;
  const CW = 0.64 * F;
  const sky0 = interpolateColors(lin, [0, 0.5, 0.78, 1], ["#1B1F66", "#2B2580", "#FF8E5E", "#79D2FF"]);
  const sky1 = interpolateColors(lin, [0, 0.5, 0.78, 1], ["#0C0E33", "#3A1E6E", "#FFC36B", "#BDEBFF"]);
  const rimC = interpolateColors(lin, [0, 0.6, 1], ["#B9A8FF", "#FFB36B", "#FFD84D"]);
  const glassC = interpolateColors(lin, [0, 0.6, 1], ["#221A5C", "#3D1F55", "#4A2A12"]);
  const moonY = 54 + 90 * EASE_IN(clamp01((lin - 0.3) / 0.4));
  const sunY = 150 - 96 * EASE_OUT(clamp01((lin - 0.62) / 0.38));
  const stars = 1 - clamp01((lin - 0.45) / 0.25);
  const ticked = (d: string, i: number) => d.charAt(i);
  return (
    <div
      style={{
        position: "absolute",
        left: 500,
        top: 318,
        transform: `translate(-50%, -50%) translateY(${(1 - c) * -60 - k * 60}px) scale(${(0.8 + 0.2 * c) * (1 - 0.15 * k)}) rotate(${Math.sin(t * 0.08) * 0.8}deg)`,
        opacity: Math.min(1, c * 2.5) * (1 - k),
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "16px 36px 16px 18px",
        borderRadius: 999,
        background: `linear-gradient(180deg, ${glassC} 0%, #0E0B26 100%)`,
        border: `6px solid ${rimC}`,
        boxShadow: `0 0 0 5px ${K.ink}, 0 12px 0 5px rgba(0,0,0,0.3), 0 0 34px ${hexA(K.lavender, 0.35)}`,
        fontFamily: UI,
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      {/* Sky window: the moon sets, the sun rises. */}
      <div style={{ position: "relative", width: 128, height: 128, flexShrink: 0, borderRadius: 64, overflow: "hidden", background: `linear-gradient(180deg, ${sky0} 0%, ${sky1} 100%)`, boxShadow: `0 0 0 4px ${K.ink}, inset 0 -10px 18px rgba(0,0,0,0.25)` }}>
        <svg width={128} height={128} viewBox="0 0 128 128" style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <radialGradient id={`ng${uid}`} cx="0.5" cy="1" r="0.8">
              <stop offset="0" stopColor="rgba(255,236,170,0.9)" />
              <stop offset="1" stopColor="rgba(255,236,170,0)" />
            </radialGradient>
          </defs>
          {[
            [24, 30, 3],
            [96, 22, 2.4],
            [70, 48, 2],
            [30, 70, 1.8],
            [104, 62, 2.6],
          ].map(([sx, sy, r], i) => (
            <circle key={i} cx={sx} cy={sy} r={r * (0.8 + 0.3 * Math.sin(frame * 0.3 + i))} fill="#FFFFFF" opacity={stars * 0.9} />
          ))}
          <rect x={0} y={60} width={128} height={68} fill={`url(#ng${uid})`} opacity={clamp01((lin - 0.55) / 0.3)} />
          <path d="M0 112 Q32 100 64 108 Q96 116 128 104 V128 H0 Z" fill="#1E3A5A" opacity={0.85} />
        </svg>
        <div style={{ position: "absolute", left: 22, top: moonY - 42, opacity: 1 - clamp01((lin - 0.62) / 0.12) }}>
          <MoonIcon size={84} />
        </div>
        <div style={{ position: "absolute", left: 18, top: sunY - 46 }}>
          <SunIcon size={92} frame={frame} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div style={{ display: "flex", fontWeight: 900, fontSize: F, height: F, lineHeight: 1, color: "#FFFFFF", textShadow: `0 0 18px ${hexA(K.lavender, 0.6)}, 0 4px 0 rgba(0,0,0,0.45)`, ...TAB }}>
            {[0, 1].map((i) => (
              <Reel key={i} from={ticked(curH, i)} to={roll > 0 ? ticked(nxtH, i) : ticked(curH, i)} k={roll > 0 ? roll : 1} w={CW} h={F} />
            ))}
            <span style={{ display: "inline-block", width: 0.3 * F, textAlign: "center", lineHeight: `${F * 0.92}px`, opacity: lin > 0 && lin < 1 ? 0.6 + 0.4 * blink(frame, 0, 4, 2) : 1 }}>:</span>
            {[0, 1].map((i) => (
              <Reel key={`m${i}`} from={pad2(mm).charAt(i)} to={pad2(mm).charAt(i)} k={1} w={CW} h={F} smear={i === 1 ? smear : smear * 0.5} />
            ))}
          </div>
          <div style={{ position: "relative", width: 112, height: 44, marginBottom: 12, fontWeight: 900, fontSize: 40, lineHeight: "44px", color: pm && h24 !== 23 ? K.lavender : "#FFD84D", overflow: "hidden" }}>
            {ampmK < 1 && h24 === 23 ? (
              <>
                <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${-ampmK * 44}px)`, color: K.lavender }}>{ampmFrom}</span>
                <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - ampmK) * 44}px)`, color: "#FFD84D" }}>A. M.</span>
              </>
            ) : (
              <span style={{ position: "absolute", left: 0, top: 0 }}>{h24 === 23 && roll <= 0 ? ampmFrom : ampmTo}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          {Array.from({ length: 10 }, (_, i) => {
            const lit = hours >= i + 1 - 1e-6;
            // A coin pops into its slot as its hour completes (overshoot, then settles).
            const pp = lit ? clamp01((hours - (i + 1)) * 2.5) : 0;
            return (
              <div key={i} style={{ width: 34, height: 34, position: "relative" }}>
                {lit ? (
                  <div style={{ transform: `scale(${1 + 0.45 * Math.sin(pp * Math.PI)})` }}>
                    <CoinIcon size={34} />
                  </div>
                ) : (
                  <div style={{ width: 28, height: 28, margin: 3, borderRadius: 14, border: "3px dashed rgba(255,255,255,0.35)", boxSizing: "border-box" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// 9. ChargesPhone

const CHARGES = [
  { label: "COLCHÓN", amount: 400, tint: "#E3F2FF" },
  { label: "SILENCIO", amount: 300, tint: "#EEF0F6" },
  { label: "COMIDA", amount: 300, tint: "#FFF0E2" },
];

/**
 * Nubi's phone banking app in the top band (x 150-850, y 250-760): a dark phone with a green
 * balance card «SALDO DISPONIBLE · S/ 1 000» and a list where three charges land one by one at
 * `charge1`, `charge2`, `charge3` (slide in from the right with a red flash): «COLCHÓN −S/ 400»,
 * «SILENCIO −S/ 300», «COMIDA −S/ 300». At each charge the balance counts down (1 000 -> 600 ->
 * 300 -> 0) and a winged banknote flies off. At `zeroAt` the card turns red, «S/ 0» shakes and
 * flashes. Drops in at `at`, leaves upward at `out`. Charges can be as close as 8 frames apart.
 * Suggested: at GIRO.OJOS + 8, charge1..3 GIRO.CHARGE1..3, zeroAt GIRO.ZERO, out GIRO.END - 8.
 */
export const ChargesPhone: React.FC<{ frame: number; at: number; out: number; charge1: number; charge2: number; charge3: number; zeroAt: number }> = ({
  frame,
  at,
  out,
  charge1,
  charge2,
  charge3,
  zeroAt,
}) => {
  if (frame < at || frame > out + 12) return null;
  const ats = [charge1, charge2, charge3];
  const p = pop(frame, at, { damping: 13, stiffness: 170, mass: 0.8 });
  const k = leave(frame, out, 10);
  const ROLL = 6;
  const bal = 1000 - CHARGES.reduce((acc, ch, i) => acc + ch.amount * ramp(frame, ats[i], ats[i] + ROLL, [0, 1], EASE_OUT), 0);
  const rolling = ats.some((a) => frame >= a && frame < a + ROLL);
  const isZero = frame >= zeroAt;
  const zeroP = isZero ? pop(frame, zeroAt, { damping: 8, stiffness: 260 }) : 0;
  let sx = 0;
  let sy = 0;
  ats.forEach((a) => {
    const im = impact(frame, a, 7, 8);
    sx += im.x;
    sy += im.y;
  });
  const zsh = impact(frame, zeroAt, 26, 18);
  const flash = isZero ? blink(frame, zeroAt, 4, 3) : 0;
  const punch = ats.reduce((m, a) => Math.max(m, bump(frame, a + ROLL - 2, 6)), 0);
  const balText = `S/ ${fmtSoles(Math.round(bal / 10) * 10)}`;
  const cardBg = isZero ? (flash ? "linear-gradient(160deg, #FF5A6A 0%, #E3243A 55%, #A80F22 100%)" : "linear-gradient(160deg, #E8384B 0%, #C41A2F 55%, #8E0B1C 100%)") : "linear-gradient(160deg, #3FE07F 0%, #17B85A 55%, #0B8A43 100%)";
  const flyers: React.ReactNode[] = [];
  ats.forEach((a, i) => {
    const d = frame - a;
    if (d < 0 || d > 24) return;
    for (let j = 0; j < 2; j++) {
      const q = d / 24;
      const fx = 520 + (j ? 60 : -40) + q * (j ? 260 : 180);
      const fy = 120 - q * (j ? 300 : 240) + Math.sin(d * 0.6 + j) * 8;
      flyers.push(
        <div key={`${i}-${j}`} style={{ position: "absolute", left: fx, top: fy, opacity: q > 0.7 ? (1 - q) / 0.3 : 1, transform: `translate(-50%, -50%) scale(${0.6 + 0.5 * q}) rotate(${(j ? 14 : -10) + q * 20}deg)` }}>
          <MoneyWingsIcon size={96} frame={frame + j * 5} />
        </div>,
      );
    }
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 150 + sx + zsh.x,
        top: 250 + sy + zsh.y,
        width: 700,
        height: 510,
        transform: `translateY(${(1 - p) * -560 - k * 640}px) rotate(${-1.5 * (1 - p) + zsh.r * 0.5}deg)`,
        opacity: Math.min(1, p * 2) * (1 - k),
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: 64, background: "linear-gradient(180deg, #2A2547 0%, #14112A 100%)", boxShadow: SHADOW, padding: 14 }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 52, background: "#F3F5FB", overflow: "hidden" }}>
          {/* Status bar. */}
          <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", fontFamily: UI, fontWeight: 800, fontSize: 26, color: "#22203A" }}>
            <span style={{ ...TAB }}>9:01</span>
            <div style={{ width: 120, height: 30, borderRadius: 15, background: "#14112A" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 6, height: 8 + i * 5, borderRadius: 2, background: "#22203A" }} />
              ))}
              <div style={{ width: 40, height: 20, marginLeft: 6, borderRadius: 5, border: "3px solid #22203A", boxSizing: "border-box", padding: 2 }}>
                <div style={{ width: "40%", height: "100%", borderRadius: 2, background: K.red }} />
              </div>
            </div>
          </div>
          {/* Balance card. */}
          <div
            style={{
              position: "relative",
              margin: "4px 18px 0",
              height: 178,
              borderRadius: 36,
              background: cardBg,
              boxShadow: `0 0 0 4px ${K.ink}, 0 7px 0 4px rgba(0,0,0,0.2)${isZero && flash ? `, 0 0 40px ${hexA(K.red, 0.9)}` : ""}`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 34px",
            }}
          >
            <div style={{ position: "absolute", right: -40, top: -60, width: 240, height: 240, borderRadius: 120, background: "rgba(255,255,255,0.12)" }} />
            <div style={{ position: "absolute", right: 60, bottom: -90, width: 180, height: 180, borderRadius: 90, background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "relative", fontFamily: UI, fontWeight: 900, fontSize: 28, letterSpacing: 3, color: "rgba(255,255,255,0.9)" }}>SALDO DISPONIBLE</div>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginTop: 6,
                transform: `scale(${1 + 0.06 * punch + 0.18 * (isZero ? Math.max(0, 1 - zeroP) + bump(frame, zeroAt, 8) : 0)})`,
                transformOrigin: "0% 50%",
              }}
            >
              <div
                style={{
                  fontFamily: UI,
                  fontWeight: 900,
                  fontSize: 104,
                  lineHeight: 1,
                  color: "#FFFFFF",
                  whiteSpace: "nowrap",
                  textShadow: `0 5px 0 rgba(0,0,0,0.25)${rolling ? ", 0 -8px 2px rgba(255,255,255,0.35), 0 10px 2px rgba(255,255,255,0.25)" : ""}`,
                  ...TAB,
                }}
              >
                {balText}
              </div>
              {isZero ? (
                <div style={{ transform: `scale(${zeroP}) rotate(${jit(frame, 2, 2) * 8}deg)` }}>
                  <CrossIcon size={74} color="#FFFFFF" />
                </div>
              ) : null}
            </div>
          </div>
          {/* Charges. */}
          <div style={{ position: "relative", margin: "16px 18px 0", display: "flex", flexDirection: "column", gap: 9 }}>
            {CHARGES.map((ch, i) => {
              const a = ats[i];
              const rp = frame >= a ? pop(frame, a, { damping: 12, stiffness: 240 }) : 0;
              const fl = frame >= a ? 1 - ramp(frame, a, a + 12) : 0;
              const icon = i === 0 ? <MattressIcon size={48} /> : i === 1 ? <MuteIcon size={46} /> : <BowlIcon size={48} frame={frame} />;
              return (
                <div
                  key={ch.label}
                  style={{
                    height: 76,
                    borderRadius: 24,
                    background: frame >= a ? (fl > 0.05 ? `rgba(255,${Math.round(220 - 90 * fl)},${Math.round(225 - 95 * fl)},1)` : "#FFFFFF") : "rgba(255,255,255,0)",
                    boxShadow: frame >= a ? "0 3px 0 rgba(26,18,51,0.12), 0 0 0 2px rgba(26,18,51,0.06)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    padding: "0 26px 0 12px",
                    transform: `translateX(${(1 - rp) * 640}px)`,
                    opacity: frame >= a ? 1 : 0,
                  }}
                >
                  <div style={{ width: 58, height: 58, borderRadius: 18, background: ch.tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, fontFamily: UI, fontWeight: 900, fontSize: 38, color: "#22203A", letterSpacing: 0.5 }}>{ch.label}</div>
                  <div style={{ fontFamily: UI, fontWeight: 900, fontSize: 42, color: "#E3243A", whiteSpace: "nowrap", ...TAB }}>−S/ {ch.amount}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {flyers}
    </div>
  );
};

// =============================================================================================
// 10. EndText

/**
 * The end text over the last shot (not an opaque card: the video loops back to its start). In the
 * top band (y 245-600): «¿CUÁNTO GANARÍAS» in big white letters over «DURMIENDO?» in gold on the
 * money-green bar (like the title) with bobbing Zs and a flapping banknote (💤💸), and a white
 * pill «Comenta tus horas 👇» with a bouncing hand. A soft dark scrim keeps it readable. Lands
 * within ~12 frames of `at` and stays to the end. Suggested: at FINAL.CARD.
 */
export const EndText: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  if (frame < at) return null;
  const t = frame - at;
  const scrim = ramp(frame, at, at + 8);
  const p1 = pop(frame, at, { damping: 10, stiffness: 210 });
  const p2 = pop(frame, at + 4, { damping: 10, stiffness: 210 });
  const sw = ramp(frame, at + 3, at + 10, [0, 1], EASE_OUT);
  const ic = pop(frame, at + 8, { damping: 9, stiffness: 200 });
  const cp = pop(frame, at + 10, { damping: 10, stiffness: 220 });
  const hop = Math.abs(Math.sin(t * 0.22)) * 10;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: -20,
          top: 170,
          width: 1080,
          height: 500,
          background: "radial-gradient(closest-side, rgba(16,10,40,0.56), rgba(16,10,40,0.3) 62%, rgba(16,10,40,0))",
          opacity: scrim,
        }}
      />
      <div style={{ position: "absolute", left: 500, top: 316, transform: `translate(-50%, -50%) scale(${p1}) rotate(${-2 + Math.sin(t * 0.07) * 0.6}deg)`, opacity: Math.min(1, p1 * 3) }}>
        <div style={{ position: "relative", paddingTop: 88 * 0.06 }}>
          <HeavyText text="¿CUÁNTO GANARÍAS" size={88} colors={TXT_WHITE} stroke={K.ink} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 500, top: 440, transform: `translate(-50%, -50%) scale(${p2}) rotate(${1.5 + Math.sin(t * 0.07 + 1.3) * 0.6}deg)`, opacity: Math.min(1, p2 * 3), display: "flex", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: -28,
              right: -28,
              top: -12,
              bottom: -10,
              borderRadius: 22,
              background: "linear-gradient(180deg, #4BEA85 0%, #1FBF5F 48%, #0B8F43 100%)",
              border: "6px solid #FFFFFF",
              boxShadow: `0 0 0 5px ${K.ink}, 0 10px 0 5px rgba(0,0,0,0.3)`,
              transform: `scaleX(${sw}) rotate(-1.2deg)`,
              transformOrigin: "0% 50%",
            }}
          />
          <div style={{ position: "relative", paddingTop: 100 * 0.06 }}>
            <HeavyText text="DURMIENDO?" size={100} colors={TXT_GOLD} stroke={K.ink} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginLeft: 40, gap: 4, transform: `scale(${ic})` }}>
          <div style={{ transform: `translateY(-16px) rotate(${Math.sin(t * 0.1) * 6}deg)` }}>
            <ZzzIcon size={88} frame={frame} />
          </div>
          <div style={{ transform: `translateY(${Math.sin(t * 0.16) * 6}px)` }}>
            <MoneyWingsIcon size={100} frame={frame} />
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 500,
          top: 566,
          transform: `translate(-50%, -50%) scale(${cp})`,
          opacity: Math.min(1, cp * 3),
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 26px 12px 34px",
          borderRadius: 999,
          background: "#FFFFFF",
          boxShadow: SHADOW_SM,
          fontFamily: UI,
          fontWeight: 900,
          fontSize: 42,
          lineHeight: 1,
          color: K.ink,
          whiteSpace: "nowrap",
        }}
      >
        Comenta tus horas
        <div style={{ transform: `translateY(${hop - 4}px)` }}>
          <PointDownIcon size={56} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
