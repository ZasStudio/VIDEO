import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, ramp, rand } from "../anim";
import { FONT } from "../theme";
import {
  ChaseVignette,
  DinoCTA,
  ExistenceMeter,
  FactCard,
  ImpactHUD,
  MenuCard,
  RoarWaves,
  SpeechBubble,
  TelescopeView,
} from "../overlay/dino/DinoUI";

// Review sheet (1080 x 1920) for the 2D overlays of "¿Y si los dinosaurios nunca se hubieran
// extinguido?": every component plays once, in order, over a stand-in backdrop. The TikTok
// unsafe zones (top bar, right button column, bottom description) are tinted red on top, the
// caption band is dashed and the safe area (x 60-940, y 230-1250) is outlined in green.

export const DINO_UI_SEGMENTS = [
  { name: "TelescopeView + ImpactHUD", from: 0, to: 170 },
  { name: "FactCard (raptor vs pavo)", from: 170, to: 290 },
  { name: "SpeechBubble: angry / normal / whisper", from: 290, to: 410 },
  { name: "MenuCard + ¡AGOTADO!", from: 410, to: 530 },
  { name: "ExistenceMeter", from: 530, to: 660 },
  { name: "RoarWaves", from: 660, to: 720 },
  { name: "ChaseVignette + FactCard (solo texto)", from: 720, to: 810 },
  { name: "DinoCTA", from: 810, to: 1000 },
  { name: "TelescopeView enter=raise", from: 1000, to: 1060 },
];
export const DINO_UI_SHEET_DURATION = 1060;

// Telescope segment: the asteroid approaches, the HUD tracks it, and at MISS it swerves past.
const TEL_FROM = 2;
const TEL_TO = 166;
const HUD_AT = 24;
const MISS = 100;
const HUD_OUT = 144;

const asteroidAt = (f: number) => {
  if (f < MISS) {
    const u = ramp(f, 0, MISS, [0, 1], EASE_IN_OUT);
    return { x: 420 + 80 * u, y: 540 + 100 * u, s: 0.45 + 0.6 * u };
  }
  const v = ramp(f, MISS, MISS + 16, [0, 1], EASE_IN);
  return { x: 500 + 900 * v, y: 640 - 520 * v, s: 1.05 + 1.4 * v };
};

const Asteroid: React.FC<{ frame: number; x: number; y: number; s: number }> = ({ frame, x, y, s }) => {
  const pts: string[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 88 + rand(i * 2.3) * 22;
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-40 -60 L-420 -330 L-300 -120 L-70 10 Z" fill="#FF8A3D" opacity={0.35} />
      <path d="M-50 -40 L-330 -250 L-60 -8 Z" fill="#FFD166" opacity={0.45} />
      <circle r={130} fill="#FF7A2A" opacity={0.18} />
      <g transform={`rotate(${frame * 1.4})`}>
        <polygon points={pts.join(" ")} fill="#8C7560" stroke="#26140A" strokeWidth={8} strokeLinejoin="round" />
        <ellipse cx={-26} cy={-22} rx={22} ry={16} fill="#6E5A48" />
        <ellipse cx={30} cy={20} rx={16} ry={12} fill="#6E5A48" />
        <ellipse cx={20} cy={-40} rx={9} ry={7} fill="#6E5A48" />
        <path d="M-60 -40 C-40 -70 0 -80 30 -70" stroke="#B9A48C" strokeWidth={10} fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
};

const SpaceBackdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const stars = [];
  for (let i = 0; i < 150; i++) {
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.2 + i);
    stars.push(<circle key={i} cx={rand(i * 1.3) * 1080} cy={rand(i * 2.7) * 1920} r={1 + rand(i * 4.1) * 2.6} fill="#FFFFFF" opacity={0.3 + 0.7 * tw * rand(i * 9.1)} />);
  }
  const a = asteroidAt(frame);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #1B2A5E 0%, #0A1030 60%, #04060F 100%)" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {stars}
        <circle cx={540} cy={2620} r={1500} fill="#1E6BD6" />
        <path d="M-60 1300 C200 1220 360 1260 520 1180 C640 1130 760 1180 900 1150" stroke="#4CC96B" strokeWidth={90} fill="none" opacity={0.8} />
        <circle cx={540} cy={2620} r={1500} fill="none" stroke="#9FE0FF" strokeWidth={36} opacity={0.5} />
        <Asteroid frame={frame} x={a.x} y={a.y} s={a.s} />
      </svg>
    </AbsoluteFill>
  );
};

/** Stand-in for the 3D world: sky, jungle hills, a volcano and a mint blob for Nubi. */
const JungleBackdrop: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #3E78B8 0%, #79AED6 42%, #B9D9A0 60%, #5E9A50 100%)" }}>
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <path d="M600 1080 L740 860 L800 860 L940 1080 Z" fill="#6D7F96" opacity={0.7} />
      <circle cx={770} cy={820} r={30} fill="#C9D2DC" opacity={0.7} />
      <circle cx={800} cy={770} r={40} fill="#C9D2DC" opacity={0.6} />
      <path d="M0 1120 C200 1030 380 1090 560 1050 C760 1000 900 1070 1080 1030 L1080 1920 L0 1920 Z" fill="#4E8F4A" />
      <path d="M0 1260 C240 1190 520 1250 760 1200 C900 1170 1000 1200 1080 1190 L1080 1920 L0 1920 Z" fill="#3E7A3C" />
      {[140, 360, 880].map((fx, i) => (
        <g key={fx} transform={`translate(${fx} ${1180 + i * 20})`}>
          {[-50, -25, 0, 25, 50].map((a) => (
            <ellipse key={a} cx={0} cy={-70} rx={16} ry={70} transform={`rotate(${a} 0 0)`} fill="#2F6B35" />
          ))}
        </g>
      ))}
      <g transform={`translate(250 ${1150 + Math.sin(frame * 0.2) * 6}) scale(0.6)`}>
        <ellipse cx={0} cy={250} rx={170} ry={30} fill="rgba(0,0,0,0.2)" />
        <path d="M-150 230 Q-170 -40 0 -60 Q170 -40 150 230 Z" fill="#7FE3C3" stroke="#2C7A64" strokeWidth={8} />
        <circle cx={-50} cy={60} r={22} fill="#1B2A24" />
        <circle cx={50} cy={60} r={22} fill="#1B2A24" />
        <path d="M-30 120 Q0 150 30 120" stroke="#1B2A24" strokeWidth={8} fill="none" strokeLinecap="round" />
      </g>
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
        <rect x={950} y={700} width={130} height={700} fill={zone} />
        <path d="M950 700 V1400 M950 700 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {[790, 930, 1070, 1210, 1330].map((cy) => (
          <circle key={cy} cx={1015} cy={cy} r={42} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={4} />
        ))}
        <rect x={0} y={1400} width={1080} height={520} fill={zone} />
        <path d="M0 1400 H1080" stroke={edge} strokeWidth={3} strokeDasharray="14 10" />
        {label(24, 1446, "TIKTOK: DESCRIPCIÓN (y > 1400)")}
        <rect x={0} y={1260} width={1080} height={160} fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeDasharray="16 12" />
        {label(540, 1352, "CAPTIONS (y 1260-1420)", "middle")}
        <rect x={60} y={230} width={880} height={1020} fill="none" stroke="rgba(120,255,140,0.6)" strokeWidth={3} strokeDasharray="6 10" />
        {label(66, 258, "ZONA SEGURA x 60-940, y 230-1250")}
      </svg>
    </AbsoluteFill>
  );
};

export const DinoUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = DINO_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? DINO_UI_SEGMENTS[DINO_UI_SEGMENTS.length - 1];
  const tel = frame < 170 || frame >= 1000;
  const hud = frame < MISS ? asteroidAt(frame) : asteroidAt(MISS - 1);
  const flash = frame >= 664 && frame < 672 ? 1 - ramp(frame, 664, 672, [0, 1], EASE_IN) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {tel ? <SpaceBackdrop frame={frame} /> : <JungleBackdrop frame={frame} />}

      {/* 1. Telescope + asteroid tracking HUD (the HUD follows the rock until the miss). */}
      <TelescopeView frame={frame} from={TEL_FROM} to={TEL_TO} />
      <ImpactHUD frame={frame} at={HUD_AT} missAt={MISS} out={HUD_OUT} x={hud.x} y={hud.y - 20} />
      <TelescopeView frame={frame} from={1002} to={1058} enter="raise" />

      {/* 2. Fact card with the size comparison. */}
      <FactCard
        frame={frame}
        at={176}
        out={282}
        x={500}
        y={660}
        visual="raptor-vs-turkey"
        text={"VELOCIRAPTOR: TAMAÑO DE UN PAVO…\n*¡Y CON PLUMAS!*"}
      />

      {/* 3. Speech bubbles, one per tone. */}
      <SpeechBubble frame={frame} at={296} out={402} x={480} y={440} speaker="MAMÁ" text="¡Ni siquiera puedes cuidar una *planta*!" tail="left" tone="angry" />
      <SpeechBubble frame={frame} at={316} out={402} x={520} y={780} speaker="NUBI" text="Mamá, ¿puedo tener un *dinosaurio*?" tail="right" tone="normal" />
      <SpeechBubble frame={frame} at={336} out={402} x={480} y={1080} speaker="MAMÁ" text="…lo pensaré." tail="bottom" tone="whisper" />

      {/* 4. Menu with the stamp. */}
      <MenuCard frame={frame} at={416} out={522} x={500} y={720} stampAt={474} />

      {/* 5. Existence meter draining with glitches. */}
      <ExistenceMeter frame={frame} at={536} from={548} to={610} out={648} x={500} y={600} />

      {/* 6. Roar. */}
      <RoarWaves frame={frame} at={664} x={500} y={760} />

      {/* 7. Chase. */}
      <ChaseVignette frame={frame} from={724} to={806} />
      <FactCard frame={frame} at={732} out={800} x={500} y={700} text="CASI TODOS LOS MAMÍFEROS DE ESA ÉPOCA ERAN *PEQUEÑITOS*" />

      {/* 8. Call to action. */}
      <DinoCTA frame={frame} at={816} x={500} y={760} out={986} />

      {flash > 0 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash * 0.3 }} /> : null}
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
