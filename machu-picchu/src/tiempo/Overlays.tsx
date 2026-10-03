import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  CommentCard,
  CountdownPulse,
  CrashGlitch,
  EndCard,
  ExtractionScreen,
  PriceSticker,
  RuleSign,
  ScanStamp,
  TimecoNotification,
  TitleSticker,
} from "../overlay/tiempo/TiempoUI";
import { CARGO, COMPRAS, ESCALA, FINAL, HOOK, OFICINA, TIMECO } from "./beats";

/** Price stickers sit in the calm top band the shots keep free (x 200-800, y 240-450). */
const PRICE_X = 500;
const PRICE_Y = 360;

// The 2D layer over the 3D shots, all inside the TikTok safe area (x 60-940, y 230-1180).
export const TiempoOverlays: React.FC = () => {
  const g = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <TitleSticker frame={g} at={HOOK.START + 4} out={HOOK.END - 16} />

      <PriceSticker frame={g} at={COMPRAS.SEIS - 2} out={COMPRAS.PIZZA - 2} x={PRICE_X} y={PRICE_Y} item="JUGO" price="6 HORAS" />
      <PriceSticker frame={g} at={COMPRAS.TRES} out={COMPRAS.END - 2} x={PRICE_X} y={PRICE_Y} item="PIZZA" price="3 DÍAS" />
      <PriceSticker frame={g} at={ESCALA.MES} out={ESCALA.AUTO - 2} x={PRICE_X} y={PRICE_Y} item="CELULAR" price="1 MES" />
      <PriceSticker frame={g} at={ESCALA.ANOS} out={ESCALA.CASA_CUT - 2} x={PRICE_X} y={PRICE_Y} item="AUTO" price="5 AÑOS" />
      <PriceSticker frame={g} at={ESCALA.CASA} out={ESCALA.END - 4} x={PRICE_X} y={PRICE_Y} item="CASA" price="40 AÑOS" />

      {/* The rule, with its fine print dropping in on the coworker's "productivo". */}
      <RuleSign frame={g} at={OFICINA.DIA} out={OFICINA.END} x={500} y={370} asteriskAt={OFICINA.PRODUCTIVO} scale={0.92} />

      <TimecoNotification frame={g} at={CARGO.NOTIF} out={CARGO.EXHALE} thanksAt={CARGO.GRACIAS} />

      <ExtractionScreen frame={g} at={TIMECO.SCREEN} out={TIMECO.END} />

      <ScanStamp frame={g} at={FINAL.SCAN} out={FINAL.MULTA - 2} x={500} y={760} stampAt={FINAL.L14 + 4} />
      <CrashGlitch frame={g} at={FINAL.MULTA - 1} />
      <CountdownPulse frame={g} from={FINAL.MULTA} to={FINAL.BLACK} />
      <CommentCard frame={g} at={FINAL.CARD} out={FINAL.BLACK} />
      <EndCard frame={g} at={FINAL.BLACK} />
    </AbsoluteFill>
  );
};
