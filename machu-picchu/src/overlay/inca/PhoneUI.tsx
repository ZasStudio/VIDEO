import React from "react";
import { AbsoluteFill } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, rand } from "../../anim";
import { FONT } from "../../theme";
import { fmtNumber } from "../Graphics";
import { HeavyText } from "./HeavyText";
import {
  AppPapaIcon,
  BackChevron,
  BatteryIcon,
  CastleIcon,
  ChasquiChatIcon,
  ChasquiFace,
  CommentBubbleIcon,
  CrownIcon,
  DinoIcon,
  FlipCamIcon,
  HandPointer,
  INK,
  LlamaHead,
  MachuThumb,
  PinIcon,
  PotatoFace,
  PyramidIcon,
  QuipuIcon,
  RainCloud,
  RocketIcon,
  SendIcon,
  SignalIcon,
  SproutIcon,
  SunFace,
} from "./icons";

// 2D phone UI for "¿Así sería vivir en el Imperio Inca con celular?" (1080 x 1920).
// Everything is driven by a global `frame` plus explicit cue frames (at, out, typingFrom…).
// ChasquiChat is an original messenger (orange-to-red header, llama logo, quipu-knot ticks).

const useUid = () => React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

/** Rounded-rectangle path, used to cut rings (even-odd) for the phone body. */
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
const bump = (frame: number, at: number, dur: number) => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

// =============================================================================================
// PhoneFrame

export const PHONE_W = 620;
export const PHONE_H = 1240;
const RIM = 8;
const BEZEL = 18;
const OUTER_R = 98;
/** Screen size inside the frame (children are laid out in this box). */
export const SCREEN_W = PHONE_W - 2 * (RIM + BEZEL);
export const SCREEN_H = PHONE_H - 2 * (RIM + BEZEL);
const SCREEN_R = OUTER_R - RIM - BEZEL;
/** Height of the status bar drawn over the top of the screen. */
export const STATUS_H = 56;

const StatusBar: React.FC<{ color: string; time: string; shadow?: boolean }> = ({ color, time, shadow }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: STATUS_H,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "4px 44px 0 50px",
      boxSizing: "border-box",
      pointerEvents: "none",
      filter: shadow ? "drop-shadow(0 2px 3px rgba(0,0,0,0.6))" : undefined,
    }}
  >
    <div style={{ fontFamily: FONT.heavy, fontWeight: 800, fontSize: 26, color }}>{time}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <SignalIcon size={28} color={color} />
      <BatteryIcon size={42} color={color} />
    </div>
  </div>
);

/**
 * Big 2D smartphone (620 x 1240 at scale 1) that springs up from below at `at` and drops away at
 * `out`. `x`, `y` = centre of the phone in the frame. The screen (SCREEN_W x SCREEN_H) renders
 * `children`; with `transparent` the screen is see-through so a 3D scene behind shows.
 */
export const PhoneFrame: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  scale?: number;
  children?: React.ReactNode;
  transparent?: boolean;
  /** Screen background when not transparent. */
  screen?: string;
  statusBar?: "light" | "dark" | "none";
  time?: string;
  /** Resting rotation in degrees. */
  tilt?: number;
  /** Gentle idle floating. */
  float?: boolean;
}> = ({
  frame,
  at,
  out,
  x,
  y,
  scale = 1,
  children,
  transparent = false,
  screen = "#FFF4E6",
  statusBar = "light",
  time = "10:32",
  tilt = 0,
  float = true,
}) => {
  const uid = useUid();
  if (frame < at || frame > out + 16) return null;
  const p = pop(frame, at, { damping: 14, stiffness: 110, mass: 0.9 });
  const k = ramp(frame, out, out + 15, [0, 1], EASE_IN);
  const t = frame - at;
  const bob = float ? Math.sin(t * 0.07) * 7 : 0;
  const ty = (1 - p) * 1450 + k * 2100 + bob;
  const rot = tilt + (1 - p) * 16 - k * 12 + (float ? Math.sin(t * 0.05 + 1) * 0.7 : 0);
  const sweep = ramp(frame, at + 8, at + 30, [0, 1], EASE_IN_OUT);
  const W = PHONE_W;
  const H = PHONE_H;
  const sideBtn = (side: "left" | "right", top: number, h: number): React.CSSProperties => ({
    position: "absolute",
    [side]: -11,
    top,
    width: 18,
    height: h,
    borderRadius: 8,
    background: "#262A32",
    border: "4px solid #fff",
    boxSizing: "border-box",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x - W / 2,
        top: y - H / 2,
        width: W,
        height: H,
        transform: `translateY(${ty}px) rotate(${rot}deg) scale(${scale})`,
      }}
    >
      <div style={sideBtn("left", 300, 110)} />
      <div style={sideBtn("left", 430, 110)} />
      <div style={sideBtn("right", 360, 170)} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: OUTER_R,
          boxShadow: "0 18px 0 rgba(0,0,0,0.28), 0 44px 80px rgba(0,0,0,0.42)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: RIM + BEZEL,
          top: RIM + BEZEL,
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: SCREEN_R,
          overflow: "hidden",
          background: transparent ? "transparent" : screen,
        }}
      >
        {children}
        {statusBar !== "none" ? (
          <StatusBar color={statusBar === "light" ? "#FFFFFF" : "#2B1A10"} time={time} shadow={transparent} />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(118deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.06) 100%)",
          }}
        />
        {sweep > 0 && sweep < 1 ? (
          <div
            style={{
              position: "absolute",
              top: -300,
              height: SCREEN_H + 600,
              width: 190,
              left: -300 + sweep * (SCREEN_W + 600),
              transform: "rotate(20deg)",
              background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.38), rgba(255,255,255,0))",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id={`bz${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#434957" />
            <stop offset="0.35" stopColor="#15171C" />
            <stop offset="0.7" stopColor="#101216" />
            <stop offset="1" stopColor="#343844" />
          </linearGradient>
        </defs>
        <path d={rr(0, 0, W, H, OUTER_R) + rr(RIM, RIM, W - 2 * RIM, H - 2 * RIM, OUTER_R - RIM)} fill="#FFFFFF" fillRule="evenodd" />
        <path
          d={
            rr(RIM, RIM, W - 2 * RIM, H - 2 * RIM, OUTER_R - RIM) +
            rr(RIM + BEZEL, RIM + BEZEL, SCREEN_W, SCREEN_H, SCREEN_R)
          }
          fill={`url(#bz${uid})`}
          fillRule="evenodd"
        />
        <path
          d={rr(RIM + 3, RIM + 3, W - 2 * RIM - 6, H - 2 * RIM - 6, OUTER_R - RIM - 3)}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={2}
        />
        <circle cx={W / 2} cy={RIM + BEZEL + 30} r={14} fill="#050608" stroke="#23262E" strokeWidth={3} />
        <circle cx={W / 2 - 4} cy={RIM + BEZEL + 26} r={4} fill="#34425F" />
      </svg>
    </div>
  );
};

// =============================================================================================
// ChatScreen (ChasquiChat)

export type AvatarKind = "crown" | "chasqui" | "llama" | "quipu" | "sun" | "potato";
export type ChatContact = { name: string; avatar?: AvatarKind; status?: string };
export type ChatMessage = {
  /** Frame the bubble pops into the chat (for "me" with typingFrom: the moment it is sent). */
  at: number;
  from: "me" | "them";
  text?: string;
  kind?: "text" | "location";
  /** "me": types in the input bar from here to `at`. "them": shows the typing dots from here. */
  typingFrom?: number;
  /** Place name of a location card (falls back to `text`). */
  place?: string;
  /** Timestamp label (defaults to the screen's `time`). */
  time?: string;
  /** "me": frame the quipu ticks turn turquoise (read). Defaults to at + 18. */
  readAt?: number;
};

const AVATAR_BG: Record<AvatarKind, string> = {
  crown: "radial-gradient(circle at 50% 30%, #FF7A7A 0%, #C81D4E 58%, #6E0C35 100%)",
  chasqui: "radial-gradient(circle at 50% 30%, #8FF5E6 0%, #17B3A3 62%, #0A6F66 100%)",
  llama: "radial-gradient(circle at 50% 30%, #FFD08A 0%, #FF8A3D 70%, #E0262B 100%)",
  quipu: "radial-gradient(circle at 50% 30%, #FFF6E2 0%, #F2D3A2 100%)",
  sun: "radial-gradient(circle at 50% 30%, #9ADBFF 0%, #2F8CFF 100%)",
  potato: "radial-gradient(circle at 50% 30%, #D2F79A 0%, #3BB85E 100%)",
};

/** Round contact avatar with a white ring. */
export const Avatar: React.FC<{ kind?: AvatarKind; size?: number; border?: number }> = ({
  kind = "llama",
  size = 84,
  border = 4,
}) => {
  const inner = size - 2 * border;
  const icon =
    kind === "crown" ? (
      <CrownIcon size={inner * 0.92} style={{ marginTop: inner * 0.06 }} />
    ) : kind === "chasqui" ? (
      <ChasquiFace size={inner * 0.96} style={{ marginTop: inner * 0.08 }} />
    ) : kind === "quipu" ? (
      <QuipuIcon size={inner * 0.8} />
    ) : kind === "sun" ? (
      <SunFace size={inner * 0.94} />
    ) : kind === "potato" ? (
      <PotatoFace size={inner * 0.9} />
    ) : (
      <LlamaHead size={inner * 0.92} outline={INK} style={{ marginTop: inner * 0.14 }} />
    );
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${border}px solid #fff`,
        background: AVATAR_BG[kind],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        boxSizing: "border-box",
        flexShrink: 0,
        boxShadow: "0 4px 0 rgba(0,0,0,0.2)",
      }}
    >
      {icon}
    </div>
  );
};

/** Frame at which each character of `text` appears when typed between `from` and `to`. */
const typedTimes = (text: string, from: number, to: number, seed: number) => {
  const w: number[] = [];
  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const base = c === " " ? 1.6 : c === "," || c === "." || c === "!" || c === "?" ? 2.2 : 1;
    const wi = base * (0.6 + 0.8 * rand(seed * 13.7 + i * 1.91));
    w.push(wi);
    sum += wi;
  }
  const times: number[] = [];
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    times.push(from + ((to - from) * acc) / sum);
  }
  return times;
};

const KB_ROWS = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];
const keyOf = (c: string) => {
  if (c === " ") return "space";
  const u = c.toUpperCase();
  if (u === "Ñ") return "Ñ";
  const base = u.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /^[A-Z]$/.test(base) ? base : "sym";
};

const KB_H = 334;

const Key: React.FC<{ label?: React.ReactNode; flex?: number; pressed?: string | null; special?: boolean; popup?: string }> = ({
  label,
  flex = 1,
  pressed,
  special,
  popup,
}) => {
  const on = Boolean(pressed);
  return (
    <div
      style={{
        position: "relative",
        flex,
        height: 58,
        borderRadius: 10,
        background: on ? "#FF7A3D" : special ? "#E8D6BF" : "#FFFDF8",
        boxShadow: on ? "0 2px 0 #C4521F" : "0 3px 0 #CDB597",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT.heavy,
        fontWeight: 700,
        fontSize: special ? 20 : 26,
        color: on ? "#fff" : "#3A2A1E",
        transform: on ? "translateY(2px)" : undefined,
      }}
    >
      {label}
      {on && popup ? (
        <div
          style={{
            position: "absolute",
            bottom: 50,
            left: "50%",
            width: 78,
            height: 100,
            marginLeft: -39,
            borderRadius: 16,
            background: "#FFFFFF",
            border: "3px solid #FF7A3D",
            boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 8,
            boxSizing: "border-box",
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 50,
            color: "#E4512A",
            zIndex: 3,
          }}
        >
          {popup}
        </div>
      ) : null}
    </div>
  );
};

/** Simplified Spanish keyboard; the key being typed lights up with a letter preview. */
const Keyboard: React.FC<{ pressedChar: string | null; words: string[] }> = ({ pressedChar, words }) => {
  const key = pressedChar ? keyOf(pressedChar) : null;
  const letter = (c: string) => (
    <Key key={c} label={c} pressed={key === c ? c : null} popup={pressedChar ? pressedChar.toUpperCase() : undefined} />
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: SCREEN_W,
        height: KB_H,
        background: "#F4E6D4",
        borderTop: "2px solid #E3CCAE",
        boxSizing: "border-box",
        padding: "0 7px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          fontFamily: FONT.heavy,
          fontWeight: 700,
          fontSize: 24,
          color: "#8A6D52",
        }}
      >
        {words.map((w, i) => (
          <React.Fragment key={w}>
            {i ? <div style={{ width: 2, height: 26, background: "#DCC4A6" }} /> : null}
            <span style={{ fontWeight: i === 1 ? 800 : 700, color: i === 1 ? "#5A3E28" : "#8A6D52" }}>{w}</span>
          </React.Fragment>
        ))}
      </div>
      {KB_ROWS.map((row, r) => (
        <div key={row} style={{ display: "flex", gap: 6, padding: r === 1 ? "0 0" : undefined }}>
          {r === 2 ? (
            <Key
              flex={1.5}
              special
              label={
                <svg width={28} height={28} viewBox="0 0 28 28">
                  <path d="M14 4 L25 16 L19 16 L19 24 L9 24 L9 16 L3 16 Z" fill="none" stroke="#3A2A1E" strokeWidth={2.5} strokeLinejoin="round" />
                </svg>
              }
            />
          ) : null}
          {row.split("").map(letter)}
          {r === 2 ? (
            <Key
              flex={1.5}
              special
              label={
                <svg width={34} height={26} viewBox="0 0 34 26">
                  <path d="M11 3 L31 3 L31 23 L11 23 L2 13 Z" fill="none" stroke="#3A2A1E" strokeWidth={2.5} strokeLinejoin="round" />
                  <path d="M16 9 L24 17 M24 9 L16 17" stroke="#3A2A1E" strokeWidth={2.5} strokeLinecap="round" />
                </svg>
              }
            />
          ) : null}
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <Key flex={1.6} special label="123" pressed={key === "sym" ? "sym" : null} />
        <Key flex={5.6} label="espacio" special={false} pressed={key === "space" ? "space" : null} />
        <Key flex={1} label="." />
        <Key
          flex={1.6}
          special
          label={
            <svg width={30} height={26} viewBox="0 0 30 26">
              <path d="M25 3 L25 15 L6 15 M12 8 L5 15 L12 22" fill="none" stroke="#3A2A1E" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </div>
    </div>
  );
};

/** Grows a chat row from 0 to its natural height (k in 0..1) without measuring text. */
const Grow: React.FC<{ k: number; children: React.ReactNode }> = ({ k, children }) => (
  <div style={{ display: "grid", gridTemplateRows: `${Math.max(0, k)}fr`, flexShrink: 0 }}>
    <div style={{ minHeight: 0 }}>{children}</div>
  </div>
);

/** Read ticks, ChasquiChat style: little quipu knots on a cord (1 = sent, 2 = delivered, teal = read). */
const QuipuTicks: React.FC<{ frame: number; at: number; readAt: number }> = ({ frame, at, readAt }) => {
  const two = frame >= at + 5;
  const read = frame >= readAt;
  const col = read ? "#0FB5A6" : "#A0826A";
  const s = 1 + 0.35 * bump(frame, readAt, 8);
  return (
    <svg width={46} height={22} viewBox="0 0 46 22" style={{ transform: `scale(${s})`, marginLeft: 6 }}>
      <path d="M2 11 Q23 5 44 11" stroke={col} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={16} cy={9.5} r={6} fill={col} stroke={read ? "#07645C" : "#6E5644"} strokeWidth={2} />
      {two ? <circle cx={31} cy={9.5} r={6} fill={col} stroke={read ? "#07645C" : "#6E5644"} strokeWidth={2} /> : null}
    </svg>
  );
};

const BUBBLE_FONT = 44;

const MetaRow: React.FC<{ time: string; children?: React.ReactNode; light?: boolean }> = ({ time, children }) => (
  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 4 }}>
    <span style={{ fontFamily: FONT.heavy, fontWeight: 700, fontSize: 23, color: "rgba(58,26,6,0.55)" }}>{time}</span>
    {children}
  </div>
);

const bubbleStyle = (side: "me" | "them"): React.CSSProperties => ({
  position: "relative",
  maxWidth: 484,
  padding: "16px 24px 10px 26px",
  borderRadius: side === "me" ? "34px 34px 10px 34px" : "34px 34px 34px 10px",
  background: side === "me" ? "linear-gradient(165deg, #FFE9A8 0%, #FFC857 100%)" : "#FFFFFF",
  boxShadow: "0 5px 0 rgba(120,70,20,0.16)",
  border: side === "me" ? "3px solid #F2B23C" : "3px solid #F1DDC4",
  boxSizing: "border-box",
});

const BubbleTail: React.FC<{ side: "me" | "them" }> = ({ side }) => {
  const fill = side === "me" ? "#FFC857" : "#FFFFFF";
  const edge = side === "me" ? "#F2B23C" : "#F1DDC4";
  return (
    <svg
      width={34}
      height={30}
      viewBox="0 0 34 30"
      style={{
        position: "absolute",
        bottom: -3,
        [side === "me" ? "right" : "left"]: -24,
        transform: side === "me" ? undefined : "scaleX(-1)",
        overflow: "visible",
      }}
    >
      <path d="M11.5 4 C14 17 21 25 34 28.5 L0 28.5 L0 4 Z" fill={fill} />
      <path d="M11.5 4 C14 17 21 25 34 28.5 L0 28.5" fill="none" stroke={edge} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/** Mini map for the live-location card. */
const MiniMap: React.FC<{ frame: number; at: number; w: number; h: number }> = ({ frame, at, w, h }) => {
  const d = frame - at;
  const pin = pop(frame, at + 4, { damping: 9, stiffness: 190 });
  const u = ((d % 36) + 36) % 36 / 36;
  const px = w * 0.5;
  const py = h * 0.56;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", borderRadius: 24 }}>
      <rect width={w} height={h} fill="#DCEFC6" />
      <path d={`M0 ${h * 0.3} Q${w * 0.2} ${h * 0.2} ${w * 0.32} 0 L0 0 Z`} fill="#C7E4AA" />
      <path d={`M${w * 0.62} 0 L${w * 0.78} ${h * 0.34} L${w * 0.9} ${h * 0.1} L${w} ${h * 0.3} L${w} 0 Z`} fill="#A9D08F" />
      <path d={`M${w * 0.7} ${h * 0.26} L${w * 0.78} ${h * 0.02} L${w * 0.86} ${h * 0.26} Z`} fill="#8DBB76" stroke="#6E9C5B" strokeWidth={2} />
      <path d={`M${w * 0.755} ${h * 0.08} L${w * 0.78} ${h * 0.02} L${w * 0.805} ${h * 0.08} Z`} fill="#FFFFFF" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={w * 0.08 + i * 26} y={h * 0.62 + i * 9} width={70} height={14} rx={7} fill="#E6D3A8" opacity={0.9} />
      ))}
      <path
        d={`M-10 ${h * 0.84} C${w * 0.2} ${h * 0.72} ${w * 0.3} ${h * 1.02} ${w * 0.52} ${h * 0.86} S${w * 0.84} ${h * 0.64} ${w + 10} ${h * 0.74}`}
        stroke="#7CC8FF"
        strokeWidth={16}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M-10 ${h * 0.84} C${w * 0.2} ${h * 0.72} ${w * 0.3} ${h * 1.02} ${w * 0.52} ${h * 0.86} S${w * 0.84} ${h * 0.64} ${w + 10} ${h * 0.74}`}
        stroke="#B9E3FF"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        strokeDasharray="10 16"
      />
      {[
        `M-10 ${h * 0.42} C${w * 0.3} ${h * 0.36} ${w * 0.55} ${h * 0.6} ${w + 10} ${h * 0.38}`,
        `M${w * 0.34} -10 C${w * 0.38} ${h * 0.4} ${w * 0.3} ${h * 0.7} ${w * 0.4} ${h + 10}`,
        `M${w * 0.66} ${h + 10} L${w * 0.8} -10`,
      ].map((p, i) => (
        <g key={i}>
          <path d={p} stroke="#D9CBB2" strokeWidth={i === 0 ? 22 : 17} fill="none" strokeLinecap="round" />
          <path d={p} stroke="#FFFFFF" strokeWidth={i === 0 ? 15 : 11} fill="none" strokeLinecap="round" />
        </g>
      ))}
      <circle cx={px} cy={py} r={20 + u * 46} fill={`rgba(58,134,255,${0.28 * (1 - u)})`} stroke={`rgba(58,134,255,${0.7 * (1 - u)})`} strokeWidth={3} />
      <circle cx={px} cy={py} r={30} fill="rgba(58,134,255,0.18)" stroke="#3A86FF" strokeWidth={2.5} />
      <ellipse cx={px} cy={py + 2} rx={12 * pin} ry={5 * pin} fill="rgba(0,0,0,0.25)" />
      <g transform={`translate(${px - 27} ${py - 72 - (1 - pin) * 90}) scale(${0.6 + 0.4 * Math.min(1.2, pin)})`}>
        <svg width={54} height={72} viewBox="0 0 60 80" overflow="visible">
          <path
            d="M30 76 C30 76 5 46 5 30 A25 25 0 1 1 55 30 C55 46 30 76 30 76 Z"
            fill="#FF3B4E"
            stroke={INK}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <circle cx={30} cy={30} r={11} fill="#fff" stroke={INK} strokeWidth={3} />
        </svg>
      </g>
    </svg>
  );
};

const LiveDot: React.FC<{ frame: number; size?: number }> = ({ frame, size = 16 }) => {
  const u = ((frame % 24) + 24) % 24 / 24;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "#FF2E4D",
          transform: `scale(${1 + u * 1.4})`,
          opacity: 0.5 * (1 - u),
        }}
      />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#FF2E4D" }} />
    </div>
  );
};

const LocationCard: React.FC<{ frame: number; at: number; place: string; time: string }> = ({ frame, at, place, time }) => (
  <div style={{ ...bubbleStyle("them"), width: 470, maxWidth: 470, padding: 8 }}>
    <MiniMap frame={frame} at={at} w={448} h={224} />
    <div style={{ padding: "10px 12px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PinIcon size={34} style={{ flexShrink: 0 }} />
        <span style={{ fontFamily: FONT.heavy, fontWeight: 800, fontSize: 27, lineHeight: 1.15, color: "#2B1A10" }}>
          Ubicación en tiempo real
        </span>
      </div>
      <div style={{ fontFamily: FONT.fun, fontSize: 48, color: "#E0262B", lineHeight: 1.08, marginTop: 6 }}>{place}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            borderRadius: 14,
            background: "#FFE3E6",
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 23,
            letterSpacing: 1.5,
            color: "#E0233F",
          }}
        >
          <LiveDot frame={frame} size={13} />
          EN VIVO
        </div>
        <span style={{ fontFamily: FONT.heavy, fontWeight: 700, fontSize: 21, color: "rgba(58,26,6,0.55)" }}>{time}</span>
      </div>
    </div>
    <BubbleTail side="them" />
  </div>
);

const TypingDots: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ ...bubbleStyle("them"), display: "flex", gap: 10, padding: "22px 26px" }}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#B89A80",
          transform: `translateY(${-Math.max(0, Math.sin(frame * 0.32 - i * 0.9)) * 9}px)`,
        }}
      />
    ))}
    <BubbleTail side="them" />
  </div>
);

/** Andean step-pattern strip under the header. */
const TocapuBand: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 10,
      background:
        "repeating-linear-gradient(90deg, #FFD23F 0px, #FFD23F 14px, #9E1318 14px, #9E1318 20px, #17B3A3 20px, #17B3A3 34px, #9E1318 34px, #9E1318 40px)",
      borderTop: "2px solid rgba(80,10,10,0.35)",
    }}
  />
);

/** Cream chat wallpaper with faint chakana (stepped cross) pattern. */
const Wallpaper: React.FC<{ uid: string }> = ({ uid }) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
    <defs>
      <pattern id={`wp${uid}`} width={104} height={104} patternUnits="userSpaceOnUse">
        <g transform="translate(26 26)" fill="#F6DFC0">
          <rect x={-15} y={-5} width={30} height={10} />
          <rect x={-5} y={-15} width={10} height={30} />
          <rect x={-10} y={-10} width={20} height={20} />
          <circle r={4} fill="#FFF3E2" />
        </g>
        <circle cx={78} cy={78} r={5} fill="#F6DFC0" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="#FFF3E2" />
    <rect width="100%" height="100%" fill={`url(#wp${uid})`} />
  </svg>
);

/**
 * ChasquiChat conversation, filling the PhoneFrame screen. Bubbles pop in at `at`; a "me"
 * message with `typingFrom` types itself in the input bar (keyboard up, key previews) and is
 * sent at `at` with a send-button pulse. "them" with `typingFrom` shows typing dots first.
 */
export const ChatScreen: React.FC<{
  frame: number;
  contact: ChatContact;
  messages: ChatMessage[];
  time?: string;
  placeholder?: string;
  /** Bubble text size in screen pixels (default 44). Raise it when the phone is shown small. */
  fontSize?: number;
}> = ({ frame, contact, messages, time = "10:32", placeholder = "Escribe tu quipu…", fontSize = BUBBLE_FONT }) => {
  const uid = useUid();
  const bubbleFont = fontSize;
  const msgs = messages.slice().sort((a, b) => a.at - b.at);

  // "me" typing in the input bar.
  let typed = "";
  let pressedChar: string | null = null;
  let typing = false;
  let kb = 0;
  let sendPulse = 0;
  let ripple = -1;
  msgs.forEach((m, i) => {
    if (m.from !== "me") return;
    const d = frame - m.at;
    if (d >= 0 && d < 10) sendPulse = Math.max(sendPulse, bump(frame, m.at, 10));
    if (d >= 0 && d < 16) ripple = d / 16;
    if (m.typingFrom === undefined || !m.text) return;
    kb = Math.max(
      kb,
      Math.min(ramp(frame, m.typingFrom - 8, m.typingFrom + 2, [0, 1], EASE_OUT), 1 - ramp(frame, m.at + 8, m.at + 18, [0, 1], EASE_IN_OUT)),
    );
    if (frame >= m.typingFrom && frame < m.at) {
      const times = typedTimes(m.text, m.typingFrom, Math.max(m.typingFrom + 1, m.at - 5), i + 1);
      let n = 0;
      while (n < times.length && frame >= times[n]) n++;
      typed = m.text.slice(0, n);
      typing = true;
      pressedChar = n > 0 && frame < times[n - 1] + 3 ? m.text[n - 1] : null;
    }
  });
  const themTyping = msgs.some((m) => m.from === "them" && m.typingFrom !== undefined && frame >= m.typingFrom && frame < m.at);
  const status = themTyping ? "escribiendo…" : contact.status ?? "en línea";

  const items: React.ReactNode[] = [];
  msgs.forEach((m, i) => {
    if (m.from === "them" && m.typingFrom !== undefined && frame >= m.typingFrom && frame < m.at + 6) {
      const k = Math.min(ramp(frame, m.typingFrom, m.typingFrom + 6, [0, 1], EASE_OUT), 1 - ramp(frame, m.at, m.at + 6, [0, 1], EASE_OUT));
      items.push(
        <Grow key={`t${i}`} k={k}>
          <div style={{ display: "flex", paddingTop: 16, paddingLeft: 10 }}>
            <div style={{ transform: `scale(${pop(frame, m.typingFrom, { damping: 12, stiffness: 240 }) * (1 - ramp(frame, m.at, m.at + 5))})`, transformOrigin: "0% 100%" }}>
              <TypingDots frame={frame} />
            </div>
          </div>
        </Grow>,
      );
    }
    if (frame < m.at) return;
    const k = ramp(frame, m.at, m.at + 7, [0, 1], EASE_OUT);
    const s = pop(frame, m.at, { damping: 11, stiffness: 230, mass: 0.6 });
    const side = m.from;
    const t = m.time ?? time;
    const body =
      m.kind === "location" ? (
        <LocationCard frame={frame} at={m.at} place={m.place ?? m.text ?? "Cajamarca"} time={t} />
      ) : (
        <div style={bubbleStyle(side)}>
          <div
            style={{
              fontFamily: FONT.heavy,
              fontWeight: 800,
              fontSize: bubbleFont,
              lineHeight: 1.18,
              color: "#2B1A10",
              letterSpacing: -0.3,
            }}
          >
            {m.text}
          </div>
          <MetaRow time={t}>{side === "me" ? <QuipuTicks frame={frame} at={m.at} readAt={m.readAt ?? m.at + 18} /> : null}</MetaRow>
          <BubbleTail side={side} />
        </div>
      );
    items.push(
      <Grow key={`m${i}`} k={k}>
        <div style={{ display: "flex", justifyContent: side === "me" ? "flex-end" : "flex-start", padding: side === "me" ? "16px 10px 0 0" : "16px 0 0 10px" }}>
          <div style={{ transform: `scale(${s})`, transformOrigin: side === "me" ? "100% 100%" : "0% 100%" }}>{body}</div>
        </div>
      </Grow>,
    );
  });

  const caretOn = typing || Math.floor(frame / 9) % 2 === 0;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          position: "relative",
          height: STATUS_H + 134,
          flexShrink: 0,
          paddingTop: STATUS_H,
          boxSizing: "border-box",
          background: "linear-gradient(120deg, #FFA51C 0%, #FF6A2B 50%, #E3262E 100%)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: `${STATUS_H}px 20px 10px 14px`,
          zIndex: 2,
          boxShadow: "0 6px 12px rgba(120,30,0,0.18)",
        }}
      >
        <BackChevron size={36} />
        <Avatar kind={contact.avatar ?? "llama"} size={96} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              fontFamily: FONT.heavy,
              fontWeight: 900,
              fontSize: contact.name.length > 13 ? 36 : 42,
              lineHeight: 1.02,
              color: "#fff",
              textShadow: "0 3px 0 rgba(120,20,0,0.3)",
            }}
          >
            {contact.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {themTyping ? null : <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#7CFFB2", border: "2px solid #fff" }} />}
            <span style={{ fontFamily: FONT.heavy, fontWeight: 800, fontSize: 25, color: "rgba(255,255,255,0.95)" }}>{status}</span>
          </div>
        </div>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.22)",
            border: "3px solid rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <LlamaHead size={50} scarf={false} style={{ marginBottom: -6 }} />
        </div>
        <TocapuBand />
      </div>
      {/* Messages */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Wallpaper uid={uid} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "0 18px 18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <div
              style={{
                padding: "8px 22px",
                borderRadius: 18,
                background: "rgba(150,95,45,0.14)",
                fontFamily: FONT.heavy,
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: 2,
                color: "#8A5E3A",
              }}
            >
              HOY
            </div>
          </div>
          {items}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 44,
            background: "linear-gradient(180deg, #FFF3E2 0%, rgba(255,243,226,0.85) 40%, rgba(255,243,226,0) 100%)",
          }}
        />
      </div>
      {/* Input bar */}
      <div
        style={{
          position: "relative",
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          padding: "12px 14px 18px",
          background: "#FCE8CF",
          borderTop: "2px solid #F0D2AE",
          zIndex: 3,
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 84,
            borderRadius: 42,
            background: "#FFFFFF",
            border: typing ? "3px solid #FF9A4D" : "3px solid #EFCFAA",
            display: "flex",
            alignItems: "center",
            padding: "12px 20px 12px 14px",
            gap: 10,
            boxSizing: "border-box",
          }}
        >
          <QuipuIcon size={42} style={{ flexShrink: 0 }} />
          <div
            style={{
              flex: 1,
              fontFamily: FONT.heavy,
              fontWeight: 800,
              fontSize: 35,
              lineHeight: 1.18,
              color: typed ? "#2B1A10" : "#BD9F82",
            }}
          >
            {typed ? typed : typing ? null : placeholder}
            {typing && caretOn ? (
              <span
                style={{
                  display: "inline-block",
                  width: 4,
                  height: 36,
                  marginLeft: 3,
                  verticalAlign: "-6px",
                  borderRadius: 2,
                  background: "#FF6A2B",
                }}
              />
            ) : null}
          </div>
        </div>
        <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
          {ripple >= 0 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "6px solid #FF7A3D",
                transform: `scale(${1 + ripple * 1.2})`,
                opacity: 1 - ripple,
              }}
            />
          ) : null}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "linear-gradient(145deg, #FFB12E 0%, #FF6A2B 50%, #E0262B 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 5px 0 #A8231C",
              transform: `scale(${1 + 0.32 * sendPulse}) rotate(${-sendPulse * 18}deg)`,
              opacity: typed || sendPulse > 0 ? 1 : 0.8,
            }}
          >
            <SendIcon size={48} style={{ marginLeft: -4, marginTop: 4 }} />
          </div>
        </div>
      </div>
      {/* Keyboard (slides up from the bottom edge of the screen) */}
      <div style={{ position: "relative", height: KB_H * kb, flexShrink: 0, zIndex: 4 }}>
        {kb > 0.001 ? <Keyboard pressedChar={pressedChar} words={["Inca", "urgente", "quipu"]} /> : null}
      </div>
    </div>
  );
};

// =============================================================================================
// NotificationStorm

const PREVIEWS = [
  "Llegó el quipu",
  "Faltan llamas en Cajamarca",
  "Mi Inca, ¿está ahí?",
  "¡Urgente! Lluvia en Cusco",
  "¿Ya vio mi quipu?",
  "Se escapó una llama",
  "Chasqui en camino",
  "¿Cuántas papas mando?",
  "Mi Inca, responda porfa",
  "Nuevo tambo en Quito",
  "¡Problema en el norte!",
  "¿Hay fiesta del Inti?",
];

const NotifCard: React.FC<{ preview: string }> = ({ preview }) => (
  <div
    style={{
      width: 840,
      height: 152,
      borderRadius: 36,
      background: "rgba(255,255,255,0.98)",
      border: "5px solid #FFFFFF",
      boxShadow: "0 8px 0 rgba(0,0,0,0.22), 0 18px 34px rgba(0,0,0,0.3)",
      display: "flex",
      alignItems: "center",
      gap: 22,
      padding: "0 30px 0 22px",
      boxSizing: "border-box",
    }}
  >
    <ChasquiChatIcon size={100} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 21, letterSpacing: 2.5, color: "#F0582A" }}>
          CHASQUICHAT
        </span>
        <span style={{ fontFamily: FONT.heavy, fontWeight: 700, fontSize: 21, color: "#9A8A7C" }}>ahora</span>
      </div>
      <div style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 36, lineHeight: 1.12, color: "#1E120A" }}>Mensaje nuevo</div>
      <div
        style={{
          fontFamily: FONT.heavy,
          fontWeight: 700,
          fontSize: 32,
          lineHeight: 1.2,
          color: "#4A3A2E",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {preview}
      </div>
    </div>
  </div>
);

/**
 * Notification flood: the ChasquiChat icon's red badge climbs 0 -> `count` between `from` and
 * `to` (accelerating, with a bounce on the last number) while notification cards pour in and
 * pile up below it, shaking harder as the pace rises. `x`, `y` = centre of the app icon; the
 * cards hang below it (block is ~900 wide and ~1150 tall at scale 1).
 */
export const NotificationStorm: React.FC<{
  frame: number;
  from: number;
  to: number;
  count?: number;
  x: number;
  y: number;
  scale?: number;
  /** Optional exit: everything drops away from here. */
  out?: number;
}> = ({ frame, from, to, count = 99, x, y, scale = 1, out }) => {
  if (frame < from - 2) return null;
  if (out !== undefined && frame > out + 14) return null;
  const D = Math.max(1, to - from);
  const P = 1.8;
  const prog = clamp01((frame - from) / D);
  const n = frame >= to ? count : Math.floor(count * Math.pow(prog, P));
  const M = Math.min(count, 24);
  const spawn = (k: number) => from + D * Math.pow(k / M, 1 / P);
  const PITCH = 170;
  const MAX_SLOTS = 5;

  // Shake grows with the pace, then one hard hit on the final number.
  const climbing = frame >= from && frame < to;
  const amp = (climbing ? 2 + 13 * Math.pow(prog, 2) : 0) + (frame >= to ? 22 * Math.pow(Math.max(0, 1 - (frame - to) / 16), 2) : 0);
  const sx = Math.sin(frame * 2.9) * amp * 0.8 + (rand(frame * 1.37) - 0.5) * amp * 0.6;
  const sy = Math.cos(frame * 3.7) * amp * 0.35;
  const sr = Math.sin(frame * 2.1) * amp * 0.05;

  const exitK = out !== undefined ? ramp(frame, out, out + 14, [0, 1], EASE_IN) : 0;
  const enter = pop(frame, from - 2, { damping: 12, stiffness: 200 });

  const cards: React.ReactNode[] = [];
  for (let kk = M - 1; kk >= 0; kk--) {
    const t0 = spawn(kk);
    if (frame < t0) continue;
    let slot = 0;
    for (let j = kk + 1; j < M; j++) {
      slot += ramp(frame, spawn(j), spawn(j) + 6, [0, 1], EASE_OUT);
    }
    if (slot > MAX_SLOTS + 0.5) continue;
    const e = pop(frame, t0, { damping: 14, stiffness: 260, mass: 0.6 });
    const fade = 1 - ramp(slot, MAX_SLOTS - 1, MAX_SLOTS + 0.4, [0, 1], EASE_IN_OUT);
    const wob = (rand(kk * 7.3) - 0.5) * 3;
    cards.push(
      <div
        key={kk}
        style={{
          position: "absolute",
          left: 30,
          top: 290 + slot * PITCH,
          opacity: fade,
          transform: `translateY(${-(1 - Math.min(1, e)) * 150}px) scale(${(0.62 + 0.38 * e) * (1 - slot * 0.015)}) rotate(${wob * (1 - Math.min(1, e)) * 2 + wob * 0.25}deg)`,
          zIndex: 100 - Math.round(slot * 10),
        }}
      >
        <NotifCard preview={PREVIEWS[kk % PREVIEWS.length]} />
      </div>,
    );
  }

  const digits = String(n).length;
  const final = frame >= to ? 1 + 0.6 * Math.sin((frame - to) * 0.42) * Math.exp(-(frame - to) / 7) : 1;
  const tick = climbing ? 1 + 0.07 * Math.abs(Math.sin(frame * 1.9)) * prog : 1;
  const ringT = clamp01((frame - to) / 16);
  return (
    <div
      style={{
        position: "absolute",
        left: x - 450,
        top: y - 130,
        width: 900,
        height: 1180,
        transform: `translate(${sx}px, ${sy + exitK * 1400}px) rotate(${sr}deg) scale(${scale})`,
        transformOrigin: "450px 130px",
        pointerEvents: "none",
      }}
    >
      {cards}
      <div
        style={{
          position: "absolute",
          left: 450 - 115,
          top: 130 - 115,
          width: 230,
          height: 230,
          transform: `scale(${enter}) rotate(${(1 - enter) * -25 + Math.sin(frame * 0.8) * amp * 0.12}deg)`,
          zIndex: 200,
        }}
      >
        <ChasquiChatIcon size={230} border={9} style={{ boxShadow: "0 12px 0 rgba(0,0,0,0.3), 0 26px 44px rgba(0,0,0,0.35)" }} />
        {frame >= to && ringT < 1 ? (
          <div
            style={{
              position: "absolute",
              left: 230 - 20 - 90,
              top: -40 - 90 + 60,
              width: 180,
              height: 180,
              borderRadius: "50%",
              border: `${12 * (1 - ringT)}px solid #FFD23F`,
              transform: `scale(${0.6 + ringT * 1.6})`,
              opacity: 1 - ringT,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            right: -70,
            top: -58,
            minWidth: 128,
            height: 128,
            padding: `0 ${digits > 1 ? 22 : 0}px`,
            borderRadius: 64,
            background: "linear-gradient(180deg, #FF5A5A 0%, #E5102E 100%)",
            border: "8px solid #FFFFFF",
            boxShadow: "0 8px 0 rgba(0,0,0,0.3)",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 74,
            color: "#fff",
            letterSpacing: -2,
            transform: `scale(${final * tick})`,
            textShadow: "0 4px 0 rgba(120,0,10,0.45)",
          }}
        >
          {n}
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// WeatherCard (App-papa)

/**
 * App-papa's answer: "Pronóstico — Mañana: lluvia", an animated rain cloud and "Ideal para
 * sembrar". Pops in at `at`, out at `out`. `x`, `y` = centre of the card (~840 x 660).
 */
export const WeatherCard: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  scale?: number;
}> = ({ frame, at, out, x, y, scale = 1 }) => {
  if (frame < at || frame > out + 10) return null;
  const p = pop(frame, at, { damping: 11, stiffness: 170, mass: 0.8 });
  const k = ramp(frame, out, out + 9, [0, 1], EASE_IN);
  const s = scale * (0.3 + 0.7 * p) * (1 - k);
  const rot = -2.5 + (1 - p) * -10 + Math.sin((frame - at) * 0.06) * 0.8;
  const talk = frame - at < 40 ? 1 - ramp(frame, at + 30, at + 40) : 0;
  const bigIn = pop(frame, at + 7, { damping: 9, stiffness: 190 });
  const tagIn = pop(frame, at + 14, { damping: 10, stiffness: 200 });
  return (
    <div
      style={{
        position: "absolute",
        left: x - 420,
        top: y - 318,
        width: 840,
        transform: `scale(${s}) rotate(${rot}deg)`,
        opacity: Math.min(1, p * 2),
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 60,
          border: "9px solid #FFFFFF",
          background: "linear-gradient(180deg, #D8EEFF 0%, #FFFFFF 46%, #FFFFFF 100%)",
          boxShadow: "0 16px 0 rgba(0,0,0,0.28), 0 34px 60px rgba(0,0,0,0.35)",
          padding: "30px 40px 36px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <AppPapaIcon size={104} style={{ border: "5px solid #fff", boxShadow: "0 5px 0 rgba(0,0,0,0.18)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT.fun, fontSize: 52, lineHeight: 1, color: "#6A3E12" }}>App-papa</div>
            <div style={{ fontFamily: FONT.heavy, fontWeight: 800, fontSize: 24, color: "#8C7A66", marginTop: 4 }}>tu asistente del campo</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 50 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 9,
                  height: 12 + talk * (14 + 22 * Math.abs(Math.sin(frame * 0.55 + i * 1.3))),
                  borderRadius: 5,
                  background: "#43C463",
                }}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: 5,
            color: "#3E6FA8",
          }}
        >
          PRONÓSTICO
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
          <RainCloud size={280} frame={frame} style={{ flexShrink: 0, marginLeft: -16 }} />
          <div style={{ transform: `scale(${0.5 + 0.5 * bigIn})`, transformOrigin: "0% 50%" }}>
            <div
              style={{
                fontFamily: FONT.heavy,
                fontWeight: 900,
                fontSize: 64,
                lineHeight: 1,
                color: "#1B3358",
              }}
            >
              Mañana:
            </div>
            <HeavyText text="lluvia" size={132} colors={["#E4F5FF", "#5CB8FF", "#1F6FE5"]} stroke="#0E2547" style={{ marginTop: 8, marginLeft: -4 }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "10px 34px 10px 18px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #7BE36B 0%, #25A94F 100%)",
              border: "5px solid #fff",
              boxShadow: "0 6px 0 rgba(0,0,0,0.2)",
              transform: `scale(${tagIn}) rotate(${(1 - tagIn) * 8 - 1.5}deg)`,
            }}
          >
            <SproutIcon size={62} />
            <span
              style={{
                fontFamily: FONT.heavy,
                fontWeight: 900,
                fontSize: 40,
                color: "#fff",
                textShadow: "0 3px 0 rgba(0,80,20,0.4)",
                whiteSpace: "nowrap",
              }}
            >
              Ideal para sembrar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// SelfieUI

/** Original caption sticker ("POV: …"): white card, heavy outline, hard shadow, gradient chip. */
export const CaptionSticker: React.FC<{
  frame: number;
  at: number;
  out: number;
  text: string;
  x?: number;
  y?: number;
  rotate?: number;
}> = ({ frame, at, out, text, x = 540, y = 360, rotate = -3 }) => {
  if (frame < at || frame > out + 8) return null;
  const p = pop(frame, at, { damping: 9, stiffness: 210, mass: 0.7 });
  const k = ramp(frame, out, out + 7, [0, 1], EASE_IN);
  const m = /^(POV:?)\s*(.*)$/i.exec(text);
  const lead = m ? m[1] : null;
  const rest = m ? m[2] : text;
  const wob = Math.sin((frame - at) * 0.13) * 1.2;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 480,
        top: y,
        width: 960,
        height: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 16,
          maxWidth: 940,
          flexShrink: 0,
          transform: `scale(${p * (1 - k)}) rotate(${rotate + wob + (1 - p) * 12}deg)`,
          padding: "18px 30px 18px 20px",
          borderRadius: 26,
          background: "#FFFFFF",
          border: "7px solid #141414",
          boxShadow: "12px 12px 0 #141414",
        }}
      >
        {lead ? (
          <span
            style={{
              fontFamily: FONT.title,
              fontSize: 64,
              lineHeight: 1,
              padding: "14px 18px 6px",
              borderRadius: 16,
              color: "#FFFFFF",
              background: "linear-gradient(135deg, #FF3D7F 0%, #FF8A00 100%)",
              border: "5px solid #141414",
              textShadow: "0 4px 0 rgba(0,0,0,0.3)",
            }}
          >
            {lead.toUpperCase().replace(/:?$/, ":")}
          </span>
        ) : null}
        <span
          style={{
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 54,
            lineHeight: 1.1,
            color: "#141414",
            letterSpacing: -0.5,
            textAlign: "center",
          }}
        >
          {rest}
        </span>
      </div>
    </div>
  );
};

/**
 * Full-frame camera viewfinder over a transparent middle: corner brackets, blinking REC dot with
 * a timer counting from `recStart`, zoom pill, capture button, flip-camera and gallery buttons.
 * `flashAt` fires a shutter flash (the photo lands in the gallery thumb); `sticker` shows a
 * "POV:" caption sticker near the top.
 */
export const SelfieUI: React.FC<{
  frame: number;
  at: number;
  out: number;
  recStart: number;
  flashAt?: number;
  sticker?: { text: string; at: number; out: number; y?: number };
  /** Y of the capture button centre (camera controls sit around it). Default: bottom - 280. */
  controlsY?: number;
  /** Y of the REC row. */
  topY?: number;
  grid?: boolean;
  /**
   * Size of the area to cover (default the full 1080 x 1920 frame). Pass SCREEN_W x SCREEN_H to
   * put the viewfinder inside a transparent PhoneFrame. The layout uses a 1080-wide canvas scaled
   * to `width`, so controlsY / topY / sticker.y are in that canvas' pixels.
   */
  width?: number;
  height?: number;
}> = ({ frame, at, out, recStart, flashAt, sticker, controlsY, topY = 200, grid = true, width = 1080, height = 1920 }) => {
  if (frame < at || frame > out + 12) return null;
  const k = width / 1080;
  const Hv = height / k;
  const cy = controlsY ?? Hv - 280;
  const inK = ramp(frame, at, at + 12, [0, 1], EASE_OUT);
  const outK = ramp(frame, out, out + 10, [0, 1], EASE_IN);
  const vis = inK * (1 - outK);
  const secs = Math.max(0, Math.floor((frame - recStart) / 30));
  const blink = Math.floor((frame - recStart) / 15) % 2 === 0;
  const press = flashAt !== undefined ? bump(frame, flashAt - 2, 9) : 0;
  const thumbPop = flashAt !== undefined && frame >= flashAt ? pop(frame, flashAt + 2, { damping: 9, stiffness: 220 }) : 0;
  const flash = flashAt !== undefined && frame >= flashAt && frame < flashAt + 12 ? Math.pow(1 - (frame - flashAt) / 12, 2) : 0;
  const spread = (1 - inK) * 70 + outK * 70;
  const L = 60 - spread;
  const R = 1020 + spread;
  const T = topY - 50 - spread;
  const B = cy - 120 + spread;
  const arm = 120;
  const bracket = (x0: number, y0: number, dx: number, dy: number) => `M${x0} ${y0 + dy * arm} L${x0} ${y0} L${x0 + dx * arm} ${y0}`;
  const shadow = "drop-shadow(0 3px 4px rgba(0,0,0,0.55))";
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1080,
        height: Hv,
        transform: k !== 1 ? `scale(${k})` : undefined,
        transformOrigin: "0 0",
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: vis }}>
        <svg width={1080} height={Hv} style={{ position: "absolute", inset: 0, filter: shadow }}>
          {grid
            ? [360, 720].map((gx) => <path key={gx} d={`M${gx} ${T + 40} L${gx} ${B - 40}`} stroke="rgba(255,255,255,0.28)" strokeWidth={2.5} />)
            : null}
          {grid
            ? [T + (B - T) / 3, T + (2 * (B - T)) / 3].map((gy) => (
                <path key={gy} d={`M${L + 40} ${gy} L${R - 40} ${gy}`} stroke="rgba(255,255,255,0.28)" strokeWidth={2.5} />
              ))
            : null}
          {[bracket(L, T, 1, 1), bracket(R, T, -1, 1), bracket(L, B, 1, -1), bracket(R, B, -1, -1)].map((d, i) => (
            <path key={i} d={d} stroke="#FFFFFF" strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
        {/* REC row */}
        <div
          style={{
            position: "absolute",
            left: 96,
            top: topY - 40 - (1 - inK) * 60,
            height: 80,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 30px 0 24px",
            borderRadius: 40,
            background: "rgba(10,10,14,0.55)",
            border: "3px solid rgba(255,255,255,0.35)",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#FF2E3F",
              boxShadow: "0 0 16px #FF2E3F",
              opacity: blink ? 1 : 0.25,
            }}
          />
          <span style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 38, color: "#FFFFFF", letterSpacing: 2 }}>REC</span>
          <span style={{ fontFamily: FONT.heavy, fontWeight: 800, fontSize: 38, color: "#FFFFFF", fontVariantNumeric: "tabular-nums" }}>
            {`${pad2(Math.floor(secs / 60))}:${pad2(secs % 60)}`}
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            right: 96,
            top: topY - 40 - (1 - inK) * 60,
            height: 80,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 26px",
            borderRadius: 40,
            background: "rgba(10,10,14,0.55)",
            border: "3px solid rgba(255,255,255,0.35)",
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 30,
            color: "#fff",
          }}
        >
          <span style={{ color: "#FFD23F" }}>HD</span>
          <span>60</span>
          <BatteryIcon size={46} color="#fff" level={0.35} />
        </div>
        {/* Zoom pill */}
        <div
          style={{
            position: "absolute",
            left: 540 - 150,
            top: cy - 190 + (1 - inK) * 80,
            width: 300,
            height: 78,
            borderRadius: 39,
            background: "rgba(10,10,14,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 28,
            color: "#fff",
          }}
        >
          <span>0,5</span>
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#FFD23F",
              color: "#1B1B1B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            1x
          </span>
          <span>2</span>
        </div>
        {/* Bottom controls */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cy - 80 + (1 - inK) * 120,
            height: 160,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 540 - 250 - 50,
              top: 30,
              width: 100,
              height: 100,
              borderRadius: 24,
              border: "5px solid #fff",
              overflow: "hidden",
              boxShadow: "0 4px 10px rgba(0,0,0,0.45)",
              transform: `scale(${1 + 0.25 * bump(frame, (flashAt ?? -99) + 2, 10)})`,
            }}
          >
            <MachuThumb size={90} style={{ display: "block", transform: `scale(${flashAt !== undefined && frame >= flashAt ? Math.min(1.15, thumbPop) : 1})` }} />
          </div>
          <div
            style={{
              position: "absolute",
              left: 540 - 80,
              top: 0,
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: "11px solid #FFFFFF",
              boxSizing: "border-box",
              boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: 18,
                background: "#FF2E3F",
                transform: `scale(${(1 - 0.25 * press) * (1 + 0.05 * Math.sin(frame * 0.3))})`,
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: 540 + 250 - 50,
              top: 30,
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: "rgba(10,10,14,0.5)",
              border: "3px solid rgba(255,255,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FlipCamIcon size={64} />
          </div>
        </div>
      </div>
      {sticker ? <CaptionSticker frame={frame} at={sticker.at} out={sticker.out} text={sticker.text} y={sticker.y ?? topY + 190} /> : null}
      {flash > 0 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash }} /> : null}
    </div>
  );
};

// =============================================================================================
// CommentsCTA

const ERAS: { label: string; bg: string; icon: (frame: number) => React.ReactNode }[] = [
  { label: "EGIPTO", bg: "radial-gradient(circle at 50% 30%, #FFF1C9 0%, #FFC85A 100%)", icon: () => <PyramidIcon size={132} /> },
  { label: "DINOSAURIOS", bg: "radial-gradient(circle at 50% 30%, #E4FFD9 0%, #8EE39B 100%)", icon: () => <DinoIcon size={136} /> },
  { label: "EL FUTURO", bg: "radial-gradient(circle at 50% 30%, #5B6BD8 0%, #1D1F5E 100%)", icon: (f) => <RocketIcon size={136} frame={f} /> },
  { label: "EDAD MEDIA", bg: "radial-gradient(circle at 50% 30%, #E9E1FF 0%, #A58BF0 100%)", icon: () => <CastleIcon size={132} /> },
];

/** Positions of the four era bubbles around the button (relative to its centre). */
const ERA_POS = [
  { x: -330, y: -215 },
  { x: 330, y: -190 },
  { x: -340, y: 225 },
  { x: 345, y: 262 },
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
 * Call to action: big comment button (dots hop, a hand taps it with a ripple), a counter that
 * ticks up, four "era" bubbles (pyramid, dinosaur, rocket, castle) popping in one by one and the
 * title "¿A QUÉ ÉPOCA VIAJO?". `x`, `y` = centre of the comment button; the block spans about
 * x ± 450 and y - 470 … y + 425 (so y = 640 keeps it inside the safe area).
 */
export const CommentsCTA: React.FC<{
  frame: number;
  at: number;
  x: number;
  y: number;
  title?: string;
  /** Title centre, relative to the button (default 0, -350). */
  titleOffset?: { x: number; y: number };
  countTo?: number;
  scale?: number;
  out?: number;
}> = ({ frame, at, x, y, title = "¿A QUÉ ÉPOCA VIAJO?", titleOffset = { x: 0, y: -350 }, countTo = 2847, scale = 1, out }) => {
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
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `scale(${scale * (1 - exitK)})`,
        pointerEvents: "none",
      }}
    >
      {/* Title */}
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
            <HeavyText text={line} size={112} colors={["#FFFFFF", "#FFF3B0", "#FFC21F"]} />
          </div>
        );
      })}
      {/* Era bubbles */}
      {ERAS.map((era, i) => {
        const pos = ERA_POS[i];
        const p = pop(frame, at + 20 + i * 11, { damping: 9, stiffness: 180 });
        if (p <= 0.001) return null;
        const bob = Math.sin(t * 0.09 + i * 1.7) * 12;
        const ang = Math.atan2(-pos.y, -pos.x);
        return (
          <div
            key={era.label}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y + bob,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${(1 - p) * (i % 2 ? 25 : -25) + Math.sin(t * 0.07 + i) * 3}deg)`,
            }}
          >
            <svg width={240} height={240} viewBox="-120 -120 240 240" style={{ position: "absolute", left: -120 + 100, top: -120 + 100, overflow: "visible" }}>
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
                  background: era.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {era.icon(frame)}
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 100,
                top: 206,
                transform: "translateX(-50%)",
                padding: "6px 18px 4px",
                borderRadius: 14,
                background: INK,
                fontFamily: FONT.heavy,
                fontWeight: 900,
                fontSize: 30,
                letterSpacing: 1,
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                boxShadow: "0 5px 0 rgba(0,0,0,0.25)",
              }}
            >
              {era.label}
            </div>
          </div>
        );
      })}
      {/* Ripple + button */}
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
          background: "linear-gradient(145deg, #FF5FA2 0%, #FF3D5A 50%, #FF8A00 100%)",
          border: "12px solid #FFFFFF",
          boxSizing: "border-box",
          boxShadow: "0 14px 0 rgba(0,0,0,0.3), 0 28px 50px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${btnIn * (1 - 0.12 * squish)}) rotate(${(1 - btnIn) * -30}deg)`,
        }}
      >
        <CommentBubbleIcon size={180} dot="#FF3D5A" frame={frame} style={{ marginTop: 10 }} />
      </div>
      {/* Counter */}
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
        <HeavyText text={fmtNumber(count)} size={88} colors={["#FFFFFF", "#FFE9F1", "#FFB3CF"]} />
        <div
          style={{
            marginTop: 18,
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: 2,
            color: "#FFFFFF",
            WebkitTextStroke: "8px #26140A",
            paintOrder: "stroke fill",
          }}
        >
          COMENTARIOS
        </div>
      </div>
      {/* Hand */}
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

