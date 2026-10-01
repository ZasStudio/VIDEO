import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { PostCreditsCard } from "../../overlay/thanos/ThanosUI";
import { POSCREDITOS } from "../beats";
import { THANOS } from "../timeline";

// Black: "ESCENA POSCRÉDITOS…" while a metallic clank echoes.
export const ThanosPoscreditos: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + THANOS.SCENES.poscreditos.from;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <PostCreditsCard frame={g} at={POSCREDITOS.START + 4} out={POSCREDITOS.END - 8} />
    </AbsoluteFill>
  );
};
