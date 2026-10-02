import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { STUDIO_BASIN, STUDIO_SINK, STUDIO_SINK_RAISE, STUDIO_SINK_YAW, Studio, StudioLights } from "../../three/agua/Home";
import { Nubi, NubiPose } from "../../three/Nubi";
import { ANTES } from "../beats";
import { SHOTS } from "../shots";

// Shot 4 "grifo" (ANTES.START → ANTES.PLAYA), "DOS HORAS ANTES" (the lead's rewind card covers
// the screen until CARD_OUT). Nubi at the kitchen sink turns the tap: nothing. It turns it more,
// peeks at the spout. On "cortado" (CORTADO) a first-person look down into the sink: Nubi shakes
// the tap hard, the tap coughs a puff of dust and one sad drop that splats in the dry basin. Back
// on Nubi: it stares down at the sink, deflated, until the cut to the beach.

const FOV = 38;
const MED = aim([STUDIO_SINK[0] - 2.6, 2.1, STUDIO_SINK[2] + 9.0], FOV, STUDIO_SINK, 700, 1262);
const MED_IN = aim([STUDIO_SINK[0] - 2.2, 1.95, STUDIO_SINK[2] + 7.8], FOV, STUDIO_SINK, 690, 1262);
const POV_A = { position: [-1.95, 2.45, -1.0] as Vec3, target: [STUDIO_BASIN.x + 0.38, STUDIO_BASIN.floor + 0.25, STUDIO_BASIN.z] as Vec3, fov: 52 };
const POV_B = { position: [-2.05, 2.25, -1.15] as Vec3, target: [STUDIO_BASIN.x + 0.33, STUDIO_BASIN.floor + 0.2, STUDIO_BASIN.z] as Vec3, fov: 52 };

export const GrifoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.grifo.from;
  const { START, CARD_OUT, CORTADO, PLAYA } = ANTES;
  const t = g / 30;
  const POV_END = Math.min(PLAYA - 14, CORTADO + 40);
  const pov = g >= CORTADO && g < POV_END;

  // Turning the knob: a first try, then more (still nothing), then shaking it.
  const turn1 = ramp(g, CARD_OUT - 2, CARD_OUT + 8, [0, 0.55], EASE_IN_OUT);
  const turn2 = ramp(g, CARD_OUT + 12, CARD_OUT + 17, [0, 0.45], EASE_OUT);
  const handle = turn1 + turn2 + 0.06 * Math.sin(g * 1.7) * clamp01((g - CORTADO) / 2) * (1 - clamp01((g - CORTADO - 16) / 4));
  const shake = clamp01((g - CORTADO + 1) / 2) * (1 - ramp(g, CORTADO + 14, CORTADO + 20, [0, 1], Easing.linear));
  const sputter = ramp(g, CORTADO + 2, CORTADO + 40, [0, 1], Easing.linear);

  // Nubi: effort when turning, expectant looks at the spout, then the shake, then deflated.
  const effort = Math.sin(Math.PI * ramp(g, CARD_OUT - 2, CARD_OUT + 8, [0, 1], Easing.linear)) + 0.8 * Math.sin(Math.PI * ramp(g, CARD_OUT + 12, CARD_OUT + 17, [0, 1], Easing.linear));
  const peek = ramp(g, Math.min(CARD_OUT + 14, CORTADO - 4), Math.max(CARD_OUT + 15, CORTADO - 1), [0, 1], EASE_IN_OUT);
  const sad = ramp(g, POV_END - 4, POV_END + 10, [0, 1], EASE_OUT);
  const blink = g > CARD_OUT + 9 && g < CARD_OUT + 12 ? 1 : 0;
  const pose: NubiPose = {
    finL: STUDIO_SINK_RAISE + 0.28 * Math.sin(g * 2.6) * shake - 0.9 * sad,
    finR: 0.15 + 0.35 * effort + 0.5 * shake * (0.5 + 0.5 * Math.sin(g * 2.2)) - 0.35 * sad,
    squash: 1 - 0.06 * effort + 0.04 * shake * Math.sin(g * 3.1) - 0.07 * sad,
    roll: 0.06 * peek + 0.06 * Math.sin(g * 2.9) * shake + 0.03 * sad,
    pitch: 0.12 * peek + 0.1 * sad,
    yaw: -0.12 * peek,
    lookX: -0.75 * (1 - sad) - 0.25 * sad,
    lookY: -0.2 - 0.25 * peek - 0.3 * sad,
    eyeScale: 1 - 0.18 * peek + 0.3 * shake - 0.2 * sad,
    blink: Math.max(blink, 0.25 * sad),
    hop: 0.6 * shake * Math.abs(Math.sin(g * 2.6)),
    wiggle: 0.5 * shake,
    wigglePhase: g * 0.9,
  };

  const inPush = ramp(g, START, POV_END, [0, 1], EASE_IN_OUT);
  const med = { position: lerp3(MED.position, MED_IN.position, inPush), target: lerp3(MED.target, MED_IN.target, inPush), fov: FOV };
  const p = ramp(g, CORTADO, POV_END, [0, 1], EASE_IN_OUT);
  const camera = pov ? { position: lerp3(POV_A.position, POV_B.position, p), target: lerp3(POV_A.target, POV_B.target, p), fov: POV_A.fov } : med;

  return (
    <AbsoluteFill style={{ background: "#FFE7D1" }}>
      <Shake frame={g} impacts={[{ at: CORTADO, amp: 16, dur: 16 }]}>
        <Stage cam={camera} near={0.05}>
          <StudioLights />
          <Studio t={t} faucet={{ handle, shake, sputter }} pool={0} />
          <Nubi size={2} position={STUDIO_SINK} rotationY={STUDIO_SINK_YAW} pose={pose} shadowOpacity={0.4} />
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};
