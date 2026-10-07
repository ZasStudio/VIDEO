import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ChatBubble, ClockStamp, EndCard, OptionCards, TitleSticker } from "../overlay/mentiras/MentirasUI";
import { CITA, FINAL, GANCHO, JEFE } from "./beats";

// The 2D layer over the 3D shots (the truth tags are drawn inside the shots, anchored to the heads).
// Opacity just under 1: opaque cards over the WebGL canvas make Chrome's compositor cull a misplaced
// strip of the 3D under them (seen in the AI short).
export const MentirasOverlays: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.995 }}>
      {/* The hook: the premise from the first frame, gone just before the first tag slams in under it. */}
      <TitleSticker frame={frame} at={-4} out={GANCHO.TAG - 12} />

      {/* The date reads Nubi's message on her phone. */}
      <ChatBubble frame={frame} at={CITA.BUBBLE} out={CITA.L11 - 2} x={430} y={520} scale={0.95} />

      {/* 6 pm at the office: everyone's free... */}
      {/* High in the band, so it clears the «SALIDA» sign over the boss in the medium shot. */}
      <ClockStamp frame={frame} at={JEFE.START + 2} out={JEFE.L13 + 40} y={262} />

      {/* The question: the three lies to vote for, then the comment bait. */}
      <OptionCards frame={frame} at1={FINAL.OPT1} at2={FINAL.OPT2} at3={FINAL.OPT3} out={FINAL.TAG - 2} poke={FINAL.L19 + 12} />
      <EndCard frame={frame} at={FINAL.CARD} />
    </AbsoluteFill>
  );
};
