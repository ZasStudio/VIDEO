import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp } from "../../anim";
import { Shake } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  NUBI_AT_SWITCH,
  NUBI_SPOT,
  REACH_YAW,
  STUDIO_BG,
  STUDIO_NUBI_PALETTE,
  StudioStage,
  leverAngle,
  leverHandle,
  raiseToReach,
  studioPower,
} from "../../three/ia/Studio";
import { GANCHO } from "../beats";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot "nubi" (GANCHO.NUBI → GANCHO.END): Nubi in its colourful studio talks to the camera,
// mischievous, the big IA switch on the wall beside it (ON, green). On "Y eso apenas es el
// comienzo" it shuffles to the switch and takes the lever; at SWITCH it hops and yanks it down:
// clunk, sparks, the red lamp, the studio powers down in a cascade (monitor, ring light, lamps,
// room), a small shake. Then its eyes dart around in the dim blue light.

const FOV = 40;
/** Composition: Nubi left of centre, the switch on the right; feet just above the captions. */
const FEET: Vec3 = [0.95, 0, -0.3];
const C0: Cam = aim([3.6, 1.7, 12.2], FOV, FEET, 520, 1225, 12);
const C1: Cam = aim([3.5, 1.6, 11.0], FOV, FEET, 520, 1225, 12);

export const NubiShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.nubi.from;
  const t = g / 30;
  const { NUBI, EXTRANO, COMIENZO, SWITCH: SW, END } = GANCHO;

  const push = ramp(g, NUBI, END, [0, 1], Easing.inOut(Easing.sin));
  const cam: Cam = { position: lerp3(C0.position, C1.position, push), target: lerp3(C0.target, C1.target, push), fov: FOV };

  // ---- Lever: ON until the yank, then slammed down.
  const lever = 1 - ramp(g, SW - 2, SW + 1, [0, 1], Easing.in(Easing.quad));
  const power = studioPower(g, SW + 1);
  const sparks = g >= SW ? (g - SW) / 30 : -1;
  const jolt = g >= SW ? Math.sin((g - SW) * 2.2) * Math.max(0, 1 - (g - SW) / 10) : 0;

  // ---- Nubi: sly talk to camera; shuffle to the switch; the yank; eyes dart around in the dark.
  const go = ramp(g, COMIENZO - 2, COMIENZO + 14, [0, 1], EASE_IN_OUT);
  const ph = (g - COMIENZO) * 0.9;
  const shuffle = go > 0 && go < 1 ? Math.abs(Math.sin(ph)) : 0;
  const at = lerp3(NUBI_SPOT, NUBI_AT_SWITCH, go);
  const aww = Math.sin(Math.PI * ramp(g, EXTRANO - 2, EXTRANO + 22, [0, 1], Easing.linear));
  const crouch = ramp(g, SW - 9, SW - 3, [0, 1], EASE_OUT) * (1 - ramp(g, SW - 3, SW - 1, [0, 1], Easing.linear));
  const leap = Math.sin(Math.PI * ramp(g, SW - 3, SW + 1, [0, 1], Easing.linear));
  const land = ramp(g, SW, SW + 2, [0, 1], Easing.linear) * (1 - ramp(g, SW + 2, SW + 12, [0, 1], EASE_OUT));
  const dark = ramp(g, SW + 6, SW + 12, [0, 1], EASE_OUT);
  // Eyes dart around: left, right, up.
  const dart = g < SW + 10 ? 0 : Math.round(Math.sin((g - SW - 10) * 0.35) * 2) / 2;
  const base: NubiPose = {
    yaw: 0.25 * (1 - go) + REACH_YAW * go * (1 - 0.6 * dark) + 0.08 * Math.sin(t * 1.3) * (1 - go),
    roll: 0.07 * (1 - go) * Math.sin(t * 2.1) - 0.05 * aww,
    pitch: 0.06 * (1 - go),
    hop: 0.8 * shuffle + 2.2 * leap,
    squash: 1 - 0.12 * crouch + 0.08 * leap - 0.16 * land,
    eyeScale: (0.84 + 0.25 * aww) * (1 - dark) + 1.25 * dark,
    lookX: -0.35 * go * (1 - dark) + 0.75 * dart * dark,
    lookY: 0.1 + 0.35 * dark * (dart === 0 ? 1 : 0.2),
    finL: 0.15 + 0.6 * aww - 0.1 * go + 0.3 * dark,
    finR: 0.15 + 0.6 * aww,
    wiggle: 0.6 * shuffle + 0.4 * dark,
    wigglePhase: g * 0.5,
  };
  const pose = nubiTalk(g, base, 1 - 0.5 * go);
  // The screen-right fin on the lever's handle: reach for it, hold it, follow it down, let go.
  const grip = ramp(g, COMIENZO + 4, COMIENZO + 16, [0, 1], EASE_IN_OUT) * (1 - ramp(g, SW + 8, SW + 16, [0, 1], EASE_IN_OUT));
  if (grip > 0) {
    const yaw = pose.yaw ?? 0;
    const handle = leverHandle(leverAngle(lever));
    const reach = raiseToReach(handle[1], at[1], yaw, pose.squash ?? 1, pose.hop ?? 0);
    pose.finR = (pose.finR ?? 0) * (1 - grip) + reach * grip;
    pose.roll = (pose.roll ?? 0) * (1 - grip) - 0.03 * grip;
    pose.pitch = (pose.pitch ?? 0) * (1 - grip);
  }
  if (dark > 0) pose.blink = Math.max(pose.blink ?? 0, 0);

  return (
    <AbsoluteFill style={{ background: STUDIO_BG }}>
      <Shake frame={g} impacts={[{ at: SW, amp: 26, dur: 14 }]}>
        <AbsoluteFill>
          <StudioStage cam={cam} t={t} power={power} lever={lever} sparks={sparks} jolt={jolt}>
            <Nubi size={2} position={at} pose={pose} palette={STUDIO_NUBI_PALETTE} shadowOpacity={0.4} />
          </StudioStage>
        </AbsoluteFill>
      </Shake>
    </AbsoluteFill>
  );
};
