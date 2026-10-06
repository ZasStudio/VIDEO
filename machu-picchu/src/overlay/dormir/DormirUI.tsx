import React from "react";
import { pop } from "../../anim";
import { FONT } from "../../theme";

// 2D layer of "¿Y si dormir te pagara?". PLACEHOLDER of the money counter so the 3D shots can place it
// now; the overlay agent replaces the look (keeping these props).

export type MoneyEvent = { at: number; text: string; tone?: "plus" | "minus" };

/**
 * A floating money counter ("S/ 300") anchored at its bottom centre (x, y), as returned by
 * counterAt() in src/dormir/counter.ts. `state`: earning (green, climbing), frozen (stopped),
 * alarm (red, flashing), zero (grey). `events` pop small "+S/100" / "-S/400" labels above it.
 */
export const MoneyCounter: React.FC<{
  frame: number;
  soles: number;
  x: number;
  y: number;
  scale?: number;
  state?: "earning" | "frozen" | "alarm" | "zero";
  appear?: number;
  opacity?: number;
  events?: MoneyEvent[];
}> = ({ frame, soles, x, y, scale = 1, state = "earning", appear, opacity = 1 }) => {
  const k = appear === undefined ? 1 : pop(frame, appear, { damping: 12, stiffness: 210 });
  if (k <= 0 || opacity <= 0) return null;
  const color = state === "alarm" ? "#FF4D5E" : state === "zero" ? "#B8C0CC" : state === "frozen" ? "#FFD84D" : "#46E58A";
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -100%) scale(${scale * k})`,
        transformOrigin: "50% 100%",
        opacity,
        padding: "10px 26px",
        borderRadius: 999,
        background: "rgba(10,14,20,0.82)",
        border: `4px solid ${color}`,
        color,
        fontFamily: FONT.heavy,
        fontWeight: 900,
        fontSize: 64,
        whiteSpace: "nowrap",
      }}
    >
      S/ {Math.max(0, Math.round(soles)).toLocaleString("es-PE")}
    </div>
  );
};
