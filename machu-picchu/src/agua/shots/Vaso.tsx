import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp } from "../../anim";
import { Upright } from "../../inca/outfit";
import { Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { GLASS_HOLD, Studio, StudioLights, WaterGlass } from "../../three/agua/Home";
import { Nubi, NubiPose } from "../../three/Nubi";
import { HOOK } from "../beats";
import { SHOTS } from "../shots";

// Shot 1 "vaso" (HOOK.START → HOOK.OCEAN). The video opens mid-sip: Nubi, in its studio, tilts a
// glass of water towards its face, eyes half closed. On "desapareciera" (VANISH) the water
// evaporates in a flash of sparkles (gone by VANISH + 6), Nubi freezes with its eyes wide and
// turns the glass upside down (by OCEAN): nothing comes out.
// Medium-close, Nubi in the middle/right with its feet at y ≈ 1270; the top-left (x 60-560,
// y 230-440) stays free for the viewer's comment.

const AT: Vec3 = [-0.75, 0, -0.55];
const YAW = -0.42;
const FOV = 36;
const FEET: [number, number] = [610, 1268];

const cam = (offset: Vec3) => aim([AT[0] + offset[0], AT[1] + offset[1], AT[2] + offset[2]], FOV, AT, FEET[0], FEET[1]);

export const VasoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.vaso.from;
  const { START, VANISH, OCEAN } = HOOK;
  const t = g / 30;

  // Sip: the glass keeps tipping towards the face until the water vanishes.
  const sip = ramp(g, START, VANISH, [0.62, 1.08], EASE_IN_OUT);
  const vanish = ramp(g, VANISH, VANISH + 6, [0, 1], Easing.linear);
  const flip = ramp(g, VANISH + 4, Math.min(OCEAN - 3, VANISH + 12), [0, 1], EASE_IN_OUT);
  const shakeOut = clamp01((g - (VANISH + 11)) / 3);
  const tilt = sip + (Math.PI - sip) * flip + 0.16 * Math.sin(g * 2.1) * shakeOut;
  const shock = ramp(g, VANISH, VANISH + 3, [0, 1], EASE_OUT);
  const jolt = Math.sin(Math.PI * ramp(g, VANISH, VANISH + 7, [0, 1], Easing.linear));
  const gulp = (1 - shock) * Math.max(0, Math.sin(g * 0.55));

  const finR = 0.95 + 0.15 * sip + 0.4 * flip;
  const pose: NubiPose = {
    finR,
    finL: 0.12 + 0.35 * jolt,
    pitch: -0.12 * (1 - shock) + 0.04 * shock,
    roll: -0.05 * (1 - shock),
    yaw: 0.05 * shock,
    blink: 0.58 * (1 - shock),
    eyeScale: 1 + 0.45 * shock,
    lookX: 0.2 + 0.45 * shock,
    lookY: 0.1 + 0.35 * flip,
    hop: 0.9 * jolt,
    squash: 1 - 0.035 * gulp + 0.07 * jolt,
    wiggle: 0.25 * (1 - shock) + 0.3 * jolt,
    wigglePhase: g * 0.32,
  };

  // Slow push-in from the first frame, a punch-in on the vanish.
  const push = ramp(g, START, VANISH, [0, 1], EASE_IN_OUT);
  const punch = ramp(g, VANISH, VANISH + 5, [0, 1], EASE_OUT);
  const c0 = cam([1.25, 1.6, 6.3]);
  const c1 = cam([1.05, 1.5, 5.45]);
  const c2 = cam([0.9, 1.42, 4.85]);
  const position = lerp3(lerp3(c0.position, c1.position, push), c2.position, punch);
  const target = lerp3(lerp3(c0.target, c1.target, push), c2.target, punch);

  return (
    <AbsoluteFill style={{ background: "#FFE7D1" }}>
      <Stage cam={{ position, target, fov: FOV }} near={0.1}>
        <StudioLights />
        <Studio t={t} />
        <Nubi
          size={2}
          position={AT}
          rotationY={YAW}
          pose={pose}
          shadowOpacity={0.4}
          holdR={
            <Upright raise={finR}>
              <group {...GLASS_HOLD}>
                <WaterGlass fill={0.82} vanish={vanish} tilt={tilt} t={t} />
              </group>
            </Upright>
          }
        />
      </Stage>
    </AbsoluteFill>
  );
};
