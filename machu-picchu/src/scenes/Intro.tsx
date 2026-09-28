import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, ramp, windowIn, wordPulse } from "../anim";
import { Card, Flash } from "../overlay/Graphics";
import { WORD_FRAMES } from "../script";
import { SCENES } from "../theme";
import { Clawd, ClawdPose } from "../three/Clawd";
import { Vec3, lerp3 } from "../three/CameraRig";
import { DustPuff } from "../three/Effects3D";
import { Atmosphere, World } from "../three/World";
import { SMOOTH, Shake, Stage } from "./common";
import {
  CLAWD_SIZE,
  CLAWD_SPOT,
  CLAWD_YAW,
  INTRO_CAM_END,
  INTRO_CAM_START,
} from "./places";

// 6-10 s: Clawd jumps onto the citadel, gets its chullo and says hi.

const LAND = 192;
const HAT = 214;

export const clawdIntroPose = (
  g: number,
): { pose: ClawdPose; pos: Vec3; yaw: number } => {
  const t = ramp(g, 180, LAND, [0, 1], (x) => x);
  const inAir = g < LAND;
  const off: Vec3 = [
    4.5 * (1 - t),
    -3.4 * (1 - t) + 3.4 * 4 * t * (1 - t),
    1.6 * (1 - t),
  ];
  const pos: Vec3 = [
    CLAWD_SPOT[0] + off[0],
    CLAWD_SPOT[1] + off[1],
    CLAWD_SPOT[2] + off[2],
  ];
  const dl = g - LAND;
  let squash = inAir ? 1.12 : 1 - 0.3 * Math.exp(-dl / 3) * Math.cos(dl * 0.75);
  const dh = g - (HAT + 6);
  if (dh >= 0) squash -= 0.12 * Math.exp(-dh / 3) * Math.cos(dh * 0.8);
  const talk = wordPulse(g, WORD_FRAMES);
  squash *= 1 - 0.06 * talk + 0.015 * Math.sin(g * 0.2);
  const waveK = windowIn(g, 196, 232, 6);
  const point = windowIn(g, 284, 330, 5);
  const armR = inAir
    ? 1.1
    : waveK * (1.25 + 0.3 * Math.sin((g - 196) * 0.7)) +
      talk * 0.3 * (1 - waveK);
  const armL = inAir
    ? 1.1
    : 0.04 * Math.sin(g * 0.1) + point * 0.55 + talk * 0.2 * (1 - point);
  const blink = [250, 282].some((b) => g >= b && g < b + 3) ? 1 : 0;
  let hatDrop = 0;
  if (g < HAT + 6) hatDrop = 34 * (1 - Math.pow(Math.max(0, g - HAT) / 6, 2));
  else
    hatDrop =
      2.6 *
      Math.abs(Math.sin((g - HAT - 6) * 0.45)) *
      Math.exp(-(g - HAT - 6) / 4);
  return {
    pos,
    yaw: CLAWD_YAW + point * 0.35,
    pose: {
      squash,
      hop: talk * 0.6,
      armL,
      armR,
      reachL: point * 1.4,
      blink,
      eyeScale: inAir ? 1.25 : 1,
      hat: g >= HAT ? 1 : 0,
      hatDrop,
      roll: inAir ? -0.25 * (1 - t) : 0,
    },
  };
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SCENES.intro.from;
  const u = ramp(g, 180, 300, [0, 1], SMOOTH);
  const position = lerp3(INTRO_CAM_START.position, INTRO_CAM_END.position, u);
  const target = lerp3(INTRO_CAM_START.target, INTRO_CAM_END.target, u);
  const c = clawdIntroPose(g);
  const tagIn = ramp(g, 209, 216, [0, 1], EASE_OUT);
  return (
    <AbsoluteFill>
      <Shake
        frame={g}
        impacts={[
          { at: 180, amp: 18, dur: 14 },
          { at: LAND, amp: 10 },
        ]}
      >
        <Stage cam={{ position, target, fov: 38 }}>
          <Atmosphere variant="day" sunPos={[60, 80, 90]} />
          <World frame={g} />
          <group position={c.pos} rotation={[0, c.yaw, 0]}>
            <Clawd size={CLAWD_SIZE} pose={c.pose} shadowOpacity={0.4} />
          </group>
          <DustPuff frame={g} at={LAND} position={CLAWD_SPOT} radius={1.5} />
        </Stage>
        <Card
          frame={g}
          at={209}
          out={252}
          x={930}
          y={250}
          title="CLAWD"
          sub="TU GUÍA DE HOY"
          rotate={-4}
          gradient="linear-gradient(135deg, #FF8A3D 0%, #D97757 55%, #B8583A 100%)"
          scale={0.9 + tagIn * 0.1}
        />
      </Shake>
      <Flash frame={g} at={180} dur={9} />
    </AbsoluteFill>
  );
};
