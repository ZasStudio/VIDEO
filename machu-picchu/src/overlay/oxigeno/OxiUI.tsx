import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, rand, windowIn } from "../../anim";
import { FONT } from "../../theme";
import { fmtNumber } from "../Graphics";
import { HeavyText } from "../inca/HeavyText";
import { CommentBubbleIcon, HandPointer, INK, RocketIcon } from "../inca/icons";

// 2D overlays for "¿Y si desaparece el oxígeno por 5 segundos?" (1080 x 1920, 30 fps).
// Same punchy look as the Inca-phone overlays: thick dark outlines, bold gradients, hard drop
// shadows, springy pops. Everything is driven by the global `frame` plus explicit cue frames.
// No emoji and no unicode check marks / subscripts: icons are inline SVG and the "2" of O2 is
// a smaller, lowered glyph.

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
const bump = (frame: number, at: number, dur: number) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

/** Square-wave blink: 1 for `on` frames, 0 for `off` frames, starting at `from`. */
const blink = (frame: number, from: number, on = 7, off = 6) => ((frame - from) % (on + off) < on ? 1 : 0);

/** Point on a circle, angle in degrees clockwise from 12 o'clock. */
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};

type IconProps = { size?: number; style?: React.CSSProperties };

/** Silhouette drawn as a thick outline first, then filled on top. */
const Outlined: React.FC<{ w?: number; children: React.ReactNode }> = ({ w = 7, children }) => (
  <>
    <g stroke={INK} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
    <g>{children}</g>
  </>
);

/** Inline "2" subscript for plain text. */
const Sub2: React.FC = () => <span style={{ fontSize: "0.58em", position: "relative", top: "0.28em", marginLeft: "0.02em" }}>2</span>;

// =============================================================================================
// Icons

/** Campfire; `off` = put out (charred logs, rising smoke). */
export const FireIcon: React.FC<IconProps & { frame?: number; off?: boolean }> = ({ size = 100, frame = 0, off, style }) => {
  const f1 = 1 + Math.sin(frame * 0.9) * 0.07 + Math.sin(frame * 2.3) * 0.04;
  const sway = Math.sin(frame * 0.5) * 3;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
      {off ? (
        <g>
          {[0, 1, 2].map((i) => {
            const t = ((frame * 0.035 + i / 3) % 1 + 1) % 1;
            const y = 62 - t * 50;
            const x = 50 + Math.sin(t * 6 + i * 2) * 7 + (i - 1) * 8;
            return <circle key={i} cx={x} cy={y} r={10 + t * 10} fill="#8A939E" opacity={1 - t * 0.85} stroke={INK} strokeWidth={4 * (1 - t)} />;
          })}
          <ellipse cx={50} cy={70} rx={10} ry={4} fill="#FF6A2A" opacity={0.5 + 0.3 * Math.sin(frame * 0.4)} />
        </g>
      ) : (
        <g transform={`translate(50 74) scale(${1 / f1 + 0.08} ${f1}) translate(-50 -74)`}>
          <path
            d={`M50 ${10 + sway * 0.5} C${62 + sway} 26 76 36 74 56 C73 70 63 78 50 78 C37 78 27 70 26 56 C25 44 34 38 38 28 C42 36 44 40 48 42 C47 32 46 20 50 ${10 + sway * 0.5} Z`}
            fill="#FF5A1F"
            stroke={INK}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d={`M50 ${38 + sway * 0.3} C58 48 64 56 62 64 C61 72 56 76 50 76 C44 76 39 72 38 65 C38 58 44 54 46 48 C48 52 49 54 51 55 C51 50 50 44 50 ${38 + sway * 0.3} Z`} fill="#FFD23F" />
        </g>
      )}
      <Outlined w={6}>
        <rect x={16} y={76} width={68} height={12} rx={6} transform="rotate(14 50 82)" fill={off ? "#4A3A33" : "#9B5B34"} />
        <rect x={16} y={76} width={68} height={12} rx={6} transform="rotate(-14 50 82)" fill={off ? "#5A463C" : "#B06A3B"} />
      </Outlined>
    </svg>
  );
};

/** Car engine block with a gear; the gear turns unless `off` (then it puffs black smoke). */
export const EngineIcon: React.FC<IconProps & { frame?: number; off?: boolean }> = ({ size = 100, frame = 0, off, style }) => {
  const rot = off ? 12 : frame * 6;
  const teeth = [];
  for (let i = 0; i < 8; i++) {
    teeth.push(<rect key={i} x={-4.5} y={-17} width={9} height={8} rx={2} transform={`rotate(${i * 45})`} fill="#FFC21F" />);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
      {off
        ? [0, 1].map((i) => {
            const t = ((frame * 0.04 + i / 2) % 1 + 1) % 1;
            return <circle key={i} cx={78 + t * 8} cy={30 - t * 26} r={6 + t * 8} fill="#3B3F46" opacity={0.9 * (1 - t)} />;
          })
        : null}
      <Outlined w={6}>
        <rect x={30} y={18} width={14} height={20} rx={3} fill="#AEB8C4" />
        <rect x={50} y={18} width={14} height={20} rx={3} fill="#AEB8C4" />
        <rect x={20} y={34} width={58} height={44} rx={8} fill="#7D8A99" />
        <path d="M78 46 L90 46 L90 36" fill="none" />
        <rect x={34} y={80} width={30} height={8} rx={3} fill="#5B6573" />
      </Outlined>
      <path d="M78 46 L90 46 L90 36" fill="none" stroke="#AEB8C4" strokeWidth={4} strokeLinecap="round" />
      <rect x={26} y={40} width={46} height={5} rx={2.5} fill="#9AA6B4" />
      <g transform={`translate(38 60) rotate(${rot})`}>
        <g stroke={INK} strokeWidth={5}>{teeth}</g>
        {teeth}
        <circle r={12} fill="#FFC21F" stroke={INK} strokeWidth={4} />
        <circle r={4.5} fill="#7D8A99" stroke={INK} strokeWidth={3} />
      </g>
      <circle cx={63} cy={56} r={3} fill="#AEB8C4" />
      <circle cx={63} cy={66} r={3} fill="#AEB8C4" />
    </svg>
  );
};

/** Pair of lungs that breathe; `off` = deflated and pale. */
export const LungsIcon: React.FC<IconProps & { frame?: number; off?: boolean }> = ({ size = 100, frame = 0, off, style }) => {
  const b = off ? 0.86 : 1 + Math.sin(frame * 0.22) * 0.05;
  const fill = off ? "#C9A7B4" : "#FF7FA3";
  const shade = off ? "#AE8C99" : "#E85A84";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <g transform={`translate(50 55) scale(${b} ${off ? 0.94 : b}) translate(-50 -55)`}>
        <Outlined w={6}>
          <path d="M45 30 C36 22 20 30 16 50 C12 70 16 86 30 86 C40 86 45 78 45 66 Z" fill={fill} />
          <path d="M55 30 C64 22 80 30 84 50 C88 70 84 86 70 86 C60 86 55 78 55 66 Z" fill={fill} />
        </Outlined>
        <path d="M22 62 C22 74 26 80 32 80" stroke={shade} strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M78 62 C78 74 74 80 68 80" stroke={shade} strokeWidth={4} fill="none" strokeLinecap="round" />
        <ellipse cx={27} cy={44} rx={4} ry={7} fill="#FFFFFF" opacity={0.55} transform="rotate(20 27 44)" />
      </g>
      <path d="M50 8 L50 40 M50 40 L40 52 M50 40 L60 52" stroke={INK} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M50 8 L50 40 M50 40 L40 52 M50 40 L60 52" stroke="#F4F6FA" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
};

/** A match; lit (flickering flame) or `off` (burnt head, a wisp of smoke). */
export const MatchIcon: React.FC<IconProps & { frame?: number; off?: boolean }> = ({ size = 100, frame = 0, off, style }) => {
  const f = 1 + Math.sin(frame * 1.1) * 0.08 + Math.sin(frame * 2.7) * 0.05;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
      <g transform="rotate(28 50 50)">
        <Outlined w={6}>
          <rect x={45} y={40} width={10} height={54} rx={4} fill="#F2C58A" />
          <ellipse cx={50} cy={38} rx={9} ry={12} fill={off ? "#2A2522" : "#E63946"} />
        </Outlined>
        <rect x={47.5} y={50} width={3} height={40} rx={1.5} fill="#FFE2B8" />
        {off ? (
          <path
            d={`M50 22 C${44 + Math.sin(frame * 0.2) * 3} 14 ${57 + Math.sin(frame * 0.25) * 3} 8 50 -2`}
            stroke="#9AA3AD"
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            opacity={0.9}
          />
        ) : (
          <g transform={`translate(50 30) scale(${1 / f + 0.08} ${f}) translate(-50 -30)`}>
            <path d="M50 -4 C60 8 64 16 62 24 C60 31 56 34 50 34 C44 34 40 31 38 24 C36 16 42 8 50 -4 Z" fill="#FF7A1F" stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
            <path d="M50 12 C55 18 57 22 56 26 C55 30 53 31 50 31 C47 31 45 30 44 26 C43 22 46 18 50 12 Z" fill="#FFE14D" />
          </g>
        )}
      </g>
    </svg>
  );
};

export type StatusIcon = "fire" | "engine" | "rocket" | "lungs" | "match";

const StatusIconView: React.FC<{ icon: StatusIcon; frame: number; off: boolean; size: number }> = ({ icon, frame, off, size }) => {
  switch (icon) {
    case "fire":
      return <FireIcon size={size} frame={frame} off={off} />;
    case "engine":
      return <EngineIcon size={size} frame={frame} off={off} />;
    case "lungs":
      return <LungsIcon size={size} frame={frame} off={off} />;
    case "match":
      return <MatchIcon size={size} frame={frame} off={off} />;
    default:
      return <RocketIcon size={size * 1.08} frame={frame} />;
  }
};

/** Check mark or cross in a round badge. */
export const MarkBadge: React.FC<{ kind: "check" | "cross"; size?: number; style?: React.CSSProperties }> = ({ kind, size = 84, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <circle cx={50} cy={50} r={44} fill={kind === "check" ? "#39D353" : "#FF3B30"} stroke="#FFFFFF" strokeWidth={9} />
    <circle cx={50} cy={50} r={48.5} fill="none" stroke={INK} strokeWidth={3.5} />
    {kind === "check" ? (
      <>
        <path d="M28 52 L44 67 L73 35" stroke={INK} strokeWidth={17} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 52 L44 67 L73 35" stroke="#FFFFFF" strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <>
        <path d="M32 32 L68 68 M68 32 L32 68" stroke={INK} strokeWidth={17} fill="none" strokeLinecap="round" />
        <path d="M32 32 L68 68 M68 32 L32 68" stroke="#FFFFFF" strokeWidth={9} fill="none" strokeLinecap="round" />
      </>
    )}
  </svg>
);

/** Stopwatch. The hand sweeps with `frame` unless `frozen` (icy, icicles, hand stuck). */
export const StopwatchIcon: React.FC<IconProps & { frame?: number; frozen?: boolean; accent?: string }> = ({
  size = 100,
  frame = 0,
  frozen,
  accent = "#FF3B30",
  style,
}) => {
  const hand = frozen ? 62 : frame * 12;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <Outlined w={6}>
        <rect x={43} y={6} width={14} height={10} rx={3} fill={frozen ? "#BFE9FF" : accent} />
        <rect x={47} y={13} width={6} height={8} fill="#AEB8C4" />
        <rect x={71} y={16} width={10} height={9} rx={3} transform="rotate(45 76 20)" fill="#AEB8C4" />
        <circle cx={50} cy={57} r={36} fill={frozen ? "#9ADFFF" : "#F4F6FA"} />
      </Outlined>
      <circle cx={50} cy={57} r={28} fill="#FFFFFF" />
      {Array.from({ length: 12 }).map((_, i) => {
        const [x1, y1] = polar(i % 3 === 0 ? 20 : 23, i * 30);
        const [x2, y2] = polar(26, i * 30);
        return <line key={i} x1={50 + x1} y1={57 + y1} x2={50 + x2} y2={57 + y2} stroke={INK} strokeWidth={i % 3 === 0 ? 3.5 : 2} strokeLinecap="round" />;
      })}
      <g transform={`rotate(${hand} 50 57)`}>
        <line x1={50} y1={62} x2={50} y2={36} stroke={accent} strokeWidth={4.5} strokeLinecap="round" />
      </g>
      <circle cx={50} cy={57} r={4.5} fill={INK} />
      {frozen ? (
        <>
          <path d="M22 78 L26 92 L30 80 L35 90 L39 82 M60 82 L65 94 L69 83 L74 89 L78 77" fill="#E6F8FF" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M26 40 Q32 30 44 27" stroke="#FFFFFF" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.9} />
          <path d="M70 60 l6 0 M73 57 l0 6 M71 58 l4 4 M75 58 l-4 4" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </>
      ) : (
        <path d="M26 44 Q31 33 42 29" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
      )}
    </svg>
  );
};

/** An apple floating above its shadow, with little lift lines. */
export const FloatingAppleIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const bob = Math.sin(frame * 0.12) * 6;
  const tilt = Math.sin(frame * 0.08) * 10;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <ellipse cx={50} cy={90} rx={18 - bob * 0.6} ry={4} fill="rgba(20,30,80,0.3)" />
      <g stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" opacity={0.9}>
        <line x1={34} y1={80 + bob * 0.5} x2={34} y2={72 + bob * 0.5} />
        <line x1={50} y1={83 + bob * 0.5} x2={50} y2={74 + bob * 0.5} />
        <line x1={66} y1={80 + bob * 0.5} x2={66} y2={72 + bob * 0.5} />
      </g>
      <g transform={`translate(0 ${bob - 6}) rotate(${tilt} 50 46)`}>
        <Outlined w={6}>
          <path d="M50 28 C62 18 82 24 80 46 C78 64 64 74 56 70 C53 69 47 69 44 70 C36 74 22 64 20 46 C18 24 38 18 50 28 Z" fill="#E63946" />
          <path d="M51 28 C54 20 60 16 66 14 C68 22 60 28 51 28 Z" fill="#5CC24A" />
        </Outlined>
        <path d="M50 28 L47 16" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <ellipse cx={33} cy={40} rx={5} ry={8} fill="#FFFFFF" opacity={0.6} transform="rotate(20 33 40)" />
      </g>
    </svg>
  );
};

/** Sun with a big red cross over it. */
export const NoSunIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const rays = [];
  for (let i = 0; i < 10; i++) {
    const a = i * 36 + frame * 0.6;
    rays.push(<path key={i} d="M-6 -30 L0 -44 L6 -30 Z" transform={`rotate(${a})`} fill="#FFB703" stroke={INK} strokeWidth={4} strokeLinejoin="round" />);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
      <g transform="translate(50 50)">
        {rays}
        <circle r={26} fill="#FFD23F" stroke={INK} strokeWidth={5} />
        <circle cx={-9} cy={-9} r={6} fill="#FFF4B8" />
      </g>
      <path d="M20 20 L80 80 M80 20 L20 80" stroke={INK} strokeWidth={20} strokeLinecap="round" />
      <path d="M20 20 L80 80 M80 20 L20 80" stroke="#FF3B30" strokeWidth={11} strokeLinecap="round" />
    </svg>
  );
};

/** Black hole: swirling accretion disc around a dark core. */
export const BlackHoleIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const arms = [];
  const colors = ["#FF9A3C", "#C77DFF", "#FFD23F", "#7B2FF7"];
  for (let i = 0; i < 4; i++) {
    arms.push(
      <path
        key={i}
        d="M0 -40 C24 -38 38 -18 34 4 C30 22 16 30 4 28"
        stroke={colors[i]}
        strokeWidth={7 - i}
        fill="none"
        strokeLinecap="round"
        transform={`rotate(${i * 90 + frame * 5})`}
        opacity={0.95}
      />,
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <g transform="translate(50 50)">
        {arms}
        <circle r={19} fill="#FFB86B" opacity={0.9} />
        <circle r={16} fill="#050208" stroke={INK} strokeWidth={3} />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = frame * 0.12 + i * 1.3;
          const r = 30 - ((frame * 0.4 + i * 9) % 18);
          return <circle key={i} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={1.8} fill="#FFFFFF" />;
        })}
      </g>
    </svg>
  );
};

/** Crossed-out O2 molecule badge. */
export const NoO2Icon: React.FC<IconProps> = ({ size = 80, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <circle cx={50} cy={50} r={42} fill="#7FE3C3" stroke={INK} strokeWidth={6} />
    <circle cx={37} cy={50} r={14} fill="#FFFFFF" stroke={INK} strokeWidth={5} />
    <circle cx={63} cy={50} r={14} fill="#FFFFFF" stroke={INK} strokeWidth={5} />
    <circle cx={32} cy={45} r={4} fill="#DFF7EF" />
    <path d="M20 20 L80 80" stroke={INK} strokeWidth={16} strokeLinecap="round" />
    <path d="M20 20 L80 80" stroke="#FF3B30" strokeWidth={9} strokeLinecap="round" />
  </svg>
);

// =============================================================================================
// O2Gauge

const G_MAX = 25;
const G_SWEEP = 120; // degrees each side of 12 o'clock
const gAngle = (v: number) => -G_SWEEP + (Math.max(0, Math.min(G_MAX, v)) / G_MAX) * 2 * G_SWEEP;
const arcPath = (r: number, v1: number, v2: number) => {
  const a1 = gAngle(v1);
  const a2 = gAngle(v2);
  const [x1, y1] = polar(r, a1);
  const [x2, y2] = polar(r, a2);
  return `M${x1} ${y1} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

/**
 * Big analogue O2 dial (0-25 %) with a red needle and a digital readout plate. Reads `from`
 * (21 %) until `dropAt`, falls to `to` (0 %) over `dropDur`, then the needle rattles against
 * the stop, the readout turns red and blinks and the dial glows red; from `riseAt` it climbs
 * back to `from` over `riseDur` and turns green. `x`, `y` = dial centre; at scale 1 the block
 * spans x ± 290 and y - 290 … y + 340.
 */
export const O2Gauge: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  scale?: number;
  from?: number;
  to?: number;
  dropAt: number;
  dropDur?: number;
  riseAt?: number;
  riseDur?: number;
}> = ({ frame, at, out, x, y, scale = 1, from = 21, to = 0, dropAt, dropDur = 24, riseAt, riseDur = 30 }) => {
  const uid = useUid();
  if (frame < at || frame > out + 10) return null;
  const pIn = pop(frame, at, { damping: 10, stiffness: 190 });
  const k = ramp(frame, out, out + 9, [0, 1], EASE_IN);
  const hitAt = dropAt + dropDur;
  const rising = riseAt !== undefined && frame >= riseAt;
  let v = from;
  if (frame >= dropAt) v = interpolate(frame, [dropAt, hitAt], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_OUT });
  if (rising && riseAt !== undefined) v = interpolate(frame, [riseAt, riseAt + riseDur], [to, from], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  const dropping = frame >= dropAt && frame < hitAt;
  const empty = frame >= hitAt && !rising;
  const recovered = rising;
  // Needle: jitter while falling, a hard rattle when it slams into the 0 stop, then a tremble.
  let jitter = 0;
  if (dropping) jitter = Math.sin(frame * 2.1) * 2.5;
  if (empty) {
    const d = frame - hitAt;
    jitter = Math.abs(Math.sin(d * 1.7)) * 12 * Math.exp(-d / 9) + Math.abs(Math.sin(frame * 3.1)) * 1.6;
  }
  if (rising && riseAt !== undefined) {
    const d = frame - (riseAt + riseDur);
    if (d >= 0) jitter = -Math.sin(d * 1.2) * 6 * Math.exp(-d / 6);
  }
  const needle = gAngle(v) + jitter;
  // Body jolt at impact.
  const jolt = empty ? Math.sin((frame - hitAt) * 2.4) * 10 * Math.exp(-(frame - hitAt) / 6) : 0;
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.45);
  const glow = empty ? 0.55 + 0.45 * pulse : recovered ? 0.6 * (1 - ramp(frame, (riseAt ?? 0) + riseDur, (riseAt ?? 0) + riseDur + 30)) + 0.25 : 0;
  const glowColor = empty ? `rgba(255,40,40,${glow})` : `rgba(60,255,120,${glow})`;
  const lit = empty ? blink(frame, hitAt, 8, 5) : 1;
  const readColors = empty
    ? ["#FFE3E3", "#FF5A5A", "#D0001A"]
    : recovered
      ? ["#F0FFE8", "#7CFF6B", "#16B03A"]
      : ["#FFFFFF", "#D9FFF1", "#7FE3C3"];
  const readBump = empty ? bump(frame, hitAt, 8) : recovered && riseAt !== undefined ? bump(frame, riseAt + riseDur, 8) : 0;
  const shown = Math.round(v);

  const ticks = [];
  for (let i = 0; i <= G_MAX; i++) {
    const major = i % 5 === 0;
    const [x1, y1] = polar(major ? 184 : 198, gAngle(i));
    const [x2, y2] = polar(222, gAngle(i));
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={major ? 8 : 4} strokeLinecap="round" />);
    if (major) {
      const [tx, ty] = polar(150, gAngle(i));
      ticks.push(
        <text key={`t${i}`} x={tx} y={ty + 13} textAnchor="middle" fontFamily={FONT.title} fontSize={40} fill={INK}>
          {i}
        </text>,
      );
    }
  }
  const [ax, ay] = polar(236, gAngle(21));

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `translate(${jolt}px, ${Math.abs(jolt) * 0.4}px) scale(${pIn * (1 - k) * scale}) rotate(${(1 - pIn) * -18}deg)`,
      }}
    >
      <svg
        width={640}
        height={640}
        viewBox="-320 -320 640 640"
        style={{ position: "absolute", left: -320, top: -320, overflow: "visible", filter: glow > 0 ? `drop-shadow(0 0 ${30 + 30 * glow}px ${glowColor})` : undefined }}
      >
        <defs>
          <linearGradient id={`bez${uid}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#F4F8FB" />
            <stop offset="0.5" stopColor="#B9C5D1" />
            <stop offset="1" stopColor="#7C8A99" />
          </linearGradient>
          <radialGradient id={`face${uid}`} cx="0.45" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor={empty ? "#FFD9D9" : "#DDF5EC"} />
          </radialGradient>
        </defs>
        <circle cx={0} cy={14} r={284} fill="rgba(0,0,0,0.35)" />
        <circle r={282} fill={`url(#bez${uid})`} stroke={INK} strokeWidth={10} />
        <circle r={248} fill={`url(#face${uid})`} stroke={INK} strokeWidth={7} />
        {/* coloured zones */}
        <path d={arcPath(210, 0, 8)} stroke="#FF3B30" strokeWidth={26} fill="none" />
        <path d={arcPath(210, 8, 15)} stroke="#FFB703" strokeWidth={26} fill="none" />
        <path d={arcPath(210, 15, 25)} stroke="#39D353" strokeWidth={26} fill="none" />
        {ticks}
        {/* "air" marker at 21 % */}
        <g transform={`translate(${ax} ${ay}) rotate(${gAngle(21)})`}>
          <path d="M0 -4 L-13 -26 L13 -26 Z" fill="#1E6BFF" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </g>
        {/* label */}
        <text x={-16} y={150} textAnchor="middle" fontFamily={FONT.title} fontSize={100} fill={INK}>
          O
        </text>
        <text x={31} y={174} textAnchor="middle" fontFamily={FONT.title} fontSize={56} fill={INK}>
          2
        </text>
        {/* needle */}
        <g transform={`rotate(${needle})`}>
          <path d="M0 -206 L13 0 L7 40 L-7 40 L-13 0 Z" fill={INK} transform="translate(4 8)" opacity={0.25} />
          <path d="M0 -206 L13 0 L7 40 L-7 40 L-13 0 Z" fill="#FF3B30" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <path d="M0 -196 L4 -20 L-4 -20 Z" fill="#FF9A8F" />
        </g>
        <circle r={30} fill="#5B6573" stroke={INK} strokeWidth={7} />
        <circle r={12} fill="#D5DBE6" />
        {/* glass highlight */}
        <path d="M-196 -90 A214 214 0 0 1 -60 -206" stroke="#FFFFFF" strokeWidth={16} fill="none" strokeLinecap="round" opacity={0.7} />
      </svg>
      {/* digital readout plate */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 232,
          transform: `translate(-50%, 0) scale(${1 + 0.1 * readBump}) rotate(${Math.sin(frame * 3.3) * (dropping ? 1.5 : 0)}deg)`,
          width: 330,
          height: 138,
          borderRadius: 34,
          background: "linear-gradient(180deg, #1B2A33 0%, #0B141A 100%)",
          border: "9px solid #FFFFFF",
          boxShadow: `0 0 0 6px ${INK}, 0 14px 0 6px rgba(0,0,0,0.3)${empty ? `, 0 0 ${40 * pulse}px 16px rgba(255,40,40,0.6)` : ""}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <div style={{ opacity: lit ? 1 : 0.3, display: "flex", alignItems: "flex-end", marginTop: 14 }}>
          <HeavyText text={`${shown}`} size={104} colors={readColors} />
          <HeavyText text="%" size={70} colors={readColors} style={{ marginLeft: 10, marginBottom: 4 }} />
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// AlarmOverlay

/** Rotating siren dome (two beams are drawn by the overlay). */
const Beacon: React.FC<{ frame: number; x: number; y: number; on: number }> = ({ frame, x, y, on }) => (
  <svg width={140} height={130} viewBox="-70 -90 140 130" style={{ position: "absolute", left: x - 70, top: y - 90, overflow: "visible" }}>
    <circle cx={0} cy={-30} r={70} fill={`rgba(255,60,60,${0.35 * on})`} />
    <path d="M-40 10 L-40 -30 C-40 -62 40 -62 40 -30 L40 10 Z" fill="#FF2A2A" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
    <path d={`M${-26 + Math.sin(frame * 0.5) * 14} -44 L${-18 + Math.sin(frame * 0.5) * 14} -8`} stroke="#FFE1E1" strokeWidth={9} strokeLinecap="round" opacity={0.6 + 0.4 * on} />
    <rect x={-54} y={6} width={108} height={24} rx={8} fill="#3A4350" stroke={INK} strokeWidth={7} />
  </svg>
);

/**
 * Full-frame red alarm between `from` and `to`: pulsing red edge glow and vignette, two
 * rotating siren beams from beacons in the top corners, and a flashing hazard banner
 * "¡ALERTA: SIN OXÍGENO!" centred at y ≈ 260 (y 180 … 345). The middle stays mostly clear.
 */
export const AlarmOverlay: React.FC<{ frame: number; from: number; to: number; intensity?: number; bannerY?: number }> = ({
  frame,
  from,
  to,
  intensity = 1,
  bannerY = 260,
}) => {
  if (frame < from || frame > to) return null;
  const w = windowIn(frame, from, to, 8) * intensity;
  const t = frame - from;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.42 - Math.PI / 2);
  const flash = blink(frame, from, 8, 7);
  const bIn = pop(frame, from + 2, { damping: 11, stiffness: 200 });
  const bOut = ramp(frame, to - 8, to, [0, 1], EASE_IN);
  const beams = [];
  const beacons = [
    { x: 96, y: 150, a0: 0 },
    { x: 984, y: 150, a0: 180 },
  ];
  for (let b = 0; b < beacons.length; b++) {
    const bc = beacons[b];
    for (let j = 0; j < 2; j++) {
      const a = bc.a0 + (b ? -1 : 1) * t * 9 + j * 180;
      beams.push(
        <g key={`${b}${j}`} transform={`translate(${bc.x} ${bc.y - 30}) rotate(${a})`}>
          <path d="M0 0 L1500 -170 L1500 170 Z" fill="url(#alarmBeam)" />
        </g>,
      );
    }
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* tint + vignette */}
      <AbsoluteFill style={{ background: `rgba(255,0,20,${0.08 * pulse * w})` }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 62% at 50% 48%, rgba(255,0,20,0) 52%, rgba(200,0,20,${(0.3 + 0.4 * pulse) * w}) 100%)`,
        }}
      />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${70 + 70 * pulse}px ${18 + 20 * pulse}px rgba(255,30,30,${(0.55 + 0.35 * pulse) * w})` }} />
      {/* rotating beams */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 0.38 * w, mixBlendMode: "screen" }}>
        <defs>
          <linearGradient id="alarmBeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FF6A6A" stopOpacity={1} />
            <stop offset="0.6" stopColor="#FF2020" stopOpacity={0.35} />
            <stop offset="1" stopColor="#FF2020" stopOpacity={0} />
          </linearGradient>
        </defs>
        {beams}
      </svg>
      <div style={{ opacity: Math.min(1, w * 1.5) }}>
        <Beacon frame={frame} x={96} y={150} on={flash} />
        <Beacon frame={frame + 7} x={984} y={150} on={1 - flash} />
      </div>
      {/* banner */}
      <div
        style={{
          position: "absolute",
          left: 540,
          top: bannerY,
          width: 0,
          height: 0,
          transform: `scale(${bIn * (1 - bOut)}) rotate(${-2 + Math.sin(t * 0.9) * 0.6}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -470,
            top: -82,
            width: 940,
            height: 164,
            borderRadius: 26,
            background: `repeating-linear-gradient(-45deg, #FFD60A 0px, #FFD60A 26px, ${INK} 26px, ${INK} 52px)`,
            border: `7px solid ${INK}`,
            boxSizing: "border-box",
            boxShadow: `0 14px 0 rgba(0,0,0,0.35), 0 0 ${40 + 50 * pulse}px rgba(255,40,40,${0.8 * w})`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 20,
              bottom: 20,
              background: flash ? "linear-gradient(180deg, #FF4545 0%, #D90016 100%)" : "linear-gradient(180deg, #D90016 0%, #9E0010 100%)",
              borderTop: `6px solid ${INK}`,
              borderBottom: `6px solid ${INK}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ marginTop: 16, transform: `scale(${1 + 0.05 * flash})` }}>
              <HeavyText text="¡ALERTA: SIN OXÍGENO!" size={78} colors={flash ? ["#FFFFFF", "#FFFFFF", "#FFE45C"] : ["#FFFFFF", "#FFE0E0", "#FFB3B3"]} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================================
// NoO2Badge

/**
 * Small HUD pill "SIN O2" with a blinking red dot and a crossed-out O2 molecule, visible
 * between `from` and `to`. `x`, `y` = pill centre; it is about 400 x 116 px.
 */
export const NoO2Badge: React.FC<{ frame: number; from: number; to: number; x: number; y: number; scale?: number }> = ({ frame, from, to, x, y, scale = 1 }) => {
  if (frame < from || frame > to + 8) return null;
  const p = pop(frame, from, { damping: 11, stiffness: 210 });
  const k = ramp(frame, to, to + 7, [0, 1], EASE_IN);
  const on = blink(frame, from, 8, 7);
  const wob = bump(frame, from + 30 * Math.floor((frame - from) / 30), 8);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${p * (1 - k) * scale * (1 + 0.04 * wob)})`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 30px 12px 18px",
        borderRadius: 999,
        background: "linear-gradient(180deg, rgba(40,8,12,0.92) 0%, rgba(20,4,6,0.92) 100%)",
        border: "6px solid #FF3B30",
        boxShadow: `0 0 0 5px ${INK}, 0 10px 0 5px rgba(0,0,0,0.3), 0 0 ${24 + 20 * on}px rgba(255,40,40,0.7)`,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: on ? "#FF3B30" : "#5A1A1A",
          border: "4px solid #FFFFFF",
          boxShadow: on ? "0 0 18px 6px rgba(255,60,60,0.9)" : "none",
        }}
      />
      <NoO2Icon size={80} />
      <div
        style={{
          fontFamily: FONT.title,
          fontSize: 62,
          lineHeight: 1,
          color: "#FFFFFF",
          paddingTop: 8,
          textShadow: "0 4px 0 rgba(0,0,0,0.6)",
        }}
      >
        SIN O<Sub2 />
      </div>
    </div>
  );
};

// =============================================================================================
// PressurePop

/**
 * Comic "¡POP!" for the ears popping: a spiky yellow burst, three shock rings, speed lines and
 * sparkles, ~34 frames from `at`. `x`, `y` = centre; the burst is ~520 px wide, rings reach
 * ~r 420.
 */
export const PressurePop: React.FC<{ frame: number; at: number; x: number; y: number; scale?: number; text?: string }> = ({
  frame,
  at,
  x,
  y,
  scale = 1,
  text = "¡POP!",
}) => {
  const d = frame - at;
  if (d < 0 || d > 34) return null;
  const pIn = pop(frame, at, { damping: 8, stiffness: 260, mass: 0.6 });
  const outK = ramp(frame, at + 26, at + 34, [0, 1], EASE_IN);
  const els = [];
  // shock rings
  for (let i = 0; i < 3; i++) {
    const di = d - i * 4;
    if (di < 0 || di > 18) continue;
    const t = di / 18;
    const r = 150 + 300 * (1 - Math.pow(1 - t, 3));
    els.push(<circle key={`r${i}`} r={r} fill="none" stroke={i === 1 ? "#FFD60A" : "#FFFFFF"} strokeWidth={20 * (1 - t)} opacity={1 - t * 0.8} />);
  }
  // speed lines
  const tl = clamp01(d / 16);
  const e = 1 - Math.pow(1 - tl, 2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 360 + 11;
    const r0 = 190 + 230 * e + (i % 2) * 30;
    const len = 110 * (1 - tl) + 10;
    const [x1, y1] = polar(r0, a);
    const [x2, y2] = polar(r0 + len, a);
    if (tl >= 1) continue;
    els.push(<line key={`k${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={18 * (1 - tl) + 4} strokeLinecap="round" />);
    els.push(<line key={`l${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeWidth={10 * (1 - tl) + 1} strokeLinecap="round" />);
  }
  // sparkles
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 360 + 30 + rand(i + 3) * 20;
    const r = 200 + 220 * e * (0.7 + rand(i) * 0.5);
    const [sx, sy] = polar(r, a);
    const s = (1 - tl) * (12 + rand(i + 9) * 10);
    if (s <= 0.5) continue;
    els.push(
      <path
        key={`s${i}`}
        d={`M${sx} ${sy - s * 2} Q${sx} ${sy} ${sx + s * 2} ${sy} Q${sx} ${sy} ${sx} ${sy + s * 2} Q${sx} ${sy} ${sx - s * 2} ${sy} Q${sx} ${sy} ${sx} ${sy - s * 2} Z`}
        fill={i % 2 ? "#FFD60A" : "#4FE3FF"}
        stroke={INK}
        strokeWidth={3}
      />,
    );
  }
  // starburst
  const pts = [];
  const n = 18;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 250 + rand(i) * 40 : 180 + rand(i + 40) * 16;
    pts.push(polar(r, (i / (n * 2)) * 360));
  }
  const star = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + " Z";
  const s = pIn * (1 - outK) * scale;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }}>
      <svg width={1000} height={1000} viewBox="-500 -500 1000 1000" style={{ position: "absolute", left: -500, top: -500, overflow: "visible", transform: `scale(${scale})` }}>
        {els}
      </svg>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${s}) rotate(${-8 + (1 - pIn) * 30}deg)` }}>
        <svg width={620} height={620} viewBox="-310 -310 620 620" style={{ position: "absolute", left: -310, top: -310, overflow: "visible" }}>
          <path d={star} fill={INK} transform="translate(0 16)" opacity={0.35} />
          <path d={star} fill="#FFD60A" stroke={INK} strokeWidth={12} strokeLinejoin="round" />
          <path d={star} fill="#FF8A00" transform="scale(0.78)" />
          <path d={star} fill="#FFE45C" transform="scale(0.6)" />
        </svg>
        <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(-50%, -50%) scale(${1 + 0.15 * bump(frame, at + 2, 10)})` }}>
          <HeavyText text={text} size={150} colors={["#FFFFFF", "#FFD3E4", "#FF2D6F"]} style={{ marginTop: 8 }} />
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// StatusCard

const TONES = {
  red: "linear-gradient(135deg, #FF5A5A 0%, #D90429 100%)",
  green: "linear-gradient(135deg, #3DDC84 0%, #0E9F6E 100%)",
  blue: "linear-gradient(135deg, #43A6FF 0%, #1E4BD6 100%)",
} as const;

/**
 * Status card: white-rimmed gradient pill with an icon disc, a title ("FUEGO: APAGADO"),
 * an optional sub line and a stamped check / cross badge (red = cross, green = check, blue =
 * none unless `mark` is given). Red tone draws the icon "off" (fire out, burnt match, pale
 * lungs, smoking engine). `x`, `y` = card centre; width grows with the text (~700-940 px for
 * the usual titles, ~150 px tall; ~180 with a sub).
 */
export const StatusCard: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  icon: StatusIcon;
  title: string;
  sub?: string;
  tone?: "red" | "green" | "blue";
  mark?: "check" | "cross" | "none";
  scale?: number;
  rotate?: number;
}> = ({ frame, at, out, x, y, icon, title, sub, tone = "red", mark, scale = 1, rotate = -2 }) => {
  if (frame < at || frame > out + 8) return null;
  const p = pop(frame, at, { damping: 10, stiffness: 200 });
  const k = ramp(frame, out, out + 7, [0, 1], EASE_IN);
  const m = mark ?? (tone === "red" ? "cross" : tone === "green" ? "check" : "none");
  const pm = pop(frame, at + 9, { damping: 8, stiffness: 240 });
  const slam = bump(frame, at + 9, 7);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${p * (1 - k) * scale * (1 + 0.03 * slam)}) rotate(${rotate * (1 - p * 0.3) + (1 - p) * -10}deg)`,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "16px 22px 16px 18px",
        borderRadius: 34,
        background: TONES[tone],
        border: "7px solid #FFFFFF",
        boxShadow: `0 0 0 5px ${INK}, 0 14px 0 5px rgba(0,0,0,0.3), 0 26px 50px rgba(0,0,0,0.3)`,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          width: 124,
          height: 124,
          borderRadius: "50%",
          background: tone === "red" ? "#FFE9E9" : "#FFFFFF",
          border: `6px solid ${INK}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <StatusIconView icon={icon} frame={frame} off={tone === "red"} size={100} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", paddingRight: m === "none" ? 18 : 0 }}>
        <div
          style={{
            fontFamily: FONT.title,
            fontSize: 62,
            lineHeight: 1,
            color: "#FFFFFF",
            paddingTop: 10,
            textShadow: `0 5px 0 rgba(0,0,0,0.35)`,
            WebkitTextStroke: `10px ${INK}`,
            paintOrder: "stroke fill",
          }}
        >
          {title}
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: FONT.heavy,
              fontWeight: 900,
              fontSize: 34,
              letterSpacing: 1,
              color: "#FFFFFF",
              marginTop: 6,
              textShadow: "0 3px 0 rgba(0,0,0,0.3)",
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      {m !== "none" ? (
        <div style={{ width: 92, height: 92, flexShrink: 0, transform: `scale(${pm}) rotate(${(1 - pm) * -90}deg)` }}>
          <MarkBadge kind={m} size={92} />
        </div>
      ) : null}
    </div>
  );
};

// =============================================================================================
// ExperimentCTA

const EXPERIMENTS: { label: string; bg: string; icon: (frame: number) => React.ReactNode }[] = [
  { label: "SIN GRAVEDAD", bg: "radial-gradient(circle at 50% 30%, #EAF3FF 0%, #8FB8FF 100%)", icon: (f) => <FloatingAppleIcon size={140} frame={f} /> },
  { label: "TIEMPO\nCONGELADO", bg: "radial-gradient(circle at 50% 30%, #F2FCFF 0%, #7FD6F5 100%)", icon: (f) => <StopwatchIcon size={138} frame={f} frozen /> },
  { label: "SIN SOL", bg: "radial-gradient(circle at 50% 30%, #4A5A9E 0%, #151B40 100%)", icon: (f) => <NoSunIcon size={124} frame={f} /> },
  { label: "AGUJERO\nNEGRO", bg: "radial-gradient(circle at 50% 50%, #6A33B0 0%, #12051F 100%)", icon: (f) => <BlackHoleIcon size={160} frame={f} /> },
];

const EXP_POS = [
  { x: -320, y: -205 },
  { x: 320, y: -180 },
  { x: -330, y: 215 },
  { x: 335, y: 240 },
];

const autoLines = (title: string) => {
  if (title.indexOf("\n") >= 0) return title.split("\n");
  if (title.length <= 12) return [title];
  const mid = title.length / 2;
  let best = -1;
  for (let i = 0; i < title.length; i++) {
    if (title[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best < 0 ? [title] : [title.slice(0, best), title.slice(best + 1)];
};

/**
 * Call to action in the style of the Inca short's CommentsCTA: big comment button tapped by a
 * hand (ripples, counter ticking up), four experiment bubbles popping in one by one ("SIN
 * GRAVEDAD", "TIEMPO CONGELADO", "SIN SOL", "AGUJERO NEGRO") and a two-line title above.
 * `x`, `y` = button centre; the block spans about x ± 450 and y - 470 … y + 420, so y ≈ 700
 * keeps it inside the safe area.
 */
export const ExperimentCTA: React.FC<{
  frame: number;
  at: number;
  x: number;
  y: number;
  title?: string;
  titleOffset?: { x: number; y: number };
  countTo?: number;
  scale?: number;
  out?: number;
}> = ({ frame, at, x, y, title = "¿QUÉ PRUEBO AHORA?", titleOffset = { x: 0, y: -350 }, countTo = 3120, scale = 1, out }) => {
  if (frame < at) return null;
  if (out !== undefined && frame > out + 12) return null;
  const t = frame - at;
  const exitK = out !== undefined ? ramp(frame, out, out + 10, [0, 1], EASE_IN) : 0;
  const btnIn = pop(frame, at, { damping: 10, stiffness: 190 });
  const taps = [at + 30, at + 56, at + 82, at + 108, at + 134, at + 160];
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
  const handIn = pop(frame, at + 14, { damping: 13, stiffness: 150 });
  const count = Math.round(countTo * ramp(frame, at + 8, at + 70, [0, 1], EASE_OUT));
  const countBump = lastTap >= 0 ? bump(frame, lastTap, 8) : 0;
  const lines = autoLines(title);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${scale * (1 - exitK)})`, pointerEvents: "none" }}>
      {lines.map((line, i) => {
        const p = pop(frame, at + 2 + i * 5, { damping: 10, stiffness: 180 });
        const n = lines.length;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: titleOffset.x,
              top: titleOffset.y + (i - (n - 1) / 2) * 116,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(i % 2 ? 2.5 : -2.5) * (0.6 + 0.4 * (1 - p)) + Math.sin(t * 0.08 + i) * 0.8}deg)`,
            }}
          >
            <HeavyText text={line} size={112} colors={["#FFFFFF", "#E9FFF7", "#7FE3C3"]} />
          </div>
        );
      })}
      {EXPERIMENTS.map((ex, i) => {
        const pos = EXP_POS[i];
        const p = pop(frame, at + 20 + i * 11, { damping: 9, stiffness: 180 });
        if (p <= 0.001) return null;
        const bob = Math.sin(t * 0.09 + i * 1.7) * 12;
        const ang = Math.atan2(-pos.y, -pos.x);
        return (
          <div
            key={ex.label}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y + bob,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(1 - p) * (i % 2 ? 25 : -25) + Math.sin(t * 0.07 + i) * 3}deg)`,
            }}
          >
            <svg width={240} height={240} viewBox="-120 -120 240 240" style={{ position: "absolute", left: -20, top: -20, overflow: "visible" }}>
              <g transform={`rotate(${(ang * 180) / Math.PI})`}>
                <path d="M88 -26 L132 0 L88 26 Z" fill="#FFFFFF" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
              </g>
            </svg>
            <div
              style={{
                position: "relative",
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: "#FFFFFF",
                border: `7px solid ${INK}`,
                boxSizing: "border-box",
                boxShadow: "0 10px 0 rgba(0,0,0,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 172,
                  height: 172,
                  borderRadius: "50%",
                  background: ex.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {ex.icon(frame)}
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 100,
                top: 204,
                transform: "translateX(-50%)",
                padding: "6px 18px 4px",
                borderRadius: 14,
                background: INK,
                fontFamily: FONT.heavy,
                fontWeight: 900,
                fontSize: 30,
                lineHeight: 1.1,
                letterSpacing: 1,
                color: "#FFFFFF",
                whiteSpace: "pre",
                textAlign: "center",
                boxShadow: "0 5px 0 rgba(0,0,0,0.25)",
              }}
            >
              {ex.label}
            </div>
          </div>
        );
      })}
      {rip >= 0 ? (
        <div
          style={{
            position: "absolute",
            left: -140,
            top: -140,
            width: 280,
            height: 280,
            borderRadius: "50%",
            border: `${14 * (1 - rip)}px solid #FFFFFF`,
            transform: `scale(${1 + rip * 0.9})`,
            opacity: 1 - rip,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: -140,
          top: -140,
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "linear-gradient(145deg, #7FE3C3 0%, #1FB58F 55%, #0E7C9A 100%)",
          border: "12px solid #FFFFFF",
          boxSizing: "border-box",
          boxShadow: "0 14px 0 rgba(0,0,0,0.3), 0 28px 50px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${btnIn * (1 - 0.12 * squish)}) rotate(${(1 - btnIn) * -30}deg)`,
        }}
      >
        <CommentBubbleIcon size={180} dot="#15A07C" frame={frame} style={{ marginTop: 10 }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 236,
          transform: `translate(-50%, -50%) scale(${btnIn * (1 + 0.18 * countBump)})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <HeavyText text={fmtNumber(count)} size={88} colors={["#FFFFFF", "#E9FFF7", "#9BF0D4"]} />
        <div
          style={{
            marginTop: 18,
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: 2,
            color: "#FFFFFF",
            WebkitTextStroke: `8px ${INK}`,
            paintOrder: "stroke fill",
          }}
        >
          COMENTARIOS
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 32,
          transformOrigin: "0 0",
          transform: `translate(${(1 - handIn) * 420 - handPush * 26}px, ${(1 - handIn) * 190 - handPush * 12}px) rotate(-66deg) scale(${1 - 0.06 * handPush})`,
          opacity: Math.min(1, handIn * 2),
        }}
      >
        <HandPointer size={210} style={{ marginLeft: -84, marginTop: -6 }} />
      </div>
    </div>
  );
};

// =============================================================================================
// Countdown5

/**
 * "5 SEGUNDOS" stamp that slams in at `at` (drops from 2.6x, impact at at + 7 with a dust
 * ring and a wobble) with a ticking stopwatch sticker on its corner. `x`, `y` = plate centre;
 * the plate is ~640 x 420 px.
 */
export const Countdown5: React.FC<{ frame: number; at: number; x: number; y: number; out?: number; scale?: number }> = ({ frame, at, x, y, out, scale = 1 }) => {
  const d = frame - at;
  if (d < 0) return null;
  if (out !== undefined && frame > out + 9) return null;
  const IMPACT = 7;
  const s0 = d < IMPACT ? interpolate(d, [0, IMPACT], [2.6, 1], { easing: EASE_IN, extrapolateRight: "clamp" }) : 1 + 0.09 * Math.sin((d - IMPACT) * 0.95) * Math.exp(-(d - IMPACT) / 5);
  const op = ramp(frame, at, at + 3);
  const k = out !== undefined ? ramp(frame, out, out + 8, [0, 1], EASE_IN) : 0;
  const dust = d - IMPACT;
  const sw = pop(frame, at + IMPACT + 3, { damping: 9, stiffness: 220 });
  const shx = dust >= 0 && dust < 10 ? Math.sin(dust * 3) * 10 * (1 - dust / 10) : 0;
  const dustEls = [];
  if (dust >= 0 && dust < 20) {
    const tt = dust / 20;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(i) * 0.3;
      const r = 300 + 170 * (1 - Math.pow(1 - tt, 2)) + rand(i + 5) * 30;
      dustEls.push(<circle key={i} cx={Math.cos(a) * r * 1.15} cy={Math.sin(a) * r * 0.8} r={(22 + rand(i + 2) * 18) * (1 - tt)} fill="#FFFFFF" opacity={0.85 * (1 - tt)} stroke={INK} strokeWidth={4 * (1 - tt)} />);
    }
  }
  return (
    <div style={{ position: "absolute", left: x + shx, top: y, width: 0, height: 0, opacity: op, transform: `scale(${scale * (1 - k)})` }}>
      <svg width={1200} height={1000} viewBox="-600 -500 1200 1000" style={{ position: "absolute", left: -600, top: -500, overflow: "visible" }}>
        {dustEls}
      </svg>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${s0}) rotate(-6deg)` }}>
        <div
          style={{
            position: "absolute",
            left: -320,
            top: -205,
            width: 640,
            height: 410,
            borderRadius: 44,
            background: "linear-gradient(160deg, #FF5A5A 0%, #E0122E 55%, #A0001A 100%)",
            border: "12px solid #FFFFFF",
            boxSizing: "border-box",
            boxShadow: `0 0 0 7px ${INK}, 0 18px 0 7px rgba(0,0,0,0.35), 0 30px 60px rgba(0,0,0,0.35)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ marginTop: 26 }}>
            <HeavyText text="5" size={250} colors={["#FFFBD1", "#FFD21F", "#FF9500"]} />
          </div>
          <div style={{ marginTop: -6 }}>
            <HeavyText text="SEGUNDOS" size={96} colors={["#FFFFFF", "#FFFFFF", "#FFD6D6"]} />
          </div>
        </div>
        <div style={{ position: "absolute", left: -330, top: -270, transform: `translate(-50%, 0) scale(${sw}) rotate(${-14 + (1 - sw) * -60}deg)` }}>
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "#FFD60A",
              border: `8px solid ${INK}`,
              boxSizing: "border-box",
              boxShadow: "0 10px 0 rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 100,
            }}
          >
            <StopwatchIcon size={160} frame={frame} />
          </div>
        </div>
      </div>
    </div>
  );
};
