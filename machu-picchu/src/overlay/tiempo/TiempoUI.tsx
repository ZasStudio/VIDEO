import React from "react";
import { AbsoluteFill } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, rand } from "../../anim";
import { FONT } from "../../theme";
import { LifeEvent, formatLife } from "../../tiempo/clock";
import { fmtNumber } from "../Graphics";
import { HeavyText } from "../inca/HeavyText";
import { CommentBubbleIcon, HandPointer, INK, SunFace } from "../inca/icons";

// 2D overlays for "¿Qué pasaría si el dinero fuera tiempo de vida?" (1080 x 1920, 30 fps).
// Same punchy look as the water / dinosaur overlays (thick dark outlines, white-bordered cards
// with hard drop shadows, HeavyText titles, springy pops with a slight wobble), in TIMECO's
// palette (charcoal #1B1B24, red #FF3B3B, gold sand #FFC83D) plus holographic cyan for the
// life counters. Everything is driven by the global `frame` plus explicit cue frames: no
// timers, no Math.random (`rand`), no CSS animations. Icons are inline SVG (no emoji font in
// the headless renderer). TikTok safe zone: keep content inside x 60-940, y 230-1180 (top bar
// above y 200, the button column right of x 940 from y 700, captions at y 1210-1400). Each
// component's doc comment gives its footprint at scale 1 and a suggested placement.

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

const MONO_DIGITS: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** Stepped noise in [-1, 1]: a new value every `hold` frames. */
const jit = (frame: number, seed: number, hold = 2) => {
  const n = Math.floor(frame / hold) * 12.9898 + seed * 78.233;
  const x = Math.sin(n) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
const bump = (frame: number, at: number, dur: number) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

/** Square-wave blink: 1 for `on` frames, 0 for `off` frames, starting at `from`. */
const blink = (frame: number, from: number, on = 7, off = 6) => {
  const n = on + off;
  return (((frame - from) % n) + n) % n < on ? 1 : 0;
};

/** Triangle wave 0 -> 1 -> 0 with period 1. */
const tri = (v: number) => 1 - Math.abs(2 * (v - Math.floor(v)) - 1);

/** Exit progress 0 -> 1 over `dur` frames from `out` (always 0 without an out). */
const leave = (frame: number, out: number | undefined, dur = 9) => (out === undefined ? 0 : ramp(frame, out, out + dur, [0, 1], EASE_IN));

/** Damped shake offset after an impact at `at` (pixels). */
const impact = (frame: number, at: number, amp: number, dur = 10) => {
  const d = frame - at;
  if (d < 0 || d > dur) return { x: 0, y: 0, r: 0 };
  const k = amp * Math.pow(1 - d / dur, 2);
  return { x: Math.sin(d * 2.9 + at) * k, y: Math.cos(d * 3.7 + at * 0.7) * k * 0.7, r: Math.sin(d * 2.3 + at) * k * 0.08 };
};

/** Silhouette drawn as a thick outline first, then filled on top. */
const Outlined: React.FC<{ w?: number; color?: string; children: React.ReactNode }> = ({ w = 7, color = INK, children }) => (
  <>
    <g stroke={color} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
    <g>{children}</g>
  </>
);

/** TIMECO's brand colours. */
export const TIMECO_COLORS = { charcoal: "#1B1B24", red: "#FF3B3B", gold: "#FFC83D" } as const;
const TC = TIMECO_COLORS;

const SHADOW = `0 0 0 5px ${INK}, 0 12px 0 5px rgba(0,0,0,0.3), 0 24px 46px rgba(0,0,0,0.28)`;
const SHADOW_SM = `0 0 0 4px ${INK}, 0 7px 0 4px rgba(0,0,0,0.28)`;
const TXT_WHITE = ["#FFFFFF", "#FFFFFF", "#E2E4EE"];
const TXT_GOLD = ["#FFFBD1", "#FFD21F", "#FF9500"];
const TXT_RED = ["#FFE3E3", "#FF5A5A", "#D0001A"];
const TXT_ORANGE = ["#FFF6DC", "#FFB547", "#FF6A00"];
const TXT_GREEN = ["#F2FFE6", "#8DF27A", "#16B455"];
const TXT_SUN = ["#FFFDE0", "#FFE14D", "#6FD43F"];
const TXT_VIOLET = ["#F3F1FF", "#AFA6FF", "#6A43FF"];
const TXT_AMBER = ["#FFFBEA", "#FFE08A", "#FFB21F"];

// Advance widths of Luckiest Guy (em), to fit titles and prices.
const LG_W: Record<string, number> = {
  A: 0.626, B: 0.594, C: 0.515, D: 0.583, E: 0.479, F: 0.487, G: 0.626, H: 0.626, I: 0.297, J: 0.51, K: 0.614, L: 0.452, M: 0.791,
  N: 0.704, Ñ: 0.704, O: 0.638, P: 0.596, Q: 0.691, R: 0.606, S: 0.531, T: 0.543, U: 0.623, V: 0.613, W: 0.908, X: 0.588, Y: 0.607,
  Z: 0.487, Á: 0.626, É: 0.479, Í: 0.297, Ó: 0.638, Ú: 0.623, "¡": 0.278, "!": 0.279, "¿": 0.563, "?": 0.554, " ": 0.195, ".": 0.222,
  "/": 0.42, "+": 0.55, ",": 0.24, "-": 0.382, "0": 0.633, "1": 0.388, "2": 0.509, "3": 0.528, "4": 0.539, "5": 0.531, "6": 0.573,
  "7": 0.506, "8": 0.571, "9": 0.555,
};
const lgWidth = (s: string) => {
  let w = 0;
  for (const ch of Array.from(s)) w += LG_W[ch.toUpperCase()] ?? 0.62;
  return w;
};

// =============================================================================================
// Icons and brand

type IconProps = { size?: number; style?: React.CSSProperties };

const HG_GLASS = "M18 15 C18 38 35 44 37 50 C35 56 18 62 18 85 L62 85 C62 62 45 56 43 50 C45 44 62 38 62 15 Z";

/**
 * Cartoon hourglass (80 x 100 box at size 100: wooden caps and posts, glass, gold sand, dark
 * outline). `phase` 0..1 = how much sand has run down.
 */
export const HourglassIcon: React.FC<IconProps & { phase?: number; sand?: string; cap?: string; glass?: string }> = ({
  size = 100,
  phase = 0.4,
  sand = TC.gold,
  cap = "#8A5A36",
  glass = "#E9F8FF",
  style,
}) => {
  const uid = useUid();
  const top = 1 - clamp01(phase);
  const bot = clamp01(phase);
  const yt = 50 - 31 * top;
  const yb = 85 - 27 * bot;
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 80 100" style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <clipPath id={`hg${uid}`}>
          <path d={HG_GLASS} />
        </clipPath>
      </defs>
      <Outlined w={6}>
        <rect x={9} y={12} width={7} height={76} rx={3} fill={cap} />
        <rect x={64} y={12} width={7} height={76} rx={3} fill={cap} />
      </Outlined>
      <path d={HG_GLASS} fill={glass} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <g clipPath={`url(#hg${uid})`}>
        {top > 0.02 ? <path d={`M10 ${yt} Q40 ${yt + 5} 70 ${yt} L70 51 L10 51 Z`} fill={sand} /> : null}
        {bot > 0.02 ? <path d={`M10 86 L10 ${yb + 7} Q40 ${yb - 9} 70 ${yb + 7} L70 86 Z`} fill={sand} /> : null}
        {top > 0.02 && bot < 0.98 ? <rect x={38.6} y={48} width={2.8} height={Math.max(0, yb - 46)} fill={sand} /> : null}
      </g>
      <path d="M24 20 C24 33 29 40 33 44" stroke="#FFFFFF" strokeWidth={3.5} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d="M24 80 C24 71 27 65 31 61" stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
      <Outlined w={6}>
        <rect x={5} y={6} width={70} height={11} rx={5} fill={cap} />
        <rect x={5} y={83} width={70} height={11} rx={5} fill={cap} />
      </Outlined>
      <rect x={11} y={8} width={30} height={3} rx={1.5} fill="#FFFFFF" opacity={0.35} />
      <rect x={11} y={85} width={30} height={3} rx={1.5} fill="#FFFFFF" opacity={0.3} />
    </svg>
  );
};

/** Hourglass that runs for `period` frames and then flips over (spring), forever. */
const FlippingHourglass: React.FC<{ frame: number; size: number; period?: number; offset?: number }> = ({ frame, size, period = 66, offset = 0 }) => {
  const f = frame + offset;
  const c = ((f % period) + period) % period;
  const flip = c > period - 10 ? EASE_IN_OUT((c - (period - 10)) / 10) : 0;
  return (
    <div style={{ transform: `rotate(${180 * flip}deg)` }}>
      <HourglassIcon size={size} phase={Math.min(1, c / (period - 12))} />
    </div>
  );
};

const LOGO_GLASS = "M37 27 C37 40 47 45 48.6 50 C47 55 37 60 37 73 L63 73 C63 60 53 55 51.4 50 C53 45 63 40 63 27 Z";

/**
 * TIMECO's logo: a gold-sand hourglass inside a red ring on a charcoal disc (100 x 100 box).
 * `outline` adds the cartoon ink ring around it; `phase` 0..1 = sand run down.
 */
export const TimecoLogo: React.FC<IconProps & { phase?: number; outline?: boolean; ink?: string }> = ({ size = 100, phase = 0.55, outline = true, ink = INK, style }) => {
  const uid = useUid();
  const top = 1 - clamp01(phase);
  const bot = clamp01(phase);
  const yt = 50 - 21 * top;
  const yb = 73 - 19 * bot;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <clipPath id={`tl${uid}`}>
          <path d={LOGO_GLASS} />
        </clipPath>
        <linearGradient id={`tr${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#FF7A6E" />
          <stop offset="0.5" stopColor={TC.red} />
          <stop offset="1" stopColor="#C4102A" />
        </linearGradient>
      </defs>
      {outline ? <circle cx={50} cy={50} r={48} fill={ink} /> : null}
      <circle cx={50} cy={50} r={44} fill={TC.charcoal} />
      <circle cx={50} cy={50} r={35.5} fill="none" stroke={`url(#tr${uid})`} strokeWidth={8.5} />
      <path d="M26 30 A31 31 0 0 1 44 18.6" stroke="#FFFFFF" strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.55} />
      <path d={LOGO_GLASS} fill="rgba(255,255,255,0.08)" />
      <g clipPath={`url(#tl${uid})`}>
        {top > 0.02 ? <rect x={30} y={yt} width={40} height={51 - yt} fill={TC.gold} /> : null}
        {bot > 0.02 ? <path d={`M30 74 L30 ${yb + 5} Q50 ${yb - 6} 70 ${yb + 5} L70 74 Z`} fill={TC.gold} /> : null}
        {top > 0.02 && bot < 0.98 ? <rect x={49.1} y={49} width={1.8} height={Math.max(0, yb - 48)} fill={TC.gold} /> : null}
      </g>
      <path d={LOGO_GLASS} fill="none" stroke="#F4EFE6" strokeWidth={2.6} strokeLinejoin="round" />
      <rect x={33} y={23} width={34} height={5} rx={2.5} fill={TC.gold} />
      <rect x={33} y={72} width={34} height={5} rx={2.5} fill={TC.gold} />
    </svg>
  );
};

/** "TIMECO" wordmark (Montserrat Black, wide tracking, the "CO" in red). */
export const TimecoWordmark: React.FC<{ size?: number; color?: string; accent?: string; style?: React.CSSProperties }> = ({
  size = 40,
  color = "#FFFFFF",
  accent = TC.red,
  style,
}) => (
  <div style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: size * 0.16, color, whiteSpace: "nowrap", ...style }}>
    TIME<span style={{ color: accent }}>CO</span>
  </div>
);

/** Brown leather briefcase with a gold clasp (100 x 100 box). */
const BriefcaseIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <path d="M36 30 L36 20 Q36 14 42 14 L58 14 Q64 14 64 20 L64 30" fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
    <path d="M36 30 L36 20 Q36 14 42 14 L58 14 Q64 14 64 20 L64 30" fill="none" stroke="#6B3F22" strokeWidth={6} strokeLinecap="round" />
    <Outlined w={7}>
      <rect x={8} y={29} width={84} height={58} rx={11} fill="#A0643A" />
    </Outlined>
    <path d="M8 50 Q50 60 92 50" stroke={INK} strokeWidth={4} fill="none" />
    <rect x={14} y={33} width={72} height={8} rx={4} fill="#C98552" opacity={0.8} />
    <rect x={41} y={45} width={18} height={15} rx={4} fill={TC.gold} stroke={INK} strokeWidth={4} />
    <circle cx={50} cy={52.5} r={2.4} fill={INK} />
    <path d="M22 87 L22 92 M78 87 L78 92" stroke={INK} strokeWidth={6} strokeLinecap="round" />
  </svg>
);

/** Smiling face with smiling eyes (the 😊 of the notification), 100 x 100 box. */
const SmileyIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "inline-block", overflow: "visible", ...style }}>
    <circle cx={50} cy={50} r={44} fill="#FFD23F" stroke={INK} strokeWidth={6} />
    <path d="M18 40 A34 34 0 0 1 40 13" stroke="#FFF1A6" strokeWidth={6} fill="none" strokeLinecap="round" />
    <path d="M28 44 Q35 34 42 44 M58 44 Q65 34 72 44" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
    <ellipse cx={25} cy={58} rx={8} ry={5} fill="#FF8A7A" opacity={0.75} />
    <ellipse cx={75} cy={58} rx={8} ry={5} fill="#FF8A7A" opacity={0.75} />
    <path d="M30 60 Q50 82 70 60" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
  </svg>
);

// =============================================================================================
// LifeCounter

const EVENT_COLOR: Record<LifeEvent["tone"], string> = {
  loss: "#FF4B3E",
  gain: "#4DFF7C",
  gift: "#4DFF7C",
  tiny: "#BDF5FF",
};
const EVENT_TXT: Record<LifeEvent["tone"], string[]> = {
  loss: ["#FFE3E3", "#FF6B5E", "#E0101E"],
  gain: ["#F0FFF2", "#7CFF9A", "#13C24F"],
  gift: ["#F0FFF2", "#7CFF9A", "#13C24F"],
  tiny: ["#FFFFFF", "#DDF9FF", "#8FE6FF"],
};

type CounterPal = { edge: string; text: string; sub: string; bg0: string; bg1: string };
const NAVY = { bg0: "rgba(14,34,70,0.84)", bg1: "rgba(4,12,30,0.92)" };
const COUNTER_PAL: Record<"years" | "days" | "hours" | "alarm" | "gold" | "frozen", CounterPal> = {
  years: { edge: "#4FE3FF", text: "#FFFFFF", sub: "#BDF5FF", ...NAVY },
  days: { edge: "#FFD60A", text: "#FFF7CC", sub: "#FFE680", ...NAVY },
  hours: { edge: "#FF8A3D", text: "#FFE3CF", sub: "#FFC199", ...NAVY },
  alarm: { edge: "#FF3B3B", text: "#FFFFFF", sub: "#FFB3AD", bg0: "rgba(84,8,16,0.9)", bg1: "rgba(34,2,8,0.95)" },
  gold: { edge: "#FFC83D", text: "#FFF4C4", sub: "#FFE07A", bg0: "rgba(62,42,6,0.88)", bg1: "rgba(26,16,2,0.94)" },
  frozen: { edge: "#A8F6FF", text: "#FFFFFF", sub: "#DDFCFF", bg0: "rgba(26,64,92,0.86)", bg1: "rgba(8,26,44,0.93)" },
};

/** A small line-art hourglass whose sand runs (phase 0..1). */
const Hourglass: React.FC<{ size: number; color: string; phase: number }> = ({ size, color, phase }) => {
  const top = 1 - phase;
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 40 52" style={{ display: "block", overflow: "visible" }}>
      <path d="M6 3 H34 M6 49 H34" stroke={color} strokeWidth={4} strokeLinecap="round" />
      <path d="M9 5 C9 18 18 22 20 26 C22 22 31 18 31 5 Z" fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
      <path d="M9 47 C9 34 18 30 20 26 C22 30 31 34 31 47 Z" fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
      <path d={`M${20 - 9 * top} ${22 - 14 * top} L${20 + 9 * top} ${22 - 14 * top} L20 25 Z`} fill={color} opacity={0.9} />
      <path d={`M${20 - 10 * (1 - top * 0.6)} 46 L${20 + 10 * (1 - top * 0.6)} 46 L20 ${46 - 12 * (1 - top * 0.6)} Z`} fill={color} opacity={0.9} />
      <line x1={20} y1={26} x2={20} y2={44} stroke={color} strokeWidth={1.6} opacity={0.8} />
    </svg>
  );
};

/**
 * A line of counter text. Digits that just changed roll down into place (`k` 0 -> 1 since the
 * tick, `prev` = the text before it); with `cascade` (0..1) every digit spins like a slot
 * machine (ghost digits above and below, jitter, now and then a wrong digit).
 */
const CounterText: React.FC<{ text: string; prev: string | null; k: number; cascade: number; frame: number; seed: number }> = ({ text, prev, k, cascade, frame, seed }) => {
  const chars = Array.from(text);
  const prevChars = prev !== null && prev.length === text.length ? Array.from(prev) : null;
  const e = EASE_OUT(clamp01(k));
  return (
    <span style={{ display: "inline-block", whiteSpace: "pre" }}>
      {chars.map((ch, i) => {
        const isDigit = ch >= "0" && ch <= "9";
        if (isDigit && cascade > 0.02) {
          const d = Number(ch);
          const wrong = rand(frame * 3.71 + i * 11.3 + seed) < 0.28 * cascade;
          const shown = wrong ? String(Math.floor(rand(frame * 1.93 + i * 5.1 + seed) * 10)) : ch;
          const dy = (rand(frame * 5.13 + i * 2.37 + seed) - 0.5) * 0.34 * cascade;
          return (
            <span key={i} style={{ position: "relative", display: "inline-block" }}>
              <span style={{ position: "absolute", left: 0, top: "-0.66em", opacity: 0.42 * cascade, filter: "blur(1.4px)" }}>{(d + 1) % 10}</span>
              <span style={{ position: "absolute", left: 0, top: "0.66em", opacity: 0.42 * cascade, filter: "blur(1.4px)" }}>{(d + 9) % 10}</span>
              <span style={{ display: "inline-block", transform: `translateY(${dy}em)` }}>{shown}</span>
            </span>
          );
        }
        const old = prevChars ? prevChars[i] : ch;
        if (old !== ch && e < 1) {
          return (
            <span key={i} style={{ position: "relative", display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
              <span style={{ visibility: "hidden" }}>{ch}</span>
              <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${e * 90}%) scaleY(${1 - 0.45 * e})`, opacity: 1 - e }}>{old}</span>
              <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(e - 1) * 90}%) scaleY(${0.55 + 0.45 * e})`, transformOrigin: "50% 100%" }}>{ch}</span>
            </span>
          );
        }
        return <React.Fragment key={i}>{ch}</React.Fragment>;
      })}
    </span>
  );
};

/**
 * The floating life counter over a character's head (a holographic panel). (x, y) is the
 * anchor: the bottom centre of its pointer, just above the head; get it with counterAt() from
 * src/tiempo/counter.ts. It scales from there. About 420 x 150 at scale 1 (wider for long
 * texts: "32 AÑOS · 4 MESES" is ~560 wide); event popups rise above it (up to ~y - 300).
 * - seconds: the character's time left (from src/tiempo/clock.ts).
 * - events: popups ("−6 HORAS", "+1 AÑO"...) that rise from the counter at their frame.
 * - draining: red alarm look (shake, glitch, pulsing glow, digit cascade) while it drains.
 *   Under a minute (00:00:59 and less) it turns red too, with a heartbeat on every tick.
 * - frozen: an icy pause look with a pause badge (Nubi holding its breath).
 * - gold: the rich man's golden counter.
 * - appear: materializes at this frame (default: already there).
 * - fast: forces the digit cascade (values changing fast); draining and the first frames after
 *   each event get it anyway. The ticking seconds roll down into place on every tick.
 */
export const LifeCounter: React.FC<{
  frame: number;
  seconds: number;
  x: number;
  y: number;
  scale?: number;
  events?: LifeEvent[];
  draining?: boolean;
  frozen?: boolean;
  gold?: boolean;
  appear?: number;
  opacity?: number;
  fast?: boolean;
}> = ({ frame, seconds, x, y, scale = 1, events = [], draining = false, frozen = false, gold = false, appear, opacity = 1, fast = false }) => {
  const { main, sub, tier } = formatLife(seconds);
  const inK = appear === undefined ? 1 : ramp(frame, appear, appear + 10, [0, 1], EASE_OUT);
  if (inK <= 0 || opacity <= 0) return null;
  const inPop = appear === undefined ? 1 : pop(frame, appear, { damping: 12, stiffness: 210 });
  const alarm = draining || tier === "seconds";
  const pal = gold ? COUNTER_PAL.gold : alarm ? COUNTER_PAL.alarm : frozen ? COUNTER_PAL.frozen : COUNTER_PAL[tier];
  // Fast changes: draining, `fast`, or the first frames after an event.
  const eventHot = events.reduce((m, e) => Math.max(m, frame >= e.at && frame < e.at + 16 ? 1 - (frame - e.at) / 16 : 0), 0);
  const cascade = frozen ? 0 : Math.max(fast || draining ? 1 : 0, Math.min(1, eventHot * 1.8));
  // The ticking second rolls in (counting down: the previous value is one second more).
  const whole = Math.floor(seconds);
  const since = 1 - (seconds - whole);
  const flipK = frozen || cascade > 0.02 || seconds <= 0 || since >= 0.26 ? 1 : since / 0.26;
  const prev = flipK < 1 ? formatLife(whole + 1) : null;
  const tick = tier === "seconds" && !frozen && cascade <= 0.02 && seconds > 0 ? Math.max(0, 1 - since / 0.3) : 0;
  const pulse = alarm ? 0.5 + 0.5 * Math.sin(frame * (draining ? 1.4 : 0.9)) : 0.5 + 0.5 * Math.sin(frame * 0.12);
  const glow = alarm ? Math.max(pulse, tick) : pulse;
  const shakeX = draining ? jit(frame, 1) * 6 : 0;
  const shakeY = draining ? jit(frame, 2) * 4 : 0;
  // A short punch whenever an event lands.
  const hit = events.reduce((m, e) => Math.max(m, frame >= e.at && frame < e.at + 10 ? 1 - (frame - e.at) / 10 : 0), 0);
  const s = scale * (0.6 + 0.4 * inPop) * (1 + 0.12 * hit + 0.07 * tick);
  const big = main.length > 14 ? 40 : 50;
  const mainSize = tier === "years" || tier === "days" ? big : 62;
  // Holographic flicker (stronger while draining).
  const flick = draining && rand(Math.floor(frame / 2) * 3.17 + 0.5) < 0.12 ? 0.62 : 0.94 + 0.06 * rand(Math.floor(frame / 3) * 1.37);
  const split = 1.3 + 4.5 * cascade + (draining ? 1.5 : 0);
  const textShadow = `${-split}px 0 0 rgba(255,40,110,${0.45 + 0.3 * cascade}), ${split}px 0 0 rgba(0,230,255,${0.45 + 0.3 * cascade}), 0 0 14px ${pal.edge}`;
  const hourPhase = frozen ? 0.5 : draining ? (frame % 12) / 12 : (frame % 60) / 60;
  const shine = ((frame + 37) % 96) / 96;
  const lifeBar = clamp01(seconds / (80 * 365 * 86400));
  const reveal = inK < 1 ? `inset(${(1 - inK) * 100}% -60px -60px -60px)` : undefined;
  return (
    <div
      style={{
        position: "absolute",
        left: x + shakeX,
        top: y + shakeY,
        transform: `translate(-50%, -100%) scale(${s})`,
        transformOrigin: "50% 100%",
        opacity: Math.min(1, inK * 1.5) * opacity,
        pointerEvents: "none",
      }}
    >
      {/* Popups rise from the panel. */}
      {events.map((e, i) => {
        const d = frame - e.at;
        if (d < 0 || d > 42) return null;
        const k = clamp01(d / 42);
        const color = EVENT_COLOR[e.tone];
        const p = pop(frame, e.at, { damping: 9, stiffness: 260 });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 150 + 90 * EASE_OUT(k),
              transform: `translateX(-50%) scale(${(e.tone === "tiny" ? 0.75 : 1.15) * (0.5 + 0.5 * p)}) rotate(${(i % 2 ? 3 : -3) * (1 - k)}deg)`,
              opacity: d > 30 ? 1 - (d - 30) / 12 : 1,
              filter: `drop-shadow(0 0 16px ${color})`,
            }}
          >
            <HeavyText text={e.text} size={54} font={FONT.heavy} colors={EVENT_TXT[e.tone]} stroke="#10131F" style={{ fontWeight: 900 }} />
          </div>
        );
      })}
      <div style={{ clipPath: reveal, opacity: flick }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "15px 28px 17px 18px",
            borderRadius: 30,
            background: `linear-gradient(180deg, ${pal.bg0}, ${pal.bg1})`,
            border: `4px solid ${pal.edge}`,
            boxShadow: `0 0 ${14 + 22 * glow}px ${pal.edge}, 0 0 ${46 + 34 * glow}px ${pal.edge}55, inset 0 0 26px ${pal.edge}40, inset 0 2px 0 rgba(255,255,255,0.3), 0 8px 0 rgba(0,0,0,0.35)`,
            minWidth: 300,
          }}
        >
          {/* Hologram texture: scanlines, gloss, a shine sweep and the life bar. */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 26, overflow: "hidden", pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `repeating-linear-gradient(180deg, rgba(255,255,255,${alarm ? 0.09 : 0.06}) 0px, rgba(255,255,255,${alarm ? 0.09 : 0.06}) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 4px)`,
                backgroundPosition: `0 ${(frame * 0.5) % 4}px`,
              }}
            />
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "46%", background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0))" }} />
            {shine < 0.4 ? (
              <div
                style={{
                  position: "absolute",
                  top: -20,
                  bottom: -20,
                  width: 90,
                  left: `${-30 + shine * 340}%`,
                  transform: "skewX(-22deg)",
                  background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))",
                }}
              />
            ) : null}
            {alarm ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(ellipse at 50% 50%, rgba(255,40,40,0) 40%, rgba(255,40,40,${0.18 + 0.22 * glow}) 100%)`,
                }}
              />
            ) : null}
            <div style={{ position: "absolute", left: 18, right: 18, bottom: 6, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }}>
              <div style={{ width: `${Math.max(1.5, lifeBar * 100)}%`, height: "100%", borderRadius: 2, background: pal.edge, boxShadow: `0 0 8px ${pal.edge}` }} />
            </div>
          </div>
          {/* HUD corner brackets. */}
          {[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([sx, sy]) => (
            <div
              key={`${sx}${sy}`}
              style={{
                position: "absolute",
                [sx < 0 ? "left" : "right"]: -13,
                [sy < 0 ? "top" : "bottom"]: -13,
                width: 18,
                height: 18,
                [sx < 0 ? "borderLeft" : "borderRight"]: `4px solid ${pal.edge}`,
                [sy < 0 ? "borderTop" : "borderBottom"]: `4px solid ${pal.edge}`,
                opacity: 0.85,
                filter: `drop-shadow(0 0 5px ${pal.edge})`,
              }}
            />
          ))}
          <div
            style={{
              position: "relative",
              width: 52,
              height: 52,
              borderRadius: 26,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `radial-gradient(circle, ${pal.edge}44 0%, ${pal.edge}10 70%)`,
              border: `2px solid ${pal.edge}88`,
            }}
          >
            <Hourglass size={30} color={pal.edge} phase={hourPhase} />
          </div>
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              lineHeight: 1.02,
              transform: cascade > 0.02 ? `translateX(${jit(frame, 9, 1) * 3 * cascade}px)` : undefined,
            }}
          >
            <div style={{ ...MONO_DIGITS, fontFamily: FONT.heavy, fontWeight: 900, fontSize: mainSize, color: pal.text, whiteSpace: "nowrap", letterSpacing: 1, textShadow }}>
              <CounterText text={main} prev={prev ? prev.main : null} k={flipK} cascade={cascade} frame={frame} seed={1} />
            </div>
            {sub ? (
              <div style={{ ...MONO_DIGITS, fontFamily: FONT.heavy, fontWeight: 800, fontSize: 30, color: pal.sub, whiteSpace: "nowrap", marginTop: 4, textShadow }}>
                <CounterText text={sub} prev={prev ? prev.sub : null} k={flipK} cascade={cascade} frame={frame} seed={2} />
              </div>
            ) : null}
          </div>
          {frozen ? (
            <div
              style={{
                marginLeft: 6,
                width: 44,
                height: 44,
                borderRadius: 22,
                background: "#A8F6FF",
                boxShadow: `0 0 ${10 + 8 * pulse}px #A8F6FF`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <div style={{ width: 8, height: 22, background: "#0B1430", borderRadius: 2 }} />
              <div style={{ width: 8, height: 22, background: "#0B1430", borderRadius: 2 }} />
            </div>
          ) : null}
          {alarm ? (
            <div
              style={{
                position: "absolute",
                right: -20,
                top: -22,
                width: 40,
                height: 40,
                borderRadius: 20,
                background: "#FF3B3B",
                border: "3px solid #FFFFFF",
                boxShadow: `0 0 ${10 + 14 * glow}px #FF3B3B`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT.heavy,
                fontWeight: 900,
                fontSize: 28,
                color: "#FFFFFF",
                opacity: blink(frame, 0, 8, 5) ? 1 : 0.35,
                transform: `scale(${1 + 0.15 * glow})`,
              }}
            >
              !
            </div>
          ) : null}
        </div>
        {/* The projector beam down to the head. */}
        <div style={{ position: "relative", height: 34 }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -2,
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "16px solid transparent",
              borderRight: "16px solid transparent",
              borderTop: `18px solid ${pal.edge}`,
              filter: `drop-shadow(0 0 8px ${pal.edge})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 10,
              transform: "translateX(-50%)",
              width: 96,
              height: 24,
              clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)",
              background: `linear-gradient(180deg, ${pal.edge}AA, ${pal.edge}00)`,
              opacity: 0.55 + 0.25 * pulse,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 18,
              transform: "translateX(-50%)",
              width: 90,
              height: 18,
              background: `radial-gradient(ellipse at 50% 100%, ${pal.edge}99, transparent 70%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// TitleSticker

type TitleLine = { text: string; hi: boolean };

/** Splits `s` into one or two lines of balanced width (Luckiest Guy). */
const splitBalanced = (s: string): string[] => {
  const words = s.split(" ").filter(Boolean);
  if (words.length < 2 || lgWidth(s) < 8.6) return [words.join(" ")];
  let best = 1;
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const w = Math.max(lgWidth(words.slice(0, i).join(" ")), lgWidth(words.slice(i).join(" ")));
    if (w < bestW) {
      bestW = w;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
};

/** Title lines: "\n" breaks lines, `*…*` (or the words "TIEMPO DE VIDA") is the highlighted last line. */
const titleLines = (text: string): TitleLine[] => {
  if (text.indexOf("\n") >= 0) return text.split("\n").map((l) => ({ text: l.replace(/\*/g, "").trim(), hi: l.indexOf("*") >= 0 }));
  let pre = text;
  let hi = "";
  const m = text.indexOf("*");
  if (m >= 0) {
    const e = text.indexOf("*", m + 1);
    pre = text.slice(0, m).trim();
    hi = (e < 0 ? text.slice(m + 1) : text.slice(m + 1, e) + text.slice(e + 1)).trim();
  } else {
    const i = text.indexOf("TIEMPO DE VIDA");
    if (i >= 0) {
      pre = text.slice(0, i).trim();
      hi = text.slice(i).trim();
    }
  }
  const lines: TitleLine[] = splitBalanced(pre)
    .filter((l) => l.length > 0)
    .map((l) => ({ text: l, hi: false }));
  if (hi) lines.push({ text: hi, hi: true });
  return lines;
};

/**
 * The video's title in the top band (x 60-940, y 240-470): two white lines in big heavy
 * letters and the highlighted line ("TIEMPO DE VIDA?") in gold on a red marker bar that wipes
 * in, with a small hourglass that keeps running and flipping over next to the first line. Lines
 * pop in one after the other with a slight wobble at `at`, and leave one by one (shrinking,
 * flying up) at `out`. A soft dark scrim behind keeps it readable on any shot. `text`: "\n"
 * breaks lines and `*…*` marks the highlight (by default the words "TIEMPO DE VIDA" and the
 * rest after them). Footprint fixed: x 70-930, centred on y 355.
 */
export const TitleSticker: React.FC<{ frame: number; at: number; out: number; text?: string }> = ({
  frame,
  at,
  out,
  text = "¿QUÉ PASARÍA SI EL DINERO FUERA TIEMPO DE VIDA?",
}) => {
  if (frame < at || frame > out + 16) return null;
  const t = frame - at;
  const lines = titleLines(text);
  const sizes = lines.map((l) => Math.min(l.hi ? 92 : 70, (l.hi ? 740 : 660) / Math.max(1, lgWidth(l.text))));
  const heights = lines.map((l, i) => sizes[i] * 0.94 + (l.hi ? 22 : 0));
  const gap = 10;
  const total = heights.reduce((a, b) => a + b, 0) + gap * (lines.length - 1);
  const ys: number[] = [];
  let cursor = 355 - total / 2;
  for (const h of heights) {
    ys.push(cursor + h / 2);
    cursor += h + gap;
  }
  const scrimK = ramp(frame, at, at + 8) * (1 - ramp(frame, out, out + 14));
  const firstW = lines.length > 0 ? lgWidth(lines[0].text) * sizes[0] : 400;
  const hgX = Math.min(872, 500 + firstW / 2 + 74);
  const hgIn = pop(frame, at + 12, { damping: 9, stiffness: 190 });
  const hgOut = ramp(frame, out, out + 8, [0, 1], EASE_IN);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 190,
          width: 960,
          height: 340,
          background: "radial-gradient(closest-side, rgba(12,10,24,0.5), rgba(12,10,24,0.28) 60%, rgba(12,10,24,0))",
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
            key={i}
            style={{
              position: "absolute",
              left: 500,
              top: ys[i],
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
                  top: -12,
                  bottom: -10,
                  borderRadius: 20,
                  background: "linear-gradient(180deg, #FF5A4E 0%, #FF3B3B 45%, #C8102E 100%)",
                  border: "6px solid #FFFFFF",
                  boxShadow: `0 0 0 5px ${INK}, 0 10px 0 5px rgba(0,0,0,0.3)`,
                  transform: `scaleX(${sw}) rotate(-1.2deg)`,
                  transformOrigin: "0% 50%",
                }}
              />
            ) : null}
            <div style={{ position: "relative", paddingTop: sizes[i] * 0.06 }}>
              <HeavyText text={l.text} size={sizes[i]} colors={l.hi ? TXT_GOLD : TXT_WHITE} />
            </div>
          </div>
        );
      })}
      {hgIn > 0.001 && hgOut < 1 ? (
        <div
          style={{
            position: "absolute",
            left: hgX,
            top: (ys[0] ?? 300) + Math.sin(t * 0.1) * 6,
            transform: `translate(-50%, -50%) scale(${hgIn * (1 - hgOut)}) rotate(${14 + (1 - hgIn) * 50 + Math.sin(t * 0.07) * 5}deg)`,
          }}
        >
          <FlippingHourglass frame={frame} size={100} period={70} offset={-at - 14} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// PriceSticker

/**
 * Price tag in TIME units ("JUGO" / "6 HORAS"): a cream coupon card (dashed inner border,
 * white border, dark outline, hard shadow) with a red badge holding a running hourglass on the
 * left, the price in big red letters and the item on a charcoal tab on its top edge. Slams in
 * like a rubber stamp at `at` (falls from 2.3x in 5 frames, squash, shake, a white shock ring
 * and impact lines), wobbles gently, shrinks away at `out`. `x`, `y` = card centre; 600 x 176
 * (x ± 300, y - 120 … y + 88 with the tab). Suggested: x 500, y 420-900 (beside the product).
 */
export const PriceSticker: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  item: string;
  price: string;
  scale?: number;
  rotate?: number;
}> = ({ frame, at, out, x, y, item, price, scale = 1, rotate = -3 }) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const SLAM = 5;
  const fall = ramp(frame, at, at + SLAM, [0, 1], EASE_IN);
  const landed = t >= SLAM;
  const settle = landed ? pop(frame, at + SLAM, { damping: 8, stiffness: 260 }) : 0;
  const sq = bump(frame, at + SLAM - 1, 8);
  const base = landed ? 1 : 2.3 - 1.3 * fall;
  const k = leave(frame, out, 10);
  const sh = impact(frame, at + SLAM, 14, 10);
  const rot = rotate + (landed ? (1 - settle) * 7 : 9 * (1 - fall)) + Math.sin(t * 0.08) * 0.6 + sh.r;
  const ring = landed ? clamp01((t - SLAM) / 10) : -1;
  const W = 600;
  const H = 176;
  const priceSize = Math.min(100, 380 / Math.max(1, lgWidth(price)));
  const tabIn = pop(frame, at + SLAM + 2, { damping: 9, stiffness: 240 });
  return (
    <div
      style={{
        position: "absolute",
        left: x + sh.x,
        top: y + sh.y,
        width: 0,
        height: 0,
        transform: `scale(${scale * (1 - 0.85 * k)})`,
        opacity: Math.min(1, fall * 3) * (1 - k),
        pointerEvents: "none",
      }}
    >
      {/* Impact lines. */}
      {ring >= 0 && ring < 1
        ? Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2 + 0.3;
            const r0 = 250 + 130 * EASE_OUT(ring);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: Math.cos(a) * r0 * 1.15,
                  top: Math.sin(a) * r0 * 0.5,
                  width: 46 * (1 - ring),
                  height: 9,
                  borderRadius: 5,
                  background: "#FFFFFF",
                  boxShadow: `0 0 0 3px ${INK}`,
                  transform: `translate(-50%, -50%) rotate(${(a * 180) / Math.PI}deg)`,
                  opacity: 1 - ring,
                }}
              />
            );
          })
        : null}
      <div
        style={{
          position: "absolute",
          left: -W / 2,
          top: -H / 2,
          width: W,
          height: H,
          transform: `scale(${base * (1 + 0.1 * sq)}, ${base * (1 - 0.14 * sq)}) rotate(${rot}deg)`,
        }}
      >
        {ring >= 0 && ring < 1 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 40,
              border: `${10 * (1 - ring)}px solid #FFFFFF`,
              transform: `scale(${1 + 0.22 * EASE_OUT(ring)})`,
              opacity: 1 - ring,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxSizing: "border-box",
            borderRadius: 38,
            background: "linear-gradient(180deg, #FFFDF4 0%, #FFF3DA 60%, #FFE6BE 100%)",
            border: "7px solid #FFFFFF",
            boxShadow: SHADOW,
            display: "flex",
            alignItems: "center",
            padding: "0 26px 0 18px",
            gap: 20,
          }}
        >
          <div style={{ position: "absolute", inset: 9, borderRadius: 28, border: "3px dashed rgba(208,0,26,0.32)" }} />
          <div
            style={{
              position: "relative",
              width: 128,
              height: 128,
              flexShrink: 0,
              borderRadius: "50%",
              boxSizing: "border-box",
              background: "radial-gradient(circle at 35% 30%, #FF8A7E 0%, #FF3B3B 55%, #C8102E 100%)",
              border: "6px solid #FFFFFF",
              boxShadow: `0 0 0 5px ${INK}, 0 6px 0 5px rgba(0,0,0,0.22)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `rotate(${Math.sin(t * 0.09) * 6}deg)`,
            }}
          >
            <HourglassIcon size={92} phase={clamp01(t / 70)} cap={TC.charcoal} glass="#FFF4EE" />
          </div>
          <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center", paddingTop: priceSize * 0.08 }}>
            <HeavyText text={price} size={priceSize} colors={TXT_RED} />
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 176,
            top: 0,
            transform: `translateY(-62%) scale(${tabIn}) rotate(${-4 + (1 - tabIn) * 14}deg)`,
            transformOrigin: "0% 50%",
            padding: "9px 28px 7px",
            borderRadius: 999,
            background: `linear-gradient(180deg, #34344A 0%, ${TC.charcoal} 100%)`,
            border: "5px solid #FFFFFF",
            boxShadow: SHADOW_SM,
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 36,
            lineHeight: 1,
            letterSpacing: 4,
            color: "#FFF3DA",
            whiteSpace: "nowrap",
          }}
        >
          {item}
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// RuleSign

/**
 * The working rule as an equation sign: "8 H / DE TRABAJO = +1 DÍA / DE VIDA" on a charcoal
 * card (white border, dark outline, hard shadow) with a briefcase icon and a red "REGLA TIMECO"
 * tab carrying the logo. Pops in at `at` piece by piece; the green "+1 DÍA" switches on like a
 * neon tube (two flickers) and keeps glowing. With `asteriskAt` an asterisk lands after "+1 DÍA"
 * and a fine-print strip "*SI LA EMPRESA LO APRUEBA" drops under the card (the coworker's
 * line). Shrinks away at `out`. `x`, `y` = card centre; 760 x 200 (x ± 380, y - 130 … y + 100;
 * the fine print reaches y + 160). Suggested: x 500, y 520 (OFICINA.DIA).
 */
export const RuleSign: React.FC<{ frame: number; at: number; out: number; x: number; y: number; asteriskAt?: number; scale?: number }> = ({
  frame,
  at,
  out,
  x,
  y,
  asteriskAt,
  scale = 1,
}) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 11, stiffness: 190 });
  const k = leave(frame, out, 10);
  const piece = (d: number) => pop(frame, at + d, { damping: 9, stiffness: 230 });
  const neonOnAt = at + 14;
  const nd = frame - neonOnAt;
  const neon = nd < 0 ? 0.12 : nd < 2 ? 1 : nd < 4 ? 0.2 : nd < 5 ? 1 : nd < 7 ? 0.35 : 1;
  const neonGlow = neon * (0.75 + 0.25 * Math.sin(t * 0.25));
  const astP = asteriskAt !== undefined && frame >= asteriskAt ? pop(frame, asteriskAt, { damping: 8, stiffness: 260 }) : 0;
  const fineP = asteriskAt !== undefined && frame >= asteriskAt + 4 ? pop(frame, asteriskAt + 4, { damping: 11, stiffness: 200 }) : 0;
  const small: React.CSSProperties = {
    fontFamily: FONT.heavy,
    fontWeight: 900,
    fontSize: 27,
    letterSpacing: 2.5,
    color: "#E9E9F2",
    whiteSpace: "nowrap",
    lineHeight: 1,
    marginTop: 6,
  };
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 760,
        transform: `translate(-50%, -50%) scale(${p * (1 - k) * scale}) rotate(${-1.5 + (1 - p) * -8 + Math.sin(t * 0.06) * 0.5}deg)`,
        opacity: Math.min(1, p * 3) * (1 - k),
        pointerEvents: "none",
      }}
    >
      {fineP > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 170,
            transform: `translate(-50%, ${(1 - fineP) * -40}px) rotate(2deg) scale(${0.6 + 0.4 * fineP})`,
            opacity: Math.min(1, fineP * 2),
            padding: "10px 24px 8px",
            borderRadius: 14,
            background: "#FFF3DA",
            border: "4px solid #FFFFFF",
            boxShadow: SHADOW_SM,
            fontFamily: FONT.heavy,
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: 1.5,
            color: "#C8102E",
            whiteSpace: "nowrap",
          }}
        >
          *SI LA EMPRESA LO APRUEBA
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          height: 200,
          boxSizing: "border-box",
          borderRadius: 40,
          background: `linear-gradient(180deg, #34344A 0%, ${TC.charcoal} 70%)`,
          border: "7px solid #FFFFFF",
          boxShadow: SHADOW,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          paddingTop: 10,
        }}
      >
        <div style={{ transform: `scale(${piece(3)}) rotate(${(1 - piece(3)) * -30 + Math.sin(t * 0.1) * 3}deg)` }}>
          <BriefcaseIcon size={112} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${piece(6)})` }}>
          <div style={{ paddingTop: 8 }}>
            <HeavyText text="8 H" size={84} colors={TXT_ORANGE} />
          </div>
          <div style={small}>DE TRABAJO</div>
        </div>
        <div style={{ transform: `scale(${piece(10)})`, marginTop: -16 }}>
          <HeavyText text="=" size={96} colors={TXT_WHITE} />
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${piece(13)})` }}>
          <div style={{ paddingTop: 8, filter: `drop-shadow(0 0 ${6 + 18 * neonGlow}px rgba(80,255,120,${0.9 * neon}))`, opacity: 0.35 + 0.65 * neon }}>
            <HeavyText text="+1 DÍA" size={84} colors={TXT_GREEN} />
          </div>
          <div style={{ ...small, color: neon > 0.5 ? "#C9FFD6" : "#9AA0B0" }}>DE VIDA</div>
          {astP > 0.001 ? (
            <div style={{ position: "absolute", right: -40, top: -6, transform: `scale(${astP}) rotate(${(1 - astP) * 90}deg)` }}>
              <HeavyText text="*" size={78} colors={TXT_RED} />
            </div>
          ) : null}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 0,
          transform: `translateY(-60%) scale(${piece(2)}) rotate(${-3 + (1 - piece(2)) * 16}deg)`,
          transformOrigin: "0% 50%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 22px 6px 8px",
          borderRadius: 999,
          background: "linear-gradient(135deg, #FF6A5E 0%, #D0101E 100%)",
          border: "5px solid #FFFFFF",
          boxShadow: SHADOW_SM,
          whiteSpace: "nowrap",
        }}
      >
        <TimecoLogo size={44} outline={false} phase={(t % 80) / 80} />
        <div style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 28, letterSpacing: 3, color: "#FFFFFF", lineHeight: 1 }}>REGLA TIMECO</div>
      </div>
    </div>
  );
};

// =============================================================================================
// TimecoNotification

/**
 * A giant phone push notification from TIMECO sliding down into the top band (x 60-940, from
 * y 240): the app icon (the TIMECO logo on charcoal, with a red "1" badge), "TIMECO · ahora",
 * "CARGO AUTOMÁTICO" in red and "Respirar en zona premium". It drops in with a spring at `at`
 * and shakes a little when it lands; at `thanksAt` it grows a line "¡Gracias por respirar con
 * TIMECO!" with a smiley. Slides back up at `out`. Footprint 880 x ~190 (y 240-430), ~245
 * with the thanks line (y 240-485). Suggested: at CARGO.NOTIF, thanksAt CARGO.GRACIAS.
 */
export const TimecoNotification: React.FC<{ frame: number; at: number; out: number; thanksAt?: number }> = ({ frame, at, out, thanksAt }) => {
  if (frame < at || frame > out + 12) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 13, stiffness: 150 });
  const k = leave(frame, out, 11);
  const sh = impact(frame, at + 6, 16, 14);
  const ty = 240 - (1 - p) * 460 - k * 520;
  const thx = thanksAt === undefined ? 0 : ramp(frame, thanksAt, thanksAt + 8, [0, 1], EASE_OUT);
  const thxP = thanksAt === undefined || frame < thanksAt ? 0 : pop(frame, thanksAt + 1, { damping: 10, stiffness: 220 });
  const badge = pop(frame, at + 8, { damping: 8, stiffness: 260 });
  const ding = bump(frame, at + 6, 10) + (thanksAt === undefined ? 0 : bump(frame, thanksAt, 10));
  return (
    <div
      style={{
        position: "absolute",
        left: 60 + sh.x,
        top: ty + sh.y,
        width: 880,
        transform: `rotate(${sh.r * 0.6}deg)`,
        transformOrigin: "50% 0%",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          boxSizing: "border-box",
          borderRadius: 46,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(238,240,246,0.98) 100%)",
          border: "6px solid #FFFFFF",
          boxShadow: `0 0 0 5px ${INK}, 0 12px 0 5px rgba(0,0,0,0.3), 0 30px 60px rgba(0,0,0,0.35)`,
          padding: "22px 30px 22px 24px",
          display: "flex",
          gap: 24,
          overflow: "visible",
        }}
      >
        <div style={{ position: "relative", flexShrink: 0, width: 108, height: 108 }}>
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 28,
              background: `linear-gradient(180deg, #2E2E3E 0%, ${TC.charcoal} 100%)`,
              boxShadow: `0 0 0 4px ${INK}, 0 0 ${18 * ding}px rgba(255,59,59,0.8)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TimecoLogo size={90} outline={false} phase={((t + 20) % 90) / 90} />
          </div>
          <div
            style={{
              position: "absolute",
              right: -14,
              top: -14,
              width: 42,
              height: 42,
              borderRadius: 21,
              background: TC.red,
              border: "4px solid #FFFFFF",
              boxShadow: `0 0 0 3px ${INK}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT.heavy,
              fontWeight: 900,
              fontSize: 24,
              color: "#FFFFFF",
              transform: `scale(${badge})`,
            }}
          >
            {thanksAt !== undefined && frame >= thanksAt ? "2" : "1"}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontFamily: FONT.heavy, fontSize: 30, lineHeight: 1, whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 900, letterSpacing: 3, color: TC.charcoal }}>TIMECO</span>
            <span style={{ fontWeight: 700, color: "#8A8D98", marginLeft: 10 }}>· ahora</span>
          </div>
          <div style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 50, lineHeight: 1.05, color: "#E8202A", letterSpacing: 0.5, marginTop: 10, whiteSpace: "nowrap" }}>
            CARGO AUTOMÁTICO
          </div>
          <div style={{ fontFamily: FONT.heavy, fontWeight: 700, fontSize: 37, lineHeight: 1.1, color: "#2A2A36", marginTop: 6, whiteSpace: "nowrap" }}>Respirar en zona premium</div>
          <div style={{ height: 58 * thx, overflow: "visible" }}>
            {thxP > 0.001 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 12,
                  fontFamily: FONT.heavy,
                  fontWeight: 800,
                  fontSize: 34,
                  lineHeight: 1,
                  color: "#2A2A36",
                  whiteSpace: "nowrap",
                  transform: `scale(${0.7 + 0.3 * thxP})`,
                  transformOrigin: "0% 50%",
                  opacity: Math.min(1, thxP * 2),
                }}
              >
                ¡Gracias por respirar con TIMECO!
                <SmileyIcon size={44} style={{ transform: `rotate(${Math.sin((frame - (thanksAt ?? 0)) * 0.2) * 10}deg)` }} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// ExtractionScreen

const LED_RED = "#FF3B3B";
const LED_HOT = "#FF6A5E";
const LED_GOLD = "#FFC83D";

/** A digit column of an odometer: `pos` 0..10 (continuous, 10 = the 0 after 9). */
const OdoDigit: React.FC<{ pos: number; size: number; dim: boolean }> = ({ pos, size, dim }) => (
  <div style={{ position: "relative", width: size * 0.7, height: size, overflow: "hidden", opacity: dim ? 0.22 : 1 }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: "100%", transform: `translateY(${-pos * size}px)` }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
        <div key={i} style={{ height: size, lineHeight: `${size}px`, textAlign: "center" }}>
          {d}
        </div>
      ))}
    </div>
  </div>
);

/** Odometer: `value` rolls like a mechanical counter; a gap every three digits from the right. */
const Odometer: React.FC<{ value: number; digits: number; size: number }> = ({ value, digits, size }) => {
  const cols: React.ReactNode[] = [];
  for (let i = digits - 1; i >= 0; i--) {
    const p10 = Math.pow(10, i);
    const lower = value % p10;
    const carry = i === 0 ? 0 : clamp01(lower - (p10 - 1));
    const pos = i === 0 ? value % 10 : (Math.floor(value / p10) % 10) + carry;
    cols.push(<OdoDigit key={i} pos={pos} size={size} dim={i > 0 && value < p10 - 0.5} />);
    if (i % 3 === 0 && i > 0) cols.push(<div key={`g${i}`} style={{ width: size * 0.22 }} />);
  }
  return <div style={{ display: "flex", ...MONO_DIGITS }}>{cols}</div>;
};

/**
 * TIMECO's huge red LED alert screen (x 60-940, y 260-900): a charcoal bezel with screws and
 * hazard stripes, the TIMECO logo as a badge on its top-left corner, and a dot-matrix red
 * screen: "● EN VIVO" blinking, "TIEMPO EXTRAÍDO HOY", a huge "45 SEGUNDOS" (blinks in),
 * "DE CADA PERSONA"; at `totalAt` (default at + 25) a gold total rolls up like an odometer to
 * "TOTAL: 11 407 AÑOS" with the sum in small print (45 s × 8 000 millones de personas ≈ 11 407
 * años). Scanlines, a rolling bright band, bloom, flicker and now and then a dropout. Powers on
 * like a CRT at `at`, collapses to a line at `out`. Suggested: at TIMECO.SCREEN.
 */
export const ExtractionScreen: React.FC<{ frame: number; at: number; out: number; totalAt?: number }> = ({ frame, at, out, totalAt }) => {
  if (frame < at || frame > out + 14) return null;
  const t = frame - at;
  const tAt = totalAt ?? at + 25;
  const p = pop(frame, at, { damping: 14, stiffness: 170 });
  const on = ramp(frame, at + 3, at + 9, [0, 1], EASE_OUT);
  const off = ramp(frame, out, out + 7, [0, 1], EASE_IN);
  const k = ramp(frame, out + 6, out + 14, [0, 1], EASE_IN);
  const dropout = rand(Math.floor(frame / 2) * 3.13 + 0.7) < 0.07;
  const flick = (0.88 + 0.12 * rand(frame * 1.71)) * (dropout ? 0.55 : 1);
  const bigOn = t < 6 ? 0 : t < 16 ? (Math.floor((t - 6) / 3) % 2 === 0 ? 1 : 0.12) : 1;
  const totalIn = frame < tAt ? 0 : (frame - tAt) < 2 ? 1 : (frame - tAt) < 4 ? 0.2 : 1;
  const value = 11407 * ramp(frame, tAt + 3, tAt + 45, [0, 1], EASE_OUT);
  const done = frame >= tAt + 45;
  const scrY = 0.02 + 0.98 * on * (1 - off);
  const bandY = ((t * 9) % 760) - 140;
  const W = 880;
  const H = 640;
  const IW = W - 48;
  const IH = H - 48;
  const led = (size: number, color = LED_RED): React.CSSProperties => ({
    fontFamily: FONT.heavy,
    fontWeight: 900,
    fontSize: size,
    lineHeight: 1,
    color,
    letterSpacing: size * 0.05,
    whiteSpace: "nowrap",
    textAlign: "center",
  });
  const content = (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", right: 28, top: 26, display: "flex", alignItems: "center", gap: 10, opacity: blink(frame, at, 10, 6) ? 1 : 0.25 }}>
        <div style={{ width: 22, height: 22, borderRadius: 11, background: LED_HOT }} />
        <div style={led(30, LED_HOT)}>EN VIVO</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 86, ...led(50) }}>TIEMPO EXTRAÍDO HOY</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 22, opacity: bigOn }}>
        <div style={{ ...led(212, LED_HOT), letterSpacing: 4 }}>45</div>
        <div style={{ ...led(78, LED_HOT), paddingBottom: 26 }}>SEGUNDOS</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 372, ...led(50) }}>DE CADA PERSONA</div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 444, height: 6, backgroundImage: `repeating-linear-gradient(90deg, ${LED_RED} 0 10px, rgba(0,0,0,0) 10px 18px)`, opacity: 0.7 }} />
      {totalIn > 0 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 470, opacity: totalIn }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18 }}>
            <div style={led(48, LED_GOLD)}>TOTAL:</div>
            <div style={{ ...led(88, LED_GOLD), letterSpacing: 0 }}>
              <Odometer value={value} digits={5} size={88} />
            </div>
            <div style={led(48, LED_GOLD)}>AÑOS</div>
          </div>
          <div style={{ ...led(22, "#FF9A8E"), marginTop: 6, letterSpacing: 2, opacity: done ? 1 : 0.5 }}>45 s × 8 000 MILLONES DE PERSONAS ≈ 11 407 AÑOS</div>
        </div>
      ) : null}
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        top: 260,
        width: W,
        height: H,
        transform: `scale(${(0.82 + 0.18 * p) * (1 - 0.9 * k)})`,
        opacity: Math.min(1, p * 3) * (1 - k),
        pointerEvents: "none",
      }}
    >
      {/* Bezel. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 40,
          background: "linear-gradient(180deg, #3A3A4C 0%, #1B1B24 55%, #121219 100%)",
          border: "6px solid #4A4A5E",
          boxSizing: "border-box",
          boxShadow: `0 0 0 5px ${INK}, 0 14px 0 5px rgba(0,0,0,0.35), 0 0 ${60 + 30 * flick}px rgba(255,40,40,${0.35 * on * (1 - off)})`,
        }}
      />
      {[
        [16, 16],
        [W - 16, 16],
        [16, H - 16],
        [W - 16, H - 16],
      ].map(([sx, sy]) => (
        <div key={`${sx}-${sy}`} style={{ position: "absolute", left: sx - 6, top: sy - 6, width: 12, height: 12, borderRadius: 6, background: "#8A8A9E", boxShadow: "inset -2px -2px 0 rgba(0,0,0,0.5)" }} />
      ))}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 5,
          height: 14,
          borderRadius: 7,
          backgroundImage: `repeating-linear-gradient(-45deg, ${TC.red} 0 14px, ${TC.gold} 14px 28px)`,
          opacity: 0.9,
        }}
      />
      {/* Screen. */}
      <div
        style={{
          position: "absolute",
          left: 24,
          top: 24,
          width: IW,
          height: IH,
          borderRadius: 22,
          overflow: "hidden",
          background: "radial-gradient(ellipse at 50% 45%, #3A070C 0%, #1C0306 60%, #0B0103 100%)",
          boxShadow: "inset 0 0 0 3px #000",
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `scaleY(${scrY}) translateX(${dropout ? jit(frame, 4, 1) * 10 : 0}px)`, opacity: flick }}>
          {/* Unlit LED grid. */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,70,70,0.16) 0 1.6px, rgba(0,0,0,0) 2.2px)", backgroundSize: "7px 7px" }} />
          {/* Bloom. */}
          <div style={{ position: "absolute", inset: 0, filter: "blur(9px)", opacity: 0.75 }}>{content}</div>
          {/* Lit LEDs (the text through a dot mask). */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              WebkitMaskImage: "radial-gradient(circle, #000 0 2.5px, rgba(0,0,0,0) 3.1px)",
              WebkitMaskSize: "7px 7px",
              maskImage: "radial-gradient(circle, #000 0 2.5px, rgba(0,0,0,0) 3.1px)",
              maskSize: "7px 7px",
            }}
          >
            {content}
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: 0.22 }}>{content}</div>
          {/* Scanlines and the rolling band. */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: bandY, height: 140, background: "linear-gradient(180deg, rgba(255,90,90,0) 0%, rgba(255,90,90,0.1) 50%, rgba(255,90,90,0) 100%)" }} />
        </div>
        {on < 1 || off > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: IH / 2 - 3,
              height: 6,
              background: "#FFFFFF",
              boxShadow: "0 0 30px 10px rgba(255,120,120,0.8)",
              opacity: on < 1 ? 1 - on : off,
              transform: `scaleX(${off > 0 ? 1 - 0.95 * off : 1})`,
            }}
          />
        ) : null}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
        <div style={{ position: "absolute", left: -80, top: -60, width: 520, height: 300, transform: "rotate(-18deg)", background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0))" }} />
      </div>
      {/* TIMECO badge on the corner. */}
      <div
        style={{
          position: "absolute",
          left: -18,
          top: -26,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 22px 6px 6px",
          borderRadius: 999,
          background: TC.charcoal,
          border: "5px solid #FFFFFF",
          boxShadow: SHADOW_SM,
          transform: `scale(${pop(frame, at + 6, { damping: 9, stiffness: 240 })}) rotate(-4deg)`,
          transformOrigin: "20% 50%",
        }}
      >
        <TimecoLogo size={62} outline={false} phase={(t % 60) / 60} />
        <TimecoWordmark size={30} />
      </div>
    </div>
  );
};

// =============================================================================================
// ScanStamp

const STAMP_RED = "#E8202A";

/** Rubber-stamp "QUEJA DETECTADA" with the TIMECO mark, speckled like real ink (600 x 230). */
const StampArt: React.FC = () => {
  const uid = useUid();
  const specks: React.ReactNode[] = [];
  for (let i = 0; i < 70; i++) {
    specks.push(<circle key={i} cx={rand(i * 3.17 + 1) * 600} cy={rand(i * 5.31 + 2) * 230} r={1.2 + rand(i * 7.7 + 3) * 3.6} fill="#000" />);
  }
  for (let i = 0; i < 5; i++) {
    const x0 = rand(i * 9.1 + 4) * 600;
    const y0 = rand(i * 4.3 + 5) * 230;
    specks.push(<path key={`s${i}`} d={`M${x0} ${y0} l${40 + rand(i) * 60} ${(rand(i * 2.2) - 0.5) * 16}`} stroke="#000" strokeWidth={2.5} strokeLinecap="round" />);
  }
  return (
    <svg width={600} height={230} viewBox="0 0 600 230" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <mask id={`sm${uid}`}>
          <rect x={-20} y={-20} width={640} height={270} fill="#FFFFFF" />
          {specks}
        </mask>
      </defs>
      <g mask={`url(#sm${uid})`} fill="none" stroke={STAMP_RED}>
        <rect x={8} y={8} width={584} height={214} rx={26} strokeWidth={11} fill="rgba(232,32,42,0.07)" />
        <rect x={24} y={24} width={552} height={182} rx={16} strokeWidth={4} />
        <circle cx={112} cy={115} r={62} strokeWidth={7} />
        <circle cx={112} cy={115} r={50} strokeWidth={3} />
        <path d="M94 82 L130 82 M94 148 L130 148" strokeWidth={6} strokeLinecap="round" />
        <path d="M97 84 C97 104 109 108 112 115 C115 108 127 104 127 84 Z M97 146 C97 126 109 122 112 115 C115 122 127 126 127 146 Z" strokeWidth={5} strokeLinejoin="round" />
        <path d="M103 141 L121 141 L112 128 Z" fill={STAMP_RED} strokeWidth={2} />
        <text x={384} y={112} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={900} fontSize={84} letterSpacing={6} fill={STAMP_RED} stroke="none">
          QUEJA
        </text>
        <text x={384} y={180} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={900} fontSize={50} letterSpacing={4} fill={STAMP_RED} stroke="none">
          DETECTADA
        </text>
      </g>
    </svg>
  );
};

/**
 * The TIMECO drone's scan over a character, then the verdict: a red HUD reticle (corner
 * brackets closing in, a rotating dashed ring, crosshair, a scan beam sweeping up and down,
 * "ESCANEANDO… 0-100 %") from `at`; at `stampAt` (default at + 22) the reticle locks and a red
 * rubber stamp "QUEJA DETECTADA" with the TIMECO mark slams on top (rotated, speckled ink, ink
 * splats, a shake). Fades out at `out`. `x`, `y` = centre of the scanned character; reticle
 * 400 x 400 (x ± 200, y ± 200, its label 40 px above), stamp 600 x 230 centred on (x, y).
 * Suggested: x 500, y 760 (over Nubi), at FINAL.SCAN, stampAt FINAL.L14 + 4.
 */
export const ScanStamp: React.FC<{ frame: number; at: number; out: number; x: number; y: number; stampAt?: number; scale?: number }> = ({
  frame,
  at,
  out,
  x,
  y,
  stampAt,
  scale = 1,
}) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const sAt = stampAt ?? at + 22;
  const k = leave(frame, out, 10);
  const c = pop(frame, at, { damping: 14, stiffness: 150 });
  const locked = frame >= sAt;
  const lockP = locked ? pop(frame, sAt, { damping: 10, stiffness: 300 }) : 0;
  const B = 200;
  const half = B + (1 - c) * 170 - lockP * 16;
  const retA = (locked ? 1 - 0.55 * ramp(frame, sAt + 8, sAt + 18) : 1) * Math.min(1, c * 2);
  const RED = "#FF2E3A";
  const scanY = -half + 2 * half * tri(t / 22);
  const pct = Math.round(ramp(frame, at + 2, sAt, [0, 100], EASE_IN_OUT));
  const LAND = sAt + 5;
  const sp = ramp(frame, sAt, LAND, [0, 1], EASE_IN);
  const stampS = !locked ? 0 : frame < LAND ? 2.6 - 1.6 * sp : 1 - 0.07 * bump(frame, LAND, 6);
  const sh = impact(frame, LAND, 16, 10);
  const lockFlash = locked ? Math.max(0, 1 - (frame - sAt) / 6) : 0;
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const L = 64;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r1 = i % 3 === 0 ? 118 : 126;
    ticks.push(<line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * 134} y2={Math.sin(a) * 134} stroke={RED} strokeWidth={i % 3 === 0 ? 4 : 2} />);
  }
  const splats = [
    [-300, -60, 10],
    [312, 40, 12],
    [-250, 110, 7],
    [270, -110, 8],
    [-60, 140, 6],
    [140, -138, 9],
    [330, 120, 5],
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: x + sh.x,
        top: y + sh.y,
        width: 0,
        height: 0,
        transform: `scale(${scale})`,
        opacity: 1 - k,
        pointerEvents: "none",
      }}
    >
      <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: retA, filter: `drop-shadow(0 0 8px ${RED})` }}>
        <rect x={-half} y={-half} width={half * 2} height={half * 2} fill={RED} opacity={0.07 + 0.05 * jit(frame, 3) + 0.25 * lockFlash} />
        <g transform={`rotate(${t * 3.2})`}>
          <circle r={168} fill="none" stroke={RED} strokeWidth={4} strokeDasharray="26 16" opacity={0.85} />
        </g>
        <g transform={`rotate(${-t * 1.6})`}>{ticks}</g>
        <path d="M-200 0 L-150 0 M150 0 L200 0 M0 -200 L0 -150 M0 150 L0 200" stroke={RED} strokeWidth={4} />
        <circle r={10} fill="none" stroke={RED} strokeWidth={3} />
        {corners.map(([sx, sy]) => (
          <path
            key={`${sx}${sy}`}
            d={`M${sx * half} ${sy * (half - L)} L${sx * half} ${sy * half} L${sx * (half - L)} ${sy * half}`}
            fill="none"
            stroke={locked ? "#FF6A6A" : RED}
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {!locked ? (
          <g>
            <rect x={-half} y={scanY - 46} width={half * 2} height={46} fill={RED} opacity={0.22} />
            <line x1={-half - 14} y1={scanY} x2={half + 14} y2={scanY} stroke="#FFD0D0" strokeWidth={5} />
          </g>
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: -half,
          top: -half - 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: retA,
          fontFamily: FONT.heavy,
          fontWeight: 900,
          fontSize: 30,
          letterSpacing: 2,
          color: RED,
          whiteSpace: "nowrap",
          textShadow: `0 0 10px ${RED}, 2px 2px 0 rgba(0,0,0,0.6)`,
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 8, background: RED, opacity: blink(frame, at, 6, 5) ? 1 : 0.2 }} />
        {locked ? "OBJETIVO BLOQUEADO" : `ESCANEANDO… ${pct}%`}
      </div>
      {locked
        ? splats.map(([sx, sy, r], i) => {
            const sp2 = frame >= LAND ? pop(frame, LAND + (i % 3), { damping: 10, stiffness: 280 }) : 0;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: sx - r,
                  top: sy - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: "50%",
                  background: STAMP_RED,
                  transform: `scale(${sp2})`,
                  opacity: 0.85,
                }}
              />
            );
          })
        : null}
      {locked ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(-50%, -50%) scale(${stampS}) rotate(-11deg)`,
            opacity: Math.min(0.95, sp * 3),
            filter: "drop-shadow(0 0 2px rgba(255,255,255,0.6)) drop-shadow(3px 4px 0 rgba(0,0,0,0.35))",
          }}
        >
          <StampArt />
        </div>
      ) : null}
    </div>
  );
};

// =============================================================================================
// CrashGlitch

/**
 * Full-frame glitch flash for `dur` frames (10) from `at`: a red tint over the picture, a
 * white-red flash on the first frames, horizontal bands of the picture inverted / hue-shifted
 * (backdrop filters) with magenta and cyan edges (RGB split), torn colour bars shifted sideways
 * and digital blocks snapped to a 24 px grid, with a second spike at ~60 %. Render it above the
 * shot (it filters what is underneath). Suggested: at FINAL.MULTA - 1.
 */
export const CrashGlitch: React.FC<{ frame: number; at: number; dur?: number }> = ({ frame, at, dur = 10 }) => {
  const d = frame - at;
  if (d < 0 || d >= dur) return null;
  const spike2 = Math.round(dur * 0.6);
  const env = Math.max(d < 2 ? 1 : 1 - ((d - 2) / Math.max(1, dur - 2)) * 0.7, d === spike2 || d === spike2 + 1 ? 0.95 : 0);
  const flash = d < 2 ? 1 - d * 0.45 : d === spike2 ? 0.4 : 0;
  const bands: React.ReactNode[] = [];
  const nb = 7 + Math.round(5 * env);
  for (let i = 0; i < nb; i++) {
    const sd = frame * 7.13 + i * 3.37;
    const by = rand(sd) * 1920;
    const bh = 10 + rand(sd + 1.1) * 150 * env;
    const kind = rand(sd + 2.3);
    const filter = kind < 0.4 ? "invert(1) hue-rotate(180deg) saturate(2)" : kind < 0.75 ? "hue-rotate(110deg) saturate(4) brightness(1.4)" : "brightness(2.2) contrast(2)";
    const dx = (rand(sd + 3.9) - 0.5) * 120 * env;
    bands.push(
      <div key={`b${i}`} style={{ position: "absolute", left: 0, top: by, width: 1080, height: bh, backdropFilter: filter, WebkitBackdropFilter: filter }} />,
      <div key={`m${i}`} style={{ position: "absolute", left: dx, top: by - 4, width: 1080, height: 4, background: "#FF0050", opacity: 0.85, mixBlendMode: "screen" }} />,
      <div key={`c${i}`} style={{ position: "absolute", left: -dx, top: by + bh, width: 1080, height: 4, background: "#00F0FF", opacity: 0.85, mixBlendMode: "screen" }} />,
    );
    if (kind > 0.55) {
      bands.push(
        <div
          key={`t${i}`}
          style={{
            position: "absolute",
            left: dx * 2,
            top: by + bh * 0.25,
            width: 1080,
            height: bh * 0.5,
            background: rand(sd + 5.5) < 0.5 ? "rgba(255,0,80,0.35)" : "rgba(0,240,255,0.3)",
            mixBlendMode: "screen",
          }}
        />,
      );
    }
  }
  const blocks: React.ReactNode[] = [];
  const colors = ["#000000", "#FF1F3D", "#00F0FF", "#FFFFFF", TC.charcoal, "#FF1F3D"];
  const nk = 10 + Math.round(16 * env);
  for (let i = 0; i < nk; i++) {
    const sd = frame * 11.7 + i * 5.91;
    const bx = Math.floor(rand(sd) * 45) * 24;
    const byy = Math.floor(rand(sd + 1.7) * 80) * 24;
    const bw = (1 + Math.floor(rand(sd + 2.9) * 8)) * 24;
    const bh = (1 + Math.floor(rand(sd + 4.1) * 3)) * 24;
    const col = colors[Math.floor(rand(sd + 6.3) * colors.length)];
    const noisy = rand(sd + 7.7) < 0.35;
    blocks.push(
      <div
        key={`k${i}`}
        style={{
          position: "absolute",
          left: bx,
          top: byy,
          width: bw,
          height: bh,
          background: noisy ? `repeating-linear-gradient(90deg, ${col} 0 6px, rgba(0,0,0,0) 6px 12px), repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 6px, rgba(0,0,0,0) 6px 12px)` : col,
          opacity: 0.55 + 0.4 * rand(sd + 8.8),
        }}
      />,
    );
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backdropFilter: `contrast(${1 + 0.5 * env}) saturate(${1 + 0.8 * env})`, WebkitBackdropFilter: `contrast(${1 + 0.5 * env}) saturate(${1 + 0.8 * env})` }} />
      <AbsoluteFill style={{ background: `rgba(255,30,50,${0.55 * env})`, mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ background: `rgba(255,40,60,${0.22 * env})`, mixBlendMode: "screen" }} />
      {bands}
      {blocks}
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)", opacity: env }} />
      {flash > 0 ? <AbsoluteFill style={{ background: `rgba(255,${200 - 120 * (1 - flash)},${200 - 140 * (1 - flash)},${0.7 * flash})` }} /> : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// CountdownPulse

/**
 * Red pulsing vignette at the frame edges from `from` to `to`, one heartbeat per second (a
 * strong beat right after each tick of the counter, a soft echo), stronger towards the end.
 * Full frame, nothing in the centre. Suggested: from FINAL.MULTA, to FINAL.BLACK (the last
 * seconds of Nubi's life: the beats land on the counter's ticks).
 */
export const CountdownPulse: React.FC<{ frame: number; from: number; to: number }> = ({ frame, from, to }) => {
  if (frame < from || frame > to + 8) return null;
  const d = frame - from;
  const n = Math.floor(d / 30);
  const local = d - n * 30;
  const total = Math.max(1, Math.ceil((to - from) / 30));
  const grow = clamp01(n / Math.max(1, total - 1));
  const beat = local < 2 ? 0.5 + local / 4 : Math.exp(-(local - 2) / 6);
  const echo = local >= 7 ? 0.5 * Math.exp(-(local - 7) / 5) * Math.min(1, (local - 7) / 2) : 0;
  const pulse = Math.max(beat, echo);
  const fade = ramp(frame, from, from + 4) * (1 - ramp(frame, to, to + 8));
  const a = (0.3 + 0.7 * pulse) * (0.6 + 0.4 * grow) * fade;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 72% 60% at 50% 46%, rgba(255,0,20,0) 52%, rgba(230,0,24,${0.5 * a}) 82%, rgba(130,0,10,${0.92 * a}) 100%)`,
        }}
      />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${90 + 110 * pulse}px ${18 + 34 * pulse}px rgba(255,30,40,${0.8 * a})` }} />
    </AbsoluteFill>
  );
};

// =============================================================================================
// CommentCard

/** Choice bubble with an icon on top of its label and a tail pointing down-outwards. */
const ChoiceBubble: React.FC<{ label: string; bg: string; tail: "left" | "right"; children: React.ReactNode }> = ({ label, bg, tail, children }) => {
  const tailSvg = (pass: "outline" | "fill") => (
    <svg
      width={56}
      height={64}
      viewBox="0 0 70 80"
      style={{ position: "absolute", [tail === "left" ? "left" : "right"]: 38, bottom: -42, overflow: "visible", transform: tail === "right" ? "scaleX(-1)" : undefined }}
    >
      <path d="M6 4 C14 30 12 52 2 74 C26 58 46 34 60 4 Z" fill="#FFFFFF" stroke={pass === "outline" ? INK : "none"} strokeWidth={pass === "outline" ? 13 : 0} strokeLinejoin="round" />
    </svg>
  );
  return (
    <div style={{ position: "relative", width: 330, height: 178 }}>
      {tailSvg("outline")}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 56,
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
        <div style={{ paddingTop: 10, marginTop: -2 }}>
          <HeavyText text={label} size={44} colors={TXT_WHITE} />
        </div>
      </div>
      {tailSvg("fill")}
    </div>
  );
};

/**
 * Closing call to comment for the TOP part of the frame (y 240-700; the 3D Nubi stays visible
 * below): a soft charcoal scrim fading down to y ~ 820, "¿FELIZ o MÁS TIEMPO?" in one line of
 * big heavy letters (FELIZ sunny yellow-green, MÁS TIEMPO violet) with a running hourglass;
 * two choice bubbles pop in and bob: "FELIZ" (yellow-green, a smiling sun) and "MÁS TIEMPO"
 * (blue-violet, an hourglass that flips over); then a comment button is tapped by a hand
 * (ripples, every 24 frames) while the count on its left rises to `countTo` with "COMENTA"
 * under it. With `out` it fades out over 10 frames. Layout (fixed): title y 255-345, bubbles
 * y 385-600, button and count y 585-700 (the hand pokes a bit lower). `scrim={false}` drops the
 * dark gradient. Suggested: at FINAL.CARD, out FINAL.BLACK.
 */
export const CommentCard: React.FC<{ frame: number; at: number; out?: number; countTo?: number; scrim?: boolean }> = ({
  frame,
  at,
  out,
  countTo = 12480,
  scrim = true,
}) => {
  if (frame < at) return null;
  if (out !== undefined && frame > out + 10) return null;
  const t = frame - at;
  const k = leave(frame, out, 10);
  const bgK = ramp(frame, at, at + 8);
  const taps = [at + 48, at + 72, at + 96, at + 120, at + 144, at + 168, at + 192, at + 216];
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
  const btnIn = pop(frame, at + 30, { damping: 10, stiffness: 190 });
  const handIn = pop(frame, at + 38, { damping: 13, stiffness: 150 });
  const countIn = pop(frame, at + 34, { damping: 11, stiffness: 200 });
  const count = Math.round(countTo * ramp(frame, at + 34, at + 100, [0, 1], EASE_OUT));
  const countBump = lastTap >= 0 ? bump(frame, lastTap, 8) : 0;
  const hgIn = pop(frame, at + 12, { damping: 9, stiffness: 200 });
  const R = 56;
  const BTN = { x: 640, y: 640 };
  const parts: { text: string; colors: string[]; size: number }[] = [
    { text: "¿FELIZ", colors: TXT_SUN, size: 80 },
    { text: "o", colors: TXT_WHITE, size: 54 },
    { text: "MÁS TIEMPO?", colors: TXT_VIOLET, size: 80 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - k }}>
      {scrim ? (
        <AbsoluteFill
          style={{
            opacity: bgK,
            background: "linear-gradient(180deg, rgba(16,12,30,0.8) 0%, rgba(16,12,30,0.64) 28%, rgba(16,12,30,0.32) 38%, rgba(16,12,30,0) 45%)",
          }}
        />
      ) : null}
      <div style={{ position: "absolute", left: 470, top: 300, display: "flex", alignItems: "center", gap: 16, transform: "translate(-50%, -50%)" }}>
        {parts.map((pt, i) => {
          const p = pop(frame, at + 2 + i * 4, { damping: 10, stiffness: 180 });
          return (
            <div
              key={pt.text}
              style={{
                paddingTop: pt.size * 0.1,
                transform: `scale(${p}) rotate(${(i % 2 ? 3 : -2) * (0.6 + 0.4 * (1 - p)) + Math.sin(t * 0.08 + i) * 0.8}deg)`,
                opacity: Math.min(1, p * 3),
              }}
            >
              <HeavyText text={pt.text} size={pt.size} colors={pt.colors} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 892,
          top: 292 + Math.sin(t * 0.1) * 7,
          transform: `translate(-50%, -50%) scale(${hgIn}) rotate(${14 + (1 - hgIn) * 40 + Math.sin(t * 0.07) * 5}deg)`,
        }}
      >
        <FlippingHourglass frame={frame} size={86} period={64} offset={-at} />
      </div>
      {[
        { text: "FELIZ", bg: "linear-gradient(160deg, #FFE45C 0%, #9BE04A 55%, #22A85A 100%)", x: 285, at: at + 16, tail: "left" as const, icon: "sun" },
        { text: "MÁS TIEMPO", bg: "linear-gradient(160deg, #7FB8FF 0%, #6A5BFF 55%, #7B2FD8 100%)", x: 715, at: at + 22, tail: "right" as const, icon: "hourglass" },
      ].map((b, i) => {
        const p = pop(frame, b.at, { damping: 9, stiffness: 200 });
        if (p < 0.001) return null;
        const bob = Math.sin((frame - b.at) * 0.1 + i * 2) * 7;
        return (
          <div
            key={b.text}
            style={{
              position: "absolute",
              left: b.x,
              top: 478 + bob,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(i ? 4 : -4) * (0.7 + 0.3 * (1 - p)) + Math.sin(t * 0.07 + i) * 1.6}deg)`,
            }}
          >
            <ChoiceBubble label={b.text} bg={b.bg} tail={b.tail}>
              {b.icon === "sun" ? (
                <SunFace size={96} style={{ transform: `rotate(${Math.sin(t * 0.09) * 10}deg) scale(${1 + 0.05 * Math.sin(t * 0.2)})`, marginTop: -4 }} />
              ) : (
                <div style={{ height: 92, display: "flex", alignItems: "center" }}>
                  <FlippingHourglass frame={frame} size={86} period={56} offset={-b.at + 20} />
                </div>
              )}
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
            background: "linear-gradient(145deg, #FFE45C 0%, #FFB21F 50%, #FF6A00 100%)",
            border: "9px solid #FFFFFF",
            boxSizing: "border-box",
            boxShadow: `0 0 0 5px ${INK}, 0 11px 0 5px rgba(0,0,0,0.3), 0 0 44px rgba(255,200,80,0.45)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${btnIn * (1 - 0.12 * squish)}) rotate(${(1 - btnIn) * -30}deg)`,
          }}
        >
          <CommentBubbleIcon size={74} dot="#FF6A00" frame={frame} style={{ marginTop: 4 }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 44,
            top: 16,
            transformOrigin: "0 0",
            transform: `translate(${(1 - handIn) * 360 - handPush * 18}px, ${(1 - handIn) * 160 - handPush * 8}px) rotate(-66deg) scale(${1 - 0.06 * handPush})`,
            opacity: Math.min(1, handIn * 2),
          }}
        >
          <HandPointer size={112} style={{ marginLeft: -46, marginTop: -4 }} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 380,
          top: 636,
          transform: `translate(-50%, -50%) scale(${countIn * (1 + 0.16 * countBump)})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <HeavyText text={fmtNumber(count)} size={62} colors={TXT_AMBER} />
        <div
          style={{
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 32,
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

// =============================================================================================
// EndCard

/**
 * Full-frame black end card from `at` to the end of the video (~3.7 s): out of the black, a
 * faint warm light from a door left ajar (a thin vertical gap that creeps open, a soft halo,
 * light spilling on the floor, dust motes drifting in the beam, a slight flicker); then, slowly,
 * "¿NUBI DEBE ENTRAR / A TIMECO?" sharpens out of a blur (TIMECO in red), a big golden
 * "PARTE 2" settles in front of the light, and the small call "Comenta: ¿FELIZ o MÁS TIEMPO?"
 * with an hourglass rises at the bottom. Texts stay inside x 60-940, y 250-1150. Suggested:
 * at FINAL.BLACK (TIMECO whispers "Pase, Nubi…" over it).
 */
export const EndCard: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const uid = useUid();
  if (frame < at) return null;
  const t = frame - at;
  const black = ramp(frame, at, at + 2);
  const lightIn = ramp(frame, at + 5, at + 50, [0, 1], EASE_IN_OUT);
  const open = ramp(frame, at + 5, at + 115, [0, 1], EASE_IN_OUT);
  const flick = 0.9 + 0.06 * Math.sin(t * 0.37) + 0.04 * rand(Math.floor(t / 3) * 2.3);
  const Lk = lightIn * flick;
  const DX = 500;
  const DT = 560;
  const DB = 1150;
  const gapW = 5 + 24 * open;
  const q1 = ramp(frame, at + 16, at + 44, [0, 1], EASE_OUT);
  const q2 = ramp(frame, at + 24, at + 52, [0, 1], EASE_OUT);
  const p2 = ramp(frame, at + 46, at + 80, [0, 1], EASE_OUT);
  const c3 = ramp(frame, at + 72, at + 94, [0, 1], EASE_OUT);
  const motes: React.ReactNode[] = [];
  for (let i = 0; i < 18; i++) {
    const mx = DX + (rand(i * 3.3) - 0.5) * (60 + 140 * open) + Math.sin(t * 0.03 + i) * 10;
    const my = DB - ((rand(i * 7.1) * (DB - DT) + t * (0.6 + rand(i * 2.9))) % (DB - DT + 200));
    const tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * 0.12 + i * 1.7));
    motes.push(<circle key={i} cx={mx} cy={my} r={1.5 + rand(i * 5.5) * 2.5} fill="#FFE2A8" opacity={tw * 0.8} />);
  }
  const qStyle = (k: number): React.CSSProperties => ({
    fontFamily: FONT.heavy,
    fontWeight: 900,
    fontSize: 64,
    lineHeight: 1,
    color: "#FFFFFF",
    whiteSpace: "nowrap",
    letterSpacing: 4 + 16 * (1 - k),
    opacity: k,
    filter: `blur(${12 * (1 - k)}px)`,
    textShadow: "0 0 24px rgba(255,190,120,0.35), 0 4px 0 rgba(0,0,0,0.6)",
    transform: `translateY(${(1 - k) * 14}px)`,
    textAlign: "center",
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000", opacity: black }} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: Lk }}>
        <defs>
          <radialGradient id={`eh${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="rgba(255,176,80,0.34)" />
            <stop offset="0.45" stopColor="rgba(255,120,30,0.1)" />
            <stop offset="1" stopColor="rgba(255,120,30,0)" />
          </radialGradient>
          <linearGradient id={`ef${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,206,128,0.6)" />
            <stop offset="1" stopColor="rgba(255,140,40,0)" />
          </linearGradient>
          <linearGradient id={`eg${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FF9A2E" />
            <stop offset="0.5" stopColor="#FFF6E0" />
            <stop offset="1" stopColor="#FFB347" />
          </linearGradient>
          <filter id={`eb${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id={`ebs${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <ellipse cx={DX} cy={(DT + DB) / 2} rx={360 + 80 * open} ry={520} fill={`url(#eh${uid})`} />
        <path d={`M${DX - gapW / 2} ${DB} L${DX + gapW / 2} ${DB} L${DX + 90 + gapW * 7} 1720 L${DX - 170 - gapW * 4} 1720 Z`} fill={`url(#ef${uid})`} filter={`url(#ebs${uid})`} />
        <rect x={DX - gapW / 2 - 18} y={DT - 10} width={gapW + 36} height={DB - DT + 20} fill="rgba(255,170,70,0.55)" filter={`url(#eb${uid})`} />
        <rect x={DX - gapW / 2} y={DT} width={gapW} height={DB - DT} fill={`url(#eg${uid})`} />
        <path d={`M${DX - gapW / 2 - 3} ${DT} L${DX - gapW / 2 - 3} ${DB}`} stroke="rgba(255,190,110,0.5)" strokeWidth={2} />
        <path d={`M${DX - 180} ${DB} L${DX + 220} ${DB}`} stroke="rgba(255,170,80,0.18)" strokeWidth={3} />
        {motes}
      </svg>
      <div style={{ position: "absolute", left: 60, width: 880, top: 268, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={qStyle(q1)}>¿NUBI DEBE ENTRAR</div>
        <div style={qStyle(q2)}>
          A <span style={{ color: TC.red, textShadow: "0 0 26px rgba(255,59,59,0.8), 0 4px 0 rgba(0,0,0,0.6)" }}>TIMECO</span>?
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 500,
          top: 760,
          transform: `translate(-50%, -50%) scale(${1.3 - 0.3 * p2})`,
          opacity: p2,
          filter: `blur(${16 * (1 - p2)}px) drop-shadow(0 0 ${30 + 10 * Math.sin(t * 0.15)}px rgba(255,170,60,${0.55 * p2}))`,
        }}
      >
        <HeavyText text="PARTE 2" size={190} colors={["#FFF6D8", "#FFD36B", "#FF9A1F"]} stroke="#1A0C04" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 500,
          top: 1086,
          transform: `translate(-50%, -50%) translateY(${(1 - c3) * 24}px)`,
          opacity: c3,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 30px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          border: "3px solid rgba(255,255,255,0.22)",
          fontFamily: FONT.heavy,
          fontWeight: 800,
          fontSize: 38,
          lineHeight: 1,
          color: "rgba(255,255,255,0.92)",
          whiteSpace: "nowrap",
        }}
      >
        <span>
          Comenta: ¿<span style={{ color: "#FFE14D", fontWeight: 900 }}>FELIZ</span> o <span style={{ color: "#B9AEFF", fontWeight: 900 }}>MÁS TIEMPO</span>?
        </span>
        <HourglassIcon size={46} phase={clamp01((t - 72) / 40)} />
      </div>
    </AbsoluteFill>
  );
};
