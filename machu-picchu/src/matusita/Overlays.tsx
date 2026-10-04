import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// The 2D layer over the 3D shots (filled in once the overlay components exist).
export const MatusitaOverlays: React.FC = () => {
  useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: "none" }} />;
};
