import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, clamp01 } from "../anim";
import { FONT } from "../theme";
import {
  ChargesPhone,
  EndText,
  MoneyCounter,
  MoneyEvent,
  NightClock,
  PayToast,
  PriceTag,
  RuleStamp,
  SilenceSign,
  SleepSensor,
  TitleSticker,
} from "../overlay/dormir/DormirUI";

// Review sheet (1080 x 1920) for the 2D overlays of "¿Y si dormir te pagara?": every component
// plays once, in story order and with timings close to the real beats, over a stand-in backdrop
// (Nubi's bedroom at night, a bright bakery for the street props) so contrast can be judged. The
// money counter is shown in every state and at scales 1, 0.75 and 0.5. The TikTok unsafe zones
// (top bar, right button column, bottom description) are tinted red on top, the caption band is
// dashed and the safe area (x 60-940, y 230-1180) is outlined in green.

export const DORMIR_UI_SEGMENTS = [
  { name: "TitleSticker + MoneyCounter (gancho)", from: 0, to: 130 },
  { name: "MoneyCounter: estados y escalas", from: 130, to: 300 },
  { name: "RuleStamp", from: 300, to: 400 },
  { name: "SleepSensor + contadores (problema)", from: 400, to: 520 },
  { name: "PriceTag", from: 520, to: 620 },
  { name: "SilenceSign", from: 620, to: 730 },
  { name: "PayToast + NightClock + montaje", from: 730, to: 900 },
  { name: "ChargesPhone", from: 900, to: 1010 },
  { name: "EndText", from: 1010, to: 1070 },
];
export const DORMIR_UI_SHEET_DURATION = 1070;

/** Nubi stand-in: a green rounded cube (closed eyes when asleep). */
const NubiStandIn: React.FC<{ x: number; y: number; s?: number; frame: number; asleep?: boolean }> = ({ x, y, s = 1, frame, asleep = false }) => {
  const breathe = asleep ? Math.sin(frame * 0.08) * 4 : -Math.abs(Math.sin(frame * 0.12)) * 6;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform={`translate(0 ${breathe})`}>
        <rect x={-120} y={-210} width={240} height={190} rx={50} fill="#6FD67C" stroke="#1F6B33" strokeWidth={7} />
        <rect x={-100} y={-196} width={200} height={30} rx={15} fill="#FFFFFF" opacity={0.25} />
        {asleep ? (
          <>
            <path d="M-62 -118 Q-44 -104 -26 -118" stroke="#151515" strokeWidth={8} strokeLinecap="round" fill="none" />
            <path d="M26 -118 Q44 -104 62 -118" stroke="#151515" strokeWidth={8} strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <ellipse cx={-44} cy={-118} rx={15} ry={22} fill="#151515" />
            <ellipse cx={44} cy={-118} rx={15} ry={22} fill="#151515" />
            <circle cx={-39} cy={-127} r={5} fill="#FFFFFF" />
            <circle cx={49} cy={-127} r={5} fill="#FFFFFF" />
          </>
        )}
      </g>
    </g>
  );
};

/** Night bedroom (bed in the middle, Nubi asleep) or a bright bakery (`day`). */
const Backdrop: React.FC<{ frame: number; day: boolean }> = ({ frame, day }) =>
  day ? (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #FFE7B8 0%, #FFD99A 55%, #F2B872 100%)" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[360, 620, 880].map((sy) => (
          <g key={sy}>
            <rect x={60} y={sy} width={960} height={22} rx={6} fill="#B9773A" />
            {Array.from({ length: 7 }, (_, i) => (
              <ellipse key={i} cx={130 + i * 130} cy={sy - 34} rx={52} ry={34} fill={i % 2 ? "#E59A3F" : "#D9873A"} stroke="#8A4E1C" strokeWidth={5} />
            ))}
          </g>
        ))}
        <rect x={0} y={1090} width={1080} height={830} fill="#C9814A" />
        <rect x={0} y={1090} width={1080} height={36} fill="#E8A866" />
        <NubiStandIn x={540} y={1300} s={1.2} frame={frame} />
      </svg>
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #30296A 0%, #4A3F8F 55%, #5C4FA3 100%)" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={(i * 197) % 1080} cy={120 + ((i * 331) % 900)} r={3} fill="#FFFFFF" opacity={0.12} />
        ))}
        <rect x={640} y={300} width={300} height={380} rx={16} fill="#141A4A" stroke="#E9E4FF" strokeWidth={16} />
        <path d="M790 300 V680 M640 490 H940" stroke="#E9E4FF" strokeWidth={12} />
        <circle cx={860} cy={380} r={40} fill="#FFE27A" />
        <rect x={110} y={860} width={130} height={200} rx={10} fill="#8A5A3A" />
        <path d="M150 860 L130 760 H230 L210 860 Z" fill="#FFD27A" opacity={0.9} />
        <rect x={250} y={960} width={580} height={170} rx={40} fill="#9B6A45" stroke="#5B3A22" strokeWidth={8} />
        <NubiStandIn x={540} y={1150} s={0.9} frame={frame} asleep />
        <rect x={210} y={1110} width={660} height={140} rx={30} fill="#3E8BEA" stroke="#1F4F99" strokeWidth={8} />
        <rect x={210} y={1110} width={660} height={34} rx={17} fill="#FFFFFF" opacity={0.25} />
        <rect x={0} y={1250} width={1080} height={670} fill="#3A2F6B" />
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

// Segment 2: the states grid.
const GRID_EVENTS: MoneyEvent[] = [
  { at: 190, text: "+S/ 100" },
  { at: 250, text: "+S/ 100" },
];
const MINUS_EVENTS: MoneyEvent[] = [{ at: 220, text: "−S/ 400" }];

// Segment 7: the night montage (the counter earns S/ 100 per hour of the clock).
const NIGHT = { at: 786, from: 796, to: 880, out: 890 };
const nightHours = (f: number) => 10 * EASE_IN_OUT(clamp01((f - NIGHT.from) / (NIGHT.to - NIGHT.from)));
const NIGHT_EVENTS: MoneyEvent[] = [];
for (let f = NIGHT.from; f <= NIGHT.to; f++) {
  if (Math.floor(nightHours(f) + 1e-6) > Math.floor(nightHours(f - 1) + 1e-6)) NIGHT_EVENTS.push({ at: f, text: "+S/ 100" });
}

// Segment 8: the charges.
const PHONE = { at: 902, c1: 924, c2: 932, c3: 940, zero: 948, out: 996 };

export const DormirUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame;
  const seg = DORMIR_UI_SEGMENTS.find((s) => f >= s.from && f < s.to) ?? DORMIR_UI_SEGMENTS[DORMIR_UI_SEGMENTS.length - 1];
  const day = f >= 520 && f < 730;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop frame={frame} day={day} />

      {/* 1. GANCHO: the counter climbs, the alarm freezes it at S/ 300, it flashes red; the title. */}
      {f < 130 ? (
        <MoneyCounter frame={f} soles={f < 40 ? 180 + 3 * f : 300} x={540} y={930} scale={1.15} state={f < 40 ? "earning" : f < 80 ? "frozen" : "alarm"} />
      ) : null}
      <TitleSticker frame={f} at={0} out={112} />

      {/* 2. Every state, at scales 1, 0.75 and 0.5. */}
      {f >= 130 && f < 300 ? (
        <>
          <MoneyCounter frame={f} soles={940 + 3 * (f - 130)} x={500} y={560} appear={132} events={GRID_EVENTS} />
          <MoneyCounter frame={f} soles={300} x={270} y={800} scale={0.75} state="frozen" appear={136} />
          <MoneyCounter frame={f} soles={300} x={730} y={800} scale={0.75} state="alarm" appear={140} />
          <MoneyCounter frame={f} soles={800 + Math.floor((f - 130) * 0.5)} x={190} y={1010} scale={0.5} appear={144} />
          <MoneyCounter frame={f} soles={12800} x={410} y={1010} scale={0.5} state="frozen" appear={146} />
          <MoneyCounter frame={f} soles={f < 220 ? 1000 : 600} x={620} y={1010} scale={0.5} state="alarm" appear={148} events={MINUS_EVENTS} />
          <MoneyCounter frame={f} soles={0} x={820} y={1010} scale={0.5} state="zero" appear={150} />
        </>
      ) : null}

      {/* 3. The rule. */}
      {f >= 300 && f < 400 ? <MoneyCounter frame={f} soles={120 + 3 * (f - 300)} x={540} y={930} scale={1.15} /> : null}
      <RuleStamp frame={f} at={304} out={384} />

      {/* 4. PROBLEMA: Nubi's counter stuck at S/ 0, the sensor buzzes; the colleague earns. */}
      {f >= 400 && f < 520 ? (
        <>
          <MoneyCounter frame={f} soles={0} x={290} y={680} scale={0.8} state="zero" appear={402} />
          <SleepSensor frame={f} x={290} y={880} scale={0.8} state="awake" buzzAt={440} appear={404} />
          <MoneyCounter frame={f} soles={800 + Math.floor((f - 400) * 0.6)} x={760} y={680} scale={0.8} appear={406} />
          <SleepSensor frame={f} x={760} y={880} scale={0.8} state="asleep" appear={408} />
        </>
      ) : null}

      {/* 5-6. MUNDO / ENEMIGO: the bakery price, the silence sign. */}
      <PriceTag frame={f} at={524} out={604} />
      <SilenceSign frame={f} at={624} out={712} />

      {/* 7. GIRO: the payment, the night montage (S/ 100 per hour). */}
      <PayToast frame={f} at={732} out={782} />
      <NightClock frame={f} at={NIGHT.at} out={NIGHT.out} from={NIGHT.from} to={NIGHT.to} />
      {f >= 784 && f < 900 ? <MoneyCounter frame={f} soles={100 * nightHours(f)} x={540} y={930} scale={1.15} appear={786} events={NIGHT_EVENTS} /> : null}

      {/* 8. The charges, down to zero. */}
      {f >= 900 && f < 1010 ? <MoneyCounter frame={f} soles={f < PHONE.zero ? 1000 : 0} x={540} y={930} scale={1.15} state={f < PHONE.zero ? "frozen" : "zero"} /> : null}
      <ChargesPhone frame={f} at={PHONE.at} out={PHONE.out} charge1={PHONE.c1} charge2={PHONE.c2} charge3={PHONE.c3} zeroAt={PHONE.zero} />

      {/* 9. FINAL: the end text; the counter starts again (loop). */}
      {f >= 1010 ? <MoneyCounter frame={f} soles={3 * Math.max(0, f - 1030)} x={540} y={930} scale={1.15} appear={1026} /> : null}
      <EndText frame={f} at={1012} />

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
