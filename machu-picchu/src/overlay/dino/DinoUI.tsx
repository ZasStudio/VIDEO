import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, rand, windowIn } from "../../anim";
import { FONT } from "../../theme";
import { fmtNumber } from "../Graphics";
import { HeavyText } from "../inca/HeavyText";
import { CommentBubbleIcon, HandPointer, INK } from "../inca/icons";
import { MarkBadge } from "../oxigeno/OxiUI";

// 2D overlays for "¿Y si los dinosaurios nunca se hubieran extinguido?" (1080 x 1920, 30 fps).
// Same punchy look as the Inca / oxygen overlays (thick dark outlines, bold gradients, hard drop
// shadows, springy pops), a notch more compact. Everything is driven by the global `frame` plus
// explicit cue frames: no timers, no Math.random (`rand`), no CSS animations, no emoji (all
// icons are inline SVG).
// TikTok safe zone of this video: keep content inside x 60-940, y 230-1250 (top bar above
// y 200, button column right of x 950 from y 700 down, captions at y 1260-1420, description
// below y 1400). Each component's doc comment gives its footprint at scale 1.

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

/** Silhouette drawn as a thick outline first, then filled on top. */
const Outlined: React.FC<{ w?: number; color?: string; children: React.ReactNode }> = ({ w = 7, color = INK, children }) => (
  <>
    <g stroke={color} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
    <g>{children}</g>
  </>
);

/** Circle as a closed path (for even-odd holes). */
const circlePath = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

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

type IconProps = { size?: number; style?: React.CSSProperties };

const RED = "#FF3B30";
const GREEN = "#39D353";
const RED_TXT = ["#FFE3E3", "#FF5A5A", "#D0001A"];
const GREEN_TXT = ["#F0FFE8", "#7CFF6B", "#16B03A"];

// =============================================================================================
// Small icons

/** Warning triangle with "!". */
const WarnIcon: React.FC<IconProps & { on?: number }> = ({ size = 44, on = 1, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path d="M50 10 L93 86 L7 86 Z" fill={on ? "#FFD60A" : "#7A6A20"} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
    <rect x={45} y={34} width={10} height={30} rx={5} fill={INK} />
    <circle cx={50} cy={74} r={6} fill={INK} />
  </svg>
);

/** Blue "verified" seal with a white check. */
const SealIcon: React.FC<IconProps> = ({ size = 60, style }) => {
  const pts: string[] = [];
  for (let i = 0; i < 32; i++) {
    const [px, py] = polar(i % 2 ? 40 : 47, (i / 32) * 360);
    pts.push(`${(50 + px).toFixed(1)},${(50 + py).toFixed(1)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <polygon points={pts.join(" ")} fill="#1E8BFF" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <circle cx={50} cy={50} r={30} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeDasharray="4 5" opacity={0.75} />
      <path d="M33 51 L45 63 L68 38" stroke={INK} strokeWidth={15} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33 51 L45 63 L68 38" stroke="#FFFFFF" strokeWidth={7.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** Three sound-wave arcs (an off-screen voice), pulsing with `frame`. */
const VoiceIcon: React.FC<IconProps & { frame?: number }> = ({ size = 34, frame = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <circle cx={18} cy={50} r={11} fill="#FFFFFF" />
    {[0, 1, 2].map((i) => {
      const a = 0.45 + 0.55 * Math.max(0, Math.sin(frame * 0.5 - i * 0.9));
      return (
        <path
          key={i}
          d={`M${36 + i * 20} ${30 - i * 10} Q${50 + i * 26} 50 ${36 + i * 20} ${70 + i * 10}`}
          stroke="#FFFFFF"
          strokeWidth={11}
          fill="none"
          strokeLinecap="round"
          opacity={a}
        />
      );
    })}
  </svg>
);

/** Round blue badge with a white person bust. */
const PersonBadge: React.FC<IconProps> = ({ size = 60, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <circle cx={50} cy={50} r={45} fill="#3A86FF" stroke={INK} strokeWidth={7} />
    <circle cx={50} cy={39} r={15} fill="#FFFFFF" />
    <path d="M23 80 C25 62 37 56 50 56 C63 56 75 62 77 80 C68 89 32 89 23 80 Z" fill="#FFFFFF" />
  </svg>
);

/** Bone (the menu's currency). */
export const BoneIcon: React.FC<IconProps & { color?: string }> = ({ size = 40, color = "#FFF4DE", style }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 100 60" style={style}>
    <Outlined w={9}>
      <circle cx={17} cy={19} r={12} fill={color} />
      <circle cx={17} cy={41} r={12} fill={color} />
      <circle cx={83} cy={19} r={12} fill={color} />
      <circle cx={83} cy={41} r={12} fill={color} />
      <rect x={17} y={20} width={66} height={20} rx={6} fill={color} />
    </Outlined>
    <path d="M26 26 L74 26" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
  </svg>
);

/** Fern leaf (menu). */
const FernIcon: React.FC<IconProps> = ({ size = 44, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Outlined w={8}>
      <path d="M50 94 C28 76 20 48 33 22 C39 10 45 5 50 3 C55 5 61 10 67 22 C80 48 72 76 50 94 Z" fill="#5CCB5F" />
    </Outlined>
    <path d="M50 90 L50 14" stroke="#2F9A48" strokeWidth={4.5} strokeLinecap="round" />
    {[24, 40, 56, 70].map((yy, i) => (
      <path
        key={yy}
        d={`M50 ${yy + 10} L${36 + i * 1.5} ${yy} M50 ${yy + 10} L${64 - i * 1.5} ${yy}`}
        stroke="#2F9A48"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
    ))}
  </svg>
);

/** Little volcano with a smoke puff (menu). */
const VolcanoIcon: React.FC<IconProps> = ({ size = 44, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
    <circle cx={62} cy={14} r={10} fill="#C3CAD4" stroke={INK} strokeWidth={5} />
    <circle cx={47} cy={21} r={8} fill="#D5DBE3" stroke={INK} strokeWidth={5} />
    <Outlined w={8}>
      <path d="M8 90 L36 36 L64 36 L92 90 Z" fill="#9B5B34" />
      <path d="M36 36 C42 30 58 30 64 36 L61 46 C57 42 53 48 49 44 C45 48 41 42 39 46 Z" fill="#FF5A1F" />
    </Outlined>
    <path d="M44 46 L40 62 M57 46 L61 58" stroke="#FF8A3D" strokeWidth={6} strokeLinecap="round" />
  </svg>
);

// =============================================================================================
// Dinosaur heads (CTA bubbles, the menu's chef)

/** Cute T-Rex head in profile, facing right; `chefHat` adds a chef's toque. */
export const TRexHead: React.FC<IconProps & { chefHat?: boolean }> = ({ size = 100, chefHat = false, style }) => {
  const teeth = [];
  for (let i = 0; i < 5; i++) {
    const tx = 52 + i * 8;
    const ty = 61.3 - (tx - 44) * 0.16;
    teeth.push(
      <path key={i} d={`M${tx - 3.2} ${ty} L${tx} ${ty + 5.5} L${tx + 3.2} ${ty} Z`} fill="#FFFFFF" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />,
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
      <Outlined w={6}>
        <path d="M16 110 C16 90 22 75 34 63 L62 68 C57 80 56 94 58 110 Z" fill="#4FC36A" />
        <path d="M24 44 C22 26 36 14 56 14 C74 14 88 22 92 34 C95 43 93 51 88 55 L44 62 C32 62 25 54 24 44 Z" fill="#4FC36A" />
        <path d="M42 58 L88 53 C89 63 80 71 64 72 C52 73 44 67 42 58 Z" fill="#45B862" />
      </Outlined>
      <ellipse cx={43} cy={92} rx={9} ry={17} fill="#B5EFA9" />
      <path d="M44 62 L88 55" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      {teeth}
      <circle cx={37} cy={29} r={3.8} fill="#3AA655" />
      <circle cx={46} cy={21} r={2.6} fill="#3AA655" />
      <circle cx={31} cy={41} r={2.8} fill="#3AA655" />
      <ellipse cx={58} cy={31} rx={8} ry={9} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
      <circle cx={60.5} cy={32.5} r={4.8} fill={INK} />
      <circle cx={62.2} cy={30.5} r={1.8} fill="#FFFFFF" />
      <path d="M47 21.5 C53 17 62 17 69 21.5" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
      <ellipse cx={86.5} cy={33} rx={2.3} ry={1.7} fill={INK} />
      <circle cx={47} cy={50} r={4.6} fill="#FF9EB0" opacity={0.75} />
      {chefHat ? (
        <g transform="rotate(-12 56 14)">
          <Outlined w={5}>
            <path d="M38 17 C29 12 32 -1 42 1 C44 -9 58 -11 63 -3 C71 -9 83 -1 78 10 C81 13 80 17 76 18 Z" fill="#FFFFFF" />
            <rect x={39} y={13} width={38} height={11} rx={3} fill="#EEF2F7" />
          </Outlined>
          <path d="M48 7 C49 3 52 1 56 1" stroke="#D0D9E4" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
};

/** Cute triceratops head (frill, three horns), facing right. */
export const TriceratopsHead: React.FC<IconProps> = ({ size = 100, style }) => {
  const bumps = [];
  for (let i = 0; i < 9; i++) {
    const [bx, by] = polar(34, -112 + i * 26);
    bumps.push(<circle key={i} cx={40 + bx} cy={48 + by} r={8} fill="#FFB23F" />);
  }
  const spots = [
    [-40, 20],
    [-8, 17],
    [24, 20],
    [-72, 18],
  ].map(([a, rr], i) => {
    const [sx, sy] = polar(rr, a);
    return <circle key={i} cx={40 + sx} cy={48 + sy} r={3.4} fill="#FF7A3D" />;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
      <Outlined w={6}>
        {bumps}
        <circle cx={40} cy={48} r={34} fill="#FFB23F" />
      </Outlined>
      <circle cx={40} cy={48} r={25} fill="#FFD27A" />
      {spots}
      <Outlined w={6}>
        <path d="M66 40 L86 12 L76 44 Z" fill="#EADBB8" />
      </Outlined>
      <Outlined w={6}>
        <path d="M26 110 C26 94 27 84 31 74 L66 74 C63 86 62 98 64 110 Z" fill="#8F7CF0" />
        <path d="M36 40 C46 30 64 30 76 40 C86 48 92 56 95 66 C90 73 80 76 70 75 L44 76 C34 74 28 64 30 54 C30 48 32 44 36 40 Z" fill="#8F7CF0" />
        <path d="M84 58 C92 57 99 63 98 72 C92 75 86 74 81 70 Z" fill="#6D5AD6" />
      </Outlined>
      <Outlined w={5}>
        <path d="M54 42 C58 30 65 18 77 6 C75 18 71 32 66 45 Z" fill="#FFF1D0" />
        <path d="M84 53 C86 47 88 43 93 38 C93 45 92 51 90 57 Z" fill="#FFF1D0" />
      </Outlined>
      <ellipse cx={62} cy={55} rx={7} ry={7.5} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
      <circle cx={64} cy={56} r={4.2} fill={INK} />
      <circle cx={65.5} cy={54.2} r={1.5} fill="#FFFFFF" />
      <circle cx={74} cy={66} r={4.2} fill="#FF9EB0" opacity={0.75} />
      <path d="M80 70 Q86 73 92 70" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </svg>
  );
};

/** Cute feathered velociraptor head (orange crest), facing right. */
export const RaptorHead: React.FC<IconProps> = ({ size = 100, style }) => {
  const teeth = [];
  for (let i = 0; i < 4; i++) {
    const tx = 67 + i * 7;
    const ty = 52.2 - (tx - 60) * 0.1;
    teeth.push(<path key={i} d={`M${tx - 2.4} ${ty} L${tx} ${ty + 4.2} L${tx + 2.4} ${ty} Z`} fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
      <Outlined w={5}>
        {[
          [42, 30, 34],
          [38, 37, 16],
          [36, 45, 0],
        ].map(([px, py, a], i) => (
          <ellipse key={i} cx={px - 14} cy={py} rx={14} ry={4.8} transform={`rotate(${a} ${px} ${py})`} fill="#FF9F1C" />
        ))}
        {[
          [34, 70, -30],
          [40, 76, -44],
          [48, 80, -60],
        ].map(([px, py, a], i) => (
          <ellipse key={`n${i}`} cx={px - 13} cy={py} rx={13} ry={5} transform={`rotate(${a} ${px} ${py})`} fill="#FF9F1C" />
        ))}
      </Outlined>
      <Outlined w={6}>
        <path d="M20 110 C20 88 26 72 38 60 L62 66 C56 78 52 92 54 110 Z" fill="#45B97C" />
        <path d="M34 46 C34 32 46 24 60 25 C74 26 88 34 95 42 C99 47 97 53 91 54 L52 60 C42 60 34 55 34 46 Z" fill="#45B97C" />
      </Outlined>
      <ellipse cx={45} cy={92} rx={7} ry={15} fill="#E6F7C9" />
      <path d="M44 31 C46 35 46 39 44 43 M38 38 C40 42 40 46 38 50" stroke="#2E8F5E" strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <path d="M60 52.5 C70 51.5 80 50.5 91 49.5" stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {teeth}
      <ellipse cx={60} cy={38} rx={7} ry={7.5} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
      <circle cx={62.5} cy={39} r={4.2} fill={INK} />
      <circle cx={63.8} cy={37.2} r={1.5} fill="#FFFFFF" />
      <path d="M50.5 29.5 L68 32.5" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={90} cy={43} rx={1.8} ry={1.3} fill={INK} />
      <circle cx={51} cy={48} r={4} fill="#FF9EB0" opacity={0.7} />
    </svg>
  );
};

/** Cute brachiosaurus: long neck, small head with the domed crest, facing right. */
export const BrachioHead: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", ...style }}>
    <Outlined w={6}>
      <path d="M12 110 C14 80 30 56 48 42 L64 52 C48 64 38 84 36 110 Z" fill="#7FC8F8" />
      <path d="M56 26 C54 13 64 5 74 9 C80 12 81 19 77 24 Z" fill="#7FC8F8" />
      <path d="M46 38 C46 26 56 18 68 18 C80 18 90 26 92 36 C94 44 88 50 80 50 L60 52 C52 50 46 45 46 38 Z" fill="#7FC8F8" />
    </Outlined>
    <path d="M30 108 C31 90 38 74 50 62" stroke="#D2F0FF" strokeWidth={7} strokeLinecap="round" fill="none" />
    <circle cx={24} cy={84} r={3.4} fill="#58AEE8" />
    <circle cx={32} cy={68} r={2.8} fill="#58AEE8" />
    <circle cx={20} cy={98} r={2.8} fill="#58AEE8" />
    <circle cx={66} cy={12} r={2.4} fill="#58AEE8" />
    <ellipse cx={68} cy={32} rx={6.5} ry={7} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
    <circle cx={70} cy={33} r={4} fill={INK} />
    <circle cx={71.3} cy={31.3} r={1.4} fill="#FFFFFF" />
    <path d="M62.5 26.5 L59.5 23.5 M65.5 25 L64 21.5" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    <path d="M76 44 Q84 48 91 42" stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    <circle cx={63} cy={43} r={4} fill="#FF9EB0" opacity={0.75} />
    <ellipse cx={75} cy={13} rx={1.8} ry={1.3} fill={INK} />
  </svg>
);

/** A scared little caveman sitting on a dinner plate (with parsley and lemon). 160 x 130 box. */
export const CavemanPlate: React.FC<IconProps & { frame?: number }> = ({ size = 150, frame = 0, style }) => {
  const shiver = Math.sin(frame * 1.7) * 0.8;
  return (
    <svg width={size} height={size * 0.8125} viewBox="0 0 160 130" style={{ overflow: "visible", ...style }}>
      <Outlined w={6}>
        <ellipse cx={80} cy={104} rx={74} ry={21} fill="#FFFFFF" />
      </Outlined>
      <ellipse cx={80} cy={101} rx={54} ry={12} fill="#E6EDF5" />
      <Outlined w={4}>
        <path d="M128 102 C121 90 129 80 142 82 C146 93 140 101 128 102 Z" fill="#5CCB5F" />
        <circle cx={24} cy={101} r={9} fill="#FFE45C" />
      </Outlined>
      <path d="M130 98 L140 86" stroke="#2F9A48" strokeWidth={2} strokeLinecap="round" />
      <path d="M24 93 L24 109 M16 101 L32 101" stroke="#F2C230" strokeWidth={1.8} />
      <g transform={`translate(${shiver} 0)`}>
        <Outlined w={6}>
          <rect x={-5.5} y={-34} width={11} height={36} rx={5.5} transform="translate(63 80) rotate(-32)" fill="#F5C396" />
          <rect x={-5.5} y={-34} width={11} height={36} rx={5.5} transform="translate(97 80) rotate(32)" fill="#F5C396" />
          <circle cx={45} cy={51} r={7.5} fill="#F5C396" />
          <circle cx={115} cy={51} r={7.5} fill="#F5C396" />
          <path d="M56 110 C54 88 62 72 80 70 C98 72 106 88 104 110 C96 114 64 114 56 110 Z" fill="#F7A440" />
          <circle cx={80} cy={46} r={23} fill="#F5C396" />
          <path d="M57 42 C55 28 63 20 72 22 C74 15 85 13 89 20 C95 17 104 23 102 33 C106 37 104 44 102 47 C98 38 90 33 80 33 C70 33 62 38 59 47 Z" fill="#4A2C17" />
        </Outlined>
        {[
          [70, 86],
          [89, 83],
          [80, 97],
          [95, 98],
          [64, 100],
        ].map(([sx, sy], i) => (
          <ellipse key={i} cx={sx} cy={sy} rx={3.8} ry={2.9} fill="#9A5518" />
        ))}
        <path d="M67 74 L90 108" stroke="#C97A22" strokeWidth={4} strokeLinecap="round" />
        <path d="M65 39 C71 35.5 89 35.5 95 39" stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
        <circle cx={72} cy={46} r={5.4} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
        <circle cx={88} cy={46} r={5.4} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
        <circle cx={71} cy={44.6} r={2.3} fill={INK} />
        <circle cx={87} cy={44.6} r={2.3} fill={INK} />
        <ellipse cx={80} cy={59} rx={5} ry={6} fill="#7A2618" stroke={INK} strokeWidth={2} />
        <circle cx={66} cy={54} r={3.5} fill="#FF9C8A" opacity={0.6} />
        <circle cx={94} cy={54} r={3.5} fill="#FF9C8A" opacity={0.6} />
        <path d="M107 32 C111 38 113 42 111 46 C109 49 104 48 104 44 C104 41 105 37 107 32 Z" fill="#8FD8FF" stroke={INK} strokeWidth={2} />
        <g transform="rotate(-18 84 20)">
          <Outlined w={3.5}>
            <circle cx={72} cy={17} r={3.2} fill="#FFF6E6" />
            <circle cx={72} cy={23} r={3.2} fill="#FFF6E6" />
            <circle cx={96} cy={17} r={3.2} fill="#FFF6E6" />
            <circle cx={96} cy={23} r={3.2} fill="#FFF6E6" />
            <rect x={72} y={16.5} width={24} height={7} rx={2} fill="#FFF6E6" />
          </Outlined>
        </g>
      </g>
    </svg>
  );
};

// =============================================================================================
// TelescopeView

/**
 * First-person telescope view: everything black outside a circle of `radius` (≈430) centred at
 * `x`, `y` (default 500, 740, so the circle spans x 70-930, y 310-1170, inside the TikTok-safe
 * area), a brass eyepiece rim with a dark rubber eyecup, a thin reticle with tick marks, a
 * soft vignette and lens glare. The 3D scene shows through the circle. The circle irises open
 * from a point at `from` (with enter="raise" the black closes in from the frame edges instead)
 * and irises shut over `closeDur` frames, fully black AT `to`; returns null after `to` (cut the
 * shot there). `drift` = hand-held wobble of the eyepiece in px.
 */
export const TelescopeView: React.FC<{
  frame: number;
  from: number;
  to: number;
  x?: number;
  y?: number;
  radius?: number;
  enter?: "iris" | "raise";
  closeDur?: number;
  reticle?: boolean;
  drift?: number;
}> = ({ frame, from, to, x = 500, y = 740, radius = 430, enter = "iris", closeDur = 12, reticle = true, drift = 4 }) => {
  const uid = useUid();
  if (frame < from || frame > to) return null;
  const t = frame - from;
  const opened =
    enter === "iris"
      ? radius * pop(frame, from, { damping: 17, stiffness: 120, mass: 0.8 })
      : interpolate(frame, [from, from + 16], [1500, radius], { ...CLAMP, easing: EASE_OUT });
  const r = Math.max(0, opened * (1 - ramp(frame, to - closeDur, to, [0, 1], EASE_IN)));
  const cx = x + (Math.sin(t * 0.045) + 0.3 * Math.sin(t * 0.13 + 1.3)) * drift;
  const cy = y + Math.cos(t * 0.037) * drift * 0.8;
  const ks = Math.min(1, r / radius);
  const rim = 40 * ks;
  const arc = (rr: number, a1: number, a2: number) => {
    const [x1, y1] = polar(rr, a1);
    const [x2, y2] = polar(rr, a2);
    return `M${cx + x1} ${cy + y1} A${rr} ${rr} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${cx + x2} ${cy + y2}`;
  };

  let reticlePaths: React.ReactNode = null;
  if (reticle && r > 60) {
    const L = r * 0.93;
    const gap = 30;
    let d = `M${cx - L} ${cy} L${cx - gap} ${cy} M${cx + gap} ${cy} L${cx + L} ${cy} M${cx} ${cy - L} L${cx} ${cy - gap} M${cx} ${cy + gap} L${cx} ${cy + L} `;
    let i = 0;
    for (let s = 64; s < L - 12; s += 36, i++) {
      const h = i % 3 === 2 ? 15 : 7;
      d += `M${cx - s} ${cy - h} L${cx - s} ${cy + h} M${cx + s} ${cy - h} L${cx + s} ${cy + h} M${cx - h} ${cy - s} L${cx + h} ${cy - s} M${cx - h} ${cy + s} L${cx + h} ${cy + s} `;
    }
    reticlePaths = (
      <>
        <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="rgba(236,255,246,0.35)" strokeWidth={2} strokeDasharray="5 11" />
        <path d={d} stroke="rgba(0,0,0,0.45)" strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d={d} stroke="rgba(236,255,246,0.92)" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={14} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={6} />
        <circle cx={cx} cy={cy} r={14} fill="none" stroke="#FF5A4E" strokeWidth={2.8} />
        <circle cx={cx} cy={cy} r={3} fill="#FF5A4E" />
      </>
    );
  }

  const screws = [45, 135, 225, 315].map((a) => {
    const [sx, sy] = polar(r + rim / 2, a);
    return (
      <g key={a} transform={`translate(${cx + sx} ${cy + sy}) rotate(${a + 30})`}>
        <circle r={rim * 0.17} fill="#C99A45" stroke={INK} strokeWidth={2.5} />
        <path d={`M${-rim * 0.11} 0 L${rim * 0.11} 0`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      </g>
    );
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id={`vig${uid}`} cx={cx} cy={cy} r={Math.max(1, r)} gradientUnits="userSpaceOnUse">
            <stop offset="0.6" stopColor="#000" stopOpacity={0} />
            <stop offset="0.88" stopColor="#000" stopOpacity={0.26} />
            <stop offset="1" stopColor="#000" stopOpacity={0.72} />
          </radialGradient>
          <linearGradient id={`brass${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF0B3" />
            <stop offset="0.28" stopColor="#E9B949" />
            <stop offset="0.62" stopColor="#B57C28" />
            <stop offset="1" stopColor="#6A4012" />
          </linearGradient>
          <radialGradient id={`soft${uid}`}>
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <stop offset="0.5" stopColor="#E6FBFF" stopOpacity={0.18} />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </radialGradient>
          <clipPath id={`lens${uid}`}>
            <circle cx={cx} cy={cy} r={Math.max(0.1, r)} />
          </clipPath>
        </defs>
        <path d={`M-20 -20 H1100 V1940 H-20 Z ${r > 0.5 ? circlePath(cx, cy, r + rim / 2) : ""}`} fill="#000" fillRule="evenodd" />
        {r > 0.5 ? (
          <>
            {/* rubber eyecup */}
            <circle cx={cx} cy={cy} r={r + rim + 30 * ks} fill="none" stroke="#16161A" strokeWidth={60 * ks} />
            <path d={arc(r + rim + 26 * ks, 282, 338)} stroke="#3A3A44" strokeWidth={9 * ks} strokeLinecap="round" fill="none" />
            {/* lens content */}
            <g clipPath={`url(#lens${uid})`}>
              <circle cx={cx} cy={cy} r={r} fill={`url(#vig${uid})`} />
              {reticlePaths}
              <path d={arc(r * 0.9, 282, 338)} stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={r * 0.05} strokeLinecap="round" fill="none" />
              <path d={arc(r * 0.82, 294, 318)} stroke="#FFFFFF" strokeOpacity={0.34} strokeWidth={r * 0.022} strokeLinecap="round" fill="none" />
              {[
                [-0.52, 0.11, 0.55],
                [0.3, 0.045, 0.7],
                [0.62, 0.16, 0.4],
              ].map(([dd, rr, o], i) => (
                <circle key={i} cx={cx + dd * r * 0.7071} cy={cy + dd * r * 0.7071} r={rr * r} fill={`url(#soft${uid})`} opacity={o} />
              ))}
              <circle cx={cx} cy={cy} r={r - 5} fill="none" stroke="#6FE7FF" strokeOpacity={0.22} strokeWidth={3} />
              <circle cx={cx} cy={cy} r={r - 9} fill="none" stroke="#FF9A3C" strokeOpacity={0.14} strokeWidth={3} />
            </g>
            {/* brass rim */}
            <circle cx={cx} cy={cy} r={r + rim / 2} fill="none" stroke={INK} strokeWidth={rim + 10 * ks} />
            <circle cx={cx} cy={cy} r={r + rim / 2} fill="none" stroke={`url(#brass${uid})`} strokeWidth={rim} />
            <circle cx={cx} cy={cy} r={r + rim * 0.3} fill="none" stroke="rgba(90,50,10,0.55)" strokeWidth={2.5 * ks} />
            <circle cx={cx} cy={cy} r={r + rim * 0.72} fill="none" stroke="rgba(255,240,190,0.6)" strokeWidth={2 * ks} />
            <path d={arc(r + rim * 0.5, 292, 346)} stroke="rgba(255,255,255,0.75)" strokeWidth={rim * 0.2} strokeLinecap="round" fill="none" />
            {screws}
          </>
        ) : null}
      </svg>
    </AbsoluteFill>
  );
};

// =============================================================================================
// ImpactHUD

const HUD_W = 540;
const HUD_H = 226;

/**
 * Asteroid tracking HUD. `x`, `y` = the asteroid (pass per-frame values to follow it; freeze
 * them after `missAt`). At `at` red corner brackets lock onto it (they shrink in from 2.3x,
 * flicker, then jitter) with an "ASTEROIDE" tag; a readout card below ("PROB. DE IMPACTO")
 * climbs to 99 % and pulses. At `missAt` the card flips to green "¡FALLÓ!" with a check
 * badge, the percentage drops to 0 % and the brackets release. Out at `out`. Footprint at
 * scale 1 with size 240: x ± 270, y - 190 … y + 400 (panel="above" puts the card on top and
 * the tag under the box: y - 400 … y + 190).
 */
export const ImpactHUD: React.FC<{
  frame: number;
  at: number;
  missAt: number;
  out: number;
  x: number;
  y: number;
  /** Side of the lock box in px. */
  size?: number;
  scale?: number;
  panel?: "below" | "above";
}> = ({ frame, at, missAt, out, x, y, size = 240, scale = 1, panel = "below" }) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const swapAt = missAt + 4;
  const missed = frame >= missAt;
  const flipped = frame >= swapAt;
  const col = flipped ? GREEN : RED;
  const exitK = ramp(frame, out, out + 9, [0, 1], EASE_IN);
  const lockK = ramp(frame, at, at + 12, [0, 1], EASE_OUT);
  const locked = frame >= at + 12;
  const release = ramp(frame, missAt, missAt + 16, [0, 1], EASE_OUT);
  const jAmp = missed ? 0 : locked ? 3 : 10;
  const jx = jit(frame, 1) * jAmp;
  const jy = jit(frame, 2) * jAmp;
  const base = size / 2;
  const half = base * (2.3 - 1.3 * lockK) * (1 + (locked && !missed ? 0.03 * Math.sin(t * 0.7) : 0)) * (1 + 0.4 * release);
  const boxOp = (locked ? 1 : 0.35 + 0.65 * blink(frame, at, 2, 2)) * (1 - 0.8 * release);

  // Impact probability: climbs to 99, then drops to 0 after the flip.
  const climb = ramp(frame, at + 10, missAt - 10, [0, 1], (v) => 1 - Math.pow(1 - v, 1.8));
  let pct = Math.round(99 * climb);
  if (climb > 0.02 && climb < 0.97) pct = Math.min(98, pct + Math.floor(rand(frame * 1.7) * 3));
  if (flipped) pct = Math.round(interpolate(frame, [swapAt + 3, swapAt + 20], [99, 0], { ...CLAMP, easing: EASE_IN_OUT }));
  const maxed = !missed && pct >= 99;

  const flipS = !missed ? 1 : !flipped ? 1 - ramp(frame, missAt, swapAt, [0, 1], EASE_IN) : pop(frame, swapAt, { damping: 9, stiffness: 240 });
  const panelIn = pop(frame, at + 8, { damping: 11, stiffness: 200 });
  const tagIn = pop(frame, at + 12, { damping: 10, stiffness: 220 });
  const pm = pop(frame, swapAt + 6, { damping: 8, stiffness: 240 });
  const pulse = 0.5 + 0.5 * Math.sin(t * (maxed ? 0.9 : 0.4));
  const glow = flipped ? 0.25 + 0.6 * (1 - ramp(frame, swapAt, swapAt + 30)) : maxed ? 0.5 + 0.5 * pulse : 0.2 + 0.2 * pulse;
  const glowRgb = flipped ? "60,255,120" : "255,40,40";

  const arm = Math.min(64, half * 0.42);
  const br = (sx: number, sy: number) => `M${sx * half} ${sy * (half - arm)} L${sx * half} ${sy * half} L${sx * (half - arm)} ${sy * half}`;
  const brackets = [br(-1, -1), br(1, -1), br(-1, 1), br(1, 1)].join(" ");
  const scanY = -half + ((t * 7) % (2 * half));
  const panelTop = panel === "below" ? base + 46 : -(base + 46 + HUD_H);
  const stemA = panel === "below" ? base + 10 : -base - 10;
  const stemB = panel === "below" ? panelTop : panelTop + HUD_H;
  const s = scale * (1 - exitK);
  const ticks = [0, 90, 180, 270].map((a) => {
    const [x1, y1] = polar(24, a);
    const [x2, y2] = polar(42, a);
    return `M${x1} ${y1} L${x2} ${y2}`;
  });

  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${s})`, opacity: 1 - exitK, pointerEvents: "none" }}>
      <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <path d={`M0 ${stemA} L0 ${stemB}`} stroke={INK} strokeWidth={9} strokeLinecap="round" opacity={panelIn > 0.5 ? 1 : 0} />
        <path d={`M0 ${stemA} L0 ${stemB}`} stroke={col} strokeWidth={4} strokeDasharray="7 7" opacity={panelIn > 0.5 ? 1 : 0} />
      </svg>
      {/* lock box */}
      <div style={{ position: "absolute", left: jx, top: jy, width: 0, height: 0 }}>
        <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <g transform={`rotate(${(1 - lockK) * 45})`} opacity={boxOp}>
            <rect x={-half} y={-half} width={2 * half} height={2 * half} fill={col} fillOpacity={0.07 + (maxed ? 0.12 * blink(frame, at, 3, 3) : 0)} />
            <rect x={-half} y={-half} width={2 * half} height={2 * half} fill="none" stroke={col} strokeOpacity={0.5} strokeWidth={2.5} strokeDasharray="9 11" />
            {locked && !missed ? (
              <>
                <rect x={-half} y={scanY - 24} width={2 * half} height={24} fill={col} opacity={0.12} />
                <rect x={-half} y={scanY - 2} width={2 * half} height={4} fill={col} opacity={0.65} />
              </>
            ) : null}
            <path d={brackets} stroke={INK} strokeWidth={17} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={brackets} stroke={col} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <g transform={`rotate(${missed ? 0 : t * 4})`}>
              <circle r={17} fill="none" stroke={INK} strokeWidth={9} />
              <path d={ticks.join(" ")} stroke={INK} strokeWidth={9} strokeLinecap="round" />
              <circle r={17} fill="none" stroke={col} strokeWidth={4.5} />
              <path d={ticks.join(" ")} stroke={col} strokeWidth={4.5} strokeLinecap="round" />
            </g>
          </g>
        </svg>
        <div
          style={{
            position: "absolute",
            left: -base,
            top: panel === "below" ? -base - 16 : base + 16,
            transform: `translate(0, ${panel === "below" ? "-100%" : "0"}) scale(${tagIn})`,
            transformOrigin: panel === "below" ? "0% 100%" : "0% 0%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 18px 5px 12px",
            borderRadius: 14,
            background: flipped ? "linear-gradient(180deg, #4BE36A 0%, #16A34A 100%)" : "linear-gradient(180deg, #FF5A4E 0%, #C8001A 100%)",
            boxShadow: `0 0 0 4px ${INK}, 0 6px 0 4px rgba(0,0,0,0.3)`,
            whiteSpace: "nowrap",
            opacity: 1 - 0.6 * release,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#FFFFFF",
              opacity: missed ? 1 : 0.35 + 0.65 * blink(frame, at, 5, 4),
              boxShadow: "0 0 10px rgba(255,255,255,0.9)",
            }}
          />
          <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 30, letterSpacing: 2, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.3)" }}>
            ASTEROIDE
          </span>
        </div>
      </div>
      {/* readout card */}
      <div style={{ position: "absolute", left: -HUD_W / 2, top: panelTop, width: HUD_W, height: HUD_H, transform: `scale(${panelIn}) scaleY(${flipS})` }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 32,
            background: flipped
              ? "linear-gradient(180deg, rgba(10,52,24,0.94) 0%, rgba(4,26,12,0.94) 100%)"
              : "linear-gradient(180deg, rgba(58,8,14,0.94) 0%, rgba(26,4,8,0.94) 100%)",
            border: `6px solid ${col}`,
            boxShadow: `0 0 0 5px ${INK}, 0 12px 0 5px rgba(0,0,0,0.3), 0 0 ${24 + 30 * glow}px rgba(${glowRgb},${0.35 + 0.4 * glow})`,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {flipped ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ paddingTop: 12 }}>
                  <HeavyText text="¡FALLÓ!" size={92} colors={GREEN_TXT} />
                </div>
                <div style={{ width: 84, height: 84, transform: `scale(${pm}) rotate(${(1 - pm) * -90}deg)` }}>
                  <MarkBadge kind="check" size={84} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 28, letterSpacing: 2, color: "#D6FFE0" }}>PROB. DE IMPACTO:</span>
                <div style={{ paddingTop: 8 }}>
                  <HeavyText text={`${pct} %`} size={50} colors={GREEN_TXT} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <WarnIcon size={44} on={maxed ? blink(frame, at, 4, 4) : 1} />
                <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 32, letterSpacing: 2, color: "#FFD9D6" }}>PROB. DE IMPACTO</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", marginTop: 14, transform: `scale(${1 + 0.06 * (maxed ? pulse : 0)})` }}>
                <HeavyText text={`${pct}`} size={100} colors={RED_TXT} />
                <HeavyText text="%" size={60} colors={RED_TXT} style={{ marginLeft: 12, marginBottom: 6 }} />
              </div>
              <div
                style={{
                  width: 400,
                  height: 16,
                  marginTop: 12,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.14)",
                  boxShadow: `0 0 0 3px ${INK}`,
                  overflow: "hidden",
                }}
              >
                <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #FF9A8F 0%, #FF3B30 60%, #D0001A 100%)" }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// FactCard (+ raptor vs turkey)

const RAPTOR = { body: "#45B97C", dark: "#2E8F5E", belly: "#E6F7C9", feather: "#FF9F1C", tip: "#FF5E1F" };

/** Feathered velociraptor, side view facing right; feet at (0, 0), head top at y ≈ -228. */
const Raptor: React.FC<{ frame: number; fluff?: number }> = ({ frame, fluff = 0 }) => {
  const sway = Math.sin(frame * 0.11) * 2.5;
  const nod = Math.sin(frame * 0.17 + 1) * 1.8;
  const fl = 1 + 0.22 * fluff;
  const leg = (dx: number, fill: string) => (
    <g transform={`translate(${dx} 0)`} fill={fill}>
      <ellipse cx={-6} cy={-104} rx={28} ry={36} transform="rotate(18 -6 -104)" />
      <path d="M-15 -86 L5 -80 L-7 -34 L-25 -38 Z" />
      <path d="M-25 -40 L-8 -36 L6 -6 L-9 -4 Z" />
      <path d="M-10 -10 C0 -14 20 -12 30 -6 C34 -4 34 0 30 0 L-8 0 C-12 0 -12 -8 -10 -10 Z" />
    </g>
  );
  const tailFeathers = [-24, -12, 0, 12, 24];
  const crest = [
    [67, -221, 26],
    [61, -214, 13],
    [58, -206, 0],
  ];
  const wingFeathers = [
    [62, -101, -34],
    [50, -104, -40],
    [39, -109, -46],
    [29, -117, -52],
  ];
  return (
    <g>
      <Outlined w={7}>{leg(22, RAPTOR.dark)}</Outlined>
      <path d="M24 -8 C25 -21 35 -29 45 -25 C39 -22 34 -16 33 -7 Z" fill="#E9D9B4" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <g transform={`rotate(${sway} -36 -126)`}>
        <Outlined w={7}>
          {tailFeathers.map((a) => (
            <ellipse key={a} cx={-150 - 30 * fl} cy={-143} rx={30 * fl} ry={8.5} transform={`rotate(${a} -150 -143)`} fill={RAPTOR.feather} />
          ))}
        </Outlined>
        {tailFeathers.map((a) => (
          <ellipse key={a} cx={-150 - 49 * fl} cy={-143} rx={11 * fl} ry={5.5} transform={`rotate(${a} -150 -143)`} fill={RAPTOR.tip} />
        ))}
      </g>
      <Outlined w={7}>
        <g transform={`rotate(${sway} -36 -126)`}>
          <path d="M-36 -144 C-76 -154 -118 -156 -150 -150 C-158 -149 -160 -140 -152 -137 C-118 -130 -78 -118 -40 -104 Z" fill={RAPTOR.body} />
        </g>
        <ellipse cx={2} cy={-124} rx={64} ry={38} transform="rotate(-10 2 -124)" fill={RAPTOR.body} />
        <g transform={`rotate(${nod} 60 -140)`}>
          {crest.map(([px, py, a], i) => (
            <ellipse key={i} cx={px - 16 * fl} cy={py} rx={16 * fl} ry={6} transform={`rotate(${a} ${px} ${py})`} fill={RAPTOR.feather} />
          ))}
          <path d="M34 -146 C46 -170 56 -186 62 -198 L84 -190 C78 -176 70 -160 62 -128 Z" fill={RAPTOR.body} />
          <path d="M56 -206 C58 -220 72 -228 86 -226 C100 -224 112 -214 124 -206 C132 -201 134 -194 128 -190 C116 -186 98 -184 82 -184 C68 -184 58 -192 56 -206 Z" fill={RAPTOR.body} />
        </g>
      </Outlined>
      <ellipse cx={16} cy={-106} rx={40} ry={12} transform="rotate(-10 16 -106)" fill={RAPTOR.belly} />
      <path d="M-26 -157 C-20 -151 -18 -145 -20 -139 M-6 -161 C0 -155 2 -149 0 -143 M14 -161 C20 -155 22 -149 20 -143" stroke={RAPTOR.dark} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Outlined w={7}>{leg(0, RAPTOR.body)}</Outlined>
      <path d="M2 -8 C3 -21 13 -29 23 -25 C17 -22 12 -16 11 -7 Z" fill="#FFF3D6" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <Outlined w={7}>
        {wingFeathers.map(([px, py, a], i) => (
          <ellipse key={i} cx={px - 22 * fl} cy={py} rx={22 * fl} ry={6.5} transform={`rotate(${a} ${px} ${py})`} fill={RAPTOR.feather} />
        ))}
        <path d="M28 -138 C50 -142 66 -128 72 -110 C74 -102 70 -97 63 -99 C49 -101 35 -107 23 -117 C18 -125 20 -134 28 -138 Z" fill={RAPTOR.body} />
      </Outlined>
      <path d="M71 -104 C77 -104 81 -100 81 -94 M66 -100 C71 -99 74 -95 73 -90" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <g transform={`rotate(${nod} 60 -140)`}>
        <path d="M44 -150 C52 -166 58 -178 64 -188" stroke={RAPTOR.dark} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} />
        <circle cx={94} cy={-210} r={8} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
        <circle cx={96.5} cy={-209} r={4.6} fill={INK} />
        <circle cx={98} cy={-211} r={1.6} fill="#FFFFFF" />
        <path d="M83 -221 L104 -217" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
        <circle cx={123} cy={-203} r={2.2} fill={INK} />
        <path d="M100 -193 C110 -191 120 -192 129 -195" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
        {[106, 114, 122].map((tx) => (
          <path key={tx} d={`M${tx - 3} -192.5 L${tx} -187 L${tx + 3} -192.5 Z`} fill="#FFFFFF" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
        ))}
        <circle cx={86} cy={-197} r={5} fill="#FF9EB0" opacity={0.6} />
      </g>
    </g>
  );
};

/** Wild turkey, side view facing left; feet at (0, 0), head top at y ≈ -225. */
const Turkey: React.FC<{ frame: number }> = ({ frame }) => {
  const peck = Math.sin(frame * 0.2) * 3;
  const fan = [];
  for (let i = 0; i < 9; i++) fan.push(-58 + i * 19.5);
  const feather = "M-13 0 C-16 -40 -15 -80 0 -100 C15 -80 16 -40 13 0 Z";
  const legs = [-6, 16].map((lx) => {
    const d = `M${lx} -56 L${lx - 2} -4 M${lx - 2} -3 L${lx - 22} 0 M${lx - 2} -3 L${lx + 8} -1`;
    return (
      <g key={lx}>
        <path d={d} stroke={INK} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={d} stroke="#E8955E" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    );
  });
  return (
    <g>
      <Outlined w={7}>
        {fan.map((a) => (
          <path key={a} d={feather} transform={`translate(40 -104) rotate(${a})`} fill="#8B5A2B" />
        ))}
      </Outlined>
      {fan.map((a, i) => (
        <g key={a} transform={`translate(40 -104) rotate(${a})`}>
          {i % 2 ? <path d="M0 -10 L0 -62" stroke="#A7713D" strokeWidth={3} strokeLinecap="round" /> : null}
          <path d="M-12.5 -72 L12.5 -72" stroke="#3E2210" strokeWidth={7} />
          <path d="M-11 -82 C-10 -91 -6 -97 0 -100 C6 -97 10 -91 11 -82 C5 -86 -5 -86 -11 -82 Z" fill="#F5DEB3" />
        </g>
      ))}
      {legs}
      <Outlined w={7}>
        <ellipse cx={8} cy={-104} rx={62} ry={56} fill="#6E4125" />
        <g transform={`rotate(${peck} -30 -150)`}>
          <path d="M-36 -142 C-44 -160 -50 -180 -52 -194 L-38 -200 C-35 -184 -28 -166 -16 -152 Z" fill="#CFE0EE" />
          <circle cx={-48} cy={-208} r={17} fill="#D6E8F5" />
          <path d="M-62 -212 L-81 -206 L-62 -201 Z" fill="#F2C15A" />
        </g>
      </Outlined>
      <ellipse cx={-22} cy={-116} rx={20} ry={28} fill="#84502C" opacity={0.8} />
      <path d="M-18 -142 q7 6 14 0 M2 -148 q7 6 14 0 M22 -144 q7 6 14 0 M-6 -128 q7 6 14 0" stroke="#8A5A36" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Outlined w={5}>
        <path d="M-47 -130 C-55 -120 -55 -107 -51 -99 C-47 -105 -45 -117 -43 -128 Z" fill="#2A1A10" />
      </Outlined>
      <Outlined w={6}>
        <path d="M-12 -122 C6 -140 46 -136 62 -114 C66 -108 66 -100 60 -96 C62 -89 55 -84 50 -88 C50 -81 42 -79 38 -85 C36 -79 28 -79 26 -86 C18 -84 2 -90 -8 -102 C-14 -110 -15 -118 -12 -122 Z" fill="#9C6236" />
      </Outlined>
      <path d="M2 -118 C18 -124 38 -120 52 -108 M-2 -106 C14 -112 34 -108 46 -96" stroke="#6E3F1E" strokeWidth={4} fill="none" strokeLinecap="round" />
      <g transform={`rotate(${peck} -30 -150)`}>
        {[
          [-44, -186, 3.6],
          [-40, -176, 3.2],
          [-36, -166, 2.8],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="#E5383B" stroke={INK} strokeWidth={1.5} />
        ))}
        <Outlined w={5}>
          <path d="M-57 -222 C-66 -222 -70 -214 -72 -204 C-73 -197 -70 -191 -67 -193 C-66 -199 -64 -208 -57 -214 Z" fill="#E5383B" />
          <path d="M-53 -195 C-59 -187 -57 -176 -49 -172 C-43 -176 -43 -188 -46 -195 Z" fill="#E5383B" />
        </Outlined>
        <circle cx={-51} cy={-212} r={4} fill={INK} />
        <circle cx={-50} cy={-213.5} r={1.4} fill="#FFFFFF" />
      </g>
    </g>
  );
};

/** Size comparison panel: velociraptor and turkey of the same height, a ruler and a dashed height line. */
const RaptorVsTurkey: React.FC<{ frame: number; at: number; hiAt: number; width: number }> = ({ frame, at, hiAt, width }) => {
  const uid = useUid();
  const W = 600;
  const H = 316;
  const GROUND = 268;
  const TOP = 58;
  const rulerK = ramp(frame, at + 6, at + 18, [0, 1], EASE_OUT);
  const rIn = pop(frame, at + 9, { damping: 10, stiffness: 190 });
  const tIn = pop(frame, at + 15, { damping: 10, stiffness: 190 });
  const lineK = ramp(frame, at + 20, at + 32, [0, 1], EASE_IN_OUT);
  const pillIn = pop(frame, at + 28, { damping: 10, stiffness: 220 });
  const labIn = pop(frame, at + 22, { damping: 11, stiffness: 220 });
  const fluff = bump(frame, hiAt, 14);
  const s = (GROUND - TOP) / 228;
  const grid = [];
  for (let gx = 30; gx < W; gx += 30) grid.push(<path key={`x${gx}`} d={`M${gx} 0 V${GROUND}`} stroke="#D3ECFB" strokeWidth={2} />);
  for (let gy = GROUND - 30; gy > 0; gy -= 30) grid.push(<path key={`y${gy}`} d={`M0 ${gy} H${W}`} stroke="#D3ECFB" strokeWidth={2} />);
  let ticks = "";
  for (let j = 0; j <= 10; j++) {
    const ty = GROUND - (j * (GROUND - TOP)) / 10;
    ticks += `M44 ${ty} L${j % 5 === 0 ? 28 : 35} ${ty} `;
  }
  const sparkles = [
    [52, 118],
    [86, 76],
    [250, 150],
    [226, 48],
  ].map(([sx, sy], i) => {
    const k = bump(frame, hiAt + i * 2, 14);
    if (k <= 0.02) return null;
    const r = 10 + 8 * k;
    return (
      <path
        key={i}
        d={`M${sx} ${sy - r} Q${sx} ${sy} ${sx + r} ${sy} Q${sx} ${sy} ${sx} ${sy + r} Q${sx} ${sy} ${sx - r} ${sy} Q${sx} ${sy} ${sx} ${sy - r} Z`}
        fill="#FFE14D"
        stroke={INK}
        strokeWidth={3}
        opacity={k}
      />
    );
  });
  const label = (cx: number, text: string, w: number) => (
    <g transform={`translate(${cx} ${GROUND + 24}) scale(${labIn})`}>
      <rect x={-w / 2} y={-17} width={w} height={34} rx={17} fill={INK} />
      <text x={0} y={7.5} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={900} fontSize={20} letterSpacing={1.2} fill="#FFFFFF">
        {text}
      </text>
    </g>
  );
  return (
    <svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <clipPath id={`vp${uid}`}>
          <rect x={0} y={0} width={W} height={H} rx={24} />
        </clipPath>
      </defs>
      <g clipPath={`url(#vp${uid})`}>
        <rect width={W} height={H} fill="#EAF7FF" />
        {grid}
        <rect y={GROUND} width={W} height={H - GROUND} fill="#A6DB7E" />
        <path d={`M0 ${GROUND} H${W}`} stroke="#5FA84A" strokeWidth={5} />
      </g>
      {/* ruler */}
      <g transform={`translate(0 ${GROUND}) scale(1 ${rulerK}) translate(0 ${-GROUND})`}>
        <rect x={14} y={TOP} width={30} height={GROUND - TOP} rx={5} fill="#FFD23F" stroke={INK} strokeWidth={4} />
        <path d={ticks} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* same-height line */}
      {lineK > 0 ? (
        <>
          <path d={`M48 ${TOP} L${48 + lineK * 536} ${TOP}`} stroke="#FF3D6E" strokeWidth={4.5} strokeDasharray="13 9" strokeLinecap="round" />
          <path d={`M46 ${TOP} l12 -8 l0 16 Z`} fill="#FF3D6E" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        </>
      ) : null}
      <g transform={`translate(205 ${GROUND}) scale(${s * rIn})`}>
        <Raptor frame={frame} fluff={fluff} />
      </g>
      <g transform={`translate(468 ${GROUND}) scale(${s * tIn})`}>
        <Turkey frame={frame} />
      </g>
      {sparkles}
      {pillIn > 0.01 ? (
        <g transform={`translate(362 28) scale(${pillIn})`}>
          <rect x={-92} y={-18} width={184} height={36} rx={18} fill="#FF3D6E" stroke={INK} strokeWidth={4} />
          <text x={0} y={7.5} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={900} fontSize={20} letterSpacing={1.4} fill="#FFFFFF">
            MISMA ALTURA
          </text>
        </g>
      ) : null}
      {label(196, "VELOCIRAPTOR", 182)}
      {label(472, "PAVO", 84)}
      <rect x={2.5} y={2.5} width={W - 5} height={H - 5} rx={22} fill="none" stroke={INK} strokeWidth={5} />
    </svg>
  );
};

/**
 * "DATO REAL" card: a blue card with a yellow title tab (verified seal) and the fact below in
 * white heavy type. Words wrapped in `*…*` light up yellow with a bounce at `highlightAt`
 * (default at + 34 with a visual). With visual="raptor-vs-turkey" it shows a drawn size
 * comparison: a feathered velociraptor next to a turkey of the same height, a ruler, a dashed
 * "MISMA ALTURA" line and name labels (it builds up over ~30 frames). `x`, `y` = card centre;
 * at width 660 the card with the visual is ~660 x 560 (x ± 335, y - 310 … y + 285).
 */
export const FactCard: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  title?: string;
  text: string;
  visual?: "raptor-vs-turkey";
  highlightAt?: number;
  width?: number;
  scale?: number;
  rotate?: number;
}> = ({ frame, at, out, x, y, title = "DATO REAL", text, visual, highlightAt, width = 660, scale = 1, rotate = -1.5 }) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 11, stiffness: 180 });
  const k = ramp(frame, out, out + 9, [0, 1], EASE_IN);
  const tabIn = pop(frame, at + 4, { damping: 9, stiffness: 220 });
  const hiAt = highlightAt ?? at + (visual ? 34 : 12);
  const textAt = at + (visual ? 10 : 6);
  const toks = tokenize(text);
  const inner = width - 2 * 7 - 2 * 22;
  let wordIdx = 0;
  let hiIdx = 0;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        transform: `translate(-50%, -50%) scale(${p * (1 - k) * scale}) rotate(${rotate + (1 - p) * -10 + Math.sin(t * 0.06) * 0.5}deg)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 40,
          background: "linear-gradient(160deg, #52D9FF 0%, #1E9BFF 55%, #1563D6 100%)",
          border: "7px solid #FFFFFF",
          boxShadow: `0 0 0 5px ${INK}, 0 14px 0 5px rgba(0,0,0,0.3), 0 26px 50px rgba(0,0,0,0.3)`,
          padding: "52px 22px 22px",
          boxSizing: "border-box",
        }}
      >
        {visual === "raptor-vs-turkey" ? <RaptorVsTurkey frame={frame} at={at} hiAt={hiAt} width={inner} /> : null}
        <div
          style={{
            marginTop: visual ? 16 : 4,
            textAlign: "center",
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: visual ? 38 : 46,
            lineHeight: 1.24,
            color: "#FFFFFF",
            WebkitTextStroke: `9px ${INK}`,
            paintOrder: "stroke fill",
            letterSpacing: 0.3,
          }}
        >
          {toks.map((tk, i) => {
            if (tk.br) return <br key={i} />;
            const wi = wordIdx++;
            const pw = pop(frame, textAt + wi * 1.5, { damping: 12, stiffness: 230 });
            let hb = 0;
            if (tk.hi) {
              hb = bump(frame, hiAt + hiIdx * 2, 10);
              hiIdx++;
            }
            const lit = tk.hi && frame >= hiAt;
            return (
              <React.Fragment key={i}>
                <span
                  style={{
                    display: "inline-block",
                    color: lit ? "#FFE14D" : "#FFFFFF",
                    transform: `translateY(${(1 - pw) * 16 - hb * 8}px) scale(${(0.5 + 0.5 * pw) * (1 + 0.16 * hb)})`,
                    opacity: frame >= textAt + wi * 1.5 ? 1 : 0,
                  }}
                >
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
          left: "50%",
          top: 0,
          transform: `translate(-50%, -55%) scale(${tabIn}) rotate(${-3 + (1 - tabIn) * 20}deg)`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 28px 8px 12px",
          borderRadius: 999,
          background: "linear-gradient(135deg, #FFE45C 0%, #FFB703 100%)",
          border: "6px solid #FFFFFF",
          boxShadow: `0 0 0 4px ${INK}, 0 8px 0 4px rgba(0,0,0,0.28)`,
          whiteSpace: "nowrap",
        }}
      >
        <SealIcon size={56} />
        <div style={{ paddingTop: 10 }}>
          <HeavyText text={title} size={46} colors={["#FFFFFF", "#FFFFFF", "#E8F6FF"]} />
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// SpeechBubble

type Tone = "normal" | "angry" | "whisper";
const TONE_TAG: Record<Tone, string> = {
  normal: "linear-gradient(135deg, #FF9A3D 0%, #FF4F8B 100%)",
  angry: "linear-gradient(135deg, #FF6A3D 0%, #D90429 100%)",
  whisper: "linear-gradient(135deg, #A48BFF 0%, #5B3FD6 100%)",
};
const TONE_HI: Record<Tone, string> = { normal: "#FF3D7F", angry: "#E0262B", whisper: "#6A4BE0" };

/** Jagged "shout" outline in a 0-100 box (stretched to the bubble). */
const JAG_PATH = (() => {
  const n = 34;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const ex = Math.sign(c) * Math.pow(Math.abs(c), 0.55);
    const ey = Math.sign(sn) * Math.pow(Math.abs(sn), 0.55);
    const r = i % 2 ? 0.9 + rand(i * 3.1) * 0.03 : 1.05 + rand(i * 5.3) * 0.05;
    d += `${i ? "L" : "M"}${(50 + 50 * ex * r).toFixed(2)} ${(50 + 50 * ey * r).toFixed(2)} `;
  }
  return d + "Z";
})();

/** Bubble tail shapes (drawn once as an outline under the body, once as a fill over its border). */
const TAIL_LEFT = "M104 4 C84 14 50 36 6 88 C44 70 80 62 108 58 Z";
const TAIL_BOTTOM = "M4 4 C12 34 12 66 0 104 C28 80 54 50 66 4 Z";

/**
 * Comic speech bubble for an off-screen voice: a white rounded bubble (tone "angry" = jagged
 * shout outline that shakes as words land, with a red anger mark; "whisper" = dashed outline)
 * with a tail pointing `tail`-wards and a small speaker tag ("MAMÁ") on its top-left corner.
 * Words pop in one by one: from `wordFrames` (one frame per word, e.g. the voice timing) or
 * every `perWord` frames from at + 3. `*word*` = highlighted in the tone colour. `x`, `y` =
 * bubble centre (without the tail); width grows with the text up to `maxWidth` (700), ~200 px
 * tall for two lines at fontSize 54. The tail adds ~80 px on its side.
 */
export const SpeechBubble: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  speaker?: string;
  text: string;
  tail?: "left" | "right" | "bottom";
  tone?: Tone;
  wordFrames?: number[];
  perWord?: number;
  maxWidth?: number;
  fontSize?: number;
  scale?: number;
  rotate?: number;
}> = ({ frame, at, out, x, y, speaker, text, tail = "left", tone = "normal", wordFrames, perWord = 3, maxWidth = 700, fontSize = 54, scale = 1, rotate }) => {
  if (frame < at || frame > out + 9) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 13, stiffness: 220, mass: 0.7 });
  const k = ramp(frame, out, out + 8, [0, 1], EASE_IN);
  const tagIn = pop(frame, at + 3, { damping: 10, stiffness: 230 });
  const toks = tokenize(text);
  const nWords = toks.filter((tk) => !tk.br).length;
  const times: number[] = [];
  for (let i = 0; i < nWords; i++) times.push(wordFrames && wordFrames[i] !== undefined ? wordFrames[i] : at + 3 + i * perWord);
  const angry = tone === "angry";
  let shakeAmt = 0;
  if (angry) for (const tw of times) if (frame >= tw) shakeAmt = Math.max(shakeAmt, Math.exp(-(frame - tw) / 5));
  const shx = angry ? jit(frame, 3, 1) * (1.5 + 7 * shakeAmt) : 0;
  const shy = angry ? jit(frame, 4, 1) * (1 + 4 * shakeAmt) : 0;
  const rot = (rotate ?? (tail === "right" ? 2 : -2)) + (1 - p) * (tail === "right" ? 12 : -12) + Math.sin(t * 0.08) * 0.7;
  const origin = tail === "left" ? "0% 75%" : tail === "right" ? "100% 75%" : "30% 100%";
  const hiCol = TONE_HI[tone];
  const vein = pop(frame, at + 6, { damping: 7, stiffness: 260 }) * (1 + 0.12 * Math.max(0, Math.sin(t * 0.6)));

  const tailSvg = (pass: "outline" | "fill") => {
    const common = { fill: "#FFFFFF", stroke: pass === "outline" ? INK : "none", strokeWidth: pass === "outline" ? 14 : 0, strokeLinejoin: "round" as const };
    if (tail === "bottom") {
      return (
        <svg width={70} height={110} viewBox="0 0 70 110" style={{ position: "absolute", left: "22%", bottom: -74, overflow: "visible" }}>
          <path d={TAIL_BOTTOM} {...common} />
        </svg>
      );
    }
    return (
      <svg
        width={112}
        height={92}
        viewBox="0 0 112 92"
        style={{
          position: "absolute",
          top: "52%",
          [tail === "left" ? "left" : "right"]: -76,
          transform: tail === "right" ? "scaleX(-1)" : undefined,
          overflow: "visible",
        }}
      >
        <path d={TAIL_LEFT} {...common} />
      </svg>
    );
  };

  let wi = 0;
  const words = toks.map((tk, i) => {
    if (tk.br) return <div key={i} style={{ flexBasis: "100%", height: 0 }} />;
    const tw = times[wi];
    const j = wi++;
    const wp = Math.min(1.06, pop(frame, tw, { damping: 10, stiffness: 260, mass: 0.6 }));
    const wj = angry ? Math.exp(-(frame - tw) / 6) : 0;
    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          color: tk.hi ? hiCol : undefined,
          opacity: frame >= tw ? 1 : 0,
          transform: `translate(${jit(frame, j + 20, 1) * 3 * wj}px, ${(1 - wp) * 18 + jit(frame, j + 40, 1) * 3 * wj}px) scale(${0.4 + 0.6 * wp})`,
        }}
      >
        {tk.w}
      </span>
    );
  });

  const body = (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        columnGap: fontSize * 0.26,
        rowGap: 2,
        fontFamily: FONT.fun,
        fontSize,
        lineHeight: 1.12,
        color: tone === "whisper" ? "#4B3F66" : INK,
        textAlign: "center",
      }}
    >
      {words}
    </div>
  );

  return (
    <div style={{ position: "absolute", left: x + shx, top: y + shy, width: 0, height: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          maxWidth,
          width: "max-content",
          transform: `translate(-50%, -50%)`,
        }}
      >
        <div style={{ position: "relative", transform: `scale(${p * (1 - k) * scale}) rotate(${rot}deg)`, transformOrigin: origin, opacity: Math.min(1, p * 3) }}>
          {tailSvg("outline")}
          {angry ? (
            <div style={{ position: "relative", padding: "46px 64px 42px", boxSizing: "border-box" }}>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.28))" }}
              >
                <path d={JAG_PATH} fill="#FFFFFF" stroke={INK} strokeWidth={7} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
              {body}
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                padding: "28px 44px 24px",
                borderRadius: 60,
                background: tone === "whisper" ? "rgba(255,255,255,0.96)" : "#FFFFFF",
                border: tone === "whisper" ? `6px dashed ${INK}` : `7px solid ${INK}`,
                boxShadow: "0 12px 0 rgba(0,0,0,0.28)",
                boxSizing: "border-box",
              }}
            >
              {body}
            </div>
          )}
          {tailSvg("fill")}
          {angry ? (
            <svg width={74} height={74} viewBox="0 0 100 100" style={{ position: "absolute", right: -18, top: -34, transform: `scale(${vein}) rotate(12deg)`, overflow: "visible" }}>
              {[0, 90, 180, 270].map((a) => (
                <g key={a} transform={`rotate(${a} 50 50)`}>
                  <path d="M58 14 C58 34 62 42 86 42" stroke={INK} strokeWidth={17} fill="none" strokeLinecap="round" />
                  <path d="M58 14 C58 34 62 42 86 42" stroke="#FF2E3F" strokeWidth={9} fill="none" strokeLinecap="round" />
                </g>
              ))}
            </svg>
          ) : null}
          {speaker ? (
            <div
              style={{
                position: "absolute",
                left: angry ? 46 : 28,
                top: angry ? 8 : 0,
                transform: `translate(0, -62%) rotate(-4deg) scale(${tagIn})`,
                transformOrigin: "0% 100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 20px 4px 12px",
                borderRadius: 999,
                background: TONE_TAG[tone],
                border: "5px solid #FFFFFF",
                boxShadow: `0 0 0 4px ${INK}, 0 6px 0 4px rgba(0,0,0,0.25)`,
                whiteSpace: "nowrap",
              }}
            >
              <VoiceIcon size={32} frame={frame} />
              <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 28, letterSpacing: 2, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.3)" }}>
                {speaker}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// MenuCard

/** Rubber stamp "¡AGOTADO!" with worn speckles. */
const AgotadoStamp: React.FC<{ uid: string }> = ({ uid }) => {
  const specks = [];
  for (let i = 0; i < 60; i++) {
    specks.push(<circle key={i} cx={-205 + rand(i * 3.1 + 1) * 410} cy={-66 + rand(i * 5.7 + 2) * 132} r={1.2 + rand(i * 7.9 + 3) * 3.6} fill="#000" />);
  }
  return (
    <svg width={430} height={150} viewBox="-215 -75 430 150" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <mask id={`stm${uid}`} maskUnits="userSpaceOnUse" x={-215} y={-75} width={430} height={150}>
          <rect x={-215} y={-75} width={430} height={150} fill="#FFFFFF" />
          {specks}
        </mask>
      </defs>
      <rect x={-205} y={-66} width={410} height={132} rx={22} fill="rgba(255,247,230,0.93)" />
      <g mask={`url(#stm${uid})`}>
        <rect x={-205} y={-66} width={410} height={132} rx={22} fill="none" stroke="#D7263D" strokeWidth={10} />
        <rect x={-190} y={-51} width={380} height={102} rx={12} fill="none" stroke="#D7263D" strokeWidth={4} />
        <text x={0} y={27} textAnchor="middle" fontFamily={FONT.title} fontSize={74} fill="#D7263D" textLength={344} lengthAdjust="spacingAndGlyphs">
          ¡AGOTADO!
        </text>
      </g>
    </svg>
  );
};

/** Title ribbon with folded tails. */
const Ribbon: React.FC<{ text: string; width: number; uid: string }> = ({ text, width, uid }) => (
  <div style={{ position: "relative", width, height: 104, margin: "0 auto" }}>
    <svg width={width} height={104} viewBox={`0 0 ${width} 104`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`rib${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5FD67E" />
          <stop offset="1" stopColor="#1E9A4E" />
        </linearGradient>
      </defs>
      <path d={`M0 36 L78 36 L78 100 L0 100 L24 68 Z`} fill="#1B7F42" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={`M${width} 36 L${width - 78} 36 L${width - 78} 100 L${width} 100 L${width - 24} 68 Z`} fill="#1B7F42" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={`M50 86 L78 100 L78 86 Z`} fill="#0D4F28" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d={`M${width - 50} 86 L${width - 78} 100 L${width - 78} 86 Z`} fill="#0D4F28" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <rect x={50} y={8} width={width - 100} height={78} rx={12} fill={`url(#rib${uid})`} stroke={INK} strokeWidth={6} />
      <rect x={62} y={16} width={width - 124} height={12} rx={6} fill="#FFFFFF" opacity={0.22} />
    </svg>
    <div style={{ position: "absolute", left: 0, right: 0, top: 22, display: "flex", justifyContent: "center" }}>
      <HeavyText text={text} size={50} colors={["#FFFFFF", "#FFFBE0", "#FFE45C"]} />
    </div>
  </div>
);

const MENU_W = 600;
const MENU_ITEMS: { icon: "fern" | "volcano"; name: string; price: string }[] = [
  { icon: "fern", name: "HELECHOS AL VAPOR", price: "3" },
  { icon: "volcano", name: "SOPA DE VOLCÁN", price: "5" },
];

/**
 * Jurassic restaurant menu card: parchment card that drops in with a swing, a green "MENÚ DEL
 * DÍA" ribbon, a chef T-Rex peeking over the top corner, two joke dishes priced in bones and
 * the highlighted special "SNACK: HUMANOS" (a scared caveman on a plate) that gets circled in
 * red pen. With `stampAt` a red rubber stamp "¡AGOTADO!" slams onto the special (card shakes).
 * `x`, `y` = card centre; ~600 x 640 (x ± 300, y - 390 … y + 300 including the chef).
 */
export const MenuCard: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  stampAt?: number;
  scale?: number;
  rotate?: number;
}> = ({ frame, at, out, x, y, stampAt, scale = 1, rotate = 2 }) => {
  const uid = useUid();
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 12, stiffness: 150, mass: 0.9 });
  const k = ramp(frame, out, out + 9, [0, 1], EASE_IN);
  const chefIn = pop(frame, at + 10, { damping: 10, stiffness: 170 });
  const spIn = pop(frame, at + 18, { damping: 9, stiffness: 200 });
  const penK = ramp(frame, at + 26, at + 40, [0, 1], EASE_IN_OUT);
  const sd = stampAt !== undefined ? frame - stampAt : -1;
  const IMPACT = 6;
  const stampS =
    sd < 0 ? 0 : sd < IMPACT ? interpolate(sd, [0, IMPACT], [2.2, 1], { ...CLAMP, easing: EASE_IN }) : 1 + 0.07 * Math.sin((sd - IMPACT) * 0.9) * Math.exp(-(sd - IMPACT) / 5);
  const hit = sd >= IMPACT ? sd - IMPACT : -1;
  const shx = hit >= 0 && hit < 10 ? Math.sin(hit * 3.1) * 10 * (1 - hit / 10) : 0;
  const swing = Math.sin(t * 0.07) * 0.8;
  // impact lines around the stamp
  const impact: React.ReactNode[] = [];
  if (hit >= 0 && hit < 10) {
    const tt = hit / 10;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      const r0 = 200 + 70 * tt;
      const len = 60 * (1 - tt) + 8;
      const x1 = Math.cos(a) * r0 * 1.2;
      const y1 = Math.sin(a) * r0 * 0.55;
      const x2 = Math.cos(a) * (r0 + len) * 1.2;
      const y2 = Math.sin(a) * (r0 + len) * 0.55;
      impact.push(<line key={`k${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={12 * (1 - tt) + 3} strokeLinecap="round" />);
      impact.push(<line key={`w${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeWidth={6 * (1 - tt) + 1} strokeLinecap="round" />);
    }
  }
  return (
    <div
      style={{
        position: "absolute",
        left: x + shx,
        top: y,
        width: MENU_W,
        transform: `translate(-50%, -50%) translateY(${(1 - p) * -240}px) scale(${(0.6 + 0.4 * p) * (1 - k) * scale}) rotate(${rotate + (1 - p) * -14 + swing}deg)`,
        opacity: Math.min(1, p * 3),
        pointerEvents: "none",
      }}
    >
      {/* chef T-Rex peeking over the top-right corner */}
      <div
        style={{
          position: "absolute",
          right: -26,
          top: -134,
          width: 190,
          height: 190,
          transform: `translateY(${(1 - chefIn) * 90}px) rotate(${10 + Math.sin(t * 0.1) * 3}deg)`,
          transformOrigin: "50% 100%",
        }}
      >
        <TRexHead size={190} chefHat />
      </div>
      <div
        style={{
          position: "relative",
          borderRadius: 36,
          background: "linear-gradient(170deg, #FFF8E6 0%, #FBE8C2 60%, #F2D7A2 100%)",
          border: "7px solid #FFFFFF",
          boxShadow: `0 0 0 5px ${INK}, 0 14px 0 5px rgba(0,0,0,0.3), 0 26px 50px rgba(0,0,0,0.3)`,
          padding: "22px 30px 28px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ position: "absolute", inset: 12, borderRadius: 26, border: "4px dashed #C9A26A", pointerEvents: "none" }} />
        <Ribbon text="MENÚ DEL DÍA" width={MENU_W - 60} uid={uid} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginTop: 2,
            fontFamily: FONT.heavy,
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: 6,
            color: "#8A5A2B",
          }}
        >
          <BoneIcon size={34} />
          COCINA JURÁSICA
          <BoneIcon size={34} />
        </div>
        <div style={{ marginTop: 12 }}>
          {MENU_ITEMS.map((it, i) => {
            const ri = ramp(frame, at + 8 + i * 5, at + 16 + i * 5, [0, 1], EASE_OUT);
            return (
              <div
                key={it.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "4px 4px",
                  opacity: ri,
                  transform: `translateX(${(1 - ri) * -40}px)`,
                }}
              >
                {it.icon === "fern" ? <FernIcon size={46} /> : <VolcanoIcon size={46} />}
                <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 28, color: "#4A2A12", whiteSpace: "nowrap" }}>{it.name}</span>
                <div style={{ flex: 1, height: 0, borderBottom: "5px dotted #C9A26A", marginTop: 14 }} />
                <span style={{ fontFamily: FONT.title, fontSize: 36, color: "#4A2A12", paddingTop: 6 }}>{it.price}</span>
                <BoneIcon size={40} />
              </div>
            );
          })}
        </div>
        {/* the special */}
        <div style={{ position: "relative", marginTop: 16, height: 176 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0 18px 0 8px",
              borderRadius: 26,
              background: "linear-gradient(135deg, #FFF3C4 0%, #FFD166 100%)",
              border: `5px solid ${INK}`,
              boxShadow: "0 7px 0 rgba(0,0,0,0.22)",
              transform: `scale(${spIn}) rotate(${(1 - spIn) * 8}deg)`,
              boxSizing: "border-box",
            }}
          >
            <CavemanPlate size={186} frame={frame} style={{ flexShrink: 0, marginTop: 6 }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 20, letterSpacing: 2, color: "#8A5A2B" }}>ESPECIAL DE LA CASA</span>
              <span style={{ fontFamily: FONT.title, fontSize: 42, lineHeight: 1, color: "#E0262B", paddingTop: 8, marginTop: 2 }}>SNACK:</span>
              <div style={{ paddingTop: 16 }}>
                <HeavyText text="HUMANOS" size={60} colors={["#FFF1E0", "#FF8A3D", "#E0262B"]} />
              </div>
            </div>
          </div>
          {penK > 0 ? (
            <svg width={MENU_W - 60 + 44} height={176 + 44} viewBox={`0 0 ${MENU_W - 60 + 44} ${176 + 44}`} style={{ position: "absolute", left: -22, top: -22, overflow: "visible" }}>
              <path
                d="M40 40 C140 4 420 2 540 24 C586 34 590 110 574 168 C560 214 380 222 250 218 C120 214 16 206 10 150 C4 96 20 50 96 26"
                fill="none"
                stroke="#E0262B"
                strokeWidth={7}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100 100"
                strokeDashoffset={100 * (1 - penK)}
                opacity={0.9}
              />
            </svg>
          ) : null}
          {sd >= 0 ? (
            <div style={{ position: "absolute", left: "56%", top: "52%", width: 0, height: 0 }}>
              <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", transform: "rotate(-11deg)" }}>
                {impact}
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  transform: `translate(-50%, -50%) rotate(-11deg) scale(${stampS * 0.9})`,
                  opacity: ramp(frame, stampAt ?? 0, (stampAt ?? 0) + 2),
                  filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.25))",
                }}
              >
                <AgotadoStamp uid={uid} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// ExistenceMeter

const METER_W = 780;
const LABEL_H = 76;
const BAR_H = 100;
const FACE_H = LABEL_H + BAR_H;
const LEVELS = {
  ok: { c: ["#C8FF9A", "#46D860", "#139A3A"], txt: ["#FFFFFF", "#EFFFE8", "#B6FFB0"] },
  mid: { c: ["#FFE89A", "#FFB703", "#E07B00"], txt: ["#FFFFFF", "#FFF6D6", "#FFD66B"] },
  low: { c: ["#FFB0A6", "#FF3B30", "#B0001A"], txt: ["#FFFFFF", "#FFE0E0", "#FF9A9A"] },
};
const GLITCH_CHARS = "#%&?X01_/";

const scramble = (s: string, frame: number, amount: number) => {
  let o = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    o += c !== " " && rand(frame * 1.31 + i * 7.7) < amount ? GLITCH_CHARS[Math.floor(rand(frame * 2.9 + i * 3.3) * GLITCH_CHARS.length)] : c;
  }
  return o;
};

/**
 * "EXISTENCIA HUMANA" health bar (person badge + label, a big rimmed bar with the percentage
 * inside). Pops in at `at` (default from - 12), drains 100 % -> 0 % between `from` and `to`
 * (green -> amber -> red, pixels crumbling off the draining edge) and glitches harder as it
 * empties: RGB split, sliced rows shifting sideways, flicker, jitter, noise blocks, scrambled
 * label. At 0 % the rim flashes red, "0 %" blinks and `errorText` types in under the bar
 * ("" = none). At `out` (default to + 45) it switches off like an old TV. `x`, `y` = centre of
 * the label + bar block; 780 x 176, plus the error line (~60 px) below: x ± 390 (keep x ≈ 500),
 * y - 88 … y + 150.
 */
export const ExistenceMeter: React.FC<{
  frame: number;
  from: number;
  to: number;
  x: number;
  y: number;
  at?: number;
  out?: number;
  scale?: number;
  label?: string;
  errorText?: string;
}> = ({ frame, from, to, x, y, at, out, scale = 1, label = "EXISTENCIA HUMANA", errorText = "ERROR 404: HUMANOS NO ENCONTRADOS" }) => {
  const uid = useUid();
  const inAt = at ?? from - 12;
  const outAt = out ?? to + 45;
  if (frame < inAt || frame > outAt + 11) return null;
  const pIn = pop(frame, inAt, { damping: 11, stiffness: 190 });
  const drain = ramp(frame, from, to, [0, 1], EASE_IN_OUT);
  const v = clamp01(1 - drain + (drain > 0 && drain < 1 ? 0.025 * Math.sin((frame - from) * 1.3) * Math.sin(drain * Math.PI) : 0));
  const g = Math.pow(1 - v, 1.4);
  const empty = frame >= to;
  const active = frame >= from;
  const burst = active && rand(frame * 3.17 + 0.5) < (empty ? 0.45 : 0.05 + 0.6 * g);
  const split = active ? (burst ? 4 + 14 * g * rand(frame * 1.9) : 1 + 3 * g) : 0;
  const flick = burst && rand(frame * 5.3) < 0.3 ? 0.5 : 1;
  const jA = active ? 1 + 7 * g : 0;
  const jx = jit(frame, 11, 1) * jA * (burst ? 1.6 : 0.4);
  const jy = jit(frame, 12, 1) * jA * 0.35;
  const pct = Math.round(v * 100);
  const shownPct = burst && g > 0.4 && !empty && rand(frame * 2.3) < 0.35 ? Math.floor(rand(frame * 4.1) * 100) : pct;
  const labelShown = burst && g > 0.25 ? scramble(label, frame, 0.3 * g) : label;
  const lv = v > 0.5 ? LEVELS.ok : v > 0.2 ? LEVELS.mid : LEVELS.low;
  const alarm = empty ? blink(frame, to, 5, 5) : 0;
  const hitFlash = bump(frame, to, 8);
  const off1 = ramp(frame, outAt, outAt + 5, [0, 1], EASE_IN);
  const off2 = ramp(frame, outAt + 5, outAt + 10, [0, 1], EASE_IN);

  // bar geometry (in the 780 x 100 bar svg)
  const TX = 18;
  const TW = 744;
  const TY = 18;
  const TH = 64;
  const edge = TX + TW * v;
  const crumbs: React.ReactNode[] = [];
  const N = 26;
  for (let i = 0; i < N; i++) {
    const s0 = from + ((i + 0.5) * (to - from)) / N;
    const a = frame - s0;
    if (a < 0 || a >= 22) continue;
    const v0 = 1 - ramp(s0, from, to, [0, 1], EASE_IN_OUT);
    const x0 = TX + TW * v0;
    const vx = 1.5 + rand(i * 2.1) * 3.5;
    const vy0 = -(2 + rand(i * 3.7) * 4);
    const cx = x0 + vx * a;
    const cy = TY + 10 + rand(i * 4.3) * (TH - 20) + vy0 * a + 0.22 * a * a;
    const sz = 6 + rand(i * 5.9) * 9;
    crumbs.push(<rect key={i} x={cx - sz / 2} y={cy - sz / 2} width={sz} height={sz} fill={lv.c[1]} stroke={INK} strokeWidth={2} opacity={1 - a / 22} />);
  }

  const face = (
    <div style={{ position: "relative", width: METER_W, height: FACE_H }}>
      <div style={{ height: LABEL_H, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <PersonBadge size={60} />
        <div style={{ paddingTop: 12 }}>
          <HeavyText text={labelShown} size={50} colors={["#FFFFFF", "#EAF6FF", "#A9DBFF"]} />
        </div>
      </div>
      <svg width={METER_W} height={BAR_H} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <clipPath id={`tr${uid}`}>
            <rect x={TX} y={TY} width={TW} height={TH} rx={TH / 2} />
          </clipPath>
          <linearGradient id={`fl${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={lv.c[0]} />
            <stop offset="0.5" stopColor={lv.c[1]} />
            <stop offset="1" stopColor={lv.c[2]} />
          </linearGradient>
        </defs>
        <rect x={6} y={6} width={METER_W - 12} height={BAR_H - 12} rx={(BAR_H - 12) / 2} fill={alarm ? RED : INK} />
        <rect x={11} y={11} width={METER_W - 22} height={BAR_H - 22} rx={(BAR_H - 22) / 2} fill="#FFFFFF" />
        <rect x={TX} y={TY} width={TW} height={TH} rx={TH / 2} fill="#241620" />
        <g clipPath={`url(#tr${uid})`}>
          <rect x={TX} y={TY} width={TW * v} height={TH} fill={`url(#fl${uid})`} />
          {Array.from({ length: 9 }, (_, j) => (
            <path key={j} d={`M${TX + (TW * (j + 1)) / 10} ${TY} V${TY + TH}`} stroke="rgba(0,0,0,0.28)" strokeWidth={4} />
          ))}
          {v > 0.005 && v < 0.995 ? <rect x={edge - 5} y={TY} width={6} height={TH} fill="#FFFFFF" opacity={0.85} /> : null}
          <rect x={TX + 16} y={TY + 6} width={TW - 32} height={14} rx={7} fill="#FFFFFF" opacity={0.25} />
          {g > 0.05 ? (
            <g opacity={0.5 * g}>
              {Array.from({ length: 11 }, (_, j) => (
                <rect key={j} x={TX} y={TY + j * 6} width={TW} height={2.5} fill="#000000" />
              ))}
            </g>
          ) : null}
          {hitFlash > 0 ? <rect x={TX} y={TY} width={TW} height={TH} fill="#FFFFFF" opacity={hitFlash * 0.9} /> : null}
        </g>
        {crumbs}
      </svg>
      <div style={{ position: "absolute", right: 48, top: LABEL_H + BAR_H / 2 - 25, opacity: empty ? 0.35 + 0.65 * (1 - alarm) : 1 }}>
        <div style={{ paddingTop: 8 }}>
          <HeavyText text={`${shownPct} %`} size={46} colors={empty ? RED_TXT : lv.txt} />
        </div>
      </div>
    </div>
  );

  // glitch slices
  let copies: React.ReactNode;
  if (burst) {
    const cuts = [0];
    let c = 0;
    while (cuts.length < 5) {
      c += 12 + rand(frame * 1.7 + cuts.length * 3.1) * 26;
      cuts.push(Math.min(100, c));
      if (c >= 100) break;
    }
    if (cuts[cuts.length - 1] < 100) cuts.push(100);
    const parts = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const dx = (rand(frame * 3.3 + i * 1.7) - 0.5) * 2 * (6 + 46 * g);
      parts.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            clipPath: `inset(${cuts[i]}% -30% ${100 - cuts[i + 1]}% -30%)`,
            transform: `translateX(${dx}px)`,
          }}
        >
          {face}
        </div>,
      );
    }
    copies = parts;
  } else {
    copies = <div style={{ position: "absolute", left: 0, top: 0 }}>{face}</div>;
  }
  const noise: React.ReactNode[] = [];
  if (burst) {
    const cols = ["#FF2D78", "#2DF6FF", "#FFFFFF"];
    for (let i = 0; i < 5; i++) {
      noise.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: rand(frame * 1.1 + i * 9.1) * (METER_W - 160),
            top: rand(frame * 2.2 + i * 4.4) * (FACE_H - 16),
            width: 40 + rand(frame * 3.3 + i * 2.7) * 160,
            height: 5 + rand(frame * 4.4 + i * 1.3) * 12,
            background: cols[i % 3],
            opacity: 0.75,
          }}
        />,
      );
    }
  }
  const typed = empty && errorText ? errorText.slice(0, Math.max(0, Math.floor((frame - to - 6) * 1.6))) : "";
  const errIn = empty && errorText ? pop(frame, to + 4, { damping: 11, stiffness: 220 }) : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `translate(${jx}px, ${jy}px) scale(${pIn * scale * (1 - off2 * 0.97)}, ${pIn * scale * (1 - off1 * 0.96)})`,
        opacity: flick * (1 - off2),
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -METER_W / 2,
          top: -FACE_H / 2,
          width: METER_W,
          height: FACE_H,
          filter: split > 0.2 ? `drop-shadow(${-split}px 0 0 rgba(255,0,80,0.85)) drop-shadow(${split}px 0 0 rgba(0,230,255,0.85))` : undefined,
        }}
      >
        {copies}
        {noise}
        {off1 > 0 ? <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: off1, borderRadius: 40 }} /> : null}
      </div>
      {errIn > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: FACE_H / 2 + 14,
            transform: `translate(-50%, 0) scale(${errIn})`,
            padding: "8px 22px 6px",
            borderRadius: 14,
            background: "rgba(40,4,10,0.92)",
            border: `4px solid ${RED}`,
            boxShadow: `0 0 0 4px ${INK}, 0 0 24px rgba(255,40,40,0.6)`,
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: 1.5,
            color: "#FFD6D6",
            whiteSpace: "nowrap",
            minWidth: 20,
          }}
        >
          {typed}
          <span style={{ opacity: blink(frame, to, 6, 6), color: RED }}>_</span>
        </div>
      ) : null}
    </div>
  );
};

// =============================================================================================
// DinoCTA

const DINOS: { label: string; bg: string; icon: () => React.ReactNode }[] = [
  { label: "T-REX", bg: "radial-gradient(circle at 50% 30%, #FFF7D6 0%, #FFC857 100%)", icon: () => <TRexHead size={146} style={{ marginTop: 22, marginLeft: -4 }} /> },
  { label: "TRICERATOPS", bg: "radial-gradient(circle at 50% 30%, #E8FFF6 0%, #7FE3C3 100%)", icon: () => <TriceratopsHead size={142} style={{ marginTop: 18 }} /> },
  { label: "VELOCIRAPTOR", bg: "radial-gradient(circle at 50% 30%, #FFEFF3 0%, #FF9FB6 100%)", icon: () => <RaptorHead size={146} style={{ marginTop: 20 }} /> },
  { label: "BRAQUIOSAURIO", bg: "radial-gradient(circle at 50% 30%, #F3FFE0 0%, #A8E36B 100%)", icon: () => <BrachioHead size={146} style={{ marginTop: 20 }} /> },
];

const DINO_POS = [
  { x: -292, y: -178 },
  { x: 292, y: -160 },
  { x: -296, y: 190 },
  { x: 296, y: 208 },
];

const BUB = 176;

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
 * Call to action in the style of ExperimentCTA, more compact: a green comment button tapped by
 * a hand (ripples, counter ticking up to `countTo`), four dinosaur bubbles popping in one by
 * one (T-REX, TRICERATOPS, VELOCIRAPTOR, BRAQUIOSAURIO) and a two-line title above ("¿TENDRÍAS
 * UNO / DE MASCOTA?"). `x`, `y` = button centre; the block spans x ± 395 and y - 420 … y + 350,
 * so x = 500, y = 760 keeps it inside the safe area (x 105-895, y 340-1110).
 */
export const DinoCTA: React.FC<{
  frame: number;
  at: number;
  x: number;
  y: number;
  title?: string;
  titleOffset?: { x: number; y: number };
  countTo?: number;
  scale?: number;
  out?: number;
}> = ({ frame, at, x, y, title = "¿TENDRÍAS UNO DE MASCOTA?", titleOffset = { x: 0, y: -334 }, countTo = 4210, scale = 1, out }) => {
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
  const R = 120;
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
              top: titleOffset.y + (i - (n - 1) / 2) * 90,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(i % 2 ? 2.5 : -2.5) * (0.6 + 0.4 * (1 - p)) + Math.sin(t * 0.08 + i) * 0.8}deg)`,
            }}
          >
            <HeavyText text={line} size={84} colors={["#FFFFFF", "#F4FFE0", "#9BE35D"]} />
          </div>
        );
      })}
      {DINOS.map((dn, i) => {
        const pos = DINO_POS[i];
        const p = pop(frame, at + 20 + i * 11, { damping: 9, stiffness: 180 });
        if (p <= 0.001) return null;
        const bob = Math.sin(t * 0.09 + i * 1.7) * 10;
        const ang = Math.atan2(-pos.y, -pos.x);
        return (
          <div
            key={dn.label}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y + bob,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(1 - p) * (i % 2 ? 25 : -25) + Math.sin(t * 0.07 + i) * 3}deg)`,
            }}
          >
            <svg width={220} height={220} viewBox="-110 -110 220 220" style={{ position: "absolute", left: BUB / 2 - 110, top: BUB / 2 - 110, overflow: "visible" }}>
              <g transform={`rotate(${(ang * 180) / Math.PI})`}>
                <path d="M78 -23 L116 0 L78 23 Z" fill="#FFFFFF" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
              </g>
            </svg>
            <div
              style={{
                position: "relative",
                width: BUB,
                height: BUB,
                borderRadius: "50%",
                background: "#FFFFFF",
                border: `7px solid ${INK}`,
                boxSizing: "border-box",
                boxShadow: "0 9px 0 rgba(0,0,0,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: BUB - 26,
                  height: BUB - 26,
                  borderRadius: "50%",
                  background: dn.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {dn.icon()}
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: BUB / 2,
                top: BUB + 2,
                transform: "translateX(-50%)",
                padding: "5px 16px 4px",
                borderRadius: 13,
                background: INK,
                fontFamily: FONT.heavy,
                fontWeight: 900,
                fontSize: 26,
                letterSpacing: 1,
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                boxShadow: "0 5px 0 rgba(0,0,0,0.25)",
              }}
            >
              {dn.label}
            </div>
          </div>
        );
      })}
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
          boxShadow: "0 13px 0 rgba(0,0,0,0.3), 0 26px 46px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${btnIn * (1 - 0.12 * squish)}) rotate(${(1 - btnIn) * -30}deg)`,
        }}
      >
        <CommentBubbleIcon size={154} dot="#139A5B" frame={frame} style={{ marginTop: 8 }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 202,
          transform: `translate(-50%, -50%) scale(${btnIn * (1 + 0.18 * countBump)})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <HeavyText text={fmtNumber(count)} size={72} colors={["#FFFFFF", "#F4FFE0", "#B6F26B"]} />
        <div
          style={{
            marginTop: 14,
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 28,
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
          left: 86,
          top: 28,
          transformOrigin: "0 0",
          transform: `translate(${(1 - handIn) * 380 - handPush * 22}px, ${(1 - handIn) * 170 - handPush * 10}px) rotate(-66deg) scale(${1 - 0.06 * handPush})`,
          opacity: Math.min(1, handIn * 2),
        }}
      >
        <HandPointer size={180} style={{ marginLeft: -72, marginTop: -6 }} />
      </div>
    </div>
  );
};

// =============================================================================================
// RoarWaves

/**
 * Comic roar: three or four jagged shock rings expanding from the mouth at `x`, `y`, speed
 * lines, and "¡ROAAR!" letters bursting out one by one (shaking, on a slight arc) above it
 * (`textOffset`, default 0, -40). Lasts `dur` frames (40). The rings reach r ≈ 540 but fade;
 * the lettering is ~700 x 190 around (x, y - 40).
 */
export const RoarWaves: React.FC<{
  frame: number;
  at: number;
  x: number;
  y: number;
  scale?: number;
  text?: string;
  textOffset?: { x: number; y: number };
  dur?: number;
}> = ({ frame, at, x, y, scale = 1, text = "¡ROAAR!", textOffset = { x: 0, y: -40 }, dur = 40 }) => {
  const d = frame - at;
  if (d < 0 || d > dur) return null;
  const outK = ramp(frame, at + dur - 8, at + dur, [0, 1], EASE_IN);
  const els: React.ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    const di = d - i * 5;
    const L = 22;
    if (di < 0 || di > L) continue;
    const tt = di / L;
    const e = 1 - Math.pow(1 - tt, 2.2);
    const r = 80 + 460 * e;
    const n = 22;
    let path = "";
    for (let j = 0; j < n * 2; j++) {
      const rr = r * (j % 2 === 0 ? 1.08 + rand(i * 50 + j) * 0.06 : 0.9 + rand(i * 70 + j) * 0.04);
      const [px, py] = polar(rr, (j / (n * 2)) * 360 + i * 9);
      path += `${j ? "L" : "M"}${px.toFixed(1)} ${(py * 0.84).toFixed(1)} `;
    }
    path += "Z";
    const w = 1 - tt;
    els.push(<path key={`k${i}`} d={path} fill="none" stroke={INK} strokeWidth={6 + 14 * w} strokeLinejoin="round" opacity={0.85 * (1 - tt * 0.7)} />);
    els.push(<path key={`c${i}`} d={path} fill="none" stroke={i % 2 ? "#FFD60A" : "#FFFFFF"} strokeWidth={2 + 8 * w} strokeLinejoin="round" opacity={1 - tt * 0.7} />);
  }
  const tl = clamp01(d / 18);
  const el = 1 - Math.pow(1 - tl, 2);
  if (tl < 1) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * 360 + 7;
      const r0 = 150 + 240 * el + (i % 2) * 26;
      const len = 120 * (1 - tl) + 10;
      const [x1, y1] = polar(r0, a);
      const [x2, y2] = polar(r0 + len, a);
      els.push(<line key={`l${i}`} x1={x1} y1={y1 * 0.84} x2={x2} y2={y2 * 0.84} stroke={INK} strokeWidth={16 * (1 - tl) + 4} strokeLinecap="round" />);
      els.push(<line key={`m${i}`} x1={x1} y1={y1 * 0.84} x2={x2} y2={y2 * 0.84} stroke="#FFFFFF" strokeWidth={9 * (1 - tl) + 1} strokeLinecap="round" />);
    }
  }
  const letters = Array.from(text);
  const n = letters.length;
  const sh = Math.exp(-d / 12);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none", opacity: 1 - outK }}>
      <svg width={10} height={10} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", transform: `scale(${scale})` }}>
        {els}
      </svg>
      <div
        style={{
          position: "absolute",
          left: textOffset.x * scale,
          top: textOffset.y * scale,
          transform: `translate(-50%, -50%) scale(${scale * (1 + 0.3 * outK)})`,
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        {letters.map((ch, i) => {
          const pi = pop(frame, at + 1 + i * 1.6, { damping: 7, stiffness: 300, mass: 0.5 });
          const c = i - (n - 1) / 2;
          return (
            <div
              key={i}
              style={{
                transform: `translate(${jit(frame, i * 3 + 1, 1) * 6 * sh}px, ${c * c * 5 + jit(frame, i * 3 + 2, 1) * 6 * sh}px) rotate(${c * 4 + (1 - pi) * (i % 2 ? 30 : -30)}deg) scale(${pi})`,
                opacity: pi > 0.02 ? 1 : 0,
              }}
            >
              <HeavyText text={ch} size={i % 2 ? 136 : 150} colors={["#FFF9D6", "#FFC53D", "#FF5A1F"]} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================================
// ChaseVignette

const pulseShape = (ph: number, start: number, dur: number) => (ph >= start && ph <= start + dur ? Math.sin(((ph - start) / dur) * Math.PI) : 0);

/**
 * First-person chase feel (full frame, between `from` and `to`, 10-frame fades): white speed
 * lines streaking out toward the edges (the middle, an ellipse around `cx`, `cy`, stays clear)
 * and a red edge glow that pulses like a racing heartbeat (`bpm`). The clear ellipse has
 * half-axes `clearX` x `clearY` (380 x 640). The hand-held shake is the 3D camera's job.
 */
export const ChaseVignette: React.FC<{
  frame: number;
  from: number;
  to: number;
  intensity?: number;
  cx?: number;
  cy?: number;
  bpm?: number;
  /** Half-width / half-height of the clear ellipse in the middle. */
  clearX?: number;
  clearY?: number;
}> = ({ frame, from, to, intensity = 1, cx = 540, cy = 860, bpm = 128, clearX = 380, clearY = 640 }) => {
  if (frame < from || frame > to) return null;
  const w = windowIn(frame, from, to, 10) * intensity;
  const t = frame - from;
  const period = (60 * 30) / bpm;
  const ph = ((t % period) + period) % period;
  const beat = Math.max(pulseShape(ph, 0, 5), 0.6 * pulseShape(ph, 6, 5));
  const lines: React.ReactNode[] = [];
  const N = 70;
  for (let i = 0; i < N; i++) {
    const life = 4 + Math.floor(rand(i * 3.3) * 4);
    const off = rand(i * 1.1) * life;
    const cyc = Math.floor((t + off) / life);
    const age = ((t + off) % life) / life;
    const sd = i * 13.1 + cyc * 7.7;
    const a = rand(sd) * 360;
    const ar = (a * Math.PI) / 180;
    const re = 1 / Math.sqrt(Math.pow(Math.sin(ar) / clearX, 2) + Math.pow(Math.cos(ar) / clearY, 2));
    const r0 = re * (1 + rand(sd + 1) * 0.3) + age * 140;
    const len = 260 + rand(sd + 2) * 420;
    const wid = 3 + rand(sd + 3) * 10;
    const r1 = r0 + len;
    const da = ((wid / r1) * 180) / Math.PI;
    const [x0, y0] = polar(r0, a);
    const [x1, y1] = polar(r1, a - da);
    const [x2, y2] = polar(r1, a + da);
    const op = (0.35 + 0.5 * rand(sd + 4)) * Math.sin(age * Math.PI);
    lines.push(
      <path key={i} d={`M${(cx + x0).toFixed(1)} ${(cy + y0).toFixed(1)} L${(cx + x1).toFixed(1)} ${(cy + y1).toFixed(1)} L${(cx + x2).toFixed(1)} ${(cy + y2).toFixed(1)} Z`} fill="#FFFFFF" opacity={op} />,
    );
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 72% 58% at ${(cx / 1080) * 100}% ${(cy / 1920) * 100}%, rgba(0,0,0,0) 50%, rgba(110,0,10,${(0.28 + 0.3 * beat) * w}) 100%)`,
        }}
      />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${110 + 90 * beat}px ${10 + 18 * beat}px rgba(255,30,40,${(0.3 + 0.4 * beat) * w})` }} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: w }}>
        {lines}
      </svg>
    </AbsoluteFill>
  );
};
