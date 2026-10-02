import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp } from "../../anim";
import { SMOOTH, Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { COAST_FLAT_Y, Coast, CoastLights, GiantShip, HeatShimmer, SHIP_SPOT, coastLevel, coastSky } from "../../three/agua/Outdoors";
import { HOOK } from "../beats";
import { SHOTS } from "../shots";

// Shot 2, "¿Y si toda el agua desapareciera… AHORA?": an aerial view over the bay. The sea draws
// back a little, then on AHORA it drains away in a rush (foam streaks racing out, boats dropping
// onto the seabed, the liner grounding and keeling over with a thump) while the camera cranes
// down; ≈ 18 frames later the bay is a cracked desert under heat shimmer. The lead's comment
// sticker and water meter sit at the top (y 230-440): the drama stays in the middle and bottom.

const DRAUGHT = 6;

/** Sea state at global frame g: water 1 → 0 with the fastest drop right on AHORA. */
const waterAt = (g: number) => {
  const { AHORA } = HOOK;
  const drawback = ramp(g, SHOTS.oceano.from + 4, AHORA - 9, [0, 0.07], EASE_IN_OUT);
  const drain = ramp(g, AHORA - 9, AHORA + 11, [0, 1], EASE_IN_OUT);
  return (1 - drawback) * (1 - drain);
};
/** The liner's keel height above the seabed while it still floats. */
const floatAt = (g: number) => Math.max(0, coastLevel(waterAt(g)) - DRAUGHT - SHIP_SPOT[1]);

export const OceanoShot: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SHOTS.oceano;
  const g = frame + S.from;
  const t = g / 30;
  const { AHORA } = HOOK;

  const water = waterAt(g);
  const rush = Math.exp(-(((g - AHORA) / 8) ** 2));
  const dry = ramp(g, AHORA + 6, AHORA + 18, [0, 1], EASE_IN_OUT);
  // The frame the liner touches the bottom, then it keels over.
  let ground = S.to;
  for (let f = S.from; f < S.to; f++) {
    if (floatAt(f) <= 0) {
      ground = f;
      break;
    }
  }
  const float = floatAt(g);
  const tilt = ramp(g, ground, ground + 12, [0, 1], EASE_OUT);
  const thump = ground + 9;

  // Crane down and push in over the town, accelerating into the drain.
  const u = ramp(g, S.from, S.to, [0, 1], SMOOTH);
  const P0: Vec3 = [-6, 128, 176];
  const P1: Vec3 = [6, 66, 96];
  const T0: Vec3 = [0, -16, -50];
  const T1: Vec3 = [6, -12, -46];
  const cam = { position: lerp3(P0, P1, u), target: lerp3(T0, T1, u), fov: 52, roll: 0.03 * Math.sin(u * Math.PI) };
  const horizon = projectToScreen(cam, [cam.target[0], 0, -900], 1080, 1920).y / 1920;

  return (
    <AbsoluteFill style={{ background: coastSky(clamp01(horizon + 0.02)) }}>
      <Shake
        frame={g}
        impacts={[
          { at: AHORA - 6, amp: 14, dur: 26 },
          { at: thump, amp: 26, dur: 14 },
        ]}
      >
        <Stage cam={cam} near={1} far={1600}>
          <CoastLights />
          <Coast water={water} t={t} rush={rush} fog={[90, 560]} />
          <GiantShip position={SHIP_SPOT} float={float} tilt={tilt} creak={tilt} t={t} sand={dry} />
          {[
            [-10, 0],
            [-60, 1],
            [-110, 2],
          ].map(([z, i]) => (
            <HeatShimmer key={i} t={t + i * 0.7} amount={dry} position={[6, COAST_FLAT_Y - 1, z]} width={170} height={16} rotationY={0} />
          ))}
        </Stage>
      </Shake>
      {/* Hot glare once the bay has dried. */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 90% 55% at 50% 8%, rgba(255,236,170,0.55) 0%, rgba(255,190,90,0.18) 45%, rgba(255,160,60,0) 75%)",
          opacity: dry,
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill style={{ background: "rgba(255,150,40,0.10)", opacity: dry, mixBlendMode: "multiply" }} />
    </AbsoluteFill>
  );
};
