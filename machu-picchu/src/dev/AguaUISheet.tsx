import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { rand } from "../anim";
import { FONT } from "../theme";
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

// Review sheet (1080 x 1920) for the 2D overlays of "¿Y si toda el agua desapareciera?": every
// component plays once, in order, over a stand-in backdrop (a sunny lake with Nubi as a mint
// cube; a dry desert and a bedroom around the dream cut). The TikTok unsafe zones (top bar,
// right button column, bottom description) are tinted red on top, the caption band is dashed
// and the safe area (x 60-940, y 230-1180) is outlined in green.

export const AGUA_UI_SEGMENTS = [
  { name: "CommentReply", from: 0, to: 90 },
  { name: "WaterMeter", from: 90, to: 250 },
  { name: "FreezeLabel", from: 250, to: 340 },
  { name: "RewindCard", from: 340, to: 450 },
  { name: "FactChip ×3", from: 450, to: 640 },
  { name: "PriceTag gold", from: 640, to: 760 },
  { name: "PriceTag cheap", from: 760, to: 880 },
  { name: "PortraitSketch", from: 880, to: 1040 },
  { name: "DreamRipple", from: 1040, to: 1110 },
  { name: "ShareOrSurvive", from: 1110, to: 1330 },
];
export const AGUA_UI_SHEET_DURATION = 1330;

const DREAM_AT = 1075;

/** Nubi stand-in: a mint rounded cube with two black eyes, side fins and stubby legs (no mouth). */
const NubiStandIn: React.FC<{ x: number; y: number; s?: number; frame: number }> = ({ x, y, s = 1, frame }) => {
  const hop = -Math.abs(Math.sin(frame * 0.12)) * 8;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={130} ry={20} fill="rgba(0,0,0,0.3)" />
      <g transform={`translate(0 ${hop})`}>
        {[-78, -40, 0, 40, 78].map((lx) => (
          <rect key={lx} x={lx - 16} y={-40} width={32} height={44} rx={12} fill="#6FC488" stroke="#2C7A64" strokeWidth={6} />
        ))}
        <path d="M-118 -120 L-162 -84 L-116 -70 Z" fill="#7FD49A" stroke="#2C7A64" strokeWidth={6} strokeLinejoin="round" />
        <path d="M118 -120 L162 -84 L116 -70 Z" fill="#7FD49A" stroke="#2C7A64" strokeWidth={6} strokeLinejoin="round" />
        <rect x={-120} y={-210} width={240} height={180} rx={50} fill="#8EDCA2" stroke="#2C7A64" strokeWidth={7} />
        <rect x={-100} y={-196} width={200} height={30} rx={15} fill="#FFFFFF" opacity={0.25} />
        <ellipse cx={-44} cy={-118} rx={15} ry={22} fill="#151515" />
        <ellipse cx={44} cy={-118} rx={15} ry={22} fill="#151515" />
        <circle cx={-39} cy={-127} r={5} fill="#FFFFFF" />
        <circle cx={49} cy={-127} r={5} fill="#FFFFFF" />
      </g>
    </g>
  );
};

/** Stand-in for the 3D world: a sunny lake ("day"), a dry cracked desert ("dry") or a bedroom ("room"). */
const Backdrop: React.FC<{ frame: number; variant: "day" | "dry" | "room" }> = ({ frame, variant }) => {
  if (variant === "room") {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #BFE3F2 0%, #9FD0E8 62%, #C99B6A 62%, #A87A4E 100%)" }}>
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <rect x={620} y={300} width={300} height={360} rx={16} fill="#FFF6D8" stroke="#6B4A2E" strokeWidth={14} />
          <path d="M770 300 V660 M620 480 H920" stroke="#6B4A2E" strokeWidth={10} />
          <rect x={90} y={1020} width={760} height={200} rx={30} fill="#5C7FD6" stroke="#2D3E73" strokeWidth={10} />
          <rect x={70} y={900} width={90} height={330} rx={20} fill="#8A5A36" stroke="#4A2E1A" strokeWidth={10} />
          <rect x={150} y={990} width={190} height={80} rx={34} fill="#FFFFFF" stroke="#9AA4B8" strokeWidth={8} />
          <path d="M330 1030 C480 980 700 1000 850 1030 L850 1120 L330 1120 Z" fill="#7FA8FF" stroke="#2D3E73" strokeWidth={8} />
        </svg>
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <NubiStandIn x={540} y={1160} s={0.9} frame={frame} />
        </svg>
      </AbsoluteFill>
    );
  }
  const dry = variant === "dry";
  const cracks: React.ReactNode[] = [];
  if (dry) {
    for (let i = 0; i < 26; i++) {
      const cx = rand(i * 3.1) * 1080;
      const cy = 1260 + rand(i * 5.3) * 640;
      cracks.push(
        <path
          key={i}
          d={`M${cx} ${cy} l${30 + rand(i) * 40} ${10 - rand(i * 2) * 20} l${20 + rand(i * 7) * 30} ${20 + rand(i * 9) * 20} m-${30 + rand(i * 4) * 20} -${10 + rand(i * 6) * 10} l-10 30`}
          stroke="#7A4B2A"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />,
      );
    }
  }
  return (
    <AbsoluteFill
      style={{
        background: dry
          ? "linear-gradient(180deg, #FF9A3D 0%, #FFC46B 45%, #FFE2A8 64%, #D9A066 64%, #C4864A 100%)"
          : "linear-gradient(180deg, #2F86E8 0%, #6BBDF5 38%, #CDEBFF 62%, #8FD07A 62%, #5DB84A 100%)",
      }}
    >
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(200 560) rotate(${frame * 0.4})`}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={-8} y={-190} width={16} height={60} rx={8} fill={dry ? "#FFF2B0" : "#FFE27A"} transform={`rotate(${i * 30})`} opacity={0.8} />
          ))}
        </g>
        <circle cx={200} cy={560} r={dry ? 120 : 96} fill={dry ? "#FFF6C9" : "#FFD84A"} />
        <path d="M0 1200 C180 1120 300 1150 420 1100 C560 1040 700 1120 860 1080 C960 1056 1030 1080 1080 1070 L1080 1200 Z" fill={dry ? "#C77B3E" : "#4FA54A"} />
        {!dry ? (
          <>
            <path d="M0 1270 C260 1240 520 1290 800 1250 C920 1234 1010 1250 1080 1245 L1080 1420 L0 1420 Z" fill="#2F9BEA" />
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={i}
                d={`M${(i * 150 + frame * 2) % 1180 - 60} ${1300 + (i % 3) * 36} q20 -10 40 0 q20 10 40 0`}
                stroke="#BDEBFF"
                strokeWidth={6}
                fill="none"
                strokeLinecap="round"
              />
            ))}
          </>
        ) : (
          cracks
        )}
        <NubiStandIn x={540} y={1160} s={1} frame={frame} />
      </svg>
    </AbsoluteFill>
  );
};

/** TikTok UI zones drawn faintly on top so placement can be checked. */
const SafeZones: React.FC = () => {
  const zone = "rgba(255,40,90,0.16)";
  const edge = "rgba(255,120,150,0.75)";
  const label = (x: number, y: number, text: string, anchor: "start" | "middle" | "end" = "start") => (
    <text x={x} y={y} textAnchor={anchor} fontFamily={FONT.heavy} fontWeight={800} fontSize={26} fill="rgba(255,255,255,0.8)">
      {text}
    </text>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <rect x={0} y={0} width={1080} height={200} fill={zone} />
        <path d="M0 200 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {label(24, 180, "TIKTOK: BARRA SUPERIOR (y < 200)")}
        <rect x={940} y={640} width={140} height={760} fill={zone} />
        <path d="M940 640 V1400 M940 640 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {[760, 900, 1040, 1180, 1320].map((cy) => (
          <circle key={cy} cx={1012} cy={cy} r={42} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={4} />
        ))}
        <rect x={0} y={1400} width={1080} height={520} fill={zone} />
        <path d="M0 1400 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {label(24, 1446, "TIKTOK: DESCRIPCIÓN (y > 1400)")}
        <rect x={0} y={1210} width={1080} height={190} fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeDasharray="16 12" />
        {label(540, 1316, "CAPTIONS (y 1210-1400)", "middle")}
        <rect x={60} y={230} width={880} height={950} fill="none" stroke="rgba(120,255,140,0.6)" strokeWidth={3} strokeDasharray="6 10" />
        {label(66, 258, "ZONA SEGURA x 60-940, y 230-1180")}
      </svg>
    </AbsoluteFill>
  );
};

export const AguaUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = AGUA_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? AGUA_UI_SEGMENTS[AGUA_UI_SEGMENTS.length - 1];
  const variant = frame >= 1040 && frame < DREAM_AT ? "dry" : frame >= DREAM_AT && frame < 1110 ? "room" : "day";
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop frame={frame} variant={variant} />

      {/* 1. The viewer's comment (top-left sticker). */}
      <CommentReply frame={frame} at={4} out={80} x={300} y={330} />

      {/* 2. Water on the planet drains to 0 % (top-right). */}
      <WaterMeter frame={frame} from={104} to={200} x={770} y={330} />

      {/* 3. Freeze-frame meme pointing at Nubi. */}
      <FreezeLabel frame={frame} at={254} out={330} x={540} y={930} />

      {/* 4. VHS rewind, then the PLAY tag. */}
      <RewindCard frame={frame} at={344} out={440} />

      {/* 5. Facts. */}
      <FactChip frame={frame} at={454} out={540} x={500} y={420} icon="drop" text="Solo el *3%* del agua del planeta es dulce" />
      <FactChip frame={frame} at={470} out={540} x={500} y={660} icon="plant" text="El *70%* del agua dulce se usa para cultivar comida" />
      <FactChip frame={frame} at={548} out={630} x={500} y={520} icon="clock" label="DATO REAL" text="Sin agua, una persona resiste solo *3 días*" />

      {/* 6. Price tags. */}
      <PriceTag frame={frame} at={644} out={748} x={500} y={660} price="S/ 10 000 000" caption="LA ÚLTIMA" tone="gold" />
      <PriceTag frame={frame} at={764} out={868} x={500} y={660} price="S/ 3 + 1 RETRATO" tone="cheap" />

      {/* 7. The portrait of the seller. */}
      <PortraitSketch frame={frame} at={884} drawTo={974} out={1028} x={500} y={690} />

      {/* 8. It was a dream (the backdrop cuts from desert to bedroom at the peak). */}
      <DreamRipple frame={frame} at={DREAM_AT} dur={40} />

      {/* 9. Closing question. */}
      <ShareOrSurvive frame={frame} at={1114} />

      <SafeZones />
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 40,
          padding: "8px 16px",
          borderRadius: 12,
          background: "rgba(0,0,0,0.6)",
          fontFamily: FONT.heavy,
          fontWeight: 800,
          fontSize: 26,
          color: "#fff",
        }}
      >
        {`${seg.name} · f${frame}`}
      </div>
    </AbsoluteFill>
  );
};
