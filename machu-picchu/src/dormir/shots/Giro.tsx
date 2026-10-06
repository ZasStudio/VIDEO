import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp, windowIn } from "../../anim";
import { MoneyCounter, MoneyEvent } from "../../overlay/dormir/DormirUI";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import {
  AlarmClock,
  Bedroom,
  BedroomLights,
  CLOCK_AT,
  CLOCK_SCALE,
  CLOCK_YAW,
  COUNTER_AT,
  HeldProp,
  HugPillow,
  NUBI_BED,
  NUBI_EYES,
  PhoneProp,
  PhoneScreen,
  SleepMask,
  Zzz,
  sleepingPose,
} from "../../three/dormir/Bedroom";
import { Nubi, NubiPose } from "../../three/Nubi";
import { Glow } from "../../three/thanos/FX";
import { GIRO } from "../beats";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot "giro" (GIRO.START → END): Nubi, phone up in its screen-left fin, pays the neighbour (PAY: a
// tap, the screen flashes a green tick), its other fin snaps the sleep mask down (MASK) and it drops
// asleep. The MONEY MONTAGE: the counter races S/0 → S/1000 by MIL (cha-ching popups) while the
// window goes from night to sunrise to morning (moon sets, sun rises) and the camera slowly circles
// in; RICO: a happy wiggle in its sleep. OJOS: the mask flips up, eyes wide and happy, the phone
// comes up — CHARGE1/2/3: three charges (−S/400, −S/300, −S/300, as on the 2D ChargesPhone card),
// three flinches; the counter drains to S/0 by ZERO (grey). The ChargesPhone card covers x 150-850,
// y 250-810 from OJOS + 8, so the counter over the bed bows out under it (the card's balance takes
// over). L16: outraged, fins up, shaking the phone.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** The charges that empty the counter (they add up to S/1000). */
export const GIRO_CHARGES = [400, 300, 300];

const RACE0 = GIRO.MASK + 4;
const raceAt = (g: number) => 1000 * Math.pow(clamp01((g - RACE0) / (GIRO.MIL - RACE0)), 1.7);
/** Frames where the racing counter crosses each hundred (a "+S/100" popup each). */
const RACE_EVENTS: MoneyEvent[] = Array.from({ length: 10 }, (_, i) => {
  const k = Math.pow((i + 1) / 10, 1 / 1.7);
  return { at: Math.round(RACE0 + k * (GIRO.MIL - RACE0)), text: "+S/100", tone: "plus" as const };
});
const CHARGE_EVENTS: MoneyEvent[] = [GIRO.CHARGE1, GIRO.CHARGE2, GIRO.CHARGE3].map((at, i) => ({ at, text: `-S/${GIRO_CHARGES[i]}`, tone: "minus" as const }));

const solesAt = (g: number) => {
  const { CHARGE1, CHARGE2, CHARGE3 } = GIRO;
  if (g < CHARGE1) return Math.round(raceAt(g));
  const drop = (at: number, from: number, to: number) => lerp(from, to, ramp(g, at, at + 5, [0, 1], EASE_OUT));
  if (g < CHARGE2) return Math.round(drop(CHARGE1, 1000, 600));
  if (g < CHARGE3) return Math.round(drop(CHARGE2, 600, 300));
  return Math.round(drop(CHARGE3, 300, 0));
};

export const GiroShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.giro.from;
  const { START, END, PAY, MASK, MIL, RICO, OJOS, CHARGE1, CHARGE2, CHARGE3, ZERO, L16 } = GIRO;
  const t = g / 30;

  // ---- Time of day through the window: night → sunrise → morning during the montage.
  const dawn = ramp(g, RACE0, OJOS - 6, [0, 1], (x) => x);

  // ---- The mask and the phone.
  const maskOn = g < MASK - 2 ? 0 : g < OJOS ? ramp(g, MASK - 2, MASK + 1, [0, 1], (x) => x * x) : 1 - ramp(g, OJOS - 1, OJOS + 4, [0, 1], EASE_OUT);
  const maskSnap = windowIn(g, MASK + 1, MASK + 7, 2) * Math.cos((g - MASK - 1) * 1.1);
  const asleep = g >= MASK + 1 && g < OJOS;
  const charges = [CHARGE1, CHARGE2, CHARGE3];
  const hit = charges.reduce((m, at) => Math.max(m, g >= at && g < at + 10 ? 1 - (g - at) / 10 : 0), 0);
  const lastCharge = charges.filter((at) => g >= at).length;
  let screen: PhoneScreen = "pay";
  if (g >= PAY) screen = "paid";
  if (g >= MASK) screen = "off";
  if (g >= OJOS) screen = "bank";
  if (lastCharge > 0 && hit > 0.3) screen = "alert";
  else if (g >= ZERO) screen = "alert";
  const phoneGlow = g < MASK ? 0.6 + 0.8 * windowIn(g, PAY, PAY + 10, 2) : g >= OJOS ? 0.6 + 0.8 * hit : 0;

  // ---- Nubi.
  const tap = windowIn(g, PAY - 2, PAY + 4, 2);
  const pull = windowIn(g, MASK - 8, MASK + 2, 3);
  const flop = ramp(g, MASK, MASK + 8, [0, 1], EASE_OUT);
  const rico = windowIn(g, RICO, RICO + 26, 5);
  const milK = windowIn(g, MIL, MIL + 14, 3);
  const wake = ramp(g, OJOS, OJOS + 6, [0, 1], EASE_OUT);
  const lookPhone = ramp(g, OJOS + 6, OJOS + 18, [0, 1], EASE_IN_OUT) * (1 - ramp(g, ZERO + 2, L16 + 4, [0, 1], EASE_IN_OUT));
  const outrage = ramp(g, L16 - 4, L16 + 6, [0, 1], EASE_OUT);
  const sleep = sleepingPose(g - MASK);
  let base: NubiPose;
  if (g < MASK + 1) {
    base = {
      blink: 0,
      eyeScale: 1.05,
      pitch: lerp(0.02, -0.13, flop),
      yaw: -0.3 * (1 - pull),
      lookX: -0.65 * (1 - pull),
      lookY: 0.25 * (1 - pull),
      finL: 2.0 - 0.3 * tap,
      finR: lerp(0.1, 1.55, pull),
      squash: 1 - 0.05 * tap,
      hop: 0.3,
    };
  } else if (asleep) {
    base = {
      ...sleep,
      finL: lerp(2.0, -0.05, flop) + 0.35 * rico * Math.sin(g * 0.7),
      finR: lerp(1.55, -0.1, flop) + 0.35 * rico * Math.sin(g * 0.7 + 2),
      squash: (sleep.squash ?? 1) * (1 - 0.1 * windowIn(g, MASK, MASK + 6, 2)) * (1 + 0.04 * milK),
      hop: (sleep.hop ?? 0) + 0.6 * rico * Math.abs(Math.sin(g * 0.35)) + 0.3 * milK,
      roll: (sleep.roll ?? 0) + 0.08 * rico * Math.sin(g * 0.35),
      wiggle: 0.9 * rico + 0.4 * milK,
      wigglePhase: g * 0.6,
    };
  } else {
    // Awake: happy, then three flinches, then outraged.
    const happy = 1 - ramp(g, CHARGE1, CHARGE1 + 4);
    base = {
      blink: 0,
      eyeScale: 1.25 * happy + (1 - happy) * (1.45 * hit + 1.1 * (1 - hit)) - 0.2 * outrage,
      pitch: lerp(-0.13, 0.04, wake) - 0.12 * hit,
      yaw: -0.32 * lookPhone,
      lookX: -0.7 * lookPhone,
      lookY: 0.3 * lookPhone,
      hop: 1.2 * windowIn(g, OJOS, OJOS + 10, 3) + 0.5 * hit,
      squash: 1 - 0.14 * hit,
      roll: 0.12 * hit * Math.sin((g - CHARGE1) * 1.7),
      finR: lerp(1.5, 0.25, ramp(g, OJOS + 4, OJOS + 12)) + 0.5 * hit + 1.0 * outrage,
      finL: lerp(-0.05, 2.0, wake) + 0.2 * hit + 0.3 * outrage * Math.sin(g * 1.05),
      wiggle: 0.5 * happy * windowIn(g, OJOS, OJOS + 24, 4) + 0.5 * outrage,
      wigglePhase: g * 0.7,
    };
  }
  const pose = g >= L16 ? nubiTalk(g, base, 1) : g >= START && g < MASK ? base : base;
  if (g >= L16) {
    pose.finL = base.finL;
    pose.finR = base.finR;
    pose.lookX = base.lookX;
  }
  const finL = pose.finL ?? 0;

  // ---- Camera: medium on the bed with the window; a slow circle in during the montage.
  const orbit = ramp(g, MASK + 2, OJOS, [0, 1], EASE_IN_OUT);
  const settle = ramp(g, OJOS - 4, OJOS + 10, [0, 1], EASE_IN_OUT);
  const ang = lerp(-0.22, 0.2, orbit) * (1 - settle) + 0.05 * settle;
  const dist = lerp(8.3, 7.3, orbit) * (1 - settle) + 7.9 * settle - 0.6 * ramp(g, L16, END, [0, 1], (x) => x);
  const focus: Vec3 = [0, 1.75, NUBI_BED[2]];
  const pos: Vec3 = [focus[0] + Math.sin(ang) * dist, 2.85 - 0.25 * orbit * (1 - settle), focus[2] + Math.cos(ang) * dist];
  const camA: Cam = aim(pos, FOV, NUBI_EYES, 560, 1075);
  // Awake (paying, then the charges): wider, Nubi right of centre so the phone up in its
  // screen-left fin stays in frame (and clear of the right-hand button column).
  const camPhone = (push: number): Cam => aim([-0.15, 2.8, NUBI_BED[2] + 9.6 - push], FOV, NUBI_EYES, 655, 1040);
  const kStart = g < MASK ? 1 - ramp(g, MASK - 6, MASK + 4, [0, 1], EASE_IN_OUT) : 0;
  const kEnd = ramp(g, OJOS - 2, OJOS + 10, [0, 1], EASE_IN_OUT);
  const camB = camPhone(g < MASK ? 0.3 * ramp(g, START, MASK) : 0.8 * ramp(g, L16, END, [0, 1], (x) => x));
  const k = Math.max(kStart, kEnd);
  const cam: Cam = { position: lerp3(camA.position, camB.position, k), target: lerp3(camA.target, camB.target, k), fov: FOV };

  // ---- Counter.
  const soles = solesAt(g);
  const state = g >= ZERO ? "zero" : g >= CHARGE1 ? "alarm" : "earning";
  const showCtr = g >= MASK + 2 && g < OJOS + 12;
  const bowOut = ramp(g, OJOS + 4, OJOS + 11, [0, 1], EASE_IN_OUT);
  const head: Vec3 = [COUNTER_AT[0], COUNTER_AT[1] + 0.2 * (pose.hop ?? 0) + 0.1, COUNTER_AT[2]];
  const ctr = counterAt(cam, head, { min: 0.9, max: 1.2 });
  const pulse = 0.25 * windowIn(g, MIL, MIL + 8, 2) + 0.12 * windowIn(g, RICO, RICO + 8, 2) + 0.1 * hit;

  return (
    <AbsoluteFill style={{ background: "#0A1240" }}>
      <Shake
        frame={g}
        impacts={[
          { at: MASK, amp: 4, dur: 8 },
          { at: CHARGE1, amp: 9, dur: 10 },
          { at: CHARGE2, amp: 9, dur: 10 },
          { at: CHARGE3, amp: 12, dur: 12 },
          { at: L16, amp: 6, dur: 12 },
        ]}
      >
        <Stage cam={cam} near={0.1} far={200}>
          <BedroomLights dawn={dawn} lamp={1 - 0.6 * dawn} />
          <Bedroom t={t} dawn={dawn} frameTilt={-0.42} />
          <group position={CLOCK_AT} rotation={[0, CLOCK_YAW, 0]} scale={CLOCK_SCALE}>
            <AlarmClock t={t} color="#2FA8FF" />
          </group>
          <Nubi
            size={2}
            position={NUBI_BED}
            pose={pose}
            shadow={false}
            palette={{ eyeRough: 0.6 }}
            hideEyes={maskOn > 0.55}
            holdL={
              <HeldProp raise={finL} side="L" scale={0.95} turn={g < MASK || g >= OJOS ? 0.95 : 0.3} tilt={g >= MASK && g < OJOS ? -1.2 : 0.1}>
                <PhoneProp screen={screen} glow={phoneGlow} glowColor={screen === "alert" ? "#FF5A6A" : screen === "paid" ? "#7DFFB0" : "#CFE4FF"} />
              </HeldProp>
            }
          >
            <SleepMask on={maskOn} snap={maskSnap} />
            <HugPillow over={0} />
          </Nubi>
          {g >= PAY && g < PAY + 12 ? <Glow color="#7DFFB0" size={1.6} opacity={1 - (g - PAY) / 12} position={[-1.25, 2.2, NUBI_BED[2] + 0.4]} /> : null}
        </Stage>
        <Zzz g={g} cam={cam} at={[-0.55, NUBI_EYES[1] + 0.7, NUBI_BED[2]]} on={asleep ? ramp(g, MASK + 6, MASK + 10) : 0} every={8} />
        {showCtr && !ctr.behind ? (
          <MoneyCounter
            frame={g}
            soles={soles}
            x={ctr.x}
            y={ctr.y}
            scale={ctr.scale * (1 + pulse) * (1 - 0.5 * bowOut)}
            opacity={1 - bowOut}
            state={state}
            appear={MASK + 2}
            events={[...RACE_EVENTS, ...CHARGE_EVENTS]}
          />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
