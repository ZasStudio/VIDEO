import React from "react";
import { EASE_IN, clamp01, pop, ramp } from "../../anim";
import { FONT } from "../../theme";

// The truth tag of "¿Y si tus mentiras salieran sobre tu cabeza?": the sign that pops over a liar's
// head with the truth. Drawn by the shots (2D, over their <Stage>), anchored with tagAt() so it
// follows the head. Everything is driven by the global `frame` plus explicit cue frames.
//
// FIRST VERSION (API stub): the UI agent owns this file and restyles it, keeping the props below.

export type TagLine = {
  text: string;
  /** Global frame this line appears (default: the tag's `at`). Later lines append under the first. */
  at?: number;
  /** Optional rewrite of the line later on (e.g. "TIENE S/800" -> "TIENE S/700"). */
  then?: { text: string; at: number };
};

export type TruthTagProps = {
  /** Global frame. */
  frame: number;
  /** Global frame the tag pops in. */
  at: number;
  /** Global frame it starts leaving (gone ~8 frames later). */
  out?: number;
  lines?: TagLine[];
  /** Screen point (px) touched by the tip of the tag's pointer: just above the head. */
  x: number;
  y: number;
  /** From tagAt(). */
  scale?: number;
  opacity?: number;
  /** "slam" (default): drops in and slams down. "rise": grows up out of the head, ripping through
   * whatever covers it (the cap in the café). */
  entrance?: "slam" | "rise";
  /** The empty tag of the silent Nubi: no text, three loading dots, then it gives up at `out`. */
  loading?: boolean;
  /** Global frame Nubi swats it: it flies off spinning. */
  swatAt?: number;
  /** Card width limit in px at scale 1 (the text wraps inside). */
  maxWidth?: number;
};

const INK = "#1A1233";
const RED = "#FF3B4E";
const YELLOW = "#FFE14D";

export const TruthTag: React.FC<TruthTagProps> = ({
  frame,
  at,
  out,
  lines = [],
  x,
  y,
  scale = 1,
  opacity = 1,
  entrance = "slam",
  loading = false,
  swatAt,
  maxWidth = 760,
}) => {
  if (frame < at - 1) return null;
  if (out !== undefined && frame > out + 10) return null;
  const inK = pop(frame, at, { damping: 9, stiffness: 220, mass: 0.6 });
  const outK = out === undefined ? 0 : ramp(frame, out, out + 8, [0, 1], EASE_IN);
  const swat = swatAt === undefined ? 0 : ramp(frame, swatAt, swatAt + 14, [0, 1], EASE_IN);
  const drop = entrance === "slam" ? (1 - clamp01(inK)) * -120 : 0;
  const grow = entrance === "rise" ? clamp01(ramp(frame, at, at + 10)) : 1;
  const s = scale * (entrance === "slam" ? inK : 0.6 + 0.4 * inK) * (1 - outK);
  const dots = Math.floor((frame - at) / 5) % 4;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -100%) translate(${swat * 900}px, ${drop - swat * 300}px) rotate(${swat * 300}deg) scale(${s})`,
        transformOrigin: "50% 100%",
        opacity: opacity * (1 - swat),
        clipPath: entrance === "rise" ? `inset(${(1 - grow) * 100}% -40px -40px -40px)` : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: YELLOW,
          border: `6px solid ${INK}`,
          borderRadius: 22,
          boxShadow: `0 10px 0 rgba(0,0,0,0.35)`,
          maxWidth,
          overflow: "hidden",
          fontFamily: FONT.heavy,
          fontWeight: 900,
          textAlign: "center",
        }}
      >
        <div style={{ background: RED, color: "#fff", fontSize: 30, letterSpacing: 6, padding: "6px 24px" }}>VERDAD</div>
        <div style={{ padding: "12px 28px 16px", color: INK, fontSize: 56, lineHeight: 1.05 }}>
          {loading ? (
            <span>{".".repeat(dots).padEnd(3, " ")}</span>
          ) : (
            lines.map((l, i) => {
              const la = l.at ?? at;
              if (frame < la) return null;
              const k = pop(frame, la, { damping: 10, stiffness: 240, mass: 0.5 });
              const text = l.then && frame >= l.then.at ? l.then.text : l.text;
              return (
                <div key={i} style={{ transform: `scale(${k})`, fontSize: i === 0 ? 56 : 46 }}>
                  {text}
                </div>
              );
            })
          )}
        </div>
      </div>
      <div style={{ width: 0, height: 0, borderLeft: "22px solid transparent", borderRight: "22px solid transparent", borderTop: `26px solid ${INK}`, marginTop: -2 }} />
    </div>
  );
};
