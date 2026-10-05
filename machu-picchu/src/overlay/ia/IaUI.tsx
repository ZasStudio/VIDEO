import React from "react";
import { AbsoluteFill } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, rand } from "../../anim";
import { FONT } from "../../theme";
import { HeavyText } from "../inca/HeavyText";
import { CommentBubbleIcon, HandPointer } from "../inca/icons";

// 2D overlays for "¿Qué pasaría si la IA no existiera?" (1080 x 1920, 30 fps). A bright, clean
// phone-UI look: white rounded cards with soft shadows, Montserrat 700-900 for the UI text and
// Luckiest Guy (HeavyText) for the big punchy stickers, a violet -> cyan gradient for the
// generic "Asistente IA" (sparkle icon, no real brand), blue chat bubbles for the boy, grey for
// her. Everything is driven by the global `frame` plus explicit cue frames: no timers, no
// Math.random (`rand`), no CSS animations. Emoji in any text (💙 ❤️ 👀 📚 💼 💌 ☀️ 💬 ✨) are drawn
// as inline SVG icons (RichText), so they never depend on an emoji font in the renderer.
// TikTok safe zone: content inside x 60-940, y 230-1180 (top bar above y 200, the button column
// right of x 940 from y 700, captions at y 1210-1400). Every component enters with a pop /
// slide / typewriter at `at` and is gone ~10 frames after `out`.

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

/** The short's palette. */
export const IA_COLORS = {
  ink: "#151A2D",
  sub: "#6B7387",
  line: "#E3E7EF",
  paper: "#F4F6FB",
  violet: "#7C4DFF",
  cyan: "#22C3FF",
  blue: "#2F7BFF",
  pink: "#FF4F9A",
  red: "#FF3B4E",
  green: "#22C55E",
  yellow: "#FFD23F",
  orange: "#FF8A1F",
} as const;
const K = IA_COLORS;
const UI = FONT.heavy;
const AI_GRAD = "linear-gradient(135deg, #8A5CFF 0%, #5B6CFF 50%, #22C3FF 100%)";
const BOY_GRAD = "linear-gradient(160deg, #4B91FF 0%, #2F6BFF 100%)";
const CARD_SHADOW = "0 22px 48px rgba(16,20,40,0.30), 0 6px 14px rgba(16,20,40,0.18)";
const SOFT_SHADOW = "0 10px 24px rgba(16,20,40,0.22), 0 3px 6px rgba(16,20,40,0.14)";
const TAB: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };
const TXT_WHITE = ["#FFFFFF", "#FFFFFF", "#E4E6F2"];
const TXT_GOLD = ["#FFFBD1", "#FFD21F", "#FF9500"];

// =============================================================================================
// Helpers

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
const bump = (frame: number, at: number, dur: number) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

/** Square-wave blink: 1 for `on` frames, 0 for `off` frames, starting at `from`. */
const blink = (frame: number, from: number, on = 8, off = 7) => {
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

/** Pattern lookup: the value for frame `frame - at` (0 before, `after` past the end). */
const pattern = (frame: number, at: number, seq: number[], after: number) => {
  const d = Math.floor(frame - at);
  if (d < 0) return 0;
  return d < seq.length ? seq[d] : after;
};

/** The first characters of `text` typed linearly between `from` and `to`. */
const typedText = (text: string, frame: number, from: number, to: number) => {
  const chars = Array.from(text);
  const k = to <= from ? (frame >= from ? 1 : 0) : clamp01((frame - from) / (to - from));
  return chars.slice(0, Math.round(k * chars.length)).join("");
};

/** The first characters of `text` streamed at `cps` characters per frame from `from`. */
const streamed = (text: string, frame: number, from: number, cps: number) => {
  const chars = Array.from(text);
  const n = Math.max(0, Math.floor((frame - from) * cps));
  return { text: chars.slice(0, n).join(""), done: n >= chars.length };
};

/** 98432 -> "98 432". */
const fmtThousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** Standard card entrance (springy pop up) and exit (shrink + lift + fade). */
const cardIn = (frame: number, at: number, out: number, dist = 70) => {
  const p = pop(frame, at, { damping: 13, stiffness: 170, mass: 0.8 });
  const k = leave(frame, out);
  return {
    p,
    k,
    opacity: clamp01(p * 2.5) * (1 - k),
    transform: `translateY(${(1 - p) * dist - k * 50}px) scale(${(0.84 + 0.16 * p) * (1 - 0.1 * k)})`,
  };
};

// =============================================================================================
// Icons

type IconProps = { size?: number; style?: React.CSSProperties };

const BIG_STAR = "M46 14 C49 40 55 46 82 50 C55 54 49 60 46 86 C43 60 37 54 10 50 C37 46 43 40 46 14 Z";
const SMALL_STAR = "M80 4 C81.3 14 84 16.7 94 18 C84 19.3 81.3 22 80 32 C78.7 22 76 19.3 66 18 C76 16.7 78.7 14 80 4 Z";
const TINY_STAR = "M82 71 C82.8 77 85 79.2 91 80 C85 80.8 82.8 83 82 89 C81.2 83 79 80.8 73 80 C79 79.2 81.2 77 82 71 Z";

/**
 * The generic "Asistente IA" sparkle (a big four-point star and two small ones, violet -> cyan
 * gradient). `crossed` adds a red "no" circle and slash, `sad` turns it grey with a drooping
 * frown and a tear, `color` "white" for use on the gradient, `frame` makes the small star twinkle.
 */
export const SparkleIcon: React.FC<IconProps & { crossed?: boolean; sad?: boolean; color?: "ai" | "white" | "grey"; frame?: number }> = ({
  size = 100,
  crossed = false,
  sad = false,
  color,
  frame,
  style,
}) => {
  const uid = useUid();
  const c = color ?? (sad ? "grey" : "ai");
  const stops = c === "ai" ? ["#C9A9FF", "#7C4DFF", "#22C3FF"] : c === "grey" ? ["#E4E8F0", "#AEB6C7", "#7F899D"] : ["#FFFFFF", "#FFFFFF", "#E6E9FF"];
  const tw = frame === undefined ? 1 : 0.75 + 0.25 * Math.sin(frame * 0.3);
  const tw2 = frame === undefined ? 1 : 0.75 + 0.25 * Math.sin(frame * 0.3 + 2);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <linearGradient id={`sg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <g transform={sad ? "rotate(14 46 50)" : undefined}>
        <path d={BIG_STAR} fill={`url(#sg${uid})`} />
        <path d="M46 24 C47.5 38 50 42 58 45" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" opacity={c === "white" ? 0 : 0.55} />
      </g>
      <g transform={`translate(80 18) scale(${tw}) translate(-80 -18)`}>
        <path d={SMALL_STAR} fill={`url(#sg${uid})`} opacity={sad ? 0.6 : 1} />
      </g>
      <g transform={`translate(82 80) scale(${tw2}) translate(-82 -80)`}>
        <path d={TINY_STAR} fill={`url(#sg${uid})`} opacity={sad ? 0.5 : 1} />
      </g>
      {sad ? (
        <g transform="rotate(14 46 50)">
          <circle cx={39} cy={47} r={3.6} fill={K.ink} />
          <circle cx={53} cy={47} r={3.6} fill={K.ink} />
          <path d="M38.5 61 Q46 54.5 53.5 61" stroke={K.ink} strokeWidth={3.4} strokeLinecap="round" fill="none" />
          <path d="M37 52 Q34 58 37 60 Q40 58 37 52 Z" fill="#5BB8FF" />
        </g>
      ) : null}
      {crossed ? (
        <g>
          <circle cx={50} cy={50} r={46} fill="none" stroke="#FFFFFF" strokeWidth={15} opacity={0.9} />
          <circle cx={50} cy={50} r={46} fill="none" stroke={K.red} strokeWidth={9} />
          <path d="M18 18 L82 82" stroke="#FFFFFF" strokeWidth={15} strokeLinecap="round" opacity={0.9} />
          <path d="M18 18 L82 82" stroke={K.red} strokeWidth={9} strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
};

/** Glossy heart (100 x 100 box). */
export const HeartIcon: React.FC<IconProps & { color?: string; outline?: string }> = ({ size = 100, color = "#FF3B5C", outline, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <path
      d="M50 90 C22 70 6 54 6 33 C6 18 17 8 31 8 C40 8 47 13 50 21 C53 13 60 8 69 8 C83 8 94 18 94 33 C94 54 78 70 50 90 Z"
      fill={color}
      stroke={outline}
      strokeWidth={outline ? 9 : 0}
      paintOrder="stroke"
    />
    <ellipse cx={27} cy={29} rx={10} ry={6.5} transform="rotate(-38 27 29)" fill="#FFFFFF" opacity={0.55} />
  </svg>
);

/** Two big cartoon eyes (120 x 80 box at size 120); `look` -1..1 moves the pupils sideways. */
export const EyesIcon: React.FC<IconProps & { look?: number }> = ({ size = 120, look = 0.6, style }) => (
  <svg width={size} height={(size * 80) / 120} viewBox="0 0 120 80" style={{ display: "block", overflow: "visible", ...style }}>
    {[32, 88].map((cx) => (
      <g key={cx}>
        <ellipse cx={cx} cy={40} rx={25} ry={34} fill="#FFFFFF" stroke={K.ink} strokeWidth={5} />
        <circle cx={cx + look * 10} cy={47} r={12.5} fill={K.ink} />
        <circle cx={cx + look * 10 + 4} cy={42} r={4} fill="#FFFFFF" />
      </g>
    ))}
  </svg>
);

/** A stack of three books (📚). */
export const BooksIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <rect x={10} y={68} width={80} height={20} rx={4} fill="#FF5A4E" stroke={K.ink} strokeWidth={4} />
    <rect x={74} y={72} width={12} height={12} rx={2} fill="#FFF4E0" />
    <rect x={16} y={47} width={70} height={20} rx={4} fill="#3B82F6" stroke={K.ink} strokeWidth={4} />
    <rect x={20} y={51} width={12} height={12} rx={2} fill="#FFF4E0" />
    <g transform="rotate(-9 52 34)">
      <rect x={20} y={24} width={64} height={20} rx={4} fill="#FFC83D" stroke={K.ink} strokeWidth={4} />
      <rect x={68} y={28} width={12} height={12} rx={2} fill="#FFF4E0" />
      <path d="M30 34 H58" stroke="#B9801A" strokeWidth={3} strokeLinecap="round" />
    </g>
  </svg>
);

/** Brown briefcase (💼). */
export const BriefcaseIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <path d="M36 32 V23 Q36 16 43 16 H57 Q64 16 64 23 V32" stroke={K.ink} strokeWidth={7} fill="none" />
    <path d="M36 32 V23 Q36 16 43 16 H57 Q64 16 64 23 V32" stroke="#7A4520" strokeWidth={3} fill="none" />
    <rect x={9} y={31} width={82} height={58} rx={11} fill="#B06A2E" stroke={K.ink} strokeWidth={4.5} />
    <rect x={11} y={52} width={78} height={7} fill="#86491C" />
    <rect x={43} y={47} width={14} height={16} rx={3} fill="#FFC83D" stroke={K.ink} strokeWidth={3} />
    <path d="M17 39 H40" stroke="#D99257" strokeWidth={4} strokeLinecap="round" />
  </svg>
);

/** Envelope with a heart seal (💌). */
export const LetterIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <rect x={7} y={22} width={86} height={62} rx={9} fill="#FFFFFF" stroke={K.ink} strokeWidth={4.5} />
    <path d="M9 26 L50 58 L91 26" fill="#FFE1EE" stroke={K.ink} strokeWidth={4.5} strokeLinejoin="round" />
    <path d="M9 82 L38 52 M91 82 L62 52" stroke="#E3C2D2" strokeWidth={3} />
    <path d="M50 70 C40 63 36 58 36 52 C36 47 40 44 44 44 C47 44 49 46 50 48 C51 46 53 44 56 44 C60 44 64 47 64 52 C64 58 60 63 50 70 Z" fill="#FF3B5C" stroke={K.ink} strokeWidth={3} />
  </svg>
);

/** Morning sun (☀️). */
export const SunIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <g transform={`rotate(${frame * 1.5} 50 50)`}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <path
            key={i}
            d={`M${50 + Math.cos(a) * 33} ${50 + Math.sin(a) * 33} L${50 + Math.cos(a) * 46} ${50 + Math.sin(a) * 46}`}
            stroke="#FFB703"
            strokeWidth={8}
            strokeLinecap="round"
          />
        );
      })}
    </g>
    <circle cx={50} cy={50} r={25} fill="#FFD23F" stroke="#FF9F1C" strokeWidth={4} />
    <ellipse cx={42} cy={41} rx={8} ry={5} transform="rotate(-35 42 41)" fill="#FFFFFF" opacity={0.6} />
  </svg>
);

/** Red coffee mug with steam (`frame` waves the steam). */
export const CoffeeIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const w = Math.sin(frame * 0.3) * 3;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      {[34, 50, 66].map((x, i) => (
        <path
          key={x}
          d={`M${x - 4} 30 C${x + 6 + w} 22 ${x - 10 - w} 14 ${x + (i === 1 ? 2 : -2)} 4`}
          stroke="#B8C0D0"
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />
      ))}
      <path d="M72 46 Q90 46 90 58 Q90 72 70 72" stroke={K.ink} strokeWidth={8} fill="none" />
      <path d="M72 46 Q90 46 90 58 Q90 72 70 72" stroke="#FF5A4E" strokeWidth={3.5} fill="none" />
      <path d="M16 36 H76 V70 Q76 90 56 90 H36 Q16 90 16 70 Z" fill="#FF5A4E" stroke={K.ink} strokeWidth={4.5} strokeLinejoin="round" />
      <ellipse cx={46} cy={37} rx={27} ry={5} fill="#6B3E1F" />
      <path d="M24 46 V68" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.5} />
    </svg>
  );
};

/** Blue "verified" rosette with a white tick. */
export const VerifiedIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    {Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return <circle key={i} cx={50 + Math.cos(a) * 34} cy={50 + Math.sin(a) * 34} r={15} fill="#2F9BFF" />;
    })}
    <circle cx={50} cy={50} r={36} fill="#2F9BFF" />
    <path d="M31 51 L45 64 L70 37" stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** Red alarm clock showing `h`:`m` (hands); `ring` 0..1 shakes the bells. */
export const AlarmClockIcon: React.FC<IconProps & { h?: number; m?: number; ring?: number; frame?: number }> = ({
  size = 100,
  h = 11,
  m = 58,
  ring = 0,
  frame = 0,
  style,
}) => {
  const wob = ring * Math.sin(frame * 2.2) * 9;
  const ha = ((h % 12) + m / 60) * 30;
  const ma = m * 6;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", transform: `rotate(${wob}deg)`, ...style }}>
      <path d="M30 86 L22 96 M70 86 L78 96" stroke={K.ink} strokeWidth={6} strokeLinecap="round" />
      <circle cx={23} cy={21} r={13} fill="#FFD23F" stroke={K.ink} strokeWidth={4.5} />
      <circle cx={77} cy={21} r={13} fill="#FFD23F" stroke={K.ink} strokeWidth={4.5} />
      <circle cx={50} cy={56} r={36} fill={K.red} stroke={K.ink} strokeWidth={5} />
      <circle cx={50} cy={56} r={27} fill="#FFFFFF" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={50 + Math.sin(a) * 22} cy={56 - Math.cos(a) * 22} r={i % 3 === 0 ? 2.4 : 1.4} fill={K.ink} />;
      })}
      <path d={`M50 56 L${50 + Math.sin((ha * Math.PI) / 180) * 13} ${56 - Math.cos((ha * Math.PI) / 180) * 13}`} stroke={K.ink} strokeWidth={5} strokeLinecap="round" />
      <path d={`M50 56 L${50 + Math.sin((ma * Math.PI) / 180) * 20} ${56 - Math.cos((ma * Math.PI) / 180) * 20}`} stroke={K.ink} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={50} cy={56} r={3.5} fill={K.red} />
    </svg>
  );
};

/** Send arrow for the chat input (white, on a coloured circle drawn by the caller). */
const SendArrow: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
    <path d="M50 76 V26 M28 46 L50 24 L72 46" stroke="#FFFFFF" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** Rewind glyph ◀◀ (two triangles). */
const RewindGlyph: React.FC<{ size: number; color?: string }> = ({ size, color = "#FFFFFF" }) => (
  <svg width={size * 1.4} height={size} viewBox="0 0 140 100" style={{ display: "block", overflow: "visible" }}>
    <path d="M66 12 L66 88 L8 50 Z M132 12 L132 88 L74 50 Z" fill={color} />
  </svg>
);

// =============================================================================================
// RichText: text with emoji drawn as SVG

const EMOJI_RE = /(💙|❤️|❤|👀|📚|💼|💌|☀️|☀|💬|✨)/u;

const EmojiGlyph: React.FC<{ ch: string; size: number; light?: boolean }> = ({ ch, size, light }) => {
  switch (ch) {
    case "💙":
      return <HeartIcon size={size} color="#3B82F6" outline={light ? "#FFFFFF" : undefined} />;
    case "❤️":
    case "❤":
      return <HeartIcon size={size} outline={light ? "#FFFFFF" : undefined} />;
    case "👀":
      return <EyesIcon size={size * 1.25} />;
    case "📚":
      return <BooksIcon size={size} />;
    case "💼":
      return <BriefcaseIcon size={size} />;
    case "💌":
      return <LetterIcon size={size} />;
    case "☀️":
    case "☀":
      return <SunIcon size={size} />;
    case "💬":
      return <CommentBubbleIcon size={size} />;
    case "✨":
      return <SparkleIcon size={size} />;
    default:
      return <>{ch}</>;
  }
};

/**
 * Text with its emoji (💙 ❤️ 👀 📚 💼 💌 ☀️ 💬 ✨) replaced by inline SVG icons of `size` px (about
 * the font size). Works inside any styled text block (wraps like text). `light`: hearts get a
 * white outline (for text on blue bubbles).
 */
export const RichText: React.FC<{ text: string; size: number; light?: boolean }> = ({ text, size, light }) => {
  const parts = text.split(EMOJI_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={{ display: "inline-block", verticalAlign: `${-size * 0.16}px`, margin: `0 ${size * 0.06}px`, lineHeight: 0 }}>
            <EmojiGlyph ch={p} size={size} light={light} />
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
};

/** Three hopping grey dots ("escribiendo…"). */
const TypingDots: React.FC<{ frame: number; color?: string; size?: number }> = ({ frame, color = "#9AA2B5", size = 14 }) => (
  <div style={{ display: "flex", gap: size * 0.6, alignItems: "center", height: size * 2 }}>
    {[0, 1, 2].map((i) => {
      const hop = Math.max(0, Math.sin(frame * 0.32 - i * 0.9));
      return (
        <div
          key={i}
          style={{ width: size, height: size, borderRadius: size, background: color, opacity: 0.55 + 0.45 * hop, transform: `translateY(${-hop * size * 0.45}px)` }}
        />
      );
    })}
  </div>
);

/** Blinking text caret. */
const Caret: React.FC<{ frame: number; color?: string; h: number; solid?: boolean }> = ({ frame, color = K.blue, h, solid }) => (
  <span
    style={{
      display: "inline-block",
      width: Math.max(3, h * 0.08),
      height: h,
      marginLeft: 3,
      verticalAlign: `${-h * 0.18}px`,
      borderRadius: 2,
      background: color,
      opacity: solid || blink(frame, 0, 9, 7) ? 1 : 0,
    }}
  />
);

// =============================================================================================
// 1. LoveMessage

const LOVE_PARAS = [
  "Mi amor 💙",
  "Desde que la luna aprendió tu nombre, las estrellas me piden permiso para brillar. Eres el primer pensamiento de mi mañana y el último suspiro de mi noche. ❤️",
  "Si cada vez que pienso en ti cayera una flor, el mundo sería un jardín infinito y los jardineros ya habrían renunciado. 💙",
  "Te extraño como el lunes extraña al viernes, como el café extraña a la mañana, como el wifi extraña a la señal. ❤️❤️",
  "Tu sonrisa es mi canción favorita, tu voz mi melodía y tus «ok» mi poesía preferida. 💙",
  "Prometo quererte más que ayer y menos que mañana, por los siglos de los siglos… ❤️",
  "(continúa en el próximo párrafo) 💙",
];

/**
 * The girl's phone (GANCHO, the first shot): a big chat card (x 90-910, y 260-760) from
 * "Mati 💙" (avatar, "en línea") holding ONE absurdly long romantic message (paragraphs of cheesy
 * poetry with hearts) that scrolls up fast, faster and faster, while a tiny scroll thumb races
 * down the track; a pill at the bottom reads "Mensaje de 1 párrafo… de 47 · 14 min de lectura".
 * Pops in at `at`, leaves at `out` (~9 frames). Suggested: at GANCHO.START, out GANCHO.TYPE - 4.
 */
export const LoveMessage: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 10) return null;
  const c = cardIn(frame, at, out, 50);
  const t = Math.max(0, frame - at - 2);
  const scroll = 54 * t - 160 * (1 - Math.exp(-t / 3));
  const thumbK = clamp01(scroll / 4200);
  const blocks = [0, 1, 2, 3, 4];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 260,
          width: 820,
          height: 500,
          borderRadius: 44,
          background: "#FFFFFF",
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
          opacity: c.opacity,
          transform: c.transform,
          fontFamily: UI,
        }}
      >
        {/* Header */}
        <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 104, display: "flex", alignItems: "center", gap: 18, padding: "0 30px", borderBottom: `2px solid ${K.line}`, background: "#FFFFFF", zIndex: 2 }}>
          <svg width={26} height={40} viewBox="0 0 26 40">
            <path d="M20 4 L6 20 L20 36" stroke={K.blue} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div style={{ width: 70, height: 70, borderRadius: 70, background: "linear-gradient(140deg, #6FB1FF, #2F6BFF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontWeight: 900, fontSize: 36 }}>M</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontWeight: 900, fontSize: 40, color: K.ink, lineHeight: 1 }}>
              <RichText text="Mati 💙" size={36} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 24, color: K.green, lineHeight: 1 }}>en línea</div>
          </div>
        </div>
        {/* The endless message */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 104, bottom: 0, background: K.paper, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 28, width: 700, top: 24, transform: `translateY(${-scroll}px)` }}>
            <div style={{ background: "#FFFFFF", borderRadius: 34, borderTopLeftRadius: 10, padding: "26px 32px", boxShadow: "0 3px 8px rgba(16,20,40,0.08)" }}>
              {blocks.map((b) =>
                LOVE_PARAS.map((p, i) => (
                  <div key={`${b}-${i}`} style={{ fontWeight: i === 0 ? 900 : 700, fontSize: i === 0 ? 38 : 32, lineHeight: 1.38, color: K.ink, marginBottom: 22 }}>
                    <RichText text={p} size={i === 0 ? 36 : 30} />
                  </div>
                )),
              )}
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: `linear-gradient(180deg, rgba(244,246,251,0), ${K.paper} 80%)` }} />
          {/* Scroll bar */}
          <div style={{ position: "absolute", right: 14, top: 18, bottom: 18, width: 10, borderRadius: 10, background: "rgba(21,26,45,0.08)" }}>
            <div style={{ position: "absolute", left: 0, width: 10, height: 34, borderRadius: 10, background: K.blue, top: `${thumbK * 92}%`, boxShadow: "0 0 10px rgba(47,123,255,0.6)" }} />
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 22,
              transform: `translateX(-50%) scale(${pop(frame, at + 6)})`,
              padding: "12px 26px",
              borderRadius: 999,
              background: K.ink,
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 26,
              whiteSpace: "nowrap",
              boxShadow: SOFT_SHADOW,
            }}
          >
            1 mensaje · <span style={{ color: K.yellow, ...TAB }}>14 min</span> de lectura
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// 2. AIChat

const DEFAULT_REPLY =
  "¡Claro! 💙 «Desde que no te veo, el sol sale por compromiso y la luna me pregunta por ti. Te extraño con la intensidad justa para no parecer intenso, pero con el corazón entero…» ✨";

/**
 * The generic "Asistente IA" chat window (x 80-920, y `y` … y + 640; default y 260): gradient
 * header with the sparkle icon, "Asistente IA" and "en línea"; a greeting bubble; an input bar
 * where `prompt` is typed with a typewriter between `typeFrom` and `typeTo` (caret blinking);
 * at `sendAt` the send button pulses and the prompt flies up as the user's blue bubble. With
 * `replyAt`: the AI's "escribiendo" dots from sendAt + 6, then at `replyAt` its reply bubble
 * streams `reply` at `replyCps` characters per frame (a reply ending in "…" keeps its dots
 * pulsing once streamed, e.g. «Analizando tus opciones de almuerzo…»). Pops in at `at`, leaves
 * at `out` (~9 frames).
 * Hook: prompt «Dile que la extraño, pero sin parecer intenso», at GANCHO.TYPE, typeFrom
 * GANCHO.TYPE + 4, typeTo GANCHO.SEND - 4, sendAt GANCHO.SEND, replyAt GANCHO.SEND + 8 (the
 * default reply is a cheesy poem), out GANCHO.NUBI - 2.
 * Late gag: prompt «¿Qué almuerzo?», reply «Analizando tus opciones de almuerzo…».
 */
export const AIChat: React.FC<{
  frame: number;
  at: number;
  out: number;
  prompt: string;
  typeFrom: number;
  typeTo: number;
  sendAt: number;
  replyAt?: number;
  reply?: string;
  replyCps?: number;
  y?: number;
}> = ({ frame, at, out, prompt, typeFrom, typeTo, sendAt, replyAt, reply = DEFAULT_REPLY, replyCps = 2.2, y = 260 }) => {
  if (frame < at || frame > out + 10) return null;
  const c = cardIn(frame, at, out);
  const sent = frame >= sendAt;
  const inputText = sent ? "" : typedText(prompt, frame, typeFrom, typeTo);
  const typing = frame >= typeFrom && !sent;
  const press = bump(frame, sendAt - 1, 7);
  const ub = pop(frame, sendAt, { damping: 12, stiffness: 200 });
  const showDots = replyAt !== undefined && frame >= sendAt + 6 && frame < replyAt;
  const dotsIn = pop(frame, sendAt + 6, { damping: 14, stiffness: 220 });
  const rp = replyAt !== undefined ? pop(frame, replyAt, { damping: 13, stiffness: 200 }) : 0;
  const ellipsis = reply.endsWith("…");
  const body = ellipsis ? reply.slice(0, -1) : reply;
  const st = replyAt !== undefined ? streamed(body, frame, replyAt, replyCps) : { text: "", done: false };
  const sendReady = inputText.length > 0 || press > 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: y,
          width: 840,
          height: 640,
          borderRadius: 46,
          background: K.paper,
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          opacity: c.opacity,
          transform: c.transform,
          fontFamily: UI,
        }}
      >
        {/* Header */}
        <div style={{ height: 116, flexShrink: 0, background: AI_GRAD, display: "flex", alignItems: "center", gap: 20, padding: "0 30px" }}>
          <div style={{ width: 78, height: 78, borderRadius: 78, background: "rgba(255,255,255,0.22)", border: "3px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SparkleIcon size={52} color="white" frame={frame} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 42, color: "#FFFFFF", lineHeight: 1 }}>Asistente IA</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 24, color: "rgba(255,255,255,0.9)", lineHeight: 1 }}>
              <div style={{ width: 12, height: 12, borderRadius: 12, background: "#5CFF8F", boxShadow: "0 0 8px #5CFF8F" }} />
              {showDots || (replyAt !== undefined && frame >= replyAt && !st.done) ? "escribiendo…" : "en línea"}
            </div>
          </div>
        </div>
        {/* Messages */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 18, padding: "20px 28px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexShrink: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: 48, background: AI_GRAD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <SparkleIcon size={32} color="white" />
            </div>
            <div style={{ background: "#FFFFFF", borderRadius: 30, borderBottomLeftRadius: 8, padding: "16px 24px", fontWeight: 700, fontSize: 30, color: K.ink, boxShadow: "0 3px 8px rgba(16,20,40,0.08)" }}>
              <RichText text="¡Hola! ¿En qué te ayudo hoy? ✨" size={28} />
            </div>
          </div>
          {sent ? (
            <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
              <div
                style={{
                  maxWidth: 620,
                  background: BOY_GRAD,
                  color: "#FFFFFF",
                  borderRadius: 32,
                  borderBottomRightRadius: 8,
                  padding: "18px 26px",
                  fontWeight: 800,
                  fontSize: 36,
                  lineHeight: 1.25,
                  boxShadow: "0 6px 14px rgba(47,107,255,0.35)",
                  transform: `translateY(${(1 - ub) * 90}px) scale(${0.6 + 0.4 * ub})`,
                  transformOrigin: "100% 100%",
                  opacity: clamp01(ub * 3),
                }}
              >
                <RichText text={prompt} size={34} light />
              </div>
            </div>
          ) : null}
          {showDots ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexShrink: 0, transform: `scale(${dotsIn})`, transformOrigin: "0% 100%" }}>
              <div style={{ width: 48, height: 48, borderRadius: 48, background: AI_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SparkleIcon size={32} color="white" frame={frame} />
              </div>
              <div style={{ background: "#FFFFFF", borderRadius: 30, borderBottomLeftRadius: 8, padding: "14px 24px", boxShadow: "0 3px 8px rgba(16,20,40,0.08)" }}>
                <TypingDots frame={frame} color={K.violet} />
              </div>
            </div>
          ) : null}
          {replyAt !== undefined && frame >= replyAt ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexShrink: 0, transform: `scale(${0.7 + 0.3 * rp})`, transformOrigin: "0% 100%", opacity: clamp01(rp * 3) }}>
              <div style={{ width: 48, height: 48, borderRadius: 48, background: AI_GRAD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <SparkleIcon size={32} color="white" frame={frame} />
              </div>
              <div
                style={{
                  maxWidth: 640,
                  background: "#FFFFFF",
                  borderRadius: 30,
                  borderBottomLeftRadius: 8,
                  padding: "18px 26px",
                  fontWeight: 700,
                  fontSize: 33,
                  lineHeight: 1.3,
                  color: K.ink,
                  border: "3px solid #D9CCFF",
                  boxShadow: "0 6px 16px rgba(124,77,255,0.18)",
                }}
              >
                <RichText text={st.text} size={30} />
                {ellipsis && st.done ? (
                  <span>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{ opacity: 0.25 + 0.75 * Math.max(0, Math.sin(frame * 0.3 - i * 0.8)) }}>
                        .
                      </span>
                    ))}
                  </span>
                ) : null}
                {!st.done ? <Caret frame={frame} color={K.violet} h={34} solid /> : null}
              </div>
            </div>
          ) : null}
        </div>
        {/* Input bar */}
        <div style={{ flexShrink: 0, background: "#FFFFFF", borderTop: `2px solid ${K.line}`, padding: "18px 22px", display: "flex", alignItems: "flex-end", gap: 16 }}>
          <div
            style={{
              flex: 1,
              minHeight: 72,
              borderRadius: 36,
              background: "#EEF1F7",
              padding: "16px 26px",
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.25,
              color: inputText ? K.ink : "#9AA2B5",
              boxSizing: "border-box",
            }}
          >
            {inputText ? <RichText text={inputText} size={30} /> : typing ? "" : "Escribe tu mensaje…"}
            {typing ? <Caret frame={frame} h={34} solid={inputText.length > 0 && frame < typeTo} /> : null}
          </div>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 72,
              flexShrink: 0,
              background: sendReady ? AI_GRAD : "#C9CFDB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${1 - 0.22 * press + 0.12 * bump(frame, sendAt + 2, 8)})`,
              boxShadow: press > 0 ? "0 0 0 10px rgba(124,77,255,0.25)" : undefined,
            }}
          >
            <SendArrow size={44} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// 3. IaSwitchBadge

const BLACKOUT = [0.85, 0.1, 0.75, 0, 0.9, 0.95, 0.7, 0.45, 0.25, 0.12, 0.05];
const FLASH = [0.75, 0.35, 0.55, 0.25, 0.12, 0.05];

/**
 * The big switch badge (centre x 500, y `y`, ~780 x 210; default y 560): a dark pill with a white
 * border reading «IA: ON → OFF» (`to` "off") or «IA: OFF → ON» (`to` "on"). It pops in at `at`
 * with the first state lit; the arrow draws in; at `at` + 9 the new state flips down like a
 * split-flap tile while the old one greys out and is struck through. OFF: red, zigzag electric
 * sparks, the badge shakes and the whole screen flickers to black for ~10 frames (`blackout`,
 * default true). ON: green, a soft glow and rotating light rays, a white flash. Leaves at `out`.
 * Suggested: off at GANCHO.SWITCH - 9 (the flip lands on the pull), out GANCHO.END - 6; on at
 * GIRO.PREGUNTA - 9, out GIRO.PREGUNTA + 45.
 */
export const IaSwitchBadge: React.FC<{ frame: number; at: number; out: number; to: "off" | "on"; y?: number; blackout?: boolean }> = ({
  frame,
  at,
  out,
  to,
  y = 560,
  blackout = true,
}) => {
  if (frame < at || frame > out + 12) return null;
  const off = to === "off";
  const fromLbl = off ? "ON" : "OFF";
  const toLbl = off ? "OFF" : "ON";
  const fromCol = off ? K.green : K.red;
  const toCol = off ? K.red : K.green;
  const p = pop(frame, at, { damping: 11, stiffness: 210 });
  const k = leave(frame, out);
  const arrowK = ramp(frame, at + 4, at + 9);
  const flipAt = at + 9;
  const flipped = frame >= flipAt;
  const flip = ramp(frame, flipAt, flipAt + 6, [0, 1], EASE_OUT);
  const sh = impact(frame, flipAt + 2, off ? 22 : 8, 14);
  const dimOld = ramp(frame, flipAt, flipAt + 5);
  const strike = ramp(frame, flipAt + 2, flipAt + 7);
  const t = frame - at;
  const after = Math.max(0, frame - flipAt);
  const sparkOn = off && flipped && after < 18 && blink(frame, flipAt, 2, 1) === 1;
  const glowK = !off && flipped ? ramp(frame, flipAt, flipAt + 8) * (0.8 + 0.2 * Math.sin(t * 0.3)) : 0;
  const black = off && blackout ? pattern(frame, flipAt + 1, BLACKOUT, 0) : 0;
  const flash = !off ? pattern(frame, flipAt + 1, FLASH, 0) : 0;
  const tile = (bg: string, w: number): React.CSSProperties => ({
    width: w,
    height: 128,
    borderRadius: 26,
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: UI,
    fontWeight: 900,
    fontSize: 84,
    color: "#FFFFFF",
    letterSpacing: 2,
    boxShadow: "inset 0 -8px 0 rgba(0,0,0,0.22), inset 0 4px 0 rgba(255,255,255,0.25)",
    position: "relative",
    textShadow: "0 4px 0 rgba(0,0,0,0.2)",
  });
  const bolts: React.ReactNode[] = [];
  if (sparkOn) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand(i + Math.floor(frame / 2)) * 0.5;
      const r0 = 300 + rand(i * 3.1 + frame) * 30;
      const len = 70 + rand(i * 5.3 + frame) * 70;
      const pts: string[] = [];
      for (let s = 0; s <= 4; s++) {
        const rr = r0 + (len * s) / 4;
        const off2 = (s % 2 ? 1 : -1) * 14 * (s > 0 && s < 4 ? 1 : 0);
        pts.push(`${(Math.cos(a) * rr * 1.25 - Math.sin(a) * off2).toFixed(1)},${(Math.sin(a) * rr * 0.55 + Math.cos(a) * off2).toFixed(1)}`);
      }
      bolts.push(
        <g key={i}>
          <polyline points={pts.join(" ")} fill="none" stroke="#FFF6A0" strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" opacity={0.5} />
          <polyline points={pts.join(" ")} fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        </g>,
      );
    }
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {black > 0 ? <AbsoluteFill style={{ background: "#05060A", opacity: black }} /> : null}
      {flash > 0 ? <AbsoluteFill style={{ background: "#F2FFF4", opacity: flash }} /> : null}
      {glowK > 0 ? (
        <div style={{ position: "absolute", left: 500, top: y, width: 1300, height: 1300, transform: `translate(-50%, -50%) rotate(${t * 0.8}deg)`, opacity: glowK * (1 - k) * 0.85 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "repeating-conic-gradient(rgba(120,255,160,0.32) 0deg 10deg, rgba(120,255,160,0) 10deg 30deg)",
              WebkitMaskImage: "radial-gradient(circle, black 18%, transparent 62%)",
              maskImage: "radial-gradient(circle, black 18%, transparent 62%)",
            }}
          />
          <div style={{ position: "absolute", inset: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(90,255,140,0.55), rgba(90,255,140,0) 70%)" }} />
        </div>
      ) : null}
      {sparkOn ? (
        <svg width={1080} height={1920} viewBox="-500 -560 1080 1920" style={{ position: "absolute", left: 0, top: y - 560 }}>
          {bolts}
        </svg>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 500,
          top: y,
          transform: `translate(-50%, -50%) translate(${sh.x}px, ${sh.y}px) rotate(${sh.r - 2 * (1 - p)}deg) scale(${p * (1 - 0.4 * k)})`,
          opacity: clamp01(p * 3) * (1 - k),
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "30px 40px",
          borderRadius: 60,
          background: "linear-gradient(180deg, #252B45 0%, #12152A 100%)",
          border: "7px solid #FFFFFF",
          boxShadow: `0 24px 50px rgba(0,0,0,0.45)${flipped ? `, 0 0 ${40 + 20 * Math.sin(t * 0.4)}px ${off ? "rgba(255,59,78,0.8)" : "rgba(34,197,94,0.9)"}` : ""}`,
          fontFamily: UI,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 92, color: "#FFFFFF", lineHeight: 1, letterSpacing: 1 }}>IA:</div>
        <div style={{ ...tile(fromCol, off ? 160 : 210), filter: `grayscale(${dimOld}) brightness(${1 - 0.35 * dimOld})`, transform: `scale(${1 - 0.18 * dimOld})` }}>
          {fromLbl}
          <div
            style={{
              position: "absolute",
              left: -6,
              right: -6,
              top: 58,
              height: 14,
              borderRadius: 14,
              background: K.red,
              border: "4px solid #FFFFFF",
              transform: `rotate(-24deg) scaleX(${strike})`,
              transformOrigin: "0% 50%",
            }}
          />
        </div>
        <svg width={80 * arrowK + 1} height={60} viewBox={`0 0 ${80 * arrowK + 1} 60`} style={{ display: "block", overflow: "visible" }}>
          <path d={`M4 30 H${Math.max(4, 80 * arrowK - 10)}`} stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" />
          {arrowK > 0.6 ? <path d={`M${80 * arrowK - 30} 12 L${80 * arrowK - 8} 30 L${80 * arrowK - 30} 48`} stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        </svg>
        <div style={{ perspective: 600 }}>
          <div
            style={{
              ...tile(flipped ? toCol : "#2E3452", off ? 230 : 170),
              transform: `rotateX(${flipped ? -90 * (1 - flip) : -90}deg) scale(${1 + 0.15 * bump(frame, flipAt + 4, 8)})`,
              transformOrigin: "50% 0%",
              opacity: flipped ? 1 : 0,
            }}
          >
            {toLbl}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// 4. TitleSticker

/**
 * The question in the top band (x 70-930, y 240-470): «¿Y SI LA IA» in big white letters and
 * «NO EXISTIERA?» in gold on a red marker bar that wipes in, with a crossed-out sparkle on a
 * white badge bobbing beside the first line. Lines pop in one after the other at `at`, leave
 * one by one (shrink, fly up) at `out`. A soft dark scrim behind keeps it readable.
 * Suggested: at GANCHO.NUBI + 4 (or over the switch), out GANCHO.END - 6.
 */
export const TitleSticker: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 16) return null;
  const t = frame - at;
  const scrimK = ramp(frame, at, at + 8) * (1 - ramp(frame, out, out + 14));
  const lines = [
    { text: "¿Y SI LA IA", y: 300, size: 106, hi: false, x: 430 },
    { text: "NO EXISTIERA?", y: 414, size: 98, hi: true, x: 500 },
  ];
  const iconIn = pop(frame, at + 10, { damping: 9, stiffness: 190 });
  const iconOut = ramp(frame, out, out + 8, [0, 1], EASE_IN);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 180,
          width: 960,
          height: 340,
          background: "radial-gradient(closest-side, rgba(14,12,34,0.5), rgba(14,12,34,0.26) 60%, rgba(14,12,34,0))",
          opacity: scrimK,
        }}
      />
      {lines.map((l, i) => {
        const la = at + 2 + i * 5;
        const p = pop(frame, la, { damping: 10, stiffness: 190 });
        const kk = ramp(frame, out + i * 2, out + i * 2 + 9, [0, 1], EASE_IN);
        if (p < 0.001 || kk >= 1) return null;
        const rot = (i % 2 ? 1.6 : -1.6) * (0.6 + 0.4 * (1 - p)) + Math.sin(t * 0.07 + i * 1.3) * 0.6;
        const sw = ramp(frame, la - 1, la + 7, [0, 1], EASE_OUT);
        return (
          <div
            key={l.text}
            style={{
              position: "absolute",
              left: l.x,
              top: l.y,
              transform: `translate(-50%, -50%) translateY(${-70 * kk}px) scale(${p * (1 - 0.6 * kk)}) rotate(${rot}deg)`,
              opacity: Math.min(1, p * 3) * (1 - kk),
            }}
          >
            {l.hi ? (
              <div
                style={{
                  position: "absolute",
                  left: -30,
                  right: -30,
                  top: -10,
                  bottom: -8,
                  borderRadius: 22,
                  background: "linear-gradient(180deg, #FF5A6A 0%, #FF3B4E 45%, #C8102E 100%)",
                  border: "6px solid #FFFFFF",
                  boxShadow: "0 12px 26px rgba(0,0,0,0.3)",
                  transform: `scaleX(${sw}) rotate(-1.2deg)`,
                  transformOrigin: "0% 50%",
                }}
              />
            ) : null}
            <div style={{ position: "relative", paddingTop: l.size * 0.06 }}>
              <HeavyText text={l.text} size={l.size} colors={l.hi ? TXT_GOLD : TXT_WHITE} stroke={K.ink} />
            </div>
          </div>
        );
      })}
      {iconIn > 0.001 && iconOut < 1 ? (
        <div
          style={{
            position: "absolute",
            left: 790,
            top: 296 + Math.sin(t * 0.1) * 6,
            width: 132,
            height: 132,
            borderRadius: 132,
            background: "#FFFFFF",
            boxShadow: SOFT_SHADOW,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translate(-50%, -50%) scale(${iconIn * (1 - iconOut)}) rotate(${12 + (1 - iconIn) * 60 + Math.sin(t * 0.08) * 6}deg)`,
          }}
        >
          <SparkleIcon size={104} crossed frame={frame} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 5. SplitLabels

const POEM = [
  "Mi amor 💙: desde el día en que tus ojos se cruzaron con los míos, el universo entero cambió de órbita y las estrellas aprendieron tu nombre.",
  "Cada amanecer sin ti es un poema sin rima, una canción sin melodía, un café sin azúcar. Te extraño como la luna extraña al sol en cada eclipse. ❤️",
  "Por eso hoy, con el corazón en una mano y el alma en la otra, quiero decirte que eres mi pensamiento favorito y mi notificación más esperada. 💙",
].join("\n\n");

const Tag: React.FC<{ label: string; ai: boolean; frame: number }> = ({ label, ai, frame }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 24px 8px 10px",
      borderRadius: 999,
      background: ai ? AI_GRAD : "linear-gradient(180deg, #3A4060, #22263B)",
      border: "4px solid #FFFFFF",
      boxShadow: SOFT_SHADOW,
      fontFamily: UI,
      fontWeight: 900,
      fontSize: 38,
      color: "#FFFFFF",
      lineHeight: 1,
      whiteSpace: "nowrap",
    }}
  >
    <div style={{ width: 50, height: 50, borderRadius: 50, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SparkleIcon size={ai ? 40 : 42} crossed={!ai} frame={ai ? frame : undefined} />
    </div>
    {label}
  </div>
);

/**
 * The split screen of the "mensaje" scene: a white divider across the frame at y 960 (draws out
 * from the centre at `at`), the tag «CON IA» (sparkle) at the top-left (x 80, y 250) and «SIN IA»
 * (crossed sparkle) at the top-left of the bottom half (x 80, y 978). Top half: the boy's blue
 * bubble (x 320-920, from y 330, at most ~600 tall) with a three-paragraph AI love poem
 * streaming in fast (3.4 characters per frame from `at` + 8; once it fills the bubble the old
 * lines scroll up). Bottom half (rows kept above y 1180): his bubble «Hola… ¿ya comiste?» pops
 * in on the right at `sentAt` (y 978-1046), her grey «Sí» on the left at `siAt` (y 1052-1120),
 * then a "escribiendo" dots bubble (y 1126-1176) appears at siAt + 18, gives up, tries again
 * and gives up for good. Leaves at `out`.
 * Suggested: at MENSAJE.START, sentAt MENSAJE.SENT, siAt MENSAJE.SI, out MENSAJE.END - 8.
 */
export const SplitLabels: React.FC<{ frame: number; at: number; out: number; sentAt: number; siAt: number }> = ({ frame, at, out, sentAt, siAt }) => {
  if (frame < at || frame > out + 12) return null;
  const k = leave(frame, out, 10);
  const line = ramp(frame, at, at + 10, [0, 1], EASE_OUT);
  const tagTop = pop(frame, at + 3);
  const tagBot = pop(frame, at + 6);
  const poemIn = pop(frame, at + 8, { damping: 13, stiffness: 180 });
  const poem = streamed(POEM, frame, at + 9, 3.4);
  const hb = pop(frame, sentAt, { damping: 12, stiffness: 200 });
  const si = pop(frame, siAt, { damping: 11, stiffness: 220 });
  const d1 = siAt + 18;
  const dotsK = (() => {
    const a = pop(frame, d1, { damping: 14, stiffness: 220 }) * (1 - ramp(frame, d1 + 30, d1 + 36, [0, 1], EASE_IN));
    const b = pop(frame, d1 + 46, { damping: 14, stiffness: 220 }) * (1 - ramp(frame, d1 + 58, d1 + 63, [0, 1], EASE_IN));
    return frame < d1 + 40 ? a : b;
  })();
  const fade = 1 - k;
  const bubbleBase: React.CSSProperties = { position: "absolute", fontFamily: UI, fontWeight: 800, fontSize: 36, lineHeight: 1, whiteSpace: "nowrap", boxSizing: "border-box", height: 68, display: "flex", alignItems: "center" };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: fade }}>
      {/* Divider */}
      <div style={{ position: "absolute", left: 0, top: 955, width: 1080, height: 10, background: "#FFFFFF", transform: `scaleX(${line})`, boxShadow: "0 0 18px rgba(0,0,0,0.35)" }} />
      <div style={{ position: "absolute", left: 80, top: 250, transform: `scale(${tagTop})`, transformOrigin: "0% 50%" }}>
        <Tag label="CON IA" ai frame={frame} />
      </div>
      <div style={{ position: "absolute", left: 80, top: 978, transform: `scale(${tagBot})`, transformOrigin: "0% 50%" }}>
        <Tag label="SIN IA" ai={false} frame={frame} />
      </div>
      {/* Top half: the AI poem */}
      {poemIn > 0.001 ? (
        <div
          style={{
            position: "absolute",
            right: 160,
            top: 336,
            width: 600,
            maxHeight: 590,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            overflow: "hidden",
            borderRadius: 34,
            borderTopRightRadius: 8,
            background: BOY_GRAD,
            boxShadow: "0 10px 26px rgba(20,40,120,0.35)",
            padding: "20px 26px",
            boxSizing: "border-box",
            transform: `scale(${poemIn})`,
            transformOrigin: "100% 0%",
          }}
        >
          <div
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: 29,
              lineHeight: 1.32,
              color: "#FFFFFF",
              whiteSpace: "pre-wrap",
              flexShrink: 0,
              WebkitMaskImage: poem.text.length > 300 ? "linear-gradient(180deg, transparent 0px, black 70px)" : undefined,
              maskImage: poem.text.length > 300 ? "linear-gradient(180deg, transparent 0px, black 70px)" : undefined,
            }}
          >
            <RichText text={poem.text} size={27} light />
            {!poem.done ? <Caret frame={frame} color="#FFFFFF" h={30} solid /> : null}
          </div>
        </div>
      ) : null}
      {/* Bottom half: the boy, her, the dots */}
      {hb > 0.001 ? (
        <div
          style={{
            ...bubbleBase,
            right: 160,
            top: 978,
            padding: "0 26px",
            borderRadius: 34,
            borderBottomRightRadius: 8,
            background: BOY_GRAD,
            color: "#FFFFFF",
            boxShadow: "0 8px 18px rgba(20,40,120,0.35)",
            transform: `translateX(${(1 - hb) * 120}px) scale(${0.5 + 0.5 * hb})`,
            transformOrigin: "100% 100%",
            opacity: clamp01(hb * 3),
            gap: 12,
          }}
        >
          Hola… ¿ya comiste?
          <span style={{ fontSize: 22, fontWeight: 800, color: frame >= siAt - 10 ? "#9FF3FF" : "rgba(255,255,255,0.7)" }}>✓✓</span>
        </div>
      ) : null}
      {si > 0.001 ? (
        <div
          style={{
            ...bubbleBase,
            left: 80,
            top: 1052,
            padding: "0 30px",
            borderRadius: 34,
            borderBottomLeftRadius: 8,
            background: "#E9ECF2",
            color: K.ink,
            boxShadow: SOFT_SHADOW,
            transform: `scale(${si})`,
            transformOrigin: "0% 100%",
          }}
        >
          Sí
        </div>
      ) : null}
      {dotsK > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 1126,
            height: 50,
            padding: "0 22px",
            borderRadius: 26,
            background: "#E9ECF2",
            boxShadow: SOFT_SHADOW,
            display: "flex",
            alignItems: "center",
            transform: `scale(${dotsK})`,
            transformOrigin: "0% 100%",
          }}
        >
          <TypingDots frame={frame} size={12} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 6. MessageCallback

/**
 * The boy writes his own message (GIRO, "Ya estudiábamos…"): a white chat card in the top band
 * (x 110-890, y 270-690). «te extraño» is typed by hand in the input bar from `at` + 6 to
 * `sentAt` - 4 (caret, a little hesitation), sent at `sentAt` as a blue bubble (top right, "✓✓"
 * turning blue before her answer); at `replyAt` her grey bubble «yo también ❤️» pops in on the
 * left with a heart burst (a big heart that pops and fades, small hearts flying out and floating
 * up). `name` (optional) adds a small header with her name. Leaves at `out`.
 * Suggested: at GIRO.YA, sentAt GIRO.YA + 50, replyAt GIRO.YA + 80, out GIRO.PREGUNTA - 4.
 */
export const MessageCallback: React.FC<{ frame: number; at: number; out: number; sentAt: number; replyAt: number; name?: string }> = ({
  frame,
  at,
  out,
  sentAt,
  replyAt,
  name,
}) => {
  if (frame < at || frame > out + 10) return null;
  const c = cardIn(frame, at, out);
  const msg = "te extraño";
  const typeFrom = at + 6;
  const typeTo = sentAt - 4;
  // Types "te ext", hesitates, then finishes.
  const mid = typeFrom + Math.round((typeTo - typeFrom) * 0.4);
  const hold = typeFrom + Math.round((typeTo - typeFrom) * 0.65);
  const chars = Array.from(msg);
  const n = frame < mid ? Math.round(clamp01((frame - typeFrom) / Math.max(1, mid - typeFrom)) * 6) : frame < hold ? 6 : 6 + Math.round(clamp01((frame - hold) / Math.max(1, typeTo - hold)) * 4);
  const sent = frame >= sentAt;
  const inputText = sent ? "" : chars.slice(0, Math.max(0, n)).join("");
  const ub = pop(frame, sentAt, { damping: 12, stiffness: 200 });
  const rb = pop(frame, replyAt, { damping: 10, stiffness: 200 });
  const top = name ? 96 : 0;
  const bigHeart = frame >= replyAt ? pop(frame, replyAt + 2, { damping: 8, stiffness: 160 }) * (1 - ramp(frame, replyAt + 22, replyAt + 34)) : 0;
  const burst: React.ReactNode[] = [];
  if (frame >= replyAt) {
    const d = frame - replyAt;
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI * 0.2 + (i / 11) * Math.PI * 0.5 + (rand(i * 2.3) - 0.5) * 0.25;
      const sp = 9 + rand(i * 4.1) * 8;
      const x = Math.cos(a) * sp * d * Math.pow(0.94, d) * 2.4;
      const y = Math.sin(a) * sp * d * Math.pow(0.94, d) * 1.6 - d * 0.6;
      const o = 1 - ramp(frame, replyAt + 14 + (i % 4) * 3, replyAt + 30 + (i % 4) * 3);
      if (o <= 0) continue;
      const s = 26 + rand(i * 7.7) * 26;
      burst.push(
        <div key={i} style={{ position: "absolute", left: x - s / 2, top: y - s / 2, opacity: o, transform: `rotate(${(rand(i) - 0.5) * 40}deg)` }}>
          <HeartIcon size={s} color={i % 3 === 0 ? "#FF7AB6" : "#FF3B5C"} />
        </div>,
      );
    }
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 270,
          width: 780,
          height: 420 + top,
          borderRadius: 44,
          background: K.paper,
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
          opacity: c.opacity,
          transform: c.transform,
          fontFamily: UI,
        }}
      >
        {name ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 96, background: "#FFFFFF", borderBottom: `2px solid ${K.line}`, display: "flex", alignItems: "center", gap: 16, padding: "0 28px" }}>
            <div style={{ width: 60, height: 60, borderRadius: 60, background: "linear-gradient(140deg, #FFB0D0, #FF4F9A)" }} />
            <div style={{ fontWeight: 900, fontSize: 36, color: K.ink }}>
              <RichText text={name} size={32} />
            </div>
          </div>
        ) : null}
        {sent ? (
          <div
            style={{
              position: "absolute",
              right: 30,
              top: top + 34,
              padding: "18px 30px",
              borderRadius: 34,
              borderBottomRightRadius: 8,
              background: BOY_GRAD,
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 44,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 8px 18px rgba(20,40,120,0.3)",
              transform: `translateY(${(1 - ub) * 180}px) scale(${0.6 + 0.4 * ub})`,
              transformOrigin: "100% 100%",
              opacity: clamp01(ub * 3),
            }}
          >
            {msg}
            <span style={{ fontSize: 24, color: frame >= replyAt - 12 ? "#9FF3FF" : "rgba(255,255,255,0.7)" }}>✓✓</span>
          </div>
        ) : null}
        {frame >= replyAt ? (
          <div
            style={{
              position: "absolute",
              left: 30,
              top: top + 170,
              padding: "18px 30px",
              borderRadius: 34,
              borderBottomLeftRadius: 8,
              background: "#FFFFFF",
              border: "3px solid #FFC2DA",
              color: K.ink,
              fontWeight: 800,
              fontSize: 44,
              lineHeight: 1,
              boxShadow: "0 8px 20px rgba(255,79,154,0.25)",
              transform: `scale(${rb})`,
              transformOrigin: "0% 100%",
              whiteSpace: "nowrap",
            }}
          >
            <RichText text="yo también ❤️" size={42} />
          </div>
        ) : null}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 112, background: "#FFFFFF", borderTop: `2px solid ${K.line}`, display: "flex", alignItems: "center", gap: 16, padding: "0 22px" }}>
          <div style={{ flex: 1, height: 72, borderRadius: 36, background: "#EEF1F7", display: "flex", alignItems: "center", padding: "0 26px", fontWeight: 700, fontSize: 34, color: inputText ? K.ink : "#9AA2B5" }}>
            {inputText || (frame >= typeFrom && !sent ? "" : "Mensaje…")}
            {frame >= typeFrom && !sent ? <Caret frame={frame} h={38} solid={frame < mid} /> : null}
          </div>
          <div style={{ width: 72, height: 72, borderRadius: 72, background: inputText ? BOY_GRAD : "#C9CFDB", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 - 0.2 * bump(frame, sentAt - 1, 6)})` }}>
            <SendArrow size={44} />
          </div>
        </div>
      </div>
      {/* Heart burst from her bubble */}
      {frame >= replyAt && c.opacity > 0 ? (
        <div style={{ position: "absolute", left: 500, top: 270 + top + 212, opacity: c.opacity }}>
          {bigHeart > 0.001 ? (
            <div style={{ position: "absolute", left: 130, top: 0, transform: `translate(-50%, -50%) scale(${bigHeart}) rotate(${-10 + 10 * Math.sin((frame - replyAt) * 0.3)}deg)`, opacity: clamp01(bigHeart * 1.5) }}>
              <HeartIcon size={150} />
            </div>
          ) : null}
          {burst}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 7. DeadlineClock

const RollDigits: React.FC<{ value: string; prev: string | null; k: number; color: string; size: number }> = ({ value, prev, k, color, size }) => {
  const a = Array.from(value);
  const b = prev ? Array.from(prev) : a;
  return (
    <div style={{ display: "flex", ...TAB, fontWeight: 900, fontSize: size, lineHeight: 1, color }}>
      {a.map((ch, i) => {
        const changed = b[i] !== ch && k < 1;
        if (!changed) return <span key={i} style={{ display: "inline-block", width: ch === ":" ? size * 0.32 : size * 0.64, textAlign: "center" }}>{ch}</span>;
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", width: size * 0.64, height: size, overflow: "hidden", textAlign: "center" }}>
            <span style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${-k * size}px)`, opacity: 1 - k }}>{b[i]}</span>
            <span style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${(1 - k) * size}px)` }}>{ch}</span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * The deadline badge in the top band (centre x 500, y 250-376): a dark pill with an alarm clock,
 * the time «11:58» + «P. M.» in big white digits (colon blinking) and, after a divider,
 * «ENTREGA:» over a yellow «12:00». The minutes roll 11:58 -> 11:59 (halfway to `midnightAt`)
 * -> 12:00 at `midnightAt`; in the last ~45 frames the badge pulses red and the clock rings. At
 * `midnightAt` the time turns red «12:00», the badge shakes and a red rubber stamp
 * «ENTREGA CERRADA» slams in (centre x 500, y `stampY`, default 640, ~620 x 220). Leaves at
 * `out`. Suggested: at TAREA.ERROR - 6 (or TAREA.START + 4), midnightAt TAREA.MIDNIGHT,
 * out TAREA.END - 6.
 */
export const DeadlineClock: React.FC<{ frame: number; at: number; out: number; midnightAt: number; stampY?: number }> = ({ frame, at, out, midnightAt, stampY = 640 }) => {
  if (frame < at || frame > out + 12) return null;
  const c = cardIn(frame, at, out, -60);
  const t59 = at + Math.round((midnightAt - at) / 2);
  const mins = frame < t59 ? 58 : frame < midnightAt ? 59 : 0;
  const isMid = frame >= midnightAt;
  const value = isMid ? "12:00" : `11:${pad2(mins)}`;
  const changeAt = isMid ? midnightAt : frame >= t59 ? t59 : at - 100;
  const prev = isMid ? "11:59" : frame >= t59 ? "11:58" : null;
  const rk = ramp(frame, changeAt, changeAt + 6, [0, 1], EASE_OUT);
  const urgent = ramp(frame, midnightAt - 45, midnightAt - 20);
  const pulse = urgent * Math.max(0, Math.sin((frame - midnightAt) * 0.6)) * (isMid ? 0 : 1);
  const sh = impact(frame, midnightAt, 16, 14);
  const sh2 = impact(frame, midnightAt + 4, 20, 14);
  const colonOn = isMid || blink(frame, at, 9, 6) === 1;
  const stampP = frame >= midnightAt + 3 ? ramp(frame, midnightAt + 3, midnightAt + 7, [0, 1], EASE_IN) : 0;
  const stampK = leave(frame, out);
  const ringK = isMid ? 1 - ramp(frame, midnightAt + 20, midnightAt + 30) : urgent;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 500,
          top: 313,
          transform: `translate(-50%, -50%) translate(${sh.x}px, ${sh.y}px) ${c.transform} scale(${1 + 0.04 * pulse + 0.1 * bump(frame, midnightAt, 8)})`,
          opacity: c.opacity,
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "16px 36px 16px 22px",
          borderRadius: 999,
          background: isMid ? "linear-gradient(180deg, #3A0E16, #1E070C)" : `linear-gradient(180deg, ${urgent > 0 ? "#2B1A2E" : "#252B45"}, #12152A)`,
          border: `6px solid ${isMid ? K.red : "#FFFFFF"}`,
          boxShadow: `0 18px 40px rgba(0,0,0,0.4), 0 0 ${30 * (pulse + (isMid ? 1 : 0))}px rgba(255,59,78,0.85)`,
          fontFamily: UI,
          whiteSpace: "nowrap",
        }}
      >
        <AlarmClockIcon size={92} h={isMid ? 12 : 11} m={isMid ? 0 : mins} ring={ringK} frame={frame} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ opacity: 1 }}>
            <div style={{ position: "relative" }}>
              <RollDigits value={colonOn ? value : value.replace(":", " ")} prev={prev ? (colonOn ? prev : prev.replace(":", " ")) : null} k={rk} color={isMid ? "#FF5A6A" : "#FFFFFF"} size={88} />
            </div>
          </div>
          {!isMid ? <div style={{ fontWeight: 900, fontSize: 36, color: "#FFFFFF", opacity: 0.9 }}>P. M.</div> : null}
        </div>
        <div style={{ width: 4, height: 80, borderRadius: 4, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 26, color: "rgba(255,255,255,0.85)", letterSpacing: 2, lineHeight: 1 }}>ENTREGA:</div>
          <div style={{ fontWeight: 900, fontSize: 44, lineHeight: 1, color: K.ink, background: K.yellow, borderRadius: 14, padding: "6px 14px", ...TAB }}>12:00</div>
        </div>
      </div>
      {stampP > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 500,
            top: stampY,
            transform: `translate(-50%, -50%) translate(${sh2.x}px, ${sh2.y}px) rotate(-9deg) scale(${(2.3 - 1.3 * stampP) * (1 - 0.3 * stampK)})`,
            opacity: clamp01(stampP * 2) * (1 - stampK),
            padding: "18px 40px",
            border: `12px solid ${K.red}`,
            outline: `4px solid ${K.red}`,
            outlineOffset: 6,
            borderRadius: 26,
            background: "rgba(255,255,255,0.82)",
            fontFamily: UI,
            fontWeight: 900,
            color: K.red,
            textAlign: "center",
            lineHeight: 0.95,
            boxShadow: "0 16px 36px rgba(0,0,0,0.3)",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontSize: 64, letterSpacing: 6 }}>ENTREGA</div>
          <div style={{ fontSize: 96, letterSpacing: 2 }}>CERRADA</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 8. AIErrorPage

/**
 * A browser error card (x 100-900, y `y` … y + 560; default y 440): a browser bar with the
 * address «asistente-ia.app», a grey sad sparkle (drooping, a tear), «No se puede acceder a la
 * IA», «Este asistente nunca existió.», the code ERR_IA_NO_EXISTE and a blue «Reintentar»
 * button. It slides in from the left and lands with a shake at `at`; at `at` + 30 the button is
 * pressed… and the card just shakes again. Leaves at `out`.
 * Suggested: at TAREA.ERROR, out TAREA.TYPE - 6 (under the DeadlineClock).
 */
export const AIErrorPage: React.FC<{ frame: number; at: number; out: number; y?: number }> = ({ frame, at, out, y = 440 }) => {
  if (frame < at || frame > out + 10) return null;
  const p = pop(frame, at, { damping: 14, stiffness: 190 });
  const k = leave(frame, out);
  const s1 = impact(frame, at + 5, 22, 12);
  const s2 = impact(frame, at + 32, 18, 12);
  const press = bump(frame, at + 28, 6);
  const droop = Math.sin((frame - at) * 0.08) * 4;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: y,
          width: 800,
          borderRadius: 36,
          background: "#FFFFFF",
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
          fontFamily: UI,
          opacity: clamp01(p * 3) * (1 - k),
          transform: `translateX(${(1 - p) * -700 + s1.x + s2.x}px) translateY(${s1.y + s2.y - k * 50}px) rotate(${(1 - p) * -8 + s1.r + s2.r}deg) scale(${1 - 0.1 * k})`,
        }}
      >
        <div style={{ height: 76, background: "#E9ECF3", display: "flex", alignItems: "center", gap: 12, padding: "0 24px" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((col) => (
            <div key={col} style={{ width: 20, height: 20, borderRadius: 20, background: col }} />
          ))}
          <div style={{ flex: 1, marginLeft: 14, height: 46, borderRadius: 23, background: "#FFFFFF", display: "flex", alignItems: "center", padding: "0 20px", gap: 10, fontWeight: 700, fontSize: 24, color: K.sub }}>
            <svg width={18} height={22} viewBox="0 0 18 22">
              <rect x={1} y={9} width={16} height={12} rx={3} fill="#9AA2B5" />
              <path d="M4 9 V6 Q4 1 9 1 Q14 1 14 6 V9" stroke="#9AA2B5" strokeWidth={3} fill="none" />
            </svg>
            asistente-ia.app
          </div>
        </div>
        <div style={{ padding: "34px 50px 44px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <SparkleIcon size={150} sad style={{ transform: `rotate(${droop}deg)` }} />
          <div style={{ marginTop: 18, fontWeight: 900, fontSize: 50, lineHeight: 1.1, color: K.ink }}>
            No se puede acceder
            <br />a la IA
          </div>
          <div style={{ marginTop: 16, fontWeight: 700, fontSize: 34, lineHeight: 1.2, color: K.sub }}>Este asistente nunca existió.</div>
          <div style={{ marginTop: 16, fontWeight: 800, fontSize: 22, letterSpacing: 2, color: "#A0A7B8" }}>ERR_IA_NO_EXISTE</div>
          <div
            style={{
              marginTop: 26,
              padding: "16px 40px",
              borderRadius: 999,
              background: K.blue,
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: 30,
              transform: `scale(${1 - 0.12 * press})`,
              boxShadow: press > 0 ? "0 0 0 10px rgba(47,123,255,0.25)" : "0 6px 14px rgba(47,123,255,0.35)",
            }}
          >
            Reintentar
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// 9. TypedDoc

const DOC_WORDS = ["Desde", "los", "tiempos", "antiguos…"];

/**
 * A word-processor card (x 110-890, y `y` … y + 470; default y 440): a blue title bar
 * «trabajo_final_FINAL(2).doc», a B / I / U toolbar, a white page where «Desde los tiempos
 * antiguos…» appears word by word (one word every 8 frames from `at` + 6, each word pops; the
 * caret blinks after it), and a status bar «Palabras: 0» -> 4 (each count bumps) next to a
 * grey «meta: 2 000»: at 4 the counter turns green, jumps and throws confetti. Leaves at `out`.
 * Suggested: at TAREA.TYPE - 4, out TAREA.MIDNIGHT - 2 (the stamp of the DeadlineClock lands on it).
 */
export const TypedDoc: React.FC<{ frame: number; at: number; out: number; y?: number }> = ({ frame, at, out, y = 440 }) => {
  if (frame < at || frame > out + 10) return null;
  const c = cardIn(frame, at, out);
  const wAt = (i: number) => at + 6 + i * 8;
  const n = DOC_WORDS.filter((_, i) => frame >= wAt(i)).length;
  const lastAt = n > 0 ? wAt(n - 1) : at;
  const done = n === 4;
  const celebrate = done ? pop(frame, wAt(3) + 1, { damping: 7, stiffness: 200 }) : 0;
  const cnt = 1 + 0.35 * bump(frame, lastAt, 8) + (done ? 0.25 * bump(frame, wAt(3), 14) : 0);
  const confetti: React.ReactNode[] = [];
  if (done) {
    const d = frame - wAt(3);
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI / 2 + (rand(i * 1.7) - 0.5) * 2.4;
      const sp = 10 + rand(i * 3.9) * 10;
      const x = Math.cos(a) * sp * d;
      const yy = Math.sin(a) * sp * d + 0.9 * d * d;
      const o = 1 - ramp(frame, wAt(3) + 18, wAt(3) + 28);
      if (o <= 0) continue;
      const cols = ["#FF4F9A", "#FFD23F", "#22C55E", "#2F7BFF", "#7C4DFF", "#FF8A1F"];
      confetti.push(
        <div key={i} style={{ position: "absolute", left: x, top: yy, width: 14, height: 22, borderRadius: 3, background: cols[i % cols.length], opacity: o, transform: `rotate(${d * 25 + i * 40}deg)` }} />,
      );
    }
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: y,
          width: 780,
          height: 470,
          borderRadius: 36,
          background: "#E8EBF2",
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
          opacity: c.opacity,
          transform: c.transform,
          fontFamily: UI,
        }}
      >
        <div style={{ height: 70, background: "linear-gradient(180deg, #3F86FF, #2F6BFF)", display: "flex", alignItems: "center", gap: 14, padding: "0 26px", color: "#FFFFFF", fontWeight: 800, fontSize: 27 }}>
          <svg width={30} height={36} viewBox="0 0 30 36">
            <path d="M2 2 H20 L28 10 V34 H2 Z" fill="#FFFFFF" />
            <path d="M7 16 H23 M7 22 H23 M7 28 H17" stroke="#2F6BFF" strokeWidth={3} />
          </svg>
          trabajo_final_FINAL(2).doc
        </div>
        <div style={{ height: 56, background: "#FFFFFF", borderBottom: `2px solid ${K.line}`, display: "flex", alignItems: "center", gap: 10, padding: "0 24px" }}>
          {[
            { l: "B", s: { fontWeight: 900 } },
            { l: "I", s: { fontStyle: "italic" as const } },
            { l: "U", s: { textDecoration: "underline" } },
          ].map((b) => (
            <div key={b.l} style={{ width: 40, height: 40, borderRadius: 8, background: "#F0F2F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: K.ink, ...b.s }}>
              {b.l}
            </div>
          ))}
          <div style={{ marginLeft: 12, height: 40, padding: "0 16px", borderRadius: 8, background: "#F0F2F7", display: "flex", alignItems: "center", fontSize: 22, fontWeight: 700, color: K.sub }}>Título 1 ▾</div>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 150, height: 228, background: "#FFFFFF", borderRadius: 10, boxShadow: "0 4px 12px rgba(16,20,40,0.1)", padding: "34px 40px", boxSizing: "border-box" }}>
          <div style={{ fontWeight: 800, fontSize: 52, lineHeight: 1.25, color: K.ink }}>
            {DOC_WORDS.map((w, i) => {
              if (frame < wAt(i)) return null;
              const wp = pop(frame, wAt(i), { damping: 10, stiffness: 260 });
              return (
                <span key={w} style={{ display: "inline-block", marginRight: 16, transform: `scale(${0.6 + 0.4 * wp}) translateY(${(1 - wp) * 10}px)`, transformOrigin: "0% 100%" }}>
                  {w}
                </span>
              );
            })}
            <Caret frame={frame} h={56} solid={frame - lastAt < 6 && !done} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 74, background: "#FFFFFF", borderTop: `2px solid ${K.line}`, display: "flex", alignItems: "center", gap: 18, padding: "0 28px" }}>
          <div
            style={{
              padding: "8px 20px",
              borderRadius: 999,
              background: done ? K.green : "#EEF1F7",
              color: done ? "#FFFFFF" : K.ink,
              fontWeight: 900,
              fontSize: 32,
              transform: `scale(${cnt}) rotate(${done ? -4 * celebrate : 0}deg)`,
              transformOrigin: "0% 50%",
              boxShadow: done ? "0 0 0 6px rgba(34,197,94,0.25)" : undefined,
              ...TAB,
            }}
          >
            Palabras: {n}
          </div>
          <div style={{ fontWeight: 700, fontSize: 26, color: "#A0A7B8", marginLeft: done ? 64 : 0 }}>meta: 2 000</div>
        </div>
      </div>
      {confetti.length > 0 ? <div style={{ position: "absolute", left: 230, top: y + 400, opacity: c.opacity }}>{confetti}</div> : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 10. SlidesCounter

/**
 * A presentation editor card (x 80-920, y `y` … y + 650; default y 280): an orange title bar
 * «Presentación rapidita», an empty 16:9 slide with dashed placeholders («Haz clic para agregar
 * un título») and a blinking cursor, then a strip of empty slide thumbnails that pop in one by
 * one (1 -> 40 in ~30 frames, the strip racing to the end, then sliding back to slide 1) and the
 * counter «Diapositiva 1 de 40» (the 40 counting up, red bump at 40). Leaves at `out`.
 * Suggested: at JEFE.SLIDES, out JEFE.COFFEE1 - 4.
 */
export const SlidesCounter: React.FC<{ frame: number; at: number; out: number; y?: number }> = ({ frame, at, out, y = 280 }) => {
  if (frame < at || frame > out + 10) return null;
  const c = cardIn(frame, at, out);
  const fill = ramp(frame, at + 6, at + 36, [0, 1], EASE_IN_OUT);
  const N = Math.max(1, Math.round(1 + 39 * fill));
  const THW = 118;
  const GAP = 14;
  const STRIP = 780;
  const end = Math.max(0, N * (THW + GAP) - STRIP + 10);
  const back = ramp(frame, at + 44, at + 62, [0, 1], EASE_IN_OUT);
  const scroll = end * (1 - back);
  const full = N === 40;
  const hit = full ? bump(frame, at + 36, 10) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: y,
          width: 840,
          height: 650,
          borderRadius: 40,
          background: "#E9ECF2",
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
          opacity: c.opacity,
          transform: c.transform,
          fontFamily: UI,
        }}
      >
        <div style={{ height: 78, background: "linear-gradient(180deg, #FF8A4C, #F2672A)", display: "flex", alignItems: "center", gap: 14, padding: "0 28px", color: "#FFFFFF", fontWeight: 900, fontSize: 32 }}>
          <svg width={40} height={34} viewBox="0 0 40 34">
            <rect x={2} y={2} width={36} height={24} rx={4} fill="#FFFFFF" />
            <path d="M20 26 V32 M12 32 H28" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
            <rect x={8} y={14} width={5} height={8} fill="#F2672A" />
            <rect x={17} y={9} width={5} height={13} fill="#F2672A" />
            <rect x={26} y={12} width={5} height={10} fill="#F2672A" />
          </svg>
          Presentación rapidita
        </div>
        {/* The empty slide */}
        <div style={{ position: "absolute", left: 100, top: 104, width: 640, height: 360, background: "#FFFFFF", borderRadius: 8, boxShadow: "0 6px 16px rgba(16,20,40,0.14)" }}>
          <div style={{ position: "absolute", left: 40, right: 40, top: 54, height: 110, border: "4px dashed #C3C9D6", borderRadius: 10, display: "flex", alignItems: "center", paddingLeft: 26, fontWeight: 800, fontSize: 34, color: "#A9B0C0" }}>
            <Caret frame={frame} color={K.ink} h={46} />
            <span style={{ marginLeft: 12 }}>Haz clic para agregar un título</span>
          </div>
          <div style={{ position: "absolute", left: 90, right: 90, top: 196, height: 110, border: "4px dashed #DCE0E8", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 26, color: "#BCC2CF" }}>
            Agregar subtítulo
          </div>
        </div>
        {/* Thumbnail strip */}
        <div style={{ position: "absolute", left: 30, top: 488, width: STRIP, height: 90, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 4, display: "flex", gap: GAP, transform: `translateX(${-scroll}px)` }}>
            {Array.from({ length: 40 }, (_, i) => {
              const tp = i < N ? pop(frame, at + 6 + (i / 39) * 30, { damping: 12, stiffness: 260 }) : 0;
              return (
                <div key={i} style={{ position: "relative", flexShrink: 0, width: THW, height: 66, transform: `scale(${tp})`, opacity: clamp01(tp * 3) }}>
                  <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", borderRadius: 6, border: i === 0 ? `4px solid ${K.orange}` : "2px solid #D3D8E2", boxSizing: "border-box" }} />
                  <div style={{ position: "absolute", left: 6, top: 4, fontWeight: 800, fontSize: 16, color: "#A9B0C0" }}>{i + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 66, background: "#FFFFFF", borderTop: `2px solid ${K.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 36, color: K.ink, ...TAB }}>
            Diapositiva 1 de{" "}
            <span style={{ display: "inline-block", color: full ? K.red : K.ink, transform: `scale(${1 + 0.5 * hit})`, minWidth: 44 }}>{N}</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// 11. MontageLabel

const MONTAGE_BG = [
  ["#FF9A3D", "#E8590C"],
  ["#FF5A6A", "#C8102E"],
  ["#6FC3FF", "#2F7BFF"],
  ["#A57BFF", "#6A3CFF"],
];

/**
 * A punchy sticker for the quick montage cuts (centre x `x`, y `y`; default 500, 330): a bold
 * coloured pill with a white border and HeavyText, e.g. «CAFÉ #1», «CAFÉ #7», «6:00 A. M. ☀️».
 * A text with "CAFÉ" gets a steaming mug in front; emoji in the text become icons (☀️ a sun).
 * It slams in (from 2.2x in 4 frames, a shake) at `at`, wobbles, and pops away at `out` (~6
 * frames, so cuts can be tight). `color` 0-3 picks the colour (default: from the text).
 * Suggested: at JEFE.COFFEE1 / COFFEE2 / SUNRISE, out = next cue - 4 (sunrise: JEFE.L09 - 6).
 */
export const MontageLabel: React.FC<{ frame: number; at: number; out: number; text: string; x?: number; y?: number; color?: number; rotate?: number }> = ({
  frame,
  at,
  out,
  text,
  x = 500,
  y = 330,
  color,
  rotate,
}) => {
  if (frame < at || frame > out + 8) return null;
  let hash = 0;
  for (const ch of Array.from(text)) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const bg = MONTAGE_BG[(color ?? hash) % MONTAGE_BG.length];
  const rot = rotate ?? (hash % 2 ? -5 : 4);
  const s = ramp(frame, at, at + 4, [2.2, 1], EASE_IN);
  const sh = impact(frame, at + 4, 14, 10);
  const k = ramp(frame, out, out + 6, [0, 1], EASE_IN);
  const t = frame - at;
  const parts = text.split(EMOJI_RE).filter((p) => p.trim().length > 0);
  const coffee = /CAF[ÉE]/i.test(text);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) translate(${sh.x}px, ${sh.y}px) rotate(${rot + sh.r + Math.sin(t * 0.25) * 1.2}deg) scale(${s * (1 - k)})`,
          opacity: clamp01((frame - at + 1) / 2) * (1 - k),
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "22px 44px 18px",
          borderRadius: 36,
          background: `linear-gradient(180deg, ${bg[0]}, ${bg[1]})`,
          border: "7px solid #FFFFFF",
          boxShadow: "0 18px 36px rgba(0,0,0,0.35)",
          whiteSpace: "nowrap",
        }}
      >
        {coffee ? <CoffeeIcon size={96} frame={frame} style={{ marginTop: -8 }} /> : null}
        {parts.map((p, i) =>
          EMOJI_RE.test(p) ? (
            <div key={i} style={{ transform: `rotate(${t * 2}deg)` }}>
              <EmojiGlyph ch={p} size={96} />
            </div>
          ) : (
            <div key={i} style={{ paddingTop: 8 }}>
              <HeavyText text={p.trim()} size={96} colors={TXT_WHITE} stroke={K.ink} />
            </div>
          ),
        )}
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// 12. SocialPost + RewindFX

/** Sunglasses avatar for the luxury account. */
const LuxAvatar: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
    <defs>
      <linearGradient id="luxring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFD23F" />
        <stop offset="0.5" stopColor="#FF8A1F" />
        <stop offset="1" stopColor="#22C3FF" />
      </linearGradient>
    </defs>
    <circle cx={50} cy={50} r={48} fill="url(#luxring)" />
    <circle cx={50} cy={50} r={41} fill="#FFFFFF" />
    <circle cx={50} cy={50} r={37} fill="#FFD23F" />
    <path d="M22 42 H78 L74 54 Q70 60 62 58 L56 50 H44 L38 58 Q30 60 26 54 Z" fill={K.ink} />
    <path d="M30 46 L36 46" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
    <path d="M38 68 Q50 76 62 68" stroke={K.ink} strokeWidth={4.5} strokeLinecap="round" fill="none" />
  </svg>
);

/**
 * A generic social post framed around the 3D shot (FOTO): a white rounded frame line
 * (x 60-940, y 240-1180) with a header band (y 240-420: sunglasses avatar, «@vida.de.lujo» +
 * verified tick, «Yate privado · Costa Azul», «Seguir», «•••») and a footer band (y 1060-1180: a
 * red heart that throbs and lets little hearts float up, comment and share icons, the likes
 * counter climbing fast to ~98 000 and then ticking on, «#VidaDeLujo #NoFilter»). The middle
 * stays transparent so the shot shows through. Header and footer slide in at `at`, out at `out`.
 * Suggested: at FOTO.POST, out FOTO.REWIND (then RewindFX).
 */
export const SocialPost: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 10) return null;
  const ph = pop(frame, at, { damping: 14, stiffness: 180 });
  const pf = pop(frame, at + 4, { damping: 14, stiffness: 180 });
  const k = leave(frame, out);
  const frameK = ramp(frame, at + 2, at + 12) * (1 - k);
  const likes = 98432 * ramp(frame, at + 8, at + 50, [0, 1], EASE_OUT) + Math.max(0, frame - at - 50) * 41;
  const throb = 1 + 0.18 * Math.max(0, Math.sin((frame - at) * 0.55));
  const floaters: React.ReactNode[] = [];
  for (let i = 0; i < 14; i++) {
    const born = at + 10 + i * 4;
    const d = frame - born;
    if (d < 0 || d > 30) continue;
    const xx = Math.sin(d * 0.25 + i) * 18 + (rand(i * 1.3) - 0.5) * 30;
    floaters.push(
      <div key={i} style={{ position: "absolute", left: xx, top: -d * 9, opacity: 1 - d / 30, transform: `scale(${0.5 + 0.5 * Math.min(1, d / 5)})` }}>
        <HeartIcon size={34 + rand(i * 2.1) * 18} color={i % 3 === 0 ? "#FF7AB6" : "#FF3B5C"} />
      </div>,
    );
  }
  const icon = (d: React.ReactNode) => (
    <svg width={58} height={58} viewBox="0 0 100 100" style={{ display: "block" }}>
      {d}
    </svg>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 60, top: 240, width: 880, height: 940, borderRadius: 40, border: "6px solid #FFFFFF", boxSizing: "border-box", opacity: frameK, boxShadow: "0 0 24px rgba(0,0,0,0.25)" }} />
      {/* Header band */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 240,
          width: 880,
          height: 180,
          borderRadius: "40px 40px 0 0",
          background: "#FFFFFF",
          boxShadow: SOFT_SHADOW,
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "0 30px",
          boxSizing: "border-box",
          fontFamily: UI,
          opacity: clamp01(ph * 3) * (1 - k),
          transform: `translateY(${(1 - ph) * -80 - k * 40}px)`,
        }}
      >
        <LuxAvatar size={112} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 40, color: K.ink, lineHeight: 1 }}>
            @vida.de.lujo
            <VerifiedIcon size={40} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 25, color: K.sub, lineHeight: 1 }}>Yate privado · Costa Azul</div>
        </div>
        <div style={{ padding: "12px 24px", borderRadius: 16, background: K.blue, color: "#FFFFFF", fontWeight: 900, fontSize: 26 }}>Seguir</div>
        <div style={{ fontWeight: 900, fontSize: 36, color: K.ink, letterSpacing: 2 }}>•••</div>
      </div>
      {/* Footer band */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 1060,
          width: 880,
          height: 120,
          borderRadius: "0 0 40px 40px",
          background: "#FFFFFF",
          boxShadow: SOFT_SHADOW,
          padding: "12px 30px",
          boxSizing: "border-box",
          fontFamily: UI,
          opacity: clamp01(pf * 3) * (1 - k),
          transform: `translateY(${(1 - pf) * 80 + k * 40}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22, height: 58 }}>
          <div style={{ position: "relative" }}>
            <div style={{ transform: `scale(${throb})` }}>
              <HeartIcon size={54} />
            </div>
            <div style={{ position: "absolute", left: 10, top: 0 }}>{floaters}</div>
          </div>
          {icon(<path d="M50 14 C74 14 90 29 90 47 C90 65 74 79 50 79 C45 79 40 78 36 77 L16 88 L22 71 C14 65 10 57 10 47 C10 29 26 14 50 14 Z" fill="none" stroke={K.ink} strokeWidth={8} strokeLinejoin="round" />)}
          {icon(<path d="M10 46 L88 14 L64 88 L48 56 Z M48 56 L88 14" fill="none" stroke={K.ink} strokeWidth={8} strokeLinejoin="round" />)}
          <div style={{ marginLeft: "auto", fontWeight: 900, fontSize: 34, color: K.ink, ...TAB }}>
            {fmtThousands(likes)} <span style={{ fontWeight: 700, fontSize: 26, color: K.sub }}>Me gusta</span>
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 28, color: K.blue, marginTop: 6, lineHeight: 1 }}>#VidaDeLujo #NoFilter</div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * VHS rewind over the whole frame: scanlines, three bright tracking bands racing upwards, a
 * cold tint, a jittering horizontal shift, the OSD «◀◀ REBOBINANDO» (top-left, x 90, y 260,
 * blinking) and a timecode running backwards under it. In at `at` (3 frames), out at `out`.
 * Suggested: at FOTO.REWIND, out FOTO.REWIND + 30 (or until the reveal).
 */
export const RewindFX: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 6) return null;
  const vis = ramp(frame, at, at + 3) * (1 - ramp(frame, out, out + 6));
  const t = frame - at;
  const secs = Math.max(0, 754 - t * 9);
  const tc = `00:${pad2(Math.floor(secs / 60) % 60)}:${pad2(secs % 60)}`;
  const jx = (rand(Math.floor(frame / 2) * 3.3) - 0.5) * 10;
  const bands = [0, 1, 2].map((i) => ((1 - ((t * 0.055 + i / 3 + rand(i) * 0.1) % 1)) * 2100) - 100);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: vis }}>
      <AbsoluteFill style={{ background: "rgba(40,70,140,0.16)", mixBlendMode: "multiply" }} />
      <AbsoluteFill
        style={{
          background: "repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)",
          transform: `translateX(${jx}px)`,
        }}
      />
      {bands.map((by, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: -20,
            right: -20,
            top: by,
            height: 34 + i * 16,
            background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.55) 40%, rgba(200,230,255,0.35) 60%, rgba(255,255,255,0))",
            transform: `translateX(${(rand(i + Math.floor(frame / 2)) - 0.5) * 40}px) skewX(-10deg)`,
            filter: "blur(1px)",
          }}
        />
      ))}
      <div style={{ position: "absolute", left: 90, top: 260, fontFamily: UI, fontWeight: 900, color: "#FFFFFF", textShadow: "3px 3px 0 rgba(0,0,0,0.65), -2px 0 0 rgba(255,40,90,0.6), 2px 0 0 rgba(40,220,255,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 64, lineHeight: 1, opacity: blink(frame, at, 10, 5) ? 1 : 0.25, filter: "drop-shadow(3px 3px 0 rgba(0,0,0,0.65))" }}>
          <RewindGlyph size={56} />
          REBOBINANDO
        </div>
        <div style={{ marginTop: 16, fontSize: 40, letterSpacing: 4, ...TAB }}>{tc}</div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// 13. OptionCards

const OPTIONS = [
  { label: "TAREA", color: K.orange, Icon: BooksIcon, x: 210 },
  { label: "TRABAJO", color: K.blue, Icon: BriefcaseIcon, x: 500 },
  { label: "MENSAJES", color: K.pink, Icon: LetterIcon, x: 790 },
];

/**
 * The three options in the top band (y 270-560): white cards (270 x 290, centres x 210 / 500 /
 * 790) «TAREA» (books), «TRABAJO» (briefcase), «MENSAJES» (love letter) popping up from below
 * one by one at `tareaAt`, `trabajoAt`, `mensajeAt` with a tilt, bobbing gently. At `wiggleAt`
 * «MENSAJES» grows, wiggles and glows pink while the other two dim. They drop away one by one
 * at `out`.
 * Suggested: tareaAt FINAL.TAREA, trabajoAt FINAL.TRABAJO, mensajeAt FINAL.MENSAJE, wiggleAt
 * FINAL.SQUINT (or FINAL.TUYO - 10), out FINAL.CARD - 8.
 */
export const OptionCards: React.FC<{ frame: number; tareaAt: number; trabajoAt: number; mensajeAt: number; out: number; wiggleAt?: number }> = ({
  frame,
  tareaAt,
  trabajoAt,
  mensajeAt,
  out,
  wiggleAt,
}) => {
  if (frame < tareaAt || frame > out + 14) return null;
  const ats = [tareaAt, trabajoAt, mensajeAt];
  const wig = wiggleAt !== undefined && frame >= wiggleAt ? ramp(frame, wiggleAt, wiggleAt + 6) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {OPTIONS.map((o, i) => {
        const a = ats[i];
        if (frame < a) return null;
        const p = pop(frame, a, { damping: 9, stiffness: 180 });
        const k = ramp(frame, out + i * 2, out + i * 2 + 9, [0, 1], EASE_IN);
        const t = frame - a;
        const isMsg = i === 2;
        const w = isMsg && wiggleAt !== undefined ? Math.sin((frame - wiggleAt) * 0.9) * 9 * wig * Math.max(0.35, 1 - (frame - wiggleAt) / 40) : 0;
        const grow = isMsg ? 1 + 0.12 * wig : 1;
        const dim = !isMsg ? 1 - 0.35 * wig : 1;
        const rot = (i - 1) * 4 * (1 - p) * 3 + (i - 1) * 3 + Math.sin(t * 0.09 + i) * 1.5 + w;
        return (
          <div
            key={o.label}
            style={{
              position: "absolute",
              left: o.x,
              top: 415 + Math.sin(t * 0.1 + i * 2) * 5,
              width: 270,
              height: 290,
              transform: `translate(-50%, -50%) translateY(${(1 - p) * 160 + k * 120}px) rotate(${rot}deg) scale(${(0.5 + 0.5 * p) * grow * (1 - 0.3 * k)})`,
              opacity: clamp01(p * 3) * (1 - k) * dim,
              borderRadius: 40,
              background: "#FFFFFF",
              border: `6px solid ${isMsg && wig > 0 ? K.pink : "#FFFFFF"}`,
              boxShadow: `${CARD_SHADOW}${isMsg && wig > 0 ? `, 0 0 ${40 * wig}px rgba(255,79,154,0.9)` : ""}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              boxSizing: "border-box",
              fontFamily: UI,
            }}
          >
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 16, background: o.color, borderRadius: "34px 34px 0 0" }} />
            <o.Icon size={140} />
            <div style={{ fontWeight: 900, fontSize: 38, color: o.color, letterSpacing: 1 }}>{o.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 14. EndCard

const VOTES = [
  { label: "TAREA", color: K.orange, Icon: BooksIcon },
  { label: "TRABAJO", color: K.blue, Icon: BriefcaseIcon },
  { label: "MENSAJES", color: K.pink, Icon: LetterIcon },
];

/**
 * Full-screen end card from `at` to the end (~1.5 s): a bold violet -> magenta background that
 * bursts open as a circle from the centre, slowly turning light rays and twinkling sparkles;
 * «¿QUÉ LE / PEDISTE?» in big white/gold letters with a pair of big eyes (👀) looking around;
 * three poll buttons TAREA / TRABAJO / MENSAJES (icon, label, empty radio) popping in one by
 * one; and a «💬 Comenta» bubble with a finger tapping it. Everything lands within ~20 frames.
 * Texts inside x 60-940, y 280-1160. Suggested: at FINAL.CARD.
 */
export const EndCard: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  if (frame < at) return null;
  const t = frame - at;
  const open = ramp(frame, at, at + 9, [0, 1], EASE_OUT);
  const q1 = pop(frame, at + 3, { damping: 10, stiffness: 200 });
  const q2 = pop(frame, at + 6, { damping: 10, stiffness: 200 });
  const eyes = pop(frame, at + 10, { damping: 8, stiffness: 200 });
  const look = Math.sin(t * 0.18) * 0.9;
  const cp = pop(frame, at + 20, { damping: 10, stiffness: 200 });
  const tapPeriod = 14;
  const tt = Math.max(0, t - 24);
  const tap = t >= 24 ? Math.max(0, Math.sin((tt / tapPeriod) * Math.PI * 2)) : 0;
  const press = t >= 24 ? bump(frame, at + 24 + Math.floor(tt / tapPeriod) * tapPeriod + 2, 6) : 0;
  const sparkles = Array.from({ length: 14 }, (_, i) => {
    const sx = 80 + rand(i * 2.7) * 860;
    const sy = 240 + rand(i * 5.1) * 980;
    const tw = Math.max(0, Math.sin(t * 0.25 + i * 1.9));
    return (
      <div key={i} style={{ position: "absolute", left: sx, top: sy, opacity: tw * 0.9 * open, transform: `translate(-50%, -50%) scale(${0.5 + tw * 0.6})` }}>
        <SparkleIcon size={34 + rand(i * 9.1) * 30} color="white" />
      </div>
    );
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ clipPath: `circle(${open * 1500}px at 500px 760px)`, overflow: "hidden" }}>
        <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, #9B5CFF 0%, #6A3CFF 40%, #C2309A 80%, #FF4F9A 100%)" }} />
        <div
          style={{
            position: "absolute",
            left: 500 - 1300,
            top: 700 - 1300,
            width: 2600,
            height: 2600,
            borderRadius: "50%",
            background: "repeating-conic-gradient(rgba(255,255,255,0.10) 0deg 9deg, rgba(255,255,255,0) 9deg 24deg)",
            transform: `rotate(${t * 0.6}deg)`,
          }}
        />
        {sparkles}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 500, top: 370, transform: `translate(-50%, -50%) scale(${q1}) rotate(${-3 * (1 - q1) - 2}deg)`, opacity: clamp01(q1 * 3) }}>
        <HeavyText text="¿QUÉ LE" size={150} colors={TXT_WHITE} stroke={K.ink} />
      </div>
      <div style={{ position: "absolute", left: 500, top: 528, transform: `translate(-50%, -50%) scale(${q2}) rotate(${2 * (1 - q2) + 1.5}deg)`, opacity: clamp01(q2 * 3), display: "flex", alignItems: "center", gap: 22 }}>
        <HeavyText text="PEDISTE?" size={150} colors={TXT_GOLD} stroke={K.ink} />
        <div style={{ transform: `scale(${eyes}) rotate(${Math.sin(t * 0.2) * 6}deg)`, marginTop: -20 }}>
          <EyesIcon size={140} look={look} />
        </div>
      </div>
      {VOTES.map((v, i) => {
        const vp = pop(frame, at + 9 + i * 3, { damping: 11, stiffness: 210 });
        return (
          <div
            key={v.label}
            style={{
              position: "absolute",
              left: 170,
              top: 650 + i * 112,
              width: 660,
              height: 94,
              borderRadius: 999,
              background: "#FFFFFF",
              boxShadow: "0 10px 0 rgba(40,10,80,0.25), 0 18px 30px rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "0 30px 0 14px",
              boxSizing: "border-box",
              transform: `translateX(${(1 - vp) * (i % 2 ? 300 : -300)}px) scale(${0.7 + 0.3 * vp})`,
              opacity: clamp01(vp * 3),
              fontFamily: UI,
            }}
          >
            <div style={{ width: 72, height: 72, borderRadius: 72, background: `${v.color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <v.Icon size={56} />
            </div>
            <div style={{ flex: 1, fontWeight: 900, fontSize: 44, color: v.color, letterSpacing: 1 }}>{v.label}</div>
            <div style={{ width: 44, height: 44, borderRadius: 44, border: `6px solid ${v.color}`, boxSizing: "border-box" }} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 500,
          top: 1050,
          transform: `translate(-50%, -50%) scale(${cp * (1 - 0.08 * press)})`,
          opacity: clamp01(cp * 3),
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 44px 16px 24px",
          borderRadius: 999,
          background: K.yellow,
          border: "6px solid #FFFFFF",
          boxShadow: `0 12px 30px rgba(0,0,0,0.3)${press > 0 ? ", 0 0 0 16px rgba(255,255,255,0.3)" : ""}`,
          fontFamily: UI,
          fontWeight: 900,
          fontSize: 54,
          color: K.ink,
          whiteSpace: "nowrap",
        }}
      >
        <CommentBubbleIcon size={72} dot={K.pink} frame={frame} />
        Comenta
      </div>
      {cp > 0.5 ? (
        <div style={{ position: "absolute", left: 640, top: 1060, transform: `translate(${-tap * 10}px, ${tap * -26}px) rotate(-22deg)`, opacity: clamp01((cp - 0.5) * 4) }}>
          <HandPointer size={130} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

