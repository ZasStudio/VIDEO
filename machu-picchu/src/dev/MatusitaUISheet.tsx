import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT } from "../theme";
import { Disclaimer, EndCard, FilmGrain, GlitchCut, GoalStamp, HorrorTitle, VHSOverlay } from "../overlay/matusita/MatusitaUI";

// Review sheet (1080 x 1920) for the 2D overlays of "La noche que nadie quiso pasar en la Casa
// Matusita": every component plays once, in order, over a dark stand-in backdrop (the house at
// night, a lit second-floor window, a pale moon, Nubi as a green cube with its flashlight) so the
// contrast can be judged; FilmGrain runs all the time on top. The TikTok unsafe zones (top bar,
// right button column, bottom description) are tinted red, the caption band is dashed and the
// safe area (x 60-940, y 230-1180) is outlined in green.

export const MATUSITA_UI_SEGMENTS = [
  { name: "HorrorTitle", from: 0, to: 110 },
  { name: "GoalStamp", from: 110, to: 230 },
  { name: "Disclaimer", from: 230, to: 300 },
  { name: "VHSOverlay + GlitchCut", from: 300, to: 540 },
  { name: "EndCard", from: 540, to: 600 },
];
export const MATUSITA_UI_SHEET_DURATION = 600;

/** Nubi stand-in: a green rounded cube with two black eyes, side fins and stubby legs (no mouth). */
const NubiStandIn: React.FC<{ x: number; y: number; s?: number; frame: number }> = ({ x, y, s = 1, frame }) => {
  const hop = -Math.abs(Math.sin(frame * 0.08)) * 4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={130} ry={20} fill="rgba(0,0,0,0.45)" />
      <g transform={`translate(0 ${hop})`}>
        {[-78, -40, 0, 40, 78].map((lx) => (
          <rect key={lx} x={lx - 16} y={-40} width={32} height={44} rx={12} fill="#3E9A4C" stroke="#123F1E" strokeWidth={6} />
        ))}
        <path d="M-118 -120 L-162 -84 L-116 -70 Z" fill="#4BAF5A" stroke="#123F1E" strokeWidth={6} strokeLinejoin="round" />
        <path d="M118 -120 L162 -84 L116 -70 Z" fill="#4BAF5A" stroke="#123F1E" strokeWidth={6} strokeLinejoin="round" />
        <rect x={-120} y={-210} width={240} height={180} rx={50} fill="#5CC46A" stroke="#123F1E" strokeWidth={7} />
        <rect x={-120} y={-210} width={240} height={180} rx={50} fill="url(#nubiShade)" />
        <ellipse cx={-44} cy={-118} rx={15} ry={22} fill="#151515" />
        <ellipse cx={44} cy={-118} rx={15} ry={22} fill="#151515" />
        <circle cx={-39} cy={-127} r={5} fill="#FFFFFF" />
        <circle cx={49} cy={-127} r={5} fill="#FFFFFF" />
        <rect x={-30} y={-62} width={60} height={26} rx={8} fill="#2A2A2E" stroke="#0B0B0C" strokeWidth={4} />
        <circle cx={22} cy={-49} r={9} fill="#FFF3B0" />
      </g>
    </g>
  );
};

/** Dark stand-in for the 3D world: the house at night, a lit window, a moon, Nubi with a flashlight. */
const Backdrop: React.FC<{ frame: number; nubi: { x: number; y: number; s: number } }> = ({ frame, nubi }) => {
  const thunder = frame % 150 < 3 ? 0.25 : 0;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #05070B 0%, #0D121A 38%, #161C26 56%, #0C0E12 70%, #07080A 100%)" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="moon" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="rgba(220,226,206,0.75)" />
            <stop offset="0.25" stopColor="rgba(190,200,180,0.28)" />
            <stop offset="1" stopColor="rgba(190,200,180,0)" />
          </radialGradient>
          <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="rgba(255,240,180,0.28)" />
            <stop offset="1" stopColor="rgba(255,240,180,0)" />
          </linearGradient>
          <linearGradient id="nubiShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(0,0,0,0.45)" />
            <stop offset="0.6" stopColor="rgba(0,0,0,0.1)" />
            <stop offset="1" stopColor="rgba(255,240,180,0.18)" />
          </linearGradient>
        </defs>
        <circle cx={800} cy={400} r={260} fill="url(#moon)" />
        <circle cx={800} cy={400} r={46} fill="rgba(232,236,220,0.9)" />
        {/* The house: two storeys, a balcony, tall windows. */}
        <rect x={110} y={560} width={860} height={760} fill="#141920" />
        <rect x={90} y={540} width={900} height={30} fill="#1B212A" />
        <rect x={110} y={900} width={860} height={22} fill="#1B212A" />
        {[180, 400, 620, 820].map((wx, i) => (
          <g key={wx}>
            <rect x={wx} y={630} width={100} height={200} rx={6} fill={i === 2 ? "rgba(196,200,120,0.55)" : "#0A0D12"} stroke="#252C37" strokeWidth={8} />
            <rect x={wx} y={990} width={100} height={200} rx={6} fill="#0A0D12" stroke="#252C37" strokeWidth={8} />
          </g>
        ))}
        <rect x={470} y={1010} width={140} height={310} fill="#0B0E13" stroke="#252C37" strokeWidth={8} />
        <rect x={0} y={1320} width={1080} height={600} fill="#08090B" />
        <path d={`M${nubi.x + 20 * nubi.s} ${nubi.y - 50 * nubi.s} L${nubi.x - 380} ${nubi.y - 980} L${nubi.x + 160} ${nubi.y - 1000} Z`} fill="url(#beam)" />
        <NubiStandIn x={nubi.x} y={nubi.y} s={nubi.s} frame={frame} />
      </svg>
      {thunder > 0 ? <AbsoluteFill style={{ background: "#DDE6FF", opacity: thunder }} /> : null}
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
        <rect x={940} y={700} width={140} height={700} fill={zone} />
        <path d="M940 700 V1400 M940 700 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {[800, 940, 1080, 1220, 1340].map((cy) => (
          <circle key={cy} cx={1012} cy={cy} r={42} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={4} />
        ))}
        <rect x={0} y={1400} width={1080} height={520} fill={zone} />
        <path d="M0 1400 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {label(24, 1446, "TIKTOK: DESCRIPCIÓN (y > 1400)")}
        <rect x={0} y={1210} width={1080} height={190} fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeDasharray="16 12" />
        {label(540, 1316, "CAPTIONS (y 1210-1400)", "middle")}
        <rect x={60} y={230} width={880} height={950} fill="none" stroke="rgba(120,255,140,0.6)" strokeWidth={3} strokeDasharray="6 10" />
      </svg>
    </AbsoluteFill>
  );
};

export const MatusitaUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = MATUSITA_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? MATUSITA_UI_SEGMENTS[MATUSITA_UI_SEGMENTS.length - 1];
  // Close-up in the opening (eyes ~y 880, like GANCHO), full figure afterwards.
  const nubi = frame < 230 ? { x: 500, y: 1080, s: 1.6 } : { x: 500, y: 1250, s: 0.9 };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop frame={frame} nubi={nubi} />

      {/* 1. The title (GANCHO). */}
      <HorrorTitle frame={frame} at={4} out={96} />

      {/* 2. The challenge vs. the legend. */}
      <GoalStamp frame={frame} goalAt={114} realAt={160} out={214} x={500} y={1060} />

      {/* 3. The disclaimer (LUGAR). */}
      <Disclaimer frame={frame} at={234} out={290} />

      {/* 4. The camcorder footage (RETO → SUSTO), the tape skip and the cut to black. */}
      <VHSOverlay frame={frame} from={300} to={540} jumpAt={420} />
      <GlitchCut frame={frame} at={532} dur={8} />

      {/* 5. The end card. */}
      <EndCard frame={frame} at={541} />

      <FilmGrain frame={frame} />

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
