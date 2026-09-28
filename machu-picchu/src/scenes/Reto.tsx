import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ramp, rand, windowIn } from "../anim";
import { Card, Flash, Lightning, Rain } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { talkPose } from "../talk";
import { SCENES, lineEnd, lineStart, wordAt } from "../timeline";
import { Clawd } from "../three/Clawd";
import { Vec3, lerp3 } from "../three/CameraRig";
import { Umbrella } from "../three/Props";
import { LOOKS } from "../three/Text3D";
import { Atmosphere, World } from "../three/World";
import { Shake, Stage } from "./common";
import { CLAWD_SIZE, CLAWD_SPOT } from "./places";

// The challenge: huge rainfall and earthquakes. "¡Parecía imposible!"

const RainCloud: React.FC = () => (
  <svg width={92} height={80} viewBox="0 0 100 86">
    <path
      d="M22 56 a16 16 0 0 1 4-31 a22 22 0 0 1 41-6 a17 17 0 0 1 16 27 a13 13 0 0 1-8 10 Z"
      fill="#fff"
    />
    {[28, 46, 64].map((x) => (
      <path
        key={x}
        d={`M${x} 66 l-5 14`}
        stroke="#4FE3FF"
        strokeWidth={7}
        strokeLinecap="round"
      />
    ))}
  </svg>
);

export const Reto: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SCENES.reto;
  const g = frame + S.from;
  const END = S.from + S.duration;
  const BOLTS = [S.from + 10, wordAt("L06", 7)];
  const QUAKE = wordAt("L07", 3);
  const QUAKE_END = lineStart("L08") - 6;
  const TITLE = wordAt("L08", 0) + 3;
  const flash = BOLTS.reduce((m, b) => {
    const d = g - b;
    if (d < 0 || d > 6) return m;
    return Math.max(m, d < 2 ? 1 : d < 4 ? 0.35 : 0.8 * (1 - (d - 4) / 2));
  }, 0);
  const quake = windowIn(g, QUAKE, QUAKE_END, 5);
  const qx = quake * (Math.sin(g * 2.7) * 0.28 + (rand(g) - 0.5) * 0.2);
  const qy = quake * Math.cos(g * 3.3) * 0.16;
  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const base = lerp3([9.8, 1.5, 31.5], [8.6, 1.35, 28.8], u);
  const position: Vec3 = [base[0] + qx, base[1] + qy, base[2]];
  const target: Vec3 = [4.6 + qx * 0.5, 3.2 + qy, 15.2];
  const scared = ramp(g, QUAKE - 4, QUAKE + 2) * (1 - ramp(g, TITLE + 4, TITLE + 18));
  const shiver = (rand(g * 1.7) - 0.5) * 0.05 * (1 - quake);
  const bounce = quake * Math.abs(Math.sin(g * 0.9)) * 0.45;
  const umbrellaTilt =
    0.51 + Math.sin(g * 0.13) * 0.04 + quake * Math.sin(g * 1.9) * 0.12;
  return (
    <AbsoluteFill>
      <Shake
        frame={g}
        impacts={[
          { at: QUAKE, amp: 16, dur: QUAKE_END - QUAKE },
          { at: BOLTS[0], amp: 6 },
          { at: BOLTS[1], amp: 6 },
          { at: TITLE, amp: 14 },
        ]}
      >
        <Stage cam={{ position, target, fov: 40 }}>
          <Atmosphere
            variant="storm"
            flash={flash}
            sunPos={[60, 90, 90]}
            fogNear={40}
            fogFar={300}
          />
          <World frame={g} variant="storm" flash={flash} />
          <group
            position={[
              CLAWD_SPOT[0] + shiver,
              CLAWD_SPOT[1] + bounce,
              CLAWD_SPOT[2],
            ]}
            rotation={[0, 0.4, quake * Math.sin(g * 1.3) * 0.08]}
          >
            <Clawd
              size={CLAWD_SIZE}
              pose={{
                ...talkPose(g, {
                  hat: 1,
                  squash: 1 - bounce * 0.1,
                  armL: scared * 0.9,
                  eyeScale: 0.72 + scared * 0.62,
                  lookY: 0.5 - scared * 0.2,
                  lookX: -0.2,
                }),
                // The right nub holds the umbrella still.
                armR: 1.0,
              }}
            >
              <group
                position={[4.83, 13.6, 0.4]}
                rotation={[0.08, 0, umbrellaTilt]}
                scale={1.25}
              >
                <Umbrella />
              </group>
            </Clawd>
          </group>
        </Stage>
        <Rain frame={g} opacity={0.5} count={170} />
        {BOLTS.map((b, i) => (
          <Lightning
            key={b}
            frame={g}
            at={b}
            x={i === 0 ? 1320 : 520}
            seed={i + 3}
          />
        ))}
        <Card
          frame={g}
          at={wordAt("L06", 9) - 2}
          out={lineEnd("L06") + 8}
          x={1400}
          y={250}
          icon={<RainCloud />}
          title="2.000 mm"
          sub="DE LLUVIA AL AÑO"
          rotate={-3}
          gradient="linear-gradient(135deg, #1E6BFF 0%, #27C4F5 100%)"
        />
        {g >= TITLE - 12 ? (
          <TitleCanvas>
            <TitleSlam
              frame={g}
              at={TITLE}
              out={END - 14}
              exit="zoom"
              lines={[
                { text: "¡PARECÍA", size: 1.45, look: LOOKS.red, y: 1.7 },
                {
                  text: "IMPOSIBLE!",
                  size: 2.1,
                  look: LOOKS.red,
                  y: -0.3,
                  delay: Math.max(6, wordAt("L08", 1) - wordAt("L08", 0)),
                },
              ]}
            />
          </TitleCanvas>
        ) : null}
      </Shake>
      <Flash frame={g} at={BOLTS[0]} dur={6} color="#DDE6FF" peak={0.55} />
      <Flash frame={g} at={BOLTS[1]} dur={6} color="#DDE6FF" peak={0.55} />
    </AbsoluteFill>
  );
};
