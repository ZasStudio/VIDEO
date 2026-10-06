import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// The 2D layer over the 3D shots (title, rule stamp, phone, end text), inside the TikTok safe area.
// Opacity just under 1: opaque cards over the WebGL canvas make Chrome's compositor cull a misplaced
// strip of the 3D under them (seen in the AI short).
export const DormirOverlays: React.FC = () => {
  useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.995 }} />;
};
