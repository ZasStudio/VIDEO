import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// The 2D layer over the 3D shots (the truth tags are drawn inside the shots, anchored to the heads).
// Opacity just under 1: opaque cards over the WebGL canvas make Chrome's compositor cull a misplaced
// strip of the 3D under them (seen in the AI short).
export const MentirasOverlays: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.995 }} data-frame={frame} />;
};
