import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ramp, windowIn } from "../../anim";
import { Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Bedroom, BedroomLights, HugPillow, NUBI_BED, NUBI_EYES } from "../../three/dormir/Bedroom";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { Lids } from "../../three/tiempo/Office";
import { ENEMIGO } from "../beats";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot "mirada" (ENEMIGO.L14 → END): Nubi in bed, the pillow still squashed on its head, stares
// straight into the lens, deadpan, half-lidded: L14 "Este encontró cómo ganar despierto." (small
// body talk). A slow push-in; one slow, unimpressed blink after "despierto".

const FOV = 38;

export const MiradaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.mirada.from;
  const { L14, END } = ENEMIGO;
  const t = g / 30;

  const push = ramp(g, L14, END, [0, 1], (x) => x);
  const cam = aim([0.08, 2.0, NUBI_EYES[2] + 6.1 - 0.8 * push], FOV, NUBI_EYES, 540, 1010);

  // The unimpressed blink after the line, and a tiny head tilt.
  const slowBlink = windowIn(g, END - 14, END - 4, 4);
  const base: NubiPose = {
    blink: slowBlink,
    eyeScale: 1.02,
    pitch: 0.02,
    roll: -0.03,
    finL: 0.6,
    finR: 0.6,
    squash: 0.98,
  };
  const pose = nubiTalk(g, base, 0.45);
  pose.lookX = 0;
  pose.lookY = 0;
  pose.finL = 0.6 + 0.04 * Math.sin(g * 0.2);
  pose.finR = 0.6 + 0.04 * Math.sin(g * 0.2 + 1);

  return (
    <AbsoluteFill style={{ background: "#0A1240" }}>
      <Stage cam={cam} near={0.1} far={200}>
        <BedroomLights />
        <Bedroom t={t} frameTilt={-0.42} />
        <Nubi size={2} position={NUBI_BED} pose={pose} shadow={false} palette={{ eyeRough: 0.7 }}>
          <HugPillow over={1} squash={0.28} />
          <Lids pose={pose} droop={0.55} color={NUBI_GREEN} />
        </Nubi>
      </Stage>
    </AbsoluteFill>
  );
};
