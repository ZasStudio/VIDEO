import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, pop, ramp } from "../anim";
import { ClawdPip } from "../overlay/ClawdPip";
import { BigNumber, Burst, Card, fmtNumber } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { talkPose } from "../talk";
import { FONT } from "../theme";
import { SCENES, lineEnd, wordAt, wordEnd } from "../timeline";
import { Clawd } from "../three/Clawd";
import { Vec3, projectToScreen } from "../three/CameraRig";
import { MapPin } from "../three/Props";
import { LOOKS } from "../three/Text3D";
import { Atmosphere, CloudSpot, World } from "../three/World";
import { SMOOTH, Stage, pathCam } from "./common";
import {
  AERIAL_CAM,
  CLAWD_SIZE,
  CLAWD_SPOT,
  CLAWD_YAW,
  INTRO_CAM_END,
} from "./places";

// Fly up to an aerial view while Clawd says where Machu Picchu is: pin on Cusco, altitude
// counter on "dos mil cuatrocientos treinta metros", then a rewind to the year 1450.

const PIN_AT: Vec3 = [0.5, 0, 1];

// Only distant clouds, so nothing covers the citadel during the orbit.
const CLOUDS: CloudSpot[] = [
  [-30, 26, -92, 1.3],
  [26, 32, -110, 1.6],
  [60, 18, -130, 2.2],
  [-80, 28, -150, 2.4],
  [95, 36, -70, 2.0],
  [-120, 40, -50, 2.6],
  [-90, 20, 40, 1.8],
];

const riseCam = pathCam([
  INTRO_CAM_END.position,
  [16, 12, 50],
  [44, 38, 96],
  AERIAL_CAM.position,
]);
const riseTarget = pathCam([
  INTRO_CAM_END.target,
  [3, 1, 2],
  [2, -4, -8],
  AERIAL_CAM.target,
]);

export const datosCam = (g: number) => {
  const S = SCENES.datos;
  const up = S.from + 48;
  const u = ramp(g, S.from, up, [0, 1], SMOOTH);
  let position = riseCam(u);
  let target = riseTarget(u);
  // Slow orbit around the citadel once up in the air.
  const a = interpolate(g, [up, S.from + S.duration + 20], [0, -0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (a !== 0) {
    const cx = 0;
    const cz = -8;
    const dx = position[0] - cx;
    const dz = position[2] - cz;
    position = [
      cx + dx * Math.cos(a) - dz * Math.sin(a),
      position[1],
      cz + dx * Math.sin(a) + dz * Math.cos(a),
    ];
    const tx = target[0] - cx;
    const tz = target[2] - cz;
    target = [
      cx + tx * Math.cos(a) - tz * Math.sin(a),
      target[1],
      cz + tx * Math.sin(a) + tz * Math.cos(a),
    ];
  }
  return { position, target, fov: 40 };
};

const PeruFlag: React.FC = () => (
  <div
    style={{
      display: "flex",
      width: 78,
      height: 54,
      borderRadius: 8,
      overflow: "hidden",
      border: "4px solid #fff",
      boxShadow: "0 4px 0 rgba(0,0,0,0.3)",
    }}
  >
    <div style={{ flex: 1, background: "#D91023" }} />
    <div style={{ flex: 1, background: "#FFFFFF" }} />
    <div style={{ flex: 1, background: "#D91023" }} />
  </div>
);

const Mountain: React.FC<{ size?: number }> = ({ size = 70 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M5 88 L38 30 L52 52 L66 22 L95 88 Z" fill="#fff" />
    <path
      d="M38 30 L46 44 L40 48 L33 40 Z M66 22 L75 42 L68 45 L61 34 Z"
      fill="#BFE6FF"
    />
  </svg>
);

const AltitudeGauge: React.FC<{ g: number }> = ({ g }) => {
  const IN = wordAt("L03", 6) - 6;
  const OUT = lineEnd("L03") + 14;
  if (g < IN || g > OUT + 10) return null;
  const inK = pop(g, IN, { damping: 13, stiffness: 140 });
  const outK = ramp(g, OUT, OUT + 10);
  const fill = ramp(g, wordAt("L03", 7), wordAt("L03", 11), [0, 1], EASE_IN_OUT);
  const value = 2430 * fill;
  const barH = 470;
  return (
    <div
      style={{
        position: "absolute",
        right: 150,
        top: 140,
        display: "flex",
        alignItems: "flex-end",
        gap: 34,
        transform: `translateX(${(1 - inK) * 500 + outK * 700}px) rotate(${-3 + outK * 8}deg)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Mountain size={96} />
        <BigNumber
          text={`${fmtNumber(value)} m`}
          size={128}
          gradient="linear-gradient(180deg, #F2FFE0 0%, #7CF03C 50%, #12B33B 100%)"
          stroke="#031A08"
        />
        <div
          style={{
            fontFamily: FONT.heavy,
            fontWeight: 900,
            fontSize: 34,
            color: "#fff",
            WebkitTextStroke: "8px #031A08",
            paintOrder: "stroke fill",
            letterSpacing: 1,
          }}
        >
          SOBRE EL NIVEL DEL MAR
        </div>
      </div>
      <div
        style={{
          width: 58,
          height: barH,
          borderRadius: 29,
          background: "rgba(3,26,8,0.55)",
          border: "6px solid #fff",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 10px 0 rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${fill * 100}%`,
            background:
              "linear-gradient(0deg, #12B33B 0%, #7CF03C 60%, #F2FFE0 100%)",
          }}
        />
      </div>
    </div>
  );
};

export const Datos: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SCENES.datos;
  const g = frame + S.from;
  const cam = datosCam(g);
  // Pin drop on "Cusco".
  const PIN_LAND = wordAt("L03", 4) + 2;
  const drop = ramp(g, PIN_LAND - 14, PIN_LAND, [1, 0], (x) => x * x);
  const dl = g - PIN_LAND;
  const pinSquash = dl >= 0 ? 1 - 0.22 * Math.exp(-dl / 5) * Math.cos(dl * 0.6) : 1.12;
  const pinY = drop * 42;
  const pinShown = g >= PIN_LAND - 14;
  const screen = projectToScreen(cam, [PIN_AT[0], PIN_AT[1] + 10, PIN_AT[2]]);
  // Rewind to 1450 while "hacia el año mil cuatrocientos cincuenta" is said.
  const RW = wordAt("L04", 4) - 6;
  const YEAR_TITLE = wordAt("L04", 6) - 4;
  const ROLL0 = wordAt("L04", 7) - 4;
  const LANDY = wordEnd("L04", 9);
  const EXIT = S.from + S.duration - 14;
  const rewind = ramp(g, RW, RW + 10) * (1 - ramp(g, LANDY, LANDY + 12));
  const year = Math.round(
    interpolate(g, [ROLL0, LANDY], [2026, 1450], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_IN_OUT,
    }),
  );
  const turnAway = ramp(g, S.from, S.from + 24);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          filter:
            rewind > 0.01
              ? `sepia(${0.65 * rewind}) saturate(${1 + 0.3 * rewind}) contrast(${1 + 0.1 * rewind})`
              : undefined,
        }}
      >
        <Stage cam={cam}>
          <Atmosphere
            variant="day"
            sunPos={[70, 90, 80]}
            fogNear={150}
            fogFar={640}
          />
          <World frame={g} cloudSpots={CLOUDS} />
          <group position={CLAWD_SPOT} rotation={[0, CLAWD_YAW + 0.35 * (1 - turnAway), 0]}>
            <Clawd
              size={CLAWD_SIZE}
              pose={talkPose(g, {
                hat: 1,
                armL: 0.55 * (1 - turnAway),
                reachL: 1.4 * (1 - turnAway),
              })}
            />
          </group>
          {pinShown ? (
            <group
              position={[PIN_AT[0], PIN_AT[1] + pinY, PIN_AT[2]]}
              scale={[
                2.4 / Math.sqrt(pinSquash),
                2.4 * pinSquash,
                2.4 / Math.sqrt(pinSquash),
              ]}
              rotation={[0, g * 0.05, 0]}
            >
              <MapPin />
            </group>
          ) : null}
          {[0, 10, 20].map((o) => {
            const d = g - PIN_LAND - o;
            if (d < 0 || d > 34) return null;
            const t = d / 34;
            return (
              <mesh
                key={o}
                position={[PIN_AT[0], 0.3, PIN_AT[2]]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={2 + t * 16}
              >
                <ringGeometry args={[0.9, 1, 48]} />
                <meshBasicMaterial
                  color="#FFFFFF"
                  transparent
                  opacity={(1 - t) * 0.85}
                />
              </mesh>
            );
          })}
        </Stage>
      </AbsoluteFill>
      {rewind > 0.01 ? (
        <AbsoluteFill
          style={{
            opacity: rewind * 0.5,
            background:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 2px, transparent 2px, transparent 6px)",
            transform: `translateY(${(g * 7) % 6}px)`,
          }}
        />
      ) : null}
      <Card
        frame={g}
        at={PIN_LAND + 2}
        out={wordAt("L03", 6) - 8}
        x={screen.x + 280}
        y={screen.y - 40}
        icon={<PeruFlag />}
        title="CUSCO, PERÚ"
        rotate={-3}
      />
      <AltitudeGauge g={g} />
      <Burst frame={g} at={LANDY} x={960} y={470} color="#FFD60A" size={640} />
      {g >= YEAR_TITLE - 12 ? (
        <TitleCanvas>
          <TitleSlam
            frame={g}
            at={YEAR_TITLE}
            out={EXIT}
            exit="zoom"
            lines={[{ text: "AÑO", size: 0.9, look: LOOKS.white, y: 2.8 }]}
          />
          <TitleSlam
            frame={g}
            at={YEAR_TITLE + 6}
            out={EXIT}
            exit="zoom"
            shine={false}
            lines={[
              {
                text: `${year}`,
                size: 3.1,
                look: g >= LANDY ? LOOKS.gold : LOOKS.white,
                y: 0.2,
              },
            ]}
          />
        </TitleCanvas>
      ) : null}
      {g >= LANDY && g < LANDY + 14 ? (
        <AbsoluteFill
          style={{
            background: "#FFD60A",
            opacity: 0.3 * (1 - ramp(g, LANDY, LANDY + 12, [0, 1], EASE_OUT)),
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      <ClawdPip g={g} from={S.from + 40} to={S.from + S.duration - 12} />
    </AbsoluteFill>
  );
};
