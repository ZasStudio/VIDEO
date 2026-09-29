import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT } from "../theme";
import {
  AlarmOverlay,
  Countdown5,
  ExperimentCTA,
  NoO2Badge,
  O2Gauge,
  PressurePop,
  StatusCard,
} from "../overlay/oxigeno/OxiUI";

// Review sheet (1080 x 1920) for the 2D overlays of "¿Y si desaparece el oxígeno por 5
// segundos?": every component plays once, in order, over a stand-in backdrop, so single frames
// can be checked. The dashed band marks where the captions sit (y 1300-1480).

export const OXI_UI_SEGMENTS = [
  { name: "O2Gauge (21 -> 0 -> 21)", from: 0, to: 130 },
  { name: "Countdown5", from: 130, to: 180 },
  { name: "AlarmOverlay + NoO2Badge", from: 180, to: 270 },
  { name: "PressurePop", from: 270, to: 310 },
  { name: "StatusCard x5", from: 310, to: 420 },
  { name: "Combined: alarm + small gauge + badge + pop", from: 420, to: 510 },
  { name: "ExperimentCTA", from: 510, to: 640 },
];
export const OXI_UI_SHEET_DURATION = 640;

/** Stand-in for the 3D lab: warm wall, floor and a mint blob where Nubi would stand. */
const Backdrop: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #3B4C7A 0%, #6C7FB8 45%, #C9B99A 62%, #8C7A62 100%)" }}>
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <rect x={0} y={1180} width={1080} height={740} fill="#7A6A55" />
      <g transform={`translate(540 ${1000 + Math.sin(frame * 0.2) * 8})`}>
        <ellipse cx={0} cy={250} rx={170} ry={30} fill="rgba(0,0,0,0.2)" />
        <path d="M-150 230 Q-170 -40 0 -60 Q170 -40 150 230 Z" fill="#7FE3C3" stroke="#2C7A64" strokeWidth={8} />
        <circle cx={-50} cy={60} r={22} fill="#1B2A24" />
        <circle cx={50} cy={60} r={22} fill="#1B2A24" />
        <path d="M-30 120 Q0 150 30 120" stroke="#1B2A24" strokeWidth={8} fill="none" strokeLinecap="round" />
      </g>
      <rect x={0} y={1300} width={1080} height={180} fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeDasharray="16 12" />
      <text x={540} y={1400} textAnchor="middle" fontFamily={FONT.heavy} fontWeight={800} fontSize={34} fill="rgba(255,255,255,0.6)">
        CAPTIONS
      </text>
    </svg>
  </AbsoluteFill>
);

export const OxiUISheet: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = OXI_UI_SEGMENTS.find((s) => frame >= s.from && frame < s.to) ?? OXI_UI_SEGMENTS[OXI_UI_SEGMENTS.length - 1];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop frame={frame} />

      {/* 1. Gauge: 21 % -> 0 % (rattle, red blink) -> back to 21 % (green). */}
      <O2Gauge frame={frame} at={4} out={122} x={540} y={620} dropAt={26} dropDur={24} riseAt={84} riseDur={26} />

      {/* 2. "5 SEGUNDOS" stamp. */}
      <Countdown5 frame={frame} at={134} x={540} y={640} out={172} />

      {/* 3. Alarm + corner badge. */}
      <AlarmOverlay frame={frame} from={182} to={266} />
      <NoO2Badge frame={frame} from={192} to={262} x={800} y={440} />

      {/* 4. Ears pop. */}
      <PressurePop frame={frame} at={274} x={540} y={700} />

      {/* 5. Status cards. */}
      <StatusCard frame={frame} at={314} out={412} x={540} y={300} icon="fire" title="FUEGO: APAGADO" tone="red" />
      <StatusCard frame={frame} at={326} out={412} x={540} y={490} icon="engine" title="MOTOR:" sub="SIN COMBUSTIÓN" tone="red" rotate={2} />
      <StatusCard frame={frame} at={338} out={412} x={540} y={680} icon="match" title="CERILLO: NADA" tone="red" />
      <StatusCard frame={frame} at={350} out={412} x={540} y={870} icon="lungs" title="PULMONES" sub="AGUANTAN 5 SEGUNDOS" tone="blue" rotate={2} />
      <StatusCard frame={frame} at={362} out={412} x={540} y={1070} icon="rocket" title="COHETE: OK" sub="LLEVA SU PROPIO OXÍGENO" tone="green" />

      {/* 6. How the pieces stack in the real scene. */}
      <AlarmOverlay frame={frame} from={424} to={506} intensity={0.8} />
      <O2Gauge frame={frame} at={426} out={500} x={250} y={560} scale={0.5} dropAt={430} dropDur={16} />
      <NoO2Badge frame={frame} from={432} to={500} x={800} y={440} scale={0.85} />
      <PressurePop frame={frame} at={462} x={700} y={760} scale={0.7} />

      {/* 7. Call to action. */}
      <ExperimentCTA frame={frame} at={514} x={540} y={720} />

      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
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
