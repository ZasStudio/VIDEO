import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { rand } from "../anim";
import { FONT } from "../theme";
import {
  CrossedList,
  FinalQuestion,
  HeroLabel,
  ImpactText,
  NoSignal,
  PizzaApp,
  PostCreditsCard,
  PowerChips,
  SlowMoBars,
  StonesHUD,
  TeamComplete,
  TimeFrozenHUD,
} from "../overlay/thanos/ThanosUI";

// Review sheet (1080 x 1920) for the 2D overlays of "¿Y si Thanos NUNCA chasqueaba los dedos?":
// every component plays once, in order, over a stand-in backdrop (a cosmic battlefield, Nubi
// as a mint cube, a purple giant with a gold glove). The TikTok unsafe zones (top bar, right
// button column, bottom description) are tinted red on top, the caption band is dashed and
// the safe area (x 60-940, y 230-1180) is outlined in green.

export const THANOS_UI_SEGMENTS = [
  { name: "TimeFrozenHUD", from: 0, to: 70 },
  { name: "SlowMoBars", from: 70, to: 170 },
  { name: "ImpactText ×5", from: 170, to: 300 },
  { name: "NoSignal", from: 300, to: 400 },
  { name: "CrossedList", from: 400, to: 530 },
  { name: "TeamComplete", from: 530, to: 650 },
  { name: "PowerChips (column)", from: 650, to: 790 },
  { name: "PowerChips (grid) + HeroLabel", from: 790, to: 900 },
  { name: "StonesHUD", from: 900, to: 1030 },
  { name: "PizzaApp", from: 1030, to: 1200 },
  { name: "PostCreditsCard", from: 1200, to: 1310 },
  { name: "FinalQuestion", from: 1310, to: 1520 },
];
export const THANOS_UI_SHEET_DURATION = 1520;

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

/** Stand-in for the 3D world: dusk sky over a ruined battlefield, a purple giant on the right. */
const Backdrop: React.FC<{ frame: number; glove: boolean; icy: boolean }> = ({ frame, glove, icy }) => {
  const stars = [];
  for (let i = 0; i < 90; i++) {
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.2 + i);
    stars.push(<circle key={i} cx={rand(i * 1.3) * 1080} cy={rand(i * 2.7) * 900} r={1 + rand(i * 4.1) * 2.4} fill="#FFFFFF" opacity={(0.3 + 0.7 * tw) * rand(i * 9.1)} />);
  }
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #1B0E4A 0%, #4A1F7A 35%, #B4467A 58%, #F09A5A 70%, #5A3A52 72%, #3A2A3E 100%)" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {stars}
        <g transform={`rotate(${frame * 0.6} 270 520)`}>
          <circle cx={270} cy={520} r={170} fill="none" stroke="#FFB23D" strokeWidth={14} strokeDasharray="30 18" opacity={0.65} />
          <circle cx={270} cy={520} r={140} fill="rgba(255,190,90,0.12)" stroke="#FFD27A" strokeWidth={6} strokeDasharray="12 16" opacity={0.7} />
        </g>
        <path d="M0 1330 L80 1250 L150 1290 L240 1210 L330 1280 L420 1230 L520 1300 L640 1220 L760 1280 L860 1200 L980 1270 L1080 1230 L1080 1400 L0 1400 Z" fill="#3B2440" />
        <path d="M120 1240 L120 1150 L160 1150 L160 1180 L190 1180 L190 1250 Z M800 1230 L800 1120 L850 1100 L850 1240 Z" fill="#2C1A33" />
        <path d="M0 1370 C200 1340 420 1380 640 1350 C820 1330 960 1360 1080 1350 L1080 1920 L0 1920 Z" fill="#4A3348" />
        <path d="M0 1500 C240 1470 520 1510 780 1480 C900 1466 1000 1480 1080 1476 L1080 1920 L0 1920 Z" fill="#3A2738" />
        {/* the purple giant (a big Nubi-shaped villain) */}
        <g transform={`translate(860 ${1060 + Math.sin(frame * 0.05) * 6})`}>
          <rect x={-170} y={-420} width={360} height={300} rx={80} fill="#7A4FB8" stroke="#2A1240" strokeWidth={8} />
          <rect x={-130} y={-300} width={70} height={24} rx={10} fill="#1A0A2A" />
          <rect x={-30} y={-300} width={70} height={24} rx={10} fill="#1A0A2A" />
          <rect x={-150} y={-470} width={300} height={70} rx={28} fill="#E0A82E" stroke="#2A1240" strokeWidth={8} />
          <rect x={-210} y={-130} width={420} height={260} rx={60} fill="#5B3A8C" stroke="#2A1240" strokeWidth={8} />
          <g transform={`translate(-250 ${-160 + Math.sin(frame * 0.08) * 10})`}>
            <rect x={-60} y={-90} width={120} height={150} rx={40} fill="#F2B632" stroke="#2A1240" strokeWidth={8} />
            {["#2F7BFF", "#FF2D3D", "#9B3DFF", "#FFD60A", "#FF8A1F"].map((c, i) => (
              <circle key={c} cx={-40 + i * 20} cy={-56} r={8} fill={c} stroke="#2A1240" strokeWidth={3} />
            ))}
            <circle cx={0} cy={0} r={16} fill="#2EE07A" stroke="#2A1240" strokeWidth={4} />
          </g>
        </g>
        <NubiStandIn x={250} y={1230} s={0.9} frame={frame} />
        {glove ? (
          <g transform="translate(520 1110)">
            <rect x={-46} y={-40} width={92} height={96} rx={30} fill="#F2B632" stroke="#2A1240" strokeWidth={7} />
            {["#2F7BFF", "#FF2D3D", "#9B3DFF", "#FFD60A"].map((c, i) => (
              <circle key={c} cx={-30 + i * 20} cy={-20} r={7} fill={c} stroke="#2A1240" strokeWidth={3} />
            ))}
            <circle cx={0} cy={14} r={12} fill="#2EE07A" stroke="#2A1240" strokeWidth={3} />
          </g>
        ) : null}
      </svg>
      {icy ? <AbsoluteFill style={{ background: "rgba(120,200,255,0.22)" }} /> : null}
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

export const ThanosUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = THANOS_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? THANOS_UI_SEGMENTS[THANOS_UI_SEGMENTS.length - 1];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop frame={frame} glove={frame >= 1030 && frame < 1200} icy={frame < 70} />

      {/* 1. Frozen time chip, then the slow-motion treatment. */}
      <TimeFrozenHUD frame={frame} at={4} out={60} x={500} y={300} />
      <SlowMoBars frame={frame} from={72} to={166} />

      {/* 2. Onomatopoeias. */}
      <ImpactText frame={frame} at={174} text="¡CLIC!" x={380} y={400} size={100} color="#C9B6FF" rotate={-10} />
      <ImpactText frame={frame} at={196} text="¡KRAK!" x={590} y={590} color="#FF9A3D" rotate={6} />
      <ImpactText frame={frame} at={218} text="¡BOOM!" x={440} y={790} size={130} />
      <ImpactText frame={frame} at={240} text="¡ZAS!" x={600} y={980} size={110} color="#5CE1FF" rotate={8} />
      <ImpactText frame={frame} at={258} text="¡PUM!" x={430} y={420} size={110} color="#FF6FA8" rotate={-5} />

      {/* 3. The failed snap. */}
      <NoSignal frame={frame} at={304} xAt={328} out={390} x={500} y={420} />

      {/* 4. No five sad years, no time travel. */}
      <CrossedList
        frame={frame}
        items={[
          { at: 404, crossAt: 430 },
          { at: 420, crossAt: 458 },
        ]}
        out={518}
        x={500}
        y={620}
      />

      {/* 5. The whole team. */}
      <TeamComplete frame={frame} at={534} out={640} x={500} y={520} />

      {/* 6. Costume powers, as a column on the left, then as a grid at the top. */}
      <PowerChips frame={frame} times={[654, 668, 682, 696, 716]} out={780} x={260} y={640} />
      <PowerChips frame={frame} times={[794, 802, 810, 818, 832]} out={890} x={500} y={430} layout="grid" />
      <HeroLabel frame={frame} at={806} out={890} text="MODO TRUENO" x={640} y={760} color="#2F8CFF" icon="bolt" side="bottom" />
      <HeroLabel frame={frame} at={820} out={890} text="NUBI" x={250} y={940} color="#2FBF71" icon="star" side="bottom" rotate={3} />
      <HeroLabel frame={frame} at={834} out={890} text="MODO FURIA" x={560} y={1060} color="#9B3DFF" side="right" />
      <HeroLabel frame={frame} at={840} out={890} text="¡HOLA!" x={430} y={1130} color="#FF7A1F" side="left" size={40} />

      {/* 7. The stones charge up. */}
      <StonesHUD frame={frame} at={904} out={1020} x={500} y={450} />

      {/* 8. Pizza hologram projected from the glove. */}
      <PizzaApp frame={frame} at={1034} pressAt={1066} noDriverAt={1130} out={1186} x={500} y={620} beamFrom={{ x: 520, y: 1070 }} />

      {/* 9. Post-credits and the closing question. */}
      <PostCreditsCard frame={frame} at={1204} out={1300} />
      <FinalQuestion frame={frame} at={1314} />

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
