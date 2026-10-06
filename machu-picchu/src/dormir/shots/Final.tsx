import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp, windowIn } from "../../anim";
import { MoneyCounter } from "../../overlay/dormir/DormirUI";
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
  HugPillow,
  NUBI_BED,
  NUBI_EYES,
  PHONE_AT,
  PhoneProp,
  Zzz,
  sleepingPose,
} from "../../three/dormir/Bedroom";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { Lids } from "../../three/tiempo/Office";
import { FINAL } from "../beats";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";
import { HOOK_COUNTER, camClock, camSleep, hookCounterY } from "./Gancho";

// Shot "final" (FINAL.START → END): Nubi hugging its pillow, close to the lens, playful, asks the
// viewer L17 (leans in on "¿cuánto ganarías tú?", a sly side glance on "millonario"). ALARM: a NEW
// (blue) alarm clock rings on the nightstand — the camera widens and Nubi turns its head, slowly, to
// glare at it; L18 "Tú y yo tenemos un problema." with a threatening squint; SMASH: the same gag as
// the hook; SLEEP: it flops back asleep and its counter starts again from S/0. The last frame is the
// hook's first frame (camSleep, sleepingPose, counter ≈ S/220 climbing): the video loops. The end
// text sits in the top band (y 230-520) from CARD: the counter stays under it.

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({ position: lerp3(a.position, b.position, k), target: lerp3(a.target, b.target, k), fov: lerp(a.fov, b.fov, k) });

export const FinalShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.final.from;
  const { END, L17, CUANTO, MILLONARIO, CASA, ALARM, L18, SMASH, SLEEP } = FINAL;
  const t = g / 30;
  const seam = g - END; // frames to the loop seam (negative)

  // ---- The new alarm clock.
  const ring = g >= ALARM && g < SMASH ? 1 : 0;
  const crush = ramp(g, SMASH - 1, SMASH + 1, [0, 1], EASE_OUT);
  const crushAge = g >= SMASH ? g - SMASH : -1;

  // ---- Nubi.
  const lean = windowIn(g, CUANTO - 4, CUANTO + 50, 8);
  const sly = windowIn(g, MILLONARIO - 8, CASA + 2, 6);
  const turn = ramp(g, ALARM + 6, ALARM + 26, [0, 1], EASE_IN_OUT);
  const squint = ramp(g, L18 - 6, L18 + 6, [0, 1], EASE_OUT);
  const windUp = ramp(g, SMASH - 12, SMASH - 3, [0, 1], EASE_IN_OUT);
  const slam = ramp(g, SMASH - 3, SMASH, [0, 1], (x) => x * x);
  const impact = g >= SMASH && g < SMASH + 6 ? 1 - (g - SMASH) / 6 : 0;
  const flop = ramp(g, SLEEP - 4, SLEEP + 4, [0, 1], EASE_OUT);
  const ringJolt = windowIn(g, ALARM, ALARM + 6, 2);
  const asleep = g >= SLEEP;

  let finR = 0.2 + 0.1 * Math.sin(g * 0.09);
  if (g >= SMASH - 12 && g < SMASH - 3) finR = lerp(0.2, 2.5, windUp);
  else if (g >= SMASH - 3 && g < SMASH) finR = lerp(2.5, 0.42, slam);
  else if (g >= SMASH) finR = lerp(0.42 + 0.15 * impact, -0.1, ramp(g, SMASH + 4, SLEEP + 2, [0, 1], EASE_IN_OUT));
  const lunge = windUp * 0.35 + slam * 0.65 - ramp(g, SMASH + 4, SLEEP, [0, 1], EASE_IN_OUT) * (g >= SMASH ? 1 : 0);
  const awakePose: NubiPose = {
    blink: 0,
    eyeScale: 1.04 + 0.1 * lean - 0.08 * sly + 0.3 * ringJolt,
    pitch: 0.08 + 0.12 * lean - 0.05 * turn,
    yaw: 0.45 * turn + 0.15 * windowIn(g, SMASH - 12, SMASH + 6, 3) - 0.15 * Math.max(0, lunge),
    roll: 0.06 * sly * Math.sin(g * 0.12) - 0.22 * Math.max(0, lunge),
    lookX: 0.4 * sly * Math.sin((g - MILLONARIO) * 0.09) + 0.75 * turn,
    lookY: -0.08 * turn,
    hop: 0.35 + 0.5 * lean + 0.8 * ringJolt,
    finR,
    finL: 0.2 + 0.1 * Math.sin(g * 0.09 + 1) + 0.1 * lean,
    squash: 1 - 0.1 * impact,
    wiggle: 0.35 * sly,
    wigglePhase: g * 0.4,
  };
  const talking = g >= L17 && g < SMASH - 12;
  let pose = talking ? nubiTalk(g, awakePose, g >= L18 ? 0.6 : 1) : awakePose;
  if (talking && turn > 0) {
    pose.yaw = awakePose.yaw;
    pose.lookX = awakePose.lookX;
    pose.blink = Math.max(pose.blink ?? 0, awakePose.blink ?? 0);
  }
  if (g >= SLEEP - 4) {
    const s = sleepingPose(seam);
    const k = flop;
    pose = {
      blink: Math.max(k > 0.15 ? 1 : 0, pose.blink ?? 0),
      eyeScale: 1,
      pitch: lerp(pose.pitch ?? 0, s.pitch, k),
      yaw: lerp(pose.yaw ?? 0, s.yaw, k),
      roll: lerp(pose.roll ?? 0, s.roll, k),
      lookX: lerp(pose.lookX ?? 0, 0, k),
      lookY: lerp(pose.lookY ?? 0, s.lookY, k),
      hop: lerp(pose.hop ?? 0, s.hop, k),
      finR: lerp(pose.finR ?? 0, s.finR, k),
      finL: lerp(pose.finL ?? 0, s.finL, k),
      squash: s.squash * (1 - 0.12 * windowIn(g, SLEEP, SLEEP + 6, 2)),
    };
  }

  // ---- Camera: close and playful → wider with the clock → back to the loop framing.
  const camClose = aim([0.12 - 0.15 * lean, 2.1, NUBI_EYES[2] + 6.3 - 0.45 * lean], 40, NUBI_EYES, 540, 1010 - 25 * lean);
  const camC = camClock(0.6 + 0.6 * ramp(g, ALARM, SMASH, [0, 1], (x) => x));
  const toClock = ramp(g, ALARM + 2, ALARM + 22, [0, 1], EASE_IN_OUT);
  const toSleep = ramp(g, SLEEP, END - 10, [0, 1], EASE_IN_OUT);
  let cam = mixCam(camClose, camC, toClock);
  cam = mixCam(cam, camSleep(seam), toSleep);

  // ---- The counter starts again on SLEEP (S/0 → ≈ S/220 at the seam, like the hook's frame 0).
  const S0 = SLEEP + 1;
  const soles = (HOOK_COUNTER.start * clamp01((g - S0) / (END - S0))) | 0;
  const head: Vec3 = [COUNTER_AT[0], COUNTER_AT[1] + 0.2 * (pose.hop ?? 0), COUNTER_AT[2]];
  const ctr = counterAt(cam, head, HOOK_COUNTER.opts);

  return (
    <AbsoluteFill style={{ background: "#0A1240" }}>
      <Shake
        frame={g}
        impacts={[
          { at: ALARM, amp: 4, dur: 8 },
          { at: SMASH, amp: 18, dur: 14 },
        ]}
      >
        <Stage cam={cam} near={0.1} far={200}>
          <BedroomLights />
          <Bedroom t={t} frameTilt={-0.42} />
          <group position={CLOCK_AT} rotation={[0, CLOCK_YAW, 0]} scale={CLOCK_SCALE}>
            <AlarmClock t={t} ring={ring} crush={crush} crushAge={crushAge} color="#2FA8FF" />
          </group>
          <group position={[PHONE_AT[0], PHONE_AT[1] + 0.03 + 0.06 * impact, PHONE_AT[2]]} rotation={[-Math.PI / 2, 0, 0.5]}>
            <PhoneProp screen="off" />
          </group>
          <Nubi size={2} position={[NUBI_BED[0] + 0.2 * Math.max(0, lunge), NUBI_BED[1], NUBI_BED[2]]} pose={pose} shadow={false} palette={{ eyeRough: 0.6 }}>
            <HugPillow shift={-2.6 * Math.max(0, lunge)} />
            {g < SLEEP ? <Lids pose={pose} droop={0.3 * turn + 0.3 * squint} tilt={-0.32 * Math.max(turn, squint)} color={NUBI_GREEN} /> : null}
          </Nubi>
        </Stage>
        <Zzz g={seam} cam={cam} at={[-0.55, NUBI_EYES[1] + 0.75, NUBI_BED[2]]} on={asleep ? ramp(g, SLEEP + 4, SLEEP + 8) : 0} every={11} />
        {asleep && !ctr.behind ? (
          <MoneyCounter frame={g} soles={soles} x={ctr.x} y={hookCounterY(ctr.y)} scale={ctr.scale} state="earning" appear={S0} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
