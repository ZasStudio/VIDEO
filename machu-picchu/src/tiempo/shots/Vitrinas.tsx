import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, clamp01, keyframes, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { Glow } from "../../three/thanos/FX";
import { Nubi, NubiPose } from "../../three/Nubi";
import { AVENUE, AVENUE_SKY, Avenue, AvenueLights, CAR_SPOT, ConfettiBurst, RICH_SPOT, RichMan, Sparkles, richIdle } from "../../three/tiempo/Avenue";
import { ESCALA } from "../beats";
import { NUBI_EVENTS, RICH_BUY, RICH_EVENTS, nubiDraining, nubiHolding, nubiSeconds, richSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// Shot "vitrinas" (ESCALA.START → ESCALA.CASA_CUT): "Un celular cuesta un mes. Un auto, cinco
// años." A sideways tracking dolly along the upscale avenue: Nubi walks left → right (3/4 to the
// camera, its counter over its head). On "un mes" the phone shop's giant glowing phone sits at
// the right of frame, its screen reading "1 MES"; on "cinco años" the AUTOLUX showroom slides in:
// the red toy car on its turntable under the "5 AÑOS" banner, the golden rich man beside it.
// Nubi stops and stares; at RICH_BUY he taps the car (confetti, "VENDIDO"), his golden counter
// barely moves (999 → 994 AÑOS). Final layout: Nubi x ≈ 245 (feet y ≈ 1262), the rich man x ≈ 560
// against the showroom's navy wall, the car x ≈ 800 under the price banner; y 260-460 stays plain
// upper facade for the 2D stickers.

const FOV = 40;
const Z = AVENUE.walkZ;
/** Walking speed (units/s) and where Nubi stops (in front of the showroom). */
const SPEED = 3.0;
const STOP = ESCALA.ANOS + 4;
const DECEL = 12;
const END_X = RICH_SPOT[0] - 2.19;
/** Camera: 17 units in front of the walk line, 2.8 up (wide enough for Nubi, the rich man and the car). */
const CAM_DIST = 17;
const CAM_Y = 2.8;
const PX_PER_UNIT = 1920 / (2 * CAM_DIST * Math.tan((FOV * Math.PI) / 360));

/** Units still to walk `u` frames before STOP (constant speed, then a smooth stop). */
const remaining = (u: number) => {
  const v = SPEED / 30;
  if (u <= 0) return 0;
  if (u <= DECEL) return (v * u * u) / (2 * DECEL);
  return v * (u - DECEL) + (v * DECEL) / 2;
};

export const VitrinasShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.vitrinas.from;
  const t = g / 30;
  const { START, CELULAR, MES, AUTO, ANOS, CASA_CUT } = ESCALA;

  // ---- Nubi walks, slows down and stops in front of the showroom.
  const x = END_X - remaining(STOP - g);
  const walkK = clamp01((STOP - g) / DECEL);
  const ph = t * 11;
  const phoneLook = windowIn(g, CELULAR - 4, AUTO - 2, 6);
  const stare = ramp(g, ANOS - 8, ANOS + 4, [0, 1], EASE_IN_OUT);
  const shock = ramp(g, RICH_BUY + 1, RICH_BUY + 5);
  const jolt = Math.sin(Math.PI * ramp(g, RICH_BUY + 1, RICH_BUY + 10, [0, 1], Easing.linear));
  const base: NubiPose = {
    hop: Math.abs(Math.sin(ph)) * 0.7 * walkK + 1.1 * jolt,
    squash: 1 + 0.04 * Math.cos(ph * 2) * walkK + 0.07 * jolt,
    roll: 0.05 * Math.sin(ph) * walkK,
    pitch: 0.05 * walkK - 0.06 * shock,
    wiggle: 0.7 * walkK + 0.4 * jolt,
    wigglePhase: ph * 1.5,
    finL: 0.16 * Math.sin(ph) * walkK + 0.35 * jolt - 0.2 * shock,
    finR: -0.16 * Math.sin(ph) * walkK + 0.35 * jolt - 0.2 * shock,
    lookX: 0.6 * phoneLook + 0.85 * stare,
    lookY: 0.3 * phoneLook + 0.15 * stare,
    eyeScale: 1 + 0.28 * phoneLook * ramp(g, MES - 6, MES + 2) + 0.12 * stare + 0.3 * shock,
  };
  const pose = tiempoTalk(g, base, 0.55);
  const nubiAt: Vec3 = [x, 0, Z];
  const nubiRot = 0.78 + 0.22 * stare;

  // ---- Camera: tracks Nubi (it drifts from x ≈ 470 to 245 as the showroom takes the right).
  const sx = keyframes(g, [START, MES, ANOS, CASA_CUT], [470, 420, 265, 245]);
  const camPos: Vec3 = [x + (540 - sx) / PX_PER_UNIT, CAM_Y, Z + CAM_DIST];
  const cam = aim(camPos, FOV, [x, 0, Z], sx, 1262);

  // ---- The rich man: smug idle, raises his fin and taps the car at RICH_BUY.
  const raise = ramp(g, RICH_BUY - 12, RICH_BUY - 3, [0, 1], EASE_IN_OUT);
  const tap = ramp(g, RICH_BUY - 2, RICH_BUY + 1, [0, 1], Easing.in(Easing.quad));
  const settle = ramp(g, RICH_BUY + 6, RICH_BUY + 16, [0, 1], EASE_IN_OUT);
  const idle = richIdle(t);
  const richPose: NubiPose = {
    ...idle,
    finR: (idle.finR ?? 0) + (0.95 * raise - 0.75 * tap) * (1 - settle),
    roll: (idle.roll ?? 0) + 0.06 * raise * (1 - settle),
    hop: 0.25 * Math.sin(Math.PI * ramp(g, RICH_BUY, RICH_BUY + 6, [0, 1], Easing.linear)),
  };
  const age = (g - RICH_BUY) / 30;
  // The car's nose points at the rich man and the camera (3/4) when he buys it.
  const spin = -2.3 + (t - RICH_BUY / 30) * 0.35;
  const sold = ramp(g, RICH_BUY + 3, RICH_BUY + 9);
  const carTop: Vec3 = [CAR_SPOT[0] - 0.3, 1.7, CAR_SPOT[2]];

  const nubiCounter = counterAt(cam, [x, 2.2 + (pose.hop ?? 0) * 0.2 * 0.5, Z]);
  const richCounter = counterAt(cam, [RICH_SPOT[0] + 0.1, 3.2, RICH_SPOT[2]]);

  return (
    <AbsoluteFill style={{ background: AVENUE_SKY }}>
      <Stage cam={cam}>
        <AvenueLights />
        <Avenue t={t} spin={spin} sold={sold} xRange={[x - 12, x + 14]} />
        <RichMan position={RICH_SPOT} rotationY={0.5} pose={richPose} />
        <Nubi size={2} position={nubiAt} rotationY={nubiRot} pose={pose} shadowOpacity={0.4} />
        <ConfettiBurst age={age} position={carTop} count={80} />
        <Sparkles age={age} position={carTop} radius={1.6} count={12} size={0.26} />
        <Sparkles age={((g - START) % 36) / 30} position={[RICH_SPOT[0], 1.6, RICH_SPOT[2] + 0.8]} radius={1.0} count={4} size={0.16} seed={7 + Math.floor((g - START) / 36)} life={0.9} />
        {age >= 0 && age < 0.3 ? <Glow color="#FFE07A" size={2.4 * (1 - age / 0.3) + 0.6} opacity={0.8 * (1 - age / 0.3)} position={carTop} /> : null}
      </Stage>
      {!richCounter.behind ? <LifeCounter frame={g} seconds={richSeconds(g)} events={RICH_EVENTS} gold x={richCounter.x} y={richCounter.y} scale={0.7} /> : null}
      {!nubiCounter.behind ? (
        <LifeCounter frame={g} seconds={nubiSeconds(g)} events={NUBI_EVENTS} draining={nubiDraining(g)} frozen={nubiHolding(g)} x={nubiCounter.x} y={nubiCounter.y} scale={0.86} />
      ) : null}
    </AbsoluteFill>
  );
};
