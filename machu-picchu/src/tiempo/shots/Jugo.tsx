import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, keyframes, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  JuiceCup,
  JuiceKiosk,
  KIOSK,
  KIOSK_VENDOR,
  MARKET,
  MARKET_SKY,
  MarketLights,
  MarketStreet,
  VENDOR_SIZE,
  Vendor,
} from "../../three/tiempo/Market";
import { COMPRAS } from "../beats";
import { NUBI_EVENTS, extraSeconds, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// Shot 2 "jugo" (COMPRAS.START → COMPRAS.PIZZA). "Un jugo cuesta seis horas." Medium two-shot at
// the juice kiosk: Nubi left of centre (feet ≈ y 1260), the orange vendor behind his counter on
// the right, the contactless terminal on its stand between them, the "JUGOS" menu (prices in
// hours) on the counter front. At TAP Nubi taps its fin on the terminal (beep flash); at SEIS the
// screen shows "−6 H" and Nubi's counter pops "−6 HORAS"; the vendor slides the juice over and
// Nubi takes it; at SLURP it holds the cup to its face and slurps it down, happy squint.
// y 260-460 stays calm for the "JUGO = 6 HORAS" sticker (x 500, y 360, from SEIS).

const FPS = 30;
const FOV = 38;
const K = MARKET.juice;
const at = (v: Vec3): Vec3 => [K[0] + v[0], K[1] + v[1], K[2] + v[2]];
const NUBI: Vec3 = at([-2.75, 0, 1.6]);
const NUBI_YAW = 0.78;
const VENDOR: Vec3 = at(KIOSK_VENDOR);
const VENDOR_YAW = -0.42;
const VENDOR_SEED = 41;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** A point in Nubi's own frame (x right, y up, z forward) to world. */
const nubiLocal = (v: Vec3, hopY = 0): Vec3 => {
  const c = Math.cos(NUBI_YAW);
  const s = Math.sin(NUBI_YAW);
  return [NUBI[0] + v[0] * c + v[2] * s, NUBI[1] + v[1] + hopY, NUBI[2] - v[0] * s + v[2] * c];
};

export const JugoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.jugo.from;
  const { START, TAP, SEIS, SLURP, PIZZA } = COMPRAS;
  const t = g / FPS;

  // ---- The tap and the charge.
  const beep = g >= TAP ? Math.max(0, 1 - (g - TAP) / 9) : 0;
  const screen = g >= SEIS ? "paid" : g >= TAP ? "tap" : "idle";

  // ---- Nubi: talks; raises its fin and taps; flinches at the price; takes the juice; slurps.
  const finUp = keyframes(g, [TAP - 12, TAP - 4, TAP, TAP + 7, TAP + 13], [0.05, 0.95, 0.3, 0.3, 0.05]);
  const tapJolt = windowIn(g, TAP, TAP + 5, 1);
  const flinch = windowIn(g, SEIS, SEIS + 12, 2);
  const grab = ramp(g, SEIS + 9, SEIS + 15, [0, 1], EASE_OUT);
  const lift = ramp(g, SEIS + 15, SLURP - 1, [0, 1], EASE_IN_OUT);
  const slurp = g >= SLURP ? 1 : 0;
  const sip = slurp * (0.5 + 0.5 * Math.sin((g - SLURP) * 1.3));
  const base: NubiPose = {
    finR: finUp * (1 - grab) + grab * lerp(0.45, 0.85, lift),
    finL: 0.08 + 0.35 * flinch + 0.25 * slurp,
    lookX: 0.45 * (1 - lift) - 0.1 * lift,
    lookY: -0.25 * windowIn(g, TAP - 10, TAP + 8, 4) + 0.1 * lift,
    eyeScale: 1 + 0.3 * flinch - 0.12 * slurp,
    blink: 0.6 * slurp,
    hop: 0.6 * tapJolt + 0.9 * flinch * (g < SEIS + 6 ? 1 : 0),
    squash: 1 - 0.05 * sip + 0.04 * tapJolt,
    wiggle: 0.35 * slurp,
    wigglePhase: g * 0.5,
    yaw: 0.1 * slurp * Math.sin(g * 0.3),
  };
  const pose = tiempoTalk(g, base, slurp ? 0.5 : 0.9);
  const hopY = 0.2 * (pose.hop ?? 0);

  // ---- The vendor: waves, gestures at the terminal, slides the juice over, gives a thumbs-up.
  const wave = windowIn(g, START, START + 20, 5);
  const hand = windowIn(g, SEIS - 4, SEIS + 13, 4);
  const vendorPose: NubiPose = {
    finL: wave * (0.7 + 0.3 * Math.sin(g * 0.8)) + hand * 0.55 + 0.05,
    finR: 0.1 + 0.7 * windowIn(g, SLURP - 2, PIZZA + 4, 5),
    yaw: -0.15 * hand,
    pitch: 0.1 * hand,
    lookX: -0.35 + 0.2 * hand,
    lookY: -0.15,
    squash: 1 + 0.02 * Math.sin(t * 2.3),
    hop: 0.5 * windowIn(g, SLURP, SLURP + 8, 3),
    eyeScale: 1 + 0.12 * windowIn(g, SEIS, SEIS + 10, 3),
  };

  // ---- The juice cup: on the counter, slid to its left end, taken, lifted to Nubi's face.
  const counterTop = KIOSK.h + 0.08;
  const p0 = at([0.35, counterTop, 0.05]);
  const p1 = at([-1.12, counterTop, 0.22]);
  const pHold = nubiLocal([1.35, 0.95, 0.55], hopY);
  const pFace = nubiLocal([0.28, 0.62, 1.12], hopY);
  const slide = ramp(g, SEIS - 3, SEIS + 8, [0, 1], EASE_IN_OUT);
  let cupAt = lerp3(p0, p1, slide);
  if (grab > 0) cupAt = lerp3(cupAt, pHold, grab);
  if (lift > 0) cupAt = lerp3(pHold, pFace, lift);
  const cupTilt = -0.35 * lift;
  const fill = g < SLURP ? 0.92 : Math.max(0.06, 0.92 - 0.86 * ramp(g, SLURP, SLURP + 13, [0, 1], (x) => x));
  const showCup = g >= SEIS - 3;

  // ---- Camera: front-left, slow push-in.
  const push = ramp(g, START, PIZZA, [0, 1], (x) => x);
  const position: Vec3 = [lerp(-11.1, -11.35, push), lerp(1.95, 1.85, push), lerp(9.6, 8.9, push)];
  const cam = aim(position, FOV, NUBI, 385, 1262);

  const nubiC = counterAt(cam, [NUBI[0], NUBI[1] + 1.98 + 0.1 + hopY, NUBI[2]]);
  const vendorHead: Vec3 = [VENDOR[0], VENDOR[1] + VENDOR_SIZE * 0.99 + 0.14 + (VENDOR_SIZE / 10) * (vendorPose.hop ?? 0), VENDOR[2]];
  const vendorC = counterAt(cam, vendorHead);

  return (
    <AbsoluteFill style={{ background: MARKET_SKY }}>
      <Shake
        frame={g}
        impacts={[
          { at: TAP, amp: 2.5, dur: 6 },
          { at: SEIS, amp: 4, dur: 9 },
        ]}
      >
        <Stage cam={cam} near={0.1}>
          <MarketLights />
          <MarketStreet t={t} />
          <group position={K}>
            <JuiceKiosk t={t} screen={screen} beep={beep} blend={windowIn(g, START, TAP - 6, 4)} />
          </group>
          <Vendor position={VENDOR} rotationY={VENDOR_YAW} pose={vendorPose} shadow={false} />
          <Nubi size={2} position={NUBI} rotationY={NUBI_YAW} pose={pose} shadowOpacity={0.4} />
          {showCup ? (
            <group position={cupAt} rotation={[cupTilt, NUBI_YAW, 0]}>
              <JuiceCup fill={fill} t={t} />
            </group>
          ) : null}
        </Stage>
        {vendorC.behind ? null : <LifeCounter frame={g} seconds={extraSeconds(VENDOR_SEED, g)} x={vendorC.x} y={vendorC.y} scale={0.62} />}
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
