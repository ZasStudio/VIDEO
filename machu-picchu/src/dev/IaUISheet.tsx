import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT } from "../theme";
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

// Review sheet (1080 x 1920) for the 2D overlays of "¿Qué pasaría si la IA no existiera?": every
// component plays once, in story order and with timings close to the real beats, over a bright
// stand-in backdrop (a sunny room, a desk, Nubi as a green cube) so contrast can be judged. The
// TikTok unsafe zones (top bar, right button column, bottom description) are tinted red, the
// caption band is dashed and the safe area (x 60-940, y 230-1180) is outlined in green.

export const IA_UI_SEGMENTS = [
  { name: "LoveMessage", from: 0, to: 50 },
  { name: "AIChat (gancho)", from: 50, to: 140 },
  { name: "IaSwitchBadge OFF", from: 140, to: 200 },
  { name: "TitleSticker", from: 200, to: 280 },
  { name: "SplitLabels", from: 280, to: 520 },
  { name: "DeadlineClock + AIErrorPage + TypedDoc", from: 520, to: 730 },
  { name: "SlidesCounter", from: 730, to: 830 },
  { name: "MontageLabel", from: 830, to: 900 },
  { name: "SocialPost + RewindFX", from: 900, to: 1010 },
  { name: "MessageCallback", from: 1010, to: 1110 },
  { name: "IaSwitchBadge ON", from: 1110, to: 1170 },
  { name: "AIChat (almuerzo)", from: 1170, to: 1250 },
  { name: "OptionCards", from: 1250, to: 1370 },
  { name: "EndCard", from: 1370, to: 1420 },
];
export const IA_UI_SHEET_DURATION = 1420;

/** Nubi stand-in: a green rounded cube with two black eyes and stubby legs. */
const NubiStandIn: React.FC<{ x: number; y: number; s?: number; frame: number }> = ({ x, y, s = 1, frame }) => {
  const hop = -Math.abs(Math.sin(frame * 0.08)) * 6;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={130} ry={20} fill="rgba(0,0,0,0.18)" />
      <g transform={`translate(0 ${hop})`}>
        {[-60, 0, 60].map((lx) => (
          <rect key={lx} x={lx - 16} y={-40} width={32} height={44} rx={12} fill="#3E9A4C" />
        ))}
        <rect x={-120} y={-210} width={240} height={180} rx={50} fill="#5CC46A" />
        <ellipse cx={-44} cy={-118} rx={15} ry={22} fill="#151515" />
        <ellipse cx={44} cy={-118} rx={15} ry={22} fill="#151515" />
        <circle cx={-39} cy={-127} r={5} fill="#FFFFFF" />
        <circle cx={49} cy={-127} r={5} fill="#FFFFFF" />
      </g>
    </g>
  );
};

/** Bright stand-in for the 3D world: a sunny room, a window, a desk, Nubi. */
const Backdrop: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #8FD3FF 0%, #CDEBFF 40%, #FFE9C7 62%, #F4B97A 63%, #E39A55 100%)" }}>
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <rect x={600} y={330} width={330} height={420} rx={16} fill="#E8F7FF" stroke="#FFFFFF" strokeWidth={18} />
      <path d="M765 330 V750 M600 540 H930" stroke="#FFFFFF" strokeWidth={14} />
      <circle cx={850} cy={420} r={46} fill="#FFE27A" />
      <rect x={90} y={460} width={380} height={30} rx={8} fill="#B5835A" />
      {[110, 170, 230, 300, 360].map((bx, i) => (
        <rect key={bx} x={bx} y={340 - i * 6} width={46} height={120 + i * 6} rx={6} fill={["#FF6B6B", "#4DABF7", "#FFD43B", "#69DB7C", "#B197FC"][i]} />
      ))}
      <rect x={0} y={1180} width={1080} height={40} fill="#C97E3E" />
      <NubiStandIn x={540} y={1180} s={1.4} frame={frame} />
    </svg>
  </AbsoluteFill>
);

/** TikTok UI zones drawn faintly on top so placement can be checked. */
const SafeZones: React.FC = () => {
  const zone = "rgba(255,40,90,0.14)";
  const edge = "rgba(255,90,120,0.75)";
  const label = (x: number, y: number, text: string, anchor: "start" | "middle" | "end" = "start") => (
    <text x={x} y={y} textAnchor={anchor} fontFamily={FONT.heavy} fontWeight={800} fontSize={26} fill="rgba(20,20,40,0.75)">
      {text}
    </text>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <rect x={0} y={0} width={1080} height={200} fill={zone} />
        <path d="M0 200 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {label(24, 180, "TIKTOK: BARRA SUPERIOR (y < 200)")}
        <rect x={940} y={700} width={140} height={700} fill={zone} />
        <path d="M940 700 V1400 M940 700 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {[800, 940, 1080, 1220, 1340].map((cy) => (
          <circle key={cy} cx={1012} cy={cy} r={42} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={4} />
        ))}
        <rect x={0} y={1400} width={1080} height={520} fill={zone} />
        <path d="M0 1400 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {label(24, 1446, "TIKTOK: DESCRIPCIÓN (y > 1400)")}
        <rect x={0} y={1210} width={1080} height={190} fill="rgba(0,0,0,0.12)" stroke="rgba(255,255,255,0.7)" strokeWidth={3} strokeDasharray="16 12" />
        {label(540, 1316, "CAPTIONS (y 1210-1400)", "middle")}
        <rect x={60} y={230} width={880} height={950} fill="none" stroke="rgba(40,200,80,0.7)" strokeWidth={3} strokeDasharray="6 10" />
      </svg>
    </AbsoluteFill>
  );
};

export const IaUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = IA_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? IA_UI_SEGMENTS[IA_UI_SEGMENTS.length - 1];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop frame={frame} />

      {/* GANCHO: her phone, his request to the AI, the switch, the question. */}
      <LoveMessage frame={frame} at={2} out={40} />
      <AIChat frame={frame} at={52} out={128} prompt="Dile que la extraño, pero sin parecer intenso" typeFrom={56} typeTo={88} sendAt={92} replyAt={100} />
      <IaSwitchBadge frame={frame} at={142} out={188} to="off" />
      <TitleSticker frame={frame} at={202} out={266} />

      {/* MENSAJE: split screen. */}
      <SplitLabels frame={frame} at={282} out={508} sentAt={340} siAt={420} />

      {/* TAREA: the clock, the missing AI, four words, midnight. */}
      <DeadlineClock frame={frame} at={522} out={716} midnightAt={690} />
      <AIErrorPage frame={frame} at={530} out={606} />
      <TypedDoc frame={frame} at={616} out={688} />

      {/* JEFE: forty empty slides, the coffee montage. */}
      <SlidesCounter frame={frame} at={732} out={816} />
      <MontageLabel frame={frame} at={832} out={848} text="CAFÉ #1" />
      <MontageLabel frame={frame} at={852} out={868} text="CAFÉ #7" />
      <MontageLabel frame={frame} at={872} out={892} text="6:00 A. M. ☀️" />

      {/* FOTO: the luxury post, rewind. */}
      <SocialPost frame={frame} at={902} out={972} />
      <RewindFX frame={frame} at={974} out={1004} />

      {/* GIRO: his own message, the switch back on, «¿Qué almuerzo?». */}
      <MessageCallback frame={frame} at={1012} out={1100} sentAt={1046} replyAt={1068} />
      <IaSwitchBadge frame={frame} at={1112} out={1158} to="on" />
      <AIChat
        frame={frame}
        at={1172}
        out={1240}
        prompt="¿Qué almuerzo?"
        typeFrom={1176}
        typeTo={1190}
        sendAt={1194}
        replyAt={1204}
        reply="Analizando tus opciones de almuerzo…"
        replyCps={1.6}
      />

      {/* FINAL: the three options, the end card. */}
      <OptionCards frame={frame} tareaAt={1254} trabajoAt={1270} mensajeAt={1290} wiggleAt={1320} out={1356} />
      <EndCard frame={frame} at={1372} />

      <SafeZones />
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
          padding: "8px 16px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.6)",
          color: "#FFFFFF",
          fontFamily: FONT.heavy,
          fontWeight: 800,
          fontSize: 28,
        }}
      >
        {seg.name} · f{frame}
      </div>
    </AbsoluteFill>
  );
};
