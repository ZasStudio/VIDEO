import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SHOTS } from "../shots";

// Placeholder for shot "final" (to be built by its agent).
export const FinalShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.final.from;
  return (
    <AbsoluteFill style={{ background: "#1B2440", color: "#fff", fontSize: 80, fontFamily: "Montserrat", fontWeight: 900, alignItems: "center", justifyContent: "center" }}>
      {"Final"} {g}
    </AbsoluteFill>
  );
};
