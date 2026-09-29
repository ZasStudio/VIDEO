import React from "react";
import { FONT } from "../../theme";
import { INK } from "./icons";

/**
 * Big outlined title text (gradient fill, heavy dark outline, hard drop). Same look as
 * BigNumber, but the gradient box reaches above the capitals, so Spanish accents and the tilde
 * (É, Ó, Ñ) are filled instead of showing as dark blobs. `colors` run top to bottom.
 */
export const HeavyText: React.FC<{
  text: string;
  size?: number;
  colors?: string[];
  stroke?: string;
  font?: string;
  style?: React.CSSProperties;
}> = ({ text, size = 120, colors = ["#FFFBD1", "#FFD21F", "#FF9500"], stroke = INK, font = FONT.title, style }) => {
  const pad = Math.round(size * 0.34);
  const f = pad / (size + pad);
  const stops = colors.map((c, i) => `${c} ${((f + (1 - f) * (i / Math.max(1, colors.length - 1))) * 100).toFixed(1)}%`).join(", ");
  const gradient = `linear-gradient(180deg, ${colors[0]} 0%, ${stops})`;
  const layer: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    paddingTop: pad,
    color: stroke,
    WebkitTextStroke: `${size * 0.12}px ${stroke}`,
  };
  return (
    <div
      style={{
        position: "relative",
        fontFamily: font,
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        marginTop: -pad,
        ...style,
      }}
    >
      <span style={{ ...layer, transform: `translateY(${size * 0.07}px)` }}>{text}</span>
      <span style={layer}>{text}</span>
      <span
        style={{
          position: "relative",
          display: "inline-block",
          paddingTop: pad,
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
};
