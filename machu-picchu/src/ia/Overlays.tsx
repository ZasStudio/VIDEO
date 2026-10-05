import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  AIChat,
  AIErrorPage,
  DeadlineClock,
  EndCard,
  IaSwitchBadge,
  LoveMessage,
  MessageCallback,
  MontageLabel,
  OptionCards,
  RewindFX,
  SlidesCounter,
  SocialPost,
  SplitLabels,
  TitleSticker,
  TypedDoc,
} from "../overlay/ia/IaUI";
import { FINAL, FOTO, GANCHO, GIRO, JEFE, MENSAJE, TAREA } from "./beats";

// The 2D layer over the 3D shots: every readable screen (chats, error page, clock, slides, the
// post), the switch badges and the end card, all inside the TikTok safe area.
export const IaOverlays: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Hook: her endless message, his request to the AI, the title, the switch going OFF. */}
      <LoveMessage frame={frame} at={GANCHO.START} out={GANCHO.TYPE - 4} />
      <AIChat
        frame={frame}
        at={GANCHO.TYPE}
        out={GANCHO.NUBI - 2}
        prompt="Dile que la extraño, pero sin parecer intenso"
        typeFrom={GANCHO.TYPE + 4}
        typeTo={GANCHO.SEND - 4}
        sendAt={GANCHO.SEND}
        replyAt={GANCHO.SEND + 8}
      />
      <TitleSticker frame={frame} at={GANCHO.NUBI + 4} out={GANCHO.SWITCH - 12} />
      <IaSwitchBadge frame={frame} at={GANCHO.SWITCH - 9} out={GANCHO.END - 6} to="off" />

      <SplitLabels frame={frame} at={MENSAJE.START} out={MENSAJE.END - 8} sentAt={MENSAJE.SENT} siAt={MENSAJE.SI} />

      <DeadlineClock frame={frame} at={TAREA.START + 4} out={TAREA.END - 6} midnightAt={TAREA.MIDNIGHT} />
      <AIErrorPage frame={frame} at={TAREA.ERROR} out={TAREA.TYPE - 6} />
      <TypedDoc frame={frame} at={TAREA.TYPE - 4} out={TAREA.MIDNIGHT - 2} />

      <SlidesCounter frame={frame} at={JEFE.SLIDES} out={JEFE.COFFEE1 - 4} />
      <MontageLabel frame={frame} at={JEFE.COFFEE1} out={JEFE.COFFEE2 - 4} text="CAFÉ #1" />
      <MontageLabel frame={frame} at={JEFE.COFFEE2} out={JEFE.SUNRISE - 4} text="CAFÉ #7" />
      <MontageLabel frame={frame} at={JEFE.SUNRISE} out={JEFE.L09 - 6} text="6:00 A. M. ☀️" />

      <SocialPost frame={frame} at={FOTO.POST} out={FOTO.REWIND} />
      <RewindFX frame={frame} at={FOTO.REWIND} out={FOTO.REWIND + 30} />

      {/* The turn: his own message; the switch back ON; «¿Qué almuerzo?» beside a full plate. */}
      <MessageCallback frame={frame} at={GIRO.YA} sentAt={GIRO.SENT} replyAt={GIRO.REPLY} out={GIRO.PREGUNTA - 4} />
      <IaSwitchBadge frame={frame} at={GIRO.ON - 9} out={GIRO.ON + 40} to="on" />
      <AIChat
        frame={frame}
        at={GIRO.TODO - 4}
        out={GIRO.END - 4}
        prompt="¿Qué almuerzo?"
        typeFrom={GIRO.TODO + 2}
        typeTo={GIRO.ALMUERZO - 4}
        sendAt={GIRO.ALMUERZO}
        replyAt={GIRO.ALMUERZO + 6}
        reply="Analizando tus opciones de almuerzo…"
        replyCps={1.6}
      />

      <OptionCards
        frame={frame}
        tareaAt={FINAL.TAREA}
        trabajoAt={FINAL.TRABAJO}
        mensajeAt={FINAL.MENSAJE}
        wiggleAt={FINAL.SQUINT}
        out={FINAL.CARD - 8}
      />
      <EndCard frame={frame} at={FINAL.CARD} />
    </AbsoluteFill>
  );
};
