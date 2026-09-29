import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT } from "../theme";
import { IncaMap } from "../overlay/inca/IncaMap";
import {
  ChatScreen,
  CommentsCTA,
  NotificationStorm,
  PhoneFrame,
  SCREEN_H,
  SCREEN_W,
  SelfieUI,
  WeatherCard,
} from "../overlay/inca/PhoneUI";

// Review sheet (1080 x 1920) for the 2D overlays of the Inca-phone short: every component
// plays once, in order, over a stand-in backdrop, so single frames can be checked.

export const INCA_UI_SEGMENTS = [
  { name: "PhoneFrame + ChatScreen (typing)", from: 0, to: 64 },
  { name: "NotificationStorm", from: 64, to: 124 },
  { name: "ChatScreen (reply + location)", from: 124, to: 214 },
  { name: "WeatherCard", from: 214, to: 262 },
  { name: "SelfieUI", from: 262, to: 322 },
  { name: "IncaMap", from: 322, to: 452 },
  { name: "CommentsCTA", from: 452, to: 530 },
  { name: "Phone at scale 0.6: fontSize 44 vs 60", from: 530, to: 590 },
  { name: "Transparent PhoneFrame + SelfieUI inside", from: 590, to: 650 },
];
export const INCA_UI_SHEET_DURATION = 650;

const CHECK_MESSAGES = [
  { at: 470, from: "them" as const, text: "¡Mi Inca, hay un problema en el norte!" },
  { at: 480, from: "me" as const, text: "¡Entonces manda tu ubicación, pues!" },
  { at: 490, from: "them" as const, kind: "location" as const, place: "Tumbes" },
];

/** Stand-in for the 3D scene: sky, Andes and a mint blob where Nubi would stand. */
const Backdrop: React.FC<{ frame: number; nubi?: boolean }> = ({ frame, nubi }) => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #2E7DE0 0%, #6BB8F5 45%, #FFE2BD 72%, #FFE2BD 100%)" }}>
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <path d="M0 1260 L180 1020 L330 1150 L520 900 L700 1120 L860 980 L1080 1200 L1080 1920 L0 1920 Z" fill="#4E9B5A" />
      <path d="M0 1380 L260 1200 L480 1330 L720 1180 L1080 1360 L1080 1920 L0 1920 Z" fill="#3C8048" />
      <path d="M0 1560 Q540 1470 1080 1560 L1080 1920 L0 1920 Z" fill="#6BBE5A" />
      {nubi ? (
        <g transform={`translate(540 ${1180 + Math.sin(frame * 0.2) * 8})`}>
          <ellipse cx={0} cy={250} rx={170} ry={30} fill="rgba(0,0,0,0.2)" />
          <path d="M-150 230 Q-170 -40 0 -60 Q170 -40 150 230 Z" fill="#7FE3C3" stroke="#2C7A64" strokeWidth={8} />
          <circle cx={-50} cy={60} r={22} fill="#1B2A24" />
          <circle cx={50} cy={60} r={22} fill="#1B2A24" />
          <path d="M-30 120 Q0 150 30 120" stroke="#1B2A24" strokeWidth={8} fill="none" strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  </AbsoluteFill>
);

export const IncaUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = INCA_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? INCA_UI_SEGMENTS[INCA_UI_SEGMENTS.length - 1];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop frame={frame} nubi={seg.name === "SelfieUI" || seg.from === 590} />

      {/* 1. The chasqui types "Mi Inca, noticias urgentes" to the Sapa Inca. */}
      <PhoneFrame frame={frame} at={0} out={56} x={540} y={830}>
        <ChatScreen
          frame={frame}
          contact={{ name: "Sapa Inca", avatar: "crown" }}
          messages={[{ at: 42, from: "me", text: "Mi Inca, noticias urgentes", typingFrom: 10, readAt: 52 }]}
        />
      </PhoneFrame>

      {/* 2. 99 messages. */}
      <NotificationStorm frame={frame} from={68} to={108} count={99} x={540} y={330} out={118} />

      {/* 3. The northern chasqui writes back and shares his live location. */}
      <PhoneFrame frame={frame} at={124} out={204} x={540} y={830}>
        <ChatScreen
          frame={frame}
          contact={{ name: "Chasqui del Norte", avatar: "chasqui" }}
          messages={[
            { at: 142, from: "them", text: "¡Mi Inca, hay un problema en el norte!", typingFrom: 130 },
            { at: 176, from: "me", text: "¡Entonces manda tu ubicación, pues!", typingFrom: 148 },
            { at: 190, from: "them", kind: "location", place: "Tumbes, norte del imperio", typingFrom: 180 },
          ]}
        />
      </PhoneFrame>

      {/* 4. App-papa's forecast. */}
      <WeatherCard frame={frame} at={216} out={254} x={540} y={760} />

      {/* 5. Selfie camera at Machu Picchu. */}
      <SelfieUI
        frame={frame}
        at={264}
        out={314}
        recStart={264}
        flashAt={300}
        sticker={{ text: "POV: subiste hasta aquí", at: 270, out: 312 }}
      />

      {/* 6. Qhapaq Ñan map. */}
      <IncaMap frame={frame} from={322} out={444} />

      {/* 7. Call to action. */}
      <CommentsCTA frame={frame} at={454} x={540} y={700} out={524} />

      {/* 8. Legibility check: the phone as small as the scenes use it, default vs bigger bubble text. */}
      {[
        { x: 290, fontSize: 44 },
        { x: 790, fontSize: 60 },
      ].map((v) => (
        <PhoneFrame key={v.x} frame={frame} at={530} out={582} x={v.x} y={700} scale={0.6} float={false}>
          <ChatScreen frame={frame} contact={{ name: "Chasqui del Norte", avatar: "chasqui" }} messages={CHECK_MESSAGES} fontSize={v.fontSize} />
        </PhoneFrame>
      ))}

      {/* 9. The phone as a see-through camera: the scene shows through the screen. */}
      <PhoneFrame frame={frame} at={592} out={700} x={540} y={900} scale={0.9} transparent tilt={-4}>
        <SelfieUI
          frame={frame}
          at={596}
          out={700}
          recStart={596}
          flashAt={630}
          width={SCREEN_W}
          height={SCREEN_H}
          sticker={{ text: "POV: selfie inca", at: 604, out: 700 }}
        />
      </PhoneFrame>

      <div
        style={{
          position: "absolute",
          left: 24,
          top: 24,
          padding: "8px 16px",
          borderRadius: 12,
          background: "rgba(0,0,0,0.55)",
          fontFamily: FONT.heavy,
          fontWeight: 800,
          fontSize: 24,
          color: "#fff",
        }}
      >
        {`${seg.name} · f${frame}`}
      </div>
    </AbsoluteFill>
  );
};
