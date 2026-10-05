import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, pop, ramp } from "../../anim";
import { Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { lerp3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import { Chica, GIRL, GirlLights, GirlRoom, HeldPhone } from "../../three/ia/Rooms";
import { GANCHO } from "../beats";
import { SHOTS } from "../shots";

// "chica" (GANCHO.START → GANCHO.TYPE, ~0.7 s): the girl sits on her bed among plushies and heart
// pillows, holding her phone up at her side, reading an absurdly long love message (the 2D layer
// scrolls it in the top band, y 260–760). Her eyes scan down… then pop wide, with a little hop.
// Close camera: she fills the lower two thirds (her base at y ≈ 1290), a slow push-in.

const FOV = 40;

export const ChicaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.chica.from;
  const t = g / 30;
  const { START, TYPE } = GANCHO;
  const WOW = START + Math.round((TYPE - START) * 0.38);

  // ---- Camera: close, slow push-in.
  const push = ramp(g, START, TYPE, [0, 1], EASE_IN_OUT);
  const pos = lerp3([0.95, 2.4, 8.6], [0.8, 2.3, 7.6], push);
  const cam = aim(pos, FOV, GIRL.sit, 450, 1290);

  // ---- The girl: reads (eyes scan down the scroll), then her eyes pop wide and she hops.
  const wow = g >= WOW ? pop(g, WOW, { damping: 8, stiffness: 260 }) : 0;
  const hopArc = Math.sin(Math.PI * ramp(g, WOW, WOW + 10, [0, 1], (x) => x));
  const scan = ((g - START) % 6) / 6;
  const read = 1 - ramp(g, WOW - 1, WOW + 2);
  const pose: NubiPose = {
    lookX: 0.9,
    lookY: 0.55 - 0.35 * scan * read + 0.1 * wow,
    eyeScale: 1 + 0.42 * wow,
    blink: 0,
    squash: 1 + 0.08 * wow - 0.06 * (1 - hopArc) * ramp(g, WOW - 2, WOW) * (1 - ramp(g, WOW, WOW + 2)),
    hop: 1.6 * hopArc,
    pitch: -0.08 - 0.06 * wow,
    roll: -0.05 + 0.04 * Math.sin(t * 6) * (1 - read),
    yaw: 0.18,
    finL: 0.15 + 0.7 * wow,
    finR: 1.25 + 0.15 * wow,
    wiggle: 0.6 * hopArc,
    wigglePhase: g * 0.9,
  };

  const phoneRaise = pose.finR ?? 0;
  return (
    <AbsoluteFill style={{ background: "#FFD6EA" }}>
      <Stage cam={cam} near={0.1}>
        <GirlLights phone={0.6 + 0.3 * wow} phoneAt={[GIRL.sit[0] + 1.2, 2.4, GIRL.sit[2] + 2.2]} />
        <GirlRoom t={t} />
        <Chica
          position={GIRL.sit}
          rotationY={0}
          pose={pose}
          shadow={false}
          holdR={<HeldPhone raise={phoneRaise} turn={-0.75} tilt={0.2} caseColor="#B98CFF" scale={1.45} />}
          eyeRough={0.7}
        />
      </Stage>
    </AbsoluteFill>
  );
};
