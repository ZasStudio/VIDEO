import React from "react";
import * as THREE from "three";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp } from "../../anim";
import { Upright } from "../../inca/outfit";
import { Stage, pathCam } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { CAN_HOLD, Moth, STUDIO_PLANT_NUBI, Studio, StudioLights, WateringCan, canPoint, studioFinTip } from "../../three/agua/Home";
import { Nubi, NubiPose } from "../../three/Nubi";
import { PROBLEMA } from "../beats";
import { SHOTS } from "../shots";

// Shot 6 "planta" (PROBLEMA.START → PROBLEMA.L06). Nubi tips its watering can over the plant on
// the windowsill: only dust pours out, it shakes the can and a little moth flutters out of it and
// past the camera. On "comienzo" (COMIENZO) the plant wilts and Nubi droops with it.
// The band y 240-500 stays free (the lead's fact card from SED): the moth passes lower down.

const AT = STUDIO_PLANT_NUBI;
const YAW = 0.22;
const FOV = 38;
const CAM_A = aim([AT[0] + 0.6, 2.15, AT[2] + 9.1], FOV, AT, 238, 1262);
const CAM_B = aim([AT[0] + 0.65, 2.05, AT[2] + 8.6], FOV, AT, 232, 1262);

const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** World position of a point of the can (can units) held in finR (Nubi at AT, turned by YAW). */
const canWorld = (raise: number, tilt: number, local: Vec3): Vec3 => {
  const tip = studioFinTip(raise, 1, 0);
  const c = canPoint(local, tilt);
  const v = new THREE.Vector3(
    tip[0] + 0.2 * (CAN_HOLD.position[0] + CAN_HOLD.scale * c[0]),
    tip[1] + 0.2 * (CAN_HOLD.position[1] + CAN_HOLD.scale * c[1]),
    tip[2] + 0.2 * (CAN_HOLD.position[2] + CAN_HOLD.scale * c[2]),
  ).applyAxisAngle(Y_AXIS, YAW);
  return [AT[0] + v.x, AT[1] + v.y, AT[2] + v.z];
};

export const PlantaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.planta.from;
  const { START, SED, COMIENZO, L06 } = PROBLEMA;
  const t = g / 30;
  const DUST = START + 8;
  const MOTH = Math.min(SED - 8, START + 22);
  const PASS = MOTH + 26;

  // The can: tipped over the plant, shaken, lowered when the plant gives up.
  const lower = ramp(g, COMIENZO + 4, COMIENZO + 16, [0, 1], EASE_IN_OUT);
  const shakeCan = clamp01((g - (DUST + 6)) / 2) * (1 - clamp01((g - (MOTH + 2)) / 3));
  const tilt = ramp(g, START, DUST + 2, [0.25, 1], EASE_IN_OUT) * (1 - 0.75 * lower) + 0.12 * Math.sin(g * 2.4) * shakeCan;
  const dust = ramp(g, DUST, DUST + 4, [0, 1], Easing.linear) * (1 - ramp(g, PASS + 6, PASS + 16, [0, 1], Easing.linear));
  const wilt = ramp(g, COMIENZO, COMIENZO + 20, [0, 1], EASE_IN_OUT);

  // Nubi: hopeful, puzzled, follows the moth, then droops with the plant.
  const puzzled = ramp(g, DUST + 3, DUST + 9, [0, 1], EASE_OUT);
  const follow = ramp(g, MOTH, PASS + 4, [0, 1], EASE_IN_OUT);
  const back = ramp(g, PASS + 8, PASS + 18, [0, 1], EASE_IN_OUT);
  const droop = ramp(g, COMIENZO + 2, COMIENZO + 14, [0, 1], EASE_OUT);
  const mothSeen = Math.min(follow * 4, 1) * (1 - back);
  const finR = 1.45 + 0.1 * Math.sin(g * 2.4) * shakeCan - 0.7 * lower;
  const blink = (g > DUST + 10 && g < DUST + 13) || (g > PASS + 2 && g < PASS + 5) ? 1 : 0;
  const pose: NubiPose = {
    finR,
    finL: 0.2 + 0.4 * mothSeen * (0.5 + 0.5 * Math.sin(g * 0.9)) - 0.35 * droop,
    lookX: 0.65 * (1 - mothSeen) - 0.35 * follow * mothSeen - 0.1 * droop,
    lookY: -0.25 + 0.15 * puzzled - 0.35 * follow * mothSeen + 0.1 * back - 0.4 * droop,
    eyeScale: 1 - 0.15 * puzzled * (1 - mothSeen) + 0.35 * mothSeen - 0.25 * droop,
    blink: Math.max(blink, 0.3 * droop),
    roll: -0.05 * puzzled * (1 - mothSeen) + 0.06 * mothSeen * Math.sin(g * 0.3) + 0.04 * droop,
    pitch: 0.06 * droop - 0.08 * mothSeen,
    yaw: -0.25 * mothSeen,
    squash: 1 - 0.1 * droop + 0.03 * Math.sin(g * 2.4) * shakeCan,
    hop: 0.3 * shakeCan * Math.abs(Math.sin(g * 2.4)),
  };

  // The moth: out of the can's opening, a flutter up, then straight past the camera (low left).
  const push = ramp(g, START, L06, [0, 1], EASE_IN_OUT);
  const camera = { position: lerp3(CAM_A.position, CAM_B.position, push), target: lerp3(CAM_A.target, CAM_B.target, push), fov: FOV };
  let moth: React.ReactNode = null;
  if (g >= MOTH && g < PASS + 8) {
    const out = canWorld(finR, tilt, [-0.04, 0.3, 0]);
    const pos0 = camera.position;
    const fwd = new THREE.Vector3(...camera.target).sub(new THREE.Vector3(...pos0)).normalize();
    const near = new THREE.Vector3(...pos0).addScaledVector(fwd, 1.1);
    const path = pathCam([
      out,
      [out[0] - 0.15, out[1] + 0.45, out[2] + 0.3],
      [out[0] - 0.9, out[1] + 0.2, out[2] + 1.8],
      [near.x + 0.05, near.y - 0.28, near.z],
      [pos0[0] - 0.6, pos0[1] - 0.55, pos0[2] + 0.3],
    ]);
    const u = ramp(g, MOTH, PASS + 6, [0, 1], Easing.bezier(0.3, 0.1, 0.6, 1));
    const p = path(u);
    const q = path(Math.min(1, u + 0.02));
    const flutter: Vec3 = [0.05 * Math.sin(g * 1.3), 0.06 * Math.sin(g * 0.9 + 1), 0];
    const dir = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const heading = Math.atan2(dir.x, dir.z);
    const climb = -Math.atan2(dir.y, Math.hypot(dir.x, dir.z) + 1e-6);
    const size = 1.3 * ramp(g, MOTH, MOTH + 3, [0.4, 1], EASE_OUT);
    moth = (
      <group position={[p[0] + flutter[0], p[1] + flutter[1], p[2]]} rotation={[climb * 0.6, heading, 0.25 * Math.sin(g * 0.7)]} scale={size}>
        <Moth fly={1} t={t} />
      </group>
    );
  }

  return (
    <AbsoluteFill style={{ background: "#FFE7D1" }}>
      <Stage cam={camera} near={0.05}>
        <StudioLights />
        <Studio t={t} wilt={wilt} />
        <Nubi
          size={2}
          position={AT}
          rotationY={YAW}
          pose={pose}
          shadowOpacity={0.4}
          holdR={
            <Upright raise={finR}>
              <group {...CAN_HOLD}>
                <WateringCan tilt={tilt} dust={dust} t={t} />
              </group>
            </Upright>
          }
        />
        {moth}
      </Stage>
    </AbsoluteFill>
  );
};
