import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, pop, ramp, windowIn, wordPulse } from "../anim";
import { Burst, Confetti, Flash } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { WORD_FRAMES } from "../script";
import { FONT, SCENES } from "../theme";
import { Clawd } from "../three/Clawd";
import { Vec3 } from "../three/CameraRig";
import { Twinkles } from "../three/Effects3D";
import { LOOKS } from "../three/Text3D";
import { Atmosphere, World } from "../three/World";
import { SMOOTH, Shake, Stage, pathCam } from "./common";
import { CLAWD_SIZE, CLAWD_SPOT } from "./places";

// 56-60 s: golden hour. "Más de 500 años después... ¡sigue en pie!"

const HIT = 1740;

const camPos = pathCam([
  [34, 24, 78],
  [22, 12, 56],
  [14.5, 5.6, 42.5],
  [13.6, 5.2, 40.5],
]);
const camTarget = pathCam([
  [-5, 1, -26],
  [-3, 2.5, -12],
  [-0.6, 4.6, 0],
  [-0.6, 4.7, 0],
]);

const Star: React.FC<{ size?: number }> = ({ size = 46 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path
      d="M50 6 L62 38 L96 38 L68 58 L79 92 L50 71 L21 92 L32 58 L4 38 L38 38 Z"
      fill="#FFD60A"
      stroke="#7A3B00"
      strokeWidth={6}
      strokeLinejoin="round"
    />
  </svg>
);

export const Final: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SCENES.final.from;
  const u = ramp(g, 1680, HIT + 6, [0, 1], SMOOTH);
  const drift = ramp(g, HIT + 6, 1800, [0, 1], (x) => x);
  const p = camPos(u);
  const position: Vec3 = [
    p[0] - drift * 0.5,
    p[1] + drift * 0.15,
    p[2] - drift * 1.2,
  ];
  const target = camTarget(u);
  const talk = wordPulse(g, WORD_FRAMES);
  const wave = windowIn(g, HIT + 2, 1800, 5);
  const jump =
    g >= HIT && g < HIT + 14 ? Math.sin(((g - HIT) / 14) * Math.PI) * 2.4 : 0;
  const badge = pop(g, 1756, { damping: 10, stiffness: 170 });
  return (
    <AbsoluteFill>
      <Shake frame={g} impacts={[{ at: HIT, amp: 22, dur: 16 }]}>
        <AbsoluteFill
          style={{ filter: "saturate(1.25) contrast(1.06) brightness(1.08)" }}
        >
          <Stage cam={{ position, target, fov: 40 }}>
            <Atmosphere
              variant="golden"
              sunPos={[-120, 55, 70]}
              fogNear={130}
              fogFar={620}
            />
            <World frame={g} variant="golden" />
            <group
              position={[
                CLAWD_SPOT[0],
                CLAWD_SPOT[1] + jump * 0.45,
                CLAWD_SPOT[2],
              ]}
              rotation={[0, 0.5, 0]}
            >
              <Clawd
                size={CLAWD_SIZE}
                pose={{
                  hat: 1,
                  squash: g >= HIT && g < HIT + 14 ? 1.1 : 1 - 0.06 * talk,
                  hop: talk * 0.5,
                  armR:
                    wave * (1.25 + 0.3 * Math.sin(g * 0.7)) +
                    talk * 0.3 * (1 - wave),
                  armL: g >= HIT && g < HIT + 14 ? 1.2 : 0.15 * talk,
                  eyeScale: g >= HIT && g < HIT + 10 ? 1.25 : 1,
                  blink: [1712, 1784].some((b) => g >= b && g < b + 3) ? 1 : 0,
                }}
              />
            </group>
            <Twinkles
              frame={g}
              at={HIT}
              position={[CLAWD_SPOT[0], 3, CLAWD_SPOT[2]]}
              radius={2.6}
              count={14}
              color="#FFF3A0"
            />
          </Stage>
        </AbsoluteFill>
        <Burst frame={g} at={HIT} x={960} y={300} color="#FFD60A" size={900} />
        {g >= HIT - 8 ? (
          <TitleCanvas>
            <TitleSlam
              frame={g}
              at={HIT}
              out={1830}
              lines={[
                {
                  text: "¡SIGUE EN PIE!",
                  size: 1.75,
                  look: LOOKS.gold,
                  y: 3.05,
                },
              ]}
            />
          </TitleCanvas>
        ) : null}
        {g >= 1756 ? (
          <div
            style={{
              position: "absolute",
              left: 960,
              top: 452,
              transform: `translate(-50%, -50%) scale(${badge}) rotate(${(1 - badge) * -12 - 2}deg)`,
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "14px 34px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #7B2FF7 0%, #FF3D7F 100%)",
              border: "6px solid #fff",
              boxShadow:
                "0 10px 0 rgba(0,0,0,0.3), 0 20px 40px rgba(0,0,0,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            <Star />
            <div
              style={{
                fontFamily: FONT.title,
                fontSize: 50,
                color: "#fff",
                paddingTop: 6,
                textShadow: "0 4px 0 rgba(0,0,0,0.3)",
              }}
            >
              MARAVILLA DEL MUNDO
            </div>
            <Star />
          </div>
        ) : null}
        <Confetti frame={g} at={HIT} count={140} />
      </Shake>
      <Flash frame={g} at={HIT} dur={8} peak={0.7} />
      <Flash frame={g} at={1680} dur={7} peak={0.8} />
      {/* Warm grade that intensifies at the end. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,140,60,0) 40%, rgba(255,120,60,0.18) 100%)",
          opacity: ramp(g, 1680, 1720, [0, 1], EASE_OUT),
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
