import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, pop, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  BigPizza,
  MARKET,
  MARKET_SKY,
  MarketLights,
  MarketStreet,
  PIZZERIA_CHEF,
  PIZZERIA_PIZZA,
  PizzaSlice,
  Pizzeria,
  PriceFlag,
  VENDOR_SIZE,
  Vendor,
  slicePoint,
} from "../../three/tiempo/Market";
import { COMPRAS } from "../beats";
import { NUBI_EVENTS, extraSeconds, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// Shot 3 "pizza" (COMPRAS.PIZZA → COMPRAS.END). "Una pizza… ¡tres días!" Two-shot at the
// pizzeria counter. The blue chef (white hat, his counter) lifts a huge gooey slice off the big
// pizza and holds it out, crust up, its top to the camera, in the middle of the frame (x ≈ 480-760),
// the dome oven glowing behind it; Nubi, on the left, leans in excited. At TRES the "3 DÍAS" flag
// pops up out of the slice, Nubi recoils in shock (eyes huge, hop back to the left), pushes the
// slice away and shakes its whole body "no".
// y 260-460 stays calm for the "PIZZA = 3 DÍAS" sticker (x 500, y 360, from TRES).

const FPS = 30;
const FOV = 36;
const P = MARKET.pizza;
const at = (v: Vec3): Vec3 => [P[0] + v[0], P[1] + v[1], P[2] + v[2]];
const NUBI: Vec3 = at([-2.15, 0, 1.0]);
const NUBI_YAW = 0.42;
const CHEF: Vec3 = at(PIZZERIA_CHEF);
const CHEF_YAW = -0.32;
const CHEF_SEED = 57;
const PIZZA_AT: Vec3 = at(PIZZERIA_PIZZA);
const SLICE = { R: 1.5, droop: 0.14 };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const PizzaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.pizza.from;
  const { PIZZA, TRES, END } = COMPRAS;
  const t = g / FPS;

  // ---- The slice: lifted off the pizza, held out crust up in the middle, nudged towards Nubi,
  // pushed back after the price.
  const offer = ramp(g, PIZZA, PIZZA + 14, [0, 1], EASE_IN_OUT);
  const closer = ramp(g, PIZZA + 14, TRES - 2, [0, 1], EASE_IN_OUT);
  const pushed = ramp(g, TRES + 7, TRES + 15, [0, 1], EASE_OUT);
  const sA = at([0.25, 1.6, 0.0]);
  const sB = at([-0.28, 2.18, 0.15]);
  const sC = at([-0.45, 2.12, 0.25]);
  const sD = at([-0.12, 2.2, 0.0]);
  const sliceAt = lerp3(lerp3(lerp3(sA, sB, offer), sC, closer), sD, pushed);
  const sliceBob = 0.025 * Math.sin(t * 5.1) * (1 - pushed);
  const tilt = lerp(0.25, 1.02, offer) - 0.12 * pushed;
  const sliceYaw = -0.12 + 0.05 * Math.sin(t * 2.4) + 0.25 * pushed;
  const slicePos: Vec3 = [sliceAt[0], sliceAt[1] + sliceBob, sliceAt[2]];

  // ---- The price flag pops up out of the slice.
  const flagPop = g >= TRES ? pop(g, TRES, { damping: 9, stiffness: 190 }) : 0;
  const foot = new THREE.Vector3(...slicePoint(0.4, SLICE.R, SLICE.droop, tilt)).applyAxisAngle(new THREE.Vector3(0, 1, 0), sliceYaw);
  const flagAt: Vec3 = [slicePos[0] + foot.x, slicePos[1] + foot.y, slicePos[2] + foot.z];

  // ---- Nubi: excited, leans in; recoils at TRES, pushes the slice away, shakes "no".
  const excited = ramp(g, PIZZA, PIZZA + 10, [0, 1], EASE_OUT) * (1 - ramp(g, TRES, TRES + 2));
  const lean = ramp(g, PIZZA + 8, TRES - 1, [0, 1], EASE_IN_OUT) * (1 - ramp(g, TRES, TRES + 4, [0, 1], EASE_OUT));
  const recoil = ramp(g, TRES, TRES + 7, [0, 1], EASE_OUT);
  const jump = windowIn(g, TRES, TRES + 9, 3);
  const pushFin = windowIn(g, TRES + 5, TRES + 18, 4);
  const noK = windowIn(g, TRES + 9, END, 4) * (1 - 0.5 * ramp(g, TRES + 30, END));
  const no = Math.sin((g - TRES - 9) * 0.85) * noK;
  const base: NubiPose = {
    pitch: 0.2 * lean - 0.2 * jump,
    yaw: 0.15 * lean + 0.42 * no - 0.15 * recoil * (1 - noK),
    roll: 0.06 * no + 0.08 * jump,
    eyeScale: 1 + 0.32 * excited + 0.65 * recoil,
    lookX: 0.55 * (excited + lean > 0 ? 1 : 0.4) * (1 - recoil) + 0.35 * recoil,
    lookY: 0.25 * lean + 0.2 * recoil,
    finL: 0.5 * excited * (0.7 + 0.3 * Math.sin(g * 0.9)) + 0.75 * jump + 0.45 * noK * (0.5 + 0.5 * Math.sin(g * 1.7)),
    finR: 0.45 * excited * (0.7 + 0.3 * Math.cos(g * 0.9)) + 0.35 * lean + 0.8 * pushFin + 0.2 * jump,
    hop: 0.6 * excited * Math.max(0, Math.sin(g * 0.55)) + 3.4 * jump,
    squash: 1 + 0.1 * jump - 0.06 * windowIn(g, TRES + 8, TRES + 12, 1),
    wiggle: 0.5 * excited + 0.8 * jump + 0.4 * noK,
    wigglePhase: g * 0.6,
  };
  const pose = tiempoTalk(g, base, 0.8);
  const shift = 0.16 * lean - 0.32 * recoil;
  const nubiAt: Vec3 = [NUBI[0] + shift, NUBI[1], NUBI[2] + 0.1 * shift];
  const hopY = 0.2 * (pose.hop ?? 0);

  // ---- The chef: proudly holds the slice out (left fin), startled when it's pushed back.
  const startled = windowIn(g, TRES + 8, TRES + 22, 4);
  const chefPose: NubiPose = {
    finL: 0.35 + 0.55 * offer * (1 - 0.6 * pushed) + 0.1 * Math.sin(t * 4) * (1 - pushed),
    finR: 0.2 + 0.5 * windowIn(g, PIZZA + 4, PIZZA + 18, 4) * (0.6 + 0.4 * Math.sin(g * 0.7)) + 0.45 * startled,
    pitch: 0.08 * offer * (1 - pushed) - 0.1 * startled,
    lookX: -0.45,
    lookY: -0.05,
    eyeScale: 1 + 0.3 * startled,
    blink: 0.5 * (1 - startled) * windowIn(g, PIZZA + 4, TRES - 2, 4),
    squash: 1 + 0.02 * Math.sin(t * 2.1) - 0.05 * startled,
    hop: 0.6 * windowIn(g, TRES + 8, TRES + 14, 2),
  };

  // ---- Camera: front-left, the slice in the middle; slow push, a punch-in on TRES.
  const push = ramp(g, PIZZA, TRES, [0, 1], (x) => x);
  const punch = ramp(g, TRES, TRES + 5, [0, 1], EASE_OUT);
  const look: Vec3 = at([lerp(-0.42, -0.62, punch), 1.45, 0.4]);
  const position: Vec3 = at([-0.6 - 0.1 * punch, lerp(2.0, 1.95, push), 0.4 + lerp(17.0, 16.3, push) - 1.6 * punch]);
  const cam = aim(position, FOV, look, lerp(590, 575, punch), 905);

  const nubiC = counterAt(cam, [nubiAt[0], nubiAt[1] + 1.98 + 0.1 + hopY, nubiAt[2]]);
  const chefC = counterAt(cam, [CHEF[0], CHEF[1] + (VENDOR_SIZE / 10) * (15.0 + (chefPose.hop ?? 0)) + 0.06, CHEF[2]]);

  return (
    <AbsoluteFill style={{ background: MARKET_SKY }}>
      <Shake frame={g} impacts={[{ at: TRES, amp: 7, dur: 10 }]}>
        <Stage cam={cam} near={0.1}>
          <MarketLights />
          <MarketStreet t={t} />
          <group position={P}>
            <Pizzeria t={t} />
          </group>
          <group position={PIZZA_AT} rotation={[0.42, -0.1, 0]}>
            <BigPizza />
          </group>
          <group position={slicePos} rotation={[0, sliceYaw, 0]}>
            <PizzaSlice R={SLICE.R} droop={SLICE.droop} tilt={tilt} t={t} goo={1 - 0.3 * pushed} />
          </group>
          <group position={flagAt} rotation={[0, sliceYaw * 0.5, 0.06 * Math.sin(t * 3)]}>
            <PriceFlag text="3 DÍAS" pop={flagPop} t={t} size={1.3} side={1} />
          </group>
          <Vendor chef position={CHEF} rotationY={CHEF_YAW} pose={chefPose} shadow={false} />
          <Nubi size={2} position={nubiAt} rotationY={NUBI_YAW} pose={pose} shadowOpacity={0.4} />
          <DustPuff frame={g} at={TRES + 7} position={[nubiAt[0], 0.02, nubiAt[2]]} radius={0.9} color="#F3DFC0" />
        </Stage>
        {chefC.behind ? null : <LifeCounter frame={g} seconds={extraSeconds(CHEF_SEED, g)} x={chefC.x} y={chefC.y} scale={0.58} />}
        {nubiC.behind ? null : (
          <LifeCounter
            frame={g}
            seconds={nubiSeconds(g)}
            x={nubiC.x}
            y={nubiC.y}
            scale={0.9}
            events={NUBI_EVENTS}
            draining={nubiDraining(g)}
            frozen={nubiHolding(g)}
          />
        )}
      </Shake>
    </AbsoluteFill>
  );
};
