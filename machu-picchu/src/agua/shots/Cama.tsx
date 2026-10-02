import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// Placeholder shot "Cama" (replaced by its builder). Rendered inside a Sequence: useCurrentFrame()
// is local to the shot; the global frame is that plus the shot's start (see ../shots.ts).
export const CamaShot: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#16324A", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 90, fontFamily: "sans-serif" }}>
      Cama {frame}
    </AbsoluteFill>
  );
};
