import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp, windowIn } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { DustPuff } from "../../three/Effects3D";
import { Coast, CoastLights, GiantShip, HeatShimmer, PLAYA_CAM, PLAYA_WALK, PLAYA_WIDE, SHIP_NUBI, SHIP_SPOT, coastSky } from "../../three/agua/Outdoors";
import { aim } from "../../thanos/camera";
import { ANTES } from "../beats";
import { aguaTalk } from "../talk";
import { SHOTS } from "../shots";

// Shot 5, "…hasta que fui a la playa. Creo que estacionaron mal.": the sea is gone.
//   A (PLAYA → UP + 7): low on the cracked seabed, looking back at the old shore (the town up on
//     the bank, the pier on bare stilts): Nubi walks towards us past stranded boats into a big
//     shadow, stops on UP and looks up.
//   B (→ UP + 36): Nubi's view straight up: the giant liner leaning over it, creaking, sand
//     trickling off its rail.
//   C (→ END): wide and low: tiny Nubi under the huge leaning ship turns to us, deadpan, for
//     "Creo que estacionaron mal" (a slow blink on MAL, then the ship creaks again).

const F = SHIP_NUBI[1];

export const PlayaShot: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SHOTS.playa;
  const g = frame + S.from;
  const t = g / 30;
  const { UP, MAL } = ANTES;
  const CUT_POV = UP + 7;
  const CUT_WIDE = UP + 36;
  const shotA = g < CUT_POV;
  const shotB = !shotA && g < CUT_WIDE;

  // --- Nubi ---------------------------------------------------------------------------
  const walk = ramp(g, S.from, UP - 1, [0, 1], (x) => x);
  const at: Vec3 = lerp3(PLAYA_WALK.from, PLAYA_WALK.to, walk);
  const walking = g < UP - 1;
  const phase = (g - S.from) * 0.55;
  const look = ramp(g, UP, UP + 6, [0, 1], EASE_OUT);
  const startle = windowIn(g, UP, UP + 8, 3);
  // In C: still gazing up at the ship, then turns to us and goes deadpan before MAL.
  const turn = ramp(g, MAL - 26, MAL - 14, [0, 1], EASE_IN_OUT);
  const slowBlink = windowIn(g, MAL - 1, MAL + 9, 4);
  let pose: NubiPose;
  if (shotA) {
    pose = walking
      ? { wiggle: 1, wigglePhase: phase * 2, hop: Math.abs(Math.sin(phase)) * 0.7, squash: 1 + 0.06 * Math.cos(phase * 2), finL: 0.25 + 0.3 * Math.sin(phase), finR: 0.25 - 0.3 * Math.sin(phase), pitch: 0.06 }
      : { lookY: look, eyeScale: 1 + 0.38 * look, hop: startle * 1.4, squash: 1 - 0.08 * startle, finL: -0.2 + 0.5 * startle, finR: -0.2 + 0.5 * startle, pitch: -0.12 * look };
  } else {
    pose = aguaTalk(
      g,
      {
        lookY: 1 - 0.95 * turn,
        lookX: 0.2 * turn,
        eyeScale: lerp(1.3, 0.72, turn),
        blink: Math.max(0.28 * turn, slowBlink),
        finL: -0.3 * turn,
        finR: -0.3 * turn,
        pitch: -0.1 * (1 - turn),
      },
      0.55,
    );
  }
  const nubiAt: Vec3 = shotA ? at : SHIP_NUBI;

  // --- Ship ---------------------------------------------------------------------------
  const creak = 0.6 + 0.4 * windowIn(g, UP + 8, CUT_WIDE, 6) + 0.6 * windowIn(g, MAL + 8, MAL + 40, 6);

  // --- Cameras ------------------------------------------------------------------------
  const camA = aim(lerp3([PLAYA_CAM[0] - 0.4, PLAYA_CAM[1] + 0.4, PLAYA_CAM[2] + 1.0], PLAYA_CAM, ramp(g, S.from, CUT_POV, [0, 1], EASE_OUT)), 58, nubiAt, 520, 1250);
  const tiltUp = ramp(g, CUT_POV, CUT_WIDE, [0, 1], EASE_IN_OUT);
  const eye: Vec3 = [SHIP_NUBI[0], F + 1.5, SHIP_NUBI[2]];
  const camB = {
    position: eye,
    target: lerp3([SHIP_NUBI[0] + 0.5, F + 9, SHIP_NUBI[2] - 10], [SHIP_NUBI[0] - 1, F + 14, SHIP_NUBI[2] - 8.5], tiltUp) as Vec3,
    fov: 76,
    roll: 0.1 + 0.03 * Math.sin(t * 1.3),
  };
  const push = ramp(g, CUT_WIDE, S.to, [0, 1], EASE_IN_OUT);
  const camC = aim(lerp3(PLAYA_WIDE, [PLAYA_WIDE[0] - 4, PLAYA_WIDE[1] - 0.3, PLAYA_WIDE[2] - 1], push), 46, SHIP_NUBI, 440, 1130);
  const cam = shotA ? camA : shotB ? camB : camC;
  // Facing: the walk direction, then towards camera A when it stops; in C from the ship to us.
  const faceCam = (c: { position: Vec3 }) => Math.atan2(c.position[0] - nubiAt[0], c.position[2] - nubiAt[2]);
  const walkYaw = Math.atan2(PLAYA_WALK.to[0] - PLAYA_WALK.from[0], PLAYA_WALK.to[2] - PLAYA_WALK.from[2]);
  const nubiYaw = shotA ? lerp(walkYaw, faceCam(camA), ramp(g, UP - 3, UP + 5, [0, 1], EASE_IN_OUT)) : lerp(faceCam(camC) + 1.9, faceCam(camC), turn);
  const horizon = projectToScreen(cam, [cam.target[0] + (cam.target[0] - cam.position[0]) * 40, F + 2, cam.target[2] + (cam.target[2] - cam.position[2]) * 40], 1080, 1920);
  const sky = shotB ? coastSky(1.1) : coastSky(clamp01(horizon.behind ? 0.5 : horizon.y / 1920));

  return (
    <AbsoluteFill style={{ background: sky }}>
      <Shake
        frame={g}
        impacts={[
          { at: CUT_POV, amp: 12, dur: 22 },
          { at: CUT_POV + 14, amp: 8, dur: 16 },
          { at: MAL + 10, amp: 10, dur: 20 },
        ]}
      >
        <Stage cam={cam} near={0.2} far={900}>
          <CoastLights />
          <Coast water={0} t={t} fog={[45, 330]} />
          <GiantShip position={SHIP_SPOT} tilt={1} creak={creak} t={t} sand={1} />
          {shotB ? null : <Nubi size={2} position={nubiAt} rotationY={nubiYaw} pose={pose} shadowOpacity={0.3} />}
          {shotA ? <DustPuff frame={g} at={UP} position={[nubiAt[0], nubiAt[1], nubiAt[2]]} radius={1.1} color="#F1DDB0" count={8} /> : null}
          {shotA ? <HeatShimmer t={t} position={[0, F, -8]} width={60} height={6} rotationY={Math.PI * 0} /> : null}
          {shotA || shotB ? null : <HeatShimmer t={t} position={[30, F, -30]} width={70} height={6} rotationY={1.35} amount={0.7} />}
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
