import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp } from "../../anim";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  NUBI_AT_SWITCH,
  REACH_YAW,
  STUDIO_BG,
  STUDIO_NUBI_PALETTE,
  StudioStage,
  leverAngle,
  leverHandle,
  raiseToReach,
  studioPower,
} from "../../three/ia/Studio";
import { GIRO } from "../beats";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot "giroSwitch" (GIRO.PREGUNTA → GIRO.TODO − 6): "La pregunta es cuánto nos ayudan… y cuánto
// nos acostumbramos a que lo hagan todo." Nubi, thoughtful, its fin on the lever (OFF, red), looks
// at the camera; around PREGUNTA+10 it pushes the lever back UP: the green lamp, and the studio
// powers back up in a cascade (room, lamps, ring light, monitor). It lets go, turns to the camera
// and finishes the thought with a little head tilt.

const FOV = 38;
const MID: Vec3 = [1.0, 1.05, -0.6];
const C0: Cam = aim([2.1, 1.55, 7.6], FOV, MID, 520, 920, 10);
const C1: Cam = aim([1.9, 1.5, 7.0], FOV, MID, 520, 920, 10);

export const GiroSwitchShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.giroSwitch.from;
  const t = g / 30;
  const { PREGUNTA, TODO } = GIRO;
  const UP = PREGUNTA + 10;
  const END = TODO - 6;

  const push = ramp(g, PREGUNTA, END, [0, 1], Easing.inOut(Easing.sin));
  const cam: Cam = { position: lerp3(C0.position, C1.position, push), target: lerp3(C0.target, C1.target, push), fov: FOV };

  const lever = ramp(g, UP - 1, UP + 4, [0, 1], Easing.out(Easing.quad));
  const power = studioPower(g, undefined, UP + 3);

  const at = NUBI_AT_SWITCH;
  const toCam = Math.atan2(cam.position[0] - at[0], cam.position[2] - at[2]);
  const crouch = ramp(g, UP - 7, UP - 2, [0, 1], EASE_OUT) * (1 - ramp(g, UP - 2, UP, [0, 1], Easing.linear));
  const leap = Math.sin(Math.PI * ramp(g, UP - 2, UP + 8, [0, 1], Easing.linear));
  const lit = ramp(g, UP + 6, UP + 20, [0, 1], EASE_OUT);
  const turn = ramp(g, UP + 16, UP + 34, [0, 1], EASE_IN_OUT);
  const tilt = ramp(g, UP + 40, UP + 70, [0, 1], EASE_IN_OUT);
  const base: NubiPose = {
    yaw: REACH_YAW * (1 - turn) + (toCam - 0.1) * turn,
    roll: 0.09 * tilt,
    pitch: -0.04,
    hop: 2.4 * leap,
    squash: 1 - 0.12 * crouch + 0.08 * leap + 0.01 * Math.sin(t * 2),
    // Eyes on the camera (sideways while turned to the lever), wider when the lights come on.
    lookX: (toCam - REACH_YAW) * 0.9 * (1 - turn) + 0.05 * turn,
    lookY: -0.1 + 0.2 * lit - 0.1 * tilt,
    eyeScale: 0.95 + 0.15 * lit * (1 - tilt),
    blink: g > PREGUNTA + 2 && g < PREGUNTA + 6 ? 1 : 0,
    finL: -0.05 + 0.1 * tilt,
    finR: 0,
  };
  const pose = nubiTalk(g, base, 0.55);
  const grip = 1 - ramp(g, UP + 12, UP + 22, [0, 1], EASE_IN_OUT);
  if (grip > 0) {
    const handle = leverHandle(leverAngle(lever));
    const reach = raiseToReach(handle[1], at[1], pose.yaw ?? 0, pose.squash ?? 1, pose.hop ?? 0);
    pose.finR = (pose.finR ?? 0) * (1 - grip) + reach * grip;
    pose.roll = (pose.roll ?? 0) * (1 - grip);
    pose.pitch = (pose.pitch ?? 0) * (1 - grip);
  }

  return (
    <AbsoluteFill style={{ background: STUDIO_BG }}>
      <StudioStage cam={cam} t={t} power={power} lever={lever} warm={1 - lit}>
        <Nubi size={2} position={at} pose={pose} palette={STUDIO_NUBI_PALETTE} shadowOpacity={0.4} />
      </StudioStage>
    </AbsoluteFill>
  );
};
