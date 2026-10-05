import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_OUT, ramp, windowIn } from "../../anim";
import { Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import { BOY, BoyLights, BoyRoom, Chico, typingFins } from "../../three/ia/Rooms";
import { GIRO } from "../beats";
import { SHOTS } from "../shots";

// "almuerzo" (GIRO.TODO − 6 → GIRO.END, ~2 s): the AI is back ON. The boy at his desk types to the
// AI on the laptop «¿Qué almuerzo?» (the 2D layer shows the chat card in the top band, y 260–700)
// — and RIGHT NEXT to the laptop, on the near corner of the desk, sits a big served plate (rice,
// chicken, salad), steaming and well lit. A slow push-in so the gag reads: the plate is obvious,
// he doesn't notice it (eyes on the screen; after sending, a curious head tilt, waiting).
// Set ≈ y 760–1180; the plate ≈ x 640–860, y 950–1100 at the end.

const FOV = 40;
/** Between the boy and the plate: the framing point. */
const MID: Vec3 = [2.25, 1.45, -0.05];

export const AlmuerzoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.almuerzo.from;
  const t = g / 30;
  const { ALMUERZO, END } = GIRO;
  const from = SHOTS.almuerzo.from;

  // ---- Camera: slow push-in, drifting a touch towards the plate.
  const push = ramp(g, from, END, [0, 1], Easing.inOut(Easing.sin));
  const pos: Vec3 = lerp3([3.5, 3.3, 11.2], [3.35, 2.75, 8.0], push);
  const cam = aim(pos, FOV, MID, lerpN(560, 520, push), lerpN(1000, 1010, push));

  // ---- The boy: types, hits enter on ALMUERZO, then waits with a curious tilt (not seeing the plate).
  const typing = 1 - ramp(g, ALMUERZO - 4, ALMUERZO);
  const enter = windowIn(g, ALMUERZO - 4, ALMUERZO + 3, 2);
  const wait = ramp(g, ALMUERZO + 2, ALMUERZO + 10, [0, 1], EASE_OUT);
  const fins = typingFins(g, typing, -0.22, 1.1);
  const pose: NubiPose = {
    pitch: 0.1 * typing + 0.02 * wait,
    yaw: 0.04 * Math.sin(t * 8) * typing - 0.05 * wait,
    roll: 0.14 * wait,
    lookY: -0.3 * typing + 0.05 * wait,
    lookX: -0.1,
    eyeScale: 1 + 0.08 * wait,
    blink: 0,
    squash: 1 + 0.02 * Math.sin(t * 18) * typing - 0.05 * enter,
    hop: 0.18 * Math.abs(Math.sin(t * 9)) * typing,
    finL: fins.l * typing + 0.15 * wait,
    finR: fins.r * typing + 0.5 * enter + 0.55 * wait,
    wiggle: 0.25 * wait,
    wigglePhase: t * 5,
  };

  return (
    <AbsoluteFill style={{ background: "#BFE6FF" }}>
      <Stage cam={cam} near={0.1}>
        <BoyLights screen={1.1 + 0.5 * enter} keyFrom={[6, 7, 9]} />
        <BoyRoom t={t} laptopGlow={1.1 + 0.6 * enter} plate steam={1} />
        <Chico position={BOY.sit} rotationY={BOY.face} pose={pose} shadow={false} />
      </Stage>
    </AbsoluteFill>
  );
};

const lerpN = (a: number, b: number, k: number) => a + (b - a) * k;
