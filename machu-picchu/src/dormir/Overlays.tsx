import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ChargesPhone, EndText, NightClock, PayToast, PriceTag, RuleStamp, SilenceSign, TitleSticker } from "../overlay/dormir/DormirUI";
import { ENEMIGO, FINAL, GANCHO, GIRO, MUNDO } from "./beats";

// The 2D layer over the 3D shots (the money counters and the bed sensor are drawn inside the shots,
// anchored to their beds). Opacity just under 1: opaque cards over the WebGL canvas make Chrome's
// compositor cull a misplaced strip of the 3D under them (seen in the AI short).
export const DormirOverlays: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.995 }}>
      {/* The hook: the premise from the first frame, then the rule. */}
      <TitleSticker frame={frame} at={-4} out={GANCHO.CIEN - 12} />
      <RuleStamp frame={frame} at={GANCHO.CIEN - 3} out={GANCHO.END - 8} />

      <PriceTag frame={frame} at={MUNDO.L09 + 6} out={MUNDO.END - 10} />
      <SilenceSign frame={frame} at={ENEMIGO.L13 + 4} out={ENEMIGO.L14 - 4} />

      {/* The turn: paying for silence, the night flying by, the three charges. */}
      <PayToast frame={frame} at={GIRO.PAY} out={GIRO.MASK + 4} />
      <NightClock frame={frame} at={GIRO.MASK + 12} from={GIRO.MASK + 14} to={GIRO.MIL} out={GIRO.OJOS - 4} />
      <ChargesPhone
        frame={frame}
        at={GIRO.OJOS + 8}
        charge1={GIRO.CHARGE1}
        charge2={GIRO.CHARGE2}
        charge3={GIRO.CHARGE3}
        zeroAt={GIRO.ZERO}
        out={GIRO.END - 8}
      />

      <EndText frame={frame} at={FINAL.CARD} />
    </AbsoluteFill>
  );
};
