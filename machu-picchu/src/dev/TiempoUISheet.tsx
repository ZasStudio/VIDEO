import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT } from "../theme";
import { DAY, HOUR, LifeEvent, MIN, MONTH, YEAR } from "../tiempo/clock";
import {
  CommentCard,
  CountdownPulse,
  CrashGlitch,
  EndCard,
  ExtractionScreen,
  LifeCounter,
  PriceSticker,
  RuleSign,
  ScanStamp,
  TimecoNotification,
  TitleSticker,
} from "../overlay/tiempo/TiempoUI";

// Review sheet (1080 x 1920) for the 2D overlays of "¿Qué pasaría si el dinero fuera tiempo de
// vida?": every component plays once, in order, over a neutral stand-in backdrop (a dusky
// street with Nubi as a green cube). The TikTok unsafe zones (top bar, right button column,
// bottom description) are tinted red on top, the caption band is dashed and the safe area
// (x 60-940, y 230-1180) is outlined in green.

export const TIEMPO_UI_SEGMENTS = [
  { name: "TitleSticker", from: 0, to: 100 },
  { name: "PriceSticker ×5", from: 100, to: 300 },
  { name: "RuleSign", from: 300, to: 400 },
  { name: "LifeCounter (states)", from: 400, to: 600 },
  { name: "TimecoNotification", from: 600, to: 730 },
  { name: "ExtractionScreen", from: 730, to: 900 },
  { name: "ScanStamp", from: 900, to: 1000 },
  { name: "CrashGlitch + CountdownPulse", from: 1000, to: 1160 },
  { name: "CommentCard", from: 1160, to: 1400 },
  { name: "EndCard", from: 1400, to: 1515 },
];
export const TIEMPO_UI_SHEET_DURATION = 1515;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const step = (g: number, at: number, dur: number) => {
  const t = clamp01((g - at) / dur);
  return t * t * (3 - 2 * t);
};

/** Nubi stand-in: a green rounded cube with two black eyes, side fins and stubby legs (no mouth). */
const NubiStandIn: React.FC<{ x: number; y: number; s?: number; frame: number }> = ({ x, y, s = 1, frame }) => {
  const hop = -Math.abs(Math.sin(frame * 0.12)) * 6;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={130} ry={20} fill="rgba(0,0,0,0.3)" />
      <g transform={`translate(0 ${hop})`}>
        {[-78, -40, 0, 40, 78].map((lx) => (
          <rect key={lx} x={lx - 16} y={-40} width={32} height={44} rx={12} fill="#4FB85E" stroke="#1F6B33" strokeWidth={6} />
        ))}
        <path d="M-118 -120 L-162 -84 L-116 -70 Z" fill="#5CCB6B" stroke="#1F6B33" strokeWidth={6} strokeLinejoin="round" />
        <path d="M118 -120 L162 -84 L116 -70 Z" fill="#5CCB6B" stroke="#1F6B33" strokeWidth={6} strokeLinejoin="round" />
        <rect x={-120} y={-210} width={240} height={180} rx={50} fill="#6FD67C" stroke="#1F6B33" strokeWidth={7} />
        <rect x={-100} y={-196} width={200} height={30} rx={15} fill="#FFFFFF" opacity={0.25} />
        <ellipse cx={-44} cy={-118} rx={15} ry={22} fill="#151515" />
        <ellipse cx={44} cy={-118} rx={15} ry={22} fill="#151515" />
        <circle cx={-39} cy={-127} r={5} fill="#FFFFFF" />
        <circle cx={49} cy={-127} r={5} fill="#FFFFFF" />
      </g>
    </g>
  );
};

/** Neutral stand-in for the 3D world: a dusky street with buildings, Nubi in the middle. */
const Backdrop: React.FC<{ frame: number; nubiY: number }> = ({ frame, nubiY }) => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #2A3F6B 0%, #5B6F9A 40%, #A9A2B8 62%, #6E6A78 62%, #4B4856 100%)" }}>
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {[
        [0, 640, 220, 560],
        [210, 520, 200, 680],
        [420, 700, 180, 500],
        [610, 460, 240, 740],
        [860, 600, 220, 600],
      ].map(([bx, by, bw, bh], i) => (
        <g key={i}>
          <rect x={bx} y={by} width={bw} height={bh} fill={i % 2 ? "#3E4A6E" : "#46537A"} />
          {Array.from({ length: Math.floor(bh / 90) * 3 }, (_, j) => (
            <rect
              key={j}
              x={bx + 24 + (j % 3) * ((bw - 48) / 3)}
              y={by + 30 + Math.floor(j / 3) * 90}
              width={(bw - 48) / 3 - 18}
              height={44}
              rx={6}
              fill={(i * 7 + j * 3) % 5 === 0 ? "#FFD98A" : "#5E6B92"}
              opacity={0.85}
            />
          ))}
        </g>
      ))}
      <rect x={0} y={1190} width={1080} height={730} fill="#5A5664" />
      <path d="M0 1190 H1080" stroke="#8A8494" strokeWidth={8} />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={((i * 200 + frame * 0) % 1200) - 60} y={1500} width={110} height={18} rx={9} fill="#E8E2D0" opacity={0.6} />
      ))}
      <NubiStandIn x={500} y={nubiY} s={0.85} frame={frame} />
    </svg>
  </AbsoluteFill>
);

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
        {label(66, 258, "ZONA SEGURA x 60-940, y 230-1180")}
      </svg>
    </AbsoluteFill>
  );
};

// LifeCounter showcase (segment 400-600).
const LC0 = 400;
const NUBI_LC_EVENTS: LifeEvent[] = [{ at: 440, text: "−6 HORAS", tone: "loss" }];
const LADY_LC_EVENTS: LifeEvent[] = [{ at: 520, text: "+1 AÑO", tone: "gift" }];
const RICH_LC_EVENTS: LifeEvent[] = [{ at: 480, text: "−5 AÑOS", tone: "tiny" }];
const COWORKER_LC_EVENTS: LifeEvent[] = [{ at: 500, text: "+00:03:00", tone: "tiny" }];
// Crash segment (1000-1160).
const CRASH = 1010;
const CRASH_EVENTS: LifeEvent[] = [{ at: CRASH, text: "MULTA", tone: "loss" }];

export const TiempoUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = TIEMPO_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? TIEMPO_UI_SEGMENTS[TIEMPO_UI_SEGMENTS.length - 1];
  const f = frame;
  const inLc = f >= LC0 && f < 600;
  const inCrash = f >= 1000 && f < 1160;
  // Counter values for the showcase.
  const nubi = 32 * YEAR + 4 * MONTH + 12 * DAY + 8 * HOUR + 15 * MIN + 42 - f / 30 - 6 * HOUR * step(f, 440, 10);
  const days = 245 * DAY + 8 * HOUR + 15 * MIN + 42 - (f - LC0) / 30;
  const coworker = 8 * HOUR + 15 * MIN + 12 - (f - LC0) / 30 + 3 * MIN * step(f, 500, 6);
  const lady = Math.max(0, 18 - (f - LC0) / 30) + YEAR * step(f, 520, 20);
  const drain = Math.max(0, 20 * YEAR - (f - LC0) * 0.06 * YEAR);
  const rich = 999 * YEAR + 2 * MONTH - f / 30 - 5 * YEAR * step(f, 480, 10);
  const crashFrom = 8 * YEAR + 8 * MONTH + 19 * DAY;
  const after = Math.max(0, 10 - (f - CRASH) / 30);
  const kk = step(f, CRASH, 8);
  const crashVal = f < CRASH ? crashFrom - (f - 1000) * 0.06 * YEAR : Math.exp(Math.log(crashFrom) + (Math.log(Math.max(after, 0.01)) - Math.log(crashFrom)) * kk);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop frame={frame} nubiY={inLc ? 1250 : 1175} />

      {/* 1. The title. */}
      <TitleSticker frame={frame} at={4} out={88} />

      {/* 2. Prices in time. */}
      <PriceSticker frame={frame} at={104} out={150} x={500} y={560} item="JUGO" price="6 HORAS" />
      <PriceSticker frame={frame} at={156} out={200} x={500} y={560} item="PIZZA" price="3 DÍAS" rotate={3} />
      <PriceSticker frame={frame} at={206} out={290} x={500} y={400} item="CELULAR" price="1 MES" />
      <PriceSticker frame={frame} at={216} out={290} x={500} y={640} item="AUTO" price="5 AÑOS" rotate={2} />
      <PriceSticker frame={frame} at={226} out={290} x={500} y={880} item="CASA" price="40 AÑOS" rotate={-2} />

      {/* 3. The working rule. */}
      <RuleSign frame={frame} at={304} out={390} x={500} y={520} asteriskAt={344} />

      {/* 4. Life counters in every state. */}
      {inLc ? (
        <>
          <LifeCounter frame={frame} seconds={days} x={270} y={420} scale={0.8} appear={LC0 + 2} />
          <LifeCounter frame={frame} seconds={coworker} x={730} y={420} scale={0.8} appear={LC0 + 4} events={COWORKER_LC_EVENTS} />
          <LifeCounter frame={frame} seconds={lady} x={270} y={680} scale={0.8} appear={LC0 + 6} events={LADY_LC_EVENTS} />
          <LifeCounter frame={frame} seconds={drain} x={730} y={680} scale={0.8} appear={LC0 + 8} draining />
          <LifeCounter frame={frame} seconds={12 * YEAR + 3 * MONTH + 4 * DAY + 5 * HOUR + 20 * MIN + 33.4} x={270} y={940} scale={0.8} appear={LC0 + 10} frozen />
          <LifeCounter frame={frame} seconds={rich} x={730} y={940} scale={0.8} appear={LC0 + 12} gold events={RICH_LC_EVENTS} />
          <LifeCounter frame={frame} seconds={nubi} x={500} y={1080} scale={0.9} appear={LC0 + 14} events={NUBI_LC_EVENTS} />
        </>
      ) : null}

      {/* 5. The automatic charge. */}
      <TimecoNotification frame={frame} at={604} thanksAt={650} out={718} />

      {/* 6. The extraction screen. */}
      <ExtractionScreen frame={frame} at={734} out={886} />

      {/* 7. The drone's scan and the stamp. */}
      <ScanStamp frame={frame} at={904} stampAt={926} out={990} x={500} y={1000} />

      {/* 8. The crash to 10 seconds, then the countdown. */}
      {inCrash ? <LifeCounter frame={frame} seconds={crashVal} x={500} y={950} draining={f < CRASH} events={CRASH_EVENTS} /> : null}
      <CountdownPulse frame={frame} from={CRASH} to={1150} />
      <CrashGlitch frame={frame} at={CRASH - 1} dur={10} />

      {/* 9. The call to comment. */}
      <CommentCard frame={frame} at={1164} out={1390} />

      {/* 10. The end card. */}
      <EndCard frame={frame} at={1402} />

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
