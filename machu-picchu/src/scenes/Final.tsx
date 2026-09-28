import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, pop, ramp, windowIn } from "../anim";
import { Burst, Card, Confetti, Flash } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { talkPose } from "../talk";
import { FONT } from "../theme";
import { SCENES, wordAt } from "../timeline";
import { Clawd } from "../three/Clawd";
import { Vec3 } from "../three/CameraRig";
import { Twinkles } from "../three/Effects3D";
import { LOOKS } from "../three/Text3D";
import { Atmosphere, World } from "../three/World";
import { SMOOTH, Shake, Stage, pathCam } from "./common";
import { CLAWD_SIZE, CLAWD_SPOT } from "./places";

// Golden hour. "Más de 500 años después... ¡Machu Picchu sigue en pie!" The word "sigue"
// sits on a bar line (see timeline.ts), where the music hits.

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
  const S = SCENES.final;
  const g = frame + S.from;
  const END = S.from + S.duration;
  // Cues from the narration.
  const YEARS = wordAt("L22", 2);
  const HIT = wordAt("L22", 7);
  const BADGE = wordAt("L23", 6);
  const BYE = wordAt("L23", 9) - 4;
  const u = ramp(g, S.from, HIT + 6, [0, 1], SMOOTH);
  const drift = ramp(g, HIT + 6, END, [0, 1], (x) => x);
  const p = camPos(u);
  const position: Vec3 = [
    p[0] - drift * 0.5,
    p[1] + drift * 0.15,
    p[2] - drift * 1.2,
  ];
  const target = camTarget(u);
  const wave = windowIn(g, BYE, END + 20, 8);
  const JUMP = 18;
  const inJump = g >= HIT && g < HIT + JUMP;
  const jump = inJump ? Math.sin(((g - HIT) / JUMP) * Math.PI) * 2.4 : 0;
  const badge = pop(g, BADGE, { damping: 12, stiffness: 150 });
  return (
    <AbsoluteFill>
      <Shake
        frame={g}
        impacts={[
          { at: S.from, amp: 12, dur: 14 },
          { at: HIT, amp: 22, dur: 18 },
        ]}
      >
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
                pose={
                  inJump
                    ? { hat: 1, squash: 1.1, armL: 1.2, armR: 1.2, eyeScale: 1.25 }
                    : talkPose(
                        g,
                        {
                          hat: 1,
                          armR: wave * (1.25 + 0.3 * Math.sin((g - BYE) * 0.45)),
                        },
                        1 - wave * 0.5,
                      )
                }
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
              out={END + 30}
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
        <Card
          frame={g}
          at={YEARS}
          out={HIT - 16}
          x={960}
          y={250}
          title="+500 AÑOS"
          sub="DE HISTORIA"
          rotate={-3}
          gradient="linear-gradient(135deg, #FF8A3D 0%, #D6336C 100%)"
        />
        {g >= BADGE ? (
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
      <Flash frame={g} at={S.from} dur={10} peak={0.8} />
      {/* Warm grade that intensifies at the end. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,140,60,0) 40%, rgba(255,120,60,0.18) 100%)",
          opacity: ramp(g, S.from, S.from + 60, [0, 1], EASE_OUT),
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
