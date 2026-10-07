import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT } from "../theme";
import { TruthTag } from "../overlay/mentiras/TruthTag";
import { ChatBubble, ClockStamp, EndCard, OptionCards, TitleSticker } from "../overlay/mentiras/MentirasUI";

// Review sheet (1080 x 1920) for the 2D overlays of "¿Y si tus mentiras salieran sobre tu cabeza?":
// every component and every TruthTag variant plays once, in story order, over a sunny-room stand-in
// (cube characters: Nubi green, the friend blue, the boss grey) so contrast and scale can be judged.
// The TikTok unsafe zones are tinted red, the caption band is dashed, the safe area (x 60-940,
// y 230-1180) is outlined in green.
//
// Key frames (render with scripts/stills.mjs, COMP=MentirasUISheet):
//   0      TitleSticker complete on frame 0 (at = -4): the cover frame
//   32     slam: falling (speed lines)            35-37  impact (squash, flash ring, sparks)
//   60     «ACABA DE DESPERTAR» settled at scale 1.15 (max), title still up
//   86     TitleSticker popping away              99     tag popping away (out 96)
//   112-116 rise: ripping up out of the cap (clip at the anchor, light burst, shreds)
//   126-129 «DE GATITOS» appends (card grows)    139-142 «POR 3 HORAS» appends
//   165    rise tag complete (3 lines)            193-200 pop away
//   212    «TIENE S/800» at scale 0.85            221-224 «QUIERE COMPRAR ZAPATILLAS» appends
//   253    strike-through over S/800              256-261 flip to «TIENE S/700» (bounce)   275 settled
//   310    ChatBubble (bubble popping)            320 ChatBubble settled (ticks blue)       328 leaving
//   340    «LA COPIÓ Y PEGÓ» landed, scale 0.8    345-352 «A 7 PERSONAS» appends
//   410    ClockStamp landing (shock ring)        425 ClockStamp settled (18:00)
//   470    «TRAJO 68 DIAPOSITIVAS / Y PREGUNTAS AL FINAL» at scale 0.7 (min)
//   515-530 loading tag (bouncing dots); 512-513, 524, 536-537 hologram flickers
//   538-544 gives up: dots drop, greys out, eye closes   546 «SIN DATOS» + «?»
//   552-560 droops and shrinks away (gone at 560)
//   590    OptionCards: card 1 popping            615 all three cards
//   632-640 «LA DIJO ESTA MAÑANA» slams (cards still up); 634-650 card 3 guilty wobble + sweat
//   658    cards leave                            664-668 swat: impact star, flies off right
//   672-684 EndCard lands                          700 EndCard settled (to the end)
export const MENTIRAS_UI_SHEET_DURATION = 720;

export const MENTIRAS_UI_SEGMENTS = [
  { name: "GANCHO: TitleSticker + slam", from: 0, to: 100 },
  { name: "ESCAPE: rise (gorra) + 2 detalles", from: 100, to: 200 },
  { name: "DEUDA: detalle + then (S/800 → S/700)", from: 200, to: 300 },
  { name: "CITA: ChatBubble + tag", from: 300, to: 400 },
  { name: "JEFE: ClockStamp + tag (escala 0.7)", from: 400, to: 500 },
  { name: "GIRO: loading → SIN DATOS", from: 500, to: 580 },
  { name: "FINAL: OptionCards + swat + EndCard", from: 580, to: 720 },
];

/** A cube character stand-in (head top at y - 260·s). `cap` adds a baseball cap. */
const Cube: React.FC<{ x: number; y: number; s?: number; color?: string; dark?: string; frame: number; cap?: boolean; tie?: boolean }> = ({
  x,
  y,
  s = 1,
  color = "#6FD67C",
  dark = "#1F4D2C",
  frame,
  cap = false,
  tie = false,
}) => (
  <g transform={`translate(${x} ${y + Math.sin(frame * 0.1) * 3}) scale(${s})`}>
    <ellipse cx={0} cy={4} rx={150} ry={22} fill="rgba(0,0,0,0.16)" />
    <rect x={-130} y={-260} width={260} height={250} rx={46} fill={color} stroke={dark} strokeWidth={7} />
    <rect x={-110} y={-246} width={150} height={26} rx={13} fill="#FFFFFF" opacity={0.28} />
    <rect x={-60} y={-160} width={32} height={44} rx={6} fill="#151515" />
    <rect x={28} y={-160} width={32} height={44} rx={6} fill="#151515" />
    {tie ? <path d="M-14 -70 L14 -70 L22 -10 L0 8 L-22 -10 Z" fill="#E0344A" stroke={dark} strokeWidth={5} strokeLinejoin="round" /> : null}
    {cap ? (
      <g>
        <path d="M-126 -232 C-120 -330 120 -330 126 -232 Z" fill="#2E48D0" stroke="#1A1233" strokeWidth={7} strokeLinejoin="round" />
        <path d="M-126 -236 L-196 -214 L-182 -198 L-120 -214 Z" fill="#24396C" stroke="#1A1233" strokeWidth={6} strokeLinejoin="round" />
        <circle cx={0} cy={-312} r={9} fill="#24396C" stroke="#1A1233" strokeWidth={4} />
      </g>
    ) : null}
  </g>
);

/** A sunny room: wall, window with sky, floor. */
const Room: React.FC = () => (
  <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    <defs>
      <linearGradient id="msWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8EC6E8" />
        <stop offset="0.6" stopColor="#B7E2D6" />
        <stop offset="1" stopColor="#CDEBCB" />
      </linearGradient>
      <linearGradient id="msFloor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#E7B98A" />
        <stop offset="1" stopColor="#C98F5C" />
      </linearGradient>
    </defs>
    <rect x={0} y={0} width={1080} height={1920} fill="url(#msWall)" />
    <rect x={640} y={430} width={330} height={420} rx={18} fill="#DDF3FF" stroke="#FFFFFF" strokeWidth={16} />
    <path d="M805 430 V850 M640 640 H970" stroke="#FFFFFF" strokeWidth={12} />
    <circle cx={900} cy={510} r={40} fill="#FFE27A" opacity={0.9} />
    <rect x={0} y={1190} width={1080} height={730} fill="url(#msFloor)" />
    <rect x={0} y={1190} width={1080} height={18} fill="#F3D0A6" />
    <rect x={70} y={980} width={170} height={210} rx={14} fill="#F08A6A" stroke="#B9583E" strokeWidth={6} />
    <rect x={92} y={1010} width={126} height={60} rx={8} fill="#F8B49C" />
  </svg>
);

const SafeZones: React.FC = () => {
  const zone = "rgba(255,40,90,0.13)";
  const edge = "rgba(255,120,150,0.7)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <rect x={0} y={0} width={1080} height={200} fill={zone} />
        <path d="M0 200 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        <rect x={940} y={700} width={140} height={700} fill={zone} />
        <path d="M940 700 V1400 M940 700 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {[800, 940, 1080, 1220, 1340].map((cy) => (
          <circle key={cy} cx={1012} cy={cy} r={42} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={4} />
        ))}
        <rect x={0} y={1400} width={1080} height={520} fill={zone} />
        <path d="M0 1400 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        <rect x={0} y={1210} width={1080} height={190} fill="rgba(0,0,0,0.12)" stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeDasharray="16 12" />
        <text x={540} y={1316} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={800} fontSize={26} fill="rgba(255,255,255,0.8)">
          CAPTIONS (y 1210-1400)
        </text>
        <rect x={60} y={230} width={880} height={950} fill="none" stroke="rgba(120,255,140,0.6)" strokeWidth={3} strokeDasharray="6 10" />
      </svg>
    </AbsoluteFill>
  );
};

export const MentirasUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = MENTIRAS_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? MENTIRAS_UI_SEGMENTS[MENTIRAS_UI_SEGMENTS.length - 1];
  const inSeg = (from: number, to: number) => frame >= from && frame < to;
  // Characters per segment (head top = anchor of the tags).
  const cast = inSeg(0, 100) ? (
    <Cube x={540} y={1200} s={1.05} frame={frame} />
  ) : inSeg(100, 200) ? (
    <Cube x={540} y={1200} frame={frame} cap />
  ) : inSeg(200, 300) ? (
    <>
      <Cube x={330} y={1210} s={0.85} frame={frame} />
      <Cube x={640} y={1200} color="#7DB2FF" dark="#22427A" frame={frame} />
    </>
  ) : inSeg(300, 400) ? (
    <>
      <Cube x={360} y={1200} frame={frame} />
      <Cube x={780} y={1220} s={0.8} color="#FF9BC2" dark="#8A2A52" frame={frame} />
    </>
  ) : inSeg(400, 500) ? (
    <Cube x={540} y={1200} s={1.1} color="#B8BFCC" dark="#3E4556" frame={frame} tie />
  ) : (
    <Cube x={540} y={1240} frame={frame} />
  );
  return (
    <AbsoluteFill style={{ background: "#9FD3F0" }}>
      <Room />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {cast}
      </svg>

      {/* GANCHO */}
      <TitleSticker frame={frame} at={-4} out={84} />
      {inSeg(0, 100) ? <TruthTag frame={frame} at={30} out={96} lines={[{ text: "ACABA DE DESPERTAR" }]} x={540} y={925} scale={1.15} /> : null}

      {/* ESCAPE: rips up through the cap (anchor = cap top) */}
      {inSeg(100, 200) ? (
        <TruthTag
          frame={frame}
          at={110}
          out={192}
          entrance="rise"
          lines={[{ text: "SE QUEDÓ VIENDO VIDEOS" }, { text: "DE GATITOS", at: 124 }, { text: "POR 3 HORAS", at: 137 }]}
          x={540}
          y={895}
        />
      ) : null}

      {/* DEUDA: over the friend, S/800 -> S/700 */}
      {inSeg(200, 300) ? (
        <TruthTag
          frame={frame}
          at={205}
          out={292}
          lines={[{ text: "TIENE S/800", then: { text: "TIENE S/700", at: 250 } }, { text: "QUIERE COMPRAR ZAPATILLAS", at: 219 }]}
          x={640}
          y={950}
          scale={0.85}
        />
      ) : null}

      {/* CITA */}
      <ChatBubble frame={frame} at={304} out={326} x={640} y={560} />
      {inSeg(300, 400) ? (
        <TruthTag frame={frame} at={330} out={394} lines={[{ text: "LA COPIÓ Y PEGÓ" }, { text: "A 7 PERSONAS", at: 344 }]} x={360} y={950} scale={0.8} />
      ) : null}

      {/* JEFE */}
      <ClockStamp frame={frame} at={404} out={446} />
      {inSeg(400, 500) ? (
        <TruthTag frame={frame} at={440} out={494} lines={[{ text: "TRAJO 68 DIAPOSITIVAS" }, { text: "Y PREGUNTAS AL FINAL", at: 456 }]} x={540} y={920} scale={0.7} />
      ) : null}

      {/* GIRO */}
      {inSeg(500, 580) ? <TruthTag frame={frame} at={505} out={538} loading x={540} y={990} /> : null}

      {/* FINAL */}
      <OptionCards frame={frame} at1={585} at2={597} at3={609} poke={634} out={658} />
      {inSeg(580, 720) ? <TruthTag frame={frame} at={632} swatAt={664} lines={[{ text: "LA DIJO ESTA MAÑANA" }]} x={540} y={990} /> : null}
      <EndCard frame={frame} at={672} />

      <SafeZones />
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 1440,
          fontFamily: FONT.heavy,
          fontWeight: 900,
          fontSize: 34,
          color: "#FFFFFF",
          textShadow: "0 3px 0 rgba(0,0,0,0.4)",
        }}
      >
        {seg.name}
        <div style={{ fontSize: 28, fontWeight: 800, opacity: 0.85, marginTop: 8 }}>frame {frame}</div>
      </div>
    </AbsoluteFill>
  );
};
