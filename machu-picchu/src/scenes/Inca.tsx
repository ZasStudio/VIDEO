import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, pop, ramp } from "../anim";
import { Burst, Card } from "../overlay/Graphics";
import { TitleSlam } from "../overlay/TitleOverlay";
import { talkPose } from "../talk";
import { SCENES, wordAt } from "../timeline";
import { Clawd } from "../three/Clawd";
import { Twinkles } from "../three/Effects3D";
import { IntiSun } from "../three/Props";
import { LOOKS } from "../three/Text3D";
import { Stage } from "./common";

// "...por orden de Pachacútec, el gran emperador inca."

const Crown: React.FC = () => (
  <svg width={80} height={70} viewBox="0 0 100 86">
    <path
      d="M8 70 L14 22 L34 44 L50 10 L66 44 L86 22 L92 70 Z"
      fill="#FFD60A"
      stroke="#7A3B00"
      strokeWidth={6}
      strokeLinejoin="round"
    />
    <rect
      x={8}
      y={68}
      width={84}
      height={14}
      rx={4}
      fill="#FF9500"
      stroke="#7A3B00"
      strokeWidth={6}
    />
    <circle cx={50} cy={50} r={7} fill="#FF3D5A" />
  </svg>
);

export const Inca: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SCENES.inca;
  const g = frame + S.from;
  const END = S.from + S.duration;
  const NAME = wordAt("L05", 3) + 3;
  const sunIn = pop(g, S.from + 4, { damping: 14, stiffness: 100 });
  const clawdIn = pop(g, S.from + 12, { damping: 13, stiffness: 120 });
  const point = ramp(g, wordAt("L05", 2) - 6, wordAt("L05", 2) + 6, [0, 1], EASE_OUT);
  const rays = g * 0.25;
  const camZ = 20 - ramp(g, S.from, END, [0, 1.6], (x) => x);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 38% 42%, #FFD27A 0%, #FF8A3D 16%, #C2185B 42%, #4A148C 72%, #1A0638 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${rays}deg at 38% 42%, rgba(255,240,200,0.16) 0deg 9deg, rgba(255,240,200,0) 9deg 22deg)`,
        }}
      />
      <Stage cam={{ position: [0, 0, camZ], target: [0, 0, 0], fov: 30 }}>
        <hemisphereLight args={["#FFF1E0", "#6A1B9A", 1.5]} />
        <directionalLight
          position={[-6, 8, 12]}
          intensity={2.4}
          color="#FFF4DD"
        />
        <directionalLight
          position={[8, -2, 6]}
          intensity={0.9}
          color="#FF7AC8"
        />
        <group
          position={[-3.3, 1.0, 0]}
          scale={1.3 * sunIn}
          rotation={[0.12, 0.35 * Math.sin(g * 0.04), 0]}
        >
          <IntiSun spin={g * 0.02} />
        </group>
        <Twinkles
          frame={g}
          at={S.from + 12}
          position={[-3.3, 1.0, 1]}
          radius={4}
          count={14}
        />
        <Twinkles
          frame={g}
          at={NAME}
          position={[-3.3, 1.0, 1]}
          radius={4.5}
          count={16}
        />
        <group
          position={[5.5, -2.1 + (1 - clawdIn) * -7, 0]}
          rotation={[0.12, -0.45, 0]}
        >
          <Clawd
            size={3.0}
            shadow={false}
            pose={talkPose(g, {
              hat: 1,
              armL: point * 0.9,
              reachL: point * 1.6,
              lookX: -0.8,
              lookY: 0.3,
            })}
          />
        </group>
        <TitleSlam
          frame={g}
          at={NAME}
          out={END - 14}
          exit="zoom"
          lines={[
            {
              text: "PACHACÚTEC",
              size: 1.45,
              look: LOOKS.gold,
              y: -2.3,
              x: -0.6,
            },
          ]}
        />
      </Stage>
      <Burst frame={g} at={NAME} x={900} y={790} color="#FFD60A" size={620} />
      <Card
        frame={g}
        at={wordAt("L05", 4) - 2}
        out={END - 14}
        x={1300}
        y={210}
        icon={<Crown />}
        title="EMPERADOR INCA"
        sub="MANDÓ CONSTRUIRLO"
        rotate={3}
        gradient="linear-gradient(135deg, #7B2FF7 0%, #C2185B 100%)"
      />
    </AbsoluteFill>
  );
};
