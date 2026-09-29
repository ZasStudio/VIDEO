import React from "react";
import { AbsoluteFill } from "remotion";
import { EASE_IN, EASE_OUT, ramp, rand } from "../anim";

// Costume-change transition: a cloud of cartoon smoke puffs swells until it covers the
// whole frame on the cut (frame `at`), then bursts outward and fades, revealing Nubi in
// its new outfit.

const GROW = 9;
const CLEAR = 13;

type Puff = { a: number; dist: number; r: number; tint: string };

const TINTS = ["#FFFFFF", "#F3FFF7", "#FFF3FA", "#FFFBEA", "#EEF6FF"];

// Three rings around the centre: together they cover a 1080 x 1920 frame at full size.
const PUFFS: Puff[] = [
  { a: 0, dist: 0, r: 560, tint: TINTS[0] },
  ...Array.from({ length: 9 }, (_, i) => ({
    a: (i / 9) * Math.PI * 2 + rand(i * 3) * 0.3,
    dist: 560 + rand(i * 5) * 80,
    r: 400 + rand(i * 7) * 90,
    tint: TINTS[(i + 1) % TINTS.length],
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    a: (i / 12) * Math.PI * 2 + 0.2 + rand(i * 11) * 0.25,
    dist: 1050 + rand(i * 13) * 120,
    r: 430 + rand(i * 17) * 100,
    tint: TINTS[i % TINTS.length],
  })),
];

export const PoofWipe: React.FC<{ frame: number; at: number; x?: number; y?: number }> = ({ frame, at, x = 540, y = 1000 }) => {
  const d = frame - at;
  if (d < -GROW || d > CLEAR) return null;
  const grow = d < 0 ? EASE_OUT(Math.max(0, (d + GROW) / GROW)) : 1;
  const clear = d > 0 ? ramp(d, 0, CLEAR, [0, 1], EASE_IN) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {PUFFS.map((p, i) => {
        // Outer puffs arrive a touch later and leave first, so the cloud seems to boil.
        const lag = p.dist > 800 ? 0.12 : p.dist > 0 ? 0.06 : 0;
        const gk = Math.max(0, Math.min(1, (grow - lag) / (1 - lag)));
        const dist = p.dist * (0.25 + 0.75 * gk) * (1 + clear * 0.6);
        const r = p.r * gk * (1 - clear * 0.55) * (1 + 0.04 * Math.sin(frame * 0.9 + i));
        if (r < 2) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(p.a) * dist - r,
              top: y + Math.sin(p.a) * dist * 1.15 - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              background: `radial-gradient(circle at 36% 30%, #FFFFFF 0%, ${p.tint} 52%, #D5DFF2 100%)`,
              boxShadow: "inset -18px -24px 0 rgba(150,170,210,0.25)",
              opacity: 1 - Math.pow(clear, 1.5),
            }}
          />
        );
      })}
      {/* A few sparkles pop out of the smoke as it clears. */}
      {d > 0
        ? Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2 + rand(i * 19);
            const t = d / CLEAR;
            const dist = 160 + t * (380 + rand(i * 23) * 220);
            const s = (1 - t) * (34 + rand(i * 29) * 26);
            return (
              <svg
                key={`s${i}`}
                width={s * 2}
                height={s * 2}
                viewBox="-10 -10 20 20"
                style={{ position: "absolute", left: x + Math.cos(a) * dist - s, top: y + Math.sin(a) * dist - s, transform: `rotate(${t * 180}deg)` }}
              >
                <path d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" fill={i % 2 ? "#FFD60A" : "#FFFFFF"} stroke="#2B1B5A" strokeWidth={1.2} />
              </svg>
            );
          })
        : null}
    </AbsoluteFill>
  );
};
