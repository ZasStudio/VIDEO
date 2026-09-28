import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, pop, ramp } from "../anim";
import { Burst } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { Vec3 } from "../three/CameraRig";
import { CementBag, IronHammer, NoSign, Wheel } from "../three/Props";
import { LOOKS, measureText3D } from "../three/Text3D";
import { Atmosphere, CloudSpot, World, skyGradient } from "../three/World";
import { SCENES, wordAt } from "../timeline";
import { SMOOTH, Shake, Stage, pathCam } from "./common";

// Opening: fly out of the clouds towards Machu Picchu while Clawd's voice says
// "Sin ruedas... sin hierro... ¡y sin cemento! ¿Cómo lo hicieron?" and each phrase lands
// as a 3D title on its word.

const CLOUDS: CloudSpot[] = [
  [86, 58, 128, 0.7],
  [62, 44, 112, 0.6],
  [40, 30, 96, 0.5],
  [-30, 22, -78, 1.3],
  [22, 30, -95, 1.6],
  [-55, 8, -30, 1.1],
  [48, 4, -20, 1.2],
  [60, 14, -120, 2.2],
  [-80, 26, -140, 2.4],
  [90, 34, -60, 2.0],
  [-110, 40, -40, 2.6],
];

const camPos = pathCam([
  [88, 72, 152],
  [64, 44, 108],
  [38, 23, 74],
  [26, 16, 62],
  [24, 15, 59],
]);
const camTarget = pathCam([
  [10, -6, 10],
  [0, -2, -14],
  [-4, 2, -30],
  [-4, 3, -32],
  [-4, 3, -32],
]);

const ICONS = [Wheel, IronHammer, CementBag];
const WORDS = ["SIN RUEDAS", "SIN HIERRO", "SIN CEMENTO"];

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SCENES.hook;
  // Titles land a few frames after their first word starts.
  const HITS = [wordAt("L01", 0) + 3, wordAt("L01", 2) + 3, wordAt("L01", 5) + 3];
  const Q = wordAt("L01", 7) + 3;
  const OUTS = [HITS[1] - 14, HITS[2] - 14, Q - 14];
  const u = ramp(frame, 0, S.duration - 4, [0, 1], SMOOTH);
  const position: Vec3 = camPos(u);
  const target: Vec3 = camTarget(u);
  const roll = 0.08 * (1 - ramp(frame, 0, 120, [0, 1], EASE_OUT));
  const whiteout = 1 - ramp(frame, 2, 28);

  return (
    <AbsoluteFill style={{ background: skyGradient("day") }}>
      <Shake
        frame={frame}
        impacts={[
          ...HITS.map((at) => ({ at, amp: 12 })),
          { at: Q, amp: 18, dur: 16 },
        ]}
      >
        <Stage cam={{ position, target, fov: 44, roll }}>
          <Atmosphere variant="day" />
          <World frame={frame} cloudSpots={CLOUDS} />
        </Stage>
        <AbsoluteFill style={{ background: "#fff", opacity: whiteout }} />
        {HITS.map((h) => (
          <Burst key={h} frame={frame} at={h} x={960} y={440} color="#FFFFFF" size={520} />
        ))}
        <Burst frame={frame} at={Q} x={960} y={500} color="#FFD60A" size={760} />
        <TitleCanvas>
          {WORDS.map((w, i) => {
            const at = HITS[i];
            const out = OUTS[i];
            if (frame < at - 12 || frame > out + 12) return null;
            const size = 1.45;
            const tw = measureText3D(w, size).width;
            const iconX = -tw / 2 - 1.2;
            const Icon = ICONS[i];
            const ip = pop(frame, at - 4, { damping: 13, stiffness: 150 });
            const iconExit = 1 - ramp(frame, out, out + 10);
            const no = pop(frame, at + 8, { damping: 11, stiffness: 200 });
            return (
              <group key={w} position={[1.3, 1.0, 0]}>
                <TitleSlam frame={frame} at={at} out={out} lines={[{ text: w, size, look: LOOKS.white }]} />
                <group
                  position={[iconX - 0.9, 0.25, 0.5]}
                  scale={Math.max(0.001, ip * iconExit * 1.05)}
                  rotation={[0.1, 0.35, i === 0 ? frame * 0.08 : 0.1]}
                >
                  <Icon />
                </group>
                <group position={[iconX - 0.9, 0.25, 1.2]} scale={Math.max(0.001, iconExit)}>
                  <NoSign k={frame >= at + 8 ? 1 + (1 - no) * 0.4 : 0} />
                </group>
              </group>
            );
          })}
          <TitleSlam
            frame={frame}
            at={Q}
            out={S.duration - 12}
            exit="zoom"
            lines={[
              { text: "¿CÓMO LO", size: 1.55, look: LOOKS.gold, y: 1.95 },
              { text: "HICIERON?", size: 2.2, look: LOOKS.gold, y: -0.15, delay: 6 },
            ]}
          />
        </TitleCanvas>
      </Shake>
    </AbsoluteFill>
  );
};
