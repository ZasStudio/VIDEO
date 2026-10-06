import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, keyframes, pop, ramp, windowIn } from "../../anim";
import { MoneyCounter } from "../../overlay/dormir/DormirUI";
import { Shake, Stage } from "../../scenes/common";
import { FONT } from "../../theme";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  BAKER_CHUB,
  BAKER_HAT_TOP,
  BAKER_SIZE,
  BAKERY,
  Baker,
  BakeryCounter,
  BakeryStreet,
  BreadBasket,
  COOK_HAT_TOP,
  COOK_SIZE,
  CashRegister,
  Chalkboard,
  Cook,
  DingLines,
  FryingPan,
  Loaf,
  PriceFlag,
  RESTO,
  STREET_SKY,
  ServiceBell,
  SnotBubble,
  Steam,
  StovePot,
  StreetLights,
  mixPose,
  nubiPoint,
  snore,
} from "../../three/dormir/Street";
import { MUNDO } from "../beats";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { nubiTalk, panaderoTalk } from "../talk";
import { DORMIR } from "../timeline";

// Shot "mundo" (MUNDO.START → MUNDO.END). L08 (Nubi) «Y si todos ganaban durmiendo… ¿quién iba a
// preparar la comida?». A sunny morning bakery corner seen from the front-left: Nubi hops in to
// the left end of the sidewalk counter, where the baker (chubby, tall hat, moustache) sleeps
// slumped over the bread, snoring (snot bubble, zzz) while his green counter climbs. On QUIEN a
// whip-pan next door: the cook asleep face-down on the stove, his counter climbing too; whip back.
// BELL: Nubi slams the service bell (ding), the bubble pops; YAWN: the baker rises in a huge
// stretch, his counter freezes. L09 «Un pan… cien soles.»: grumpy, on "cien" he slaps the loaf and
// its «S/100» flag springs up. L10 «¿Tiene oro?»: Nubi's eyes go huge, it hops back, leans in to
// inspect the loaf. L11 «No. Me hiciste levantar.»: head shake, then he jabs a fin up at his
// frozen counter; at the end of the line he flops straight back to sleep and it climbs again.

const FPS = 30;
const FOV = 38;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ---- Staging (world units; the counter spans x −0.9..1.9 in front of the bakery).
const C = BAKERY.counter;
const TOP = C.h;
const NUBI: Vec3 = [-2.02, 0, -0.02];
const NUBI_YAW = 0.35;
const BAKER: Vec3 = BAKERY.baker;
const BAKER_YAW = -0.32;
const BELL: Vec3 = [-0.62, TOP, -0.27];
const LOAF: Vec3 = [0.02, TOP, -0.18];
const COOK: Vec3 = RESTO.cook;

// Extra word beats of the lines (from the voice timing, never hard-coded).
const CIEN = DORMIR.wordAt("L09", 2);
const ORO = DORMIR.wordAt("L10", 1);
const ME = DORMIR.wordAt("L11", 1);
const LEVANTAR = DORMIR.wordAt("L11", 3);
const L08_END = DORMIR.lineEnd("L08");
const L11_END = DORMIR.lineEnd("L11");

/** Floating "Z"s rising from a sleeper's head (screen space). */
const Zzz: React.FC<{ g: number; x: number; y: number; scale?: number; on?: number; every?: number; life?: number; dir?: 1 | -1 }> = ({
  g,
  x,
  y,
  scale = 1,
  on = 1,
  every = 16,
  life = 44,
  dir = 1,
}) => {
  if (on <= 0.01) return null;
  const n = Math.ceil(life / every);
  const base = Math.floor(g / every);
  return (
    <>
      {Array.from({ length: n + 1 }, (_, i) => {
        const spawn = (base - i) * every;
        const age = g - spawn;
        if (age < 0 || age >= life) return null;
        const k = age / life;
        const big = (base - i) % 3 === 0;
        const size = (big ? 64 : 46) * (0.6 + 0.6 * k) * scale;
        const px = x + dir * (24 + 120 * k + 16 * Math.sin(age * 0.18 + i)) * scale;
        const py = y - 210 * k * scale;
        const op = on * Math.min(1, k * 6) * Math.pow(1 - k, 0.8);
        return (
          <div
            key={spawn}
            style={{
              position: "absolute",
              left: px,
              top: py,
              transform: `translate(-50%, -50%) rotate(${dir * (-12 + 18 * k)}deg)`,
              fontFamily: FONT.title,
              fontSize: size,
              color: "#E9F6FF",
              WebkitTextStroke: `${4 * scale}px #2B3A66`,
              paintOrder: "stroke fill",
              textShadow: "0 4px 0 rgba(43,58,102,0.45)",
              opacity: op,
              lineHeight: 1,
            }}
          >
            Z
          </div>
        );
      })}
    </>
  );
};

export const MundoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.mundo.from;
  const { START, L08, QUIEN, BELL: RING, YAWN, L09, L10, L11 } = MUNDO;
  const t = g / FPS;

  // ---- Timing of the cutaway (whip-pan next door and back) and of the baker's sleep.
  const WHIP_OUT = QUIEN - 4;
  const WHIP_BACK = Math.min(RING - 13, Math.max(QUIEN + 26, L08_END - 12));
  const WHIP = 6;
  const toCook = ramp(g, WHIP_OUT, WHIP_OUT + WHIP, [0, 1], EASE_IN_OUT) * (1 - ramp(g, WHIP_BACK, WHIP_BACK + WHIP, [0, 1], EASE_IN_OUT));
  const whipBlur = Math.sin(Math.PI * clamp01((g - WHIP_OUT) / WHIP)) + Math.sin(Math.PI * clamp01((g - WHIP_BACK) / WHIP));
  const RESLEEP = L11_END - 2;

  // ---- The baker: asleep (slumped, snoring) → startled by the bell → huge yawn → grumpy; the
  // slap on "cien"; "No." head shake; points at his frozen counter; flops back to sleep.
  const sn = snore(g, 50, 8);
  const wake = ramp(g, RING + 2, YAWN + 6, [0, 1], EASE_OUT) * (1 - ramp(g, RESLEEP, RESLEEP + 9, [0, 1], EASE_IN_OUT));
  const asleep = 1 - wake;
  const jolt = windowIn(g, RING + 1, RING + 9, 2);
  const yawn = windowIn(g, YAWN, L09 + 3, 6);
  const slapFin = keyframes(g, [CIEN - 12, CIEN - 4, CIEN, CIEN + 6, CIEN + 14], [0.05, 1.05, -0.3, -0.1, 0.05]);
  const slapHit = windowIn(g, CIEN, CIEN + 7, 1);
  const shakeNo = windowIn(g, L11, ME - 1, 3) * Math.sin((g - L11) * 0.9);
  const point = windowIn(g, ME - 2, RESLEEP + 2, 4);
  const jab = point * (0.12 * Math.max(0, Math.sin((g - ME) * 0.55)));
  const sleepPose: NubiPose = {
    pitch: 0.12 + 0.03 * sn.breath,
    roll: 0.36,
    yaw: 0.12,
    hop: -1.9 + 0.35 * sn.breath,
    squash: 0.96 + 0.06 * sn.breath,
    blink: 1,
    finL: -0.5,
    finR: -0.15,
    lookY: -0.2,
  };
  const awakePose: NubiPose = {
    pitch: 0.06 - 0.22 * yawn,
    roll: 0.04 * Math.sin(g * 0.05),
    yaw: -0.05 + 0.12 * shakeNo,
    hop: 1.1 * yawn + 0.8 * jolt - 0.5 * slapHit,
    squash: 1 + 0.17 * yawn - 0.06 * slapHit,
    blink: 0.9 * yawn,
    finL: lerp(0.05, 1.2, yawn) + (g >= CIEN - 14 && g < CIEN + 16 ? slapFin - 0.05 : 0),
    finR: lerp(0.05, 1.2, yawn) + point * 1.05 + jab,
    lookX: -0.45 * (1 - point) + 0.1 * point,
    lookY: 0.55 * windowIn(g, ME, LEVANTAR + 6, 4) - 0.15 * windowIn(g, CIEN - 6, CIEN + 10, 3),
    eyeScale: 1 + 0.35 * jolt * (1 - yawn) - 0.1 * yawn,
  };
  const bakerBase = mixPose(sleepPose, awakePose, wake);
  const bakerPose = panaderoTalk(g, bakerBase, 0.9 * wake);
  const droop = wake * (0.55 + 0.1 * windowIn(g, L10, L11, 6)) * (1 - jolt) * (1 - yawn);

  // ---- The snot bubble: grows on each exhale, pops on the bell; back for the final flop.
  const bubbleOn = g < RING + 1 ? 1 : ramp(g, RESLEEP + 8, RESLEEP + 14);
  const bubble = bubbleOn * (0.35 + 0.65 * sn.out);
  const burst = g < RESLEEP ? ramp(g, RING + 1, RING + 5, [0, 1], (x) => x) : 0;

  // ---- Nubi: hops in; talks L08 at the baker; slams the bell; flinches at the slap; "¿Tiene oro?"
  // with huge eyes (hops back, then leans in to inspect the loaf); deflates on L11.
  const walk = ramp(g, START, L08 + 4, [0, 1], (x) => x);
  const walking = g < L08 + 4 ? 1 : 0;
  const nubiPos: Vec3 = [lerp(-3.9, NUBI[0], EASE_OUT(walk)), 0, lerp(0.5, NUBI[2], walk)];
  const stepHop = walking * Math.abs(Math.sin(g * 0.42)) * 1.6 * (1 - walk * 0.7);
  const bellFin = keyframes(g, [RING - 14, RING - 5, RING, RING + 4, RING + 14], [0.1, 1.25, 0.62, 0.78, 0.12]);
  const bellHit = windowIn(g, RING, RING + 5, 1);
  const shock = windowIn(g, L10, L11 - 2, 3);
  const shockHop = windowIn(g, L10, L10 + 9, 2);
  const inspect = windowIn(g, ORO - 2, L11 - 2, 5);
  const gesture = windowIn(g, L08 + 18, QUIEN - 6, 6);
  const flinch = windowIn(g, CIEN, CIEN + 12, 2);
  const lookUp = windowIn(g, ME + 2, RESLEEP, 5);
  const nubiBase: NubiPose = {
    hop: stepHop + 0.4 * bellHit + 1.6 * shockHop + 0.6 * flinch,
    squash: 1 - 0.05 * bellHit + 0.05 * shockHop,
    wiggle: walking * 0.8 + 0.4 * shockHop,
    wigglePhase: g * 0.6,
    roll: walking * 0.06 * Math.sin(g * 0.42),
    yaw: 0.1 * inspect + 0.08 * windowIn(g, RING - 10, RING + 8, 4),
    pitch: 0.1 * inspect - 0.08 * shock * (1 - inspect),
    finR: (g >= RING - 16 && g < RING + 16 ? bellFin : 0.08) + 0.4 * gesture + 0.75 * shock * (1 - inspect) + 0.2 * walking * Math.sin(g * 0.42),
    finL: 0.06 + 0.75 * shock * (1 - inspect) + 0.2 * flinch - 0.2 * lookUp + 0.2 * walking * Math.sin(g * 0.42 + 1.5),
    lookX: 0.55 - 0.15 * inspect - 0.25 * windowIn(g, RING - 12, RING + 4, 4),
    lookY: -0.3 * inspect - 0.25 * windowIn(g, RING - 12, RING + 4, 4) + 0.6 * lookUp,
    eyeScale: 1 + 0.62 * shock + 0.25 * flinch + 0.18 * jolt * (g < YAWN + 10 ? 1 : 0) - 0.08 * lookUp,
  };
  const nubiPose = nubiTalk(g, nubiBase, 1);

  // ---- The bell, the ding, the loaf's price flag.
  const press = windowIn(g, RING, RING + 5, 1);
  const flagPop = g >= CIEN ? pop(g, CIEN, { damping: 9, stiffness: 230 }) : 0;
  const flagWobble = g >= CIEN ? 0.25 * Math.exp(-(g - CIEN) / 9) * Math.sin((g - CIEN) * 0.9) : 0;

  // ---- The cook: asleep face-down on the stove, snoring (his own rhythm).
  const snC = snore(g, 44, 21);
  const cookPose: NubiPose = {
    pitch: 0.14 + 0.03 * snC.breath,
    roll: -0.42,
    yaw: -0.1,
    hop: -2.6 + 0.3 * snC.breath,
    squash: 0.96 + 0.06 * snC.breath,
    blink: 1,
    finL: -0.3 + 0.1 * snC.breath,
    finR: 0.2,
    lookY: -0.2,
  };

  // ---- Cameras: the bakery two-shot (push-ins for the slap and the shock) and the cook.
  const settle = ramp(g, START, L08 + 20, [0, 1], EASE_OUT);
  const pushSlap = windowIn(g, CIEN - 6, L10 - 2, 6);
  const pushShock = windowIn(g, L10 - 1, L11 + 4, 5);
  const camPos: Vec3 = [lerp(-5.6, -4.9, settle) + 0.6 * pushShock, 2.7 + 0.1 * pushShock, lerp(14.6, 13.4, settle) - 0.8 * pushSlap - 1.4 * pushShock];
  const bakeryCam = aim(camPos, FOV, [-0.6, TOP, -0.35], lerp(560, 545, settle) - 40 * pushShock, 1040 + 40 * pushShock);
  const cookHead = nubiPoint(COOK, 0, COOK_SIZE, cookPose, [0, 6.2, 2]);
  const cookCam = aim([COOK[0] - 0.9, 2.5, 7.6 - 0.5 * ramp(g, QUIEN, WHIP_BACK)], FOV, cookHead, 540, 980);
  const cam: Cam = toCook <= 0 ? bakeryCam : { ...bakeryCam, position: lerp3(bakeryCam.position, cookCam.position, toCook), target: lerp3(bakeryCam.target, cookCam.target, toCook) };

  // ---- Counters (2D) and zzz over the sleepers.
  const bakerTop = nubiPoint(BAKER, BAKER_YAW, BAKER_SIZE, bakerPose, [0, BAKER_HAT_TOP + 0.6, 0], BAKER_CHUB);
  const frozenAt = YAWN;
  const earning = (from: number, upTo: number) => 735 + 0.42 * (Math.min(g, upTo) - from);
  const bakerSoles = g < frozenAt ? earning(START, g) : g < RESLEEP + 6 ? earning(START, frozenAt) : earning(START, frozenAt) + 0.42 * (g - RESLEEP - 6);
  const bakerState = g >= frozenAt && g < RESLEEP + 6 ? "frozen" : "earning";
  const bakerC = counterAt(cam, [bakerTop[0], Math.max(bakerTop[1], BAKER[1] + 2.9), bakerTop[2]]);
  const pointPulse = 1 + 0.07 * point * Math.max(0, Math.sin((g - ME) * 0.55));
  const cookTop = nubiPoint(COOK, 0, COOK_SIZE, cookPose, [0, COOK_HAT_TOP + 0.4, -1], [1, 1, 1]);
  const cookC = counterAt(cam, [cookTop[0], Math.max(cookTop[1], COOK[1] + 2.4), cookTop[2]]);
  const cookOn = clamp01((toCook - 0.35) / 0.4);
  const bakerOn = clamp01((0.65 - toCook) / 0.4);
  const bakerHead = counterAt(cam, nubiPoint(BAKER, BAKER_YAW, BAKER_SIZE, bakerPose, [5.5, 8.5, 2], BAKER_CHUB));
  const cookHeadC = counterAt(cam, nubiPoint(COOK, 0, COOK_SIZE, cookPose, [4.5, 8.5, 2]));

  return (
    <AbsoluteFill style={{ background: STREET_SKY }}>
      <Shake
        frame={g}
        impacts={[
          { at: RING, amp: 3, dur: 7 },
          { at: CIEN, amp: 6, dur: 10 },
          { at: L10, amp: 2.5, dur: 8 },
        ]}
      >
        <AbsoluteFill style={{ filter: whipBlur > 0.05 ? `blur(${(9 * whipBlur).toFixed(2)}px)` : undefined }}>
          <Stage cam={cam} near={0.1}>
            <StreetLights />
            <BakeryStreet />
            <group position={[C.x, 0, C.z]}>
              <BakeryCounter />
            </group>
            <group position={[C.x + C.w / 2 - 0.42, TOP, C.z + 0.02]} rotation={[0, -0.35, 0]}>
              <Chalkboard />
            </group>
            <group position={[-0.62 + 0.08, TOP, -0.62]} rotation={[0, 0.2, 0]} scale={0.85}>
              <CashRegister />
            </group>
            <group position={[0.85, TOP, -0.28]} rotation={[0, 0.4, 0]}>
              <BreadBasket />
            </group>
            <group position={BELL}>
              <ServiceBell press={press} />
              <DingLines age={g - RING} />
            </group>
            <group position={LOAF} rotation={[0, 0.25, 0]}>
              <Loaf />
              <group position={[0.06, 0.18, 0.02]} rotation={[0, -0.6, 0]}>
                <PriceFlag pop={flagPop} wobble={flagWobble} />
              </group>
            </group>
            <Baker position={BAKER} rotationY={BAKER_YAW} pose={bakerPose} flop={asleep * 0.9 + 0.15 * jolt} twitch={asleep * sn.out} lift={yawn} droop={droop} tilt={-0.24}>
              <SnotBubble size={bubble} burst={burst} />
            </Baker>
            <Nubi size={2} position={nubiPos} rotationY={NUBI_YAW} pose={nubiPose} shadowOpacity={0.4} />
            {/* Next door: the cook asleep on the stove. */}
            <group position={RESTO.pot}>
              <StovePot />
              <group position={[0, 0.52, 0]}>
                <Steam t={t} />
              </group>
            </group>
            <group position={RESTO.pan} rotation={[0, 0.3, 0]}>
              <FryingPan />
            </group>
            <Cook position={COOK} pose={cookPose} flop={0.9}>
              <SnotBubble size={0.3 + 0.7 * snC.out} at={[0.6, 4.2, 4.5]} />
            </Cook>
          </Stage>
          {cookOn > 0 && !cookC.behind ? (
            <>
              <Zzz g={g} x={cookHeadC.x} y={cookHeadC.y} scale={0.9} on={cookOn} every={14} />
              <MoneyCounter frame={g} soles={1180 + 0.42 * (g - START)} x={cookC.x} y={cookC.y} scale={cookC.scale} state="earning" opacity={cookOn} />
            </>
          ) : null}
          {bakerOn > 0 && !bakerC.behind ? (
            <>
              <Zzz g={g} x={bakerHead.x} y={bakerHead.y} scale={0.9} on={bakerOn * clamp01(asleep * 1.4 - 0.3) * (g < RING + 2 || g > RESLEEP ? 1 : 0)} />
              <MoneyCounter
                frame={g}
                soles={bakerSoles}
                x={bakerC.x}
                y={bakerC.y}
                scale={bakerC.scale * pointPulse}
                state={bakerState}
                opacity={bakerOn}
              />
            </>
          ) : null}
        </AbsoluteFill>
      </Shake>
    </AbsoluteFill>
  );
};
