import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp } from "../../anim";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { NUBI_SPOT, POWER_OFF, STUDIO_BG, STUDIO_NUBI_PALETTE, StudioStage } from "../../three/ia/Studio";
import { GIRO } from "../beats";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot "giroNubi" (GIRO.START → GIRO.YA): the record scratch stops the comic montage. Nubi in its
// studio, still powered OFF (dim blue, with a soft warm glow from the side), framed from the front
// right with its computer and shelves of books behind it and its camera in the foreground. Sincere,
// it starts L13 "Pero tampoco seríamos inútiles." Calm, slow push-in.

const FOV = 38;
const FEET: Vec3 = [NUBI_SPOT[0], 0, NUBI_SPOT[2]];
const C0: Cam = aim([2.3, 1.6, 9.6], FOV, FEET, 600, 1215, 10);
const C1: Cam = aim([2.0, 1.5, 8.6], FOV, FEET, 600, 1215, 10);

export const GiroNubiShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.giroNubi.from;
  const t = g / 30;
  const { START, L13, YA } = GIRO;

  const push = ramp(g, START, YA, [0, 1], Easing.inOut(Easing.sin));
  const cam: Cam = { position: lerp3(C0.position, C1.position, push), target: lerp3(C0.target, C1.target, push), fov: FOV };
  const toCam = Math.atan2(cam.position[0] - NUBI_SPOT[0], cam.position[2] - NUBI_SPOT[2]);

  // Frozen by the scratch (eyes wide), then it settles, turns to the camera and speaks softly.
  const settle = ramp(g, START + 4, L13 + 4, [0, 1], EASE_IN_OUT);
  const breathe = Math.sin(t * 2.2);
  const base: NubiPose = {
    yaw: 0,
    pitch: -0.03 * settle,
    roll: 0.03 * settle * Math.sin(t * 0.9),
    squash: 1 + 0.012 * breathe,
    eyeScale: 1.2 * (1 - settle) + 1.0 * settle,
    lookX: -0.4 * (1 - settle),
    lookY: 0.15 * (1 - settle) - 0.05 * settle,
    finL: 0.05 - 0.15 * settle,
    finR: 0.05 - 0.15 * settle,
  };
  const pose = nubiTalk(g, base, 0.6);
  const rotY = toCam * (0.35 + 0.65 * settle) - 0.25 * (1 - settle);

  return (
    <AbsoluteFill style={{ background: STUDIO_BG }}>
      <StudioStage cam={cam} t={t} power={POWER_OFF} lever={0} warm={1}>
        <Nubi size={2} position={NUBI_SPOT} rotationY={rotY} pose={pose} palette={STUDIO_NUBI_PALETTE} shadowOpacity={0.4} />
      </StudioStage>
    </AbsoluteFill>
  );
};
