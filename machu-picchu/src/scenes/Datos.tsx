import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, pop, ramp, wordPulse } from "../anim";
import { BigNumber, Burst, Card, fmtNumber } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { WORD_FRAMES } from "../script";
import { FONT, SCENES } from "../theme";
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

// 10-15.3 s: fly up to an aerial view: pin on Cusco, altitude counter, rewind to the year 1450.

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
const PIN_LAND = 326;

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
  const u = ramp(g, 300, 348, [0, 1], SMOOTH);
  let position = riseCam(u);
  let target = riseTarget(u);
  // Slow orbit around the citadel once up in the air.
  const a = interpolate(g, [348, 470], [0, -0.42], {
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
  if (g < 346 || g > 398) return null;
  const inK = pop(g, 346, { damping: 12, stiffness: 160 });
  const outK = ramp(g, 388, 396);
  const fill = ramp(g, 348, 376, [0, 1], EASE_IN_OUT);
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
  const g = frame + SCENES.datos.from;
  const cam = datosCam(g);
  // Pin drop.
  const drop = ramp(g, PIN_LAND - 10, PIN_LAND, [1, 0], (x) => x * x);
  const dl = g - PIN_LAND;
  const pinSquash =
    dl >= 0 ? 1 - 0.25 * Math.exp(-dl / 4) * Math.cos(dl * 0.8) : 1.15;
  const pinY = drop * 42;
  const pinShown = g >= PIN_LAND - 10;
  const screen = projectToScreen(cam, [PIN_AT[0], PIN_AT[1] + 10, PIN_AT[2]]);
  const talk = wordPulse(g, WORD_FRAMES);
  // Rewind to 1450.
  const rewind = ramp(g, 404, 412) * (1 - ramp(g, 440, 448));
  const year = Math.round(
    interpolate(g, [412, 440], [2026, 1450], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_IN_OUT,
    }),
  );
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
          <group
            position={CLAWD_SPOT}
            rotation={[0, CLAWD_YAW + 0.35 * (1 - ramp(g, 300, 320)), 0]}
          >
            <Clawd
              size={CLAWD_SIZE}
              pose={{
                hat: 1,
                squash: 1 - 0.06 * talk,
                hop: 0.6 * talk,
                armL: 0.55 * (1 - ramp(g, 300, 312)),
                reachL: 1.4 * (1 - ramp(g, 300, 312)),
                armR: 0.6 * talk,
              }}
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
            if (d < 0 || d > 26) return null;
            const t = d / 26;
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
        at={326}
        out={342}
        x={screen.x + 280}
        y={screen.y - 40}
        icon={<PeruFlag />}
        title="CUSCO, PERÚ"
        rotate={-3}
      />
      <AltitudeGauge g={g} />
      <Burst frame={g} at={440} x={960} y={470} color="#FFD60A" size={640} />
      {g >= 398 ? (
        <TitleCanvas>
          <TitleSlam
            frame={g}
            at={404}
            out={452}
            exit="zoom"
            lines={[{ text: "AÑO", size: 0.9, look: LOOKS.white, y: 2.8 }]}
          />
          <TitleSlam
            frame={g}
            at={410}
            out={452}
            exit="zoom"
            shine={false}
            lines={[
              {
                text: `${year}`,
                size: 3.1,
                look: g >= 440 ? LOOKS.gold : LOOKS.white,
                y: 0.2,
              },
            ]}
          />
        </TitleCanvas>
      ) : null}
      {g >= 440 && g < 452 ? (
        <AbsoluteFill
          style={{
            background: "#FFD60A",
            opacity: 0.35 * (1 - ramp(g, 440, 448, [0, 1], EASE_OUT)),
            mixBlendMode: "screen",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
