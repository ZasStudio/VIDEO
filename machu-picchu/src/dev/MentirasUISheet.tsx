import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TruthTag } from "../overlay/mentiras/TruthTag";

// Review sheet for the 2D overlays of the lies short (placeholder: the UI agent fills it in).
export const MENTIRAS_UI_SHEET_DURATION = 120;

export const MentirasUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#6C8FB8" }}>
      <TruthTag frame={frame} at={6} lines={[{ text: "ACABA DE DESPERTAR" }]} x={540} y={700} />
    </AbsoluteFill>
  );
};
