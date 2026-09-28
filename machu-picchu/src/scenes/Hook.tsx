import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, pop, ramp } from "../anim";
import { Burst } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { Vec3 } from "../three/CameraRig";
import { CementBag, IronHammer, NoSign, Wheel } from "../three/Props";
import { LOOKS, measureText3D } from "../three/Text3D";
import { Atmosphere, CloudSpot, World, skyGradient } from "../three/World";
import { SMOOTH, Shake, Stage, pathCam } from "./common";

// 0-6 s: fly out of the clouds towards Machu Picchu while "SIN RUEDAS / SIN HIERRO /
// SIN CEMENTO / ¿CÓMO LO HICIERON?" slam in on the beats.

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
const HITS = [30, 60, 90];

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const u = ramp(frame, 0, 178, [0, 1], SMOOTH);
  const position: Vec3 = camPos(u);
  const target: Vec3 = camTarget(u);
  const roll = 0.1 * (1 - ramp(frame, 0, 90, [0, 1], EASE_OUT));
  const whiteout = 1 - ramp(frame, 2, 20);

  return (
    <AbsoluteFill style={{ background: skyGradient("day") }}>
      <Shake
        frame={frame}
        impacts={[
          { at: 30, amp: 12 },
          { at: 60, amp: 12 },
          { at: 90, amp: 12 },
          { at: 120, amp: 20, dur: 16 },
        ]}
      >
        <Stage cam={{ position, target, fov: 44, roll }}>
          <Atmosphere variant="day" />
          <World frame={frame} cloudSpots={CLOUDS} />
        </Stage>
        <AbsoluteFill style={{ background: "#fff", opacity: whiteout }} />
        {HITS.map((h) => (
          <Burst
            key={h}
            frame={frame}
            at={h}
            x={960}
            y={440}
            color="#FFFFFF"
            size={520}
          />
        ))}
        <Burst
          frame={frame}
          at={120}
          x={960}
          y={500}
          color="#FFD60A"
          size={760}
        />
        <TitleCanvas>
          {WORDS.map((w, i) => {
            const at = HITS[i];
            const out = HITS[i] + 23;
            if (frame < at - 6 || frame > out + 8) return null;
            const size = 1.45;
            const tw = measureText3D(w, size).width;
            const iconX = -tw / 2 - 1.2;
            const Icon = ICONS[i];
            const ip = pop(frame, at - 2, { damping: 11, stiffness: 180 });
            const iconExit = 1 - ramp(frame, out, out + 6);
            const no = pop(frame, at + 5, { damping: 9, stiffness: 240 });
            return (
              <group key={w} position={[1.3, 1.0, 0]}>
                <TitleSlam
                  frame={frame}
                  at={at}
                  out={out}
                  lines={[{ text: w, size, look: LOOKS.white }]}
                />
                <group
                  position={[iconX - 0.9, 0.25, 0.5]}
                  scale={Math.max(0.001, ip * iconExit * 1.05)}
                  rotation={[0.1, 0.35, i === 0 ? frame * 0.12 : 0.1]}
                >
                  <Icon />
                </group>
                <group
                  position={[iconX - 0.9, 0.25, 1.2]}
                  scale={Math.max(0.001, iconExit)}
                >
                  <NoSign k={frame >= at + 5 ? 1 + (1 - no) * 0.5 : 0} />
                </group>
              </group>
            );
          })}
          <TitleSlam
            frame={frame}
            at={120}
            out={171}
            exit="zoom"
            lines={[
              { text: "¿CÓMO LO", size: 1.55, look: LOOKS.gold, y: 1.95 },
              {
                text: "HICIERON?",
                size: 2.2,
                look: LOOKS.gold,
                y: -0.15,
                delay: 5,
              },
            ]}
          />
        </TitleCanvas>
      </Shake>
    </AbsoluteFill>
  );
};
