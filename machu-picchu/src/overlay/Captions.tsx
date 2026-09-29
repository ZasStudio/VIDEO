import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, pop, ramp } from "../anim";
import type { Chunk } from "../narrated";
import { CAPTIONS } from "../timeline";
import { FONT } from "../theme";

// MrBeast-style captions: word by word, the newest word pops in yellow. Bottom centre by
// default; the vertical short places them higher (`bottom`) and bigger.
export const Captions: React.FC<{
  chunks?: Chunk[];
  bottom?: number;
  fontSize?: number;
  maxWidth?: number;
  /** Horizontal offset of the block (px), e.g. to keep clear of TikTok's button column. */
  shiftX?: number;
}> = ({ chunks = CAPTIONS, bottom = 92, fontSize = 86, maxWidth = 1560, shiftX = 0 }) => {
  const frame = useCurrentFrame();
  const chunk = chunks.find((c) => frame >= c.from && frame < c.to);
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
          columnGap: fontSize * 0.35,
          rowGap: 0,
          maxWidth,
          marginBottom: bottom,
          transform: `translateX(${shiftX}px) scale(${1 - exit * 0.25})`,
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
                fontSize,
                lineHeight: 1.12,
                letterSpacing: -1,
                color,
                WebkitTextStroke: `${Math.round(fontSize * 0.175)}px #000`,
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
