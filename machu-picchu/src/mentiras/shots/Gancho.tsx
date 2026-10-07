import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SHOTS } from "../shots";

// Placeholder for shot "gancho" (to be built by its agent).
export const GanchoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.gancho.from;
  return (
    <AbsoluteFill style={{ background: "#1B2440", color: "#fff", fontSize: 80, fontFamily: "Montserrat", fontWeight: 900, alignItems: "center", justifyContent: "center" }}>
      {"Gancho"} {g}
    </AbsoluteFill>
  );
};
