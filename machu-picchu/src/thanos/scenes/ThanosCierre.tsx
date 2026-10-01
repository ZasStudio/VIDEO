import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FinalQuestion } from "../../overlay/thanos/ThanosUI";
import { CIERRE } from "../beats";
import { THANOS } from "../timeline";

// Black: "¿Nubi debería enfrentar a Doctor Doom?"
export const ThanosCierre: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + THANOS.SCENES.cierre.from;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <FinalQuestion frame={g} at={CIERRE.START + 1} />
    </AbsoluteFill>
  );
};
