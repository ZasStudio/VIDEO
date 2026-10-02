import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  CommentReply,
  DreamRipple,
  FactChip,
  FreezeLabel,
  PortraitSketch,
  PriceTag,
  RewindCard,
  ShareOrSurvive,
  WaterMeter,
} from "../overlay/agua/AguaUI";
import { ImpactText, SlowMoBars } from "../overlay/thanos/ThanosUI";
import { ANTES, FINAL, GIRO, HOOK, PROBLEMA, SOLUCION } from "./beats";

/** The script asks for the comment during the first 6 seconds. */
const COMMENT_OUT = 6 * 30;

// The 2D layer over the 3D shots, all inside the TikTok safe area (x 60-940, y 230-1180).
export const AguaOverlays: React.FC = () => {
  const g = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* The viewer's comment this video answers, small in the top-left corner. */}
      <CommentReply frame={g} at={HOOK.START + 2} out={COMMENT_OUT} x={300} y={330} />
      {/* Drains with the picture (see oceanoWater in shots/Oceano.tsx). */}
      <WaterMeter frame={g} at={HOOK.OCEAN - 4} from={HOOK.AHORA - 9} to={HOOK.AHORA + 11} out={HOOK.L02 - 2} x={770} y={330} />
      <FreezeLabel frame={g} at={HOOK.FREEZE} out={HOOK.END} x={540} y={690} />

      <RewindCard frame={g} at={ANTES.START} out={ANTES.END - 4} />

      <FactChip
        frame={g}
        at={PROBLEMA.SED}
        out={PROBLEMA.L06 - 4}
        x={500}
        y={380}
        icon="clock"
        text="Sin agua, una persona resiste solo *3 días*"
      />
      <FactChip
        frame={g}
        at={PROBLEMA.L06 + 6}
        out={PROBLEMA.CONSEGUIR - 3}
        x={500}
        y={380}
        icon="plant"
        text="El *70%* del agua dulce se usa para cultivar comida"
      />

      <PriceTag frame={g} at={SOLUCION.MILLONES - 4} out={SOLUCION.L10 + 10} x={500} y={420} price="S/ 10 000 000" caption="LA ÚLTIMA" tone="gold" />
      <PriceTag frame={g} at={SOLUCION.SOLES - 2} out={SOLUCION.DRAW - 2} x={500} y={420} price="S/ 3 + 1 RETRATO" tone="cheap" />
      <PortraitSketch frame={g} at={SOLUCION.DRAW} drawTo={SOLUCION.SHOW} out={SOLUCION.GIVE} x={520} y={560} scale={0.9} />

      <ImpactText frame={g} at={GIRO.NO} out={GIRO.HOLE - 4} text="¡NO!" x={500} y={420} color="#FF4D4D" textColors={["#FFFFFF"]} size={130} />
      <SlowMoBars frame={g} from={GIRO.DIVE} to={FINAL.START} speed="×0.25" />

      <DreamRipple frame={g} at={FINAL.START} />
      <ShareOrSurvive frame={g} at={FINAL.CARD} />
    </AbsoluteFill>
  );
};
