import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, clamp01, pop, ramp, windowIn } from "../../anim";
import { SweatDrops } from "../../inca/effects";
import { Upright } from "../../inca/outfit";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { BOTTLE_HOLD, BOTTLE_HUG, WaterBottle } from "../../three/agua/Bottle";
import {
  ALLEY_BG,
  ALLEY_COUNTER,
  ALLEY_NUBI,
  ALLEY_SAFE,
  ALLEY_SELLER,
  ALLEY_TABLE_TOP,
  Alley,
  AlleyLights,
  Coin,
  PAPER_FLAT,
  PAPER_HOLD_L,
  PAPER_HUG,
  Pencil,
  PortraitPaper,
  SAFE_BOTTLE,
  Safe,
  Seller,
} from "../../three/agua/Shops";
import { Glow } from "../../three/thanos/FX";
import { SOLUCION } from "../beats";
import { SHOTS } from "../shots";
import { aguaTalk, sellerTalk } from "../talk";

// The shady seller in the dark alley.
// V1 (PSST, OYE) Nubi's view from the street: the seller behind his crate counter under a bare
//    bulb leans out of the shadows, beckons with a fin, points: "¡oye, tú!"
// V2 (SAFE) the safe: the dial spins, the door swings open, holy light, the bottle glows.
// V3 (ULTIMA, MILLONES) the seller holds the glowing bottle up: "La última. Diez millones."
//    (the lead's gold price tag sits in the top area: he stays below y ≈ 600).
// V4 (L10, SOLES, RETRATO) Nubi, nervous, drops three coins on the counter, then pulls out a
//    sheet and a pencil (the lead's offer tag sits in the top area).
// V5 (DRAW, SHOW, IGUALITO, GIVE) the two-shot, characters in the lower half (y ≈ 880–1260):
//    Nubi scribbles, shows the portrait, the seller sobs and hugs it, hands over the bottle.

const FPS = 30;
const SELLER_YAW_NUBI = -Math.PI / 2 + 0.5;
const NUBI_YAW_SELLER = Math.PI / 2 - 0.5;
const COIN_SPOTS: Vec3[] = [
  [-0.36, 0, 0.12],
  [-0.14, 0, 0.2],
  [-0.3, 0, -0.08],
];
const PENCIL_HOLD_L = { position: [-0.2, 0.6, 1.3] as Vec3, rotation: [0.5, 0, -0.5] as Vec3, scale: 5 };

type Cam = { position: Vec3; target: Vec3; fov: number };

export const VendedorShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.vendedor.from;
  const { START, END, PSST, OYE, SAFE: SAFE_AT, ULTIMA, MILLONES, L10, SOLES, RETRATO, DRAW, SHOW, IGUALITO, GIVE } = SOLUCION;
  const t = g / FPS;
  const V1E = SAFE_AT - 6;
  const V2E = ULTIMA - 2;
  const V3E = L10 - 4;
  const V4E = DRAW;

  // ---- Shared state -------------------------------------------------------------------
  const open = ramp(g, SAFE_AT - 6, SAFE_AT + 14, [0, 1], EASE_IN_OUT);
  const bottleInSafe = g < V2E;
  const given = g >= GIVE + 5;
  const coinsDown = [0, 1, 2].map((i) => ramp(g, SOLES + i * 6, SOLES + i * 6 + 7, [0, 1], (x) => x * x));
  const paperOut = g >= RETRATO;
  const paperShown = g >= SHOW - 2;
  const paperHugged = g >= IGUALITO - 1;
  const sob = ramp(g, IGUALITO - 2, IGUALITO + 8);
  const tears = Math.min(1, sob * 1.2) * (1 - ramp(g, GIVE - 2, GIVE + 8) * 0.55);

  let cam: Cam;
  let sellerYaw = SELLER_YAW_NUBI;
  let sellerPose: NubiPose = {};
  let nubiPose: NubiPose = {};
  let nubiYaw = NUBI_YAW_SELLER;
  let showNubi = true;
  let fill = 0.9;
  let shakeAt = -100;

  if (g < V1E) {
    // V1: POV from the street, creeping in.
    showNubi = false;
    fill = 0.55;
    const u = ramp(g, START, V1E, [0, 1], (x) => x);
    const sway: Vec3 = [Math.sin(g * 0.09) * 0.06, Math.sin(g * 0.13) * 0.04, 0];
    const p = lerp3([0.25, 1.25, 7.6], [0.4, 1.2, 5.6], u);
    cam = aim([p[0] + sway[0], p[1] + sway[1], p[2]], 50, [0.85, 0.0, -3.3], 560, 1250);
    const lean = ramp(g, PSST - 4, PSST + 8, [0, 1], EASE_IN_OUT);
    const point = windowIn(g, OYE - 2, V1E + 4, 4);
    const beckon = (1 - point) * windowIn(g, PSST, OYE + 2, 4);
    const glance = Math.sin(g * 0.16) > 0.3 ? 1 : -1;
    sellerYaw = -0.75 + 0.35 * lean;
    sellerPose = sellerTalk(g, {
      roll: -0.16 * lean + 0.04 * Math.sin(g * 0.2),
      yaw: 0.22 * glance * (1 - point) * lean,
      pitch: 0.06 * lean + 0.1 * point,
      finR: 0.35 + beckon * (0.45 + 0.4 * Math.sin(g * 0.75)) + point * 0.75,
      finL: -0.1,
      squash: 1 - 0.05 * lean,
    });
  } else if (g < V2E) {
    // V2: the safe opens; the seller presents it.
    showNubi = false;
    const u = ramp(g, V1E, V2E, [0, 1], (x) => x);
    cam = aim(lerp3([-1.05, 2.35, -0.3], [-0.85, 2.2, -0.75], u), 46, [ALLEY_SAFE[0] - 0.25, 0.7, ALLEY_SAFE[2] + 0.4], 560, 1000);
    const ta = pop(g, SAFE_AT + 2);
    sellerYaw = -Math.PI / 2 - 0.15;
    sellerPose = sellerTalk(g, { finL: 0.25 + 0.6 * ta, finR: 0.25 + 0.6 * ta, hop: 0.4 * ta * Math.max(0, 1 - (g - SAFE_AT) / 12), roll: 0.05 });
  } else if (g < V3E) {
    // V3: "La última. Diez millones." — holding the bottle up for Nubi (the camera).
    showNubi = false;
    const u = ramp(g, V2E, V3E, [0, 1], (x) => x);
    cam = aim(lerp3([1.6, 1.85, 6.8], [1.7, 1.75, 5.9], u), 40, [ALLEY_SELLER[0] + 0.35, 0, ALLEY_SELLER[2]], 540, 1375);
    const lift = pop(g, V2E + 2);
    const lean = windowIn(g, MILLONES - 3, V3E + 4, 6);
    sellerYaw = -0.3 - 0.15 * lean;
    sellerPose = sellerTalk(g, {
      finR: 0.55 + 0.45 * lift,
      finL: 0.1 + 0.25 * lean,
      pitch: 0.14 * lean,
      roll: -0.06 + 0.04 * Math.sin(g * 0.15),
      yaw: 0.12 * Math.sin(g * 0.07),
    });
  } else if (g < V4E) {
    // V4: Nubi's offer. Nervous; three coins; then the sheet and the pencil.
    const u = ramp(g, V3E, V4E, [0, 1], (x) => x);
    cam = aim(lerp3([-0.9, 2.1, 9.0], [-0.85, 2.0, 8.1], u), 40, [-0.9, 0, ALLEY_NUBI[2]], 540, 1262);
    const drop = windowIn(g, SOLES - 4, SOLES + 18, 4);
    const paper = ramp(g, RETRATO - 2, RETRATO + 8);
    nubiPose = aguaTalk(g, {
      finL: 0.15 + 0.55 * drop + 0.4 * paper,
      finR: 0.1 + 0.4 * paper,
      eyeScale: 0.95 + 0.25 * paper,
      lookX: 0.5 - 0.6 * drop,
      lookY: -0.4 * drop,
      roll: 0.04 * Math.sin(g * 0.6) * (1 - paper),
      squash: 1 - 0.04 * (1 - paper),
    });
    sellerPose = { finR: 0.55, finL: 0.1, roll: -0.05, pitch: 0.06 * windowIn(g, SOLES, RETRATO, 8) };
  } else {
    // V5: the wide two-shot (characters in the lower half).
    const u = ramp(g, V4E, END, [0, 1], (x) => x);
    cam = aim(lerp3([0.15, 2.7, 14.6], [0.15, 2.6, 13.9], u), 32, [0.0, 0, -3.05], 540, 1268);
    const scribble = windowIn(g, DRAW, SHOW - 2, 2);
    const show = windowIn(g, SHOW - 2, IGUALITO + 2, 3);
    const happy = ramp(g, GIVE + 2, GIVE + 10);
    nubiPose = aguaTalk(g, {
      pitch: 0.22 * scribble - 0.05 * happy,
      finL: scribble * (0.15 + 0.35 * Math.abs(Math.sin(g * 1.9))) + show * 0.75 + happy * 0.3,
      finR: 0.1 * scribble + happy * 0.4,
      roll: scribble * 0.05 * Math.sin(g * 2.3),
      squash: 1 + scribble * 0.03 * Math.sin(g * 3.1),
      lookY: -0.5 * scribble,
      lookX: 0.3,
      eyeScale: 1 + 0.25 * show + 0.15 * happy,
      hop: happy * 0.8 * Math.abs(Math.sin((g - GIVE) * 0.45)),
      wiggle: happy * 0.7,
      wigglePhase: g * 0.6,
    });
    const shudder = sob * Math.sin(g * 2.4);
    const give = windowIn(g, GIVE - 3, GIVE + 6, 3);
    sellerPose = sellerTalk(g, {
      finL: sob * (0.25 + 0.05 * shudder) + 0.15 * windowIn(g, SHOW - 2, IGUALITO, 3),
      finR: 0.55 - 0.3 * sob + 0.5 * give,
      squash: 1 + 0.04 * shudder,
      roll: 0.06 * shudder,
      pitch: -0.12 * sob + 0.12 * give,
      hop: 0.15 * Math.max(0, shudder),
    });
    if (g >= GIVE) shakeAt = GIVE + 4;
  }

  // ---- Props ---------------------------------------------------------------------------
  const sellerFinR = sellerPose.finR ?? 0;
  const nubiFinL = nubiPose.finL ?? 0;
  const bottle = <WaterBottle fill={fill} glow={bottleInSafe ? 0.2 + 0.3 * open : 0.5} t={t} />;
  const sellerHoldsBottle = !bottleInSafe && !given;
  const pencilInFin = g >= RETRATO && g < SHOW - 2;
  const paperInFin = paperShown && !paperHugged;

  const nubi = showNubi ? (
    <Nubi
      size={2}
      position={ALLEY_NUBI}
      rotationY={nubiYaw}
      pose={nubiPose}
      shadowOpacity={0.45}
      holdL={
        pencilInFin ? (
          <Upright raise={nubiFinL} side="L">
            <group {...PENCIL_HOLD_L}>
              <Pencil />
            </group>
          </Upright>
        ) : paperInFin ? (
          <Upright raise={nubiFinL} side="L">
            <group {...PAPER_HOLD_L}>
              <PortraitPaper sketch={0.9} />
            </group>
          </Upright>
        ) : null
      }
    >
      {given ? (
        <group position={BOTTLE_HUG.position} rotation={BOTTLE_HUG.rotation} scale={BOTTLE_HUG.scale * (0.85 + 0.15 * pop(g, GIVE + 5))}>
          <WaterBottle fill={fill} glow={0.6} t={t} />
        </group>
      ) : null}
    </Nubi>
  ) : null;

  const seller = (
    <Seller
      position={ALLEY_SELLER}
      rotationY={sellerYaw}
      pose={sellerPose}
      tears={tears}
      t={t}
      holdR={
        sellerHoldsBottle ? (
          <Upright raise={sellerFinR}>
            <group {...BOTTLE_HOLD}>{bottle}</group>
          </Upright>
        ) : null
      }
    >
      {paperHugged ? (
        <group position={PAPER_HUG.position} rotation={PAPER_HUG.rotation} scale={PAPER_HUG.scale * (0.9 + 0.1 * pop(g, IGUALITO))}>
          <PortraitPaper sketch={0.9} />
        </group>
      ) : null}
    </Seller>
  );

  // The paper lies on the counter while Nubi draws.
  const paperOnCounter = paperOut && !paperShown && g >= DRAW - 1;
  const top = ALLEY_COUNTER[1] + ALLEY_TABLE_TOP;

  // Holy flash when the safe opens.
  const holy = windowIn(g, SAFE_AT - 1, SAFE_AT + 22, 3) * (g < V2E ? 1 : 0);
  const dark = g < V1E ? 1 : 0;

  return (
    <AbsoluteFill style={{ background: ALLEY_BG }}>
      <Shake frame={g} impacts={[{ at: shakeAt, amp: 6, dur: 10 }]}>
        <Stage cam={cam} near={0.05}>
          <AlleyLights t={t} k={dark ? 0.75 : 1} />
          <Alley t={t} />
          <group position={ALLEY_SAFE}>
            <Safe open={open} t={t} hinge={-1} glow={g < V2E + 40 ? open : 0.35}>
              {bottleInSafe ? (
                <group position={SAFE_BOTTLE.position} scale={SAFE_BOTTLE.scale}>
                  {bottle}
                </group>
              ) : null}
            </Safe>
          </group>
          {seller}
          {nubi}
          {/* Coins falling onto the counter one by one. */}
          {coinsDown.map((k, i) =>
            g >= SOLES + i * 6 ? (
              <group
                key={i}
                position={[ALLEY_COUNTER[0] + COIN_SPOTS[i][0], top + (1 - k) * 0.9 + (k >= 1 ? 0.04 * Math.max(0, Math.sin((g - SOLES - i * 6 - 7) * 0.9)) * Math.exp(-(g - SOLES - i * 6 - 7) * 0.25) : 0), ALLEY_COUNTER[2] + COIN_SPOTS[i][2]]}
                rotation={[(1 - k) * 2.4, i * 0.7, 0]}
              >
                <Coin />
              </group>
            ) : null,
          )}
          {coinsDown.map((k, i) =>
            k >= 1 ? (
              <Glow key={`g${i}`} color="#FFE27A" size={0.5 * Math.max(0, 1 - (g - SOLES - i * 6 - 7) / 8)} opacity={0.9} position={[ALLEY_COUNTER[0] + COIN_SPOTS[i][0], top + 0.05, ALLEY_COUNTER[2] + COIN_SPOTS[i][2]]} />
            ) : null,
          )}
          {paperOnCounter ? (
            <group position={[ALLEY_COUNTER[0] - 0.05, top + PAPER_FLAT.position[1], ALLEY_COUNTER[2]]} rotation={PAPER_FLAT.rotation}>
              <PortraitPaper sketch={clamp01((g - DRAW) / 18)} />
            </group>
          ) : null}
          {g >= V3E && g < V4E ? <SweatDrops frame={g} from={L10 + 2} to={RETRATO} position={[ALLEY_NUBI[0], 1.8, ALLEY_NUBI[2] + 0.3]} spread={0.75} /> : null}
        </Stage>
      </Shake>
      {/* The dark of the alley around the POV, the holy flash of the safe. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 55% 55%, rgba(10,4,20,0) 35%, rgba(10,4,20,0.75) 100%)", opacity: dark }} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 52% 52%, rgba(255,240,190,0.85) 0%, rgba(255,220,140,0.25) 35%, rgba(255,220,140,0) 70%)", opacity: holy * 0.45, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};
