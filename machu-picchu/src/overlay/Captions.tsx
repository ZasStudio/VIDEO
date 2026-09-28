import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, pop, ramp } from "../anim";
import { CAPTIONS } from "../timeline";
import { FONT } from "../theme";

// MrBeast-style captions: bottom centre, word by word, the newest word pops in yellow.
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const chunk = CAPTIONS.find((c) => frame >= c.from && frame < c.to);
  if (!chunk) return null;
  const exit = ramp(frame, chunk.to - 5, chunk.to, [0, 1], EASE_IN);
  const shown = chunk.words.filter((w) => frame >= w.at);
  const newest = shown[shown.length - 1];
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          columnGap: 30,
          rowGap: 0,
          maxWidth: 1560,
          marginBottom: 92,
          transform: `scale(${1 - exit * 0.25})`,
          opacity: 1 - exit,
        }}
      >
        {shown.map((w, i) => {
          const p = pop(frame, w.at, { damping: 14, stiffness: 200, mass: 0.7 });
          const isNew = w === newest;
          const since = frame - w.at;
          const color =
            w.color ?? (isNew && since < 12 ? "#FFD60A" : "#FFFFFF");
          const tilt =
            (i % 2 === 0 ? -1 : 1) * 1.6 * (1 - Math.min(1, since / 8));
          return (
            <span
              key={i}
              style={{
                fontFamily: FONT.heavy,
                fontWeight: 900,
                fontSize: 86,
                lineHeight: 1.12,
                letterSpacing: -1,
                color,
                WebkitTextStroke: "15px #000",
                paintOrder: "stroke fill",
                textShadow: "0 8px 0 #000, 0 14px 22px rgba(0,0,0,0.55)",
                display: "inline-block",
                transform: `translateY(${(1 - p) * 28}px) scale(${0.6 + 0.4 * p}) rotate(${tilt}deg)`,
                whiteSpace: "nowrap",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
