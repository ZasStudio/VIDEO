import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { EASE_OUT, pop, ramp, rand } from "../anim";
import { FONT } from "../theme";

// 2D extras for the Inca-phone short: hearts and a like counter when Machu Picchu goes
// viral, and a sky that flips between day and night while the chasqui runs "for days".

const Heart: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path
      d="M50 88 C18 64 6 46 10 30 C14 14 34 8 50 26 C66 8 86 14 90 30 C94 46 82 64 50 88 Z"
      fill={color}
      stroke="#FFFFFF"
      strokeWidth={7}
      strokeLinejoin="round"
    />
  </svg>
);

/** Hearts float up from the bottom and a like counter races up, from `at` to `out`. */
export const ViralHearts: React.FC<{ frame: number; at: number; out: number; x?: number; y?: number }> = ({
  frame,
  at,
  out,
  x = 780,
  y = 1180,
}) => {
  if (frame < at || frame > out + 12) return null;
  const k = 1 - ramp(frame, out, out + 12);
  const likes = Math.round(interpolate(frame, [at, at + 40], [0, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT }) * 10) / 10;
  const badge = pop(frame, at, { damping: 11, stiffness: 180 }) * k;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 22 }, (_, i) => {
        const born = at + i * 2.5;
        const t = (frame - born) / 34;
        if (t < 0 || t > 1) return null;
        const hx = x - 120 + rand(i * 3) * 260 + Math.sin(t * 5 + i) * 30;
        const hy = y - t * 620;
        const s = 60 + rand(i * 7) * 50;
        const color = ["#FF3D7F", "#FF4B3E", "#FF8A3D", "#FF5FA2"][i % 4];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: hx,
              top: hy,
              opacity: (1 - Math.pow(t, 2)) * k,
              transform: `scale(${0.4 + ramp(t, 0, 0.2, [0, 0.6], EASE_OUT)}) rotate(${(rand(i) - 0.5) * 40}deg)`,
            }}
          >
            <Heart size={s} color={color} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: x - 250,
          top: y - 760,
          transform: `scale(${badge}) rotate(${(1 - badge) * -20 + 4}deg)`,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 30px 14px 20px",
          borderRadius: 999,
          background: "linear-gradient(135deg, #FF3D7F 0%, #FF8A3D 100%)",
          border: "6px solid #fff",
          boxShadow: "0 10px 0 rgba(0,0,0,0.3), 0 20px 40px rgba(0,0,0,0.35)",
        }}
      >
        <Heart size={96} color="#FFFFFF" />
        <div style={{ fontFamily: FONT.title, fontSize: 96, color: "#fff", paddingTop: 10, textShadow: "0 5px 0 rgba(0,0,0,0.3)" }}>
          {likes.toFixed(1).replace(".", ",")} M
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0 = day, 1 = night, cycling `cycles` times between `from` and `to` (a time-lapse). */
export const nightAt = (frame: number, from: number, to: number, cycles = 3) => {
  const t = ramp(frame, from, to, [0, 1], (v) => v);
  return t > 0 && t < 1 ? (1 - Math.cos(t * cycles * Math.PI * 2)) / 2 : 0;
};

/** Background sky that cycles day -> night -> day `cycles` times between `from` and `to`. */
export const DayNightSky: React.FC<{ frame: number; from: number; to: number; cycles?: number }> = ({ frame, from, to, cycles = 3 }) => {
  const t = ramp(frame, from, to, [0, 1], (v) => v);
  const night = nightAt(frame, from, to, cycles);
  const sunA = t * cycles * Math.PI * 2;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #2E8BFF 0%, #7CC8FF 55%, #FFE3B0 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #0B1240 0%, #26306E 60%, #5A3E7A 100%)", opacity: night }} />
      {night > 0.3
        ? Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: rand(i * 5) * 1080,
                top: rand(i * 9) * 900,
                width: 6,
                height: 6,
                borderRadius: 3,
                background: "#FFFFFF",
                opacity: (night - 0.3) * (0.6 + 0.4 * Math.sin(frame * 0.3 + i)),
              }}
            />
          ))
        : null}
      {/* The sun and the moon swing across the sky. */}
      <div
        style={{
          position: "absolute",
          left: 540 + Math.sin(sunA) * 380 - 90,
          top: 520 - Math.cos(sunA) * 360 - 90,
          width: 180,
          height: 180,
          borderRadius: 90,
          background: "radial-gradient(circle, #FFF6B0 0%, #FFD23F 60%, #FF9E1F 100%)",
          boxShadow: "0 0 80px 30px rgba(255,210,63,0.45)",
          opacity: 1 - night,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 540 - Math.sin(sunA) * 380 - 70,
          top: 520 + Math.cos(sunA) * 360 - 70,
          width: 140,
          height: 140,
          borderRadius: 70,
          background: "radial-gradient(circle at 35% 35%, #FFFFFF 0%, #E3E8FF 60%, #B9C2F2 100%)",
          boxShadow: "0 0 60px 20px rgba(220,230,255,0.35)",
          opacity: night,
        }}
      />
    </AbsoluteFill>
  );
};

/** Horizontal speed streaks rushing to the left (strength `k`, 0..1). */
export const SpeedLines: React.FC<{ frame: number; k: number; top?: number; bottom?: number }> = ({ frame, k, top = 260, bottom = 1280 }) => {
  if (k <= 0.01) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 16 }, (_, i) => {
        const len = 160 + rand(i * 3) * 260;
        const speed = 70 + rand(i * 5) * 60;
        const x = 1080 + 400 - ((frame * speed + rand(i * 7) * 3000) % (1080 + 800));
        const y = top + rand(i * 11) * (bottom - top);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: len,
              height: 7 + rand(i * 13) * 6,
              borderRadius: 8,
              background: "linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)",
              opacity: k * (0.5 + 0.5 * rand(i * 17)),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
