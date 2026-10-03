import React from "react";
import { EASE_OUT, clamp01, ramp } from "../../anim";
import { FONT } from "../../theme";
import { LifeEvent, formatLife } from "../../tiempo/clock";

// 2D overlays for "¿Qué pasaría si el dinero fuera tiempo de vida?" (1080 x 1920, 30 fps).
// Everything is driven by the global `frame` plus explicit cue frames: no timers, no
// Math.random, no CSS animations. TikTok safe zone: keep content inside x 60-940, y 230-1180.

const MONO_DIGITS: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** Stepped noise in [-1, 1]: a new value every `hold` frames. */
const jit = (frame: number, seed: number, hold = 2) => {
  const n = Math.floor(frame / hold) * 12.9898 + seed * 78.233;
  const x = Math.sin(n) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

const TIER_COLOR = {
  years: { edge: "#4FE3FF", text: "#FFFFFF", sub: "#BDF5FF" },
  days: { edge: "#FFD60A", text: "#FFF7CC", sub: "#FFE680" },
  hours: { edge: "#FF8A3D", text: "#FFE3CF", sub: "#FFC199" },
  seconds: { edge: "#FF4B3E", text: "#FFFFFF", sub: "#FFB3AD" },
  gold: { edge: "#FFC83D", text: "#FFF1B8", sub: "#FFE07A" },
} as const;

const EVENT_COLOR: Record<LifeEvent["tone"], string> = {
  loss: "#FF4B3E",
  gain: "#4DFF7C",
  gift: "#4DFF7C",
  tiny: "#BDF5FF",
};

/** A small hourglass whose sand runs (phase 0..1). */
const Hourglass: React.FC<{ size: number; color: string; phase: number }> = ({ size, color, phase }) => {
  const top = 1 - phase;
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 40 52" style={{ display: "block" }}>
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
 * The floating life counter over a character's head (a holographic panel). (x, y) is the
 * anchor: the bottom centre of its pointer, just above the head; get it with counterAt() from
 * src/tiempo/counter.ts. About 420 x 150 at scale 1 (wider for long texts).
 * - seconds: the character's time left (from src/tiempo/clock.ts).
 * - events: popups ("−6 HORAS", "+1 AÑO"...) that rise from the counter at their frame.
 * - draining: red alarm look (shake, glitch, pulsing glow) while it drains by itself.
 * - frozen: a pause badge (Nubi holding its breath).
 * - gold: the rich man's golden counter.
 * - appear: pops in at this frame (default: already there).
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
}> = ({ frame, seconds, x, y, scale = 1, events = [], draining = false, frozen = false, gold = false, appear, opacity = 1 }) => {
  const { main, sub, tier } = formatLife(seconds);
  const pal = gold ? TIER_COLOR.gold : draining ? TIER_COLOR.seconds : TIER_COLOR[tier];
  const inK = appear === undefined ? 1 : ramp(frame, appear, appear + 10, [0, 1], EASE_OUT);
  if (inK <= 0 || opacity <= 0) return null;
  const urgent = tier === "seconds" || draining;
  const pulse = urgent ? 0.5 + 0.5 * Math.sin(frame * (draining ? 1.4 : 0.9)) : 0.5 + 0.5 * Math.sin(frame * 0.12);
  const shakeX = draining ? jit(frame, 1) * 6 : 0;
  const shakeY = draining ? jit(frame, 2) * 4 : 0;
  // A short punch whenever an event lands.
  const hit = events.reduce((m, e) => Math.max(m, frame >= e.at && frame < e.at + 10 ? 1 - (frame - e.at) / 10 : 0), 0);
  const s = scale * (0.6 + 0.4 * inK) * (1 + 0.12 * hit);
  const big = main.length > 14 ? 40 : 50;
  return (
    <div
      style={{
        position: "absolute",
        left: x + shakeX,
        top: y + shakeY,
        transform: `translate(-50%, -100%) scale(${s})`,
        transformOrigin: "50% 100%",
        opacity: inK * opacity,
        pointerEvents: "none",
      }}
    >
      {/* Popups rise from the panel. */}
      {events.map((e, i) => {
        const d = frame - e.at;
        if (d < 0 || d > 42) return null;
        const k = clamp01(d / 42);
        const color = EVENT_COLOR[e.tone];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 150 + 90 * EASE_OUT(k),
              transform: `translateX(-50%) scale(${(e.tone === "tiny" ? 0.75 : 1.15) * (d < 6 ? 0.6 + 0.4 * (d / 6) : 1)})`,
              opacity: d > 30 ? 1 - (d - 30) / 12 : 1,
              fontFamily: FONT.heavy,
              fontWeight: 900,
              fontSize: 54,
              color,
              whiteSpace: "nowrap",
              WebkitTextStroke: "10px #10131F",
              paintOrder: "stroke fill",
              textShadow: `0 0 18px ${color}`,
            }}
          >
            {e.text}
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 26px 16px 20px",
          borderRadius: 30,
          background: "linear-gradient(180deg, rgba(14,24,48,0.88), rgba(8,14,30,0.92))",
          border: `5px solid ${pal.edge}`,
          boxShadow: `0 0 ${18 + 22 * pulse}px ${pal.edge}, inset 0 0 22px rgba(79,227,255,0.18), 0 8px 0 rgba(0,0,0,0.35)`,
          minWidth: 300,
        }}
      >
        <Hourglass size={40} color={pal.edge} phase={(frame % 60) / 60} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.02 }}>
          <div style={{ ...MONO_DIGITS, fontFamily: FONT.heavy, fontWeight: 900, fontSize: tier === "years" || tier === "days" ? big : 62, color: pal.text, whiteSpace: "nowrap", letterSpacing: 1 }}>
            {main}
          </div>
          {sub ? (
            <div style={{ ...MONO_DIGITS, fontFamily: FONT.heavy, fontWeight: 800, fontSize: 30, color: pal.sub, whiteSpace: "nowrap", marginTop: 4 }}>{sub}</div>
          ) : null}
        </div>
        {frozen ? (
          <div
            style={{
              marginLeft: 6,
              width: 44,
              height: 44,
              borderRadius: 22,
              background: "#4FE3FF",
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
      </div>
      {/* The projector beam down to the head. */}
      <div style={{ position: "relative", height: 34 }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
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
            top: 14,
            transform: "translateX(-50%)",
            width: 90,
            height: 20,
            background: `radial-gradient(ellipse at 50% 100%, ${pal.edge}88, transparent 70%)`,
          }}
        />
      </div>
    </div>
  );
};
