import React from "react";
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
  PIZZA_R,
  PizzaSlice,
  Pizzeria,
  PriceFlag,
  VENDOR_SIZE,
  Vendor,
} from "../../three/tiempo/Market";
import { COMPRAS } from "../beats";
import { NUBI_EVENTS, extraSeconds, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// Shot 3 "pizza" (COMPRAS.PIZZA → COMPRAS.END). "Una pizza… ¡tres días!" Medium two-shot at the
// pizzeria counter: the blue chef (white hat, his counter) behind it on the right with the
// glowing dome oven, offers a huge gooey slice; Nubi, left of centre, leans in excited. At TRES
// the "3 DÍAS" flag pops up on the big pizza and Nubi recoils in shock (eyes huge, hop back),
// pushes the slice away and shakes its whole body "no".
// y 260-460 stays calm for the "PIZZA = 3 DÍAS" sticker (x 500, y 360, from TRES).

const FPS = 30;
const FOV = 38;
const P = MARKET.pizza;
const at = (v: Vec3): Vec3 => [P[0] + v[0], P[1] + v[1], P[2] + v[2]];
const NUBI: Vec3 = at([-2.2, 0, 1.55]);
const NUBI_YAW = 0.62;
const CHEF: Vec3 = at(PIZZERIA_CHEF);
const CHEF_YAW = -0.38;
const CHEF_SEED = 57;
const PIZZA_AT: Vec3 = at(PIZZERIA_PIZZA);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const PizzaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.pizza.from;
  const { PIZZA, TRES, END } = COMPRAS;
  const t = g / FPS;

  // ---- The slice: lifted off the pizza, offered towards Nubi, pushed back after the price.
  const offer = ramp(g, PIZZA, PIZZA + 16, [0, 1], EASE_IN_OUT);
  const closer = ramp(g, PIZZA + 16, TRES - 2, [0, 1], EASE_IN_OUT);
  const pushed = ramp(g, TRES + 7, TRES + 15, [0, 1], EASE_OUT);
  const sA: Vec3 = at([0.15, 1.45, -0.75]);
  const sB: Vec3 = at([-0.55, 1.42, 0.05]);
  const sC: Vec3 = at([-0.75, 1.36, 0.3]);
  const sD: Vec3 = at([0.05, 1.5, -0.55]);
  const sliceAt = lerp3(lerp3(lerp3(sA, sB, offer), sC, closer), sD, pushed);
  const sliceYaw = lerp(-0.95, -1.15, pushed) + 0.06 * Math.sin(t * 2.4);
  const sliceBob = 0.025 * Math.sin(t * 5.1) * (1 - pushed);

  // ---- The price flag pops up on the pizza.
  const flagPop = g >= TRES ? pop(g, TRES, { damping: 9, stiffness: 190 }) : 0;

  // ---- Nubi: excited, leans in; recoils at TRES, pushes the slice away, shakes "no".
  const excited = ramp(g, PIZZA, PIZZA + 10, [0, 1], EASE_OUT) * (1 - ramp(g, TRES, TRES + 2));
  const lean = ramp(g, PIZZA + 8, TRES - 1, [0, 1], EASE_IN_OUT) * (1 - ramp(g, TRES, TRES + 4, [0, 1], EASE_OUT));
  const recoil = ramp(g, TRES, TRES + 7, [0, 1], EASE_OUT);
  const jump = windowIn(g, TRES, TRES + 9, 3);
  const pushFin = windowIn(g, TRES + 5, TRES + 18, 4);
  const noK = windowIn(g, TRES + 9, END, 4) * (1 - 0.5 * ramp(g, TRES + 30, END));
  const no = Math.sin((g - TRES - 9) * 0.85) * noK;
  const base: NubiPose = {
    pitch: 0.2 * lean - 0.16 * jump,
    yaw: 0.12 * lean + 0.42 * no,
    roll: 0.06 * no,
    eyeScale: 1 + 0.32 * excited + 0.62 * recoil,
    lookX: 0.5 * (1 - recoil) * (excited + lean > 0 ? 1 : 0.4) - 0.15 * recoil,
    lookY: 0.2 * lean + 0.15 * recoil,
    finL: 0.5 * excited * (0.7 + 0.3 * Math.sin(g * 0.9)) + 0.7 * jump + 0.45 * noK * (0.5 + 0.5 * Math.sin(g * 1.7)),
    finR: 0.45 * excited * (0.7 + 0.3 * Math.cos(g * 0.9)) + 0.3 * lean + 0.75 * pushFin + 0.2 * jump,
    hop: 0.6 * excited * Math.max(0, Math.sin(g * 0.55)) + 3.2 * jump,
    squash: 1 + 0.1 * jump - 0.06 * windowIn(g, TRES + 8, TRES + 12, 1),
    wiggle: 0.5 * excited + 0.8 * jump + 0.4 * noK,
    wigglePhase: g * 0.6,
  };
  const pose = tiempoTalk(g, base, 0.8);
  const back = recoil * 0.55;
  const fwd = lean * 0.22;
  const dir: Vec3 = [Math.sin(NUBI_YAW), 0, Math.cos(NUBI_YAW)];
  const nubiAt: Vec3 = [NUBI[0] + dir[0] * (fwd - back), NUBI[1], NUBI[2] + dir[2] * (fwd - back)];
  const hopY = 0.2 * (pose.hop ?? 0);

  // ---- The chef: proudly offers the slice (left fin), startled when it's pushed back.
  const startled = windowIn(g, TRES + 8, TRES + 22, 4);
  const chefPose: NubiPose = {
    finL: 0.25 + 0.45 * offer * (1 - pushed) + 0.15 * Math.sin(t * 4) * (1 - pushed),
    finR: 0.25 + 0.5 * windowIn(g, PIZZA, PIZZA + 14, 4) * (0.6 + 0.4 * Math.sin(g * 0.7)) + 0.4 * startled,
    pitch: 0.1 * offer * (1 - pushed) - 0.08 * startled,
    lookX: -0.4,
    lookY: -0.1,
    eyeScale: 1 + 0.25 * startled,
    blink: 0.45 * (1 - startled) * windowIn(g, PIZZA + 2, TRES - 2, 4),
    squash: 1 + 0.02 * Math.sin(t * 2.1) - 0.05 * startled,
    hop: 0.6 * windowIn(g, TRES + 8, TRES + 14, 2),
  };

  // ---- Camera: front-left two-shot, slow push, a punch-in on TRES.
  const push = ramp(g, PIZZA, TRES, [0, 1], (x) => x);
  const punch = ramp(g, TRES, TRES + 5, [0, 1], EASE_OUT);
  const position: Vec3 = [lerp(8.85, 8.7, push) + 0.15 * punch, lerp(1.95, 1.9, push) + 0.1 * punch, lerp(9.4, 8.9, push) - 0.7 * punch];
  const cam = aim(position, FOV, NUBI, 375, 1262);

  const nubiC = counterAt(cam, [nubiAt[0], nubiAt[1] + 1.98 + 0.1 + hopY, nubiAt[2]]);
  const chefC = counterAt(cam, [CHEF[0], CHEF[1] + (VENDOR_SIZE / 10) * (15.7 + (chefPose.hop ?? 0)) + 0.06, CHEF[2]]);

  return (
    <AbsoluteFill style={{ background: MARKET_SKY }}>
      <Shake frame={g} impacts={[{ at: TRES, amp: 7, dur: 10 }]}>
        <Stage cam={cam} near={0.1}>
          <MarketLights />
          <MarketStreet t={t} />
          <group position={P}>
            <Pizzeria t={t} />
          </group>
          <group position={PIZZA_AT}>
            <BigPizza />
            <group position={[PIZZA_R * 0.15, 0.02, -PIZZA_R * 0.25]} rotation={[0, -0.25, 0]}>
              <PriceFlag text="3 DÍAS" pop={flagPop} t={t} size={1.15} />
            </group>
          </group>
          <group position={[sliceAt[0], sliceAt[1] + sliceBob, sliceAt[2]]} rotation={[0.08, sliceYaw, 0]}>
            <PizzaSlice t={t} goo={1 - 0.3 * pushed} />
          </group>
          <Vendor chef position={CHEF} rotationY={CHEF_YAW} pose={chefPose} shadow={false} />
          <Nubi size={2} position={nubiAt} rotationY={NUBI_YAW} pose={pose} shadowOpacity={0.4} />
          <DustPuff frame={g} at={TRES + 7} position={[nubiAt[0], 0.02, nubiAt[2]]} radius={0.9} color="#F3DFC0" />
        </Stage>
        {chefC.behind ? null : <LifeCounter frame={g} seconds={extraSeconds(CHEF_SEED, g)} x={chefC.x} y={chefC.y} scale={0.6} />}
        {nubiC.behind ? null : (
          <LifeCounter
            frame={g}
            seconds={nubiSeconds(g)}
            x={nubiC.x}
            y={nubiC.y}
            scale={0.92}
            events={NUBI_EVENTS}
            draining={nubiDraining(g)}
            frozen={nubiHolding(g)}
          />
        )}
      </Shake>
    </AbsoluteFill>
  );
};
