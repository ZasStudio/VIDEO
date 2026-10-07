import React from "react";
import { AbsoluteFill } from "remotion";
import { EASE_IN, EASE_OUT, clamp01, pop, ramp } from "../../anim";
import { FONT } from "../../theme";
import { HeavyText } from "../inca/HeavyText";
import { TAG_COLORS } from "./TruthTag";

// 2D overlays for "¿Y si tus mentiras salieran sobre tu cabeza?" (1080 x 1920, 30 fps). Same toy-like
// comedy look as the previous shorts: thick ink outlines, white-bordered cards with hard drop
// shadows, Luckiest Guy (HeavyText) for the big punchy words and Montserrat 900 for the UI, in the
// truth tag's colours (bright yellow + red) so the title and the end card read as truth tags too.
// Everything is driven by the global `frame` plus explicit cue frames: no timers, no Math.random,
// no CSS animations. Emoji (😳 ❤️ 💚 👇) are drawn as inline SVG icons, never with an emoji font.
// TikTok safe zone: content inside x 60-940, y 230-1180 (top bar above y 200, the button column
// right of x 940 from y 700, captions at y 1210-1400). Every timed component enters at `at` and is
// gone ~10 frames after `out`. The truth tags themselves are TruthTag.tsx (drawn by the shots).

const K = TAG_COLORS;
const INK = K.ink;
const UI = FONT.heavy;
const SHADOW = `0 0 0 6px ${INK}, 0 12px 0 6px rgba(0,0,0,0.3)`;
const SHADOW_SM = `0 0 0 5px ${INK}, 0 8px 0 5px rgba(0,0,0,0.28)`;
const TXT_WHITE = ["#FFFFFF", "#FFFFFF", "#E6E3F5"];
const TXT_RED = ["#FFE3E6", "#FF6B7A", "#E0102E"];
const TXT_GOLD = ["#FFFBD1", "#FFD21F", "#FF9500"];
const YELLOW_CARD = `linear-gradient(180deg, ${K.yellowTop} 0%, ${K.yellow} 55%, ${K.yellowDeep} 100%)`;

/** The three option colours (the captions of L18: cyan, green, orange). */
export const OPTION_COLORS = [
  { main: "#22B8F0", dark: "#0B86C4", soft: "#D9F3FF" },
  { main: "#2FCB64", dark: "#139A45", soft: "#DDF8E5" },
  { main: "#FF8A1F", dark: "#E05F00", soft: "#FFEBD6" },
] as const;

// =============================================================================================
// Helpers

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
const bump = (frame: number, at: number, dur: number) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

/** Exit progress 0 -> 1 over `dur` frames from `out`. */
const leave = (frame: number, out: number, dur = 9) => ramp(frame, out, out + dur, [0, 1], EASE_IN);

/** Pop-away scale for an exit: a quick swell, then shrink to 0 (k 0..1). */
const popAway = (k: number) => (k < 0.25 ? 1 + 0.12 * (k / 0.25) : 1.12 * (1 - EASE_IN((k - 0.25) / 0.75)));

/** Fast entrance that is complete 4 frames after `at` (a tiny overshoot settles afterwards). */
const snapIn = (frame: number, at: number) => {
  const k = clamp01((frame - at) / 4);
  return 0.35 + 0.65 * EASE_OUT(k) + 0.05 * bump(frame, at + 2, 8);
};

type IconProps = { size?: number; style?: React.CSSProperties };
const svgStyle = (style?: React.CSSProperties): React.CSSProperties => ({ display: "block", overflow: "visible", ...style });

// =============================================================================================
// Icons (inline SVG: there is no emoji font in the headless renderer)

/** 😳: a flushed face, wide eyes, red cheeks, tiny mouth (100 x 100). `look` moves the eyes. */
export const FlushedIcon: React.FC<IconProps & { look?: number }> = ({ size = 100, look = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
    <circle cx={50} cy={52} r={44} fill="#FFC93C" stroke={INK} strokeWidth={6} />
    <path d="M18 40 A34 34 0 0 1 50 14" stroke="#FFE9A0" strokeWidth={7} strokeLinecap="round" fill="none" />
    <ellipse cx={27} cy={66} rx={11} ry={7} fill="#FF6B6B" opacity={0.85} />
    <ellipse cx={73} cy={66} rx={11} ry={7} fill="#FF6B6B" opacity={0.85} />
    {[35, 65].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy={46} r={11.5} fill="#FFFFFF" stroke={INK} strokeWidth={4.5} />
        <circle cx={cx + look * 4} cy={47} r={5.5} fill={INK} />
        <circle cx={cx + look * 4 + 2} cy={44.5} r={1.8} fill="#FFFFFF" />
      </g>
    ))}
    <path d="M24 30 Q31 25 40 28 M60 28 Q69 25 76 30" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
    <ellipse cx={50} cy={74} rx={6} ry={4.5} fill={INK} />
  </svg>
);

/** ❤️ / 💚: a glossy heart (100 x 100) with an ink outline. */
export const HeartIcon: React.FC<IconProps & { color?: string }> = ({ size = 100, color = "#FF3B5C", style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle(style)}>
    <path
      d="M50 90 C22 70 6 54 6 33 C6 18 17 8 31 8 C40 8 47 13 50 21 C53 13 60 8 69 8 C83 8 94 18 94 33 C94 54 78 70 50 90 Z"
      fill={color}
      stroke={INK}
      strokeWidth={7}
      strokeLinejoin="round"
    />
    <ellipse cx={28} cy={30} rx={10} ry={6.5} transform="rotate(-38 28 30)" fill="#FFFFFF" opacity={0.6} />
  </svg>
);

/** 👇: a yellow hand pointing down (100 x 124 at size 124). */
export const PointDownIcon: React.FC<IconProps> = ({ size = 124, style }) => (
  <svg width={size * (100 / 124)} height={size} viewBox="0 0 100 124" style={svgStyle(style)}>
    <g stroke={INK} strokeWidth={7} strokeLinejoin="round">
      <rect x={26} y={6} width={56} height={56} rx={20} fill="#FFCB3D" />
      <rect x={40} y={36} width={21} height={82} rx={10.5} fill="#FFCB3D" />
      <rect x={59} y={44} width={18} height={26} rx={9} fill="#FFCB3D" />
      <rect x={70} y={36} width={15} height={24} rx={7.5} fill="#FFCB3D" />
      <ellipse cx={25} cy={40} rx={11} ry={17} transform="rotate(20 25 40)" fill="#FFCB3D" />
    </g>
    <rect x={26} y={6} width={56} height={56} rx={20} fill="#FFCB3D" />
    <rect x={40} y={36} width={21} height={82} rx={10.5} fill="#FFCB3D" />
    <rect x={59} y={44} width={18} height={26} rx={9} fill="#FFCB3D" />
    <rect x={70} y={36} width={15} height={24} rx={7.5} fill="#FFCB3D" />
    <ellipse cx={25} cy={40} rx={11} ry={17} transform="rotate(20 25 40)" fill="#FFCB3D" />
    <rect x={44} y={99} width={13} height={14} rx={5} fill="#FFF1BF" />
    <path d="M36 14 Q52 9 70 14" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.6} />
  </svg>
);

/**
 * A round office wall clock (100 x 100): `minutes` since 00:00 sets the hands (18:00 = 1080),
 * `shake` (0..1) rattles it like an alarm.
 */
export const ClockIcon: React.FC<IconProps & { minutes?: number; shake?: number; frame?: number }> = ({ size = 100, minutes = 1080, shake = 0, frame = 0, style }) => {
  const h = ((minutes / 60) % 12) * 30;
  const m = (minutes % 60) * 6;
  const wob = shake * Math.sin(frame * 2.3) * 10;
  const hand = (deg: number, len: number) => `M50 52 L${50 + Math.sin((deg * Math.PI) / 180) * len} ${52 - Math.cos((deg * Math.PI) / 180) * len}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle({ transform: `rotate(${wob}deg)`, ...style })}>
      <circle cx={50} cy={52} r={45} fill="#FF4D5E" stroke={INK} strokeWidth={6} />
      <circle cx={50} cy={52} r={35} fill="#FFFFFF" stroke={INK} strokeWidth={4} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r0 = i % 3 === 0 ? 24 : 27;
        return (
          <path
            key={i}
            d={`M${50 + Math.sin(a) * r0} ${52 - Math.cos(a) * r0} L${50 + Math.sin(a) * 30} ${52 - Math.cos(a) * 30}`}
            stroke={INK}
            strokeWidth={i % 3 === 0 ? 4.5 : 2.5}
            strokeLinecap="round"
          />
        );
      })}
      <path d={hand(h, 16)} stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d={hand(m, 24)} stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      <circle cx={50} cy={52} r={4.5} fill="#FF4D5E" stroke={INK} strokeWidth={2.5} />
      <path d="M22 34 Q30 22 44 19" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.9} />
    </svg>
  );
};

/** ✓✓: the chat double tick (`read` = blue), 100 x 60 box. */
const DoubleTick: React.FC<{ size?: number; read?: boolean }> = ({ size = 40, read = true }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 100 60" style={svgStyle()}>
    {[0, 28].map((dx) => (
      <path key={dx} d={`M${8 + dx} 32 L${26 + dx} 50 L${64 + dx} 10`} stroke={read ? "#1E9BFF" : "#9AA2B5"} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    ))}
  </svg>
);

/** 💦: a blue sweat drop (60 x 80). */
const SweatDrop: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <svg width={size} height={size * (80 / 60)} viewBox="0 0 60 80" style={svgStyle()}>
    <path d="M30 4 C40 24 54 38 54 52 C54 66 43 76 30 76 C17 76 6 66 6 52 C6 38 20 24 30 4 Z" fill="#6CCBFF" stroke={INK} strokeWidth={5.5} strokeLinejoin="round" />
    <path d="M18 50 Q18 40 25 33" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" fill="none" />
  </svg>
);

/** Mini Nubi avatar (green cube face), 100 x 100. */
const NubiAvatar: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={svgStyle()}>
    <circle cx={50} cy={50} r={47} fill="#BFF3C9" stroke={INK} strokeWidth={5} />
    <rect x={20} y={24} width={60} height={56} rx={14} fill="#5FD27A" stroke={INK} strokeWidth={5} />
    <rect x={35} y={44} width={8} height={12} rx={2} fill={INK} />
    <rect x={57} y={44} width={8} height={12} rx={2} fill={INK} />
    <rect x={26} y={29} width={30} height={7} rx={3.5} fill="#FFFFFF" opacity={0.45} />
  </svg>
);

/** A soft dark scrim behind top-band text (readable over any shot). */
const Scrim: React.FC<{ top: number; height: number; opacity: number }> = ({ top, height, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: -40,
      top,
      width: 1160,
      height,
      background: "radial-gradient(closest-side, rgba(20,12,45,0.5), rgba(20,12,45,0.26) 62%, rgba(20,12,45,0))",
      opacity,
    }}
  />
);

/** A yellow truth-tag-style card (white rim, ink outline, hard shadow) with an optional pointer. */
const YellowCard: React.FC<{ w: number; h: number; tail?: boolean; children?: React.ReactNode; style?: React.CSSProperties }> = ({ w, h, tail = true, children, style }) => (
  <div style={{ position: "relative", width: w, height: h, ...style }}>
    {tail ? (
      <svg width={70} height={44} viewBox="0 0 70 44" style={{ position: "absolute", left: w / 2 - 35, top: h - 6, overflow: "visible" }}>
        <path d="M6 2 L35 38 L64 2" fill={K.yellowDeep} stroke={INK} strokeWidth={17} strokeLinejoin="round" />
        <path d="M6 2 L35 38 L64 2" fill={K.yellowDeep} stroke="#FFFFFF" strokeWidth={6} strokeLinejoin="round" />
        <rect x={4} y={-12} width={62} height={14} fill={K.yellowDeep} />
      </svg>
    ) : null}
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 26,
        background: YELLOW_CARD,
        border: "6px solid #FFFFFF",
        boxShadow: SHADOW,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 12, right: 12, top: 3, height: "38%", borderRadius: 999, background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 6px, rgba(255,255,255,0.28) 6px, rgba(255,255,255,0.28) 8px)",
        }}
      />
    </div>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
  </div>
);

/** Luckiest Guy ink text (truth-tag style), caps vertically centred in a `size`-tall box. */
const TagText: React.FC<{ text: string; size: number; color?: string }> = ({ text, size, color = INK }) => (
  <div
    style={{
      fontFamily: FONT.title,
      fontSize: size,
      lineHeight: `${size}px`,
      height: size * 0.72,
      color,
      whiteSpace: "nowrap",
      textShadow: `0 ${Math.round(size * 0.06)}px 0 rgba(214,120,0,0.42)`,
      paddingTop: size * 0.0,
      marginTop: -size * 0.02,
    }}
  >
    {text}
  </div>
);

// =============================================================================================
// 1. TitleSticker

/**
 * The hook title in the top band (x ~95-905, y ~240-430): «¿Y SI TUS MENTIRAS 😳» (white, MENTIRAS
 * in red, a flushed face) over «SALIERAN SOBRE TU CABEZA?» in ink on a yellow truth-tag card with a
 * pointer (the title is itself a truth tag). Complete 4 frames after `at`: use at = -4 so frame 0
 * (the cover) is fully drawn. A soft dark scrim keeps it readable. Leaves line by line with a quick
 * pop at `out` (gone 10 frames later). Suggested: at -4, out GANCHO.L02 - 6 or GANCHO.CABEZA.
 */
export const TitleSticker: React.FC<{ frame: number; at: number; out: number }> = ({ frame, at, out }) => {
  if (frame < at || frame > out + 12) return null;
  const t = frame - at;
  const scrim = ramp(frame, at, at + 3) * (1 - ramp(frame, out, out + 12));
  const s1 = snapIn(frame, at);
  const s2 = snapIn(frame, at + 1);
  const ic = snapIn(frame, at + 2);
  const wipe = ramp(frame, at, at + 4, [0, 1], EASE_OUT);
  const k1 = clamp01((frame - out) / 8);
  const k2 = clamp01((frame - out - 2) / 8);
  const L1 = 80;
  const L2 = 60;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Scrim top={170} height={330} opacity={scrim} />
      {k1 < 1 ? (
        <div
          style={{
            position: "absolute",
            left: 500,
            top: 288,
            transform: `translate(-50%, -50%) scale(${s1 * popAway(k1)}) rotate(${-2 + Math.sin(t * 0.07) * 0.6}deg)`,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ position: "relative", paddingTop: L1 * 0.06, display: "flex", gap: L1 * 0.22 }}>
            <HeavyText text="¿Y SI TUS" size={L1} colors={TXT_WHITE} stroke={INK} />
            <HeavyText text="MENTIRAS" size={L1} colors={TXT_RED} stroke={INK} />
          </div>
          <div style={{ transform: `scale(${ic}) rotate(${10 + Math.sin(t * 0.12) * 6}deg) translateY(${-6 + Math.sin(t * 0.16) * 4}px)` }}>
            <FlushedIcon size={92} look={Math.sin(t * 0.09) * 0.8} />
          </div>
        </div>
      ) : null}
      {k2 < 1 ? (
        <div
          style={{
            position: "absolute",
            left: 500,
            top: 384,
            transform: `translate(-50%, -50%) scale(${s2 * popAway(k2)}) rotate(${1.2 + Math.sin(t * 0.07 + 1.3) * 0.5}deg)`,
          }}
        >
          <YellowCard w={820} h={86} style={{ transform: `scaleX(${0.3 + 0.7 * wipe})` }}>
            <TagText text="SALIERAN SOBRE TU CABEZA?" size={L2} />
          </YellowCard>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 2. ChatBubble

/**
 * The message the date reads on her phone: a mini chat card (~600 x 300 at scale 1) with a header
 * (Nubi's avatar, «Nubi 💚», «21:04») and a green bubble «Eres la persona más especial que conozco
 * ❤️» with a double tick (it turns blue = read). (x, y) is the CENTRE of the card; `scale`
 * multiplies its size around it (readable down to ~0.7). Pops in at `at` (the bubble ~5 frames
 * later, the heart beats), shrinks away at `out` (gone 9 frames later). Suggested: at CITA.BUBBLE,
 * out CITA.L11 - 4 (before the tag), beside her head, e.g. x 640, y 520.
 */
export const ChatBubble: React.FC<{ frame: number; at: number; out: number; x?: number; y?: number; scale?: number }> = ({
  frame,
  at,
  out,
  x = 540,
  y = 520,
  scale = 1,
}) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const p = pop(frame, at, { damping: 12, stiffness: 190, mass: 0.7 });
  const k = leave(frame, out, 9);
  const b = pop(frame, at + 5, { damping: 10, stiffness: 220, mass: 0.6 });
  const beat = 1 + 0.18 * Math.max(0, Math.sin(Math.max(0, t - 8) * 0.42)) ** 6;
  const read = frame >= at + 16;
  const W = 600;
  const H = 300;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `scale(${scale * (0.6 + 0.4 * p) * (1 - 0.85 * k)})`,
        opacity: clamp01(p * 3) * (1 - k),
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -W / 2,
          top: -H / 2 + (1 - Math.min(1, p)) * 40,
          width: W,
          height: H,
          borderRadius: 34,
          background: "#FFFFFF",
          boxShadow: SHADOW,
          overflow: "hidden",
          fontFamily: UI,
          transform: `rotate(${-2 + Math.sin(t * 0.08) * 0.6}deg)`,
        }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 92, display: "flex", alignItems: "center", gap: 16, padding: "0 26px", background: "#FFFFFF", borderBottom: "3px solid #E6E9F0" }}>
          <NubiAvatar size={62} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 38, color: INK, lineHeight: 1 }}>
            Nubi
            <HeartIcon size={34} color="#2FCB64" />
          </div>
          <div style={{ marginLeft: "auto", fontWeight: 800, fontSize: 28, color: "#8A91A6", fontVariantNumeric: "tabular-nums" }}>21:04</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 92, bottom: 0, background: "linear-gradient(180deg, #F3EEE6, #ECE5DA)" }}>
          <div
            style={{
              position: "absolute",
              left: 24,
              top: 24,
              padding: "16px 22px 12px 24px",
              borderRadius: 28,
              borderTopLeftRadius: 8,
              background: "linear-gradient(180deg, #D8FBC8 0%, #BDF3A8 100%)",
              boxShadow: `0 0 0 4px ${INK}, 0 6px 0 4px rgba(0,0,0,0.18)`,
              transform: `scale(${b})`,
              transformOrigin: "0 0",
              opacity: clamp01(b * 3),
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 36, lineHeight: 1.22, color: INK, whiteSpace: "nowrap" }}>
              Eres la persona más
              <br />
              especial que conozco
              <span style={{ display: "inline-block", verticalAlign: -6, marginLeft: 10, transform: `scale(${beat})` }}>
                <HeartIcon size={38} />
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 4, fontWeight: 700, fontSize: 22, color: "#4F7D52" }}>
              21:04
              <DoubleTick size={36} read={read} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// 3. ClockStamp

/**
 * «18:00 · HORA DE SALIDA» stamped in the top band (centre x 500, y 320; ~790 x 125): a navy badge
 * (white rim, ink outline) with a red wall clock whose hands spin to 6:00 and ring, «18:00» in big
 * gold letters and «HORA DE SALIDA» in white. Slams in like a rubber stamp at `at` (shock ring,
 * squash), shrinks away at `out` (gone 9 frames later). Suggested: at JEFE.START + 2, out JEFE.L13
 * + 30 (or JEFE.TAG - 6).
 */
export const ClockStamp: React.FC<{ frame: number; at: number; out: number; y?: number }> = ({ frame, at, out, y = 320 }) => {
  if (frame < at || frame > out + 10) return null;
  const t = frame - at;
  const SLAM = 4;
  const fall = ramp(frame, at, at + SLAM, [0, 1], EASE_IN);
  const landed = t >= SLAM;
  const base = landed ? 1 : 2.2 - 1.2 * fall;
  const sq = bump(frame, at + SLAM - 1, 7);
  const settle = landed ? pop(frame, at + SLAM, { damping: 8, stiffness: 260 }) : 0;
  const k = clamp01((frame - out) / 9);
  const ringK = landed ? clamp01((t - SLAM) / 11) : -1;
  const spin = ramp(frame, at, at + 10, [0, 1], EASE_OUT);
  const minutes = 1080 - (1 - spin) * 720;
  const shake = landed ? Math.max(0, 1 - (t - SLAM) / 16) : 0;
  const rot = -2 + (landed ? (1 - settle) * 5 : 6 * (1 - fall)) + Math.sin(t * 0.08) * 0.6;
  return (
    <div
      style={{
        position: "absolute",
        left: 500,
        top: y,
        width: 0,
        height: 0,
        transform: `scale(${popAway(k)})`,
        opacity: Math.min(1, fall * 3) * (1 - clamp01((k - 0.7) / 0.3)),
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(-50%, -50%) scale(${base * (1 + 0.1 * sq)}, ${base * (1 - 0.12 * sq)}) rotate(${rot}deg)`,
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 112,
          padding: "0 34px 0 14px",
          borderRadius: 999,
          background: "linear-gradient(180deg, #3D49B8 0%, #262C7A 100%)",
          border: "6px solid #FFFFFF",
          boxShadow: SHADOW,
          whiteSpace: "nowrap",
        }}
      >
        {ringK >= 0 && ringK < 1 ? (
          <div
            style={{
              position: "absolute",
              inset: -20,
              borderRadius: 999,
              border: `${14 * (1 - ringK)}px solid #FFFFFF`,
              transform: `scale(${1 + 0.25 * EASE_OUT(ringK)}, ${1 + 0.6 * EASE_OUT(ringK)})`,
              opacity: 1 - ringK,
            }}
          />
        ) : null}
        <div style={{ marginTop: -6, marginBottom: -6 }}>
          <ClockIcon size={100} minutes={minutes} shake={shake} frame={frame} />
        </div>
        <div style={{ position: "relative", paddingTop: 76 * 0.06 }}>
          <HeavyText text="18:00" size={76} colors={TXT_GOLD} stroke={INK} />
        </div>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: "#FFFFFF", boxShadow: `0 0 0 4px ${INK}` }} />
        <div style={{ fontFamily: UI, fontWeight: 900, fontSize: 38, lineHeight: 1, color: "#FFFFFF", letterSpacing: 1, textShadow: `0 4px 0 ${INK}` }}>HORA DE SALIDA</div>
      </div>
    </div>
  );
};

// =============================================================================================
// 4. OptionCards

const OPTIONS = ["“ESTOY LLEGANDO”", "“YA TE PAGUÉ”", "“NO ME PASA NADA”"];

/**
 * The three lies of the final question, stacked in the top band (x ~150-850, y ~240-630): «1 ·
 * "ESTOY LLEGANDO"» (cyan), «2 · "YA TE PAGUÉ"» (green), «3 · "NO ME PASA NADA"» (orange), each a
 * white-rimmed card with a big number badge. Each pops in at its own frame (at1, at2, at3). At
 * `poke` (optional) card 3 does a guilty wobble and sweats. All leave at `out` (staggered pop away,
 * gone ~12 frames later). Suggested: at1 FINAL.OPT1, at2 FINAL.OPT2, at3 FINAL.OPT3, poke FINAL.L19
 * + 10, out FINAL.TAG - 4 (or FINAL.CARD - 4).
 */
export const OptionCards: React.FC<{ frame: number; at1: number; at2: number; at3: number; out: number; poke?: number }> = ({ frame, at1, at2, at3, out, poke }) => {
  if (frame < Math.min(at1, at2, at3) || frame > out + 14) return null;
  const ats = [at1, at2, at3];
  const ys = [300, 430, 560];
  const xs = [490, 512, 494];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {ats.map((a, i) => {
        if (frame < a) return null;
        const t = frame - a;
        const p = pop(frame, a, { damping: 10, stiffness: 210, mass: 0.6 });
        const k = clamp01((frame - out - i * 2) / 8);
        if (k >= 1) return null;
        const c = OPTION_COLORS[i];
        let rot = (i === 1 ? 1.4 : -1.4) + Math.sin(t * 0.07 + i) * 0.5 + (1 - Math.min(1, p)) * (i % 2 ? 10 : -10);
        let dx = (1 - Math.min(1, p)) * -120;
        let sweat: React.ReactNode = null;
        if (i === 2 && poke !== undefined && frame >= poke) {
          const d = frame - poke;
          const w = Math.exp(-d / 12);
          rot += 7 * w * Math.sin(d * 0.95);
          dx += 10 * w * Math.sin(d * 1.3);
          const sp = pop(frame, poke + 2, { damping: 9, stiffness: 220, mass: 0.5 });
          const slide = ramp(frame, poke + 8, poke + 34, [0, 1], EASE_IN);
          if (slide < 1) {
            sweat = (
              <div style={{ position: "absolute", right: 30, top: -40 + slide * 70, transform: `scale(${sp})`, opacity: 1 - clamp01((slide - 0.7) / 0.3) }}>
                <SweatDrop size={46} />
              </div>
            );
          }
        }
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: xs[i] + dx,
              top: ys[i],
              transform: `translate(-50%, -50%) scale(${(0.5 + 0.5 * p) * popAway(k)}) rotate(${rot}deg)`,
              opacity: clamp01(p * 3) * (1 - clamp01((k - 0.7) / 0.3)),
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 20,
                width: 700,
                height: 106,
                boxSizing: "border-box",
                padding: "0 24px 0 14px",
                borderRadius: 30,
                background: `linear-gradient(180deg, #FFFFFF 0%, ${c.soft} 100%)`,
                border: "6px solid #FFFFFF",
                boxShadow: SHADOW,
              }}
            >
              <div
                style={{
                  width: 78,
                  height: 78,
                  flexShrink: 0,
                  borderRadius: 39,
                  background: `linear-gradient(180deg, ${c.main} 0%, ${c.dark} 100%)`,
                  boxShadow: `0 0 0 5px ${INK}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ position: "relative", paddingTop: 62 * 0.06, marginTop: 4 }}>
                  <HeavyText text={String(i + 1)} size={62} colors={TXT_WHITE} stroke={INK} />
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", justifyContent: "center", marginTop: 6 }}>
                <TagText text={OPTIONS[i]} size={54} />
              </div>
              {sweat}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// =============================================================================================
// 5. EndCard

/**
 * The comment bait over the last shot (top band, y ~240-560; not opaque: the video loops):
 * «¿CUÁL SALDRÍA» in big white letters over «SOBRE TU CABEZA?» on a yellow truth-tag card, and a
 * white pill «COMENTA ① ② O ③ 👇» (the numbers in the option colours, a bouncing hand). A soft
 * scrim keeps it readable. Lands within ~10 frames of `at` and stays to the end. Suggested: at
 * FINAL.CARD.
 */
export const EndCard: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  if (frame < at) return null;
  const t = frame - at;
  const scrim = ramp(frame, at, at + 8);
  const p1 = pop(frame, at, { damping: 10, stiffness: 210 });
  const p2 = pop(frame, at + 3, { damping: 10, stiffness: 210 });
  const p3 = pop(frame, at + 7, { damping: 10, stiffness: 220 });
  const hop = Math.abs(Math.sin(t * 0.22)) * 10;
  const badge = (n: number) => {
    const c = OPTION_COLORS[n - 1];
    const bp = pop(frame, at + 9 + n * 2, { damping: 8, stiffness: 260, mass: 0.5 });
    return (
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: `linear-gradient(180deg, ${c.main} 0%, ${c.dark} 100%)`,
          boxShadow: `0 0 0 4px ${INK}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${bp}) translateY(${Math.sin(t * 0.2 + n) * 2}px)`,
        }}
      >
        <div style={{ position: "relative", paddingTop: 44 * 0.06, marginTop: 3 }}>
          <HeavyText text={String(n)} size={44} colors={TXT_WHITE} stroke={INK} />
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Scrim top={160} height={480} opacity={scrim} />
      <div style={{ position: "absolute", left: 500, top: 272, transform: `translate(-50%, -50%) scale(${p1}) rotate(${-2 + Math.sin(t * 0.07) * 0.6}deg)`, opacity: Math.min(1, p1 * 3) }}>
        <div style={{ position: "relative", paddingTop: 88 * 0.06 }}>
          <HeavyText text="¿CUÁL SALDRÍA" size={88} colors={TXT_WHITE} stroke={INK} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 500, top: 374, transform: `translate(-50%, -50%) scale(${p2}) rotate(${1.5 + Math.sin(t * 0.07 + 1.3) * 0.5}deg)`, opacity: Math.min(1, p2 * 3) }}>
        <YellowCard w={680} h={94}>
          <TagText text="SOBRE TU CABEZA?" size={70} />
        </YellowCard>
      </div>
      <div
        style={{
          position: "absolute",
          left: 500,
          top: 514,
          transform: `translate(-50%, -50%) scale(${p3})`,
          opacity: Math.min(1, p3 * 3),
          display: "flex",
          alignItems: "center",
          gap: 14,
          height: 78,
          padding: "0 26px 0 34px",
          borderRadius: 999,
          background: "#FFFFFF",
          boxShadow: SHADOW_SM,
          fontFamily: UI,
          fontWeight: 900,
          fontSize: 44,
          lineHeight: 1,
          color: INK,
          whiteSpace: "nowrap",
        }}
      >
        COMENTA
        {badge(1)}
        {badge(2)}
        <span>O</span>
        {badge(3)}
        <div style={{ height: 56, marginTop: -14, transform: `translateY(${hop - 6}px)` }}>
          <PointDownIcon size={70} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
