import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, ramp, windowIn } from "../anim";
import { Card, Flash } from "../overlay/Graphics";
import { talkPose } from "../talk";
import { Clawd, ClawdPose } from "../three/Clawd";
import { Vec3, lerp3 } from "../three/CameraRig";
import { DustPuff } from "../three/Effects3D";
import { Atmosphere, World } from "../three/World";
import { SCENES, wordAt } from "../timeline";
import { SMOOTH, Shake, Stage } from "./common";
import { CLAWD_SIZE, CLAWD_SPOT, CLAWD_YAW, INTRO_CAM_END, INTRO_CAM_START } from "./places";

// Clawd jumps onto the citadel, gets its chullo and says hi:
// "¡Hola! Soy Clawd. Y hoy te voy a contar cómo se construyó... ¡Machu Picchu!"

export const clawdIntroPose = (g: number): { pose: ClawdPose; pos: Vec3; yaw: number } => {
  const F = SCENES.intro.from;
  const LAND = F + 14;
  const HAT = F + 28;
  const t = ramp(g, F, LAND, [0, 1], (x) => x);
  const inAir = g < LAND;
  const off: Vec3 = [4.5 * (1 - t), -3.4 * (1 - t) + 3.4 * 4 * t * (1 - t), 1.6 * (1 - t)];
  const pos: Vec3 = [CLAWD_SPOT[0] + off[0], CLAWD_SPOT[1] + off[1], CLAWD_SPOT[2] + off[2]];
  const dl = g - LAND;
  let squash = inAir ? 1.1 : 1 - 0.26 * Math.exp(-dl / 4) * Math.cos(dl * 0.6);
  const dh = g - (HAT + 7);
  if (dh >= 0) squash -= 0.1 * Math.exp(-dh / 4) * Math.cos(dh * 0.7);
  const waveK = windowIn(g, wordAt("L02", 0) - 6, wordAt("L02", 3) + 4, 8);
  const point = windowIn(g, wordAt("L02", 12) - 4, F + SCENES.intro.duration + 60, 8);
  let hatDrop = 0;
  if (g < HAT + 7) hatDrop = 34 * (1 - Math.pow(Math.max(0, g - HAT) / 7, 2));
  else hatDrop = 2.4 * Math.abs(Math.sin((g - HAT - 7) * 0.4)) * Math.exp(-(g - HAT - 7) / 5);
  const base: ClawdPose = {
    squash,
    armL: inAir ? 1.1 : point * 0.55,
    armR: inAir ? 1.1 : waveK * (1.25 + 0.3 * Math.sin((g - F) * 0.5)),
    reachL: point * 1.4,
    eyeScale: inAir ? 1.25 : 1,
    hat: g >= HAT ? 1 : 0,
    hatDrop,
    roll: inAir ? -0.25 * (1 - t) : 0,
  };
  return {
    pos,
    yaw: CLAWD_YAW + point * 0.35,
    pose: inAir ? base : talkPose(g, base, 1 - waveK * 0.5),
  };
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SCENES.intro;
  const g = frame + S.from;
  const LAND = S.from + 14;
  const u = ramp(g, S.from, S.from + S.duration, [0, 1], SMOOTH);
  const position = lerp3(INTRO_CAM_START.position, INTRO_CAM_END.position, u);
  const target = lerp3(INTRO_CAM_START.target, INTRO_CAM_END.target, u);
  const c = clawdIntroPose(g);
  const tagAt = wordAt("L02", 2);
  const tagIn = ramp(g, tagAt, tagAt + 10, [0, 1], EASE_OUT);
  return (
    <AbsoluteFill>
      <Shake
        frame={g}
        impacts={[
          { at: S.from, amp: 16, dur: 16 },
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
          at={tagAt}
          out={wordAt("L02", 9)}
          x={930}
          y={250}
          title="CLAWD"
          sub="TU GUÍA DE HOY"
          rotate={-4}
          gradient="linear-gradient(135deg, #FF8A3D 0%, #D97757 55%, #B8583A 100%)"
          scale={0.9 + tagIn * 0.1}
        />
      </Shake>
      <Flash frame={g} at={S.from} dur={12} peak={0.8} />
    </AbsoluteFill>
  );
};
