import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ramp, windowIn } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { BOTTLE_HUG, WaterBottle } from "../../three/agua/Bottle";
import { DropTrail, DryStreet, FarCrowd, HOT_SKY, HotLights, StreetChase, alongPath, civilianRun, makeChasers } from "../../three/agua/Street";
import { HOOK } from "../beats";
import { SHOTS } from "../shots";
import { aguaTalk } from "../talk";

// Flash-forward (hook): Nubi runs straight at the camera down the hot street hugging the
// glowing last bottle; on "error" the thirsty crowd floods in behind it; on FREEZE everything
// stops (freeze frame until the end of the shot, Nubi big in the middle: eyes ≈ (540, 800)).

/** Nubi's run down the road towards the camera (−z), from the alleys' end of the street. */
const PATH: Vec3[] = [
  [2.1, 0, 17.5],
  [2.3, 0, -12],
];
const SPEED = 3.3;
const START = 1.0;
const CHASERS = makeChasers(16, 200, { lag0: 1.6, lagStep: 0.5, spread: 2.1, fromSide: 4.8 });
const FAR_SPOTS: [number, number][] = Array.from({ length: 26 }, (_, i) => [-3.4 + (i % 7) * 1.15 + ((i * 7) % 5) * 0.12, 9 + Math.floor(i / 7) * 1.7 + ((i * 3) % 4) * 0.3]);
/** The leak: drops left on the road behind Nubi (foreshadowing the hole). */
const LEAK: Vec3[] = [alongPath(PATH, START).p, PATH[1]].map((p) => [p[0] + 0.05, 0, p[2]] as Vec3);
const LEAK_LEN = Math.hypot(LEAK[1][0] - LEAK[0][0], LEAK[1][2] - LEAK[0][2]);

export const FlashShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { L02, BOTELLA, ERROR, FREEZE } = HOOK;
  // Freeze frame: from FREEZE to the end of the shot everything shows the frame of FREEZE.
  const g = Math.min(frame + SHOTS.flash.from, FREEZE);
  const t = g / 30;
  const run = (g - L02) / 30;
  const lead = START + run * SPEED;
  const { p: at, yaw } = alongPath(PATH, lead);

  // Nubi: running flat out, hugging the bottle (fins in), a glance back after "botella",
  // eyes huge once the crowd pours in. The run phase is set so the freeze lands mid-hop.
  const phase = Math.PI / 2 - (FREEZE / 30) * 14;
  const r = civilianRun(t, phase);
  const glance = windowIn(g, BOTELLA + 18, BOTELLA + 42, 6);
  const panic = ramp(g, ERROR, ERROR + 8);
  const base: NubiPose = {
    ...r,
    finL: 0.22 + 0.06 * Math.sin(t * 14 + phase),
    finR: 0.22 - 0.06 * Math.sin(t * 14 + phase),
    yaw: glance * 0.95,
    pitch: 0.12,
    eyeScale: 1.15 + 0.32 * panic,
    lookX: glance * 0.8,
    lookY: 0.1 * panic,
  };
  const pose = aguaTalk(g, base, 0.45);
  const glow = 0.6 + 0.4 * windowIn(g, BOTELLA - 4, BOTELLA + 14, 6);

  // Camera dollies back in front of Nubi, pushing in a little towards the freeze.
  const dist = 9.2 - 0.9 * ramp(g, L02, FREEZE);
  const cam = aim([at[0] - 0.5, 1.45, at[2] - dist], 50, [at[0], at[1] + 1.12, at[2]], 540, 800);

  const flood = ramp(g, ERROR, FREEZE - 2, [0, 1], (x) => x);
  const farIn = ramp(g, ERROR - 2, FREEZE, [14, 0]);
  return (
    <AbsoluteFill style={{ background: HOT_SKY }}>
      <Shake frame={g} impacts={[{ at: ERROR + 2, amp: 9, dur: 14 }]}>
        <Stage cam={cam}>
          <HotLights />
          <DryStreet t={t} />
          <DropTrail points={LEAK} t={t} glow={0.45} size={0.9} reveal={Math.max(0, (lead - START - 0.6) / LEAK_LEN)} />
          <Nubi size={2} position={at} rotationY={yaw} pose={pose} shadowOpacity={0.4}>
            <group {...BOTTLE_HUG}>
              <WaterBottle fill={1} glow={glow} t={t} />
            </group>
          </Nubi>
          {g >= ERROR ? (
            <>
              <StreetChase t={t} path={PATH} lead={lead} chasers={CHASERS} flood={flood} target={at} />
              <group position={[0, 0, at[2] - 4 + farIn]}>
                <FarCrowd t={t} spots={FAR_SPOTS} run={1} facing={Math.PI} seed={11} />
              </group>
            </>
          ) : null}
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};
