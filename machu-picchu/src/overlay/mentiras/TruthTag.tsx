import React from "react";
import { interpolateColors } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, rand } from "../../anim";
import { FONT } from "../../theme";

// The truth tag of "¿Y si tus mentiras salieran sobre tu cabeza?": the sign that pops over a liar's
// head with the truth, the signature of the short. Drawn by the shots (2D, over their <Stage>),
// anchored with tagAt() so it follows the head. Everything is driven by the global `frame` plus
// explicit cue frames: no timers, no Math.random (`rand`), no CSS animations.
//
// Look: a chunky bright-yellow sign (white rim, thick ink outline, hard drop shadow) with a red
// «VERDAD» tab on its top edge (a magnifier with an eye in it, the "lie detector"), the truth in
// Luckiest Guy ink capitals, and a pointer whose tip touches the head. It feels magical: a warm
// glow that breathes, faint hologram scanlines, a shine sweep and twinkling sparkles.
//
// Geometry at scale 1 (px, relative to the anchor = the pointer tip): the sign sits right above
// the anchor; ~340-780 wide (never wider than `maxWidth`), ~170 tall for one row of text, ~400 for
// three lines (4 rows). Text is laid out here (Luckiest Guy advance widths below), so the card can
// grow smoothly: each TagLine wraps to at most 2 rows (balanced; a "\n" in the text forces the
// break), first line 76 px (never under 56), appended lines 58 px (never under 44).
//
// Motion: "slam" falls in 5 frames, squashes on impact (white flash ring, speed lines, sparks) and
// settles with a wobble; "rise" shoots up out of the anchor as if ripping through a cap (clipped at
// the anchor line, light burst, torn fabric shreds, sparks), ~8 frames. Appended lines pop in under
// the first one (the card grows over ~7 frames). TagLine.then: a red strike-through draws across
// the old text (5 frames), then it flips to the new one with a bounce (readable ~12 frames after
// then.at). Idle: ±4 px bob and a slow glow pulse. `out`: a quick pop away (gone 9 frames later).
// `loading`: an empty sign with three bouncing dots and a couple of hologram flickers; at `out` it
// gives up (the dots drop, it greys out, «SIN DATOS» and a «?» badge pop, it droops) and shrinks
// away (gone 22 frames after `out`). `swatAt`: hit from the left (impact star, squash), it flies off
// to the right spinning with motion streaks (off screen ~12 frames later, gone at +16).

export type TagLine = {
  text: string;
  /** Global frame this line appears (default: the tag's `at`). Later lines append under the first. */
  at?: number;
  /** Optional rewrite of the line later on (e.g. "TIENE S/800" -> "TIENE S/700"). */
  then?: { text: string; at: number };
};

export type TruthTagProps = {
  /** Global frame. */
  frame: number;
  /** Global frame the tag pops in. */
  at: number;
  /** Global frame it starts leaving (gone ~8 frames later). */
  out?: number;
  lines?: TagLine[];
  /** Screen point (px) touched by the tip of the tag's pointer: just above the head. */
  x: number;
  y: number;
  /** From tagAt(). */
  scale?: number;
  opacity?: number;
  /** "slam" (default): drops in and slams down. "rise": grows up out of the head, ripping through
   * whatever covers it (the cap in the café). */
  entrance?: "slam" | "rise";
  /** The empty tag of the silent Nubi: no text, three loading dots, then it gives up at `out`. */
  loading?: boolean;
  /** Global frame Nubi swats it: it flies off spinning. */
  swatAt?: number;
  /** Card width limit in px at scale 1 (the text wraps inside). */
  maxWidth?: number;
};

/** The tag's palette (also used by the other overlays of the short). */
export const TAG_COLORS = {
  ink: "#1A1233",
  red: "#FF3B4E",
  redTop: "#FF6577",
  redDark: "#D8102B",
  yellowTop: "#FFF27A",
  yellow: "#FFE14D",
  yellowDeep: "#FFC928",
  glow: "#FFE45C",
  dullTop: "#E9E6DE",
  dull: "#C9C4B8",
  /** Torn cap fabric for the "rise" entrance. */
  fabric: "#2E48D0",
  fabricDark: "#1E2F98",
} as const;
const K = TAG_COLORS;

// ---------------------------------------------------------------------------------------------
// Text metrics: Luckiest Guy advance widths (1/1000 em, from the font file; the browser kerns a
// little tighter, so these are safe).

const LG_W: Record<string, number> = {
  "0": 633, "1": 388, "2": 509, "3": 528, "4": 539, "5": 531, "6": 573, "7": 506, "8": 571, "9": 555,
  A: 626, B: 594, C: 515, D: 583, E: 479, F: 487, G: 626, H: 626, I: 297, J: 510, K: 614, L: 452, M: 791,
  N: 704, O: 638, P: 596, Q: 691, R: 606, S: 531, T: 543, U: 623, V: 613, W: 908, X: 588, Y: 607, Z: 487,
  Á: 626, É: 479, Í: 297, Ó: 638, Ú: 623, Ü: 623, Ñ: 704, "¡": 278, "!": 279, "¿": 563, "?": 554, ".": 222,
  ",": 223, ":": 248, ";": 247, "'": 232, '"': 479, "-": 382, "+": 456, "(": 389, ")": 382, "/": 505, "&": 630,
  $: 437, "%": 700, "@": 665, "*": 542, "«": 664, "»": 667, "·": 226, "…": 769, "“": 446, "”": 444, " ": 195,
};
const textEm = (s: string) => {
  let w = 0;
  for (const ch of s) w += LG_W[ch] ?? 600;
  return w / 1000;
};

/** Cap height of Luckiest Guy (em); with line-height 1 the caps start 0.008 em under the box top. */
const CAP = 0.7;
const CAP_TOP = 0.008;

type Row = { text: string; w: number };
type Block = { size: number; rows: Row[]; w: number; h: number };

const norm = (s: string) => s.toLocaleUpperCase("es").replace(/[ \t]+/g, " ").trim();

/**
 * Lays out one TagLine: at most 2 rows, `base` px unless it must shrink to fit `avail` (never under
 * `min`). One row if it fits at `base`; otherwise the balanced 2-row split (preferring a longer
 * bottom row when it costs little).
 */
const layoutBlock = (raw: string, base: number, min: number, avail: number): Block => {
  const text = norm(raw);
  let rows: string[];
  const forced = text.split("\n").map((r) => r.trim()).filter(Boolean);
  if (forced.length > 1) {
    rows = [forced[0], forced.slice(1).join(" ")];
  } else {
    const words = text.split(" ");
    if (textEm(text) * base <= avail || words.length < 2) {
      rows = [text];
    } else {
      const cands = words.slice(1).map((_, i) => {
        const a = words.slice(0, i + 1).join(" ");
        const b = words.slice(i + 1).join(" ");
        return { a, b, ea: textEm(a), eb: textEm(b) };
      });
      const best = Math.min(...cands.map((c) => Math.max(c.ea, c.eb)));
      const ok = cands.filter((c) => Math.max(c.ea, c.eb) <= best * 1.15);
      const pick = ok.find((c) => c.eb >= c.ea) ?? ok[0];
      rows = [pick.a, pick.b];
    }
  }
  const em = Math.max(...rows.map(textEm));
  const size = Math.max(min, Math.min(base, avail / Math.max(0.1, em)));
  const out = rows.map((r) => ({ text: r, w: textEm(r) * size }));
  return { size, rows: out, w: Math.max(...out.map((r) => r.w)), h: size * (rows.length * CAP + (rows.length - 1) * 0.3) };
};

// ---------------------------------------------------------------------------------------------
// Card geometry (scale 1, anchor = pointer tip at 0,0). P = the centre line of the white rim.

const G = {
  PAD_X: 42,
  PAD_TOP: 54,
  PAD_BOT: 34,
  GAP_LINE: 24,
  R: 34,
  TAIL_H: 40,
  TAIL_W: 30,
  /** The tip of P sits this far above the anchor (the round ink join reaches the anchor). */
  TIP: 12,
  MIN_W: 340,
  RIM: 6,
  INK: 6,
  L0: 76,
  L0_MIN: 56,
  LN: 58,
  LN_MIN: 44,
  LOAD_W: 400,
};
const BOTTOM = -(G.TIP + G.TAIL_H);

/** The sign's outline: rounded card + pointer, `top` = card top (y), width `w`, height `h`. */
const cardPath = (w: number, h: number) => {
  const l = -w / 2;
  const r = w / 2;
  const b = BOTTOM;
  const t = b - h;
  const R = Math.min(G.R, h / 2, w / 2);
  const tw = G.TAIL_W;
  return [
    `M${l + R} ${t}`,
    `H${r - R}`,
    `Q${r} ${t} ${r} ${t + R}`,
    `V${b - R}`,
    `Q${r} ${b} ${r - R} ${b}`,
    `H${tw}`,
    `L${3} ${-G.TIP + 2}`,
    `Q0 ${-G.TIP + 4} ${-3} ${-G.TIP + 2}`,
    `L${-tw} ${b}`,
    `H${l + R}`,
    `Q${l} ${b} ${l} ${b - R}`,
    `V${t + R}`,
    `Q${l} ${t} ${l + R} ${t}`,
    "Z",
  ].join(" ");
};

// ---------------------------------------------------------------------------------------------
// Small helpers

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
const bump = (frame: number, at: number, dur: number) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

/** Damped oscillation after `at` (1 at `at`, decays to 0). */
const ring = (frame: number, at: number, freq: number, decay: number) => {
  const d = frame - at;
  if (d < 0) return 0;
  return Math.exp(-d / decay) * Math.cos(d * freq);
};

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

/** Four-point twinkle star (centred on 0,0 of its box). */
const Sparkle: React.FC<{ size: number; color?: string }> = ({ size, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ position: "absolute", left: -size / 2, top: -size / 2, overflow: "visible" }}>
    <path d="M0 -48 C5 -12 12 -5 48 0 C12 5 5 12 0 48 C-5 12 -12 5 -48 0 C-12 -5 -5 -12 0 -48 Z" fill={color} stroke={K.ink} strokeWidth={7} strokeLinejoin="round" />
    <circle cx={0} cy={0} r={8} fill="#FFF6B0" />
  </svg>
);

/**
 * The «VERDAD» tab icon: a magnifying glass with an eye in its lens (the lie detector), 100 x 100
 * box. `look` -1..1 moves the pupil, `closed` shuts the eye (the tag gave up).
 */
export const TruthLensIcon: React.FC<{ size?: number; look?: number; closed?: boolean; style?: React.CSSProperties }> = ({
  size = 100,
  look = 0,
  closed = false,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible", ...style }}>
    <path d="M62 62 L88 88" stroke={K.ink} strokeWidth={21} strokeLinecap="round" />
    <path d="M64 64 L86 86" stroke="#FFC928" strokeWidth={10} strokeLinecap="round" />
    <circle cx={41} cy={41} r={33} fill="#FFFFFF" stroke={K.ink} strokeWidth={8} />
    <circle cx={41} cy={41} r={26} fill="#EAF7FF" />
    {closed ? (
      <path d="M24 44 Q41 54 58 44" stroke={K.ink} strokeWidth={6} strokeLinecap="round" fill="none" />
    ) : (
      <>
        <path d="M19 41 Q41 19 63 41 Q41 63 19 41 Z" fill="#FFFFFF" stroke={K.ink} strokeWidth={5.5} strokeLinejoin="round" />
        <circle cx={41 + look * 8} cy={41} r={10} fill={K.red} stroke={K.ink} strokeWidth={4} />
        <circle cx={41 + look * 8} cy={41} r={4.5} fill={K.ink} />
        <circle cx={44 + look * 8} cy={37.5} r={2.6} fill="#FFFFFF" />
      </>
    )}
    <path d="M20 26 Q27 15 40 13" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.9} />
  </svg>
);

/** A jagged torn-fabric shred (centred box `s`). */
const Shred: React.FC<{ s: number; seed: number }> = ({ s, seed }) => {
  const a = rand(seed * 3.1) * 0.4;
  const d = `M${-50 + a * 20} -30 L${10 + a * 30} -44 L50 ${-10 + a * 20} L${30 - a * 30} 40 L-8 ${26 + a * 10} L-44 36 Z`;
  return (
    <svg width={s} height={s} viewBox="-60 -60 120 120" style={{ position: "absolute", left: -s / 2, top: -s / 2, overflow: "visible" }}>
      <path d={d} fill={K.fabric} stroke={K.ink} strokeWidth={9} strokeLinejoin="round" />
      <path d="M-30 -18 L22 -28" stroke="#7088F0" strokeWidth={6} strokeLinecap="round" />
    </svg>
  );
};

// ---------------------------------------------------------------------------------------------
// The tag

export const TruthTag: React.FC<TruthTagProps> = ({
  frame,
  at,
  out,
  lines = [],
  x,
  y,
  scale = 1,
  opacity = 1,
  entrance = "slam",
  loading = false,
  swatAt,
  maxWidth = 780,
}) => {
  const uid = useUid();
  const t = frame - at;
  const exitDur = loading ? 22 : 9;
  if (t < 0) return null;
  if (out !== undefined && frame > out + exitDur && (swatAt === undefined || swatAt >= out)) return null;
  if (swatAt !== undefined && frame > swatAt + 16 && (out === undefined || out > swatAt)) return null;
  if (opacity <= 0) return null;

  const rise = entrance === "rise";
  const swatting = swatAt !== undefined && frame >= swatAt && (out === undefined || swatAt < out);
  const leaving = !swatting && out !== undefined && frame >= out;
  const avail = Math.max(200, maxWidth - 2 * G.PAD_X);

  // ---- Content layout (rows, card size), animated as lines append or rewrite themselves.
  type Placed = { key: string; block: Block; old?: Block; flipOut: number; flipIn: number; strike: number; p: number; y: number; slot: number };
  const placed: Placed[] = [];
  let cardW = G.MIN_W;
  let contentH = 0;
  let addBump = 0;
  if (loading) {
    cardW = G.LOAD_W;
    contentH = G.L0 * CAP;
  } else {
    let first = true;
    lines.forEach((l, i) => {
      const la = l.at ?? at;
      if (frame < la) return;
      const base = i === 0 ? G.L0 : G.LN;
      const min = i === 0 ? G.L0_MIN : G.LN_MIN;
      const b0 = layoutBlock(l.text, base, min, avail);
      const late = la > at + 1;
      const grow = late ? ramp(frame, la, la + 7, [0, 1], EASE_OUT) : 1;
      const p = late ? pop(frame, la + 1, { damping: 9, stiffness: 240, mass: 0.5 }) : 1;
      if (late) addBump = Math.max(addBump, bump(frame, la, 9));
      let block = b0;
      let old: Block | undefined;
      let flipOut = 0;
      let flipIn = 1;
      let strike = 0;
      let wK = 0;
      if (l.then && frame >= l.then.at) {
        const T = l.then.at;
        const b1 = layoutBlock(l.then.text, base, min, avail);
        strike = ramp(frame, T, T + 5, [0, 1], EASE_OUT);
        flipOut = ramp(frame, T + 6, T + 9, [0, 1], EASE_IN);
        flipIn = frame < T + 9 ? 0 : pop(frame, T + 9, { damping: 8, stiffness: 260, mass: 0.5 });
        wK = ramp(frame, T + 7, T + 15, [0, 1], EASE_IN_OUT);
        old = b0;
        block = b1;
        addBump = Math.max(addBump, bump(frame, T + 9, 9));
      }
      const w = old ? lerp(old.w, block.w, wK) : block.w;
      const h = old ? lerp(old.h, block.h, wK) : block.h;
      const gap = first ? 0 : G.GAP_LINE * grow;
      cardW = lerp(cardW, Math.max(cardW, w + 2 * G.PAD_X), grow);
      const slot = h * grow;
      placed.push({ key: `l${i}`, block, old, flipOut, flipIn, strike, p, y: contentH + gap, slot });
      contentH += gap + slot;
      first = false;
    });
    if (placed.length === 0) contentH = G.L0 * CAP;
  }
  cardW = Math.min(Math.max(cardW, G.MIN_W), Math.max(G.MIN_W, maxWidth));
  const cardH = G.PAD_TOP + contentH + G.PAD_BOT;
  const top = BOTTOM - cardH;
  const cardMidY = BOTTOM - cardH / 2;

  // ---- Entrance
  let dx = 0;
  let dy = 0;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  let alpha = 1;
  let flash = 0;
  const SLAM = 5;
  const tabP = rise ? pop(frame, at + 4, { damping: 9, stiffness: 220, mass: 0.6 }) : pop(frame, at + SLAM, { damping: 8, stiffness: 240, mass: 0.6 });
  if (!rise) {
    if (t < SLAM) {
      const f = EASE_IN(clamp01(t / SLAM));
      dy = -300 * (1 - f);
      sx = 0.88;
      sy = 1.16;
      alpha = clamp01((t + 1) / 2.5);
    } else {
      const q = ring(frame, at + SLAM, 0.85, 3.6);
      sx = 1 + 0.2 * q;
      sy = 1 - 0.22 * q;
      rot = 5 * Math.exp(-(t - SLAM) / 7) * Math.sin((t - SLAM) * 0.62);
      flash = 1 - clamp01((t - SLAM) / 5);
    }
  } else {
    const p = pop(frame, at, { damping: 11, stiffness: 190, mass: 0.7 });
    dy = (1 - p) * (cardH + G.TAIL_H + 40);
    const st = clamp01(1 - p) + Math.max(0, p - 1) * 0.6;
    sx = 1 - 0.14 * Math.min(1, st * 1.5);
    sy = 1 + 0.16 * Math.min(1, st * 1.5);
    flash = bump(frame, at + 2, 8) * 0.8;
  }

  // ---- Idle: bob + glow pulse, line bumps.
  const idleK = ramp(frame, at + 10, at + 22);
  dy += Math.sin(t * ((2 * Math.PI) / 54)) * 4 * idleK;
  const glowK = 0.62 + 0.22 * Math.sin(t * 0.15);
  const bumpS = 1 + 0.06 * addBump;

  // ---- Loading: flickers, give-up.
  let dull = 0;
  let droop = 0;
  let giveUp = -1;
  if (loading) {
    if ([7, 8, 19, 31, 32].includes(t)) {
      alpha *= t === 19 ? 0.55 : 0.35;
      dx += t % 2 === 0 ? 8 : -7;
    }
    if (out !== undefined && frame >= out) {
      giveUp = frame - out;
      dull = ramp(frame, out, out + 6);
      droop = ramp(frame, out + 3, out + 11, [0, 1], EASE_OUT);
      rot += 7 * droop;
      dy += 10 * droop;
    }
  }

  // ---- Exit (pop away) / swat.
  let exitS = 1;
  if (leaving && out !== undefined) {
    if (loading) {
      const k = ramp(frame, out + 14, out + 22, [0, 1], EASE_IN);
      exitS = 1 - k;
      alpha *= 1 - clamp01((k - 0.6) / 0.4);
    } else {
      const k = clamp01((frame - out) / 8);
      exitS = k < 0.25 ? 1 + 0.12 * (k / 0.25) : 1.12 * (1 - EASE_IN((k - 0.25) / 0.75));
      rot -= 8 * k;
      alpha *= 1 - clamp01((k - 0.7) / 0.3);
    }
  }
  let swatD = -1;
  if (swatting && swatAt !== undefined) {
    swatD = frame - swatAt;
    const d = swatD;
    if (d < 2) {
      sx *= 1 - 0.18 * (1 - d / 2);
      sy *= 1 + 0.08 * (1 - d / 2);
      flash = Math.max(flash, 1 - d / 2);
    }
    const fd = Math.max(0, d - 1);
    dx += 105 * fd + 3 * fd * fd;
    dy += -34 * fd + 2.6 * fd * fd;
    rot += 34 * fd;
  }
  if (exitS <= 0.001) return null;

  // ---- Colours
  const fillTop = interpolateColors(dull, [0, 1], [K.yellowTop, K.dullTop]);
  const fillBot = interpolateColors(dull, [0, 1], [K.yellowDeep, K.dull]);
  const tabTop = interpolateColors(dull, [0, 1], [K.redTop, "#A9A4B4"]);
  const tabBot = interpolateColors(dull, [0, 1], [K.redDark, "#7C778A"]);

  const path = cardPath(cardW, cardH);
  const PADV = 60;
  const vb = { x: -cardW / 2 - PADV, y: top - PADV, w: cardW + 2 * PADV, h: cardH + G.TAIL_H + G.TIP + 2 * PADV };

  // ---- Effects
  const fx: React.ReactNode[] = [];
  const fxBack: React.ReactNode[] = [];

  // Slam: speed lines while falling, flash ring + sparks on impact.
  if (!rise && t < SLAM + 6) {
    const fade = t < SLAM ? 1 : 1 - (t - SLAM) / 6;
    for (let i = 0; i < 5; i++) {
      const lx = (i - 2) * (cardW / 5) + (rand(i * 4.1) - 0.5) * 30;
      const len = 90 + rand(i * 2.3) * 90;
      fx.push(
        <div
          key={`sp${i}`}
          style={{
            position: "absolute",
            left: lx - 5,
            top: top - 40 - len - (t < SLAM ? 0 : (t - SLAM) * 18),
            width: 10,
            height: len,
            borderRadius: 6,
            background: "linear-gradient(180deg, rgba(255,255,255,0), #FFFFFF)",
            opacity: 0.9 * fade,
          }}
        />,
      );
    }
  }
  if (!rise && t >= SLAM && t < SLAM + 16) {
    const a = t - SLAM;
    const rk = clamp01(a / 11);
    fxBack.push(
      <div
        key="ring"
        style={{
          position: "absolute",
          left: -cardW / 2 - 14,
          top: top - 14,
          width: cardW + 28,
          height: cardH + 28,
          borderRadius: G.R + 14,
          border: `${16 * (1 - rk)}px solid #FFFFFF`,
          transform: `scale(${1 + 0.32 * EASE_OUT(rk)}, ${1 + 0.5 * EASE_OUT(rk)})`,
          transformOrigin: `50% ${cardH + 28}px`,
          opacity: 1 - rk,
          boxSizing: "border-box",
        }}
      />,
    );
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ang = (-0.15 - rand(i * 5.3) * 0.75) * Math.PI;
      const sp = 14 + rand(i * 7.1) * 12;
      const px = side * (cardW * 0.42 + Math.abs(Math.cos(ang)) * sp * a);
      const py = BOTTOM - 10 + Math.sin(ang) * sp * a * 0.8 + 1.1 * a * a;
      const sz = 16 + rand(i * 1.7) * 16;
      fx.push(
        <div key={`sk${i}`} style={{ position: "absolute", left: px, top: py, opacity: 1 - clamp01((a - 8) / 8), transform: `rotate(${a * 25 + i * 40}deg)` }}>
          <Sparkle size={sz} color={i % 3 === 0 ? "#FFFFFF" : K.glow} />
        </div>,
      );
    }
  }

  // Rise: light burst + rays behind the sign, torn fabric shreds + sparks flying sideways in front
  // (at the base, not clipped, they don't move with the sign).
  const base: React.ReactNode[] = [];
  const baseBack: React.ReactNode[] = [];
  if (rise && t < 26) {
    const lb = bump(frame, at, 14);
    baseBack.push(
      <div
        key="burst"
        style={{
          position: "absolute",
          left: -230,
          top: -110,
          width: 460,
          height: 180,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,240,150,0.7) 45%, rgba(255,230,90,0))",
          opacity: lb,
          transform: `scale(${0.6 + 0.6 * clamp01(t / 8)})`,
        }}
      />,
    );
    const rk = clamp01(t / 12);
    for (let i = 0; i < 7; i++) {
      const ang = -90 + (i - 3) * 24;
      const len = 120 + 220 * EASE_OUT(rk) + rand(i * 9.1) * 60;
      baseBack.push(
        <div
          key={`ray${i}`}
          style={{
            position: "absolute",
            left: 0,
            top: -8,
            width: len,
            height: 14 - Math.abs(i - 3) * 2,
            borderRadius: 8,
            background: "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,240,140,0))",
            transform: `rotate(${ang}deg)`,
            transformOrigin: "0 50%",
            opacity: (1 - rk) * 0.9,
          }}
        />,
      );
    }
    // Torn fabric shreds and sparks bursting sideways out of the hole (small arcs, then they fall).
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const vx = side * (13 + rand(i * 3.7) * 11);
      const vy = -(3 + rand(i * 6.1) * 5);
      const a = Math.max(0, t - (i % 3) * 0.7);
      const px = side * (24 + rand(i * 1.3) * 26) + vx * a;
      const py = 4 + vy * a + 0.8 * a * a;
      const sz = i < 6 ? 26 + rand(i * 2.9) * 14 : 22 + rand(i * 2.9) * 10;
      base.push(
        <div key={`sh${i}`} style={{ position: "absolute", left: px, top: py, transform: `rotate(${a * (side * 26) + i * 50}deg)`, opacity: 1 - clamp01((a - 13) / 7) }}>
          {i < 6 ? <Shred s={sz} seed={i} /> : <Sparkle size={sz} color={i % 2 ? K.glow : "#FFFFFF"} />}
        </div>,
      );
    }
  }

  // Swat: impact star at the left side + motion streaks (in screen space, not rotating).
  if (swatD >= 0) {
    const d = swatD;
    const fd = Math.max(0, d - 1);
    const cx = 105 * fd + 3 * fd * fd;
    const cy = cardMidY - 34 * fd + 2.6 * fd * fd;
    if (d < 7) {
      const k = d / 7;
      base.push(
        <svg
          key="pow"
          width={220}
          height={220}
          viewBox="-110 -110 220 220"
          style={{ position: "absolute", left: -cardW / 2 - 110, top: cardMidY - 110, overflow: "visible", transform: `scale(${0.6 + 0.7 * EASE_OUT(k)}) rotate(${d * 8}deg)`, opacity: 1 - k }}
        >
          <path
            d={Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const r = i % 2 === 0 ? 100 : 48;
              return `${i === 0 ? "M" : "L"}${Math.cos(a) * r} ${Math.sin(a) * r}`;
            }).join(" ") + " Z"}
            fill="#FFFFFF"
            stroke={K.ink}
            strokeWidth={8}
            strokeLinejoin="round"
          />
          <circle cx={0} cy={0} r={26} fill={K.glow} />
        </svg>,
      );
    }
    if (d >= 1) {
      const fade = 1 - clamp01((d - 8) / 6);
      for (let i = 0; i < 6; i++) {
        const ly = cy + (i - 2.5) * (cardH / 6) + (rand(i * 3.3) - 0.5) * 20;
        const len = Math.min(cx + cardW / 2, 160 + rand(i * 5.9) * 260);
        base.push(
          <div
            key={`st${i}`}
            style={{
              position: "absolute",
              left: cx - cardW * 0.35 - len,
              top: ly - 6,
              width: len,
              height: 12 - (i % 3) * 3,
              borderRadius: 8,
              background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.95))",
              boxShadow: "0 0 0 2px rgba(26,18,51,0.18)",
              opacity: fade,
            }}
          />,
        );
      }
    }
  }

  // Twinkling sparkles around the card (idle magic).
  const twinkles = loading && giveUp >= 0
    ? []
    : [
        { x: -cardW / 2 - 18, y: top + 18, ph: 0, s: 36 },
        { x: cardW / 2 + 16, y: top + 40, ph: 2.1, s: 30 },
        { x: cardW / 2 + 6, y: BOTTOM - 18, ph: 4.2, s: 24 },
      ];
  const twk = twinkles.map((s, i) => {
    const k = Math.max(0, Math.sin(t * 0.13 + s.ph));
    const appear = ramp(frame, at + 8 + i * 3, at + 14 + i * 3);
    const sz = s.s * k * k * appear;
    if (sz < 2) return null;
    return (
      <div key={`tw${i}`} style={{ position: "absolute", left: s.x, top: s.y, transform: `rotate(${t * 2 + i * 30}deg)` }}>
        <Sparkle size={sz} color={i === 1 ? K.glow : "#FFFFFF"} />
      </div>
    );
  });

  // Shine sweep across the card every 75 frames (first one right after landing).
  const SW = 75;
  const swT = (((t - 8) % SW) + SW) % SW;
  const sweepK = t >= 8 ? clamp01(swT / 14) : -1;

  // ---- Text rows
  const textNodes: React.ReactNode[] = [];
  const firstTop = top + G.PAD_TOP;
  const rowNodes = (b: Block, cy: number, keyP: string, strikeK: number, sYc: number, op: number) =>
    b.rows.map((r, j) => {
      const capTop = cy + j * b.size;
      const boxTop = capTop - CAP_TOP * b.size;
      const strikeW = (r.w + 24) * strikeK;
      return (
        <div
          key={`${keyP}-${j}`}
          style={{
            position: "absolute",
            left: -r.w / 2 - 30,
            width: r.w + 60,
            top: boxTop,
            height: b.size,
            transform: `scaleY(${sYc})`,
            transformOrigin: `50% ${CAP * b.size * 0.5}px`,
            opacity: op,
          }}
        >
          <div
            style={{
              fontFamily: FONT.title,
              fontSize: b.size,
              lineHeight: `${b.size}px`,
              color: K.ink,
              textAlign: "center",
              whiteSpace: "nowrap",
              textShadow: `0 ${Math.round(b.size * 0.06)}px 0 rgba(214,120,0,0.42)`,
            }}
          >
            {r.text}
          </div>
          {strikeK > 0 ? (
            <div
              style={{
                position: "absolute",
                left: 30 - 12,
                top: (CAP_TOP + CAP * 0.5) * b.size - b.size * 0.08,
                width: r.w + 24,
                height: b.size * 0.16,
                transform: `rotate(${r.w > 300 ? -2.5 : -5}deg)`,
                transformOrigin: "50% 50%",
              }}
            >
              <div
                style={{
                  width: strikeW,
                  height: "100%",
                  borderRadius: b.size * 0.08,
                  background: `linear-gradient(180deg, ${K.redTop}, ${K.red} 60%, ${K.redDark})`,
                  boxShadow: `0 0 0 4px ${K.ink}`,
                }}
              />
            </div>
          ) : null}
        </div>
      );
    });
  if (loading) {
    const cy = firstTop + (G.L0 * CAP) / 2;
    if (giveUp < 0 || giveUp < 7) {
      for (let i = 0; i < 3; i++) {
        const hop = Math.max(0, Math.sin(t * 0.36 - i * 0.95));
        const fall = giveUp >= 0 ? 1.6 * giveUp * giveUp + giveUp * 2 : 0;
        textNodes.push(
          <div
            key={`dot${i}`}
            style={{
              position: "absolute",
              left: (i - 1) * 64 - 19,
              top: cy - 19 - (giveUp >= 0 ? 0 : hop * 22) + fall,
              width: 38,
              height: 38,
              borderRadius: 19,
              background: K.ink,
              boxShadow: "0 5px 0 rgba(214,120,0,0.42)",
              opacity: giveUp >= 0 ? 1 - giveUp / 7 : 0.75 + 0.25 * hop,
              transform: `rotate(${giveUp >= 0 ? (i - 1) * giveUp * 12 : 0}deg)`,
            }}
          />,
        );
      }
    }
    if (giveUp >= 3) {
      const p = pop(frame, (out ?? 0) + 3, { damping: 9, stiffness: 240, mass: 0.5 });
      const b = layoutBlock("SIN DATOS", 58, 44, cardW - 2 * G.PAD_X);
      textNodes.push(
        <div key="sin" style={{ position: "absolute", left: 0, top: 0, transform: `translate(0px, ${cy}px) scale(${p}) translate(0px, ${-cy}px)` }}>
          {rowNodes(b, cy - (b.size * CAP) / 2, "sin", 0, 1, 1)}
        </div>,
      );
    }
  } else {
    placed.forEach((pl) => {
      const cy = firstTop + pl.y;
      const centre = cy + pl.slot / 2;
      const nodes: React.ReactNode[] = [];
      if (pl.old && pl.flipOut < 1) {
        const oy = centre - pl.old.h / 2;
        nodes.push(...rowNodes(pl.old, oy, `${pl.key}o`, pl.strike, 1 - pl.flipOut, 1));
      }
      if (!pl.old || pl.flipIn > 0) {
        const ny = centre - pl.block.h / 2;
        nodes.push(...rowNodes(pl.block, ny, `${pl.key}n`, 0, pl.old ? pl.flipIn : 1, 1));
      }
      textNodes.push(
        <div
          key={pl.key}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(0px, ${centre}px) scale(${pl.p}) translate(0px, ${-centre}px)`,
            opacity: clamp01(pl.p * 3),
          }}
        >
          {nodes}
        </div>,
      );
    });
  }

  // Give-up "?" badge.
  let qBadge: React.ReactNode = null;
  if (loading && giveUp >= 5) {
    const p = pop(frame, (out ?? 0) + 5, { damping: 8, stiffness: 220, mass: 0.5 });
    qBadge = (
      <div
        style={{
          position: "absolute",
          left: cardW / 2 - 40,
          top: top - 26,
          width: 76,
          height: 76,
          borderRadius: 38,
          background: "#FFFFFF",
          boxShadow: `0 0 0 6px ${K.ink}, 0 7px 0 6px rgba(0,0,0,0.28)`,
          transform: `scale(${p}) rotate(${14 - 10 * p}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT.title,
          fontSize: 62,
          lineHeight: "62px",
          color: K.red,
          paddingTop: 10,
          boxSizing: "border-box",
        }}
      >
        ?
      </div>
    );
  }

  // Header tab.
  const look = loading ? (giveUp >= 0 ? 0 : Math.sin(t * 0.22) * 1.0) : Math.sin(t * 0.06) * 0.5;
  const tab = (
    <div
      style={{
        position: "absolute",
        left: 0,
        top,
        transform: `translate(-50%, -50%) rotate(-3deg) scale(${0.4 + 0.6 * tabP})`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 56,
        padding: "0 24px 0 12px",
        borderRadius: 999,
        background: `linear-gradient(180deg, ${tabTop} 0%, ${tabBot} 100%)`,
        border: "5px solid #FFFFFF",
        boxShadow: `0 0 0 5px ${K.ink}, 0 7px 0 5px rgba(0,0,0,0.3)`,
        whiteSpace: "nowrap",
      }}
    >
      <TruthLensIcon size={48} look={look} closed={giveUp >= 3} style={{ marginTop: 2 }} />
      <span
        style={{
          fontFamily: FONT.heavy,
          fontWeight: 900,
          fontSize: 34,
          lineHeight: 1,
          letterSpacing: 3,
          color: "#FFFFFF",
          textShadow: `0 3px 0 rgba(26,18,51,0.55)`,
          marginTop: 1,
        }}
      >
        VERDAD
      </span>
    </div>
  );

  // Interior effects (clipped to the yellow face).
  const inset = G.RIM;
  const interior = (
    <div
      style={{
        position: "absolute",
        left: -cardW / 2 + inset,
        top: top + inset,
        width: cardW - 2 * inset,
        height: cardH - 2 * inset,
        borderRadius: G.R - inset,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 6px, rgba(255,255,255,0.32) 6px, rgba(255,255,255,0.32) 8px)",
          backgroundPosition: `0px ${(t * 0.8) % 8}px`,
          opacity: 0.55 + 0.25 * glowK,
        }}
      />
      <div style={{ position: "absolute", left: 14, right: 14, top: 4, height: "36%", borderRadius: 999, background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))" }} />
      {sweepK >= 0 && sweepK < 1 ? (
        <div
          style={{
            position: "absolute",
            top: -40,
            bottom: -40,
            width: 90,
            left: lerp(-160, cardW + 60, EASE_IN_OUT(sweepK)),
            background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75), rgba(255,255,255,0))",
            transform: "skewX(-22deg)",
          }}
        />
      ) : null}
      {flash > 0 ? <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: flash * 0.85 }} /> : null}
    </div>
  );

  const glow = (
    <div
      style={{
        position: "absolute",
        left: -cardW / 2 - 70,
        top: top - 70,
        width: cardW + 140,
        height: cardH + 140,
        borderRadius: G.R + 70,
        background: `radial-gradient(closest-side, rgba(255,236,110,${0.75 * glowK * (1 - dull)}), rgba(255,236,110,${0.35 * glowK * (1 - dull)}) 60%, rgba(255,236,110,0))`,
      }}
    />
  );

  const sign = (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        transform: `translate(${dx}px, ${dy}px) translate(0px, ${cardMidY}px) rotate(${rot}deg) translate(0px, ${-cardMidY}px) scale(${sx * bumpS * exitS}, ${sy * bumpS * exitS})`,
        transformOrigin: "0 0",
        opacity: alpha,
      }}
    >
      {glow}
      {fxBack}
      <svg width={vb.w} height={vb.h} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ position: "absolute", left: vb.x, top: vb.y, overflow: "visible" }}>
        <defs>
          <linearGradient id={`tf${uid}`} x1="0" y1={top} x2="0" y2={BOTTOM} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={fillTop} />
            <stop offset="0.55" stopColor={interpolateColors(dull, [0, 1], [K.yellow, "#D8D3C8"])} />
            <stop offset="1" stopColor={fillBot} />
          </linearGradient>
        </defs>
        <g opacity={0.3}>
          <path d={path} transform="translate(0 13)" fill="#000000" stroke="#000000" strokeWidth={2 * (G.RIM + G.INK)} strokeLinejoin="round" />
        </g>
        <path d={path} fill={K.ink} stroke={K.ink} strokeWidth={2 * (G.RIM + G.INK)} strokeLinejoin="round" />
        <path d={path} fill={`url(#tf${uid})`} stroke="#FFFFFF" strokeWidth={2 * G.RIM} strokeLinejoin="round" />
      </svg>
      {interior}
      {textNodes}
      {tab}
      {qBadge}
      {twk}
      {fx}
    </div>
  );

  // While rising, everything under the anchor line is hidden (the sign comes out of the head).
  const clipRise = rise && t < 16;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `scale(${scale})`,
        transformOrigin: "0 0",
        opacity,
        pointerEvents: "none",
      }}
    >
      {baseBack}
      {clipRise ? (
        <div style={{ position: "absolute", left: -1600, top: -2600, width: 3200, height: 2600 - 2, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 1600, top: 2600, width: 0, height: 0 }}>{sign}</div>
        </div>
      ) : (
        sign
      )}
      {base}
    </div>
  );
};
