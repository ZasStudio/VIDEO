import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, pop, ramp, rand } from "../../anim";
import { FONT } from "../../theme";
import { fmtNumber } from "../Graphics";
import { HeavyText } from "../inca/HeavyText";
import { CommentBubbleIcon, HandPointer, INK } from "../inca/icons";

// 2D overlays for "¿Y si toda el agua desapareciera?" (1080 x 1920, 30 fps).
// Same punchy look as the dinosaur / Thanos overlays (thick dark outlines, white-bordered cards
// with hard drop shadows, HeavyText titles, springy pops with a slight wobble), in a water
// palette (blues, aqua) with sunny orange for heat. Everything is driven by the global `frame`
// plus explicit cue frames: no timers, no Math.random (`rand`), no CSS animations. Icons are
// inline SVG (the "ツ" of the commenter's name too: no installed font draws it cleanly).
// TikTok safe zone: keep content inside x 60-940, y 230-1180 (top bar above y 200, the button
// column right of x 940, captions at y 1210-1400, description below y 1400). Each component's
// doc comment gives its footprint at scale 1 and a suggested placement.

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

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

/** Four-point sparkle star centred on (cx, cy). */
const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r} Z`;

/** Small water drop (about 14 x 20 at s = 1) centred on (cx, cy). */
const miniDrop = (cx: number, cy: number, s = 1) =>
  `M${cx} ${cy - 10 * s} C${cx} ${cy - 10 * s} ${cx + 7 * s} ${cy - 1 * s} ${cx + 7 * s} ${cy + 3.5 * s} C${cx + 7 * s} ${cy + 7.5 * s} ${cx + 4 * s} ${cy + 10 * s} ${cx} ${cy + 10 * s} C${cx - 4 * s} ${cy + 10 * s} ${cx - 7 * s} ${cy + 7.5 * s} ${cx - 7 * s} ${cy + 3.5 * s} C${cx - 7 * s} ${cy - 1 * s} ${cx} ${cy - 10 * s} ${cx} ${cy - 10 * s} Z`;

/** Rounded rectangle as a path (starts and ends at the top-left corner's end). */
const rrPath = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y}`;

type IconProps = { size?: number; style?: React.CSSProperties };

const SHADOW = `0 0 0 5px ${INK}, 0 12px 0 5px rgba(0,0,0,0.3), 0 24px 46px rgba(0,0,0,0.28)`;
const TXT_WHITE = ["#FFFFFF", "#FFFFFF", "#E2E4EE"];
const TXT_AQUA = ["#F2FDFF", "#A6EEFF", "#2FB8F2"];
const TXT_BLUE = ["#EAF6FF", "#86D0FF", "#2A7BFF"];
const TXT_ORANGE = ["#FFF6DC", "#FFB547", "#FF6A00"];
const TXT_RED = ["#FFE3E3", "#FF5A5A", "#D0001A"];
const TXT_CREAM = ["#FFFFFF", "#FFF8E0", "#FFE7A6"];
const MARKER_RED = "#FF2A2A";

/** Water drop in a 100 x 100 box (tip at the top). */
const DROP = "M50 5 C50 5 85 46 85 68 C85 88 69 98 50 98 C31 98 15 88 15 68 C15 46 50 5 50 5 Z";

// Advance widths of Luckiest Guy (em), to fit prices into their tag.
const LG_W: Record<string, number> = {
  A: 0.626, B: 0.594, C: 0.515, D: 0.583, E: 0.479, F: 0.487, G: 0.626, H: 0.626, I: 0.297, J: 0.51, K: 0.614, L: 0.452, M: 0.791,
  N: 0.704, Ñ: 0.704, O: 0.638, P: 0.596, Q: 0.691, R: 0.606, S: 0.531, T: 0.543, U: 0.623, V: 0.613, W: 0.908, X: 0.588, Y: 0.607,
  Z: 0.487, Á: 0.626, É: 0.479, Í: 0.297, Ó: 0.638, Ú: 0.623, "¡": 0.278, "!": 0.279, "¿": 0.563, "?": 0.554, " ": 0.195, ".": 0.222,
  "/": 0.42, "+": 0.55, ",": 0.24, "-": 0.382, "0": 0.633, "1": 0.388, "2": 0.509, "3": 0.528, "4": 0.539, "5": 0.531, "6": 0.573,
  "7": 0.506, "8": 0.571, "9": 0.555,
};
const lgWidth = (s: string) => {
  let w = 0;
  for (const ch of Array.from(s)) w += LG_W[ch] ?? 0.62;
  return w;
};

type Tok = { w: string; hi: boolean; br?: boolean };

/** Words of `text`. Words wrapped in `*…*` are highlighted; "\n" forces a line break. */
const tokenize = (text: string): Tok[] => {
  const toks: Tok[] = [];
  let hi = false;
  let cur = "";
  let curHi = false;
  const flush = () => {
    if (cur) toks.push({ w: cur, hi: curHi });
    cur = "";
  };
  for (const ch of text) {
    if (ch === "*") {
      hi = !hi;
      if (!cur) curHi = hi;
      continue;
    }
    if (ch === " ") {
      flush();
      continue;
    }
    if (ch === "\n") {
      flush();
      toks.push({ w: "", hi: false, br: true });
      continue;
    }
    if (!cur) curHi = hi;
    cur += ch;
  }
  flush();
  return toks;
};

// =============================================================================================
// Icons

/** Water drop: aqua-to-blue gradient, dark outline, white highlight. */
export const DropIcon: React.FC<IconProps> = ({ size = 100, style }) => {
  const uid = useUid();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <linearGradient id={`dr${uid}`} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#C4F6FF" />
          <stop offset="0.45" stopColor="#3EC6FF" />
          <stop offset="1" stopColor="#1E6BFF" />
        </linearGradient>
      </defs>
      <path d={DROP} fill={`url(#dr${uid})`} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
      <path d="M31 66 C29 54 34 42 42 32" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" fill="none" opacity={0.9} />
      <circle cx={33} cy={79} r={4.5} fill="#FFFFFF" opacity={0.9} />
    </svg>
  );
};

/** Sprout in a soil mound, swaying, with a drop falling on it every 40 frames. */
const PlantIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const sway = Math.sin(frame * 0.09) * 5;
  const ph = (((frame % 40) + 40) % 40) / 40;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      {ph < 0.8 ? <path d={miniDrop(76, 4 + ph * 40, 0.9)} fill="#3EC6FF" stroke={INK} strokeWidth={3.5} opacity={Math.min(1, (0.8 - ph) * 6)} /> : null}
      <g transform={`rotate(${sway} 50 84)`}>
        <path d="M50 86 C50 70 48 58 52 42" stroke={INK} strokeWidth={12} fill="none" strokeLinecap="round" />
        <path d="M50 86 C50 70 48 58 52 42" stroke="#3DA34A" strokeWidth={5} fill="none" strokeLinecap="round" />
        <Outlined w={7}>
          <path d="M50 60 C38 62 22 56 14 40 C30 32 46 42 50 60 Z" fill="#6BD46E" />
          <path d="M52 48 C58 32 74 24 90 30 C86 48 68 56 52 48 Z" fill="#4CC255" />
        </Outlined>
        <path d="M48 58 C38 54 28 47 21 40" stroke="#2F8F3A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M55 46 C65 40 75 35 84 32" stroke="#2F8F3A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </g>
      <Outlined w={7}>
        <path d="M10 92 C16 72 84 72 90 92 Z" fill="#A0673A" />
      </Outlined>
      <path d="M26 84 C34 79 44 78 52 79" stroke="#C88B57" strokeWidth={4} strokeLinecap="round" fill="none" />
    </svg>
  );
};

/** Orange alarm clock; the minute hand ticks every 5 frames and it rings now and then. */
const ClockIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const step = Math.floor(frame / 5);
  const ring = step % 10 < 2 ? Math.sin(frame * 2.2) * 7 : 0;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = polar(i % 3 === 0 ? 21 : 25, i * 30);
    const [x2, y2] = polar(29, i * 30);
    ticks.push(<line key={i} x1={50 + x1} y1={56 + y1} x2={50 + x2} y2={56 + y2} stroke={INK} strokeWidth={i % 3 === 0 ? 4 : 2.5} strokeLinecap="round" />);
  }
  const [mx, my] = polar(24, step * 30);
  const [hx, hy] = polar(15, -60);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      <g transform={`rotate(${ring} 50 56)`}>
        <Outlined w={7}>
          <path d="M8 32 A17 17 0 0 1 34 12 Z" fill="#FF8A1F" />
          <path d="M92 32 A17 17 0 0 0 66 12 Z" fill="#FF8A1F" />
          <rect x={24} y={84} width={9} height={13} rx={3} transform="rotate(28 28 90)" fill="#E2650C" />
          <rect x={67} y={84} width={9} height={13} rx={3} transform="rotate(-28 72 90)" fill="#E2650C" />
          <circle cx={50} cy={56} r={38} fill="#FF8A1F" />
        </Outlined>
        <circle cx={50} cy={56} r={30} fill="#FFFFFF" />
        {ticks}
        <line x1={50} y1={56} x2={50 + hx} y2={56 + hy} stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <line x1={50} y1={56} x2={50 + mx} y2={56 + my} stroke="#1E6BFF" strokeWidth={4.5} strokeLinecap="round" />
        <circle cx={50} cy={56} r={4.5} fill={INK} />
        <path d="M24 44 C27 34 34 28 42 26" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.85} />
      </g>
    </svg>
  );
};

/** Two mint fins (Nubi's) cupping a water drop, with a little heart: "share". */
const FinsDropIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const uid = useUid();
  const sq = Math.sin(frame * 0.14) * 1.6;
  const beat = 1 + 0.12 * Math.max(0, Math.sin(frame * 0.28));
  const fin = "M5 92 C6 72 15 56 33 47 C31 62 35 75 47 85 C35 94 18 96 5 92 Z";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <linearGradient id={`fd${uid}`} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#C4F6FF" />
          <stop offset="0.45" stopColor="#3EC6FF" />
          <stop offset="1" stopColor="#1E6BFF" />
        </linearGradient>
      </defs>
      <g transform="translate(24 12) scale(0.52)">
        <path d={DROP} fill={`url(#fd${uid})`} stroke={INK} strokeWidth={13} strokeLinejoin="round" />
        <path d="M31 66 C29 54 34 42 42 32" stroke="#FFFFFF" strokeWidth={11} strokeLinecap="round" fill="none" opacity={0.9} />
      </g>
      <g transform={`translate(${-sq} 0)`}>
        <Outlined w={7}>
          <path d={fin} fill="#8EDCA2" />
        </Outlined>
        <path d="M12 86 C16 74 22 64 30 56" stroke="#C9F5D6" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      </g>
      <g transform={`translate(${100 + sq} 0) scale(-1 1)`}>
        <Outlined w={7}>
          <path d={fin} fill="#7FD49A" />
        </Outlined>
      </g>
      <g transform={`translate(80 10) scale(${beat})`}>
        <path d="M0 6 C-2 0 -10 -2 -11 4 C-12 10 -4 14 0 18 C4 14 12 10 11 4 C10 -2 2 0 0 6 Z" fill="#FF5C8A" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      </g>
    </svg>
  );
};

/** Water bottle wrapped in a chain with a padlock: "survive" (keep it for yourself). */
const LockBottleIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const uid = useUid();
  const swing = Math.sin(frame * 0.16) * 7;
  const body = "M41 17 L59 17 L59 24 C59 28 70 31 70 40 L70 88 C70 94 66 97 60 97 L40 97 C34 97 30 94 30 88 L30 40 C30 31 41 28 41 24 Z";
  let wave = "M28 52";
  for (let i = 0; i <= 12; i++) wave += ` L${28 + i * 4} ${(52 + Math.sin(i * 0.9 + frame * 0.2) * 2).toFixed(2)}`;
  wave += " L76 100 L28 100 Z";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <clipPath id={`lb${uid}`}>
          <path d={body} />
        </clipPath>
      </defs>
      <Outlined w={7}>
        <rect x={37} y={4} width={26} height={13} rx={4} fill="#1E6BFF" />
        <path d={body} fill="#E4F8FF" />
      </Outlined>
      <g clipPath={`url(#lb${uid})`}>
        <path d={wave} fill="#3EC6FF" />
        <rect x={30} y={60} width={40} height={6} fill="#FFFFFF" opacity={0.35} />
      </g>
      <path d="M36 36 C34 50 34 70 36 86" stroke="#FFFFFF" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.85} />
      {["M20 44 L80 68", "M20 70 L80 46"].map((d) => (
        <g key={d}>
          <path d={d} stroke={INK} strokeWidth={10} strokeLinecap="round" />
          <path d={d} stroke="#C9D2DC" strokeWidth={5} strokeLinecap="round" strokeDasharray="6 4" />
        </g>
      ))}
      <g transform={`rotate(${swing} 50 57)`}>
        <path d="M41 70 L41 60 C41 49 59 49 59 60 L59 70" stroke={INK} strokeWidth={11} fill="none" strokeLinecap="round" />
        <path d="M41 70 L41 60 C41 49 59 49 59 60 L59 70" stroke="#D5DCE4" strokeWidth={5} fill="none" strokeLinecap="round" />
        <rect x={33} y={66} width={34} height={27} rx={6} fill="#FFB020" stroke={INK} strokeWidth={6} />
        <rect x={37} y={69} width={26} height={6} rx={3} fill="#FFE08A" opacity={0.8} />
        <circle cx={50} cy={78} r={4} fill={INK} />
        <path d="M48 79 L47 87 L53 87 L52 79 Z" fill={INK} />
      </g>
    </svg>
  );
};

// =============================================================================================
// CommentReply

/** Katakana "ツ" drawn as three strokes (the system CJK fallbacks are pixel fonts). */
const TsuGlyph: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg
    width={size * 0.9}
    height={size}
    viewBox="0 0 90 100"
    style={{ display: "inline-block", verticalAlign: "-0.13em", marginLeft: size * 0.08, overflow: "visible" }}
  >
    <path d="M11 32 L21 52 M33 24 L42 44 M80 22 C78 58 58 82 22 92" stroke={color} strokeWidth={11} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Speech bubble with three dots, in the light TikTok sticker style (like the 💬 emoji). */
const ChatGlyph: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible" }}>
    <path
      d="M50 12 C76 12 92 27 92 46 C92 65 76 79 50 79 C45 79 40 78.4 36 77.2 L15 89 L22 71 C13.5 65 8 56 8 46 C8 27 24 12 50 12 Z"
      fill="#F2F4F7"
      stroke="#9A9EA6"
      strokeWidth={8}
      strokeLinejoin="round"
    />
    {[31, 50, 69].map((cx) => (
      <circle key={cx} cx={cx} cy={46} r={6.5} fill="#9A9EA6" />
    ))}
  </svg>
);

/**
 * TikTok "reply to comment" sticker: a white rounded card with a soft shadow and a little tail
 * at the bottom-left; a grey "Respondiendo tu comentario" label with a chat-bubble icon on top,
 * then the commenter's round avatar (staticFile("agua/nael.png")), the name "Naelツ" in bold
 * (the "ツ" is drawn) and the comment. Pops in at `at`, gets a little tap at at + 8 (squish,
 * ripple inside and a white ring outside), floats gently, shrinks out at `out`. `x`, `y` = card
 * centre; ~480 x 170 (x ± 240, y ± 85, the tail adds ~18 px below). Suggested: x 300, y 330
 * (top-left corner of the safe area).
 */
export const CommentReply: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  scale?: number;
  name?: string;
  comment?: string;
  avatar?: string;
  label?: string;
}> = ({
  frame,
  at,
  out,
  x,
  y,
  scale = 1,
  name = "Naelツ",
  comment = "Que Pasaría Si No Hubiera agua",
  avatar = "agua/nael.png",
  label = "Respondiendo tu comentario",
}) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 10, stiffness: 200 });
  const k = leave(frame, out, 9);
  const tapAt = at + 8;
  const squish = bump(frame, tapAt, 8);
  const rip = frame >= tapAt && frame < tapAt + 22 ? (frame - tapAt) / 22 : -1;
  const settle = ramp(frame, at + 6, at + 30);
  const floatY = Math.sin(t * 0.075) * 6 * settle;
  const rot = -2.5 + (1 - p) * -10 + Math.sin(t * 0.06 + 1) * 0.7 * settle;
  const W = 480;
  const R = 460;
  const nameParts = name.split("ツ");
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${scale * (1 - k)})`, opacity: 1 - k, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${p * (1 - 0.05 * squish)}) rotate(${rot}deg)`,
          opacity: Math.min(1, p * 3),
        }}
      >
        {rip >= 0 ? (
          <div
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: 36,
              border: `${9 * (1 - rip)}px solid rgba(255,255,255,0.95)`,
              transform: `scale(${1 + rip * 0.16}, ${1 + rip * 0.4})`,
              opacity: 1 - rip,
            }}
          />
        ) : null}
        <div
          style={{
            position: "relative",
            boxSizing: "border-box",
            width: W,
            padding: "14px 24px 18px 18px",
            borderRadius: 30,
            background: "#FFFFFF",
            boxShadow: "0 16px 36px rgba(0,0,0,0.34), 0 4px 10px rgba(0,0,0,0.2)",
          }}
        >
          <svg width={40} height={24} viewBox="0 0 40 24" style={{ position: "absolute", left: 34, bottom: -20, overflow: "visible" }}>
            <path d="M0 0 L36 0 L6 22 Z" fill="#FFFFFF" />
          </svg>
          <div style={{ position: "absolute", inset: 0, borderRadius: 30, overflow: "hidden" }}>
            {rip >= 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: W * 0.72 - R * rip,
                  top: 100 - R * rip,
                  width: 2 * R * rip,
                  height: 2 * R * rip,
                  borderRadius: "50%",
                  background: "rgba(30,140,255,0.16)",
                  opacity: 1 - rip,
                }}
              />
            ) : null}
          </div>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: FONT.heavy,
              fontWeight: 700,
              fontSize: 21,
              color: "#8A8B91",
              whiteSpace: "nowrap",
            }}
          >
            {label}
            <ChatGlyph size={30} />
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 16, marginTop: 10 }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: "#DDE3EA",
                boxShadow: "0 0 0 3px #FFFFFF, 0 0 0 5px #E3E6EB",
              }}
            >
              <Img src={staticFile(avatar)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.1)" }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: FONT.heavy, fontWeight: 800, fontSize: 25, lineHeight: 1.1, color: "#161823", whiteSpace: "nowrap" }}>
                {nameParts.map((pt, i) => (
                  <React.Fragment key={i}>
                    {pt}
                    {i < nameParts.length - 1 ? <TsuGlyph size={25} color="#161823" /> : null}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ fontFamily: FONT.heavy, fontWeight: 700, fontSize: 30, lineHeight: 1.14, color: "#2A2C33", marginTop: 4 }}>{comment}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// WaterMeter

const DROP_G = "M50 4 C50 4 90 52 90 80 C90 102 72 116 50 116 C28 116 10 102 10 80 C10 52 50 4 50 4 Z";

/**
 * "AGUA EN EL PLANETA" gauge: a navy card with a glass drop on the left whose wavy water level
 * drains (bubbles inside, steam wisps rising while it drains) and a % counter on the right
 * (aqua > 50 %, orange > 20 %, then red), 100 % -> 0 % between `from` and `to`. At 0 % the card
 * shakes, the rim flashes red, cracks appear in the empty drop and "¡0%!" blinks red until it
 * leaves (`out`, default to + 30). Pops in at `at` (default from - 8). `x`, `y` = card centre;
 * ~340 x 150 plus the label tab (~25 px above): x ± 170, y - 100 … y + 80.
 * Suggested: x 770, y 330 (top-right corner of the safe area).
 */
export const WaterMeter: React.FC<{
  frame: number;
  from: number;
  to: number;
  x: number;
  y: number;
  scale?: number;
  at?: number;
  out?: number;
  label?: string;
}> = ({ frame, from, to, x, y, scale = 1, at, out, label = "AGUA EN EL PLANETA" }) => {
  const uid = useUid();
  const inAt = at ?? from - 8;
  const outAt = out ?? to + 30;
  if (frame < inAt || frame > outAt + 10) return null;
  const t = frame - inAt;
  const p = pop(frame, inAt, { damping: 11, stiffness: 190 });
  const k = leave(frame, outAt, 9);
  const v = 1 - ramp(frame, from, to, [0, 1], EASE_IN_OUT);
  const empty = frame >= to;
  const draining = frame >= from && !empty;
  const alarm = empty ? blink(frame, to, 5, 4) : 0;
  const hit = bump(frame, to, 10);
  const shx = empty ? jit(frame, 3, 1) * 8 * Math.max(0, 1 - (frame - to) / 16) : 0;
  const pct = Math.round(v * 100);
  const txt = empty ? TXT_RED : v > 0.5 ? TXT_AQUA : v > 0.2 ? TXT_ORANGE : TXT_RED;
  const level = 116 - v * 112;
  const amp = v > 0.01 ? 3.4 : 0;
  const wave = (ph: number, a: number) => {
    let d = `M-2 ${level}`;
    for (let i = 0; i <= 26; i++) {
      const xx = -2 + i * 4;
      d += ` L${xx} ${(level + Math.sin(xx * 0.12 + t * 0.28 + ph) * a).toFixed(2)}`;
    }
    return `${d} L102 124 L-2 124 Z`;
  };
  const bubbles: React.ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const by = 116 - ((t * (0.9 + rand(i * 2.3) * 0.8) + rand(i * 5.1) * 112) % 112);
    if (by < level + 6) continue;
    bubbles.push(<circle key={i} cx={28 + rand(i * 3.7) * 44} cy={by} r={2 + rand(i * 7.1) * 2.5} fill="#FFFFFF" opacity={0.65} />);
  }
  const wisps: React.ReactNode[] = [];
  if (draining) {
    for (let i = 0; i < 3; i++) {
      const ph = (((t * 1.1 + i * 13) % 40) + 40) % 40 / 40;
      const wx = 32 + i * 18;
      const wy = level - 6 - ph * 46;
      wisps.push(
        <path
          key={i}
          d={`M${wx} ${wy + 16} C${wx - 7} ${wy + 10} ${wx + 7} ${wy + 6} ${wx} ${wy}`}
          stroke="#FFFFFF"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          opacity={Math.sin(ph * Math.PI) * 0.85}
        />,
      );
    }
  }
  const crack = empty ? ramp(frame, to + 2, to + 10) : 0;
  const rim = alarm ? "#FF3B30" : "#FFFFFF";
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `translateX(${shx}px) scale(${scale * (1 - k)})`, opacity: 1 - k, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(-50%, -50%) scale(${p}) rotate(${2 + (1 - p) * 12 + Math.sin(t * 0.06) * 0.6}deg)`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 340,
            height: 150,
            boxSizing: "border-box",
            borderRadius: 44,
            background: "linear-gradient(160deg, #1D5BB0 0%, #0C2C66 100%)",
            border: `6px solid ${rim}`,
            boxShadow: `0 0 0 4px ${INK}, 0 10px 0 4px rgba(0,0,0,0.3), 0 0 ${empty ? 26 + 20 * hit : 0}px rgba(255,60,60,0.75)`,
            display: "flex",
            alignItems: "center",
            padding: "12px 10px 4px 14px",
            gap: 4,
          }}
        >
          <svg width={104} height={124} viewBox="0 0 100 120" style={{ display: "block", overflow: "visible", flexShrink: 0 }}>
            <defs>
              <clipPath id={`wm${uid}`}>
                <path d={DROP_G} />
              </clipPath>
              <linearGradient id={`wg${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="116">
                <stop offset="0" stopColor="#8BEAFF" />
                <stop offset="0.5" stopColor="#27B5F5" />
                <stop offset="1" stopColor="#1E5FE0" />
              </linearGradient>
            </defs>
            {wisps}
            <path d={DROP_G} fill="#0F2747" stroke={alarm ? "#FF3B30" : INK} strokeWidth={9} strokeLinejoin="round" />
            <g clipPath={`url(#wm${uid})`}>
              <path d={DROP_G} fill="#163A66" />
              <path d={wave(2.1, amp * 0.8)} fill="#8BEAFF" opacity={0.45} />
              <path d={wave(0, amp)} fill={`url(#wg${uid})`} />
              {bubbles}
              {crack > 0 ? (
                <path
                  d="M24 98 L36 90 L34 80 M36 90 L50 96 L60 86 L58 76 M50 96 L54 108 M60 86 L74 92"
                  stroke="#FF9A3D"
                  strokeWidth={3.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={100}
                  strokeDasharray="100 100"
                  strokeDashoffset={100 * (1 - crack)}
                />
              ) : null}
              {hit > 0 ? <rect x={0} y={0} width={100} height={120} fill="#FF5A5A" opacity={hit * 0.6} /> : null}
            </g>
            <path d="M29 82 C26 66 32 48 42 34" stroke="#FFFFFF" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.75} />
            <circle cx={31} cy={95} r={3.5} fill="#FFFFFF" opacity={0.75} />
          </svg>
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              opacity: empty ? (alarm ? 1 : 0.35) : 1,
              transform: `scale(${(empty ? 1.06 : 1) + 0.3 * hit}) rotate(${empty ? -4 : 0}deg)`,
            }}
          >
            <div style={{ paddingTop: 18 }}>
              <HeavyText text={empty ? "¡0%!" : `${pct}%`} size={empty ? 74 : 70} colors={txt} />
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translate(-50%, -64%) rotate(-2deg)",
            padding: "5px 18px 4px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #5CD6FF 0%, #1E7BFF 100%)",
            border: "4px solid #FFFFFF",
            boxShadow: `0 0 0 4px ${INK}, 0 6px 0 4px rgba(0,0,0,0.28)`,
            whiteSpace: "nowrap",
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 21,
            letterSpacing: 1,
            color: "#FFFFFF",
            WebkitTextStroke: `5px ${INK}`,
            paintOrder: "stroke fill",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// FreezeLabel

/**
 * Freeze-frame meme ("SÍ, ESE SOY YO"): a white flash at `at`, then the whole frame underneath
 * turns grayscale with a little extra contrast (backdrop filter) and a soft vignette; a red
 * hand-drawn marker arrow draws itself down onto (x, y) (the character) and the label is
 * "written" letter by letter above it (Lilita One, white with a dark outline, each letter a bit
 * crooked) with a red marker underline. At `out` the colour comes back and the label and arrow
 * pop away (7 frames). Full-frame component. The label sits at y + labelDy (default -300; its
 * centre x is clamped to the safe area, ~610 px wide); the arrow ends ~16 px above (x, y).
 */
export const FreezeLabel: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  text?: string;
  scale?: number;
  labelDx?: number;
  labelDy?: number;
}> = ({ frame, at, out, x, y, text = "SÍ, ESE SOY YO", scale = 1, labelDx = 0, labelDy = -300 }) => {
  if (frame < at || frame > out + 8) return null;
  const k = leave(frame, out, 7);
  const g = ramp(frame, at, at + 2) * (1 - k);
  const flash = 1 - ramp(frame, at, at + 9, [0, 1], EASE_OUT);
  const chars = Array.from(text);
  const size = 92 * scale;
  const estW = chars.length * size * 0.5;
  const lx = Math.max(60 + estW / 2, Math.min(940 - estW / 2, x + labelDx));
  const ly = y + labelDy * scale;
  const sx = lx + (x - lx) * 0.3 + 34 * scale;
  const sy = ly + size * 0.82;
  const ex = x;
  const ey = y - 16 * scale;
  const bend = (x <= lx ? 1 : -1) * 120 * scale;
  const cx = (sx + ex) / 2 + bend;
  const cy = (sy + ey) / 2 - 20 * scale;
  const arrowD = `M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`;
  const arrowD2 = `M${sx + 5} ${sy + 2} Q${cx + 9} ${cy - 8} ${ex + 3} ${ey - 4}`;
  const dx = ex - cx;
  const dy = ey - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const hl = 54 * scale;
  const headPt = (a: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return `${ex - (ux * c - uy * s) * hl} ${ey - (ux * s + uy * c) * hl}`;
  };
  const headD = `M${headPt(0.52)} L${ex} ${ey} L${headPt(-0.48)}`;
  const ap = ramp(frame, at + 6, at + 14, [0, 1], EASE_IN_OUT);
  const hp = ramp(frame, at + 14, at + 18, [0, 1], EASE_OUT);
  const doneAt = at + 3 + chars.length * 1.2;
  const ul = ramp(frame, doneAt + 2, doneAt + 9, [0, 1], EASE_IN_OUT);
  const u0 = lx - estW / 2;
  const uy0 = ly + size * 0.64;
  const ulD = `M${u0} ${uy0 + 6} C${u0 + estW * 0.3} ${uy0 - 4} ${u0 + estW * 0.7} ${uy0 + 12} ${u0 + estW} ${uy0}`;
  const pen = (d: string, w: number, prog: number, outline: boolean, op = 1) => (
    <>
      {outline ? (
        <path d={d} stroke={INK} strokeWidth={w + 9 * scale} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - prog)} />
      ) : null}
      <path d={d} stroke={MARKER_RED} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - prog)} opacity={op} />
    </>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {g > 0.001 ? (
        <AbsoluteFill
          style={{
            backdropFilter: `grayscale(${g}) contrast(${1 + 0.15 * g})`,
            WebkitBackdropFilter: `grayscale(${g}) contrast(${1 + 0.15 * g})`,
          }}
        />
      ) : null}
      <AbsoluteFill style={{ opacity: g * 0.8, background: "radial-gradient(ellipse 80% 65% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)" }} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: 1 - k }}>
        {ap > 0 ? pen(arrowD, 13 * scale, ap, true) : null}
        {hp > 0 ? pen(headD, 13 * scale, hp, true) : null}
        {ap > 0 ? pen(arrowD2, 6 * scale, ap, false, 0.6) : null}
        {ul > 0 ? pen(ulD, 10 * scale, ul, true) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: lx,
          top: ly,
          display: "flex",
          whiteSpace: "nowrap",
          transform: `translate(-50%, -50%) rotate(-4deg) scale(${1 - 0.4 * k})`,
          opacity: 1 - k,
          fontFamily: FONT.fun,
          fontSize: size,
          lineHeight: 1,
          color: "#FFFFFF",
          WebkitTextStroke: `${size * 0.15}px ${INK}`,
          paintOrder: "stroke fill",
          textShadow: `0 ${size * 0.07}px 0 rgba(0,0,0,0.4)`,
        }}
      >
        {chars.map((ch, i) => {
          const la = at + 3 + i * 1.2;
          const lp = pop(frame, la, { damping: 12, stiffness: 260 });
          const glyph = ch === " " ? " " : ch;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: frame >= la ? 1 : 0,
                transform: `translateY(${(rand(i * 5.7 + 1) - 0.5) * 12 * scale}px) rotate(${(rand(i * 3.1 + 2) - 0.5) * 14}deg) scale(${0.3 + 0.7 * lp})`,
              }}
            >
              {glyph}
            </span>
          );
        })}
      </div>
      {flash > 0.001 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash * 0.95 }} /> : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// RewindCard

const OSD: React.CSSProperties = {
  fontFamily: FONT.heavy,
  fontWeight: 900,
  color: "#FFFFFF",
  letterSpacing: 3,
  whiteSpace: "nowrap",
  lineHeight: 1,
  textShadow: "3px 3px 0 rgba(0,0,0,0.6), -2px 0 0 rgba(255,0,90,0.55), 2px 0 0 rgba(0,220,255,0.55)",
};
const OSD_SVG_FILTER = "drop-shadow(3px 3px 0 rgba(0,0,0,0.6)) drop-shadow(-2px 0 0 rgba(255,0,90,0.55)) drop-shadow(2px 0 0 rgba(0,220,255,0.55))";

/** Text block that glitches with `amount` (0-1): RGB split plus horizontal slices shifted sideways. */
const Glitchy: React.FC<{ frame: number; amount: number; seed: number; children: React.ReactNode }> = ({ frame, amount, seed, children }) => {
  if (amount <= 0.02) return <div style={{ position: "relative" }}>{children}</div>;
  const split = 2 + 12 * amount;
  const cuts = [0];
  let c = 0;
  while (c < 100) {
    c = Math.min(100, c + 14 + rand(frame * 1.7 + cuts.length * 3.1 + seed) * 30);
    cuts.push(c);
  }
  return (
    <div
      style={{
        position: "relative",
        filter: `drop-shadow(${-split}px 0 0 rgba(255,0,90,0.85)) drop-shadow(${split}px 0 0 rgba(0,230,255,0.85))`,
      }}
    >
      <div style={{ visibility: "hidden" }}>{children}</div>
      {cuts.slice(0, -1).map((a, i) => {
        const b = cuts[i + 1];
        const dxs = (rand(frame * 3.3 + i * 1.7 + seed) - 0.5) * 2 * 60 * amount;
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, clipPath: `inset(${a}% -30% ${100 - b}% -30%)`, transform: `translateX(${dxs}px)` }}>
            {children}
          </div>
        );
      })}
    </div>
  );
};

/** Clock whose hands spin backwards (accelerating), with a motion trail and CCW arrows around it. */
const RewindClock: React.FC<{ t: number }> = ({ t }) => {
  const minA = -(t * 16 + t * t * 1.5);
  const hourA = minA / 12;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = polar(i % 3 === 0 ? 92 : 100, i * 30);
    const [x2, y2] = polar(112, i * 30);
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={i % 3 === 0 ? 9 : 5} strokeLinecap="round" />);
  }
  const [mx, my] = polar(98, minA);
  const [hx, hy] = polar(62, hourA);
  const [t1x, t1y] = polar(100, minA);
  const [t2x, t2y] = polar(100, minA + 75);
  const arrows: React.ReactNode[] = [];
  for (const [a1, a2] of [
    [30, 150],
    [210, 330],
  ]) {
    const [sx, sy] = polar(160, a1);
    const [ex2, ey2] = polar(160, a2);
    const d = `M${sx} ${sy} A160 160 0 0 1 ${ex2} ${ey2}`;
    const rad = (a1 * Math.PI) / 180;
    const tx = -Math.cos(rad);
    const ty = -Math.sin(rad);
    const nx = Math.sin(rad);
    const ny = -Math.cos(rad);
    const head = `M${sx + tx * 30} ${sy + ty * 30} L${sx + nx * 22} ${sy + ny * 22} L${sx - nx * 22} ${sy - ny * 22} Z`;
    arrows.push(
      <g key={a1}>
        <path d={d} stroke={INK} strokeWidth={22} fill="none" strokeLinecap="round" />
        <path d={head} fill={INK} stroke={INK} strokeWidth={10} strokeLinejoin="round" />
        <path d={d} stroke="#7FE6FF" strokeWidth={11} fill="none" strokeLinecap="round" />
        <path d={head} fill="#7FE6FF" />
      </g>,
    );
  }
  return (
    <svg width={400} height={400} viewBox="-200 -200 400 400" style={{ display: "block", overflow: "visible" }}>
      <g transform={`rotate(${-t * 9})`}>{arrows}</g>
      <circle r={130} fill="#FFFFFF" stroke={INK} strokeWidth={14} />
      <circle r={116} fill="none" stroke="#BDEBFF" strokeWidth={8} />
      {ticks}
      <path d={`M0 0 L${t1x} ${t1y} A100 100 0 0 1 ${t2x} ${t2y} Z`} fill="rgba(39,181,245,0.35)" />
      <line x1={0} y1={0} x2={hx} y2={hy} stroke={INK} strokeWidth={14} strokeLinecap="round" />
      <line x1={0} y1={0} x2={mx} y2={my} stroke="#1E6BFF" strokeWidth={9} strokeLinecap="round" />
      <circle r={11} fill={INK} />
    </svg>
  );
};

/** "◀◀" / "▶" OSD glyphs. */
const OsdArrows: React.FC<{ kind: "rew" | "play"; h: number }> = ({ kind, h }) => (
  <svg width={kind === "rew" ? h * 1.7 : h * 0.9} height={h} viewBox={kind === "rew" ? "0 0 52 30" : "0 0 27 30"} style={{ display: "block", overflow: "visible", filter: OSD_SVG_FILTER }}>
    {kind === "rew" ? <path d="M25 0 L0 15 L25 30 Z M52 0 L27 15 L52 30 Z" fill="#FFFFFF" /> : <path d="M0 0 L27 15 L0 30 Z" fill="#FFFFFF" />}
  </svg>
);

/**
 * VHS rewind, full frame. For the first `dur` frames (24) from `at`: the picture underneath is
 * dimmed and desaturated, with rolling scan lines and tracking-noise bands racing upwards,
 * "◀◀ REBOBINANDO" blinking top-left with a tape counter running back to -2:00:00, a clock
 * whose hands spin backwards (accelerating) under two counter-clockwise arrows, and the big
 * `text` ("DOS HORAS" / "ANTES") glitching in (RGB split, sliced rows). Then a tracking band and
 * a flash, and until `out` only a small VHS on-screen tag stays top-left ("▶ PLAY · 2 HORAS
 * ANTES", ~560 x 50 at x 70-630, y 250-300), which glitches away at `out`.
 */
export const RewindCard: React.FC<{ frame: number; at: number; out: number; text?: string; tag?: string; dur?: number }> = ({
  frame,
  at,
  out,
  text = "DOS HORAS ANTES",
  tag = "PLAY · 2 HORAS ANTES",
  dur = 24,
}) => {
  if (frame < at || frame > out + 8) return null;
  const t = frame - at;
  const sIn = ramp(frame, at, at + 3);
  const sOut = ramp(frame, at + dur, at + dur + 5, [0, 1], EASE_IN);
  const s = sIn * (1 - sOut);
  const words = text.split(" ");
  const lines = words.length > 2 ? [words.slice(0, -1).join(" "), words[words.length - 1]] : words.length === 2 ? words : [text];
  // tape counter
  const secs = Math.round(7200 * ramp(frame, at + 1, at + dur - 3, [0, 1], EASE_IN));
  const two = (n: number) => `0${n}`.slice(-2);
  const counter = `-${Math.floor(secs / 3600)}:${two(Math.floor(secs / 60) % 60)}:${two(secs % 60)}`;
  // noise
  const noise: React.ReactNode[] = [];
  if (s > 0.01) {
    for (let b = 0; b < 3; b++) {
      const bh = 50 + rand(b * 7.7) * 100;
      const by = ((((rand(b * 3.1) * 2100 - t * 110) % 2100) + 2100) % 2100) - 120;
      noise.push(<rect key={`b${b}`} x={0} y={by} width={1080} height={bh} fill="#FFFFFF" opacity={0.1} />);
      noise.push(<rect key={`l${b}`} x={0} y={by} width={1080} height={4} fill="#FFFFFF" opacity={0.55} />);
      for (let i = 0; i < 46; i++) {
        const sd = frame * 13.1 + b * 101.7 + i * 7.3;
        noise.push(
          <rect
            key={`n${b}-${i}`}
            x={rand(sd) * 1080}
            y={by + rand(sd + 1.3) * bh}
            width={8 + rand(sd + 2.1) * 130}
            height={2 + rand(sd + 3.7) * 5}
            fill={rand(sd + 4.4) < 0.7 ? "#FFFFFF" : "#9FB4C8"}
            opacity={0.35 + rand(sd + 5.9) * 0.6}
          />,
        );
      }
    }
    for (let i = 0; i < 5; i++) {
      const sd = frame * 5.3 + i * 31.1;
      noise.push(<rect key={`s${i}`} x={0} y={rand(sd) * 1920} width={1080} height={1 + rand(sd + 1) * 3} fill="#FFFFFF" opacity={0.25 + rand(sd + 2) * 0.4} />);
    }
  }
  const endBand = ramp(frame, at + dur - 3, at + dur + 3, [0, 1], EASE_IN_OUT);
  const flash = bump(frame, at + dur - 1, 7);
  const clockIn = pop(frame, at + 1, { damping: 10, stiffness: 220 });
  // tag
  const tagIn = frame >= at + dur ? pop(frame, at + dur, { damping: 14, stiffness: 240 }) : 0;
  const k = leave(frame, out, 6);
  const tg = Math.floor(frame / 2);
  const tagGlitch = (frame >= at + dur && frame < at + dur + 4) || (frame >= out) || rand(tg * 2.71 + 0.3) < 0.05;
  const tagDx = tagGlitch ? jit(frame, 7, 1) * 10 : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {s > 0.01 ? (
        <>
          <AbsoluteFill
            style={{
              backdropFilter: `saturate(${1 - 0.65 * s}) contrast(${1 + 0.25 * s}) brightness(${1 - 0.3 * s}) blur(${1.5 * s}px)`,
              WebkitBackdropFilter: `saturate(${1 - 0.65 * s}) contrast(${1 + 0.25 * s}) brightness(${1 - 0.3 * s}) blur(${1.5 * s}px)`,
            }}
          />
          <AbsoluteFill style={{ background: "rgba(6,12,40,0.5)", opacity: s }} />
          <AbsoluteFill
            style={{
              opacity: s,
              backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0.34) 0px, rgba(0,0,0,0.34) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)",
              backgroundPosition: `0 ${-(t * 2) % 6}px`,
            }}
          />
          <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: s }}>
            {noise}
          </svg>
          <div style={{ position: "absolute", left: 500, top: 560, transform: `translate(-50%, -50%) scale(${clockIn * (1 - 0.3 * sOut)}) translateX(${jit(frame, 2, 2) * 4}px)`, opacity: s }}>
            <RewindClock t={t} />
          </div>
          {lines.map((ln, i) => {
            const la = at + 5 + i * 3;
            if (frame < la) return null;
            const lp = pop(frame, la, { damping: 11, stiffness: 240 });
            const fresh = Math.max(0, 1 - (frame - la) / 7);
            const amount = Math.max(fresh, rand(Math.floor(frame / 2) * 1.37 + i * 9.1) < 0.25 ? 0.45 : 0, sOut);
            const size = i === 0 ? 118 : 150;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 500,
                  top: 850 + i * 140,
                  transform: `translate(-50%, -50%) translateX(${jit(frame, 5 + i, 1) * 26 * fresh}px) scale(${lp}, ${lp * (1 - 0.9 * sOut)}) rotate(${i ? 2 : -2}deg)`,
                  opacity: Math.min(1, lp * 2) * s,
                }}
              >
                <Glitchy frame={frame} amount={amount} seed={i * 17}>
                  <div style={{ paddingTop: size * 0.28 }}>
                    <HeavyText text={ln} size={size} colors={i === 0 ? TXT_WHITE : TXT_AQUA} />
                  </div>
                </Glitchy>
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 76, top: 262, opacity: s }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: blink(frame, at, 8, 5) ? 1 : 0.25 }}>
              <OsdArrows kind="rew" h={44} />
              <div style={{ ...OSD, fontSize: 50 }}>REBOBINANDO</div>
            </div>
            <div style={{ ...OSD, fontSize: 38, marginTop: 14, letterSpacing: 4 }}>{counter}</div>
          </div>
          {endBand > 0 && endBand < 1 ? (
            <div style={{ position: "absolute", left: 0, width: 1080, top: 1920 * (1 - endBand) - 120, height: 240, background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 100%)" }} />
          ) : null}
        </>
      ) : null}
      {flash > 0 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash * 0.6 }} /> : null}
      {tagIn > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 252,
            display: "flex",
            alignItems: "center",
            gap: 14,
            transform: `translateX(${tagDx}px) scale(${tagIn * (1 - k)}, ${tagIn * (1 - 0.9 * k)})`,
            transformOrigin: "0% 50%",
            opacity: (1 - k) * (0.92 + 0.08 * rand(frame * 1.31)),
            filter: tagGlitch ? "drop-shadow(-5px 0 0 rgba(255,0,90,0.8)) drop-shadow(5px 0 0 rgba(0,225,255,0.8))" : undefined,
          }}
        >
          <OsdArrows kind="play" h={38} />
          <div style={{ ...OSD, fontSize: 40 }}>{tag}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// FactChip

/**
 * Compact fact card ("DATO REAL"): a pale-aqua card (white border, dark outline, hard shadow)
 * with a round icon badge on the left (drop / plant / clock, each lightly animated), 1–2 lines
 * of heavy text whose words pop in one by one, and a blue label tab on its top edge. Words in
 * `*…*` turn blue and get a yellow highlighter swipe at `highlightAt` (default at + 16). Pops in
 * at `at`, shrinks out at `out`. `x`, `y` = card centre; ~700 x 180 (x ± 350, y - 115 … y + 100
 * with the tab). Suggested: x 500, y 400-1000.
 */
export const FactChip: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  text: string;
  label?: string;
  icon?: "drop" | "plant" | "clock";
  highlightAt?: number;
  width?: number;
  scale?: number;
  rotate?: number;
}> = ({ frame, at, out, x, y, text, label = "DATO REAL", icon = "drop", highlightAt, width = 700, scale = 1, rotate = -1.5 }) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 11, stiffness: 190 });
  const k = leave(frame, out, 9);
  const tabIn = pop(frame, at + 3, { damping: 9, stiffness: 230 });
  const iconIn = pop(frame, at + 5, { damping: 8, stiffness: 200 });
  const textAt = at + 5;
  const hiAt = highlightAt ?? at + 16;
  const toks = tokenize(text);
  const plain = text.replace(/\*/g, "");
  const fs = plain.length <= 44 ? 40 : plain.length <= 56 ? 36 : 32;
  let wordIdx = 0;
  let hiIdx = 0;
  const hiPulse = bump(frame, hiAt, 12);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        transform: `translate(-50%, -50%) scale(${p * (1 - k) * scale}) rotate(${rotate + (1 - p) * -10 + Math.sin(t * 0.06) * 0.5}deg)`,
        opacity: Math.min(1, p * 3) * (1 - k),
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 22,
          minHeight: 176,
          boxSizing: "border-box",
          padding: "34px 30px 22px 22px",
          borderRadius: 38,
          background: "linear-gradient(180deg, #FFFFFF 0%, #E3F6FF 100%)",
          border: "6px solid #FFFFFF",
          boxShadow: SHADOW,
        }}
      >
        <div
          style={{
            width: 118,
            height: 118,
            flexShrink: 0,
            borderRadius: "50%",
            boxSizing: "border-box",
            background: "radial-gradient(circle at 35% 30%, #E9FBFF 0%, #93E2FF 55%, #3EB0F0 100%)",
            border: "5px solid #FFFFFF",
            boxShadow: `0 0 0 5px ${INK}, 0 6px 0 5px rgba(0,0,0,0.2)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${iconIn * (1 + 0.1 * hiPulse)}) rotate(${(1 - iconIn) * -30 + Math.sin(t * 0.08) * 3}deg)`,
          }}
        >
          {icon === "drop" ? (
            <DropIcon size={78} style={{ transform: `translateY(${Math.sin(t * 0.12) * 3 - 2}px)` }} />
          ) : icon === "plant" ? (
            <PlantIcon size={84} frame={frame} style={{ marginTop: -4 }} />
          ) : (
            <ClockIcon size={84} frame={frame} />
          )}
        </div>
        <div style={{ flex: 1, fontFamily: FONT.heavy, fontWeight: 900, fontSize: fs, lineHeight: 1.2, color: INK, letterSpacing: 0.2 }}>
          {toks.map((tk, i) => {
            if (tk.br) return <br key={i} />;
            const wi = wordIdx++;
            const wa = textAt + wi * 1.5;
            const pw = pop(frame, wa, { damping: 12, stiffness: 230 });
            let hb = 0;
            let sw = 0;
            if (tk.hi) {
              hb = bump(frame, hiAt + hiIdx * 3, 10);
              sw = ramp(frame, hiAt + hiIdx * 3, hiAt + hiIdx * 3 + 7, [0, 1], EASE_OUT);
              hiIdx++;
            }
            const lit = tk.hi && frame >= hiAt;
            return (
              <React.Fragment key={i}>
                <span
                  style={{
                    position: "relative",
                    display: "inline-block",
                    isolation: "isolate",
                    color: lit ? "#0A63E8" : INK,
                    transform: `translateY(${(1 - pw) * 14 - hb * 6}px) scale(${(0.5 + 0.5 * pw) * (1 + 0.14 * hb)})`,
                    opacity: frame >= wa ? 1 : 0,
                  }}
                >
                  {tk.hi ? (
                    <span
                      style={{
                        position: "absolute",
                        left: -6,
                        right: -6,
                        top: "16%",
                        bottom: "2%",
                        borderRadius: 8,
                        background: "#FFE14D",
                        transform: `scaleX(${sw}) rotate(-1.5deg)`,
                        transformOrigin: "0% 50%",
                        zIndex: -1,
                      }}
                    />
                  ) : null}
                  {tk.w}
                </span>{" "}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 0,
          transform: `translateY(-58%) scale(${tabIn}) rotate(${-3 + (1 - tabIn) * 16}deg)`,
          transformOrigin: "0% 50%",
          padding: "6px 24px 2px",
          borderRadius: 999,
          background: "linear-gradient(135deg, #5CC8FF 0%, #1E6BFF 100%)",
          border: "5px solid #FFFFFF",
          boxShadow: `0 0 0 4px ${INK}, 0 7px 0 4px rgba(0,0,0,0.28)`,
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ paddingTop: 8 }}>
          <HeavyText text={label} size={36} colors={TXT_WHITE} />
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// PriceTag

const TAG_W = 560;
const TAG_H = 300;
const STRING_L = 150;

/** Luggage-style tag outline around the hole at (0, 0): chamfered top, body down to y = h. */
const goldTagPath = (w: number, h: number) => {
  const hw = w / 2;
  return `M${-w * 0.22} -46 L${w * 0.22} -46 Q${w * 0.27} -46 ${w * 0.31} -38 L${hw - 8} 34 Q${hw} 44 ${hw} 58 L${hw} ${h - 26} Q${hw} ${h} ${hw - 26} ${h} L${-hw + 26} ${h} Q${-hw} ${h} ${-hw} ${h - 26} L${-hw} 58 Q${-hw} 44 ${-hw + 8} 34 L${-w * 0.31} -38 Q${-w * 0.27} -46 ${-w * 0.22} -46 Z`;
};

/** The same outline, crumpled: straight edges subdivided with small deterministic dents. */
const cheapTagPath = (w: number, h: number) => {
  const hw = w / 2;
  const corners: [number, number][] = [
    [-w * 0.22, -46],
    [w * 0.22, -46],
    [hw, 40],
    [hw, h],
    [-hw, h],
    [-hw, 40],
  ];
  const pts: string[] = [];
  let seed = 1;
  for (let c = 0; c < corners.length; c++) {
    const [ax, ay] = corners[c];
    const [bx, by] = corners[(c + 1) % corners.length];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 34));
    const nx = -(by - ay) / Math.hypot(bx - ax, by - ay);
    const ny = (bx - ax) / Math.hypot(bx - ax, by - ay);
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const off = i === 0 ? 0 : (rand(seed++ * 3.17) - 0.5) * 11;
      pts.push(`${(ax + (bx - ax) * f + nx * off).toFixed(1)} ${(ay + (by - ay) * f + ny * off).toFixed(1)}`);
    }
  }
  return `M${pts.join(" L")} Z`;
};

const CREASES = [
  "M-262 70 L-120 120 L-30 96",
  "M-90 -40 L-60 60 L-110 200 L-70 296",
  "M40 -44 L70 90 L30 180",
  "M150 30 L120 150 L250 230",
  "M-270 230 L-140 210 L-40 250 L60 230 L180 296",
];

/** Peruvian-ish coin: silver or golden disc with an inner ring and "S/". */
const Coin: React.FC<{ cx: number; cy: number; r: number; kind: "silver" | "gold"; rot?: number }> = ({ cx, cy, r, kind, rot = 0 }) => (
  <g transform={`translate(${cx} ${cy}) rotate(${rot})`}>
    <circle r={r} fill={kind === "silver" ? "#CDD5DD" : "#E9B949"} stroke={INK} strokeWidth={5} />
    <circle r={r * 0.76} fill="none" stroke={kind === "silver" ? "#F5F8FB" : "#FFE39A"} strokeWidth={3} />
    <text x={0} y={r * 0.32} textAnchor="middle" fontFamily={FONT.title} fontSize={r * 0.9} fill={kind === "silver" ? "#7D8894" : "#A8740E"}>
      S/
    </text>
    <path d={`M${-r * 0.55} ${-r * 0.5} A${r * 0.8} ${r * 0.8} 0 0 1 ${r * 0.1} ${-r * 0.78}`} stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
  </g>
);

/**
 * Dangling price tag that swings in on a string from a pin (damped pendulum, big first swing).
 * tone "gold": a golden luggage tag with a beaded border, glitter sparkles twinkling around it, a
 * periodic shine sweep, the price in big cream letters ("S/" smaller) and an optional red
 * `caption` ribbon ("LA ÚLTIMA"). tone "cheap": crumpled paper with creases on a twine taped
 * up, the price scribbled in dark ink (a " + …" part goes on a second line in red, e.g.
 * "S/ 3 + 1 RETRATO"), two coins taped to a corner, a jerkier swing. Pops in at `at`, shrinks
 * away at `out`. `x`, `y` = centre of the tag at rest; tag 560 x 346 (x ± 280, y ± 173), the
 * string and pin reach up to y - 280. Suggested: x 500, y 650.
 */
export const PriceTag: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  price: string;
  caption?: string;
  tone: "gold" | "cheap";
  scale?: number;
}> = ({ frame, at, out, x, y, price, caption, tone, scale = 1 }) => {
  const uid = useUid();
  if (frame < at || frame > out + 10) return null;
  const tt = frame - at;
  const gold = tone === "gold";
  const p = pop(frame, at, { damping: 12, stiffness: 170 });
  const k = leave(frame, out, 10);
  const ang = gold
    ? 62 * Math.exp(-tt / 20) * Math.cos(tt * 0.19) + Math.sin(tt * 0.05) * 1.5
    : 48 * Math.exp(-tt / 15) * Math.cos(tt * 0.27) + Math.sin(tt * 0.07) * 2.4 + jit(frame, 4, 3) * 0.7;
  const L = STRING_L;
  const W = TAG_W;
  const H = TAG_H;
  const anchorY = y - (L + (H - 46) / 2) * scale;
  const tagD = gold ? goldTagPath(W, H) : cheapTagPath(W, H);
  // price layout
  const plusIdx = price.indexOf(" + ");
  const main = plusIdx >= 0 ? price.slice(0, plusIdx) : price;
  const extra = plusIdx >= 0 ? price.slice(plusIdx + 1) : "";
  const hasPrefix = main.indexOf("S/ ") === 0;
  const num = hasPrefix ? main.slice(3) : main;
  const em = lgWidth(num) + (hasPrefix ? lgWidth("S/") * 0.6 + 0.12 : 0);
  const size = Math.min(gold ? 112 : 150, (W - 80) / em);
  const sparks: React.ReactNode[] = [];
  if (gold) {
    const spots: [number, number, number][] = [
      [-300, 40, 30],
      [312, 90, 26],
      [-258, 300, 22],
      [286, 296, 32],
      [-150, -70, 20],
      [178, -48, 22],
      [-60, 128, 16],
      [-326, 176, 18],
      [334, 214, 20],
      [120, 84, 14],
    ];
    spots.forEach(([sx, sy, r], i) => {
      const tw = Math.max(0, Math.sin(tt * 0.24 + i * 1.9));
      if (tw < 0.05) return;
      sparks.push(<path key={i} d={sparkle(sx, L + sy, r * tw)} fill={i % 2 ? "#FFFFFF" : "#FFF3A8"} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />);
    });
  }
  const sweepX = -W + ((tt * 18) % (W * 2.8));
  const stringD1 = `M0 0 C-4 ${L * 0.5} -14 ${L - 22} -6 ${L - 2}`;
  const stringD2 = `M0 0 C4 ${L * 0.5} 14 ${L - 22} 6 ${L - 2}`;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: anchorY,
        width: 0,
        height: 0,
        transform: `translateY(${(1 - p) * -90}px) scale(${scale * (0.6 + 0.4 * p) * (1 - k)}) rotate(${ang}deg)`,
        opacity: Math.min(1, p * 2.5) * (1 - k),
        pointerEvents: "none",
      }}
    >
      <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id={`pg${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF6C4" />
            <stop offset="0.35" stopColor="#FFD84A" />
            <stop offset="0.7" stopColor="#F5B50F" />
            <stop offset="1" stopColor="#C98200" />
          </linearGradient>
          <clipPath id={`pc${uid}`}>
            <path d={tagD} transform={`translate(0 ${L})`} />
          </clipPath>
        </defs>
        {/* string */}
        {[stringD1, stringD2].map((d) => (
          <g key={d}>
            <path d={d} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
            <path d={d} stroke={gold ? "#F2C14E" : "#B08850"} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={gold ? "7 3" : "4 4"} />
          </g>
        ))}
        {/* tag body */}
        <g transform={`translate(0 ${L})`}>
          <path d={tagD} fill={gold ? `url(#pg${uid})` : "#F1E6C8"} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
          {gold ? (
            <>
              <rect x={-W / 2 + 20} y={62} width={W - 40} height={H - 82} rx={18} fill="none" stroke="#FFF3B0" strokeWidth={5} strokeDasharray="1 11" strokeLinecap="round" />
              <path d={`M${-W * 0.2} -32 L${W * 0.2} -32`} stroke="#FFF6C9" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
            </>
          ) : (
            <>
              {CREASES.map((d) => (
                <g key={d}>
                  <path d={d} stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.7} transform="translate(2 2)" />
                  <path d={d} stroke="#C2B087" strokeWidth={2.5} fill="none" opacity={0.85} />
                </g>
              ))}
              <path d="M-90 -40 L-60 60 L-262 70 Z" fill="#8A7440" opacity={0.08} />
              <path d="M150 30 L120 150 L250 230 L272 40 Z" fill="#8A7440" opacity={0.1} />
            </>
          )}
          <circle cx={0} cy={0} r={gold ? 20 : 17} fill={gold ? "#FFF3C4" : "#E4D6B0"} stroke={INK} strokeWidth={5} />
          <circle cx={0} cy={0} r={9} fill="#3A2A10" />
        </g>
        {gold ? (
          <g clipPath={`url(#pc${uid})`}>
            <path d={`M${sweepX} -40 L${sweepX + 70} -40 L${sweepX - 50} ${L + H + 40} L${sweepX - 120} ${L + H + 40} Z`} fill="#FFFFFF" opacity={0.45} />
          </g>
        ) : null}
        {/* pin / tape */}
        {gold ? (
          <g>
            <circle cx={0} cy={0} r={15} fill="#FFD84A" stroke={INK} strokeWidth={6} />
            <circle cx={-4} cy={-4} r={4.5} fill="#FFFFFF" opacity={0.9} />
          </g>
        ) : (
          <rect x={-46} y={-16} width={92} height={32} transform="rotate(-6)" fill="rgba(240,226,170,0.9)" stroke="rgba(150,130,80,0.6)" strokeWidth={2} />
        )}
        {!gold ? (
          <g>
            <Coin cx={W / 2 - 58} cy={L + H - 26} r={54} kind="silver" rot={-12} />
            <Coin cx={W / 2 - 150} cy={L + H + 4} r={46} kind="gold" rot={10} />
            <rect x={W / 2 - 200} y={L + H - 44} width={190} height={30} transform={`rotate(-14 ${W / 2 - 105} ${L + H - 29})`} fill="rgba(240,226,170,0.82)" />
          </g>
        ) : null}
        {sparks}
      </svg>
      {/* price */}
      <div
        style={{
          position: "absolute",
          left: -W / 2,
          width: W,
          top: L + (gold ? 158 : extra ? 118 : 150),
          display: "flex",
          justifyContent: "center",
          transform: `translateY(-50%) rotate(${gold ? 0 : -4}deg)`,
        }}
      >
        {gold ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: size * 0.1 }}>
            {hasPrefix ? (
              <div style={{ paddingTop: size * 0.2 }}>
                <HeavyText text="S/" size={size * 0.6} colors={TXT_CREAM} />
              </div>
            ) : null}
            <div style={{ paddingTop: size * 0.2 }}>
              <HeavyText text={num} size={size} colors={TXT_CREAM} />
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: FONT.title, fontSize: size, lineHeight: 1, color: "#2B2622", whiteSpace: "nowrap", textShadow: "2px 2px 0 rgba(0,0,0,0.12)" }}>
            {hasPrefix ? <span style={{ fontSize: size * 0.6, marginRight: size * 0.08 }}>S/</span> : null}
            {num}
          </div>
        )}
      </div>
      {!gold && extra ? (
        <div
          style={{
            position: "absolute",
            left: -W / 2,
            width: W,
            top: L + 228,
            display: "flex",
            justifyContent: "center",
            transform: "translateY(-50%) rotate(-6deg)",
            fontFamily: FONT.fun,
            fontSize: 58,
            lineHeight: 1,
            color: "#D62828",
            whiteSpace: "nowrap",
          }}
        >
          {extra}
        </div>
      ) : null}
      {caption ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: L + H - 8,
            transform: `translate(-50%, -50%) rotate(${gold ? -4 : 5}deg) scale(${pop(frame, at + 10, { damping: 9, stiffness: 220 })})`,
            padding: "6px 26px 2px",
            borderRadius: 14,
            background: gold ? "linear-gradient(135deg, #FF6A6A 0%, #D0001A 100%)" : "linear-gradient(135deg, #5CC8FF 0%, #1E6BFF 100%)",
            border: "5px solid #FFFFFF",
            boxShadow: `0 0 0 4px ${INK}, 0 6px 0 4px rgba(0,0,0,0.28)`,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ paddingTop: 8 }}>
            <HeavyText text={caption} size={42} colors={TXT_WHITE} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

// =============================================================================================
// PortraitSketch

type SketchStroke = { d: string; w: number; wt: number; fill?: string; white?: boolean; mirror?: boolean };

const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;

/** Parallel hatch strokes: n segments of (dx, dy) starting at (x0, y0), stepping (sx, sy). */
const hatchLines = (x0: number, y0: number, n: number, sx: number, sy: number, dx: number, dy: number) => {
  let d = "";
  for (let i = 0; i < n; i++) d += `M${x0 + i * sx} ${y0 + i * sy} L${x0 + i * sx + dx} ${y0 + i * sy + dy} `;
  return d.trim();
};

const sparkleStroke = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} Q${cx + r * 0.16} ${cy - r * 0.16} ${cx + r} ${cy} Q${cx + r * 0.16} ${cy + r * 0.16} ${cx} ${cy + r} Q${cx - r * 0.16} ${cy + r * 0.16} ${cx - r} ${cy} Q${cx - r * 0.16} ${cy - r * 0.16} ${cx} ${cy - r}`;

// The seller, in a 560 x 640 drawing space: a cube with a fedora, eyes peeking over dark
// sunglasses, a trench-coat collar, a six-pack and huge double-biceps arms (the right arm is
// the left one mirrored).
const ARM: { d: string; w: number; wt: number }[] = [
  { d: "M180 398 C140 410 90 412 64 398 C40 384 36 320 48 252", w: 5, wt: 2.2 },
  { d: "M180 330 C168 272 112 262 100 318 C102 296 110 272 108 252", w: 5, wt: 2.2 },
  { d: "M46 252 C34 224 46 192 76 186 C104 180 124 200 120 228 C118 246 108 256 92 258 C74 260 56 260 46 252", w: 5, wt: 1.8 },
  { d: "M60 206 C68 198 80 198 86 208 M86 200 C92 192 104 194 108 204", w: 3.5, wt: 0.8 },
  { d: "M118 302 C132 314 150 316 166 310", w: 3.5, wt: 0.5 },
  { d: "M74 270 C82 300 80 330 70 356", w: 3.5, wt: 0.6 },
  { d: "M140 386 C150 376 166 374 178 380", w: 3.5, wt: 0.5 },
];

const SKETCH: SketchStroke[] = [
  { d: rrPath(180, 240, 200, 210, 44), w: 5.5, wt: 3 },
  { d: "M140 268 C170 250 202 258 232 256 L328 256 C358 258 390 250 420 268 C398 286 330 284 280 284 C230 284 162 286 140 268", w: 5, wt: 2 },
  { d: "M214 258 C208 230 210 206 222 186 C240 196 258 182 280 192 C302 182 320 196 338 186 C350 206 352 230 346 258", w: 5, wt: 2 },
  { d: "M280 196 C277 210 278 222 281 232", w: 3.5, wt: 0.5 },
  { d: "M213 234 C250 243 310 243 347 234 L348 252 C310 261 250 261 212 252 Z", w: 4, wt: 1, fill: "#3B3B40" },
  { d: ellipsePath(240, 298, 11, 13), w: 4, wt: 0.5, fill: "#2E2E33" },
  { d: ellipsePath(320, 298, 11, 13), w: 4, wt: 0.5, fill: "#2E2E33" },
  { d: "M206 304 L274 304 C276 324 266 340 240 340 C216 340 204 324 206 304", w: 5, wt: 1, fill: "#2E2E33" },
  { d: "M286 304 L354 304 C356 324 344 340 320 340 C294 340 284 324 286 304", w: 5, wt: 1, fill: "#2E2E33" },
  { d: "M274 309 Q280 302 286 309 M206 307 L182 299 M354 307 L378 299", w: 4, wt: 0.6 },
  { d: "M220 314 L232 328 M300 314 L312 328 M244 291 L245 291 M324 291 L325 291", w: 4, wt: 0.3, white: true },
  ...ARM,
  ...ARM.map((s) => ({ ...s, mirror: true })),
  { d: "M226 362 C246 352 266 354 278 362 M282 362 C294 354 314 352 334 362", w: 4, wt: 0.8 },
  { d: "M280 366 L280 444", w: 3.5, wt: 0.5 },
  { d: rrPath(250, 372, 26, 20, 8), w: 4, wt: 0.4 },
  { d: rrPath(284, 372, 26, 20, 8), w: 4, wt: 0.4 },
  { d: rrPath(250, 396, 26, 20, 8), w: 4, wt: 0.4 },
  { d: rrPath(284, 396, 26, 20, 8), w: 4, wt: 0.4 },
  { d: rrPath(250, 420, 26, 18, 8), w: 4, wt: 0.4 },
  { d: rrPath(284, 420, 26, 18, 8), w: 4, wt: 0.4 },
  { d: "M196 450 L156 418 L172 474 L224 472", w: 5, wt: 1 },
  { d: "M364 450 L404 418 L388 474 L336 472", w: 5, wt: 1 },
  { d: "M174 470 L166 560 L394 560 L386 470", w: 5, wt: 1.6 },
  { d: "M232 470 L280 522 L328 470 M280 522 L280 560", w: 4, wt: 0.8 },
  { d: "M170 516 L390 516", w: 4, wt: 0.6 },
  { d: "M232 560 L232 590 L258 590 L258 560 M302 560 L302 590 L328 590 L328 560", w: 4.5, wt: 0.8 },
  { d: hatchLines(350, 356, 7, 0, 12, 20, -14), w: 2.5, wt: 0.9 },
  { d: hatchLines(92, 392, 8, 11, 0, -8, 12), w: 2.5, wt: 0.6 },
  { d: hatchLines(92, 392, 8, 11, 0, -8, 12), w: 2.5, wt: 0.6, mirror: true },
  { d: hatchLines(362, 486, 5, 0, 14, 18, -12), w: 2.5, wt: 0.5 },
  { d: hatchLines(226, 182, 5, 9, -1, -6, 14), w: 2.5, wt: 0.4 },
  { d: "M28 200 L10 190 M26 224 L6 226 M36 174 L24 158 M532 200 L550 190 M534 224 L554 226 M524 174 L536 158", w: 4, wt: 1 },
  { d: sparkleStroke(160, 150, 18), w: 3.5, wt: 0.5 },
  { d: sparkleStroke(420, 138, 22), w: 3.5, wt: 0.5 },
  { d: sparkleStroke(510, 470, 15), w: 3.5, wt: 0.4 },
  { d: sparkleStroke(52, 470, 17), w: 3.5, wt: 0.4 },
  { d: sparkleStroke(280, 126, 13), w: 3.5, wt: 0.4 },
  { d: "M352 612 C358 592 372 590 370 606 C368 618 380 596 388 604 C394 610 398 598 406 602 C412 606 416 598 424 600 C432 602 436 596 446 594", w: 3.5, wt: 1.2 },
  { d: "M346 626 C380 620 420 620 466 614", w: 3, wt: 0.5 },
];

const SKETCH_PTS = SKETCH.map((s) => {
  const n = (s.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const fx = (v: number) => (s.mirror ? 560 - v : v);
  return { sx: fx(n[0]), sy: n[1], ex: fx(n[n.length - 2]), ey: n[n.length - 1] };
});
const SKETCH_WT = SKETCH.reduce((a, s) => a + s.wt, 0);
const SPARKLE_SPOTS: [number, number, number][] = [
  [160, 150, 18],
  [420, 138, 22],
  [510, 470, 15],
  [52, 470, 17],
  [280, 126, 13],
];

/** Yellow pencil with its tip at (0, 0), body pointing up and right. */
const Pencil: React.FC = () => (
  <g transform="rotate(32)">
    <path d="M0 0 L-10 -24 L10 -24 Z" fill="#F5D29A" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
    <path d="M0 0 L-3.5 -8 L3.5 -8 Z" fill="#3A3A3F" />
    <rect x={-10} y={-120} width={20} height={96} fill="#FFC83D" stroke={INK} strokeWidth={3.5} />
    <rect x={-3} y={-118} width={6} height={92} fill="#FFE08A" />
    <rect x={-10} y={-134} width={20} height={14} fill="#C9CED6" stroke={INK} strokeWidth={3.5} />
    <rect x={-10} y={-152} width={20} height={18} rx={5} fill="#FF8FA3" stroke={INK} strokeWidth={3.5} />
  </g>
);

/**
 * Sheet of sketch paper (slightly tilted, three taped corners, paper grain) on which a pencil
 * drawing appears stroke by stroke (stroke-dashoffset) between at + 8 and `drawTo` (default
 * at + 80), a pencil riding the strokes: the seller as a Nubi-shaped cube with a fedora, eyes
 * peeking over dark sunglasses, a trench-coat collar, a six-pack and ENORMOUS bodybuilder arms
 * flexing a double biceps, flex lines, scribbled shading, sparkles and a signature. When done
 * the sparkles light up and a shine sweeps across. Drops in at `at`; with `out` it flies away
 * (10 frames). `x`, `y` = paper centre; 560 x 640 (x ± 290, y ± 330 with the tilt and tape).
 * Suggested: x 500, y 700.
 */
export const PortraitSketch: React.FC<{ frame: number; at: number; drawTo?: number; out?: number; x: number; y: number; scale?: number }> = ({
  frame,
  at,
  drawTo,
  out,
  x,
  y,
  scale = 1,
}) => {
  if (frame < at) return null;
  if (out !== undefined && frame > out + 10) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 12, stiffness: 160 });
  const k = leave(frame, out, 10);
  const d0 = at + 8;
  const d1 = Math.max(d0 + 10, drawTo ?? at + 80);
  const span = d1 - d0;
  let cum = 0;
  let pen: { x: number; y: number } | null = null;
  const strokes = SKETCH.map((s, i) => {
    const s0 = d0 + (cum / SKETCH_WT) * span;
    cum += s.wt;
    const s1 = d0 + (cum / SKETCH_WT) * span;
    const pr = ramp(frame, s0, s1, [0, 1], EASE_IN_OUT);
    if (frame >= s0 && frame < s1) {
      const pt = SKETCH_PTS[i];
      pen = { x: pt.sx + (pt.ex - pt.sx) * pr, y: pt.sy + (pt.ey - pt.sy) * pr };
    }
    if (pr <= 0) return null;
    const fillOp = s.fill ? ramp(frame, s1, s1 + 5) : 0;
    const col = s.white ? "#FFFFFF" : "#38383D";
    const body = (
      <>
        {s.fill && fillOp > 0 ? <path d={s.d} fill={s.fill} opacity={fillOp} /> : null}
        <path d={s.d} stroke={col} strokeWidth={s.w * 1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pr} />
        {!s.white ? (
          <path
            d={s.d}
            stroke={col}
            strokeWidth={s.w * 0.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - pr}
            opacity={0.35}
            transform="translate(1.6 1.2)"
          />
        ) : null}
      </>
    );
    return s.mirror ? (
      <g key={i} transform="translate(560 0) scale(-1 1)">
        {body}
      </g>
    ) : (
      <g key={i}>{body}</g>
    );
  });
  const lift = ramp(frame, d1, d1 + 8, [0, 1], EASE_IN);
  const penPos = (pen ?? (frame >= d1 ? { x: 446, y: 594 } : { x: 360, y: 250 })) as { x: number; y: number };
  const penOp = frame < d0 - 2 ? 0 : 1 - lift;
  const shine = ramp(frame, d1 + 3, d1 + 20, [0, 1], EASE_IN_OUT);
  const done = pop(frame, d1, { damping: 9, stiffness: 220 });
  const doneBump = bump(frame, d1, 10);
  const grain: React.ReactNode[] = [];
  for (let i = 0; i < 140; i++) {
    grain.push(<circle key={i} cx={rand(i * 3.3) * 560} cy={rand(i * 7.1) * 640} r={0.8 + rand(i * 1.9) * 1.6} fill="#8C7A5A" opacity={0.08 + rand(i * 5.3) * 0.12} />);
  }
  const tape = (left: number, top: number, rot: number, w = 150) => (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: 44,
        transform: `rotate(${rot}deg)`,
        background: "rgba(246,232,176,0.82)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
        clipPath: "polygon(0% 8%, 4% 0%, 8% 10%, 12% 0%, 100% 0%, 96% 90%, 100% 100%, 92% 92%, 88% 100%, 0% 100%)",
      }}
    />
  );
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: -280,
          top: -320,
          width: 560,
          height: 640,
          transform: `translateY(${(1 - p) * -260 - k * 120}px) scale(${scale * (0.7 + 0.3 * p) * (1 - k) * (1 + 0.03 * doneBump)}) rotate(${-3 + (1 - p) * -12 + k * 25 + Math.sin(t * 0.05) * 0.4}deg)`,
          opacity: Math.min(1, p * 3) * (1 - k),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 8,
            background: "linear-gradient(170deg, #FFFDF6 0%, #F8F2E2 100%)",
            boxShadow: `0 0 0 4px ${INK}, 0 14px 0 4px rgba(0,0,0,0.25), 0 30px 50px rgba(0,0,0,0.3), inset 0 0 40px rgba(160,130,80,0.18)`,
            overflow: "hidden",
          }}
        >
          <svg width={560} height={640} style={{ position: "absolute", inset: 0 }}>
            {grain}
          </svg>
          <svg width={560} height={640} viewBox="-30 -14 620 668" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {strokes}
            {done > 0.01
              ? SPARKLE_SPOTS.map(([sx, sy, r], i) => {
                  const tw = 0.6 + 0.4 * Math.sin((frame - d1) * 0.3 + i * 1.7);
                  return <path key={i} d={sparkle(sx, sy, r * 0.8 * done * tw)} fill="#FFD84A" opacity={0.9} />;
                })
              : null}
            {penOp > 0.01 ? (
              <g transform={`translate(${penPos.x + lift * 60} ${penPos.y - lift * 80})`} opacity={penOp}>
                <Pencil />
              </g>
            ) : null}
          </svg>
          {shine > 0 && shine < 1 ? (
            <div
              style={{
                position: "absolute",
                top: -200,
                bottom: -200,
                left: -260 + shine * 1100,
                width: 120,
                transform: "rotate(18deg)",
                background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 100%)",
              }}
            />
          ) : null}
        </div>
        {tape(-44, -6, -38)}
        {tape(452, -6, 38)}
        {tape(436, 600, -32, 130)}
      </div>
    </div>
  );
};

// =============================================================================================
// DreamRipple

/**
 * "It was a dream" wake-up transition, full frame: the picture underneath blurs and brightens
 * (backdrop filter), a soft white bloom swells from (x, y), wavy concentric rings ripple out,
 * puffy dream-cloud edges creep in from the frame borders and a few sparkles twinkle. Builds up
 * over dur/2 frames to a peak at `at` (put the cut there) and clears over the next dur/2
 * (default dur 36). Defaults: x 540, y 900.
 */
export const DreamRipple: React.FC<{ frame: number; at: number; dur?: number; x?: number; y?: number }> = ({ frame, at, dur = 36, x = 540, y = 900 }) => {
  const half = dur / 2;
  if (frame < at - half || frame > at + half) return null;
  const e = frame <= at ? ramp(frame, at - half, at, [0, 1], EASE_IN) : 1 - ramp(frame, at, at + half, [0, 1], EASE_IN_OUT);
  const tt = frame - (at - half);
  const rings: React.ReactNode[] = [];
  const RMAX = 1250;
  for (let i = 0; i < 6; i++) {
    const r = (tt * 24 + i * (RMAX / 6)) % RMAX;
    const fade = 1 - r / RMAX;
    let d = "";
    for (let j = 0; j <= 72; j++) {
      const th = (j / 72) * Math.PI * 2;
      const rr = r + (8 + r * 0.02) * Math.sin(th * 7 + tt * 0.35 + i * 1.3);
      d += `${j ? "L" : "M"}${(x + Math.cos(th) * rr).toFixed(1)} ${(y + Math.sin(th) * rr).toFixed(1)} `;
    }
    rings.push(<path key={`b${i}`} d={`${d}Z`} stroke="#7FCBFF" strokeWidth={6 + 8 * fade} fill="none" opacity={e * fade * 0.75} transform={`translate(0 ${5 + 4 * fade})`} />);
    rings.push(<path key={`w${i}`} d={`${d}Z`} stroke="#FFFFFF" strokeWidth={4 + 9 * fade} fill="none" opacity={e * fade * 0.9} />);
  }
  const puffs: React.ReactNode[] = [];
  const puffEdges: React.ReactNode[] = [];
  const inset = e * 70;
  let pi = 0;
  const puff = (px: number, py: number, r: number) => {
    const rr = r * (0.6 + 0.4 * e) + Math.sin(tt * 0.15 + pi) * 6;
    puffEdges.push(<circle key={pi} cx={px} cy={py} r={rr + 7} />);
    puffs.push(<circle key={pi++} cx={px} cy={py} r={rr} />);
  };
  for (let i = 0; i <= 9; i++) {
    const r = 90 + rand(i * 2.3) * 50;
    puff(i * 120, -60 + inset, r);
    puff(i * 120 + 60, 1980 - inset, r);
  }
  for (let i = 0; i <= 16; i++) {
    const r = 90 + rand(i * 4.1) * 50;
    puff(-60 + inset, i * 120 + 40, r);
    puff(1140 - inset, i * 120, r);
  }
  const twinkles: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const tw = Math.max(0, Math.sin(tt * 0.3 + i * 1.7));
    const px = x + (rand(i * 3.1) - 0.5) * 760;
    const py = y + (rand(i * 5.7) - 0.5) * 1100;
    twinkles.push(<path key={i} d={sparkle(px, py, (10 + rand(i * 2.2) * 16) * tw * e)} fill={i % 2 ? "#FFFFFF" : "#BFE6FF"} stroke="#6FB8F0" strokeWidth={2} opacity={0.95} />);
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          backdropFilter: `blur(${18 * e}px) brightness(${1 + 0.3 * e}) saturate(${1 + 0.25 * e})`,
          WebkitBackdropFilter: `blur(${18 * e}px) brightness(${1 + 0.3 * e}) saturate(${1 + 0.25 * e})`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: Math.pow(e, 1.2),
          background: `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 30%, rgba(214,240,255,0.28) 62%, rgba(255,255,255,0) 100%)`,
        }}
      />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {rings}
        <g opacity={0.95 * e}>
          <g fill="#9FD3FF">{puffEdges}</g>
          <g fill="#FFFFFF">{puffs}</g>
        </g>
        {twinkles}
      </svg>
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: 0.4 * Math.pow(e, 4) }} />
    </AbsoluteFill>
  );
};

// =============================================================================================
// ShareOrSurvive

/** Choice bubble with an icon on top of its label and a tail pointing down-outwards. */
const ChoiceBubble: React.FC<{ label: string; bg: string; tail: "left" | "right"; children: React.ReactNode }> = ({ label, bg, tail, children }) => {
  const tailSvg = (pass: "outline" | "fill") => (
    <svg
      width={60}
      height={69}
      viewBox="0 0 70 80"
      style={{ position: "absolute", [tail === "left" ? "left" : "right"]: 40, bottom: -46, overflow: "visible", transform: tail === "right" ? "scaleX(-1)" : undefined }}
    >
      <path d="M6 4 C14 30 12 52 2 74 C26 58 46 34 60 4 Z" fill="#FFFFFF" stroke={pass === "outline" ? INK : "none"} strokeWidth={pass === "outline" ? 13 : 0} strokeLinejoin="round" />
    </svg>
  );
  return (
    <div style={{ position: "relative", width: 320, height: 180 }}>
      {tailSvg("outline")}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 60,
          background: bg,
          border: "8px solid #FFFFFF",
          boxShadow: `0 0 0 5px ${INK}, 0 12px 0 5px rgba(0,0,0,0.3)`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
        <div style={{ paddingTop: 12, marginTop: -2 }}>
          <HeavyText text={label} size={44} colors={TXT_WHITE} />
        </div>
      </div>
      {tailSvg("fill")}
    </div>
  );
};

/**
 * Closing question for the TOP part of the frame (y 230-800; the 3D Nubi stays visible below):
 * a soft navy scrim fading down to y ~960, "¿COMPARTIR / O SOBREVIVIR?" in big heavy letters
 * (COMPARTIR blue, SOBREVIVIR orange) with a bobbing water drop; two choice bubbles pop in and
 * bob: "COMPARTIR" (blue, two Nubi fins holding a drop) and "SOBREVIVIR" (orange, a bottle
 * chained with a padlock); then an aqua comment button is tapped by a hand (ripples, every 24
 * frames) while the count on its left ticks up to `countTo` with "COMENTA" under it. With `out`
 * it fades out over 10 frames. Layout (fixed): title y 250-450, bubbles y 465-700, button and
 * count y 670-800 (the hand pokes a bit lower). `scrim={false}` drops the dark gradient.
 */
export const ShareOrSurvive: React.FC<{ frame: number; at: number; out?: number; countTo?: number; scrim?: boolean }> = ({
  frame,
  at,
  out,
  countTo = 8350,
  scrim = true,
}) => {
  if (frame < at) return null;
  if (out !== undefined && frame > out + 10) return null;
  const t = frame - at;
  const k = leave(frame, out, 10);
  const bgK = ramp(frame, at, at + 8);
  const taps = [at + 52, at + 76, at + 100, at + 124, at + 148, at + 172, at + 196, at + 220];
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
  const btnIn = pop(frame, at + 34, { damping: 10, stiffness: 190 });
  const handIn = pop(frame, at + 42, { damping: 13, stiffness: 150 });
  const countIn = pop(frame, at + 38, { damping: 11, stiffness: 200 });
  const count = Math.round(countTo * ramp(frame, at + 38, at + 104, [0, 1], EASE_OUT));
  const countBump = lastTap >= 0 ? bump(frame, lastTap, 8) : 0;
  const dropIn = pop(frame, at + 12, { damping: 9, stiffness: 200 });
  const R = 60;
  const BTN = { x: 640, y: 738 };
  const title: { parts: { text: string; colors: string[] }[]; y: number; x: number }[] = [
    { parts: [{ text: "¿COMPARTIR", colors: TXT_BLUE }], y: 292, x: 470 },
    {
      parts: [
        { text: "O", colors: TXT_WHITE },
        { text: "SOBREVIVIR?", colors: TXT_ORANGE },
      ],
      y: 390,
      x: 500,
    },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - k }}>
      {scrim ? (
        <AbsoluteFill
          style={{
            opacity: bgK,
            background: "linear-gradient(180deg, rgba(4,22,52,0.78) 0%, rgba(4,22,52,0.62) 30%, rgba(4,22,52,0.3) 42%, rgba(4,22,52,0) 50%)",
          }}
        />
      ) : null}
      {title.map((line, i) => {
        const p = pop(frame, at + 2 + i * 5, { damping: 10, stiffness: 180 });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: line.x,
              top: line.y,
              display: "flex",
              gap: 24,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(i % 2 ? 2 : -2) * (0.6 + 0.4 * (1 - p)) + Math.sin(t * 0.08 + i) * 0.7}deg)`,
              opacity: Math.min(1, p * 3),
            }}
          >
            {line.parts.map((pt) => (
              <HeavyText key={pt.text} text={pt.text} size={88} colors={pt.colors} />
            ))}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 836,
          top: 286 + Math.sin(t * 0.1) * 8,
          transform: `translate(-50%, -50%) scale(${dropIn}) rotate(${12 + (1 - dropIn) * 40 + Math.sin(t * 0.07) * 5}deg)`,
        }}
      >
        <DropIcon size={128} />
      </div>
      {[
        { text: "COMPARTIR", bg: "linear-gradient(160deg, #7FD8FF 0%, #2A8CFF 55%, #1650C8 100%)", x: 292, at: at + 18, tail: "left" as const, icon: "share" },
        { text: "SOBREVIVIR", bg: "linear-gradient(160deg, #FFC46B 0%, #FF8A1F 55%, #E0520C 100%)", x: 708, at: at + 24, tail: "right" as const, icon: "survive" },
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
              top: 548 + bob,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(i ? 4 : -4) * (0.7 + 0.3 * (1 - p)) + Math.sin(t * 0.07 + i) * 1.6}deg)`,
            }}
          >
            <ChoiceBubble label={b.text} bg={b.bg} tail={b.tail}>
              {b.icon === "share" ? <FinsDropIcon size={86} frame={frame} /> : <LockBottleIcon size={86} frame={frame} />}
            </ChoiceBubble>
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
              border: `${11 * (1 - rip)}px solid #FFFFFF`,
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
            background: "linear-gradient(145deg, #9BEBFF 0%, #27B5F5 55%, #1E6BFF 100%)",
            border: "9px solid #FFFFFF",
            boxSizing: "border-box",
            boxShadow: `0 0 0 5px ${INK}, 0 11px 0 5px rgba(0,0,0,0.3), 0 0 44px rgba(120,220,255,0.4)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${btnIn * (1 - 0.12 * squish)}) rotate(${(1 - btnIn) * -30}deg)`,
          }}
        >
          <CommentBubbleIcon size={78} dot="#1E6BFF" frame={frame} style={{ marginTop: 4 }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 46,
            top: 18,
            transformOrigin: "0 0",
            transform: `translate(${(1 - handIn) * 360 - handPush * 18}px, ${(1 - handIn) * 160 - handPush * 8}px) rotate(-66deg) scale(${1 - 0.06 * handPush})`,
            opacity: Math.min(1, handIn * 2),
          }}
        >
          <HandPointer size={118} style={{ marginLeft: -48, marginTop: -4 }} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 380,
          top: 736,
          transform: `translate(-50%, -50%) scale(${countIn * (1 + 0.16 * countBump)})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <HeavyText text={fmtNumber(count)} size={66} colors={TXT_AQUA} />
        <div
          style={{
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 34,
            lineHeight: 1.1,
            letterSpacing: 3,
            color: "#FFFFFF",
            WebkitTextStroke: `9px ${INK}`,
            paintOrder: "stroke fill",
            whiteSpace: "nowrap",
            marginTop: 8,
          }}
        >
          COMENTA
        </div>
      </div>
    </AbsoluteFill>
  );
};
