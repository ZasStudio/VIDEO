import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// The 2D layer over the 3D shots, all inside the TikTok safe area (x 60-940, y 230-1180).
// (Filled in once the overlay components exist.)
export const TiempoOverlays: React.FC = () => {
  useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: "none" }} />;
};
