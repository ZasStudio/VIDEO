import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp } from "../../anim";
import { Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import { Influencer, LOT, LOT_SKY, LotLights, LuxurySet } from "../../three/ia/Studio";
import { FOTO } from "../beats";
import { SHOTS } from "../shots";
import { influencerTalk } from "../talk";

// Shot "foto" (FOTO.START → FOTO.END): "Sin imágenes generadas por IA, algunas vidas de lujo
// necesitarían… otro presupuesto." It opens on the glossy "luxury post" seen through the
// influencer's phone: the gold influencer (sunglasses, fin on the hip, peace sign) beside a shiny
// red sports car at sunset (the 2D layer frames it as a post with likes until REWIND; the top
// band y 260-420 and the bottom y > 1180 stay calm). At REWIND the camera pulls back fast and
// round: the car is a tiny toy on a road-painted board on a stool right in front of the phone, the
// sunset is a printed backdrop that a friend holds, and it is all an ordinary parking lot. By
// REVEAL the trick is clear. L12: the influencer turns to us, unbothered, lowers its sunglasses:
// «Todo es cuestión de perspectiva.»

const FOV = 40;
const INF = LOT.influencer;
/** The phone's view (the "post"): the influencer and the car framed between y ≈ 420 and 1180. */
const POST: Cam = aim([LOT.phone[0], LOT.phone[1], LOT.phone[2] - 0.05], FOV, [INF[0], 1.05, INF[2]], 600, 790, 8);
const POST_IN: Cam = aim([LOT.phone[0], LOT.phone[1], LOT.phone[2] - 0.35], FOV, [INF[0], 1.05, INF[2]], 600, 790, 8);
/** Behind-the-scenes: the toy car big in the foreground, the influencer small behind it. */
const REVEAL: Cam = aim([1.75, 1.75, 6.2], FOV, [LOT.stool[0], LOT.stoolTop + 0.1, LOT.stool[2]], 420, 1080, 10);
const L12CAM: Cam = aim([1.55, 1.65, 5.6], FOV, [LOT.stool[0], LOT.stoolTop + 0.1, LOT.stool[2]], 400, 1110, 10);
/** Mid-point of the pull-back: up and out to the side (a swooping rewind). */
const MID_POS: Vec3 = [1.1, 1.9, 5.4];

export const FotoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.foto.from;
  const t = g / 30;
  const { START, POST: POSTED, REWIND, REVEAL: REV, L12, END } = FOTO;

  // ---- Camera: slow push on the post, the fast swooping pull-back, then a slow push on L12.
  const drift = ramp(g, START, REWIND, [0, 1], Easing.inOut(Easing.sin));
  const back = ramp(g, REWIND, REWIND + 34, [0, 1], EASE_IN_OUT);
  const settle = ramp(g, L12 - 10, END, [0, 1], Easing.inOut(Easing.sin));
  const p0 = lerp3(POST.position, POST_IN.position, drift);
  const t0 = lerp3(POST.target, POST_IN.target, drift);
  const p1 = lerp3(REVEAL.position, L12CAM.position, settle);
  const t1 = lerp3(REVEAL.target, L12CAM.target, settle);
  // Quadratic Bézier through MID_POS for the position; the target slides straight.
  const b = back;
  const pos: Vec3 = [0, 1, 2].map((i) => (1 - b) * (1 - b) * p0[i] + 2 * (1 - b) * b * MID_POS[i] + b * b * p1[i]) as Vec3;
  const cam: Cam = { position: pos, target: lerp3(t0, t1, back), fov: FOV, roll: 0.06 * Math.sin(Math.PI * back) };

  // ---- Influencer: the pose for the photo; on L12 it turns to us and lowers the sunglasses.
  const toCam = Math.atan2(cam.position[0] - INF[0], cam.position[2] - INF[2]);
  const toPhone = Math.atan2(LOT.phone[0] - INF[0], LOT.phone[2] - INF[2]);
  const turn = ramp(g, L12 - 8, L12 + 8, [0, 1], EASE_IN_OUT);
  const lower = ramp(g, L12 + 10, L12 + 22, [0, 1], EASE_OUT);
  const snap = Math.sin(Math.PI * ramp(g, POSTED - 4, POSTED + 6, [0, 1], Easing.linear));
  const sway = Math.sin(t * 1.6);
  const base: NubiPose = {
    roll: 0.12 * (1 - turn) + 0.03 * sway * (1 - turn) - 0.06 * turn,
    pitch: -0.06 * (1 - turn) - 0.1 * lower,
    yaw: 0,
    hop: 0.8 * snap,
    squash: 1 + 0.03 * snap,
    finL: -0.45 * (1 - turn) - 0.2 * turn,
    finR: 1.3 * (1 - turn) + 1.6 * turn - 0.4 * lower,
    eyeScale: 0.78,
    lookY: 0.35,
    blink: 0.15,
  };
  const pose = influencerTalk(g, base, 0.7);
  const rotY = toPhone * (1 - turn) + toCam * turn;

  // ---- The friend holding the backdrop: bored, then a little wave at the reveal.
  const wave = Math.sin(Math.PI * ramp(g, REV + 6, REV + 30, [0, 1], Easing.linear));
  const friendPose: NubiPose = {
    finL: 0.75,
    finR: 0.1 + 0.9 * wave + 0.3 * wave * Math.sin(g * 0.8),
    eyeScale: 0.8,
    blink: (g % 70) < 3 ? 1 : 0.25,
    roll: -0.05 + 0.02 * Math.sin(t),
    lookX: 0.5,
  };

  return (
    <AbsoluteFill style={{ background: LOT_SKY }}>
      <Stage cam={cam} near={0.03} far={120}>
        <LotLights />
        <LuxurySet t={t} friendPose={friendPose} />
        <Influencer pose={pose} position={INF} rotationY={rotY} glassesDown={lower} peace={1 - turn} />
      </Stage>
    </AbsoluteFill>
  );
};
