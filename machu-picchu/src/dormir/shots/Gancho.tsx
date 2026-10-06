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
  CLOCK_YAW,
  COUNTER_AT,
  FACADE_SLEEPERS,
  HugPillow,
  NUBI_BED,
  NUBI_EYES,
  PHONE_AT,
  PhoneProp,
  Zzz,
  sleepingPose,
} from "../../three/dormir/Bedroom";
import { Nubi, NubiPose } from "../../three/Nubi";
import { GANCHO } from "../beats";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot 1 "gancho" (GANCHO.START → END): THE HOOK. Frame 0 is already in action: close on Nubi
// asleep in bed hugging its pillow, its money counter over the bed racing up (S/220 → 300, a
// cha-ching every few frames). ALARM: the twin-bell clock rings off-frame — the camera snaps back
// to show it shaking; the counter freezes red. SMASH: Nubi's fin slams it flat without opening its
// eyes (a spring pops off, dizzy stars). L01: Nubi sits up groggy, glares at the wreck, then at us;
// TRESCIENTOS: the red counter pulses. L02 to camera (the counter has left: the top band stays calm
// for the «S/100 POR HORA» stamp at CIEN); on TODOS the camera rises over Nubi's head and pushes
// to the window: across the street every window has a sleeper with a green counter.
// The first frame matches the last frame of "final" (the loop): camSleep(0), sleepingPose(0).

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({ position: lerp3(a.position, b.position, k), target: lerp3(a.target, b.target, k), fov: lerp(a.fov, b.fov, k) });

/** The loop framing: close on sleeping Nubi, the clock just off-frame right. `d` frames from the seam. */
export const camSleep = (d: number): Cam => aim([0.32, 2.55 - 0.0006 * d, NUBI_EYES[2] + 6.2 - 0.004 * d], FOV, NUBI_EYES, 540, 1035);
/** Wider, from the front right: Nubi and the alarm clock on the nightstand. */
export const camClock = (push = 0): Cam => aim([2.75 - 0.3 * push, 2.85 - 0.1 * push, 6.6 - 0.9 * push], FOV, [0.82, 1.42, -1.05], 540, 1015);
/** Nubi to camera, medium close (counter gone, top band calm). */
const camTalk = (push: number): Cam => aim([0.5 - 0.2 * push, 2.3, NUBI_EYES[2] + 6.4 - 1.1 * push], FOV, NUBI_EYES, 540, 1000);
/** At the window, looking out at the building across the street. */
const camWindow = (drift: number): Cam => aim([0.12 + 0.12 * drift, 3.35, -0.35 - 0.25 * drift], 44, [0, 2.4, -13.5], 520, 820);

/** The two rows of sleepers that get live counters in the reveal (middle three columns). */
const REVEAL = FACADE_SLEEPERS.filter((s) => (s.row === 2 || s.row === 3) && s.col >= 3 && s.col <= 5);

const HOOK_EVENTS: MoneyEvent[] = [
  { at: GANCHO.START, text: "+S/30", tone: "plus" },
  { at: GANCHO.START + 5, text: "+S/30", tone: "plus" },
  { at: GANCHO.START + 10, text: "+S/30", tone: "plus" },
];

export const GanchoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.gancho.from;
  const { START, END, ALARM, SMASH, L01, TRESCIENTOS, L02, TODOS } = GANCHO;
  const t = g / 30;
  const d = g - START;

  // ---- The alarm clock: rings from ALARM, flattened on SMASH.
  const ring = g >= ALARM && g < SMASH ? 1 : 0;
  const crush = ramp(g, SMASH - 1, SMASH + 1, [0, 1], EASE_OUT);
  const crushAge = g >= SMASH ? g - SMASH : -1;

  // ---- Nubi. Asleep, then the wind-up (eyes still shut), the slam, the groggy sit-up, L01 / L02.
  const sleep = sleepingPose(d);
  const flinch = windowIn(g, ALARM, ALARM + 7, 2);
  const windUp = ramp(g, ALARM + 3, SMASH - 3, [0, 1], EASE_IN_OUT);
  const slam = ramp(g, SMASH - 3, SMASH, [0, 1], (x) => x * x);
  const lunge = (windUp * 0.5 + slam * 0.5) * (1 - ramp(g, L01 + 2, L01 + 14, [0, 1], EASE_IN_OUT));
  const sitUp = ramp(g, L01, L01 + 12, [0, 1], EASE_OUT);
  const glareClock = ramp(g, L01 + 2, L01 + 10, [0, 1], EASE_OUT) * (1 - ramp(g, L01 + 22, L01 + 32, [0, 1], EASE_IN_OUT));
  const outrage = windowIn(g, TRESCIENTOS - 3, TRESCIENTOS + 26, 5);
  const toCam = ramp(g, L01 + 22, L01 + 32, [0, 1], EASE_IN_OUT);
  const awake = g >= L01;
  const groggy = awake ? 1 - ramp(g, L02 - 6, L02 + 8, [0, 1], EASE_IN_OUT) : 0;
  const lookUp = ramp(g, TODOS - 8, TODOS + 6, [0, 1], EASE_IN_OUT);
  const impact = g >= SMASH && g < SMASH + 6 ? 1 - (g - SMASH) / 6 : 0;

  let finR: number;
  if (g < ALARM + 3) finR = sleep.finR;
  else if (g < SMASH - 3) finR = lerp(sleep.finR, 1.6, windUp);
  else if (g < SMASH) finR = lerp(1.6, -0.55, slam);
  else finR = lerp(-0.55 + 0.12 * impact, 0.15, ramp(g, L01 + 2, L01 + 12, [0, 1], EASE_IN_OUT));
  const base: NubiPose = awake
    ? {
        blink: 0.42 * groggy,
        eyeScale: lerp(1.0, 0.72, groggy) + 0.22 * outrage,
        pitch: lerp(-0.13, 0.02, sitUp),
        roll: 0.05 * (1 - sitUp),
        yaw: 0.42 * glareClock + 0.04 * Math.sin(g * 0.05) * (1 - glareClock),
        lookX: 0.75 * glareClock,
        lookY: -0.1 * glareClock + 0.55 * lookUp,
        hop: 0.4 * sitUp,
        finR: finR + 0.6 * outrage,
        finL: lerp(-0.1, 0.05, sitUp) + 0.6 * outrage,
        squash: 1 - 0.04 * groggy,
      }
    : {
        ...sleep,
        squash: (sleep.squash ?? 1) * (1 - 0.06 * flinch - 0.12 * impact),
        roll: (sleep.roll ?? 0) * (1 - windUp) - 0.22 * lunge,
        yaw: (sleep.yaw ?? 0) + 0.3 * lunge,
        finR,
        finL: (sleep.finL ?? 0) - 0.15 * flinch,
        eyeScale: 1,
      };
  const pose = awake ? nubiTalk(g, base, g < L02 ? 0.8 : 1) : base;
  if (awake && glareClock > 0.3) pose.lookX = base.lookX;
  if (toCam > 0 && toCam < 1) pose.yaw = (pose.yaw ?? 0) * (0.4 + 0.6 * toCam);
  const nubiAt: Vec3 = [NUBI_BED[0] + 0.2 * lunge, NUBI_BED[1], NUBI_BED[2] + 0.04 * lunge];

  // ---- Camera.
  const snap = ramp(g, ALARM, ALARM + 6, [0, 1], EASE_OUT);
  const toTalk = ramp(g, TRESCIENTOS + 6, L02 + 12, [0, 1], EASE_IN_OUT);
  const toWindow = ramp(g, TODOS - 6, TODOS + 22, [0, 1], EASE_IN_OUT);
  const camA = camSleep(d);
  const camB = camClock(ramp(g, ALARM, TRESCIENTOS + 6, [0, 1], (x) => x));
  const camC = camTalk(ramp(g, L02, TODOS - 6, [0, 1], (x) => x));
  const camD = camWindow(ramp(g, TODOS + 22, END, [0, 1], (x) => x));
  let cam = g < ALARM ? camA : mixCam(camA, camB, snap);
  if (toTalk > 0) cam = mixCam(cam, camC, toTalk);
  if (toWindow > 0) {
    // Rise over Nubi's head on the way (an arc, not a straight line through it).
    const mid = mixCam(cam, camD, toWindow);
    mid.position = [mid.position[0], mid.position[1] + 0.9 * Math.sin(Math.PI * toWindow), mid.position[2]];
    cam = mid;
  }

  // ---- Nubi's counter: racing up, frozen red by the alarm, pulsing on TRESCIENTOS, gone for L02.
  const soles = g < ALARM ? 220 + (80 * (g - START)) / (ALARM - START) : 300;
  const state = g < ALARM ? "earning" : "alarm";
  const pulse = g >= TRESCIENTOS ? 0.28 * Math.max(0, Math.sin(Math.PI * clamp01((g - TRESCIENTOS) / 10))) + 0.12 * windowIn(g, TRESCIENTOS, TRESCIENTOS + 30, 4) * Math.abs(Math.sin((g - TRESCIENTOS) * 0.5)) : 0;
  const leave = ramp(g, L02 + 2, L02 + 14, [0, 1], EASE_IN_OUT);
  const head: Vec3 = [nubiAt[0] + COUNTER_AT[0], COUNTER_AT[1] + 0.2 * (pose.hop ?? 0), COUNTER_AT[2]];
  const ctr = counterAt(cam, head, { min: 0.9, max: 1.15 });
  const ctrY = Math.max(470, ctr.y);

  // ---- The reveal: live counters over the sleepers across the street.
  const reveal = REVEAL.map((s, i) => {
    const c = counterAt(cam, s.at, { ref: 7.2, min: 0.42, max: 0.62 });
    const appear = TODOS + 14 + i * 3;
    const value = 180 + Math.round((s.seed * 137) % 800) + (g - appear) * (2 + (s.seed % 3));
    return { c, appear, value, i };
  });

  return (
    <AbsoluteFill style={{ background: "#0A1240" }}>
      <Shake
        frame={g}
        impacts={[
          { at: ALARM, amp: 5, dur: 10 },
          { at: SMASH, amp: 18, dur: 14 },
          { at: TRESCIENTOS, amp: 5, dur: 10 },
        ]}
      >
        <Stage cam={cam} near={0.1} far={200}>
          <BedroomLights />
          <Bedroom t={t} />
          <group position={CLOCK_AT} rotation={[0, CLOCK_YAW, 0]}>
            <AlarmClock t={t} ring={ring} crush={crush} crushAge={crushAge} />
          </group>
          <group position={[PHONE_AT[0], PHONE_AT[1] + 0.03 + 0.06 * impact, PHONE_AT[2]]} rotation={[-Math.PI / 2, 0, 0.5]}>
            <PhoneProp screen="off" />
          </group>
          <Nubi size={2} position={nubiAt} pose={pose} shadow={false} palette={{ eyeRough: 0.6 }}>
            <HugPillow />
          </Nubi>
        </Stage>
        <Zzz g={g} cam={cam} at={[nubiAt[0] - 0.55, NUBI_EYES[1] + 0.75, NUBI_BED[2]]} on={1 - ramp(g, ALARM, ALARM + 3)} every={11} />
        {!ctr.behind && leave < 1 ? (
          <MoneyCounter
            frame={g}
            soles={soles}
            x={ctr.x}
            y={ctrY}
            scale={ctr.scale * (1 + pulse) * (1 - 0.6 * leave)}
            opacity={1 - leave}
            state={state}
            events={HOOK_EVENTS}
          />
        ) : null}
        {reveal.map(({ c, appear, value, i }) =>
          c.behind || g < appear ? null : (
            <MoneyCounter key={i} frame={g} soles={value} x={c.x} y={c.y} scale={c.scale} state="earning" appear={appear} />
          ),
        )}
      </Shake>
    </AbsoluteFill>
  );
};
