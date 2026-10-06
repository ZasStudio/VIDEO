import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { MoneyCounter } from "../../overlay/dormir/DormirUI";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import {
  AlarmClock,
  Bedroom,
  BedroomLights,
  CLOCK_AT,
  CLOCK_SCALE,
  CLOCK_YAW,
  COUNTER_AT,
  DrillDust,
  HugPillow,
  NUBI_BED,
  NUBI_EYES,
  PHONE_AT,
  PhoneProp,
  Zzz,
  sleepingPose,
} from "../../three/dormir/Bedroom";
import { Nubi, NubiPose } from "../../three/Nubi";
import { ENEMIGO } from "../beats";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot "cama" (ENEMIGO.START → REVEAL): back in bed (a new alarm clock on the nightstand), Nubi
// shuts its eyes happily and its counter starts climbing again. DRILL: a loud drill next door —
// the wall shakes in bursts, plaster dust trickles down, the framed first sol tilts, the counter
// freezes red, Nubi's eyes snap open; during L12 ("Entonces apareció el negocio más odiado.") it
// pulls its pillow over its head and presses it down with both fins, trembling with each burst.
// Medium shot from the front left: the tilting frame on the left, Nubi and its counter right of it.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const CamaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.cama.from;
  const { START, DRILL, L12, REVEAL } = ENEMIGO;
  const t = g / 30;

  // ---- The drill: bursts of brrr (on 9 frames, off 3) from DRILL to the end of the shot.
  const drilling = g >= DRILL;
  const burst = drilling ? ((g - DRILL) % 12 < 9 ? 1 : 0.25) : 0;
  const rattle = drilling ? burst * (0.6 + 0.4 * Math.sin(g * 1.3)) : 0;
  const frameTilt = -0.42 * ramp(g, DRILL, DRILL + 70, [0, 1], (x) => Math.floor(x * 7) / 7);

  // ---- Nubi: settles in with happy closed eyes, jolts awake, pillow over the head.
  const settle = ramp(g, START, START + 10, [0, 1], EASE_OUT);
  const jolt = windowIn(g, DRILL, DRILL + 10, 2);
  const over = ramp(g, L12 + 2, L12 + 14, [0, 1], EASE_IN_OUT);
  const press = ramp(g, L12 + 10, L12 + 16, [0, 1], EASE_OUT);
  const tremble = drilling ? burst * Math.sin(g * 2.6) : 0;
  const sleep = sleepingPose(g - START);
  let base: NubiPose;
  if (!drilling) {
    base = { ...sleep, blink: lerp(0.75, 1, settle), squash: (sleep.squash ?? 1) * (1 - 0.05 * Math.sin(Math.PI * settle)), finL: lerp(0.35, -0.1, settle), finR: lerp(0.35, -0.1, settle), roll: lerp(-0.05, 0.09, settle) };
  } else {
    base = {
      blink: g < L12 + 8 ? 0 : 0.45,
      eyeScale: 1.35 + 0.15 * jolt - 0.25 * press,
      hop: 1.6 * jolt + 0.15 * Math.abs(tremble),
      squash: 1 + 0.06 * jolt - 0.1 * press + 0.02 * tremble,
      pitch: lerp(-0.13, 0.03, ramp(g, DRILL, DRILL + 6)) - 0.05 * press,
      roll: 0.03 * tremble,
      yaw: -0.35 * windowIn(g, DRILL + 3, L12 + 4, 3),
      lookX: -0.6 * windowIn(g, DRILL + 3, L12 + 4, 3),
      lookY: 0.3 * windowIn(g, DRILL + 3, L12 + 4, 3) - 0.25 * press,
      finL: lerp(0.5 * jolt, 1.25, over) + 0.08 * tremble,
      finR: lerp(0.5 * jolt, 1.25, over) - 0.08 * tremble,
      wiggle: 0.5 * burst,
      wigglePhase: g * 1.1,
    };
  }
  const pose = g >= L12 ? nubiTalk(g, base, 0.35) : base;
  if (g >= L12) {
    pose.finL = base.finL;
    pose.finR = base.finR;
  }

  // ---- Camera: from the front left, slow push; it shakes with the bursts.
  const push = ramp(g, START, REVEAL, [0, 1], (x) => x);
  const cam = aim([-1.75 + 0.25 * push, 2.95, 7.6 - 0.9 * push], FOV, [-0.62, 1.95, -1.5], 540, 930);

  // ---- Counter: back to S/0, climbing until the drill, then frozen red.
  const stopAt = DRILL;
  const soles = Math.min(g, stopAt) < START + 6 ? 0 : Math.round(((Math.min(g, stopAt) - START - 6) / (stopAt - START - 6)) * 25);
  const head: Vec3 = [COUNTER_AT[0], COUNTER_AT[1] + 0.2 * (pose.hop ?? 0) + 0.5 * over, COUNTER_AT[2]];
  const ctr = counterAt(cam, head, { min: 0.85, max: 1.05 });

  const impacts = drilling ? Array.from({ length: Math.ceil((REVEAL - DRILL) / 12) }, (_, i) => ({ at: DRILL + i * 12, amp: i === 0 ? 10 : 5, dur: 9 })) : [];
  return (
    <AbsoluteFill style={{ background: "#0A1240" }}>
      <Shake frame={g} impacts={impacts}>
        <Stage cam={cam} near={0.1} far={200}>
          <BedroomLights />
          <Bedroom t={t} rattle={rattle} frameTilt={frameTilt} />
          <group position={CLOCK_AT} rotation={[0, CLOCK_YAW, 0]} scale={CLOCK_SCALE}>
            <AlarmClock t={t} color="#2FA8FF" ring={0.12 * rattle} />
          </group>
          <group position={[PHONE_AT[0], PHONE_AT[1] + 0.03 + 0.02 * rattle * Math.abs(Math.sin(g * 1.9)), PHONE_AT[2]]} rotation={[-Math.PI / 2, 0, 0.5]}>
            <PhoneProp screen="off" />
          </group>
          <Nubi size={2} position={[NUBI_BED[0] + 0.012 * tremble, NUBI_BED[1], NUBI_BED[2]]} pose={pose} shadow={false} palette={{ eyeRough: 0.6 }}>
            <HugPillow over={over} squash={press * (0.25 + 0.1 * Math.abs(tremble))} />
          </Nubi>
          <DrillDust age={g - DRILL} on={drilling ? 1 : 0} />
        </Stage>
        <Zzz g={g} cam={cam} at={[-0.55, NUBI_EYES[1] + 0.75, NUBI_BED[2]]} on={ramp(g, START + 6, START + 10) * (1 - ramp(g, DRILL, DRILL + 2))} every={11} />
        {!ctr.behind && g >= START + 4 ? (
          <MoneyCounter frame={g} soles={soles} x={ctr.x} y={ctr.y} scale={ctr.scale} state={drilling ? "alarm" : "earning"} appear={START + 4} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
