import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Disclaimer, EndCard, FilmGrain, GlitchCut, GoalStamp, HorrorTitle, VHSOverlay } from "../overlay/matusita/MatusitaUI";
import { FINAL, GANCHO, LUGAR, RETO, SUSTO } from "./beats";

// The 2D layer over the 3D shots, all inside the TikTok safe area (x 60-940, y 230-1180).
export const MatusitaOverlays: React.FC = () => {
  const g = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* The title, gone before the "META / DURÓ" stamp under Nubi's eyes. */}
      <HorrorTitle frame={g} at={GANCHO.LIGHT + 4} out={GANCHO.SIETE - 10} />
      <GoalStamp frame={g} goalAt={GANCHO.SIETE} realAt={GANCHO.DOS} out={GANCHO.END - 6} x={500} y={1060} />

      <Disclaimer frame={g} at={LUGAR.L02} out={LUGAR.SEGUNDO} />

      {/* The legend, re-enacted as camcorder footage; the clock skips two hours when the door opens. */}
      <VHSOverlay frame={g} from={RETO.REC} to={SUSTO.END} jumpAt={SUSTO.HORAS} />
      <GlitchCut frame={g} at={SUSTO.OFF} />

      <EndCard frame={g} at={FINAL.CARD} />
      <FilmGrain frame={g} />
    </AbsoluteFill>
  );
};
