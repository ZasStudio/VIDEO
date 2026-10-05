import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// The 2D layer over the 3D shots (screens, labels, end card), inside the TikTok safe area.
export const IaOverlays: React.FC = () => {
  useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: "none" }} />;
};
