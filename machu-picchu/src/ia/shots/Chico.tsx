import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, pop, ramp, windowIn } from "../../anim";
import { Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import { BOY, BoyLights, BoyRoom, Chico, typingFins } from "../../three/ia/Rooms";
import { GANCHO } from "../beats";
import { SHOTS } from "../shots";

// "chico" (GANCHO.TYPE → GANCHO.NUBI, ~1.8 s): the boy at his desk at night, typing on the laptop
// (fins tapping, a nervous little bob), seen over his shoulder from behind-left so the glowing
// screen faces the camera at an angle. The 2D layer shows his AI chat card «Dile que la extraño,
// pero sin parecer intenso» in the top band (y 260–760): the set sits below it. At SEND he hits
// enter with a big tap and turns to the camera with a proud little nod. Nubi's L01 starts here.

const FOV = 40;
const MID: Vec3 = [2.2, 1.55, -0.45];

export const ChicoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.chico.from;
  const t = g / 30;
  const { TYPE, SEND, NUBI } = GANCHO;

  // ---- Camera: over the shoulder, a slow push-in.
  const push = ramp(g, TYPE, NUBI, [0, 1], EASE_IN_OUT);
  const pos = lerp3([-1.4, 3.6, 11.2], [-0.9, 3.3, 9.8], push);
  const cam = aim(pos, FOV, MID, 560, 1110);

  // ---- The boy: types (fins tapping), a big enter on SEND, then turns proudly to the camera.
  const typing = 1 - ramp(g, SEND - 3, SEND);
  const enter = windowIn(g, SEND - 6, SEND + 3, 3);
  const proud = ramp(g, SEND + 3, SEND + 14, [0, 1], EASE_OUT);
  const nod = g >= SEND + 8 ? Math.sin(Math.min(1, (g - SEND - 8) / 14) * Math.PI * 2) * (1 - ramp(g, SEND + 18, SEND + 24)) : 0;
  const settle = g >= SEND ? pop(g, SEND, { damping: 10, stiffness: 240 }) : 0;
  const fins = typingFins(g, typing);
  const pose: NubiPose = {
    pitch: 0.1 * typing + 0.16 * nod - 0.06 * proud,
    yaw: 0.04 * Math.sin(t * 9) * typing - 0.75 * proud,
    roll: 0.02 * Math.sin(t * 13) * typing,
    lookY: -0.35 * typing + 0.1 * proud,
    lookX: 0,
    eyeScale: 1 - 0.28 * proud,
    blink: 0,
    squash: 1 + 0.02 * Math.sin(t * 18) * typing - 0.06 * enter + 0.05 * settle * (1 - proud * 0.5),
    hop: 0.2 * Math.abs(Math.sin(t * 9)) * typing,
    finL: fins.l * typing + 0.35 * proud,
    finR: fins.r * typing + 0.55 * enter - 0.2 * (1 - typing) * (1 - proud) + 0.45 * proud,
  };

  return (
    <AbsoluteFill style={{ background: "#BFE6FF" }}>
      <Stage cam={cam} near={0.1}>
        <BoyLights screen={1 + 0.6 * enter} />
        <BoyRoom t={t} laptopGlow={1 + 0.8 * enter} />
        <Chico position={BOY.sit} rotationY={BOY.face} pose={pose} shadow={false} />
      </Stage>
    </AbsoluteFill>
  );
};
