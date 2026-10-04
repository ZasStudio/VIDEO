import React from "react";
import { AbsoluteFill } from "remotion";
import { EASE_IN, EASE_OUT, clamp01, pop, ramp, rand } from "../../anim";
import { FONT } from "../../theme";
import { CommentBubbleIcon, HandPointer } from "../inca/icons";

// 2D overlays for "La noche que nadie quiso pasar en la Casa Matusita" (1080 x 1920, 30 fps).
// Darker than the previous shorts: bone-white text, sickly greens and blood-red accents on dark
// scrims; things flicker in like a dying bulb and jitter with a light chromatic split instead of
// bouncing (only the end card keeps a few springy pops: it is still Nubi's channel). Everything is
// driven by the global `frame` plus explicit cue frames: no timers, no Math.random (`rand`), no
// CSS animations. Icons are inline SVG (no emoji font in the headless renderer); the camcorder
// OSD uses a drawn 5 x 7 pixel font. TikTok safe zone: keep content inside x 60-940, y 230-1180
// (top bar above y 200, the button column right of x 940 from y 700, captions at y 1210-1400).
// Each component's doc comment gives its footprint and a suggested placement (beats.ts names).

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

/** The short's palette. */
export const MATUSITA_COLORS = {
  bone: "#EDE6D3",
  boneDim: "#BDB49C",
  ink: "#0A0706",
  blood: "#E01A31",
  bloodDark: "#6E0512",
  sick: "#A9D46B",
  sickPale: "#CBE7A2",
  osd: "#F4F1E6",
} as const;
const M = MATUSITA_COLORS;

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

// A bulb catching (ignite), a quick one (snap) and a bulb dying (die).
const IGNITE = [0.85, 0, 0, 0.5, 1, 0.15, 0, 0.9, 1, 0.55, 1];
const SNAP = [0.7, 0, 1, 0.45, 1];
const DIE = [1, 0.35, 0.9, 0, 0.6, 0, 0, 0.3, 0];
const ignite = (frame: number, at: number) => pattern(frame, at, IGNITE, 1);
const snap = (frame: number, at: number) => pattern(frame, at, SNAP, 1);
const die = (frame: number, out: number) => (frame < out ? 1 : pattern(frame, out, DIE, 0));

/** Rare idle flicker: ~1, now and then a dip for two frames. */
const idleFlicker = (frame: number, seed: number, rate = 0.035) => {
  const n = rand(Math.floor(frame / 2) * 1.618 + seed * 9.7);
  if (n < rate) return 0.35 + (n / rate) * 0.25;
  return 0.97 + 0.03 * rand(frame * 0.77 + seed);
};

/** Chromatic split of a whole block (CSS filter): red to the left, cyan to the right. */
const chroma = (split: number, a = 0.6) =>
  `drop-shadow(${(-split).toFixed(1)}px 0 0 rgba(255,30,80,${a})) drop-shadow(${split.toFixed(1)}px 0 0 rgba(40,230,225,${a * 0.85}))`;

// =============================================================================================
// Icons

/**
 * Creepy almond eye (120 x 70 box at size 120): bone sclera shaded at the corners, thin red
 * veins, a sickly green iris with a black pupil and a glint, dark lids with a shadow under the
 * top one. `open` 0..1 (0 = shut, with lashes), `look` -1..1 moves the iris sideways, `iris`
 * recolours it, `glow` adds a halo (CSS colour).
 */
export const EyeIcon: React.FC<{ size?: number; open?: number; look?: number; iris?: string; glow?: string; style?: React.CSSProperties }> = ({
  size = 120,
  open = 1,
  look = 0,
  iris = M.sick,
  glow,
  style,
}) => {
  const uid = useUid();
  const o = clamp01(open);
  const top = 35 - 52 * o;
  const bot = 35 + 42 * o;
  const lid = `M5 35 Q60 ${top} 115 35 Q60 ${bot} 5 35 Z`;
  const ix = 60 + Math.max(-1, Math.min(1, look)) * 17;
  return (
    <svg
      width={size}
      height={(size * 70) / 120}
      viewBox="0 0 120 70"
      style={{ display: "block", overflow: "visible", filter: glow ? `drop-shadow(0 0 ${(size * 0.09).toFixed(1)}px ${glow})` : undefined, ...style }}
    >
      <defs>
        <clipPath id={`ec${uid}`}>
          <path d={lid} />
        </clipPath>
        <radialGradient id={`es${uid}`} cx="0.5" cy="0.5" r="0.62">
          <stop offset="0" stopColor="#FBF7EC" />
          <stop offset="0.55" stopColor="#E6DDC6" />
          <stop offset="1" stopColor="#8E7F62" />
        </radialGradient>
        <radialGradient id={`ei${uid}`} cx="0.42" cy="0.38" r="0.65">
          <stop offset="0" stopColor="#F3FFC4" />
          <stop offset="0.45" stopColor={iris} />
          <stop offset="1" stopColor="#1C2C0E" />
        </radialGradient>
      </defs>
      {o > 0.05 ? (
        <g clipPath={`url(#ec${uid})`}>
          <rect x={0} y={-20} width={120} height={110} fill={`url(#es${uid})`} />
          <path
            d="M7 35 C18 32 24 38 33 33 M9 39 C17 43 23 41 29 46 M113 35 C102 32 97 38 88 34 M111 39 C103 43 97 41 92 46"
            stroke="#C0283A"
            strokeWidth={1.5}
            fill="none"
            opacity={0.8}
          />
          <circle cx={ix} cy={36} r={19} fill={`url(#ei${uid})`} stroke="#18230C" strokeWidth={2.2} />
          <circle cx={ix} cy={36} r={8.5} fill="#040404" />
          <circle cx={ix + 6} cy={29} r={3.8} fill="#FFFFFF" opacity={0.92} />
          <path d={`M5 35 Q60 ${top} 115 35`} stroke="rgba(0,0,0,0.38)" strokeWidth={10} fill="none" />
        </g>
      ) : null}
      <path d={lid} fill="none" stroke={M.ink} strokeWidth={5} strokeLinejoin="round" />
      {o <= 0.05 ? (
        <path d="M30 37 L26 46 M45 39 L43 49 M60 40 L60 50 M75 39 L77 49 M90 37 L94 46" stroke={M.ink} strokeWidth={4} strokeLinecap="round" />
      ) : null}
    </svg>
  );
};

/** Warning triangle with a little eye inside (52 x 46 at size 52), bone outline. */
const WarnEye: React.FC<{ size?: number; open: number; look: number }> = ({ size = 52, open, look }) => {
  const o = clamp01(open);
  const lid = `M14 31 Q26 ${31 - 18 * o} 38 31 Q26 ${31 + 15 * o} 14 31 Z`;
  return (
    <svg width={size} height={(size * 46) / 52} viewBox="0 0 52 46" style={{ display: "block", overflow: "visible" }}>
      <path d="M26 4 L49 43 L3 43 Z" fill="rgba(237,230,211,0.08)" stroke={M.bone} strokeWidth={4} strokeLinejoin="round" />
      {o > 0.05 ? (
        <>
          <path d={lid} fill={M.bone} />
          <circle cx={26 + look * 3.5} cy={31} r={3.6 * Math.min(1, o * 1.4)} fill={M.blood} />
        </>
      ) : null}
      <path d={lid} fill="none" stroke={M.bone} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
};

/** Little sheet ghost (100 x 100 box), bone with a dark outline, swaying with `frame`. */
const GhostIcon: React.FC<{ size?: number; frame: number }> = ({ size = 100, frame }) => {
  const sway = Math.sin(frame * 0.14) * 7;
  const w = Math.sin(frame * 0.3) * 3;
  const body = `M20 50 C20 24 34 10 50 10 C66 10 80 24 80 50 L80 86 Q75 ${80 + w} 70 86 Q65 ${92 - w} 60 86 Q55 ${80 + w} 50 86 Q45 ${92 - w} 40 86 Q35 ${80 + w} 30 86 Q25 ${92 - w} 20 86 Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", transform: `rotate(${sway}deg) translateY(${Math.sin(frame * 0.11) * 3}px)` }}>
      <path d={body} fill={M.bone} stroke="#000" strokeWidth={6} strokeLinejoin="round" />
      <path d="M30 30 C33 22 40 18 46 17" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.8} />
      <ellipse cx={40} cy={46} rx={5.5} ry={8.5} fill="#0A0A0A" />
      <ellipse cx={60} cy={46} rx={5.5} ry={8.5} fill="#0A0A0A" />
      <ellipse cx={50} cy={65} rx={5} ry={6.5} fill="#0A0A0A" />
    </svg>
  );
};

/** Pale pink brain (100 x 100 box) with dark folds, pulsing gently with `frame`. */
const BrainIcon: React.FC<{ size?: number; frame: number }> = ({ size = 100, frame }) => {
  const s = 1 + 0.04 * Math.sin(frame * 0.25);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", transform: `scale(${s})` }}>
      <path
        d="M50 20 C42 11 26 13 22 25 C11 27 7 39 12 47 C6 56 11 69 22 71 C25 83 38 88 47 81 L50 79 L53 81 C62 88 75 83 78 71 C89 69 94 56 88 47 C93 39 89 27 78 25 C74 13 58 11 50 20 Z"
        fill="#E9AFBB"
        stroke="#000"
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path
        d="M50 21 L50 78 M31 31 C38 35 36 43 29 45 M24 57 C33 55 37 61 35 68 M69 31 C62 35 64 43 71 45 M76 57 C67 55 63 61 65 68 M40 22 C43 30 38 35 44 41 M60 22 C57 30 62 35 56 41"
        stroke="#7A3446"
        strokeWidth={3.6}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M28 24 C33 19 39 18 44 20" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.7} />
    </svg>
  );
};

// =============================================================================================
// HorrorTitle

// "CASA MATUSITA" (Montserrat Black 90 px, 2 px tracking) is ~833 px wide; drips hang from the
// bottoms of C, S, M, T and I (x in px from the left of the line, length, start delay).
const DRIPS = [
  { x: 33, len: 16, w: 5, d: 0 },
  { x: 172, len: 30, w: 7, d: 10 },
  { x: 320, len: 12, w: 5, d: 22 },
  { x: 500, len: 34, w: 7, d: 4 },
  { x: 680, len: 22, w: 6, d: 16 },
];

/**
 * The video's title in the top band (x 60-940, y 240-470): "LA NOCHE QUE NADIE / QUISO PASAR EN
 * LA" in bone-white Montserrat Black with wide tracking and a big blood-red "CASA MATUSITA"
 * under it with a few drips slowly running down; a small creepy eye on top opens, scans left
 * and right and blinks. Each line catches like a failing bulb at `at` (staggered, ~11 frames)
 * with a light chromatic split that keeps jittering; now and then a line dips for two frames.
 * At `out` the lines flicker off one by one and the eye shuts (gone ~12 frames later). A soft
 * dark scrim behind keeps it readable on any shot. Footprint fixed: eye y 236-280, lines
 * y 285-462 (drips to ~490), x 85-915. Suggested: at GANCHO.LIGHT + 4, out GANCHO.SIETE - 10
 * (it leaves before the GoalStamp), or keep it longer over the dark opening.
 */
export const HorrorTitle: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 12) return null;
  const t = frame - at;
  const scrim = ramp(frame, at, at + 10) * (1 - ramp(frame, out + 2, out + 12));
  const lines = [
    { text: "LA NOCHE QUE NADIE", y: 304, size: 52, delay: 0, red: false },
    { text: "QUISO PASAR EN LA", y: 361, size: 52, delay: 3, red: false },
    { text: "CASA MATUSITA", y: 428, size: 90, delay: 7, red: true },
  ];
  const eyeOpen = ramp(frame, at + 14, at + 22) * (1 - bump(frame, at + 66, 6)) * (1 - ramp(frame, out, out + 5));
  const look = Math.sin(Math.max(0, t - 24) * 0.05) * 0.85;
  const eyeVis = ignite(frame, at + 12) * die(frame, out + 3);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 170,
          width: 1080,
          height: 380,
          background: "radial-gradient(closest-side, rgba(4,3,3,0.66), rgba(4,3,3,0.42) 62%, rgba(4,3,3,0))",
          opacity: scrim,
        }}
      />
      {lines.map((l, i) => {
        const la = at + l.delay;
        const vis = ignite(frame, la) * idleFlicker(frame, i * 3 + 1) * die(frame, out + i * 2);
        if (vis <= 0.001) return null;
        const fresh = 1 - ramp(frame, la, la + 12);
        const dying = frame >= out ? 1 : 0;
        const split = 1.3 + 1.4 * Math.abs(jit(frame, 7 + i, 2)) + 6 * fresh + 6 * dying + (vis < 0.9 ? 3 : 0);
        const big = rand(Math.floor(frame / 2) * 0.37 + i * 5.1) < 0.08;
        const jx = jit(frame, 21 + i, 2) * (big ? 5 : 0.8) + dying * jit(frame, 31 + i, 1) * 10;
        const sy = 1 + 0.1 * fresh - 0.5 * ramp(frame, out + i * 2, out + i * 2 + 8);
        const text: React.CSSProperties = {
          fontFamily: FONT.heavy,
          fontWeight: 900,
          fontSize: l.size,
          lineHeight: 1,
          whiteSpace: "nowrap",
          letterSpacing: l.red ? 2 : 5,
          color: l.red ? M.blood : M.bone,
          WebkitTextStroke: `${l.red ? 8 : 6}px ${l.red ? "#1A0204" : M.ink}`,
          paintOrder: "stroke fill",
        };
        const dripK = (d: { d: number }) => ramp(frame, la + 12 + d.d, la + 100 + d.d, [0, 1], EASE_OUT);
        return (
          <div
            key={l.text}
            style={{
              position: "absolute",
              left: 500,
              top: l.y,
              transform: `translate(-50%, -50%) translateX(${jx.toFixed(1)}px) scale(${1 + 0.004 * Math.sin(t * 0.06 + i)}, ${sy})`,
              opacity: vis,
              filter: l.red
                ? `${chroma(split, 0.55)} drop-shadow(0 0 ${14 + 10 * fresh}px rgba(255,20,45,${0.5 + 0.4 * fresh}))`
                : `${chroma(split, 0.5)} drop-shadow(0 3px 6px rgba(0,0,0,0.8))`,
            }}
          >
            <div style={{ position: "relative" }}>
              <div style={text}>{l.text}</div>
              {l.red ? (
                <svg width={840} height={60} viewBox="0 0 840 60" style={{ position: "absolute", left: 0, top: l.size * 0.8, overflow: "visible" }}>
                  {DRIPS.map((d) => {
                    const k = dripK(d);
                    if (k <= 0.001) return null;
                    const L = d.len * k + Math.sin(t * 0.08 + d.x) * 1.2 * k;
                    const path = `M${d.x - d.w} 0 C${d.x - d.w} ${L * 0.5} ${d.x - d.w * 0.55} ${L * 0.7} ${d.x - d.w * 0.55} ${L} A${d.w * 0.55} ${d.w * 0.55} 0 0 0 ${d.x + d.w * 0.55} ${L} C${d.x + d.w * 0.55} ${L * 0.7} ${d.x + d.w} ${L * 0.5} ${d.x + d.w} 0 Z`;
                    return (
                      <g key={d.x}>
                        <path d={path} transform="translate(0 8)" fill="none" stroke="#1A0204" strokeWidth={4} />
                        <path d={path} fill={M.blood} />
                        <circle cx={d.x} cy={L + d.w * 0.5} r={d.w * 0.95} fill={M.blood} stroke="#1A0204" strokeWidth={3} />
                        <circle cx={d.x - d.w * 0.3} cy={L + d.w * 0.2} r={d.w * 0.3} fill="#FF8A8A" opacity={0.7} />
                      </g>
                    );
                  })}
                </svg>
              ) : null}
            </div>
          </div>
        );
      })}
      {eyeVis > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: 500,
            top: 258,
            transform: `translate(-50%, -50%) translateX(${jit(frame, 51, 3) * 0.8}px)`,
            opacity: eyeVis,
          }}
        >
          <EyeIcon size={78} open={eyeOpen} look={look} glow="rgba(169,212,107,0.55)" />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// GoalStamp

const STAMP_RED = "#E3172E";
const GOAL_TEXT = "META: 7 DÍAS";
// The rubber stamp's box (px) and the speckles of missing ink in it (x, y, radius).
const ST_W = 600;
const ST_H = 132;
const SPECKS = Array.from({ length: 90 }, (_, i) => ({
  x: rand(i * 3.17 + 0.4) * ST_W,
  y: rand(i * 5.71 + 1.3) * ST_H,
  r: 0.6 + Math.pow(rand(i * 7.33 + 2.2), 2) * 2.4,
}));
// Ink splats around the stamp (relative to its centre).
const SPLATS = [
  { x: -284, y: -46, r: 7 },
  { x: -312, y: 14, r: 4 },
  { x: 290, y: -60, r: 6 },
  { x: 318, y: 4, r: 9 },
  { x: 276, y: 58, r: 4 },
  { x: -236, y: 66, r: 5 },
  { x: 60, y: -78, r: 4 },
];

/**
 * The challenge vs. the legend: at `goalAt` "META: 7 DÍAS" types itself in on a strip of dark
 * tape (a character every 2 frames behind a blinking block cursor; "7 DÍAS" in pale sickly
 * green); at `realAt` a blood-red rubber stamp "DURÓ: / MENOS DE 2 HORAS" (speckled ink, rough
 * double border, rotated) slams down from 2.3x in 4 frames (shake, ink splats, a dust ring) and
 * a red marker line crosses the 7 DÍAS line out. At `out` it flickers off (~9 frames). `x`, `y`
 * = centre; ~640 x 230: tape x ± 260, y - 118 … y - 48; stamp x ± 300, y - 52 … y + 112 (the
 * splats reach x ± 330). Suggested: x 500, y 1060 (below Nubi's eyes, above the captions),
 * goalAt GANCHO.SIETE, realAt GANCHO.DOS, out GANCHO.END - 6.
 */
export const GoalStamp: React.FC<{ frame: number; goalAt: number; realAt: number; out: number; x: number; y: number }> = ({
  frame,
  goalAt,
  realAt,
  out,
  x,
  y,
}) => {
  const uid = useUid();
  if (frame < goalAt || frame > out + 10) return null;
  const chars = Array.from(GOAL_TEXT);
  const typed = Math.min(chars.length, Math.floor((frame - goalAt) / 2) + 1);
  const fresh = (frame - goalAt) % 2 === 0 ? typed - 1 : -1;
  const cursorOn = frame < realAt && (typed < chars.length || blink(frame, goalAt, 8, 7) === 1);
  const hit = realAt + 4;
  const sk = frame < realAt ? 0 : ramp(frame, realAt, hit, [0, 1], EASE_IN);
  const landed = frame >= hit;
  const sh = impact(frame, hit, 16, 12);
  const strike = ramp(frame, hit + 1, hit + 7, [0, 1], EASE_OUT);
  const strike2 = ramp(frame, hit + 5, hit + 10, [0, 1], EASE_OUT);
  const vis = die(frame, out);
  const tapeIn = ramp(frame, goalAt, goalAt + 6);
  const ring = landed ? clamp01((frame - hit) / 12) : 0;
  const TAPE_W = 520;
  const TAPE_TOP = -118;
  const TAPE_H = 70;
  const ST_TOP = -36;
  const cursor = (
    <span
      style={{
        position: "absolute",
        left: 0,
        top: "4%",
        width: 26,
        height: "88%",
        background: M.sickPale,
        boxShadow: "0 0 12px rgba(169,212,107,0.6)",
        opacity: 0.9,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: vis }}>
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(${sh.x.toFixed(1)}px, ${sh.y.toFixed(1)}px) rotate(${sh.r.toFixed(2)}deg)` }}>
        {/* The goal on a strip of dark tape. */}
        <div
          style={{
            position: "absolute",
            left: -TAPE_W / 2,
            top: TAPE_TOP,
            width: TAPE_W,
            height: TAPE_H,
            transform: `rotate(-1.2deg) scaleX(${tapeIn})`,
            transformOrigin: "0% 50%",
            background: "linear-gradient(180deg, rgba(22,20,16,0.88), rgba(8,7,6,0.88))",
            border: "2px solid rgba(237,230,211,0.18)",
            borderRadius: 6,
            boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -TAPE_W / 2,
            top: TAPE_TOP,
            width: TAPE_W,
            height: TAPE_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-1.2deg)",
            opacity: 1 - 0.3 * strike,
            filter: chroma(1 + Math.abs(jit(frame, 61, 2)) * 1.2, 0.45),
          }}
        >
          {chars.map((ch, i) => {
            const isNew = i === fresh;
            const green = i >= 6;
            return (
              <span
                key={i}
                style={{
                  position: "relative",
                  display: "inline-block",
                  fontFamily: FONT.heavy,
                  fontWeight: 800,
                  fontSize: 52,
                  lineHeight: 1,
                  letterSpacing: 4,
                  whiteSpace: "pre",
                  transform: `translateY(${((rand(i * 3.3) - 0.5) * 4).toFixed(1)}px) rotate(${((rand(i * 7.9) - 0.5) * 5).toFixed(1)}deg)`,
                }}
              >
                {cursorOn && i === typed ? cursor : null}
                <span
                  style={{
                    position: "relative",
                    color: isNew ? "#FFFFFF" : green ? M.sickPale : M.bone,
                    opacity: i < typed ? 1 : 0,
                    textShadow: isNew ? "0 0 14px rgba(255,255,255,0.9)" : green ? "0 0 16px rgba(169,212,107,0.45)" : "none",
                  }}
                >
                  {ch}
                </span>
              </span>
            );
          })}
          <span style={{ position: "relative", display: "inline-block", width: 26, height: 46, marginLeft: 2 }}>{cursorOn && typed >= chars.length ? cursor : null}</span>
        </div>
        {strike > 0 ? (
          <svg
            width={TAPE_W}
            height={TAPE_H}
            viewBox={`0 0 ${TAPE_W} ${TAPE_H}`}
            style={{ position: "absolute", left: -TAPE_W / 2, top: TAPE_TOP, overflow: "visible", transform: "rotate(-1.2deg)" }}
          >
            <path d={`M30 40 Q${TAPE_W / 2} 28 ${TAPE_W - 40} 33`} stroke="#1A0204" strokeWidth={15} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - strike} />
            <path d={`M30 40 Q${TAPE_W / 2} 28 ${TAPE_W - 40} 33`} stroke={STAMP_RED} strokeWidth={9} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - strike} />
            {strike2 > 0 ? (
              <path d={`M48 47 Q${TAPE_W / 2} 39 ${TAPE_W - 56} 44`} stroke={STAMP_RED} strokeWidth={4.5} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - strike2} opacity={0.9} />
            ) : null}
          </svg>
        ) : null}
        {/* The stamp. */}
        {sk > 0 ? (
          <div
            style={{
              position: "absolute",
              left: -ST_W / 2,
              top: ST_TOP,
              width: ST_W,
              height: ST_H,
              transform: `rotate(-3deg) scale(${1 + 1.3 * (1 - sk)})`,
              opacity: Math.min(1, sk * 1.6),
              filter: landed ? "drop-shadow(0 6px 16px rgba(0,0,0,0.6))" : "drop-shadow(0 30px 30px rgba(0,0,0,0.5))",
            }}
          >
            <svg width={ST_W} height={ST_H} viewBox={`0 0 ${ST_W} ${ST_H}`} style={{ display: "block", overflow: "visible" }}>
              <defs>
                <mask id={`gm${uid}`}>
                  <rect x={-10} y={-10} width={ST_W + 20} height={ST_H + 20} fill="#FFFFFF" />
                  {SPECKS.map((s, i) => (
                    <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#000000" />
                  ))}
                  <path d="M60 26 L140 22 M400 114 L530 108 M240 62 L290 58" stroke="#000" strokeWidth={1.6} opacity={0.8} />
                </mask>
                <filter id={`gr${uid}`} x="-5%" y="-10%" width="110%" height="120%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={7} />
                  <feDisplacementMap in="SourceGraphic" scale={4} />
                </filter>
              </defs>
              <rect x={6} y={6} width={ST_W - 12} height={ST_H - 12} rx={15} fill="rgba(16,6,7,0.64)" />
              <g mask={`url(#gm${uid})`} filter={`url(#gr${uid})`}>
                <rect x={6} y={6} width={ST_W - 12} height={ST_H - 12} rx={15} fill="none" stroke={STAMP_RED} strokeWidth={8} />
                <rect x={18} y={18} width={ST_W - 36} height={ST_H - 36} rx={9} fill="none" stroke={STAMP_RED} strokeWidth={3} />
                <path d={`M40 39 L${ST_W / 2 - 72} 39 M${ST_W / 2 + 72} 39 L${ST_W - 40} 39`} stroke={STAMP_RED} strokeWidth={4} />
                <text x={ST_W / 2 + 4} y={48} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={900} fontSize={27} letterSpacing={8} fill={STAMP_RED}>
                  DURÓ:
                </text>
                <text x={ST_W / 2} y={105} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={900} fontSize={52} textLength={540} lengthAdjust="spacingAndGlyphs" fill={STAMP_RED}>
                  MENOS DE 2 HORAS
                </text>
              </g>
            </svg>
          </div>
        ) : null}
        {landed && ring < 1 ? (
          <div
            style={{
              position: "absolute",
              left: -330,
              top: ST_TOP + ST_H / 2 - 100,
              width: 660,
              height: 200,
              borderRadius: "50%",
              border: `${(9 * (1 - ring)).toFixed(1)}px solid rgba(237,230,211,0.32)`,
              boxSizing: "border-box",
              transform: `rotate(-3deg) scale(${0.9 + 0.35 * ring})`,
              opacity: 1 - ring,
            }}
          />
        ) : null}
        {landed ? (
          <svg width={800} height={300} viewBox="-400 -150 800 300" style={{ position: "absolute", left: -400, top: ST_TOP + ST_H / 2 - 150, overflow: "visible" }}>
            {SPLATS.map((s, i) => {
              const p = clamp01((frame - hit + 1) / 3);
              return <circle key={i} cx={s.x * (0.8 + 0.2 * p)} cy={s.y * (0.8 + 0.2 * p)} r={s.r * p} fill={STAMP_RED} opacity={0.9 - 0.15 * ring} />;
            })}
          </svg>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// Disclaimer

/**
 * Sober disclaimer strip at the top: "Basado en una leyenda urbana. No comprobada." (Montserrat
 * 28 px, dim bone with "No comprobada." brighter) on a dark translucent plate with a thin bone
 * border, and a warning triangle with a little eye inside that opens and blinks once. Sharpens
 * in from a blur with tight tracking at `at` (~12 frames), barely flickers, fades out at `out`
 * (10 frames). Footprint fixed: x ~95-905, y 248-312 (centred on x 500, y 280). Suggested: at
 * LUGAR.L02 (over "La Casa Matusita existe de verdad"), out LUGAR.SEGUNDO; or at GANCHO.END - 2
 * if the title is gone by then.
 */
export const Disclaimer: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 10) return null;
  const k = ramp(frame, at, at + 10) * (1 - ramp(frame, out, out + 10, [0, 1], EASE_IN));
  const sharp = ramp(frame, at, at + 14);
  const eyeOpen = ramp(frame, at + 8, at + 13) * (1 - bump(frame, at + 40, 6)) * (1 - ramp(frame, out, out + 5));
  const fl = 0.9 + 0.1 * idleFlicker(frame, 41, 0.025);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 500,
          top: 280,
          transform: `translate(-50%, -50%) translateY(${((1 - sharp) * 8).toFixed(1)}px)`,
          opacity: k * fl,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "11px 26px 11px 18px",
          borderRadius: 14,
          background: "rgba(8,7,6,0.7)",
          border: "2px solid rgba(237,230,211,0.24)",
          boxShadow: "0 6px 26px rgba(0,0,0,0.5)",
          whiteSpace: "nowrap",
          filter: `blur(${(3 * (1 - sharp)).toFixed(2)}px)`,
        }}
      >
        <WarnEye size={44} open={eyeOpen} look={Math.sin((frame - at) * 0.07)} />
        <div
          style={{
            fontFamily: FONT.heavy,
            fontWeight: 700,
            fontSize: 28,
            lineHeight: 1.15,
            color: "#CFC7B2",
            letterSpacing: 0.3 + 3 * (1 - sharp),
          }}
        >
          Basado en una leyenda urbana. <span style={{ fontWeight: 800, color: M.bone }}>No comprobada.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// VHSOverlay

// 5 x 7 pixel font for the camcorder OSD (rows top to bottom).
const GLYPH_ROWS: Record<string, string> = {
  "0": "01110 10001 10011 10101 11001 10001 01110",
  "1": "00100 01100 00100 00100 00100 00100 01110",
  "2": "01110 10001 00001 00010 00100 01000 11111",
  "3": "11111 00010 00100 00010 00001 10001 01110",
  "4": "00010 00110 01010 10010 11111 00010 00010",
  "5": "11111 10000 11110 00001 00001 10001 01110",
  "6": "00110 01000 10000 11110 10001 10001 01110",
  "7": "11111 00001 00010 00100 01000 01000 01000",
  "8": "01110 10001 10001 01110 10001 10001 01110",
  "9": "01110 10001 10001 01111 00001 00010 01100",
  ":": "00000 01100 01100 00000 01100 01100 00000",
  ".": "00000 00000 00000 00000 00000 01100 01100",
  "-": "00000 00000 00000 11111 00000 00000 00000",
  " ": "00000 00000 00000 00000 00000 00000 00000",
  ">": "10000 11000 11100 11110 11100 11000 10000",
  A: "01110 10001 10001 11111 10001 10001 10001",
  B: "11110 10001 10001 11110 10001 10001 11110",
  C: "01110 10001 10000 10000 10000 10001 01110",
  D: "11100 10010 10001 10001 10001 10010 11100",
  E: "11111 10000 10000 11110 10000 10000 11111",
  F: "11111 10000 10000 11110 10000 10000 10000",
  G: "01110 10001 10000 10111 10001 10001 01111",
  H: "10001 10001 10001 11111 10001 10001 10001",
  I: "01110 00100 00100 00100 00100 00100 01110",
  L: "10000 10000 10000 10000 10000 10000 11111",
  M: "10001 11011 10101 10101 10001 10001 10001",
  N: "10001 10001 11001 10101 10011 10001 10001",
  O: "01110 10001 10001 10001 10001 10001 01110",
  P: "11110 10001 10001 11110 10000 10000 10000",
  R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110",
  T: "11111 00100 00100 00100 00100 00100 00100",
  U: "10001 10001 10001 10001 10001 10001 01110",
  V: "10001 10001 10001 10001 10001 01010 00100",
  Y: "10001 10001 01010 00100 00100 00100 00100",
};
const GLYPHS: Record<string, string> = {};
for (const k of Object.keys(GLYPH_ROWS)) GLYPHS[k] = GLYPH_ROWS[k].replace(/ /g, "");
const PIX_ADV = 6;
const pixelWidth = (text: string, px: number) => (Array.from(text).length * PIX_ADV - 1) * px;

/** Text in the 5 x 7 OSD pixel font, one SVG path (`px` = size of a pixel). */
const PixelText: React.FC<{ text: string; px: number; color?: string; style?: React.CSSProperties }> = ({ text, px, color = M.osd, style }) => {
  const chars = Array.from(text);
  const w = pixelWidth(text, px);
  const h = 7 * px;
  const q = px + 0.4;
  let d = "";
  chars.forEach((ch, i) => {
    const g = GLYPHS[ch.toUpperCase()] ?? GLYPHS[" "];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g.charAt(r * 5 + c) === "1") d += `M${(i * PIX_ADV + c) * px} ${r * px}h${q}v${q}h${-q}Z`;
      }
    }
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible", ...style }}>
      <path d={d} fill={color} />
    </svg>
  );
};

/** OSD battery (15 x 7 pixel grid), `level` 0-3 cells. */
const OsdBattery: React.FC<{ level: number; px?: number; color?: string }> = ({ level, px = 5, color = M.osd }) => (
  <svg width={15 * px} height={7 * px} viewBox="0 0 15 7" style={{ display: "block", overflow: "visible" }} shapeRendering="crispEdges">
    <path d="M0 0 H13 V7 H0 Z M1 1 V6 H12 V1 Z" fill={color} fillRule="evenodd" />
    <rect x={13} y={2} width={2} height={3} fill={color} />
    {[0, 1, 2].map((i) => (i < level ? <rect key={i} x={2 + i * 3.4} y={2} width={2.6} height={3} fill={color} /> : null))}
  </svg>
);

const osdFilter = (split: number) =>
  `drop-shadow(3px 3px 0 rgba(0,0,0,0.7)) drop-shadow(${(-split).toFixed(1)}px 0 0 rgba(255,40,90,0.6)) drop-shadow(${split.toFixed(1)}px 0 0 rgba(0,220,255,0.55))`;

const two = (n: number) => (n < 10 ? "0" : "") + n;
const hms = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${two(Math.floor(v / 3600) % 100)}:${two(Math.floor(v / 60) % 60)}:${two(v % 60)}`;
};

/** A horizontal tracking-noise band: brighter, washed-out strip with white streaks and colour fringes. */
const TrackBand: React.FC<{ frame: number; y: number; h: number; k: number; seed: number }> = ({ frame, y, h, k, seed }) => {
  const streaks: React.ReactNode[] = [];
  const n = Math.round(12 + 34 * k);
  for (let i = 0; i < n; i++) {
    const sd = frame * 13.7 + seed * 101.3 + i * 7.31;
    streaks.push(
      <rect
        key={i}
        x={rand(sd) * 1120 - 40}
        y={y + rand(sd + 1.3) * h}
        width={10 + rand(sd + 2.1) * 180}
        height={1.5 + rand(sd + 3.7) * 4}
        fill={rand(sd + 4.4) < 0.75 ? "#FFFFFF" : "#AFC4D8"}
        opacity={(0.25 + rand(sd + 5.9) * 0.6) * k}
      />,
    );
  }
  const f = `brightness(${(1 + 0.45 * k).toFixed(2)}) saturate(${(1 - 0.6 * k).toFixed(2)}) blur(${(1.6 * k).toFixed(2)}px)`;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: y, width: 1080, height: h, backdropFilter: f, WebkitBackdropFilter: f, background: `rgba(220,230,255,${(0.06 * k).toFixed(3)})` }} />
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <rect x={0} y={y - 3} width={1080} height={3} fill="#FF2A6A" opacity={0.5 * k} />
        <rect x={0} y={y + h} width={1080} height={3} fill="#2AE6FF" opacity={0.45 * k} />
        {streaks}
      </svg>
    </>
  );
};

/** Bands that pop up now and then (deterministic schedule), kept out of the caption band. */
const trackBands = (frame: number, from: number) => {
  const out: { y: number; h: number; k: number; seed: number }[] = [];
  const BLOCK = 48;
  const d = frame - from;
  const b0 = Math.floor(d / BLOCK);
  for (const b of [b0 - 1, b0]) {
    if (b < 0 || rand(b * 3.71 + 0.5) > 0.62) continue;
    const start = b * BLOCK + 8 + Math.floor(rand(b * 5.13 + 1.1) * 28);
    const len = 6 + Math.floor(rand(b * 7.7 + 2.2) * 7);
    const e = d - start;
    if (e < 0 || e >= len) continue;
    const r = rand(b * 9.1 + 3.3);
    const low = r > 0.82;
    const y = low ? 1450 + ((r - 0.82) / 0.18) * 300 + e * 8 : 300 + (r / 0.82) * 760 - e * 9;
    out.push({ y, h: 24 + rand(b * 2.9 + 4.4) * 70, k: Math.sin(((e + 0.5) / len) * Math.PI), seed: b });
  }
  return out;
};

/** Viewfinder corner bracket (an L), `sx`/`sy` = ±1 for the corner it opens towards. */
const Bracket: React.FC<{ x: number; y: number; sx: number; sy: number }> = ({ x, y, sx, sy }) => (
  <path d={`M${x} ${y + sy * 56} L${x} ${y} L${x + sx * 56} ${y}`} stroke={M.osd} strokeWidth={5} fill="none" strokeLinecap="square" />
);

/**
 * Old camcorder footage look for the legend part, full frame, from `from` to `to`: the picture
 * underneath is graded like tape (a bit desaturated, contrasty, soft, lifted teal blacks) with
 * scanlines, a slow roll bar, slight colour fringes at the edges, tracking-noise bands now and
 * then (never in the caption band) and a soft vignette; viewfinder corner brackets; the OSD in a
 * drawn pixel font with chroma bleed: "REC ●" top-left (x 96-262, y 254-303, the dot blinks),
 * the timecode top-right (x 642-924, y 257-299) counting from 00:00:00 at `from`, a battery under
 * it (x 849-924, y 316-351) and "NOCHE 1  23:47" bottom-left (x 96-511, y 1102-1137; the clock
 * follows the tape). It powers on with a tracking roll. At `jumpAt` the tape skips: tracking
 * bands, a flash, a rolling black bar, "▶▶" next to the timecode, and the timecode fast-forwards
 * by `jumpBy` seconds (default 1 h 58 min = 7080) in 6 frames and keeps running (the clock
 * jumps to 01:45 and the battery drops to one blinking cell). Suggested: from RETO.REC, to
 * SUSTO.END, jumpAt SUSTO.HORAS (put GlitchCut on top at SUSTO.OFF).
 */
export const VHSOverlay: React.FC<{ frame: number; from: number; to: number; jumpAt: number; jumpBy?: number }> = ({
  frame,
  from,
  to,
  jumpAt,
  jumpBy = 7080,
}) => {
  if (frame < from || frame >= to) return null;
  const d = frame - from;
  const e = frame - jumpAt;
  const jumping = e >= 0 && e < 8;
  const base = d / 30;
  let secs = base + (e >= 0 ? jumpBy : 0);
  let tc = hms(secs);
  if (e >= 0 && e < 6) {
    secs = base + jumpBy * Math.pow((e + 1) / 6, 2);
    tc = hms(secs)
      .split("")
      .map((ch, i) => (ch !== ":" && i >= 3 && e < 5 && rand(frame * 3.1 + i * 7.7) < 0.55 ? String(Math.floor(rand(frame * 1.3 + i * 2.1) * (i === 3 || i === 6 ? 6 : 10))) : ch))
      .join("");
  }
  const clock = (23 * 3600 + 47 * 60 + secs) % 86400;
  const stamp = `NOCHE 1  ${two(Math.floor(clock / 3600))}:${two(Math.floor(clock / 60) % 60)}`;
  // Power on: the OSD blinks in while a tracking roll locks the picture.
  const osdOn = pattern(frame, from, [0, 0, 1, 0, 1, 1, 1], 1);
  const lockY = d < 7 ? -320 + d * 220 : null;
  const glitchK = jumping ? (e < 2 ? 1 : 1 - (e - 2) / 6) : 0;
  const rareJolt = rand(Math.floor(frame / 3) * 1.7 + 0.2) < 0.05;
  const osdDx = jumping ? jit(frame, 3, 1) * 12 * glitchK : rareJolt ? jit(frame, 5, 1) * 3 : 0;
  const split = 2 + 1.2 * Math.abs(jit(frame, 9, 2)) + 7 * glitchK;
  const dot = blink(frame, from, 18, 12);
  const low = e >= 0;
  const battOn = !low || blink(frame, jumpAt, 15, 12) === 1;
  const roll = ((d * 7) % 2400) - 300;
  const bands = trackBands(frame, from);
  if (jumping) {
    for (let i = 0; i < 3; i++) {
      const r = rand(jumpAt * 0.31 + i * 4.7 + e * 0.9);
      bands.push({ y: 260 + r * 840 - e * 12, h: 40 + rand(i * 2.3 + e) * 110, k: glitchK, seed: 900 + i + e * 7 });
    }
  }
  const grade = `saturate(0.8) contrast(1.1) sepia(0.12) blur(0.6px)${jumping && e < 3 ? ` hue-rotate(${e === 0 ? 24 : -14}deg) contrast(1.35) brightness(1.15)` : ""}`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backdropFilter: grade, WebkitBackdropFilter: grade }} />
      <AbsoluteFill style={{ background: "rgba(32,52,46,0.22)", mixBlendMode: "screen" }} />
      <AbsoluteFill
        style={{
          backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)",
          backgroundPosition: `0 ${frame % 2}px`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: roll,
          width: 1080,
          height: 260,
          background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(230,240,255,0.06) 50%, rgba(255,255,255,0) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: "linear-gradient(90deg, rgba(255,40,90,0.12) 0%, rgba(255,40,90,0) 7%, rgba(0,0,0,0) 93%, rgba(0,220,255,0.12) 100%)",
          mixBlendMode: "screen",
        }}
      />
      {bands.map((b, i) => (
        <TrackBand key={i} frame={frame} y={b.y} h={b.h} k={b.k} seed={b.seed} />
      ))}
      {lockY !== null ? <TrackBand frame={frame} y={lockY} h={300} k={1} seed={77} /> : null}
      {jumping && e < 6 ? <div style={{ position: "absolute", left: 0, top: -80 + e * 190, width: 1080, height: 70, background: "rgba(0,0,0,0.85)" }} /> : null}
      {jumping && e < 2 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: e === 0 ? 0.24 : 0.1 }} /> : null}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 66% at 50% 46%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.3) 82%, rgba(0,0,0,0.62) 100%)" }} />
      {osdOn > 0 ? (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${osdDx.toFixed(1)}px)`, opacity: 0.94 + 0.06 * rand(frame * 1.31) }}>
          <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.6))", opacity: 0.85 }}>
            <Bracket x={64} y={232} sx={1} sy={1} />
            <Bracket x={936} y={232} sx={-1} sy={1} />
            <Bracket x={64} y={1172} sx={1} sy={-1} />
            <Bracket x={936} y={1172} sx={-1} sy={-1} />
          </svg>
          <div style={{ position: "absolute", left: 96, top: 254, display: "flex", alignItems: "center", gap: 20, filter: osdFilter(split) }}>
            <PixelText text="REC" px={7} />
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "radial-gradient(circle at 38% 35%, #FF8A80 0%, #FF2A2A 45%, #B00012 100%)",
                boxShadow: "0 0 18px rgba(255,30,40,0.85)",
                opacity: dot,
              }}
            />
          </div>
          <div style={{ position: "absolute", left: 924 - pixelWidth("00:00:00", 6), top: 257, filter: osdFilter(split) }}>
            <PixelText text={tc} px={6} />
          </div>
          {jumping && blink(frame, jumpAt, 2, 1) ? (
            <div style={{ position: "absolute", left: 924 - pixelWidth("00:00:00", 6) - 22 - pixelWidth(">>", 6), top: 257, filter: osdFilter(split) }}>
              <PixelText text=">>" px={6} />
            </div>
          ) : null}
          {battOn ? (
            <div style={{ position: "absolute", left: 924 - 75, top: 316, filter: osdFilter(split) }}>
              <OsdBattery level={low ? 1 : 3} color={low ? "#FF5A4E" : M.osd} />
            </div>
          ) : null}
          <div style={{ position: "absolute", left: 96, top: 1102, filter: osdFilter(split) }}>
            <PixelText text={stamp} px={5} />
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// GlitchCut

/**
 * The hard cut to black, full frame, `dur` frames (8) from `at`: about half of it is a VHS
 * glitch burst over the picture (TV static, torn bands inverted / hue-shifted, magenta and cyan
 * splits, black tape dropouts), then the picture collapses like an old CRT switching off (black
 * closing in from top and bottom onto a bright line), then a fading dot, and the last frame is
 * pure black. Render it above everything (it filters the picture underneath). Suggested: at
 * SUSTO.OFF (it ends exactly at SUSTO.END, where the next shot starts).
 */
export const GlitchCut: React.FC<{ frame: number; at: number; dur?: number }> = ({ frame, at, dur = 8 }) => {
  const uid = useUid();
  const d = frame - at;
  if (d < 0 || d >= dur) return null;
  const p = dur <= 1 ? 1 : d / (dur - 1);
  const A = 0.5;
  const B = 0.8;
  const phaseA = p < A;
  const phaseB = p >= A && p < B;
  const k = phaseA ? 0.55 + (0.45 * p) / A : 1;
  const q = phaseB ? (p - A) / (B - A) : 0;
  const H = phaseB ? 960 * Math.pow(1 - q, 2.2) + 4 : 960;
  const r = p >= B ? (p - B) / (1 - B) : 0;
  const tears: React.ReactNode[] = [];
  if (phaseA) {
    const nb = 7 + Math.round(6 * k);
    for (let i = 0; i < nb; i++) {
      const sd = frame * 7.13 + i * 3.37;
      const by = rand(sd) * 1920;
      const bh = 8 + rand(sd + 1.1) * 150 * k;
      const kind = rand(sd + 2.3);
      const filter = kind < 0.35 ? "invert(1) hue-rotate(180deg) saturate(1.6)" : kind < 0.7 ? "hue-rotate(290deg) saturate(2.6) brightness(1.4)" : "brightness(2.2) contrast(2) saturate(0)";
      const dx = (rand(sd + 3.9) - 0.5) * 160 * k;
      tears.push(
        <div key={`b${i}`} style={{ position: "absolute", left: 0, top: by, width: 1080, height: bh, backdropFilter: filter, WebkitBackdropFilter: filter }} />,
        <div key={`m${i}`} style={{ position: "absolute", left: dx, top: by - 5, width: 1080, height: 5, background: "#FF0050", opacity: 0.85 }} />,
        <div key={`c${i}`} style={{ position: "absolute", left: -dx, top: by + bh, width: 1080, height: 5, background: "#00F0FF", opacity: 0.8 }} />,
      );
      if (kind > 0.5) {
        tears.push(
          <div
            key={`t${i}`}
            style={{
              position: "absolute",
              left: dx * 2,
              top: by + bh * 0.2,
              width: 1080,
              height: bh * 0.6,
              background: rand(sd + 5.5) < 0.5 ? "rgba(255,0,80,0.32)" : "rgba(0,240,255,0.28)",
              mixBlendMode: "screen",
            }}
          />,
        );
      }
    }
    const nd = 4 + Math.round(6 * k);
    for (let i = 0; i < nd; i++) {
      const sd = frame * 11.7 + i * 5.91;
      tears.push(
        <div
          key={`k${i}`}
          style={{
            position: "absolute",
            left: rand(sd) * 900 - 100,
            top: rand(sd + 1.7) * 1920,
            width: 120 + rand(sd + 2.9) * 600,
            height: 6 + rand(sd + 4.1) * 34,
            background: "#000",
            opacity: 0.7 + 0.3 * rand(sd + 6.3),
          }}
        />,
      );
    }
  }
  const staticOp = phaseA ? 0.22 + 0.36 * k : phaseB ? 0.55 : 0;
  const stripF = "brightness(1.9) saturate(0.2) contrast(1.4)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {phaseA ? (
        <AbsoluteFill
          style={{
            backdropFilter: `contrast(${(1 + 0.6 * k).toFixed(2)}) saturate(${(1 + k).toFixed(2)}) brightness(${(1 + 0.15 * k).toFixed(2)})`,
            WebkitBackdropFilter: `contrast(${(1 + 0.6 * k).toFixed(2)}) saturate(${(1 + k).toFixed(2)}) brightness(${(1 + 0.15 * k).toFixed(2)})`,
          }}
        />
      ) : null}
      {phaseB ? <div style={{ position: "absolute", left: 0, top: 960 - H, width: 1080, height: 2 * H, backdropFilter: stripF, WebkitBackdropFilter: stripF }} /> : null}
      {tears}
      {staticOp > 0 ? (
        <svg width={1080} height={1920} viewBox="0 0 540 960" preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 0, opacity: staticOp }}>
          <filter id={`gs${uid}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.55 0.9" numOctaves={1} seed={frame % 997} />
            <feColorMatrix type="matrix" values="2.2 0 0 0 -0.6  2.2 0 0 0 -0.6  2.2 0 0 0 -0.6  0 0 0 0 1" />
          </filter>
          <rect x={0} y={0} width={540} height={960} filter={`url(#gs${uid})`} />
        </svg>
      ) : null}
      {phaseA ? (
        <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)" }} />
      ) : null}
      {phaseA && d === 0 ? <AbsoluteFill style={{ background: "rgba(255,255,255,0.35)" }} /> : null}
      {phaseB ? (
        <>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 960 - H, background: "#000" }} />
          <div style={{ position: "absolute", left: 0, top: 960 + H, width: 1080, height: 960 - H, background: "#000" }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 960 - (3 + 8 * (1 - q)),
              width: 1080,
              height: 2 * (3 + 8 * (1 - q)),
              background: "#FFFFFF",
              opacity: 0.35 + 0.6 * q,
              boxShadow: "0 0 40px 14px rgba(220,235,255,0.75)",
            }}
          />
        </>
      ) : null}
      {p >= B ? <AbsoluteFill style={{ background: "#000" }} /> : null}
      {p >= B && r < 1 ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 540 - 220 * (1 - r),
              top: 958,
              width: 440 * (1 - r),
              height: 4,
              background: "rgba(220,235,255,0.6)",
              boxShadow: "0 0 20px 6px rgba(220,235,255,0.5)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 540,
              top: 960,
              width: 26 * (1 - r) + 4,
              height: 26 * (1 - r) + 4,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background: "#FFFFFF",
              boxShadow: "0 0 30px 12px rgba(220,235,255,0.8)",
            }}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// FilmGrain

/**
 * Subtle animated film grain and a dark vignette over the whole video: frame-seeded fractal
 * noise (rendered at half resolution, so the grain is ~2 px) blended in overlay for the mid-tones
 * plus a faint screen pass so it also shows in the blacks; a vignette and a slight projector
 * flicker. `strength` scales everything (default 1; 0.5 for a lighter touch, 0 = off). Full
 * frame. Suggested: from 0 to the end, above the shots and overlays (before the captions).
 */
export const FilmGrain: React.FC<{ frame: number; strength?: number }> = ({ frame, strength = 1 }) => {
  const uid = useUid();
  const s = Math.max(0, strength);
  if (s <= 0) return null;
  const seed = Math.floor(frame) % 991;
  const ox = Math.floor(rand(frame * 1.37) * 12) * 2 - 12;
  const oy = Math.floor(rand(frame * 2.11 + 4) * 12) * 2 - 12;
  const flick = rand(frame * 0.91 + 3);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        width={1104}
        height={1944}
        viewBox="0 0 552 972"
        preserveAspectRatio="none"
        style={{ position: "absolute", left: -12 + ox, top: -12 + oy, mixBlendMode: "overlay", opacity: Math.min(1, 0.45 * s) }}
      >
        <filter id={`fg${uid}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={2} seed={seed} />
          <feColorMatrix type="matrix" values="1.7 0 0 0 -0.35  1.7 0 0 0 -0.35  1.7 0 0 0 -0.35  0 0 0 0 1" />
        </filter>
        <rect x={0} y={0} width={552} height={972} filter={`url(#fg${uid})`} />
      </svg>
      <svg
        width={1104}
        height={1944}
        viewBox="0 0 552 972"
        preserveAspectRatio="none"
        style={{ position: "absolute", left: -12 - ox, top: -12 - oy, mixBlendMode: "screen", opacity: Math.min(1, 0.07 * s) }}
      >
        <rect x={0} y={0} width={552} height={972} filter={`url(#fg${uid})`} />
      </svg>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 78% 64% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,${(0.3 * s).toFixed(3)}) 80%, rgba(0,0,0,${(0.6 * s).toFixed(3)}) 100%)`,
        }}
      />
      <AbsoluteFill style={{ background: "#000", opacity: 0.04 * s * flick }} />
    </AbsoluteFill>
  );
};

// =============================================================================================
// EndCard

// HandPointer at size 96: its viewBox (100 x 124) scale; the fingertip is at (47, 4).
const HAND_K = 96 / 124;

/** Comment bubble of the end card (316 x 168): dark tone gradient, bone border, tail down-outwards. */
const HorrorBubble: React.FC<{ label: string; tone: "red" | "green"; tail: "left" | "right"; children: React.ReactNode }> = ({ label, tone, tail, children }) => {
  const bg = tone === "red" ? "linear-gradient(160deg, #2A0509 0%, #6E0A16 55%, #A8122A 100%)" : "linear-gradient(160deg, #141F0C 0%, #34501C 55%, #5F8A32 100%)";
  const glow = tone === "red" ? "rgba(230,20,50,0.5)" : "rgba(160,220,90,0.4)";
  const tailSvg = (pass: "outline" | "fill") => (
    <svg
      width={52}
      height={60}
      viewBox="0 0 70 80"
      style={{ position: "absolute", [tail === "left" ? "left" : "right"]: 40, bottom: -38, overflow: "visible", transform: tail === "right" ? "scaleX(-1)" : undefined }}
    >
      <path d="M6 4 C14 30 12 52 2 74 C26 58 46 34 60 4 Z" fill={M.bone} stroke={pass === "outline" ? "#000" : "none"} strokeWidth={pass === "outline" ? 11 : 0} strokeLinejoin="round" />
    </svg>
  );
  return (
    <div style={{ position: "relative", width: 316, height: 168 }}>
      {tailSvg("outline")}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 50,
          background: bg,
          border: `6px solid ${M.bone}`,
          boxShadow: `0 0 0 4px #000, 0 0 40px ${glow}`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {children}
        <div
          style={{
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 38,
            lineHeight: 1,
            letterSpacing: 1,
            color: M.bone,
            WebkitTextStroke: "6px #000",
            paintOrder: "stroke fill",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>
      {tailSvg("fill")}
    </div>
  );
};

/**
 * End card on black from `at` to the end of the video (built to read in ~10 frames: the card is
 * only ~1.9 s). At once: "LA CASA MATUSITA" small on top (y ~300, between two red rules), a big
 * eye (y ~440) that opens and blinks once at at + 24, and "¿LEYENDA / O SUGESTIÓN?" (y 545-765;
 * LEYENDA blood red, SUGESTIÓN sickly green) snapping on like a bulb at at + 1 / at + 3 with a
 * light chromatic split; then two comment bubbles pop in (y ~800-990): "LEYENDA" (red, a little
 * ghost) and "SUGESTIÓN" (green, a brain); then a "COMENTA" button (y ~1030-1115) with a hand
 * tapping it every 14 frames (ripples). Everything stays inside x 60-940, y 250-1150.
 * Suggested: at FINAL.CARD (FINAL.BLACK + 8).
 */
export const EndCard: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  if (frame < at) return null;
  const t = frame - at;
  const bg = ramp(frame, at, at + 14);
  const topK = ramp(frame, at, at + 6);
  const eyeVis = snap(frame, at + 2);
  const eyeOpen = ramp(frame, at + 3, at + 9) * (1 - bump(frame, at + 24, 6));
  const q1 = snap(frame, at + 1);
  const q2 = snap(frame, at + 3);
  const qSplit = (la: number) => 1.2 + Math.abs(jit(frame, la, 2)) * 1.4 + 6 * (1 - ramp(frame, la, la + 8));
  const taps = [at + 26, at + 40, at + 54];
  let squish = 0;
  let push = 0;
  let rip = -1;
  for (const tp of taps) {
    squish = Math.max(squish, bump(frame, tp - 1, 6));
    push = Math.max(push, bump(frame, tp - 3, 8));
    if (frame >= tp && frame < tp + 14) rip = (frame - tp) / 14;
  }
  const btnIn = pop(frame, at + 14, { damping: 12, stiffness: 200 });
  const handIn = pop(frame, at + 17, { damping: 14, stiffness: 160 });
  const BTN = { x: 500, y: 1072 };
  const TAP = { x: BTN.x + 104, y: BTN.y + 8 };
  const qBase: React.CSSProperties = {
    fontFamily: FONT.heavy,
    fontWeight: 900,
    lineHeight: 1,
    whiteSpace: "nowrap",
    WebkitTextStroke: `7px ${M.ink}`,
    paintOrder: "stroke fill",
  };
  const red: React.CSSProperties = { color: M.blood, textShadow: "0 0 28px rgba(255,20,45,0.6)" };
  const green: React.CSSProperties = { color: "#B7E07E", textShadow: "0 0 28px rgba(169,212,107,0.5)" };
  const bone: React.CSSProperties = { color: M.bone };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", background: "#000" }}>
      <AbsoluteFill style={{ opacity: bg, background: "radial-gradient(ellipse 72% 40% at 50% 36%, rgba(110,8,20,0.34), rgba(0,0,0,0) 72%)" }} />
      <AbsoluteFill style={{ opacity: bg, background: "radial-gradient(ellipse 60% 26% at 50% 78%, rgba(90,130,50,0.16), rgba(0,0,0,0) 72%)" }} />
      <div style={{ position: "absolute", left: 500, top: 300, transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: 22, opacity: topK }}>
        <div style={{ width: 70, height: 3, background: `linear-gradient(90deg, rgba(224,26,49,0), ${M.blood})` }} />
        <div style={{ fontFamily: FONT.heavy, fontWeight: 800, fontSize: 36, lineHeight: 1, letterSpacing: 10, color: M.boneDim, whiteSpace: "nowrap", marginRight: -10 }}>
          LA CASA MATUSITA
        </div>
        <div style={{ width: 70, height: 3, background: `linear-gradient(90deg, ${M.blood}, rgba(224,26,49,0))` }} />
      </div>
      {eyeVis > 0 ? (
        <div style={{ position: "absolute", left: 500, top: 440, transform: `translate(-50%, -50%) scale(${1.04 - 0.04 * ramp(frame, at, at + 30)})`, opacity: eyeVis }}>
          <EyeIcon size={190} open={eyeOpen} look={Math.sin(Math.max(0, t - 8) * 0.12) * 0.7} glow="rgba(169,212,107,0.5)" />
        </div>
      ) : null}
      {q1 > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 500,
            top: 600,
            transform: `translate(-50%, -50%) translateX(${(jit(frame, 71, 2) * 1.2).toFixed(1)}px)`,
            opacity: q1,
            filter: chroma(qSplit(at + 1), 0.55),
          }}
        >
          <div style={{ ...qBase, fontSize: 116 }}>
            <span style={bone}>¿</span>
            <span style={red}>LEYENDA</span>
          </div>
        </div>
      ) : null}
      {q2 > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 500,
            top: 722,
            transform: `translate(-50%, -50%) translateX(${(jit(frame, 73, 2) * 1.2).toFixed(1)}px)`,
            opacity: q2,
            filter: chroma(qSplit(at + 3), 0.55),
            display: "flex",
            alignItems: "baseline",
            gap: 22,
          }}
        >
          <div style={{ ...qBase, ...bone, fontSize: 78 }}>O</div>
          <div style={{ ...qBase, fontSize: 104 }}>
            <span style={green}>SUGESTIÓN</span>
            <span style={bone}>?</span>
          </div>
        </div>
      ) : null}
      {[
        { label: "LEYENDA", tone: "red" as const, x: 282, la: at + 9, tail: "left" as const },
        { label: "SUGESTIÓN", tone: "green" as const, x: 718, la: at + 12, tail: "right" as const },
      ].map((b, i) => {
        const p = pop(frame, b.la, { damping: 12, stiffness: 210 });
        if (p < 0.001) return null;
        const bob = Math.sin((frame - b.la) * 0.12 + i * 2) * 5;
        return (
          <div
            key={b.label}
            style={{
              position: "absolute",
              left: b.x,
              top: 890 + bob,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(i ? 3 : -3) + Math.sin(t * 0.08 + i) * 1.2}deg)`,
            }}
          >
            <HorrorBubble label={b.label} tone={b.tone} tail={b.tail}>
              {b.tone === "red" ? <GhostIcon size={92} frame={frame} /> : <BrainIcon size={88} frame={frame} />}
            </HorrorBubble>
          </div>
        );
      })}
      {btnIn > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: BTN.x,
            top: BTN.y,
            transform: `translate(-50%, -50%) scale(${btnIn * (1 - 0.08 * squish)})`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 34px 12px 22px",
            borderRadius: 999,
            background: "linear-gradient(180deg, #2A1012 0%, #140809 100%)",
            border: `5px solid ${M.bone}`,
            boxShadow: `0 0 0 4px #000, 0 0 34px rgba(230,20,50,${(0.35 + 0.4 * squish).toFixed(2)})`,
          }}
        >
          <CommentBubbleIcon size={58} dot={M.blood} frame={frame} />
          <div style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 40, lineHeight: 1, letterSpacing: 2, color: M.bone, whiteSpace: "nowrap" }}>COMENTA</div>
        </div>
      ) : null}
      {rip >= 0 ? (
        <div
          style={{
            position: "absolute",
            left: TAP.x - 40,
            top: TAP.y - 40,
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: `${(8 * (1 - rip)).toFixed(1)}px solid ${M.bone}`,
            boxSizing: "border-box",
            transform: `scale(${1 + rip * 1.4})`,
            opacity: 1 - rip,
          }}
        />
      ) : null}
      {handIn > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: TAP.x - 47 * HAND_K,
            top: TAP.y - 4 * HAND_K,
            transformOrigin: `${47 * HAND_K}px ${4 * HAND_K}px`,
            transform: `translate(${((1 - handIn) * 110 + (1 - push) * 8).toFixed(1)}px, ${((1 - handIn) * 70 + (1 - push) * 16).toFixed(1)}px) rotate(-28deg) scale(${1 - 0.05 * push})`,
            opacity: Math.min(1, handIn * 2),
          }}
        >
          <HandPointer size={96} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
