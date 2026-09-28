import React from "react";
import { AbsoluteFill } from "remotion";
import { EASE_IN, pop, ramp, rand } from "../anim";
import { FONT } from "../theme";

// 2D motion-graphics pieces: cards, counters, flashes, rain, lightning, confetti, vignette.

export const fmtNumber = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Gradient pill card with an icon, popping in at `at` and out at `out`. */
export const Card: React.FC<{
  frame: number;
  at: number;
  out: number;
  x: number;
  y: number;
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  gradient?: string;
  rotate?: number;
  scale?: number;
}> = ({
  frame,
  at,
  out,
  x,
  y,
  icon,
  title,
  sub,
  gradient = "linear-gradient(135deg, #FF3D7F 0%, #FF8A00 100%)",
  rotate = -3,
  scale = 1,
}) => {
  if (frame < at || frame > out + 8) return null;
  const p = pop(frame, at, { damping: 10, stiffness: 200 });
  const k = ramp(frame, out, out + 7, [0, 1], EASE_IN);
  const s = p * (1 - k) * scale;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${s}) rotate(${rotate * (1 - p * 0.3)}deg)`,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: sub ? "20px 38px 20px 24px" : "18px 38px 18px 24px",
        borderRadius: 28,
        background: gradient,
        border: "6px solid #fff",
        boxShadow: "0 12px 0 rgba(0,0,0,0.35), 0 24px 50px rgba(0,0,0,0.35)",
        whiteSpace: "nowrap",
      }}
    >
      {icon ? (
        <div
          style={{
            width: 84,
            height: 84,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontFamily: FONT.title,
            fontSize: 64,
            lineHeight: 1,
            color: "#fff",
            textShadow: "0 5px 0 rgba(0,0,0,0.35)",
            paddingTop: 8,
          }}
        >
          {title}
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: FONT.heavy,
              fontWeight: 800,
              fontSize: 28,
              color: "rgba(255,255,255,0.92)",
              letterSpacing: 2,
              marginTop: 4,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const Flash: React.FC<{
  frame: number;
  at: number;
  dur?: number;
  color?: string;
  peak?: number;
}> = ({ frame, at, dur = 8, color = "#fff", peak = 0.9 }) => {
  const d = frame - at;
  if (d < 0 || d > dur) return null;
  return (
    <AbsoluteFill
      style={{
        background: color,
        opacity: peak * Math.pow(1 - d / dur, 2),
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({
  strength = 0.45,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Slanted rain streaks. */
export const Rain: React.FC<{
  frame: number;
  opacity?: number;
  count?: number;
}> = ({ frame, opacity = 0.55, count = 140 }) => {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const speed = 70 + rand(i) * 50;
    const len = 50 + rand(i + 3) * 70;
    const x0 = rand(i + 7) * 2300 - 200;
    const y = ((rand(i + 11) * 1400 + frame * speed) % 1400) - 200;
    const x = x0 - y * 0.25;
    lines.push(
      <line
        key={i}
        x1={x}
        y1={y}
        x2={x - len * 0.25}
        y2={y + len}
        stroke="rgba(210,225,255,0.9)"
        strokeWidth={2 + rand(i + 5) * 2}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <svg width={1920} height={1080}>
        {lines}
      </svg>
    </AbsoluteFill>
  );
};

export const Lightning: React.FC<{
  frame: number;
  at: number;
  x: number;
  seed?: number;
}> = ({ frame, at, x, seed = 1 }) => {
  const d = frame - at;
  if (d < 0 || d > 7) return null;
  const pts: [number, number][] = [[x, -20]];
  let cx = x;
  for (let i = 1; i <= 9; i++) {
    cx += (rand(seed * 17 + i) - 0.5) * 120;
    pts.push([cx, i * 62]);
  }
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const op = d < 2 ? 1 : d < 4 ? 0.3 : d < 5 ? 0.9 : 1 - (d - 5) / 2;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: op }}>
      <svg width={1920} height={1080}>
        <path
          d={path}
          stroke="rgba(170,200,255,0.6)"
          strokeWidth={26}
          fill="none"
          strokeLinejoin="round"
          style={{ filter: "blur(8px)" }}
        />
        <path
          d={path}
          stroke="#fff"
          strokeWidth={7}
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    </AbsoluteFill>
  );
};

const CONFETTI_COLORS = [
  "#FFD60A",
  "#FF3D7F",
  "#4FE3FF",
  "#4DFF7C",
  "#FF8A00",
  "#B388FF",
  "#FFFFFF",
];

export const Confetti: React.FC<{
  frame: number;
  at: number;
  count?: number;
}> = ({ frame, at, count = 120 }) => {
  const d = frame - at;
  if (d < 0) return null;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const vx = side * -(8 + rand(i) * 26);
    const vy = -(26 + rand(i + 1) * 28);
    const g = 1.25;
    const t = d;
    const x0 = side < 0 ? -40 : 1960;
    const x = x0 + vx * t * (1 - Math.min(0.5, t * 0.012));
    const y = 900 + vy * t + 0.5 * g * t * t;
    if (y > 1200) continue;
    const rot = t * (8 + rand(i + 2) * 14) * (rand(i + 9) > 0.5 ? 1 : -1);
    const w = 14 + rand(i + 4) * 14;
    pieces.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: w * 0.55,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          transform: `rotate(${rot}deg) scaleY(${Math.cos(t * 0.35 + i)})`,
          borderRadius: 3,
        }}
      />,
    );
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>{pieces}</AbsoluteFill>
  );
};

/** Expanding ring burst used on impacts. */
export const Burst: React.FC<{
  frame: number;
  at: number;
  x: number;
  y: number;
  color?: string;
  size?: number;
}> = ({ frame, at, x, y, color = "#FFD60A", size = 420 }) => {
  const d = frame - at;
  if (d < 0 || d > 14) return null;
  const t = d / 14;
  const r = size * (0.2 + 0.8 * (1 - Math.pow(1 - t, 3)));
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const r0 = r * 0.55;
    const r1 = r * (0.8 + 0.15 * (i % 2));
    rays.push(
      <line
        key={i}
        x1={x + Math.cos(a) * r0}
        y1={y + Math.sin(a) * r0}
        x2={x + Math.cos(a) * r1}
        y2={y + Math.sin(a) * r1}
        stroke={color}
        strokeWidth={14 * (1 - t)}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1920} height={1080}>
        {rays}
        <circle
          cx={x}
          cy={y}
          r={r * 0.95}
          fill="none"
          stroke="#fff"
          strokeWidth={10 * (1 - t)}
          opacity={1 - t}
        />
      </svg>
    </AbsoluteFill>
  );
};

/** Big 2D counter with gradient fill and a heavy outline. */
export const BigNumber: React.FC<{
  text: string;
  size?: number;
  gradient?: string;
  stroke?: string;
  style?: React.CSSProperties;
}> = ({
  text,
  size = 180,
  gradient = "linear-gradient(180deg, #FFFBD1 0%, #FFD21F 45%, #FF9500 100%)",
  stroke = "#200800",
  style,
}) => (
  <div
    style={{
      position: "relative",
      fontFamily: FONT.title,
      fontSize: size,
      lineHeight: 1,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    <span
      style={{
        position: "absolute",
        inset: 0,
        color: stroke,
        WebkitTextStroke: `${size * 0.12}px ${stroke}`,
        transform: `translateY(${size * 0.07}px)`,
      }}
    >
      {text}
    </span>
    <span
      style={{
        position: "absolute",
        inset: 0,
        color: stroke,
        WebkitTextStroke: `${size * 0.12}px ${stroke}`,
      }}
    >
      {text}
    </span>
    <span
      style={{
        position: "relative",
        backgroundImage: gradient,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {text}
    </span>
  </div>
);
